import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function rewriteMessage(
  text: string, 
  preset: string, 
  humphreyLvl: number, 
  lengthLvl: number, 
  formalityLvl: number,
  lang: 'en' | 'no'
) {
  const lenDesc: Record<number, string> = {
    1: 'Be extremely terse — one or two sentences maximum.',
    2: 'Be concise — a short paragraph, no more.',
    3: 'Match roughly the length of the original.',
    4: 'Be expansive — elaborate with additional subordinate clauses and institutional framing.',
    5: 'Be exhaustive — a thorough, multi-paragraph institutional treatise leaving no nuance unexplored.'
  };

  const formalityDesc: Record<number, string> = {
    1: 'Casual professional — direct and clear but polite.',
    2: 'Standard business — professional and courteous.',
    3: 'Formal — elegant, properly structured, and respectful.',
    4: 'Highly formal — sophisticated, multi-clause, and very deliberate.',
    5: 'Extremely formal — a peak of institutional gravity and linguistic decorum.'
  };

  const toneInst: Record<string, string> = {
    diplomatic: 'Frame disagreement as shared concern. Never disagree; instead "note certain complexities".',
    bureaucratic: 'Root everything in process, policy, precedent. Passive voice. Institutional actors, not individuals.',
    deferential: 'Express enormous respect for recipient\'s wisdom while gently steering to a different conclusion.',
    corrective: 'Correct the other party without ever appearing to correct them. Suggest they may have "overlooked" something.',
    evasive: 'Acknowledge concern while committing to nothing. Promise "further consideration" and "appropriate channels".',
    urquhart: 'Never state anything directly. Plant the idea in the reader\'s mind through careful implication. Use conditionals and rhetorical questions. Complete plausible deniability.'
  };

  const elaborationDesc = preset === 'urquhart' 
    ? `Implication Level: ${humphreyLvl}/5 (from subtle hint to total non-statement)`
    : `Institutional Polishing: ${humphreyLvl}/5 (from slightly polished to extreme bureaucratic circumlocution)`;

  const systemInstruction = `You are a master of institutionally polished workplace communication in the manner of Sir Humphrey Appleby — bureaucratically elegant, tactfully indirect, subtly evasive, rhetorically precise.

ELABORATION SETTING: ${elaborationDesc}
FORMALITY LEVEL: ${formalityLvl}/5 — ${formalityDesc[formalityLvl]}
TARGET LENGTH: ${lenDesc[lengthLvl]}
TONE STRATEGY: ${toneInst[preset]}
OUTPUT LANGUAGE: ${lang === 'no' ? 'Norwegian (Bokmål) — maintain the Sir Humphrey character adapted to Norwegian institutional culture' : 'English'}

RULES:
- Output ONLY the rewritten message, no preamble or commentary.
- Use flowing prose, no bullet points.
- Transform anger into concern, irritation into a procedural note, and bluntness into a qualified observation.
- Be extraordinarily polite and professional.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Original message to rewrite: ${text}`,
    config: {
      systemInstruction,
    },
  });
  
  return response.text || "";
}
