import { AlliumMetadata } from '@/types/metadata';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const PINECONE_API_KEY = process.env.NEXT_PINECONE_API_KEY;
const INDEX_NAME = 'allium-queries';

if (!PINECONE_API_KEY) {
  throw new Error('Pinecone API key not configured');
}

let pineconeInstance: Pinecone | null = null;

const openai = new OpenAI({
  apiKey: process.env.NEXT_OPENAI_API_KEY as string,
});

export async function getPineconeClient() {
  if (!pineconeInstance) {
    pineconeInstance = new Pinecone({
      apiKey: PINECONE_API_KEY as string,
    });
  }
  return pineconeInstance;
}

export async function storeAlliumData(data: any[], chartTitle: string) {
  const client = await getPineconeClient();
  const index = client.Index(INDEX_NAME);
  
  const chartNamespace = `allium-${chartTitle.toLowerCase().replace(/\s+/g, '-')}`;

  console.log('=== Pinecone Storage Operation ===');
  console.log(`Index: ${INDEX_NAME}`);
  console.log(`Chart Namespace: ${chartNamespace}`);
  console.log(`Data Points: ${data.length}`);
  console.log('================================');

  // Get existing data dates to avoid duplicates
  const existingData = await getLatestAlliumData(chartTitle);
  const existingDates = new Set(
    existingData.map(item => `${item.chain}_${item.activity_date}`)
  );

  const newData = data.filter(item => {
    const key = `${item.chain}_${item.activity_date}`;
    return !existingDates.has(key);
  });

  if (newData.length === 0) {
    console.log('[Pinecone] No new data points to add');
    return;
  }

  const chunkSize = 100;
  
  for (let i = 0; i < newData.length; i += chunkSize) {
    const chunk = newData.slice(i, i + chunkSize);
    
    // Validate data points
    const validChunk = chunk.filter(item => 
      item.chain && 
      item.activity_date && 
      typeof item.active_addresses === 'number' &&
      !isNaN(item.active_addresses) &&
      item.active_addresses >= 0
    );

    if (validChunk.length === 0) continue;

    // Get embeddings and create vectors with chartNamespace in metadata
    const vectors = await createVectors(validChunk, chartTitle);

    try {
      console.log(`[Pinecone] Upserting to index: ${INDEX_NAME}`);
      console.log(`[Pinecone] Metadata namespace: ${chartNamespace}`);
      await index.upsert(vectors);
      console.log(
        `[Pinecone] Successfully uploaded ${vectors.length} vectors`
      );
    } catch (error) {
      console.error('[Pinecone] Error uploading chunk:', error);
      throw error;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

interface AlliumResult {
  chain: string;
  activity_date: string;
  active_addresses: number;
  type: string;
  timestamp: number;
}

export async function getLatestAlliumData(chartTitle: string): Promise<AlliumResult[]> {
  const client = await getPineconeClient();
  const index = client.Index(INDEX_NAME);
  
  const chartNamespace = `allium-${chartTitle.toLowerCase().replace(/\s+/g, '-')}`;

  console.log('=== Pinecone Query Operation ===');
  console.log(`Index: ${INDEX_NAME}`);
  console.log(`Chart Namespace: ${chartNamespace}`);
  console.log('==============================');

  const queryResponse = await index.query({
    vector: new Array(3072).fill(0),
    filter: {
      type: { $eq: 'allium_metrics' },
      chartNamespace: { $eq: chartNamespace }
    },
    topK: 10000,
    includeMetadata: true
  });

  console.log(`[Pinecone] Query returned ${queryResponse.matches.length} matches from ${INDEX_NAME}`);
  console.log(`[Pinecone] For namespace: ${chartNamespace}`);

  return processQueryResults(queryResponse.matches);
}

// Helper functions
async function createVectors(data: any[], chartTitle: string) {
  const texts = data.map(
    (item) =>
      `Chain: ${item.chain}, Date: ${item.activity_date}, Active Addresses: ${item.active_addresses}`
  );

  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: texts,
  });

  const embeddings = embeddingResponse.data.map((datum) => datum.embedding);

  return embeddings.map((embedding, j) => ({
    id: `${chartTitle}-${Date.now()}-${j}`,
    values: embedding,
    metadata: {
      chain: data[j].chain,
      activity_date: data[j].activity_date,
      active_addresses: data[j].active_addresses,
      chartTitle,
      timestamp: Date.now(),
      type: 'allium_metrics'
    },
  }));
}

function processQueryResults(matches: any[]): AlliumResult[] {
  return matches
    .filter((match): match is { metadata: AlliumMetadata } => {
      const metadata = match.metadata;
      return metadata && 
        metadata.chain &&
        metadata.activity_date &&
        typeof metadata.active_addresses === 'number' &&
        !isNaN(metadata.active_addresses) &&
        metadata.active_addresses >= 0;
    })
    .map((match) => ({
      chain: String(match.metadata.chain),
      activity_date: String(match.metadata.activity_date),
      active_addresses: Number(match.metadata.active_addresses),
      type: 'allium_metrics',
      timestamp: Number(match.metadata.timestamp)
    }));
}
