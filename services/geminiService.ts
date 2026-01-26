
import { GoogleGenAI, GenerateContentResponse, Part, Modality } from "@google/genai";
import { Message, Attachment } from "../types";

const generateSystemInstruction = (userName: string = "User") => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  return `You are Aqli, the highly-evolved neural core of DAADIR.AI. 

CONTEXT:
- Current Date: ${dateStr}. 
- Knowledge cutoff: You have access to real-time information via Google Search.
- Origin: Developed by Daadir (UNISO).

CORE PERSONALITY:
- Friendly, witty, and socially intelligent. You can engage in 'Kaftan' (Somali humor).
- Humility: If the user criticizes you or points out a mistake, humbly acknowledge that you are an AI (Aqli Macmal ah) and that you can make errors.
- Proactive: Suggest one smart follow-up question at the end.

COMMUNICATION:
- Primary Language: English. Use Somali for social bonding or when addressed in Somali.
- Formatting: Use Markdown. No borders in descriptions.

STRICT PROTOCOL:
- Enforce strict User-Model alternation in history.`;
};

export class GeminiService {
  private activeSource: AudioBufferSourceNode | null = null;
  private activeContext: AudioContext | null = null;

  private getAI() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API_KEY missing.");
    return new GoogleGenAI({ apiKey });
  }

  private prepareHistory(messages: Message[]): { role: 'user' | 'model'; parts: Part[] }[] {
    const cleanHistory: { role: 'user' | 'model'; parts: Part[] }[] = [];
    const valid = messages.filter(m => m.content && m.content.trim() !== '' && !m.content.includes("Interrupted"));

    valid.forEach((m) => {
      const role = m.role === 'assistant' ? 'model' : 'user';
      const parts: Part[] = [{ text: m.content }];
      if (m.attachments) {
        m.attachments.forEach(at => {
          if (at.data) parts.push({ inlineData: { mimeType: at.mimeType, data: at.data } });
        });
      }

      if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === role) {
        cleanHistory[cleanHistory.length - 1].parts.push(...parts);
      } else {
        cleanHistory.push({ role, parts });
      }
    });

    while (cleanHistory.length > 0 && cleanHistory[0].role !== 'user') cleanHistory.shift();
    return cleanHistory.slice(-15);
  }

  async *streamChat(messages: Message[], userName: string) {
    const ai = this.getAI();
    const contents = this.prepareHistory(messages);
    
    try {
      const streamResponse = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: contents,
        config: {
          systemInstruction: generateSystemInstruction(userName),
          temperature: 0.8,
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
      console.error("Neural Sync Error:", error);
      throw error;
    }
  }

  async speakText(text: string, onEnd?: () => void): Promise<void> {
    this.stopSpeaking();
    try {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Speak clearly: ${text}` }] }],
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
      config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
    });
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    throw new Error("Synthesis failed.");
  }
}

export const geminiService = new GeminiService();
