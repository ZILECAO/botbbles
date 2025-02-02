import { compareModelResponses } from '../plugins/hyperbolicPlugin/hyperbolicPlugin';
import dotenv from 'dotenv';
dotenv.config();

async function testModels() {
    const testPrompt = `What are some interesting blockchain analytics trends you've noticed?`;

    try {
        console.log("🧪 Running comparison test...\n");
        const results = await compareModelResponses(testPrompt);
        
        console.log("\n📊 Comparison Summary:");
        console.log("Base Model Length:", results.base.length);
        console.log("Fine-tuned Model Length:", results.finetuned.length);
        console.log("\nTest complete! Check the responses above for quality comparison.");
    } catch (error) {
        console.error("❌ Test failed:", error);
    }
}


testModels();