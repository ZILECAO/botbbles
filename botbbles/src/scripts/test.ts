import { getDuneClient, extractQueryId, getPineconeClient, getOpenAIClient, processDuneBatch } from '../dunePineconeRAGPlugin/dunePineconeRAGPlugin';
import path from 'path';
import { INDEX_NAME } from '../dunePineconeRAGPlugin/dunePineconeRAGPlugin';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env');
console.log('🔍 Loading .env file from:', envPath);

async function testDuneAnalysis() {
    try {
        const openai = await getOpenAIClient();
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
        const pc = await getPineconeClient();
        const index = pc.Index(INDEX_NAME);

        // Process the data in batches
        const totalProcessed = await processDuneBatch(results.result.rows, queryId);
        console.log(`📈 Stored ${totalProcessed} rows in Pinecone`);
        

        // Generate analysis using RAG
        console.log('🤖 Generating analysis...');
        const analysisPrompt = `Analyze the following Dune Analytics data and provide insights in a friendly, accessible way. Remember to maintain the persona of a data-loving bunny! 🐰\n\n${JSON.stringify(results.result.rows, null, 2)}`; // TODO2
        
        const response = await fetch('https://api.hyperbolic.xyz/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.HYPERBOLIC_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'meta-llama/Llama-3.3-70B-Instruct',
                messages: [
                    { 
                        role: "system", 
                        content: "You are Botbbles, a data-loving bunny who explains blockchain analytics in a friendly way. Use bunny puns and emojis 🐰 while maintaining analytical accuracy. Make sure to include explicit data points and numbers in your analysis. Only use the data in your context in your response, otherwise don't hallucinate."
                    },
                    { role: "user", content: analysisPrompt }
                ],
                max_tokens: 280, // Twitter limit
                temperature: 0.7,
                top_p: 0.9,
                stream: false
            }),
        });

        const json = await response.json();
        const completion = {
            choices: [
                {
                    message: {
                        content: json.choices[0].message.content
                    }
                }
            ]
        };

        console.log('\n🐰 Botbbles Analysis:', completion.choices[0].message.content);

    } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    }
}

// Run the test
testDuneAnalysis();