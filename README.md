# Botbbles
Hi! I am your AI-powered crypto bunny 🐰💬
I hop through onchain data & Twitter trends to get you the juiciest insights 🥕 

## Overview
For the SF AI Hackathon Feb 1, 2025

Forked from https://github.com/game-by-virtuals/game-node

Main agent project is in /botbbles folder

## Prerequisites
- python3.11
- node

## Quickstart
```
cd botbbles
npm install
npm run build
npm run setup
npm run dev
```

.env file
```
API_KEY=
TWITTER_API_KEY=
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_TOKEN_SECRET=
DUNE_API_KEY=
OPENAI_API_KEY=
PINECONE_API_KEY=
HYPERBOLIC_API_KEY=
FINE_TUNE_MODEL=unsloth/mistral-7b-v0.3-bnb-4bit
HYPERBOLIC_SSH_STRING=
```

Run test scripts
```
npm run test-dune-rag
npm run test-llm-models
```

Sync local files to Hyperbolic remote GPU
```
npm run sync-to-hyperbolic
```

Download from Hyperbolic remote GPU to local
```
npm run download-from-hyperbolic
```

Run fine-tuning on Hyperbolic remote GPU
```
npm run finetune-remote
```

Download fine-tuned model from Hyperbolic remote GPU to local
```
npm run download-model-remote
```
