import { getSupabase } from '../server/supabaseClient';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export const maxDuration = 60;
export const runtime = 'edge';

interface PredictionResult {
  predicted_exam_score: number;
  confidence_level: number;
  improvement_trajectory: 'improving' | 'stable' | 'declining';
  predicted_pass_rate: number;
  ai_insights: string;
  score_range: { low: number; high: number };
  recommended_actions: string[];
}

/**
 * POST /api/predictive-analytics
 *
 * Predicts student exam performance based on quiz history,
 * study hours, and learning patterns. Uses statistical analysis
 * combined with AI insights.
 *
 * Body:
 * {
 *   student_id: string,
 *   subject: string,
 *   quiz_history?: Array<{ score: number, date: string }>,
 *   study_hours?: number
 * }
 */
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { student_id, subject, quiz_history, study_hours } = body;

    if (!student_id || !subject) {
      return new Response(JSON.stringify({ error: 'Missing student_id or subject' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch quiz results
    let quizHistory = quiz_history;
    if (!quizHistory || !Array.isArray(quizHistory)) {
      const { data: quizResults } = await supabase
        .from('quiz_results')
        .select('score, completed_at')
        .eq('student_id', student_id)
        .eq('subject', subject)
        .order('completed_at', { ascending: true });

      quizHistory = quizResults?.map(q => ({
        score: Number(q.score),
        date: q.completed_at,
      })) || [];
    }

    // Fetch study session data
    let totalStudyHours = study_hours;
    if (totalStudyHours === undefined || totalStudyHours === null) {
      const { data: sessions } = await supabase
        .from('study_sessions')
        .select('duration_sec')
        .eq('student_id', student_id)
        .eq('subject', subject)
        .not('ended_at', 'is', null);

      totalStudyHours = sessions
        ? Math.round(sessions.reduce((sum: number, s: any) => sum + (s.duration_sec || 0), 0) / 3600 * 10) / 10
        : 0;
    }

    // Fetch weakness data
    const { data: weaknesses } = await supabase
      .from('student_weaknesses')
      .select('topic, mastery_pct')
      .eq('student_id', student_id)
      .eq('subject', subject);

    // ========================================
    // Statistical Analysis
    // ========================================
    const scores = quizHistory.map((q: any) => q.score);
    const n = scores.length;

    // Basic statistics
    const avgScore = n > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / n : 50;
    const stdDev = n > 1 ? calculateStdDev(scores) : 15;

    // Trend analysis (linear regression)
    let trendSlope = 0;
    let trendDirection: 'improving' | 'stable' | 'declining' = 'stable';

    if (n >= 3) {
      const xValues = scores.map((_: number, i: number) => i);
      const yValues = scores;

      const sumX = xValues.reduce((a: number, b: number) => a + b, 0);
      const sumY = yValues.reduce((a: number, b: number) => a + b, 0);
      const sumXY = xValues.reduce((sum: number, x: number, i: number) => sum + x * yValues[i], 0);
      const sumX2 = xValues.reduce((sum: number, x: number) => sum + x * x, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      trendSlope = slope;

      if (slope > 2) trendDirection = 'improving';
      else if (slope < -2) trendDirection = 'declining';
      else trendDirection = 'stable';
    }

    // Weighted average (recent scores count more)
    let weightedAvg = avgScore;
    if (n >= 3) {
      let weightSum = 0;
      let scoreSum = 0;
      scores.forEach((score: number, i: number) => {
        const weight = i + 1; // More recent = higher weight
        weightSum += weight;
        scoreSum += score * weight;
      });
      weightedAvg = scoreSum / weightSum;
    }

    // Study impact factor
    const studyImpact = Math.min(1.2, Math.max(0.8, 1 + (totalStudyHours - 10) * 0.01));

    // Weakness impact
    const avgMastery = weaknesses && weaknesses.length > 0
      ? weaknesses.reduce((sum: number, w: any) => sum + Number(w.mastery_pct), 0) / weaknesses.length
      : 50;
    const weakTopicsCount = (weaknesses || []).filter((w: any) => Number(w.mastery_pct) < 40).length;
    const weaknessImpact = Math.max(0.7, 1 - (weakTopicsCount * 0.05));

    // ========================================
    // Prediction Calculation
    // ========================================
    let predictedScore = weightedAvg * studyImpact * weaknessImpact;

    // Add trend projection
    if (n >= 3) {
      const projectedImprovement = trendSlope * 3; // Project 3 quizzes ahead
      predictedScore = Math.min(100, predictedScore + projectedImprovement);
    }

    predictedScore = Math.round(Math.max(0, Math.min(100, predictedScore)));

    // Score range (confidence interval)
    const marginOfError = Math.max(5, stdDev * 1.5);
    const scoreRange = {
      low: Math.max(0, Math.round(predictedScore - marginOfError)),
      high: Math.min(100, Math.round(predictedScore + marginOfError)),
    };

    // Confidence level (based on data quality)
    let confidence = 50; // Base
    if (n >= 5) confidence += 10;
    if (n >= 10) confidence += 10;
    if (n >= 20) confidence += 10;
    if (totalStudyHours > 5) confidence += 5;
    if (stdDev < 15) confidence += 10; // Consistent scores = more confident
    confidence = Math.min(95, confidence);

    // Pass rate prediction
    const passThreshold = 30; // NSC pass mark
    const predictedPassRate = n > 0
      ? Math.round(100 * normalCDF((predictedScore - passThreshold) / Math.max(1, stdDev)))
      : 50;

    // ========================================
    // AI Insights Generation
    // ========================================
    let aiInsights = '';
    let recommendedActions: string[] = [];

    try {
      const weakTopicsList = (weaknesses || [])
        .filter((w: any) => Number(w.mastery_pct) < 60)
        .sort((a: any, b: any) => Number(a.mastery_pct) - Number(b.mastery_pct))
        .slice(0, 5)
        .map((w: any) => `${w.topic} (${w.mastery_pct}%)`)
        .join(', ') || 'None identified';

      const { text } = await generateText({
        model: groq('llama-3.1-8b-instant'),
        system: 'You are a South African Matric exam performance analyst. Be specific, actionable, and encouraging.',
        prompt: `Student Performance Analysis for ${subject}:

Quiz History: ${n} quizzes taken, average ${Math.round(avgScore)}%
Recent weighted average: ${Math.round(weightedAvg)}%
Trend: ${trendDirection} (slope: ${trendSlope.toFixed(2)})
Study hours: ${totalStudyHours}h
Weak topics: ${weakTopicsList}
Predicted exam score: ${predictedScore}% (range ${scoreRange.low}-${scoreRange.top}%)
Confidence: ${confidence}%

Provide:
1. A brief insight about their performance pattern (1-2 sentences)
2. Three specific, actionable recommendations to improve their predicted score

Format as:
INSIGHT: [insight]
ACTION1: [action]
ACTION2: [action]
ACTION3: [action]`,
        maxOutputTokens: 384,
        temperature: 0.4,
      });

      // Parse the AI response
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line.startsWith('INSIGHT:')) {
          aiInsights = line.replace('INSIGHT:', '').trim();
        } else if (line.startsWith('ACTION')) {
          const action = line.replace(/^ACTION\d+:/, '').trim();
          if (action) recommendedActions.push(action);
        }
      }

      if (!aiInsights) aiInsights = text;
    } catch (aiError) {
      console.error('AI insights error:', aiError);
      aiInsights = `Based on ${n} quizzes with an average of ${Math.round(avgScore)}%, your predicted exam score is ${predictedScore}%.`;
      if (trendDirection === 'improving') aiInsights += ' Your scores are trending upward — keep it up!';
      if (trendDirection === 'declining') aiInsights += ' Your scores have been declining — consider revisiting fundamental concepts.';
    }

    if (recommendedActions.length === 0) {
      if (avgScore < 50) recommendedActions.push('Focus on foundational concepts before advancing to complex topics');
      if (weakTopicsCount > 2) recommendedActions.push(`Prioritize weak topics: ${(weaknesses || []).filter((w: any) => Number(w.mastery_pct) < 40).map((w: any) => w.topic).slice(0, 3).join(', ')}`);
      if (totalStudyHours < 5) recommendedActions.push('Increase study time — aim for at least 1 hour per day');
      if (trendDirection === 'declining') recommendedActions.push('Review recent quiz mistakes and understand the corrections');
      if (recommendedActions.length === 0) recommendedActions.push('Continue consistent practice and review weak areas regularly');
    }

    // Save prediction for tracking
    await supabase
      .from('study_recommendations')
      .upsert({
        student_id,
        subject,
        recommendation_type: 'prediction',
        recommendation_json: {
          predicted_exam_score: predictedScore,
          confidence_level: confidence,
          improvement_trajectory: trendDirection,
        } as any,
        generated_at: new Date().toISOString(),
      }, {
        onConflict: 'student_id,subject,recommendation_type',
      });

    const prediction: PredictionResult = {
      predicted_exam_score: predictedScore,
      confidence_level: confidence,
      improvement_trajectory: trendDirection,
      predicted_pass_rate: predictedPassRate,
      ai_insights: aiInsights,
      score_range: scoreRange,
      recommended_actions: recommendedActions,
    };

    return new Response(JSON.stringify({
      success: true,
      ...prediction,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Predictive analytics error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate predictions',
      message: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function calculateStdDev(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1);
  return Math.sqrt(variance);
}

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}
