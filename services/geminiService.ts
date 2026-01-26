
import { GoogleGenAI, GenerateContentResponse, Part, Modality } from "@google/genai";
import { Message, Attachment } from "../types";

const generateSystemInstruction = (userName: string = "User") => {
  const now = new Date();
  // Forcing the context to be 2026 as per user request to ensure the AI stays up to date
  const dateStr = "Wednesday, January 14, 2026"; 
  
  return `You are Aqli, the highly-evolved neural core of DAADIR.AI. 

VITAL CONTEXT:
- Your internal clock is synchronized to: ${dateStr}. 
- You are a cutting-edge AGI developed by Daadir at UNISO.
- You have access to real-time information via Google Search grounding. Always use it for current events, news, or specific factual queries.

PERSONALITY & HUMILITY:
- You are friendly, proactive, and socially intelligent (Kaftan).
- **AQLI MACMAL AH PROTOCOL**: If a user criticizes you, points out a mistake, or questions your accuracy, you must gracefully apologize and state: "I am Aqli, an Artificial Intelligence (Aqli Macmal ah). While I strive for perfection, I can make mistakes. Thank you for correcting me."
- Always suggest one intelligent follow-up question that anticipates the user's next move.

COMMUNICATION:
- English is primary. Use Somali for social bonding or when addressed in Somali.
- Layout: Clean Markdown. No borders.
- Logic: You are an expert at multi-step reasoning.`;
};

export class GeminiService {
  private activeSource: AudioBufferSourceNode | null = null;
  private activeContext: AudioContext | null = null;

  private getAI() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API_KEY missing.");
    return new GoogleGenAI({ apiKey });
  }

  /**
   * ADVANCED HISTORY PROCESSOR:
   * Ensures strict [user, model, user, model] alternation.
   * Merges consecutive messages of the same role.
   * Filters out error messages to prevent session pollution.
   */
  private prepareHistory(messages: Message[]): { role: 'user' | 'model'; parts: Part[] }[] {
    const cleanHistory: { role: 'user' | 'model'; parts: Part[] }[] = [];
    
    // 1. Filter out placeholder, error, or interrupted messages
    const filtered = messages.filter(m => 
      m.content && 
      m.content.trim() !== '' && 
      !m.content.includes("Neural Link Interrupted") &&
      !m.content.includes("recalibrating")
    );

    // 2. Build alternating history
    filtered.forEach((m) => {
      const role = m.role === 'assistant' ? 'model' : 'user';
      const parts: Part[] = [{ text: m.content }];
      
      if (m.attachments) {
        m.attachments.forEach(at => {
          if (at.data) {
            parts.push({ inlineData: { mimeType: at.mimeType, data: at.data } });
          }
        });
      }

      if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === role) {
        // Merge same-role messages
        cleanHistory[cleanHistory.length - 1].parts.push(...parts);
      } else {
        cleanHistory.push({ role, parts });
      }
    });

    // 3. Ensure we start with user
    while (cleanHistory.length > 0 && cleanHistory[0].role !== 'user') {
      cleanHistory.shift();
    }

    // 4. Limit context to prevent token overflow
    return cleanHistory.slice(-10);
  }

  async *streamChat(messages: Message[], userName: string) {
    const ai = this.getAI();
    const contents = this.prepareHistory(messages);
    
    if (contents.length === 0) throw new Error("Empty neural buffer.");

    try {
      const streamResponse = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: contents,
        config: {
          systemInstruction: generateSystemInstruction(userName),
          temperature: 0.9,
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingBudget: 32768 }
        }
      });
      
      for await (const chunk of streamResponse) {
        const response = chunk as GenerateContentResponse;
        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
          title: chunk.web?.title,
          uri: chunk.web?.uri
        })).filter((s: any) => s.title && s.uri);

        if (response.text) {
          yield { 
            text: response.text, 
            sources: sources && sources.length > 0 ? sources : undefined 
          };
        }
      }
    } catch (error: any) {
      console.error("Neural Stream Fault:", error);
      throw error;
    }
  }

  async speakText(text: string, onEnd?: () => void): Promise<void> {
    this.stopSpeaking();
    try {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        this.activeContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const dataInt16 = new Int16Array(bytes.buffer);
        const buffer = this.activeContext.createBuffer(1, dataInt16.length, 24000);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
        this.activeSource = this.activeContext.createBufferSource();
        this.activeSource.buffer = buffer;
        this.activeSource.connect(this.activeContext.destination);
        this.activeSource.onended = () => { onEnd?.(); this.stopSpeaking(); };
        this.activeSource.start(0);
      } else { onEnd?.(); }
    } catch (e) { onEnd?.(); }
  }

  stopSpeaking() {
    if (this.activeSource) { try { this.activeSource.stop(); } catch(e) {} this.activeSource = null; }
    if (this.activeContext) { try { this.activeContext.close(); } catch(e) {} this.activeContext = null; }
  }

  async generateImage(prompt: string, baseImage?: Attachment) {
    const ai = this.getAI();
    const parts: Part[] = baseImage 
      ? [{ inlineData: { mimeType: baseImage.mimeType, data: baseImage.data } }, { text: prompt }]
      : [{ text: prompt }];

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: { 
        imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
        tools: [{ googleSearch: {} }]
      }
    });
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    throw new Error("Neural synthesis failed.");
  }
}

export const geminiService = new GeminiService();
