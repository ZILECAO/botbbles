import { GameWorker } from "@virtuals-protocol/game";
import { searchBotbblesTweetsAndExtractDuneQueryIdFunction, replyToTweetFunction, postTweetFunction, upsertDuneToPineconeFunction } from "./functions";
import { twitterPlugin } from "./plugins/twitterPlugin/twitterPlugin";
import { FineTuningManager } from "./scripts/unsloth-finetune/fineTune";

// TODO: Implement post tweet worker
export const postTweetWorker = new GameWorker({
    id: "post_tweet_worker",
    name: "Twitter worker that has write permissions",
    description: "Worker that can write new tweets and replies to tweets",
    functions: [replyToTweetFunction, postTweetFunction],
    // Optional: Provide environment to LLP
    getEnvironment: async () => {
        return {
            tweet_limit: 15,
        };
    },
});

// TODO: Implement read tweet worker
export const readTweetWorker = new GameWorker({
    id: "read_tweet_worker",
    name: "Read Tweet worker",
    description: "A worker that reads tweets and looks for mentions of @Botbbles with a Dune Analytics chart URL. Returns the Query ID of the Dune Analytics chart.",
    functions: [
        searchBotbblesTweetsAndExtractDuneQueryIdFunction
    ],
    getEnvironment: async () => {
        return {
            dune_query_id: 0, //TODO
        };
    },
});

// TODO: Implement Dune RAG worker
export const duneRAGWorker = new GameWorker({
    id: "dune_rag_worker",
    name: "Dune RAG worker",
    description: "A worker that first pulls Dune data given a Query ID, then upserts all the data in text-embedded chunks to Pinecone, then uses RAG to generate an analysis of the newly upserted data.",
    functions: [upsertDuneToPineconeFunction],
    getEnvironment: async () => {
        return {
            successful_pinecone_upserts: 0, // TODO
            rag_response: "", // TODO
        };
    },
});

// TODO: Implement fine-tuning worker
export const fineTuneWorker = new GameWorker({
    id: "fine_tune_worker",
    name: "Fine Tuning Worker",
    description: "Monitors performance and triggers fine-tuning for self-improvement. The fine-tuning flow goes as follows: 1) worker runs the function to convert pinecone data to training examples 2) worker runs the function to remote fine-tune the model 3) worker returns status success or failure",
    functions: [], // TODO: Implement fine-tuning function
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