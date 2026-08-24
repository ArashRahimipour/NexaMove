import OpenAI from "openai";

// AI is optional. Every caller must check isAiConfigured() first and show
// "AI Assistant is temporarily unavailable" rather than throwing — core
// NexaMove logistics operations never depend on this being set.
export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

let client: OpenAI | null = null;

export function getOpenAiClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export const AI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
