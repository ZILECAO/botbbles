import { NextResponse } from 'next/server';
import { getDuneClient, extractQueryId } from '@/lib/dune/client';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const PINECONE_API_KEY = process.env.NEXT_PINECONE_API_KEY;
const INDEX_NAME = 'dune-queries';
const MAX_VECTOR_BATCH_SIZE = 100;

const openai = new OpenAI({
  apiKey: process.env.NEXT_OPENAI_API_KEY as string,
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

export const maxDuration = 300;
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    // Log the incoming request
    console.log('[Dune] Received request:', {
      headers: Object.fromEntries(req.headers.entries()),
      url: req.url
    });

    const body = await req.json().catch(e => {
      console.error('[Dune] Failed to parse request body:', e);
      throw new Error('Invalid request body');
    });
    
    const { iframeUrl, chartTitle } = body;
    
    if (!iframeUrl || !chartTitle) {
      throw new Error('Missing required fields: iframeUrl or chartTitle');
    }

    const queryId = extractQueryId(iframeUrl);
    if (!queryId) {
      return NextResponse.json({ error: 'Invalid Dune iframe URL' }, { status: 400 });
    }

    console.log(`[Dune] Processing query ID: ${queryId} for chart: ${chartTitle}`);

    const client = await getDuneClient();
    const results = await client.getLatestResult({ queryId: parseInt(queryId) });
    
    if (!results?.result?.rows) {
      throw new Error('No data returned from Dune');
    }

    const rows = results.result.rows;
    console.log(`[Dune] Total rows to process: ${rows.length}`);
    
    const pc = new Pinecone({ apiKey: PINECONE_API_KEY as string });
    const index = pc.Index(INDEX_NAME);

    // Process rows in smaller batches
    let totalProcessed = 0;
    const batchSize = 100;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      console.log(`[Dune] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(rows.length/batchSize)}`);
      
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
      
      if (i + batchSize < rows.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`[Dune] Completed processing ${totalProcessed} rows for chart: ${chartTitle}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Dune] Query error:', {
      name: (error as Error).name,
      message: (error as Error).message,
      stack: (error as Error).stack,
      error: error
    });
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to execute query',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 