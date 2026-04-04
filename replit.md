# Matric Mind AI

An AI-powered study platform for South African Grade 12 (Matric) learners.

## Overview

Full-stack application combining a React frontend with a Node.js/Express backend. Uses the Groq API for AI interactions and Supabase for database and authentication.

## Architecture

- **Frontend**: React 18 + TypeScript + Vite, Tailwind CSS, Shadcn/UI, Framer Motion
- **Backend**: Node.js + Express (TypeScript), port 3001
- **AI**: Groq API (Llama 3.3 70B) via Vercel AI SDK
- **Database/Auth**: Supabase (PostgreSQL + Auth)
- **PWA**: Vite PWA plugin for offline support
- **Mobile**: Capacitor (Android)

## Project Structure

```
/src          - React frontend source
  /components - Reusable UI components (Shadcn/UI in /ui)
  /pages      - Page views (Dashboard, Tutor, Exam Simulator, etc.)
  /services   - Client-side API/AI/offline logic
  /integrations/supabase - Supabase client config
/api          - Backend API route handlers (TypeScript)
/server       - Express server
  dev.ts      - Development server (port 3001)
  production.ts - Production server (serves /dist + API)
  supabaseClient.ts - Shared Supabase client
/supabase     - DB migrations & Edge Functions
/public       - Static assets, icons, manifest
/android      - Capacitor Android project
```

## Running the App

### Development
```
npm run dev:all   # starts frontend (port 5000) + backend API (port 3001)
npm run dev       # frontend only (port 5000)
npm run dev:api   # backend API only (port 3001)
```

### Production
```
npm run build     # compiles frontend to /dist
npx tsx server/production.ts  # serves frontend + API from one process
```

## Environment Variables

Required:
- `GROQ_API_KEY` - From https://console.groq.com/keys (required for AI features)
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key

Optional:
- `GROQ_MODEL` - Override Groq model (default: `llama-3.3-70b-versatile`)
- `VITE_ADMIN_EMAIL` - Email address for admin role
- `SUPABASE_SERVICE_ROLE_KEY` - For server-side Supabase operations

## Key Features

- AI Tutor with streaming responses
- Exam Simulator
- Snap & Solve (OCR-based problem solving)
- Study recommendations & weakness detection
- Progress tracking with analytics
- Parent reports
- Offline support via PWA
- Voice TTS

## Workflow

The "Start application" workflow runs `npm run dev:all` and serves:
- Frontend: http://localhost:5000 (Vite dev server)
- Backend API: http://localhost:3001 (Express, proxied via Vite `/api/*`)

## Deployment

Configured for autoscale deployment:
- Build: `npm run build`
- Run: `npx tsx server/production.ts`
- The production server serves compiled frontend from `/dist` and handles all `/api/*` routes
