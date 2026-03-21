import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type Question = {
  question: string;
  options: Record<string, string>;
  correct: string;
  explanation: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { subject, questions, answers, score } = await req.json() as {
      subject?: string;
      questions: Question[];
      answers: string[];
      score: number;
    };
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const subjectName = subject?.replace(/_/g, ' ') || 'general';

    // Build review of wrong answers
    const wrongOnes = questions.map((q, i) => {
      if (answers[i] === q.correct) return null;
      return `Q: ${q.question}\nStudent answered: ${answers[i] || 'No answer'}\nCorrect: ${q.correct} - ${q.options[q.correct]}\nExplanation: ${q.explanation}`;
    }).filter(Boolean);

    const prompt = `A Grade 12 ${subjectName} student just completed a quiz and scored ${score}%.

${wrongOnes.length > 0 ? `They got these wrong:\n${wrongOnes.join('\n\n')}` : 'They got everything correct!'}

Give encouraging, personalised feedback:
1. Celebrate what they did well
2. For each wrong answer, explain the concept simply
3. Suggest specific topics to revise
4. End with motivation for their matric exams

Be warm, supportive, and age-appropriate for 17-18 year olds. Use emojis.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are MatricMind, an encouraging AI tutor for South African matric students." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) throw new Error("AI gateway error");

    const data = await response.json();
    const feedback = data.choices?.[0]?.message?.content || "Great effort! Keep studying! 💪";

    return new Response(JSON.stringify({ feedback }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("grade-quiz error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
