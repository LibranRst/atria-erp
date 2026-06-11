import { GoogleGenAI } from "@google/genai";

// Menggunakan API Key dari environment variable GEMINI_API_KEY
// Fallback ke string kosong untuk menghindari throw error saat build time jika API key belum diset
export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});
