
import { GoogleGenAI } from "@google/genai";
import { AppNode, AppEdge } from "../types";

/**
 * Audits the gas system using Gemini AI to identify safety or efficiency concerns.
 * Uses gemini-3-flash-preview for general text-based reasoning tasks.
 */
export async function auditSystem(nodes: AppNode[], edges: AppEdge[]) {
  // Initialize the AI client inside the function to ensure the latest API key from process.env is used.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Analyze this gas piping system layout.
    Nodes: ${JSON.stringify(nodes)}
    Edges: ${JSON.stringify(edges)}
    
    Provide a professional engineering audit. Identify any safety concerns, potential optimizations for pipe sizing, or common mistakes in residential gas plumbing based on this topology. Keep it concise.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    // Accessing the generated text via the .text property
    return response.text;
  } catch (error) {
    console.error("Gemini Audit Error:", error);
    return "Failed to perform AI audit. Please check your connections and try again.";
  }
}
