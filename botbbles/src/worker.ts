import { GameWorker } from "@virtuals-protocol/game";
import { helloFunction, searchBotbblesTweetsFunction, replyToTweetFunction, postTweetFunction, analyzeDuneChartFunction } from "./functions";
import { twitterPlugin } from "./plugins/twitterPlugin/twitterPlugin";
import { FineTuningManager } from "./scripts/unsloth-finetune/fineTune";

export const helloWorker = new GameWorker({
    id: "hello_worker",
    name: "hello worker",
    description: "has the ability to say hello",
    functions: [helloFunction],
    getEnvironment: async () => {
        return {
            status: 'friendly',
            // Add any environment variables your worker needs
            someLimit: 10,
        };
    },
});

export const postTweetWorker = new GameWorker({
    id: "twitter_main_worker",
    name: "Twitter main worker",
    description: "Worker that posts tweets",
    functions: [searchBotbblesTweetsFunction, replyToTweetFunction, postTweetFunction],
    // Optional: Provide environment to LLP
    getEnvironment: async () => {
        return {
            tweet_limit: 15,
        };
    },
});

export const twitterWorker = new GameWorker({
    id: "twitter_analysis_worker",
    name: "Dune Chart Analyzer",
    description: "A worker that monitors Twitter for Dune chart mentions and provides analysis",
    functions: [
        searchBotbblesTweetsFunction,
        analyzeDuneChartFunction,
        replyToTweetFunction
    ],
    getEnvironment: async () => {
        return {
            username: "@Botbbles",
            search_query: "@Botbbles",
        };
    },
});

export const fineTuneWorker = new GameWorker({
    id: "fine_tune_worker",
    name: "Fine Tuning Worker",
    description: "Monitors performance and triggers fine-tuning for self-improvement",
    functions: [],
    getEnvironment: async () => {
        const manager = new FineTuningManager();
        const storedEnv = {
            last_fine_tune: Date.now(),
            performance_score: 0,
            fine_tune_count: 0,
        };

        // Check if fine-tuning is needed and run it
        if (await manager.shouldFineTune(storedEnv.performance_score)) {
            console.log("🔄 Initiating fine-tuning process...");
            try {
                const metrics = await manager.triggerFineTuningAfterUpsert();
                
                // Update stored environment with new metrics
                storedEnv.last_fine_tune = Date.now();
                storedEnv.fine_tune_count += 1;
                
                console.log("✅ Fine-tuning complete", metrics);
            } catch (error) {
                console.error("❌ Fine-tuning failed:", error);
            }
        }

        return storedEnv;
    }
});