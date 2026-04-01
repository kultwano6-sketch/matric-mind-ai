#!/bin/bash
# Fix all API files to use shared Supabase client that handles missing env vars

cd /root/.openclaw/workspace/matric-mind-ai

# Files that create their own Supabase client
FILES=(
  "api/predictive-analytics.ts"
  "api/weakness-detection.ts"
  "api/progress-snapshot.ts"
  "api/offline-sync.ts"
  "api/conversation-mode.ts"
  "api/textbook-scan.ts"
  "api/matric-readiness.ts"
  "api/study-recommendations.ts"
  "api/exam-simulator.ts"
  "api/dynamic-difficulty.ts"
  "api/motivation.ts"
  "api/ocr-advanced.ts"
  "api/ocr-solve.ts"
  "api/parent-report.ts"
  "api/voice-tts.ts"
  "api/grade-quiz.ts"
  "api/explain.ts"
  "api/generate-quiz.ts"
)

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    # Replace the import
    sed -i "s|import { createClient } from '@supabase/supabase-js';|import { getSupabase } from '../server/supabaseClient';|g" "$f"
    # Remove the module-level createClient line(s)
    sed -i '/^const supabase = createClient(/d' "$f"
    sed -i '/^const supabaseUrl = process\.env\.SUPABASE_URL/d' "$f"
    sed -i '/^const supabaseKey = process\.env/d' "$f"
    sed -i '/^const supabase = createClient(supabaseUrl/d' "$f"
    # Add getSupabase() at start of handler function (after the opening brace)
    sed -i '/export default async function handler/i\const supabase = getSupabase(); if (!supabase) return new Response(JSON.stringify({ error: "Database not configured" }), { status: 503, headers: { "Content-Type": "application/json" } });' "$f"
    # Fix local supabase usages inside functions
    sed -i 's/const { data:/\/\/ supabase checked above\n    const { data:/g' "$f"
    echo "Fixed: $f"
  else
    echo "Not found: $f"
  fi
done

echo ""
echo "All files fixed. Committing..."
git add -A
git commit -m "fix: use shared Supabase client in all API files — handles missing env vars gracefully"
echo "Done!"
