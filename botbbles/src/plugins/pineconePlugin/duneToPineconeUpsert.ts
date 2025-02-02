import { getOpenAIClient, getPineconeClient } from "./pineconePlugin";
import { INDEX_NAME } from "./pineconePlugin";
import { sanitizeMetadata } from "../dunePlugin/dunePlugin";

export async function processDuneBatchPineconeUpsert(
    rows: any[], 
    queryId: string, 
    chartTitle?: string,
    chartDescription?: string,
) {
    const openai = await getOpenAIClient();
    const pc = await getPineconeClient();
    const index = pc.Index(INDEX_NAME);
    
    // Get existing data for this query
    const existingData = await index.query({
        vector: Array(1536).fill(0), // text-embedding-3-large dimension
        filter: {
            queryId: { $eq: queryId }
        },
        includeMetadata: true,
        topK: 10000
    });

    // Create Set of existing unique identifiers
    const existingKeys = new Set(
        existingData.matches.map(match => 
            `${match.metadata?.queryId}_${match.metadata?._col0}_${match.metadata?._col1}`
        )
    );

    // Filter out rows that already exist
    const newRows = rows.filter(row => {
        const sanitizedRow = sanitizeMetadata(row);
        const key = `${queryId}_${sanitizedRow._col0}_${sanitizedRow._col1}`;
        return !existingKeys.has(key);
    });

    if (newRows.length === 0) {
        console.log('No new data to add');
        return 0;
    }

    // Process the new data in batches
    const batchSize = 100;
    let totalProcessed = 0;

    for (let i = 0; i < newRows.length; i += batchSize) {
        const batch = newRows.slice(i, i + batchSize);
        
        // Create text representation for embedding
        const texts = batch.map(item => {
            const entries = Object.entries(item);
            return entries
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
        });

        // Get embeddings using text-embedding-3-large model
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-large',
            input: texts,
            dimensions: 1536  // Explicitly specify dimensions
        });

        const embeddings = embeddingResponse.data.map(datum => datum.embedding);
        
        // Create vectors with flattened metadata
        const vectors = embeddings.map((embedding, j) => {
            const rowData = batch[j];
            const flatMetadata: Record<string, string | number | boolean | string[]> = {
                ...sanitizeMetadata(rowData),
                queryId,
                chartTitle: chartTitle || 'Untitled Chart',
                chartDescription: chartDescription || '',
                timestamp: Date.now().toString(),
                type: 'dune_dashboard',
                // Store data fields as individual metadata fields
                ...Object.entries(rowData).reduce((acc, [key, value]) => ({
                    ...acc,
                    [`data_${key}`]: value?.toString() || ''
                }), {}),
                // Add text representation
                text_representation: texts[j]
            };

            return {
                id: `${queryId}-${Date.now()}-${j}`,
                values: embedding,
                metadata: flatMetadata,
            };
        });

        // Verify vector dimensions before upserting
        if (vectors.some(v => v.values.length !== 1536)) {
            throw new Error(`Invalid vector dimension. Expected 1536, got ${vectors[0].values.length}`);
        }

        await index.upsert(vectors);
        totalProcessed += vectors.length;
        
        // Rate limiting
        if (i + batchSize < newRows.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    return totalProcessed;
} 