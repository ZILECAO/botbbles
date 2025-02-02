import { Pinecone } from '@pinecone-database/pinecone';
import { INDEX_NAME } from '../../plugins/pineconePlugin/pineconePlugin';
import fs from 'fs';
import path from 'path';

interface TrainingExample {
    instruction: string;
    input: string;
    output: string;
}

export async function prepareTrainingData() {
    console.log('🐰 Preparing training data from Pinecone...');
    
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY as string
    });
    const index = pc.Index(INDEX_NAME);

    // Query all vectors from Pinecone
    const queryResponse = await index.query({
        vector: Array(1536).fill(0), // Zero vector to get all data
        topK: 100,
        includeMetadata: true
    });

    // Transform matches into training examples
    const trainingExamples: TrainingExample[] = queryResponse.matches
        .filter(match => match.metadata?.chartTitle) // Only use entries with chartTitle
        .map(match => {
            const metadata = match.metadata;
            
            // Format the input data
            const inputData = {
                chartTitle: metadata?.chartTitle || '',
                data: metadata?.text_representation || ''
            };

            return {
                instruction: "You are Botbbles, a data-loving bunny who explains analytics in a friendly way. Analyze this chart data and provide insights with bunny puns and emojis 🐰:",
                input: JSON.stringify(inputData),
                output: `Oh my carrots! 🐰 Let me analyze this ${inputData.chartTitle} for you!\n\n${inputData.data}\n\nHop along! 🥕`
            };
        });

    // Save to JSONL file
    const outputDir = path.join(process.cwd(), 'data');
    fs.mkdirSync(outputDir, { recursive: true });
    
    const outputPath = path.join(outputDir, 'training_data.jsonl');
    const writeStream = fs.createWriteStream(outputPath);
    
    for (const example of trainingExamples) {
        writeStream.write(JSON.stringify(example) + '\n');
    }
    writeStream.end();

    console.log(`✨ Created ${trainingExamples.length} training examples`);
    console.log(`💾 Saved to ${outputPath}`);
    
    return trainingExamples;
} 