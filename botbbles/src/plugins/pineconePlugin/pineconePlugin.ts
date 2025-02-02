import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

export const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const INDEX_NAME = 'botbbles';


let pineconeInstance: Pinecone | null = null;
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

export async function getPineconeClient() {
    if (!pineconeInstance) {
        pineconeInstance = new Pinecone({
            apiKey: PINECONE_API_KEY as string
        });
    }
    return pineconeInstance;
}

export async function getOpenAIClient() {
    return openai;
  }