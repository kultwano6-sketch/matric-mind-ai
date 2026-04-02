// api/collaboration-hub.ts — Study groups hub (Web API)

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    groups: [],
    message: 'No study groups yet. Create one to get started!'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
