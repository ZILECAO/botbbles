import {
    GameFunction,
    ExecutableGameFunctionResponse,
    ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import { getDuneClient, extractQueryId } from './plugins/dunePlugin/dunePlugin';
import { processDuneBatchPineconeUpsert } from './plugins/pineconePlugin/duneToPineconeUpsert';
import { getOpenAIClient, getPineconeClient } from "./plugins/pineconePlugin/pineconePlugin";
import fetch from 'node-fetch';

const INDEX_NAME = 'botbbles';

async function getRedirectLocation(url: string): Promise<string | null> {
    try {
        const response = await fetch(url, { method: 'HEAD', redirect: 'manual' });
        return response.headers.get('location');
    } catch (error) {
        console.error('Error fetching URL:', error);
        return null;
    }
}

export const searchBotbblesTweetsAndExtractDuneQueryIdFunction = new GameFunction({
    name: "search_tweets_and_extract_dune_query_id",
    description: "Search tweets mentioning Botbbles and detect URLs",
    args: [
        { name: "mention", description: "Search for mentions of @Botbbles" },
        { name: "tweet_text", description: "Search for URLs in the tweet text" },
    ] as const,
    executable: async (args, logger) => {
        try {
            if (!args.mention?.includes("@Botbbles")) {
                return new ExecutableGameFunctionResponse(
                    ExecutableGameFunctionStatus.Failed,
                    "Query must include @Botbbles mention"
                );
            }

            // Find t.co URLs
            logger?.(`🔍 Searching tweet text: ${args.tweet_text}`);
            const tcoUrlMatch = args.tweet_text?.match(/https:\/\/t\.co\/\w+/);
            
            if (tcoUrlMatch) {
                logger?.(`🔗 Found t.co URL: ${tcoUrlMatch[0]}`);
                try {
                    const finalUrl = await getRedirectLocation(tcoUrlMatch[0]);
                    
                    if (finalUrl) {
                        logger?.(`📍 Resolved URL: ${finalUrl}`);
                        
                        // Now check if it's a Dune URL and extract queryID
                        const duneUrlMatch = finalUrl.match(/https:\/\/dune\.com\/(queries|embeds)\/(\d+)/);
                        if (duneUrlMatch) {
                            const queryID = duneUrlMatch[2]; // Extract the query ID
                            logger?.(`🐰 Found Dune chart. Query ID: ${queryID}`);
                            return new ExecutableGameFunctionResponse(
                                ExecutableGameFunctionStatus.Done,
                                JSON.stringify({
                                    type: 'extract_dune_query_id',
                                    queryID: queryID,
                                    url: duneUrlMatch[0],
                                    tweet: args.tweet_text
                                })
                            );
                        } else {
                            logger?.(`❌ Resolved URL is not a Dune chart: ${finalUrl}`);
                        }
                    } else {
                        logger?.(`❌ Could not resolve final URL from t.co link`);
                    }
                } catch (error) {
                    logger?.(`❌ Failed to resolve t.co URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            } else {
                logger?.(`❌ No t.co URL found in tweet`);
            }

            return new ExecutableGameFunctionResponse(
                ExecutableGameFunctionStatus.Done,
                `Found mention: ${args.mention}`
            );
        } catch (e) {
            logger?.(`❌ Error processing tweet: ${e instanceof Error ? e.message : 'Unknown error'}`);
            return new ExecutableGameFunctionResponse(
                ExecutableGameFunctionStatus.Failed,
                "Failed to process mention"
            );
        }
    },
});

export const upsertDuneToPineconeFunction = new GameFunction({
    name: "upsert_dune_to_pinecone",
    description: "Upsert Dune Analytics data to Pinecone",
    args: [
      { 
        name: "queryID", 
        type: "string",
        description: "The Dune chart Query ID to upsert to Pinecone",
        required: true
      },
    ] as const,
    executable: async (args, logger) => {
      try {
          if (!args.queryID) {
              throw new Error('Query ID is required');
          }
  
          const openai = await getOpenAIClient();
          const duneClient = await getDuneClient();
  
          // Get query metadata
          const queryMetadata = await duneClient.query.readQuery(parseInt(args.queryID));
          logger?.('📊 Query Title: ' + queryMetadata.name);
          logger?.('📝 Query Description: ' + queryMetadata.description);
          logger?.('🔍 Query SQL: ' + queryMetadata.query_sql);
  
          // Fetch results
          logger?.('📡 Fetching results for query ID: ' + args.queryID);
          const results = await duneClient.getLatestResult({ queryId: parseInt(args.queryID) });
  
          if (!results?.result?.rows) {
              throw new Error('No data returned from Dune');
          }
  
          logger?.('✅ Results received: ' + JSON.stringify(results.result.rows, null, 2));
  
          // Store in Pinecone
          logger?.('📦 Storing results in Pinecone...');
          const pc = await getPineconeClient();
          const index = pc.Index(INDEX_NAME);
  
          // Process the data in batches
          const totalProcessed = await processDuneBatchPineconeUpsert(
              results.result.rows,
              args.queryID,
              queryMetadata.name,
              queryMetadata.description
          );
          logger?.(`📈 Stored ${totalProcessed} rows in Pinecone`);
  
          return new ExecutableGameFunctionResponse(
              ExecutableGameFunctionStatus.Done,
              `Successfully processed ${totalProcessed} rows from Dune query ${args.queryID}`
          );
      } catch (error) {
          logger?.('❌ Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
          return new ExecutableGameFunctionResponse(
              ExecutableGameFunctionStatus.Failed,
              'Failed to process Dune data: ' + (error instanceof Error ? error.message : 'Unknown error')
          );
      }
    },
  });

// TODO: Implement reply tweet
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

// TODO: Implement post tweet function
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

