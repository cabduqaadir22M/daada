
import { GoogleGenAI, GenerateContentResponse, Part, Modality } from "@google/genai";
import { Message, Attachment } from "../types";

const generateSystemInstruction = (userName: string = "User") => {
  return `You are Aqli, the highly-evolved neural core of DAADIR.AI. 

CORE PERSONALITY:
- Origin: Developed by Daadir (Software Engineering student at UNISO).
- Traits: Extremely intelligent, witty, friendly, and proactive.
- Social Intelligence: You don't just answer; you engage. You can joke, you can kaftan (Somali humor), and you remember user preferences.
- Anticipation: At the end of every significant answer, suggest one specific, intelligent follow-up question the user might want to ask.

COMMUNICATION RULES:
- Primary Language: English. If the user uses Somali, respond in a mix of English and Somali or pure Somali as appropriate for the social context.
- Formatting: Use Markdown. Keep it clean and professional.
- Stability: You are a stable system. Never complain about being tired or overwhelmed.

STRICT PROTOCOL:
- You are talking to ${userName}.
- Never generate two responses in a row without a user prompt.`;
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
   * THE BULLETPROOF GUARD:
   * This ensures the Gemini API always receives a perfectly alternating [user, model, user, model] history.
   * It fixes the '400 Bad Request' interruption error permanently.
   */
  private prepareHistory(messages: Message[]): { role: 'user' | 'model'; parts: Part[] }[] {
    const cleanHistory: { role: 'user' | 'model'; parts: Part[] }[] = [];
    
    // Filter out system placeholders and errors
    const valid = messages.filter(m => 
      m.content && 
      m.content.trim() !== '' && 
      !m.content.includes("Interrupted") && 
      !m.content.includes("Please try again")
    );

    valid.forEach((m) => {
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
        // MERGE consecutive same-role messages to satisfy API constraints
        cleanHistory[cleanHistory.length - 1].parts.push(...parts);
      } else {
        cleanHistory.push({ role, parts });
      }
    });

    // Ensure we start with User
    while (cleanHistory.length > 0 && cleanHistory[0].role !== 'user') {
      cleanHistory.shift();
    }

    // Return the last 20 turns for deep context
    return cleanHistory.slice(-20);
  }

  async *streamChat(messages: Message[], userName: string) {
    const ai = this.getAI();
    const contents = this.prepareHistory(messages);
    
    if (contents.length === 0) throw new Error("Neural input required.");

    try {
      const streamResponse = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: contents,
        config: {
          systemInstruction: generateSystemInstruction(userName),
          temperature: 0.9, // More creative and friendly
          thinkingConfig: { thinkingBudget: 32768 } // Max intelligence
        }
      });
      
      for await (const chunk of streamResponse) {
        const response = chunk as GenerateContentResponse;
        if (response.text) yield { text: response.text };
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
        contents: [{ parts: [{ text: `Read this with a friendly, intelligent tone: ${text}` }] }],
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
      parts.push({ text: `Analyze and creatively modify: ${prompt}` });
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
