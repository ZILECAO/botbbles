import { getOpenAIClient, getPineconeClient } from "../pineconePlugin/pineconePlugin";
import { INDEX_NAME } from "../pineconePlugin/pineconePlugin";
import { sanitizeMetadata } from "../dunePlugin/dunePlugin";

export async function processDuneBatch(
    rows: any[], 
    queryId: string, 
    // TODO2
    chartTitle?: string
  ) {
    const openai = await getOpenAIClient();
    const pc = await getPineconeClient();
    const index = pc.Index(INDEX_NAME);
    
    // Process the data in batches
    const batchSize = 100;
    let totalProcessed = 0;
  
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
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
          timestamp: Date.now().toString(),
          type: 'dune_metrics' as const
        },
      }));
  
      await index.upsert(vectors);
      totalProcessed += vectors.length;
      
      if (i + batchSize < rows.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return totalProcessed;
  } 