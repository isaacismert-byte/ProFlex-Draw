
import { GoogleGenAI } from "@google/genai";
import { AppNode, AppEdge } from "../types";

/**
 * Audits the gas system using Gemini AI to identify safety or efficiency concerns.
 * Strictly limited to 2 sections with 5 bullet points each.
 */
export async function auditSystem(nodes: AppNode[], edges: AppEdge[]) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Analyze this gas piping system layout for a professional engineering audit.
    Nodes: ${JSON.stringify(nodes)}
    Edges: ${JSON.stringify(edges)}
    
    STRUCTURE YOUR RESPONSE EXACTLY AS FOLLOWS:
    1. Provide EXACTLY TWO sections.
    2. Section 1 title: "SAFETY & COMPLIANCE"
    3. Section 2 title: "PERFORMANCE & OPTIMIZATION"
    4. Provide EXACTLY 5 concise bullet points per section.
    5. Use plain text or markdown bullets (-). No intro, no outro, no additional headers.
    
    Base your audit on NFPA 54 / IFGC standards.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.3,
      }
    });
    
    return response.text;
  } catch (error) {
    console.error("Gemini Audit Error:", error);
    return "Audit currently unavailable. Please verify your internet connection.";
  }
}
