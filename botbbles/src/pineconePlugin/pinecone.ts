import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { DuneMetadata } from '../dunePlugin/types/metadata';
import dotenv from 'dotenv';
dotenv.config();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const INDEX_NAME = 'dune-queries';
const MAX_VECTOR_BATCH_SIZE = 100;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY as string,
});

function sanitizeMetadata(obj: Record<string, any>): Record<string, any> {
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

export async function storeDuneData(rows: any[], chartTitle: string) {
  if (!PINECONE_API_KEY) {
    throw new Error('Pinecone API key not configured');
  }

  const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = pc.Index(INDEX_NAME);

  let totalProcessed = 0;
  console.log(`[Dune] Total rows to process: ${rows.length}`);

  for (let i = 0; i < rows.length; i += MAX_VECTOR_BATCH_SIZE) {
    const batch = rows.slice(i, i + MAX_VECTOR_BATCH_SIZE);
    console.log(`[Dune] Processing batch ${Math.floor(i/MAX_VECTOR_BATCH_SIZE) + 1}/${Math.ceil(rows.length/MAX_VECTOR_BATCH_SIZE)}`);
    
    const texts = batch.map(item => {
      const itemEntries = Object.entries(item)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      return itemEntries;
    });

    console.log(`[Dune] Creating embeddings for ${texts.length} items`);
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: texts,
    });

    const embeddings = embeddingResponse.data.map(datum => datum.embedding);
    const vectors = embeddings.map((embedding, j) => ({
      id: `${chartTitle}-${Date.now()}-${j}`,
      values: embedding,
      metadata: {
        ...sanitizeMetadata(batch[j]),
        chartTitle,
        timestamp: Date.now().toString(),
        type: 'dune_metrics'
      },
    }));

    console.log(`[Dune] Upserting ${vectors.length} vectors to Pinecone`);
    await index.upsert(vectors);
    
    totalProcessed += vectors.length;
    console.log(`[Dune] Progress: ${totalProcessed}/${rows.length} rows processed`);
    
    if (i + MAX_VECTOR_BATCH_SIZE < rows.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return totalProcessed;
}

export async function queryDuneData(chartTitle: string) {
  if (!PINECONE_API_KEY) {
    throw new Error('Pinecone API key not configured');
  }

  const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = pc.Index(INDEX_NAME);

  const response = await index.query({
    vector: new Array(3072).fill(0), // Zero vector to get all results
    filter: {
      type: { $eq: 'dune_metrics' },
      chartTitle: { $eq: chartTitle }
    },
    topK: 10000,
    includeMetadata: true
  });

  return response.matches.filter((match): match is { metadata: DuneMetadata } => 
    match.metadata !== undefined
  );
}