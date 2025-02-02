import { getPineconeClient } from '../plugins/pineconePlugin/pineconePlugin';
import { INDEX_NAME } from '../plugins/pineconePlugin/pineconePlugin';
import fs from 'fs/promises';
import path from 'path';

interface TrainingExample {
    instruction: string;
    input: string;
    output: string;
}

export async function prepareTrainingData(): Promise<void> {
    const pc = await getPineconeClient();
    const index = pc.Index(INDEX_NAME);
    
    // Fetch all vectors from Pinecone
    const queryResponse = await index.query({
        topK: 10000,
        includeMetadata: true,
        vector: new Array(3072).fill(0) 
    });

    const trainingExamples: TrainingExample[] = queryResponse.matches
        .filter(match => match.metadata?.analysis) // Only include entries with analysis
        .map(match => ({
            instruction: "Analyze this Dune Analytics data and provide insights:",
            input: `Query: ${match.metadata?.queryName || ''}\nDescription: ${match.metadata?.queryDescription || ''}\nData: ${
                typeof match.metadata?.data === 'string' 
                    ? match.metadata.data 
                    : JSON.stringify(match.metadata?.data)
            }`,
            output: String(match.metadata?.analysis || "No analysis available")
        }));

    if (trainingExamples.length === 0) {
        console.warn('⚠️ No training examples found in Pinecone');
        return;
    }

    // Save to JSONL file
    const outputDir = path.join(process.cwd(), 'data');
    await fs.mkdir(outputDir, { recursive: true });
    
    const outputPath = path.join(outputDir, 'training_data.jsonl');
    await fs.writeFile(
        outputPath,
        trainingExamples.map(ex => JSON.stringify(ex)).join('\n')
    );

    console.log(`✅ Saved ${trainingExamples.length} training examples to ${outputPath}`);
} 