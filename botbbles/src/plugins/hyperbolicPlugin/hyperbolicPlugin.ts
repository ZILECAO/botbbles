import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { syncToHyperbolic } from './syncToHyperbolic';
import { getPineconeClient, getOpenAIClient } from '../pineconePlugin/pineconePlugin';
import { INDEX_NAME } from '../pineconePlugin/pineconePlugin';
const execAsync = util.promisify(exec);

const HYPERBOLIC_SSH = "ubuntu@blaring-daisy-grasshopper.1.cricket.hyperbolic.xyz -p 31424";

// NON-RAG Chat Completion
export async function hyperbolicChatCompletion(prompt: string, useFinetuned: boolean = false) {
    try {
        if (!useFinetuned) {
            // Use API for base model
            const modelPath = 'meta-llama/Llama-3.3-70B-Instruct';
            console.log(`🔍 Using model path: ${modelPath}`);
            
            const response = await fetch('https://api.hyperbolic.xyz/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.HYPERBOLIC_API_KEY}`,
                },
                body: JSON.stringify({
                    model: modelPath,
                    messages: [
                        { 
                            role: "system", 
                            content: "You are Botbbles, a data-loving bunny who explains blockchain analytics in a friendly way. Use bunny puns and emojis 🐰 while maintaining analytical accuracy."
                        },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: 280,
                    temperature: 0.7,
                    top_p: 0.9,
                    stream: false
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
            }

            const json = await response.json();
            return json.choices[0].message.content;
        } else {
            // Use SSH for fine-tuned model inference
            console.log('🔍 Running inference on Hyperbolic GPU...');
            
            // Escape the prompt for shell safety
            const escapedPrompt = prompt.replace(/"/g, '\\"');
            
            const sshCommand = `ssh ${HYPERBOLIC_SSH} "cd /home/ubuntu/botbbles && python3 src/scripts/unsloth-finetune/runRemoteInference.py \\"${escapedPrompt}\\""`;
            
            console.log('🤖 Executing:', sshCommand);
            
            const { stdout, stderr } = await execAsync(sshCommand);
            
            if (stderr) {
                console.error('⚠️ SSH stderr:', stderr);
            }
            
            return stdout.trim();
        }
    } catch (error) {
        console.error('Error in hyperbolicRAGChatCompletion:', error);
        return `🐰 Oops! This bunny encountered an error while trying to analyze the data: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

// RAG-BASED Chat Completion
export async function hyperbolicRAGChatCompletion(prompt: string, useFinetuned: boolean = false) {
    try {
        // Get OpenAI client for embeddings
        const openai = await getOpenAIClient();
        
        // Generate embedding for the prompt
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-large',
            input: prompt,
            dimensions: 1536
        });
        
        // Get Pinecone client and index
        const pc = await getPineconeClient();
        const index = pc.Index(INDEX_NAME);
        
        // Query Pinecone for relevant context
        const queryResponse = await index.query({
            vector: embeddingResponse.data[0].embedding,
            topK: 5,
            includeMetadata: true
        });

        // Extract and format relevant context
        const relevantContext = queryResponse.matches
            .filter(match => match.metadata?.text_representation)
            .map(match => match.metadata?.text_representation)
            .join('\n\n');

        // Construct augmented prompt with context
        const augmentedPrompt = `Here is some relevant blockchain data with historical context:

${relevantContext}

Using this context, ${prompt}`;

        if (!useFinetuned) {
            // Use API for base model with RAG context
            const modelPath = 'meta-llama/Llama-3.3-70B-Instruct';
            console.log(`🔍 Using model path: ${modelPath}`);
            
            const response = await fetch('https://api.hyperbolic.xyz/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.HYPERBOLIC_API_KEY}`,
                },
                body: JSON.stringify({
                    model: modelPath,
                    messages: [
                        { 
                            role: "system", 
                            content: "You are Botbbles, a data-loving bunny who explains blockchain analytics in a friendly way. Use bunny puns and emojis 🐰 while maintaining analytical accuracy."
                        },
                        { role: "user", content: augmentedPrompt }
                    ],
                    max_tokens: 280,
                    temperature: 0.7,
                    top_p: 0.9,
                    stream: false
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
            }

            const json = await response.json();
            return json.choices[0].message.content;
        } else {
            // Use SSH for fine-tuned model inference with RAG context
            console.log('🔍 Running inference on Hyperbolic GPU...');
            
            const escapedPrompt = augmentedPrompt.replace(/"/g, '\\"');
            
            const sshCommand = `ssh ${HYPERBOLIC_SSH} "cd /home/ubuntu/botbbles && python3 src/scripts/unsloth-finetune/runRemoteInference.py \\"${escapedPrompt}\\""`;
            
            console.log('🤖 Executing:', sshCommand);
            
            const { stdout, stderr } = await execAsync(sshCommand);
            
            if (stderr) {
                console.error('⚠️ SSH stderr:', stderr);
            }
            
            return stdout.trim();
        }
    } catch (error) {
        console.error('Error in hyperbolicRAGChatCompletion:', error);
        return `🐰 Oops! This bunny encountered an error while trying to analyze the data: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

// Test function to compare responses
export async function compareModelResponses(prompt: string) {
    console.log("🔄 Testing both models...\n");

    try {
        console.log("📊 BASE MODEL WITHOUT RAG:");
        const baseResponse = await hyperbolicChatCompletion(prompt, false);
        console.log(baseResponse);
        console.log("//////////////////////////////////////////////////////////////\n");

        console.log("📊 BASE MODEL WITH RAG:");
        const baseRAGResponse = await hyperbolicRAGChatCompletion(prompt, false);
        console.log(baseRAGResponse);
        console.log("//////////////////////////////////////////////////////////////\n");

        await syncToHyperbolic(); // upload local inference prompt to remote Hyperbolic GPU
        console.log("//////////////////////////////////////////////////////////////\n");

        console.log("\n🎯 FINE-TUNED MODEL WITHOUT RAG:");
        const finetunedResponse = await hyperbolicChatCompletion(prompt, true);
        console.log(finetunedResponse);
        console.log("//////////////////////////////////////////////////////////////\n");

        console.log("\n🎯 FINE-TUNED MODEL WITH RAG:");
        const finetunedRAGResponse = await hyperbolicRAGChatCompletion(prompt, true);
        console.log(finetunedRAGResponse);
        console.log("//////////////////////////////////////////////////////////////\n");


        return {
            base: baseResponse,
            finetuned: finetunedResponse
        };
    } catch (error) {
        console.error("❌ Error comparing models:", error);
        throw error;
    }
}