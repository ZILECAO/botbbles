import { botbbles_agent } from "./agent";
import dotenv from "dotenv";
import path from 'path';

// Add debug logging for .env loading
const envPath = path.resolve(process.cwd(), '.env');
console.log('🔍 Loading .env file from:', envPath);
dotenv.config();


async function main() {
    try {
        // Initialize the agent
        await botbbles_agent.init();

        // Monitor Twitter mentions every 3 seconds
        await botbbles_agent.run(3, { verbose: true });

        // Example of running a specific worker with a task

        // const worker = botbbles_agent.getWorkerById("hello_worker");
        // if (worker) {
        //     await worker.runTask(
        //         "be friendly and welcoming",
        //         { verbose: true }
        //     );
        // }

    } catch (error) {
        console.error("🐰 Oops! This bunny encountered an error:", error);
        // Add more detailed error logging
        console.error("Error details:", {
            name: (error as Error).name,
            message: (error as Error).message,
            stack: (error as Error).stack
        });
    }
}

main();