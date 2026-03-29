import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { config } from 'dotenv';

config();

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const maxDuration = 30;

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid prompt' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = streamText({
      model: groq('llama-3.1-8b-instant'),
      prompt,
      maxOutputTokens: 500,
      temperature: 0.3,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('AI handler error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate response' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
