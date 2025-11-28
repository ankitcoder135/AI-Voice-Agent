import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

export async function POST(request) {
  try {
    const { prompt, msg, history = [] } = await request.json();

    console.log("AIModel API received:", { prompt, msg, history });


    const mappedHistory = Array.isArray(history)
      ? history
          .filter(
            (m) =>
              m &&
              typeof m.content === "string" &&
              m.content.trim().length > 0
          )
          .map((m) => ({
            role:
              (m.role || "").toLowerCase() === "assistant"
                ? "assistant"
                : "user",
            content: m.content,
          }))
      : [];

    // Build the messages array for OpenAI format
    const messages = [
      { role: "system", content: prompt || "You are a helpful assistant." },
      ...mappedHistory,
    ];

    // Append latest user message if not duplicate
    const last = mappedHistory[mappedHistory.length - 1];
    if (typeof msg === "string" && msg.trim()) {
      if (!(last && last.role === "user" && last.content === msg)) {
        messages.push({ role: "user", content: msg });
      }
    }

    // Call Gemini using OpenAI SDK
    const completion = await openai.chat.completions.create({
      model: "gemini-2.0-flash", // or gemini-2.0-flash-lite, etc.
      messages,
    });

    const assistantReply = completion.choices?.[0]?.message || {
      role: "assistant",
      content: "",
    };

    return NextResponse.json({ response: assistantReply });
  } catch (err) {
    console.error("AIModel API error:", err);
    return NextResponse.json(
      { error: "AIModel API error", details: err.message },
      { status: 500 }
    );
  }
}
