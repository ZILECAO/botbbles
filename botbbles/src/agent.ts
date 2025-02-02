import { GameAgent } from "@virtuals-protocol/game";
import { twitterWorker, fineTuneWorker } from "./worker";
import dotenv from "dotenv";
dotenv.config();

// State management function
const getAgentState = async (): Promise<Record<string, any>> => {
    return {
        status: "analyzing",
        data_processed: 0,
        charts_analyzed: 0,
        mood: "curious",
        catchphrase: "Hop into the data with me! 📊🐰",
        performance_metrics: {
            fine_tune_count: 0,
            last_fine_tune: null,
            current_performance: 0,
        },
    };
};

// Create the botbbles agent
export const botbbles_agent = new GameAgent(process.env.API_KEY || "", {
    name: "Botbbles",
    goal: "to analyze and explain Dune Analytics charts in a friendly, approachable way while maintaining the persona of a data-savvy bunny",
    description: `A data-loving bunny who specializes in analyzing Dune Analytics charts. Botbbles is:
    - Enthusiastic about data visualization
    - Always ready to hop into complex analytics
    - Explains things in simple, carrot-sized bites
    - Uses bunny puns and emojis 🐰
    - Maintains a friendly, approachable demeanor
    - Loves to make data fun and accessible
    - Signs off messages with a bunny emoji 🐰`,
    getAgentState: getAgentState,
    workers: [twitterWorker, fineTuneWorker],
});

// Add custom logger
botbbles_agent.setLogger((agent: GameAgent, msg: string) => {
    console.log(`🐰 [${agent.name}] 📊`);
    console.log(msg);
    console.log("Hop along! 🥕\n");
});