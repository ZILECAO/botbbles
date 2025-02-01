import {
    GameFunction,
    ExecutableGameFunctionResponse,
    ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";

export const helloFunction = new GameFunction({
    name: "hello",
    description: "A verbose and creative greeting",
    args: [
        { name: "greeting", type: "string", description: "A verbose and creative greeting" },
    ] as const,
    executable: async (args, logger) => {
        try {
            logger?.(`Said Hello: ${args.greeting}`);
            return new ExecutableGameFunctionResponse(
                ExecutableGameFunctionStatus.Done,
                "Action completed successfully"
            );
        } catch (e) {
            return new ExecutableGameFunctionResponse(
                ExecutableGameFunctionStatus.Failed,
                "Action failed"
            );
        }
    },
});

export const postTweetFunction = new GameFunction({
    name: "post_tweet",
    description: "Post a tweet",
    args: [
        { name: "tweet", description: "The tweet content" },
        {
            name: "tweet_reasoning",
            description: "The reasoning behind the tweet",
        },
    ] as const,
    executable: async (args, logger) => {
        try {
            // TODO: Implement posting tweet or use the twitter plugin!

            // // For now just simulate posting
            console.log("Would post tweet:", args.tweet);

            logger(`Posting tweet: ${args.tweet}`);
            logger(`Reasoning: ${args.tweet_reasoning}`);

            return new ExecutableGameFunctionResponse(
                ExecutableGameFunctionStatus.Done,
                "Tweet posted"
            );
        } catch (e) {
            return new ExecutableGameFunctionResponse(
                ExecutableGameFunctionStatus.Failed,
                "Failed to post tweet"
            );
        }
    },
});


export const searchBotbblesTweetsFunction = new GameFunction({
    name: "search_tweets",
    description: "Search tweets mentioning Botbbles",
    args: [
        { name: "query", description: "The query to search for" },
    ] as const,
    executable: async (args, logger) => {
        try {
            // Only proceed if the query contains @Botbbles
            if (!args.query?.includes("@Botbbles")) {
                return new ExecutableGameFunctionResponse(
                    ExecutableGameFunctionStatus.Failed,
                    "Query must include @Botbbles mention"
                );
            }

            logger(`🐰 Found mention: ${args.query}`);
            
            return new ExecutableGameFunctionResponse(
                ExecutableGameFunctionStatus.Done,
                `Found mention: ${args.query}`
            );
        } catch (e) {
            return new ExecutableGameFunctionResponse(
                ExecutableGameFunctionStatus.Failed,
                "Failed to log mention"
            );
        }
    },
});

export const replyToTweetFunction = new GameFunction({
    name: "reply_to_tweet",
    description: "Reply to a tweet",
    args: [
        { name: "tweet_id", description: "The tweet id to reply to" },
        { name: "reply", description: "The reply content" },
    ] as const,
    executable: async (args, logger) => {
        try {
            const tweetId = args.tweet_id;
            const reply = args.reply;

            // TODO: Implement reply tweet
            logger(`Replying to tweet ${tweetId}`);
            logger(`Replying with ${reply}`);

            return new ExecutableGameFunctionResponse(
                ExecutableGameFunctionStatus.Done,
                `Replied to tweet ${tweetId} with ${reply}`
            );
        } catch (e) {
            return new ExecutableGameFunctionResponse(
                ExecutableGameFunctionStatus.Failed,
                "Failed to reply to tweet"
            );
        }
    },
});