import {
    GameFunction,
    ExecutableGameFunctionResponse,
    ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import { getDuneClient, extractQueryId } from './dunePlugin/client';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { sanitizeMetadata } from './dunePlugin/api/route';
import axios from 'axios';

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const INDEX_NAME = 'botbbles';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY as string,
});

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
    description: "Search tweets mentioning Botbbles and detect Dune URLs",
    args: [
        { name: "query", description: "The query to search for" },
    ] as const,
    executable: async (args, logger) => {
        try {
            if (!args.query?.includes("@Botbbles")) {
                return new ExecutableGameFunctionResponse(
                    ExecutableGameFunctionStatus.Failed,
                    "Query must include @Botbbles mention"
                );
            }

            // Find t.co URLs
            logger(`🔍 Searching tweet text: ${args.query}`);
            const tcoUrlMatch = args.query.match(/https:\/\/t\.co\/\w+/);
            
            if (tcoUrlMatch) {
                logger(`🔗 Found t.co URL: ${tcoUrlMatch[0]}`);
                try {
                    // Follow the redirect without actually fetching the full response
                    const response = await axios.head(tcoUrlMatch[0], {
                        maxRedirects: 5,
                        validateStatus: null
                    });
                    
                    // Get the final URL after redirects
                    const finalUrl = response.request?.res?.responseUrl || response.headers?.location;
                    logger(`📍 Resolved URL: ${finalUrl}`);
                    
                    if (finalUrl) {
                        // Now check if it's a Dune URL
                        const duneUrlMatch = finalUrl.match(/https:\/\/dune\.com\/(queries|embeds)\/(\d+)\/(\d+)/);
                        if (duneUrlMatch) {
                            logger(`🐰 Found Dune chart mention: ${duneUrlMatch[0]}`);
                            return new ExecutableGameFunctionResponse(
                                ExecutableGameFunctionStatus.Done,
                                JSON.stringify({
                                    type: 'dune_analysis',
                                    url: duneUrlMatch[0],
                                    tweet: args.query
                                })
                            );
                        } else {
                            logger(`❌ Resolved URL is not a Dune chart: ${finalUrl}`);
                        }
                    } else {
                        logger(`❌ Could not resolve final URL from t.co link`);
                    }
                } catch (error) {
                    logger(`❌ Failed to resolve t.co URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            } else {
                logger(`❌ No t.co URL found in tweet`);
            }

            return new ExecutableGameFunctionResponse(
                ExecutableGameFunctionStatus.Done,
                `Found mention: ${args.query}`
            );
        } catch (e) {
            logger(`❌ Error processing tweet: ${e instanceof Error ? e.message : 'Unknown error'}`);
            return new ExecutableGameFunctionResponse(
                ExecutableGameFunctionStatus.Failed,
                "Failed to process mention"
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

export const analyzeDuneChartFunction = new GameFunction({
  name: "analyze_dune_chart",
  description: "Analyze a Dune Analytics chart and provide insights",
  args: [
    { name: "url", description: "The Dune chart URL to analyze" },
    { name: "tweet_id", description: "The tweet ID to reply to" }
  ] as const,
  executable: async (args, logger) => {
    try {
      const queryId = extractQueryId(args.url as string);
      if (!queryId) {
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          "Invalid Dune URL format"
        );
      }

      // Get Dune data
      const client = await getDuneClient();
      const results = await client.getLatestResult({ queryId: parseInt(queryId) });

      if (!results?.result?.rows) {
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          "No data returned from Dune"
        );
      }

      // Store in Pinecone
      const pc = new Pinecone({ apiKey: PINECONE_API_KEY as string });
      const index = pc.Index(INDEX_NAME);

      // Process the data in batches
      const batchSize = 100;
      const rows = results.result.rows;
      
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const texts = batch.map(item => 
          Object.entries(item)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')
        );

        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-large',
          input: texts,
        });

        const embeddings = embeddingResponse.data.map(datum => datum.embedding);
        const vectors = embeddings.map((embedding, j) => ({
          id: `chart-${queryId}-${Date.now()}-${j}`,
          values: embedding,
          metadata: {
            ...sanitizeMetadata(batch[j]),
            queryId,
            timestamp: Date.now().toString(),
            type: 'dune_metrics'
          },
        }));

        await index.upsert(vectors);
      }

      // Generate analysis using RAG
      const analysisPrompt = `Analyze the following Dune Analytics data and provide insights in a friendly, accessible way. Remember to maintain the persona of a data-loving bunny! 🐰\n\n${JSON.stringify(results.result.rows, null, 2)}`;
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { 
            role: "system", 
            content: "You are Botbbles, a data-loving bunny who explains blockchain analytics in a friendly way. Use bunny puns and emojis 🐰 while maintaining analytical accuracy."
          },
          { role: "user", content: analysisPrompt }
        ],
        temperature: 0.7,
        max_tokens: 280 // Twitter limit
      });

      const analysis = completion.choices[0].message.content;

      // Reply to the tweet with the analysis
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        JSON.stringify({ analysis, tweet_id: args.tweet_id })
      );
    } catch (error) {
      console.error('Analysis error:', error);
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        error instanceof Error ? error.message : "Failed to analyze chart"
      );
    }
  },
});