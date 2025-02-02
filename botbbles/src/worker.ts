import { GameWorker } from "@virtuals-protocol/game";
import { helloFunction, searchBotbblesTweetsFunction, replyToTweetFunction, postTweetFunction } from "./functions";
import { twitterPlugin } from "./twitterPlugin/twitterPlugin";

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
        // twitterPlugin.searchTweetsFunction,
        // twitterPlugin.replyTweetFunction,
        searchBotbblesTweetsFunction, // Only using search for now
    ],
    getEnvironment: async () => {
        return {
            username: "@Botbbles",
            // charts_analyzed_today: 0,
            // max_daily_analyses: 50,
            search_query: "@Botbbles", // Just looking for mentions
        };
    },
});

