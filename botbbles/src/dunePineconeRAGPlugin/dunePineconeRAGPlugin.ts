import { DuneClient } from "@duneanalytics/client-sdk";
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
dotenv.config();

export const DUNE_API_KEY = process.env.DUNE_API_KEY;
export const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const INDEX_NAME = 'botbbles';


let duneInstance: DuneClient | null = null;
let pineconeInstance: Pinecone | null = null;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

export async function getDuneClient() {
  if (!duneInstance) {
    duneInstance = new DuneClient(DUNE_API_KEY as string);
  }
  return duneInstance;
}

export async function getPineconeClient() {
  if (!pineconeInstance) {
    pineconeInstance = new Pinecone({
      apiKey: PINECONE_API_KEY as string
    });
  }
  return pineconeInstance;
}

export function extractQueryId(iframeUrl: string): string | null {
  // Handle full URL format (dune.com/queries/123456/789012)
  const fullMatch = iframeUrl.match(/dune\.com\/(queries|embeds)\/(\d+)\/(\d+)/);
  if (fullMatch) return fullMatch[2]; // Return the query ID (first number)
  
  // Handle embed URL format (dune.com/embeds/123456)
  const embedMatch = iframeUrl.match(/dune\.com\/embeds\/(\d+)/);
  if (embedMatch) return embedMatch[1];
  
  // Handle direct query URL format (dune.com/queries/123456)
  const queryMatch = iframeUrl.match(/dune\.com\/queries\/(\d+)/);
  if (queryMatch) return queryMatch[1];
  
  // Handle iframe tag
  if (iframeUrl.includes('<iframe')) {
    const srcMatch = iframeUrl.match(/src="[^"]*(?:embeds|queries)\/(\d+)/);
    if (srcMatch) return srcMatch[1];
  }
  
  return null;
}

// Helper function to sanitize metadata values
export function sanitizeMetadata(obj: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      sanitized[key] = "0";
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(v => v?.toString() || "0");
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeMetadata(value);
    } else {
      sanitized[key] = value.toString();
    }
  }
  
  return sanitized;
}


export async function getOpenAIClient() {
  return openai;
}

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