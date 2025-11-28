import { AssemblyAI } from "assemblyai";
import { NextResponse } from "next/server";

export async function GET(request) {
    try {
        const apiKey = process.env.ASSEMBLYAI_API_KEY;
        
        if (!apiKey) {
            console.error("Missing ASSEMBLYAI_API_KEY in environment variables");
            return NextResponse.json({ error: "Missing AssemblyAI API key" }, { status: 500 });
        }

        const client = new AssemblyAI({ apiKey });
        
        // Use streaming.createTemporaryToken (not realtime)
        const token = await client.streaming.createTemporaryToken({
            expires_in_seconds: 600
        });
        
        return NextResponse.json({ token });
    } catch (err) {
        console.error("Error generating AssemblyAI token:", err);
        return NextResponse.json({ 
            error: "Failed to generate token",
            details: err.message 
        }, { status: 500 });
    }
}