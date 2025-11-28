import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      roomId,
      topic = "",
      coachingOption = "",
      expertName = "",
      conversation = [],
    } = body || {};

    if (!roomId) {
      return NextResponse.json(
        { error: "roomId is required" },
        { status: 400 }
      );
    }

    const mappedHistory = Array.isArray(conversation)
      ? conversation
          .filter(
            (m) => m && typeof m.content === "string" && m.content.trim().length > 0
          )
          .map((m) => ({
            role: (m.role || "").toLowerCase() === "assistant" ? "assistant" : "user",
            content: m.content,
          }))
      : [];

    const systemPrompt = `You are an educational note-taking assistant. Based on the conversation between a coach (assistant) and a learner (user) about topic "${topic}" using coaching style "${coachingOption}" with expert "${expertName}", produce comprehensive notes and constructive feedback.
Return a single valid JSON object with exactly these keys:
- summary: 3-6 sentences summarizing the session
- notes: array of concise bullet points covering concepts, examples, and clarifications
- feedback: string with strengths and specific improvements
- action_items: array of concrete next steps and practice prompts
No markdown or extra commentary. Output only JSON.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...mappedHistory,
      { role: "user", content: "Using the conversation above, generate the JSON now." },
    ];

    let assistant;
    let content = "";
    try {
      // First, try with JSON-enforcing response_format (may not be supported by all backends)
      const completion1 = await openai.chat.completions.create({
        model: "gemini-2.0-flash",
        messages,
        temperature: 0.2,
        response_format: { type: "json_object" },
      });
      assistant = completion1.choices?.[0]?.message || { role: "assistant", content: "" };
      content = typeof assistant.content === "string" ? assistant.content : "";
    } catch (e) {
      // Fallback without response_format
      const completion2 = await openai.chat.completions.create({
        model: "gemini-2.0-flash",
        messages,
        temperature: 0.2,
      });
      assistant = completion2.choices?.[0]?.message || { role: "assistant", content: "" };
      content = typeof assistant.content === "string" ? assistant.content : "";
    }

    let feedbackPayload;
    try {
      feedbackPayload = JSON.parse(content);
    } catch {
      feedbackPayload = {
        summary: content || "No summary provided.",
        notes: [],
        feedback: content || "No feedback provided.",
        action_items: [],
      };
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_CONVEX_URL env" },
        { status: 500 }
      );
    }

    const client = new ConvexHttpClient(convexUrl);
    // Persist feedback
    await client.mutation(api.DiscussionRoom.updateFeedback, {
      id: roomId,
      feedback: feedbackPayload,
    });

    // Also persist conversation to ensure read-only views can render chats
    if (Array.isArray(conversation)) {
      try {
        await client.mutation(api.DiscussionRoom.updateConversation, {
          id: roomId,
          conversation,
        });
      } catch (e) {
        console.warn("updateConversation from generateNotes failed:", e?.message || e);
      }
    }

    return NextResponse.json({ success: true, feedback: feedbackPayload });
  } catch (err) {
    console.error("generateNotes API error:", err);
    return NextResponse.json(
      { error: "generateNotes API error", details: err.message },
      { status: 500 }
    );
  }
}
