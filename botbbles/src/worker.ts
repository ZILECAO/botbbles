import { GameWorker } from "@virtuals-protocol/game";
import { helloFunction, searchBotbblesTweetsFunction, replyToTweetFunction, postTweetFunction, analyzeDuneChartFunction } from "./functions";
import { twitterPlugin } from "./plugins/twitterPlugin/twitterPlugin";

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

