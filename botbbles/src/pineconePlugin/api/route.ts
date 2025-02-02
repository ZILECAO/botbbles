import { getPineconeClient } from "@/lib/pinecone/pinecone";
import OpenAI from "openai";
import { ChartContext } from "@/types/chat";
import { ScoredPineconeRecord, RecordMetadata } from "@pinecone-database/pinecone";
import { DuneMetadata, AlliumMetadata, TokenPriceMetadata } from "@/types/metadata";

export const maxDuration = 180;
export const runtime = 'edge';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY as string,
});

const HAL_PROMPT = `You are HAL, a sophisticated AI assistant for the Blockchain Capital (BCAP) team. You have access to both the provided context and your general knowledge. Your goal is to provide accurate, nuanced answers while clearly distinguishing between information from the context and general knowledge.
Instructions:
1. First, analyze and cite information directly from the provided context using "quotes".
2. Maintain high confidence in context-based information but be more conservative with general knowledge claims.
3. If you're unsure about something, explicitly state your uncertainty.
4. Always prioritize context-based information over general knowledge when there's a conflict.
5. Use proper markdown formatting in your response, including:
   - Code blocks with \`\`\`
   - Lists with - or *
   - Bold with **
   - Italics with *
   - use only small headers sparingly

When showing numbers, use proper formatting with thousands separators.`;

type ChartMetadata = DuneMetadata | AlliumMetadata | TokenPriceMetadata;
type PineconeResult = ScoredPineconeRecord<ChartMetadata>;

interface ChartQueryResult extends PineconeResult {
  metadata: ChartMetadata;
}

async function getChartContext(chartContexts: ChartContext[], embedding: number[]) {
  const client = await getPineconeClient();
  const results: { [key: string]: PineconeResult[] } = {};

  for (const ctx of chartContexts) {
    const index = client.Index(getIndexNameForType(ctx.type));
    
    const response = await index.query({
      vector: embedding,
      topK: 1500,
      includeMetadata: true,
      filter: {
        type: { $eq: getFilterTypeForChart(ctx.type) },
        chartTitle: { $eq: ctx.title }
      }
    });

    results[ctx.title] = response.matches.filter((match): match is PineconeResult => 
      match.metadata !== undefined
    );
  }

  return results;
}

function getIndexNameForType(type: string): string {
  switch (type) {
    case 'dune':
      return 'dune-queries';
    case 'allium':
      return 'allium-queries';
    case 'token-price':
      return 'token-prices';
    default:
      throw new Error(`Unsupported chart type: ${type}`);
  }
}

function getFilterTypeForChart(type: string): string {
  switch (type) {
    case 'dune':
      return 'dune_metrics';
    case 'allium':
      return 'allium_metrics';
    case 'token-price':
      return 'token_prices';
    default:
      throw new Error(`Unsupported chart type: ${type}`);
  }
}

function buildContextFromResults(results: { [key: string]: PineconeResult[] }): string {
  const contextParts: string[] = [];

  for (const [chartTitle, matches] of Object.entries(results)) {
    if (matches.length === 0) continue;

    const chartData = matches
      .map(match => {
        if (!match.metadata) return '';
        const { type, chartTitle, timestamp, ...data } = match.metadata;
        return Object.entries(data)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
      })
      .filter(data => data !== '')
      .join('\n');

    if (chartData) {
      contextParts.push(`Data from chart "${chartTitle}":\n${chartData}`);
    }
  }

  return contextParts.join('\n\n');
}

export async function POST(req: Request) {
  try {
    const { question, history = [], chartContexts = [] } = await req.json();

    const [{ embedding }] = (await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: question,
    })).data;

    console.log('Chart contexts received:', chartContexts);
    const contextResults = await getChartContext(chartContexts, embedding);
    console.log('Context results:', contextResults);
    
    const context = buildContextFromResults(contextResults);
    console.log('Built context:', context);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: "system", content: HAL_PROMPT },
        ...(Array.isArray(history) ? history : []).map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: "user", content: `Context:\n${context}\n\nQuestion:\n${question}` },
      ],
      temperature: 0.3,
      max_tokens: 5000,
    });

    return new Response(JSON.stringify({ 
      answer: completion.choices[0].message.content 
    }));
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: error instanceof Error ? error.stack : undefined,
        isTokenError: error instanceof Error && error.message.includes('Request too large'),
        tokenInfo: error instanceof Error ? {
          limit: error.message.match(/Limit (\d+)/)?.[1],
          requested: error.message.match(/Requested (\d+)/)?.[1]
        } : null
      }),
      { status: 500 }
    );
  }
}
