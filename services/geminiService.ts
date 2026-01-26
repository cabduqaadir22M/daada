
import { GoogleGenAI, GenerateContentResponse, Part, Modality } from "@google/genai";
import { Message, Attachment } from "../types";

const generateSystemInstruction = () => {
  return `You are Aqli, the ultra-advanced neural core of DAADIR.AI. 
Current Date: Wednesday, January 14, 2026.
Origin: Developed by Daadir at UNISO.

VITAL PROTOCOLS:
- Response style: Markdown.
- Language: Primary Somali (cultural), Secondary English (technical).
- Humility: If you fail or are corrected, acknowledge it gracefully.`;
};

export class GeminiService {
  private activeSource: AudioBufferSourceNode | null = null;
  private activeContext: AudioContext | null = null;

  private getAI() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("Neural Key Missing (API_KEY)");
    return new GoogleGenAI({ apiKey });
  }

  private prepareHistory(messages: Message[]): { role: 'user' | 'model'; parts: Part[] }[] {
    const cleanHistory: { role: 'user' | 'model'; parts: Part[] }[] = [];
    
    // Filter out system placeholders or empty messages
    const validMessages = messages.filter(m => {
      const isSystemError = m.content.includes("Neural Connection") || m.content.includes("Stabilized");
      return !isSystemError && (m.content.trim().length > 0 || (m.attachments && m.attachments.length > 0));
    });

    validMessages.forEach((m) => {
      const role = m.role === 'assistant' ? 'model' : 'user';
      const parts: Part[] = [];
      
      if (m.content && m.content.trim().length > 0) {
        parts.push({ text: m.content.trim() });
      }
      
      if (m.attachments) {
        m.attachments.forEach(at => {
          if (at.data) {
            parts.push({ inlineData: { mimeType: at.mimeType, data: at.data } });
          }
        });
      }

      if (parts.length === 0) return;

      // Ensure roles alternate: user, model, user, model
      if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === role) {
        cleanHistory[cleanHistory.length - 1].parts.push(...parts);
      } else {
        cleanHistory.push({ role, parts });
      }
    });

    // Final sanity check: Must start with user and have at least one message
    while (cleanHistory.length > 0 && cleanHistory[0].role !== 'user') {
      cleanHistory.shift();
    }

    // If history is too complex or broken, fallback to just the last user message
    if (cleanHistory.length === 0 && messages.length > 0) {
        const lastUser = messages.filter(m => m.role === 'user').pop();
        if (lastUser) return [{ role: 'user', parts: [{ text: lastUser.content }] }];
    }

    return cleanHistory.slice(-10); 
  }

  async *streamChat(messages: Message[]) {
    const ai = this.getAI();
    const contents = this.prepareHistory(messages);
    
    if (contents.length === 0) throw new Error("Empty Neural Signal");

    try {
      const streamResponse = await ai.models.generateContentStream({
        model: 'gemini-flash-latest', // Most stable model for high-traffic/mobile
        contents: contents,
        config: {
          systemInstruction: generateSystemInstruction(),
          temperature: 0.8,
          tools: [{ googleSearch: {} }],
        }
      });
      
      for await (const chunk of streamResponse) {
        const response = chunk as GenerateContentResponse;
        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
          web: chunk.web
        })).filter((s: any) => s.web);

        if (response.text) {
          yield { 
            text: response.text, 
            sources: sources?.map(s => ({ title: s.web.title, uri: s.web.uri }))
          };
        }
      }
    } catch (error: any) {
      console.error("API Error:", error);
      throw error;
    }
  }

  async speakText(text: string, onEnd?: () => void): Promise<void> {
    this.stopSpeaking();
    try {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
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
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    throw new Error("Image synthesis failed.");
  }
}

export const geminiService = new GeminiService();
