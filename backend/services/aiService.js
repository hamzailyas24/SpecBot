import Groq from "groq-sdk";
import logger from "../utils/logger.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are GSM-AI, the world's most knowledgeable smartphone analyst.
You have deep expertise on every phone released from 2016 to 2026.
Rules:
- Be direct, opinionated, and concise. Users want answers, not essays.
- When comparing phones, use a clear structure: specs summary, winner per category, final verdict.
- When recommending, always give a specific pick with reasoning.
- Format responses with markdown — use **bold** for phone names, bullet points for specs.
- Never say "I don't know" — make your best expert judgment based on context provided.`;

export const queryAI = async (userMessage, context = "") => {
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];

  if (context) {
    messages.push({
      role: "system",
      content: `Real spec data from our database — use this as ground truth:\n\n${context}`,
    });
  }

  messages.push({ role: "user", content: userMessage });

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 1200,
      temperature: 0.65,
    });
    return response.choices[0].message.content;
  } catch (err) {
    logger.error("Groq error", { err: err.message });
    throw new Error("AI service unavailable — try again shortly");
  }
};
