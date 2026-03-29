# Matric Mind AI

An AI-powered study assistant built with React, Express, and Groq.

## Tech Stack

- **Frontend:** Vite, React, TypeScript, shadcn/ui, Tailwind CSS
- **Backend:** Express (Node.js)
- **AI:** Groq API via Vercel AI SDK
- **Database:** Supabase

## Local Development

```sh
# Install dependencies
bun install

# Run frontend + backend together
bun run dev:all

# Or run them separately
bun run dev        # Frontend only
bun run dev:api    # Backend only
```

## Environment Variables

Create a `.env` file:

```
GROQ_API_KEY=your_groq_api_key
```

## Build & Deploy

```sh
bun run build
bun run start
```

Deployed on [Railway](https://railway.app).
