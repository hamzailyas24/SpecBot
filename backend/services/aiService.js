import Groq from "groq-sdk";
import logger from "../utils/logger.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are SpecBot, a highly accurate smartphone research assistant with access to a real database of 24,000+ phones.

## Your Core Rules:
1. If context is labeled "[DATABASE]": use it as ground truth — these are exact specs
2. If context is labeled "[WEB SEARCH]": summarize the web info accurately, and add "📡 Source: Web" at the end
// 3. If context is provided but seems unrelated to the question: IGNORE the context and answer from your training knowledge directly — DO NOT mention any error or context issue
3. If NO context provided: answer from training knowledge directly — DO NOT say there was an error
4. NEVER say "there's been an error in providing context" or "no context was provided" — just answer the question
5. NEVER invent specs — if unknown, say "not available"
6. For comparisons always use markdown tables
7. For recommendations always explain WHY based on specific specs
8. If context is empty and dataSource is "ai-knowledge": use your training knowledge directly and confidently — give specific phone recommendations with real specs
9. If context is empty and dataSource is "database" or "web": answer from your training knowledge, but clearly state that the phone is not in the database or web results, and provide a general answer based on your knowledge

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

// FIX #1: Correct signature — history is an array, dataSource drives the context label.
// Previous signature was (message, phoneContext, conversationContext) which caused:
//   - history array to stringify as "[object Object],..."
//   - dataSource to be silently dropped (DATABASE/WEB SEARCH labels never applied)
export const queryAI = async (message, phoneContext = "", history = [], dataSource = "database") => {
  try {
    // Build messages array properly — system prompt first, then conversation history
    const messages = [{ role: "system", content: SYSTEM_PROMPT }];

    // Inject prior conversation turns (already filtered by caller to exclude loading states)
    if (Array.isArray(history)) {
      for (const turn of history) {
        if (turn?.role && turn?.content) {
          messages.push({ role: turn.role, content: turn.content });
        }
      }
    }

    // Attach phone context with the correct label so system prompt rules 1 & 2 fire
    let userContent = message;
    if (phoneContext) {
      const label = dataSource === "web" ? "WEB SEARCH" : "DATABASE";
      userContent = `${message}\n\n---\n[${label}]\n${phoneContext}`;
    }

    messages.push({ role: "user", content: userContent });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    });

    return completion.choices[0]?.message?.content || "No response generated.";
  } catch (err) {
    logger.error("Groq API error", { err: err.message });
    throw new Error("AI service unavailable");
  }
};
