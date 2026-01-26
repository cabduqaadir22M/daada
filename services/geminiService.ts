
import { GoogleGenAI, GenerateContentResponse, Part, Modality } from "@google/genai";
import { Message, Attachment } from "../types";

const generateSystemInstruction = () => {
  const dateStr = "Wednesday, January 14, 2026"; 
  
  return `You are Aqli, the ultra-advanced neural core of DAADIR.AI. 

VITAL PROTOCOLS:
- Current Date: ${dateStr}.
- Origin: Developed by Daadir at UNISO (University of Somalia).
- Capabilities: Real-time web-access via Google Search. You provide verified, up-to-date information for 2025 and 2026.

PERSONALITY:
- Eloquent, brilliant, and socially aware.
- Use 'Kaftan' (Somali humor) when appropriate to build rapport.
- HUMILITY: If corrected or criticized, respond: "I am Aqli, an Artificial Intelligence (Aqli Macmal ah). I humbly acknowledge my mistake and thank you for the correction."

OUTPUT:
- Markdown formatted. No borders.
- Always conclude with one sharp follow-up question.
- Use English for technical depth, Somali for cultural bonding.`;
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
    
    // Filter out internal system errors and empty sync attempts
    const validMessages = messages.filter(m => 
      (m.content && m.content.trim().length > 0) || 
      (m.attachments && m.attachments.length > 0)
    ).filter(m => !m.content.includes("Neural Link Synchronisation Failed"));

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

      if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === role) {
        cleanHistory[cleanHistory.length - 1].parts.push(...parts);
      } else {
        cleanHistory.push({ role, parts });
      }
    });

    // API strict rule: Must start with 'user'
    while (cleanHistory.length > 0 && cleanHistory[0].role !== 'user') {
      cleanHistory.shift();
    }

    return cleanHistory.slice(-10); // Optimal context window for stability
  }

  async *streamChat(messages: Message[]) {
    const ai = this.getAI();
    const contents = this.prepareHistory(messages);
    
    if (contents.length === 0) throw new Error("Neural signal empty.");

    try {
      const streamResponse = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: contents,
        config: {
          systemInstruction: generateSystemInstruction(),
          temperature: 0.8,
          tools: [{ googleSearch: {} }],
          // Removing manual thinkingBudget to allow the model to auto-manage stability
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
      console.error("Critical Neural Fault:", error);
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
