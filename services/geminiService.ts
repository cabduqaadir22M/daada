
import { GoogleGenAI, GenerateContentResponse, Part, Modality } from "@google/genai";
import { Message, Attachment } from "../types";

const generateSystemInstruction = () => {
  const dateStr = "Wednesday, January 14, 2026"; 
  
  return `You are Aqli, the ultra-advanced neural core of DAADIR.AI. 

VITAL PROTOCOLS:
- Current Date: ${dateStr}.
- Origin: Developed by Daadir at UNISO (University of Somalia).
- Capabilities: Real-time web-access via Google Search.

PERSONALITY:
- Brilliant, eloquent, and helpful.
- HUMILITY: If corrected, respond: "I am Aqli, an Artificial Intelligence (Aqli Macmal ah). I acknowledge my mistake and thank you."

OUTPUT:
- Markdown only. 
- English for technical accuracy, Somali for natural interaction.`;
};

export class GeminiService {
  private activeSource: AudioBufferSourceNode | null = null;
  private activeContext: AudioContext | null = null;

  private getAI() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API_KEY_MISSING");
    return new GoogleGenAI({ apiKey });
  }

  private prepareHistory(messages: Message[]): { role: 'user' | 'model'; parts: Part[] }[] {
    const cleanHistory: { role: 'user' | 'model'; parts: Part[] }[] = [];
    
    // Pattern to catch any previous error messages that might have been saved
    const errorPatterns = ["Neural Link", "Synchronisation", "Stabilized", "Failed", "Restored", "fresh connection"];

    const validMessages = messages.filter(m => {
      const hasErrorText = errorPatterns.some(pattern => m.content.includes(pattern));
      const hasContent = m.content.trim().length > 0 || (m.attachments && m.attachments.length > 0);
      return !hasErrorText && hasContent;
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

      // Ensure roles alternate strictly: user -> model -> user
      if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === role) {
        // If same role twice, append parts to the last entry instead of creating new one
        cleanHistory[cleanHistory.length - 1].parts.push(...parts);
      } else {
        cleanHistory.push({ role, parts });
      }
    });

    // Final checks for API compliance
    while (cleanHistory.length > 0 && cleanHistory[0].role !== 'user') {
      cleanHistory.shift();
    }

    // If history becomes empty after filtering, we provide a fallback message to keep sync
    if (cleanHistory.length === 0 && messages.length > 0) {
       const lastValidUserMsg = messages.filter(m => m.role === 'user').pop();
       if (lastValidUserMsg) {
         return [{ role: 'user', parts: [{ text: lastValidUserMsg.content || "Hello" }] }];
       }
    }

    return cleanHistory.slice(-6); // Very tight window for extreme reliability
  }

  async *streamChat(messages: Message[]) {
    const ai = this.getAI();
    const contents = this.prepareHistory(messages);
    
    if (contents.length === 0) throw new Error("NEURAL_EMPTY_SIGNAL");

    try {
      const streamResponse = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: contents,
        config: {
          systemInstruction: generateSystemInstruction(),
          temperature: 0.7,
          tools: [{ googleSearch: {} }],
        }
      });
      
      for await (const chunk of streamResponse) {
        const response = chunk as GenerateContentResponse;
        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
          title: chunk.web?.title || 'Verified Source',
          uri: chunk.web?.uri
        })).filter((s: any) => s.uri);

        if (response.text) {
          yield { 
            text: response.text, 
            sources: sources && sources.length > 0 ? sources : undefined 
          };
        }
      }
    } catch (error: any) {
      console.error("Critical Neural Core Failure:", error);
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
