import { RecordMetadata, ScoredPineconeRecord } from "@pinecone-database/pinecone";
import dotenv from 'dotenv';
dotenv.config();

export interface DuneMetadata extends RecordMetadata {
  chartTitle: string;
  chartDescription: string;
  queryId: string;
  timestamp: string;
  type: 'dune_metrics';
  [key: string]: string | number | boolean;
}

export interface DunePineconeRecord extends ScoredPineconeRecord<DuneMetadata> {
  metadata: DuneMetadata;
}

export interface ChartQueryResult extends ScoredPineconeRecord<DuneMetadata> {
  id: string;
  values: number[];
  score: number;
  metadata: DuneMetadata;
}

export interface ChartContext {
  title: string;
  type: 'dune';
} 
