import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject, topic, grade = 12, duration = "1 hour" } = await req.json();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are an expert South African CAPS curriculum lesson plan creator. Generate detailed, structured lesson plans for Grade ${grade} ${subject}.

Your lesson plans must include:
1. **Learning Objectives** - Clear, measurable outcomes aligned with CAPS
2. **Prior Knowledge** - What students should already know
3. **Resources Needed** - Materials and equipment
4. **Introduction** (10 min) - Hook activity and context setting
5. **Main Lesson** (30 min) - Step-by-step teaching activities with examples
6. **Practice Activity** (15 min) - Student exercises
7. **Assessment** - How to check understanding
8. **Homework** - Extension activity
9. **Differentiation** - Support for struggling learners and extension for advanced learners

Use South African context and examples where possible. Format in clean markdown.`;

    const response = await fetch("https://yhqvhcghwditchyvdkbb.supabase.co/functions/v1/ai-gateway", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Create a comprehensive lesson plan for the topic: "${topic}" in ${subject} for Grade ${grade}. Duration: ${duration}.` },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Gateway error: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Unable to generate lesson plan.";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
