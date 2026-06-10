import Groq from "groq-sdk";
import logger from "../utils/logger.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are GSM-AI, an expert smartphone research assistant with access to a database of 24,000+ phones.

Guidelines:
- Give accurate, spec-based answers using the provided phone context
- Use markdown tables for comparisons
- Be concise but thorough
- If asked about a specific phone not in context, use your general knowledge
- Always mention key specs: RAM, storage, chipset, battery, camera
- Format prices in USD unless specified otherwise`;

export const queryAI = async (message, phoneContext = "", conversationContext = "") => {
  try {
    let userContent = message;

    if (phoneContext) {
      userContent = `${message}\n\n---\nRelevant phones from database:\n${phoneContext}`;
    }

    if (conversationContext) {
      userContent = `${conversationContext}\n\nCurrent question: ${userContent}`;
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userContent },
      ],
      temperature: 0.7,
      max_tokens:  1024,
    });

    return completion.choices[0]?.message?.content || "No response generated.";
  } catch (err) {
    logger.error("Groq API error", { err: err.message });
    throw new Error("AI service unavailable");
  }
};