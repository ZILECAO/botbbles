import { getPineconeClient } from '../../plugins/pineconePlugin/pineconePlugin';
import { INDEX_NAME } from '../../plugins/pineconePlugin/pineconePlugin';
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
        vector: new Array(1536).fill(0),
        filter: {
            type: "dune_dashboard"
        }
    });

    console.log(`Found ${queryResponse.matches.length} potential training examples`);

    // Transform matches into training examples
    const trainingExamples: TrainingExample[] = queryResponse.matches
        .filter(match => match.metadata?.text_representation)
        .map(match => {
            // Simplified input format
            const inputData = {
                chartTitle: "Polymarket daily volume",
                data: match.metadata?.text_representation || ''
            };

            return {
                instruction: "Analyze this Polymarket daily volume data and provide insights:",
                input: JSON.stringify(inputData),
                output: `🐰 Here's my analysis of the Polymarket volume:\n\n${match.metadata?.text_representation}\n\nKey insights:\n- Volume for this day was ${match.metadata?.data_usd} USD\n- This represents trading activity on Polymarket\n- The data point shows market engagement\n\nHop along! 🐰`
            };
        });

    if (trainingExamples.length === 0) {
        console.warn('⚠️ No valid training examples found in Pinecone');
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