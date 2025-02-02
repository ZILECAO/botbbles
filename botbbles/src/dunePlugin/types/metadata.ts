import { RecordMetadata, RecordMetadataValue, ScoredPineconeRecord } from "@pinecone-database/pinecone";

export interface AlliumMetadata extends RecordMetadata {
  chain: string;
  activity_date: string;
  active_addresses: number;
  type: 'allium_metrics';
  timestamp: number;
}

export interface TokenPriceMetadata extends RecordMetadata {
  token: string;
  price: number;
  timestamp: number;
  date: string;
  type: 'token_prices';
}

export interface ChainFilter {
  type: { $eq: 'allium_metrics' };
  activity_date?: { $eq: string };
  chain?: { $eq: string };
}

export interface TokenFilter {
  type: { $eq: 'token_prices' };
  date?: { $eq: string };
  token?: { $eq: string };
}

export interface ChainResult {
  chain: string;
  date: string;
  addresses: number;
  score: number;
}

export interface TokenResult {
  token: string;
  date: string;
  price: number;
  score: number;
}

export interface QueryResults {
  chain?: ChainResult[];
  token: TokenResult[];
}

export interface DuneMetadata extends RecordMetadata {
  date: string;
  chartTitle: string;
  type: 'dune_metrics';
  timestamp: string;
  [key: string]: RecordMetadataValue;
}

export type DunePineconeRecord = ScoredPineconeRecord<DuneMetadata>; 

