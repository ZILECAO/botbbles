import { DuneClient } from "@duneanalytics/client-sdk";
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
dotenv.config();

const DUNE_API_KEY = process.env.DUNE_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const INDEX_NAME = 'botbbles';

// More detailed error checking
const missingKeys = [];
if (!DUNE_API_KEY) missingKeys.push('DUNE_API_KEY');
if (!PINECONE_API_KEY) missingKeys.push('PINECONE_API_KEY');
if (!OPENAI_API_KEY) missingKeys.push('OPENAI_API_KEY');

if (missingKeys.length > 0) {
    console.error('❌ Missing required API keys:', missingKeys.join(', '));
    throw new Error(`Missing required API keys: ${missingKeys.join(', ')}`);
}

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