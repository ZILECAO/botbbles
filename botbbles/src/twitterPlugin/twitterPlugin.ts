import TwitterPlugin from "@virtuals-protocol/game-twitter-plugin";
import dotenv from "dotenv";
dotenv.config();

console.log("⚠️  Twitter plugin initialized in DEBUG mode - tweets will be logged but not posted");

export const twitterPlugin = new TwitterPlugin({
    credentials: {
        apiKey: process.env.TWITTER_API_KEY || "",
        apiSecretKey: process.env.TWITTER_API_SECRET || "",
        accessToken: process.env.TWITTER_ACCESS_TOKEN || "",
        accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET || "",
    },
}); 