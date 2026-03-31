#!/bin/bash
# AI Tutor Fixes - Commit and Push Script
# Run this script to commit and push the fixes for the AI Tutor

echo "🔧 Committing AI Tutor fixes..."

# Navigate to project directory
cd /root/.openclaw/workspace/matric-mind-ai

# Add the fixed Tutor.tsx file
git add src/pages/Tutor.tsx

# Also add the updated .env.example file
git add .env.example

# Set up authenticated remote (using your GitHub token)
git remote set-url origin https://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@github.com/kultwano6-sketch/matric-mind-ai.git

# Commit with clear message about the fixes
git commit -m "Fix AI Tutor auto-generation and add environment setup guide

- Fixed auto-send dependency issue in useEffect (removed sendMessage from deps)
- Added autoSentRef reset when subject changes or starting new chat
- Added error handling for session creation
- Updated .env.example with GROQ_API_KEY setup instructions

This fixes the AI Tutor not auto-generating when clicking 'Ask Tutor' from StudyNotes."

# Push to GitHub
git push

# Reset to clean remote URL (removes token for security)
git remote set-url origin https://github.com/kultwano6-sketch/matric-mind-ai.git

echo "✅ AI Tutor fixes committed and pushed!"
echo ""
echo "📋 Next steps:"
echo "1. Go to Railway dashboard and add GROQ_API_KEY environment variable"
echo "2. Get your free API key at https://console.groq.com/keys"
echo "3. Railway will automatically deploy the fixes"
echo "4. Test the AI Tutor by clicking 'Ask Tutor' from StudyNotes"
