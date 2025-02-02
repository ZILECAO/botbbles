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
        vector: Array(3072).fill(0), // Dummy vector for metadata-only query
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
        const texts = batch.map(item => 
            Object.entries(item)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ')
        );

        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-large',
            input: texts,
        });

        const embeddings = embeddingResponse.data.map(datum => datum.embedding);
        const vectors = embeddings.map((embedding, j) => ({
            id: `${queryId}-${Date.now()}-${j}`,
            values: embedding,
            metadata: {
                ...sanitizeMetadata(batch[j]),
                queryId,
                chartTitle: chartTitle || 'Untitled Chart',
                chartDescription: chartDescription || '',
                timestamp: Date.now().toString(),
                type: 'dune_dashboard' as const
            },
        }));

        await index.upsert(vectors);
        totalProcessed += vectors.length;
        
        if (i + batchSize < newRows.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    return totalProcessed;
} 