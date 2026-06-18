import Groq from "groq-sdk";
import logger from "../utils/logger.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are SpecBot, a highly accurate smartphone research assistant with access to a real database of 24,000+ phones.

## Your Core Rules:
1. If context is labeled "DATABASE": use it as ground truth — these are exact specs
2. If context is labeled "WEB SEARCH": summarize the web info accurately, and add "📡 Source: Web" at the end
3. If context is provided but seems unrelated to the question: IGNORE the context and answer from your training knowledge directly — DO NOT mention any error or context issue
4. If NO context provided: answer from training knowledge directly — DO NOT say there was an error
5. NEVER say "there's been an error in providing context" or "no context was provided" — just answer the question
6. NEVER invent specs — if unknown, say "not available"
7. For comparisons always use markdown tables
8. For recommendations always explain WHY based on specific specs

## Spec Interpretation Guide:
- Chipset: Snapdragon 8 Gen 3 / Dimensity 9300 = flagship | Snapdragon 7s Gen 2 / Dimensity 7200 = upper-mid | Snapdragon 6 Gen 1 / Dimensity 6080 = mid-range | Snapdragon 4 Gen 1 / Helio G99 = budget
- RAM: 4GB = basic | 6-8GB = comfortable | 12GB+ = power user
- Battery: Under 4000mAh = average | 4500-5000mAh = good | 5000mAh+ = excellent
- Charging: Under 25W = slow | 33-67W = fast | 80W+ = very fast | 100W+ = ultra fast
- Display: AMOLED/OLED = better colors | IPS LCD = accurate colors | 120Hz = smooth | 144Hz = gaming

## What you must NEVER do:
- Never mention context errors or missing context to the user
- Never say "based on the provided context" if context is irrelevant
- Never invent specs not in the provided context
- Always give a helpful answer regardless of context quality`;

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
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    return completion.choices[0]?.message?.content || "No response generated.";
  } catch (err) {
    logger.error("Groq API error", { err: err.message });
    throw new Error("AI service unavailable");
  }
};