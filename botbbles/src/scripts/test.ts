import { getDuneClient, extractQueryId } from '../dunePlugin/client';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { sanitizeMetadata } from '../dunePlugin/api/route';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env');
console.log('🔍 Loading .env file from:', envPath);
dotenv.config();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const INDEX_NAME = 'botbbles';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY as string,
});

async function testDuneAnalysis() {
    try {
        // Hardcoded test URL
        const testUrl = "https://dune.com/queries/2684122/4463552";
        
        console.log('🔍 Testing Dune analysis with URL:', testUrl);
        
        // Extract query ID
        const queryId = extractQueryId(testUrl);
        if (!queryId) {
            throw new Error('Could not extract query ID from URL');
        }
        console.log('📊 Extracted query ID:', queryId);

        // Get Dune client
        const client = await getDuneClient();
        console.log('🔌 Dune client initialized');

        // Fetch results
        console.log('📡 Fetching results for query ID:', queryId);
        const results = await client.getLatestResult({ queryId: parseInt(queryId) });

        if (!results?.result?.rows) {
            throw new Error('No data returned from Dune');
        }

        console.log('✅ Results received:', JSON.stringify(results.result.rows, null, 2));

        // Store in Pinecone
        console.log('📦 Storing results in Pinecone...');
        const pc = new Pinecone({ apiKey: PINECONE_API_KEY as string });
        const index = pc.Index(INDEX_NAME);

        // Process the data in batches
        const batchSize = 100;
        const rows = results.result.rows;
        
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
                id: `chart-${queryId}-${Date.now()}-${j}`,
                values: embedding,
                metadata: {
                    ...sanitizeMetadata(batch[j]),
                    queryId,
                    timestamp: Date.now().toString(),
                    type: 'dune_metrics'
                },
            }));

            await index.upsert(vectors);
            console.log(`📈 Stored batch ${i/batchSize + 1} in Pinecone`);
        }

        // Generate analysis using RAG
        console.log('🤖 Generating analysis...');
        const analysisPrompt = `Analyze the following Dune Analytics data and provide insights in a friendly, accessible way. Remember to maintain the persona of a data-loving bunny! 🐰\n\n${JSON.stringify(results.result.rows, null, 2)}`;
        
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { 
                    role: "system", 
                    content: "You are Botbbles, a data-loving bunny who explains blockchain analytics in a friendly way. Use bunny puns and emojis 🐰 while maintaining analytical accuracy. Make sure to include explicit data points and numbers in your analysis. Only use the data in your context in your response, otherwise don't hallucinate."
                },
                { role: "user", content: analysisPrompt }
            ],
            temperature: 0.7,
            max_tokens: 280 // Twitter limit
        });

        console.log('\n🐰 Botbbles Analysis:', completion.choices[0].message.content);

    } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    }
}

// Run the test
testDuneAnalysis();