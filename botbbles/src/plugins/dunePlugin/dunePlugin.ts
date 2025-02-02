import { DuneClient } from "@duneanalytics/client-sdk";
import dotenv from 'dotenv';
dotenv.config();

export const DUNE_API_KEY = process.env.DUNE_API_KEY;

let duneInstance: DuneClient | null = null;


export async function getDuneClient() {
  if (!duneInstance) {
    duneInstance = new DuneClient(DUNE_API_KEY as string);
  }
  return duneInstance;
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





