import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Question {
  number: number;
  marks: number;
  type: string;
  question: string;
}

interface MemoItem {
  number: number;
  marks: number;
  answers: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { paperId, answers, questions, memo, subject } = await req.json();

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    
    if (!openaiKey) {
      // Fallback grading without AI
      const feedback = questions.map((q: Question) => {
        const studentAnswer = answers[q.number] || "";
        const memoItem = memo?.find((m: MemoItem) => m.number === q.number);
        
        let marksAwarded = 0;
        let feedbackText = "";
        
        if (!studentAnswer.trim()) {
          feedbackText = "No answer provided. Review this topic in your study materials.";
        } else if (memoItem) {
          // Simple keyword matching for basic grading
          const memoWords = memoItem.answers.toLowerCase().split(/\s+/);
          const answerWords = studentAnswer.toLowerCase().split(/\s+/);
          const matches = memoWords.filter(word => answerWords.includes(word) && word.length > 3);
          const matchRatio = matches.length / Math.max(memoWords.length, 1);
          
          marksAwarded = Math.round(q.marks * Math.min(matchRatio * 1.5, 1));
          
          if (matchRatio > 0.5) {
            feedbackText = "Good attempt! Your answer covers key concepts.";
          } else if (matchRatio > 0.2) {
            feedbackText = "Partial answer. Review the model answer for complete understanding.";
          } else {
            feedbackText = "Your answer needs improvement. Study this topic more thoroughly.";
          }
        } else {
          marksAwarded = Math.round(q.marks * 0.5);
          feedbackText = "Answer submitted. Review expected for detailed feedback.";
        }
        
        return {
          question: q.number,
          marks_awarded: marksAwarded,
          feedback: feedbackText,
        };
      });
      
      const totalScore = feedback.reduce((acc: number, f: any) => acc + f.marks_awarded, 0);
      const totalMarks = questions.reduce((acc: number, q: Question) => acc + q.marks, 0);
      
      return new Response(
        JSON.stringify({ score: totalScore, totalMarks, feedback }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // AI-powered grading
    const gradingPrompts = questions.map((q: Question) => {
      const studentAnswer = answers[q.number] || "No answer provided";
      const memoItem = memo?.find((m: MemoItem) => m.number === q.number);
      const memoAnswer = memoItem?.answers || "No memo available";
      
      return {
        questionNumber: q.number,
        maxMarks: q.marks,
        question: q.question,
        studentAnswer,
        memoAnswer,
      };
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert South African NSC examiner for ${subject.replace(/_/g, ' ')}. 
            Grade the following student answers against the memo. Be fair but strict.
            For each question, provide:
            1. marks_awarded (out of the maximum marks)
            2. constructive feedback explaining what was good/missing and how to improve
            
            Respond in JSON format:
            {
              "grades": [
                { "question": 1, "marks_awarded": X, "feedback": "..." },
                ...
              ]
            }`,
          },
          {
            role: "user",
            content: JSON.stringify(gradingPrompts),
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error("OpenAI API error");
    }

    const aiResult = await response.json();
    const parsedResult = JSON.parse(aiResult.choices[0].message.content);
    
    const feedback = parsedResult.grades;
    const totalScore = feedback.reduce((acc: number, f: any) => acc + f.marks_awarded, 0);
    const totalMarks = questions.reduce((acc: number, q: Question) => acc + q.marks, 0);

    return new Response(
      JSON.stringify({ score: totalScore, totalMarks, feedback }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Grading error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
