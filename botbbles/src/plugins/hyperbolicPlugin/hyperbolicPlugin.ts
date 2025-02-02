import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { syncToHyperbolic } from './syncToHyperbolic';
const execAsync = util.promisify(exec);

const HYPERBOLIC_SSH = "ubuntu@blaring-daisy-grasshopper.1.cricket.hyperbolic.xyz -p 31424";

export async function hyperbolicRAGChatCompletion(prompt: string, useFinetuned: boolean = false) {
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

// Test function to compare responses
export async function compareModelResponses(prompt: string) {
    console.log("🔄 Testing both models...\n");

    try {
        console.log("📊 Base model with RAG:");
        const baseResponse = await hyperbolicRAGChatCompletion(prompt, false);
        console.log(baseResponse);

        console.log("\n🎯 Fine-tuned model:");
        await syncToHyperbolic(); // upload local inference prompt to remote Hyperbolic GPU
        const finetunedResponse = await hyperbolicRAGChatCompletion(prompt, true);
        console.log(finetunedResponse);

        return {
            base: baseResponse,
            finetuned: finetunedResponse
        };
    } catch (error) {
        console.error("❌ Error comparing models:", error);
        throw error;
    }
}