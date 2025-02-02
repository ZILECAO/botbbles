import { RecordMetadata, ScoredPineconeRecord } from "@pinecone-database/pinecone";
import dotenv from 'dotenv';
dotenv.config();

export interface DuneMetadata extends RecordMetadata {
  queryId: string;
  timestamp: string;
  type: 'dune_metrics';
  [key: string]: string | number | boolean;
}


export type ChartMetadata = DuneMetadata;

export interface DunePineconeRecord extends ScoredPineconeRecord<DuneMetadata> {
  metadata: DuneMetadata;
}

export interface ChartQueryResult extends ScoredPineconeRecord<ChartMetadata> {
  id: string;
  values: number[];
  score: number;
  metadata: ChartMetadata;
}

export interface ChartFilter {
  type: { $eq: 'dune_metrics' };
  chartTitle?: { $eq: string };
}


export interface ChartContext {
  title: string;
  type: 'dune';
} 
