import { getDuneClient, extractQueryId } from '../plugins/dunePlugin/dunePlugin';
import { hyperbolicRAGChatCompletion } from '../plugins/hyperbolicPlugin/hyperbolicPlugin';
import { getPineconeClient, getOpenAIClient } from '../plugins/pineconePlugin/pineconePlugin';
import { processDuneBatch } from '../plugins/dunePlugin/duneRAG';
import { INDEX_NAME } from '../plugins/pineconePlugin/pineconePlugin';
import path from 'path';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env');
console.log('🔍 Loading .env file from:', envPath);

async function testDuneAnalysis() {
    try {
        const openai = await getOpenAIClient();
        const duneClient = await getDuneClient();

        // Hardcoded test URL
        const testUrl = "https://dune.com/queries/2684122/4463552";

        console.log('🔍 Testing Dune analysis with URL:', testUrl);

        // Extract query ID
        const queryId = extractQueryId(testUrl);
        if (!queryId) {
            throw new Error('Could not extract query ID from URL');
        }
        console.log('📊 Extracted query ID:', queryId);

        // Get query metadata
        const queryMetadata = await duneClient.query.readQuery(parseInt(queryId));
        console.log('📊 Query Title:', queryMetadata.name);
        console.log('📝 Query Description:', queryMetadata.description);
        console.log('🔍 Query SQL:', queryMetadata.query_sql);

        // Fetch results
        console.log('📡 Fetching results for query ID:', queryId);
        const results = await duneClient.getLatestResult({ queryId: parseInt(queryId) });

        if (!results?.result?.rows) {
            throw new Error('No data returned from Dune');
        }

        console.log('✅ Results received:', JSON.stringify(results.result.rows, null, 2));

        // Store in Pinecone
        console.log('📦 Storing results in Pinecone...');
        const pc = await getPineconeClient();
        const index = pc.Index(INDEX_NAME);

        // Process the data in batches
        const totalProcessed = await processDuneBatch(
            results.result.rows,
            queryId,
            queryMetadata.name,
            queryMetadata.description
        );
        console.log(`📈 Stored ${totalProcessed} rows in Pinecone`);


        // Generate analysis using RAG
        console.log('🤖 Generating analysis...');
        const analysisPrompt = `Analyze the following analytics data from the Dune query titled "${queryMetadata.name}".
            Description: ${queryMetadata.description}
            SQL Query: ${queryMetadata.query_sql}

            Data:
            ${JSON.stringify(results.result.rows, null, 2)}`;

        const RAGresponse = await hyperbolicRAGChatCompletion(analysisPrompt);

        console.log('\n🐰 Botbbles Analysis:', RAGresponse);

    } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    }
}

// Run the test
testDuneAnalysis();