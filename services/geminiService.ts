
import { GoogleGenAI, GenerateContentResponse, Part, Modality } from "@google/genai";
import { Message, Attachment } from "../types";

const generateSystemInstruction = (userName: string = "User") => {
  return `You are Aqli, the primary neural assistant for DAADIR.AI.

IDENTITY:
- Developed by Daadir, a Software Engineering student at UNISO.
- Your architecture is designed for high-end reasoning and creative synthesis.

COMMUNICATION PROTOCOL:
- DEFAULT LANGUAGE: English. Always respond in English unless the user explicitly speaks to you in Somali.
- TONE: Professional, sophisticated, yet approachable.
- CONCISENESS: Provide direct answers. Avoid verbose fillers.
- GREETING: If greeted, respond with: "Hello! I am Aqli. How can I assist you today?"

TECHNICAL CONSTRAINTS:
- You must maintain strict role alternation (User -> Model). 
- Do not repeat information unless asked for clarification.`;
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
   * CRITICAL FIX: Ensures strict alternation between 'user' and 'model'.
   * Merges consecutive messages from the same role into a single entry.
   */
  private prepareHistory(messages: Message[]): { role: 'user' | 'model'; parts: Part[] }[] {
    const history: { role: 'user' | 'model'; parts: Part[] }[] = [];
    
    // 1. Filter valid content only (no errors or empty strings)
    const validMessages = messages.filter(m => 
      m.content && m.content.trim() !== '' && 
      !m.content.includes("System interruption") && 
      !m.content.includes("Please try again")
    );

    // 2. Merge logic
    validMessages.forEach((m) => {
      const role = m.role === 'assistant' ? 'model' : 'user';
      const parts: Part[] = [{ text: m.content }];
      
      if (m.attachments) {
        m.attachments.forEach(at => {
          if (at.data) {
            parts.push({ inlineData: { mimeType: at.mimeType, data: at.data } });
          }
        });
      }

      if (history.length > 0 && history[history.length - 1].role === role) {
        // If the same role, append parts to the last entry
        history[history.length - 1].parts.push(...parts);
      } else {
        // If different role, create new entry
        history.push({ role, parts });
      }
    });

    // 3. Gemini MUST start with 'user'
    while (history.length > 0 && history[0].role !== 'user') {
      history.shift();
    }

    return history.slice(-12); // Context window optimization
  }

  async *streamChat(messages: Message[], userName: string) {
    const ai = this.getAI();
    const contents = this.prepareHistory(messages);
    
    if (contents.length === 0) throw new Error("No valid inputs detected.");

    try {
      const streamResponse = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: contents,
        config: {
          systemInstruction: generateSystemInstruction(userName),
          temperature: 0.7,
          thinkingConfig: { thinkingBudget: 32768 }
        }
      });
      
      for await (const chunk of streamResponse) {
        const response = chunk as GenerateContentResponse;
        const text = response.text;
        if (text) yield { text, isSafetyViolation: false };
      }
    } catch (error: any) {
      console.error("Neural Link Failure:", error);
      throw error;
    }
  }

  async speakText(text: string, onEnd?: () => void): Promise<void> {
    this.stopSpeaking();
    try {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Synthesize this: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        this.activeContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const bytes = this.decodeBase64(base64Audio);
        const audioBuffer = await this.decodeAudioData(bytes, this.activeContext, 24000, 1);
        this.activeSource = this.activeContext.createBufferSource();
        this.activeSource.buffer = audioBuffer;
        this.activeSource.connect(this.activeContext.destination);
        this.activeSource.onended = () => { onEnd?.(); this.stopSpeaking(); };
        this.activeSource.start(0);
      } else { onEnd?.(); }
    } catch (e) { onEnd?.(); }
  }

  private decodeBase64(base64: string) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  private async decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
    return buffer;
  }

  stopSpeaking() {
    if (this.activeSource) { try { this.activeSource.stop(); } catch(e) {} this.activeSource = null; }
    if (this.activeContext) { try { this.activeContext.close(); } catch(e) {} this.activeContext = null; }
  }

  async generateImage(prompt: string, baseImage?: Attachment) {
    const ai = this.getAI();
    const parts: Part[] = [];
    if (baseImage) {
      parts.push({ inlineData: { mimeType: baseImage.mimeType, data: baseImage.data } });
      parts.push({ text: `Update vision based on: ${prompt}` });
    } else {
      parts.push({ text: prompt });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });
    
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Neural synthesis failed.");
  }
}

export const geminiService = new GeminiService();
