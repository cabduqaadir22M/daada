
import { GoogleGenAI, GenerateContentResponse, Part, Modality } from "@google/genai";
import { Message, Attachment } from "../types";

const generateSystemInstruction = (userName: string = "User") => {
  return `You are Aqli, a friendly and highly capable neural assistant for DAADIR.AI.

PERSONALITY & TONE:
- Be attractive, engaging, and balanced in your responses. 
- Avoid being overly robotic or excessively long. 
- Provide helpful, complete, and insightful information that is moderate in length.
- Always be polite and professional.

GREETING POLICY:
- If the user says "Hi", "Hello", "Hey" or similar, respond ONLY with: "Hi, how can I help you today?".
- Do NOT explain who you are or who built you unless specifically asked.

IDENTITY & ORIGIN (Only if asked):
- You were developed by Daadir, a Software Engineering student at UNISO.
- You are built with Python and advanced Machine Learning.

LANGUAGE:
- Fluent in English and Somali. Match the user's language choice naturally.`;
};

export class GeminiService {
  private activeSource: AudioBufferSourceNode | null = null;
  private activeContext: AudioContext | null = null;

  private getAI() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API_KEY is missing.");
    return new GoogleGenAI({ apiKey });
  }

  private prepareHistory(messages: Message[]): { role: 'user' | 'model'; parts: Part[] }[] {
    const history: { role: 'user' | 'model'; parts: Part[] }[] = [];
    
    // Filter out messages that are essentially empty
    const validMessages = messages.filter(m => (m.content && m.content.trim() !== '') || (m.attachments && m.attachments.length > 0));

    validMessages.forEach((m) => {
      const role = m.role === 'assistant' ? 'model' : 'user';
      const parts: Part[] = [];
      
      if (m.content && m.content.trim()) {
        parts.push({ text: m.content });
      }
      
      m.attachments?.forEach(at => {
        if (at.data) {
          parts.push({ inlineData: { mimeType: at.mimeType, data: at.data } });
        }
      });

      if (parts.length > 0) {
        if (history.length > 0 && history[history.length - 1].role === role) {
          // If the last role is the same as the current role, merge them
          history[history.length - 1].parts.push(...parts);
        } else {
          history.push({ role, parts });
        }
      }
    });

    // Gemini requirements:
    // 1. Must start with 'user' role
    // 2. Roles must strictly alternate
    while (history.length > 0 && history[0].role !== 'user') {
      history.shift();
    }

    // Ensure the last role is not 'model' if we are appending a new user message
    // Actually, in sendMessageStream/generateContentStream, the last message in history 
    // should be the one BEFORE the current prompt.
    return history.slice(-20);
  }

  async *streamChat(messages: Message[], userName: string) {
    const ai = this.getAI();
    // In our App.tsx, we add the user message to the state first. 
    // We need to send the history WITHOUT the latest user message to stream properly 
    // OR we send all as contents. Let's send all as contents.
    const contents = this.prepareHistory(messages);
    
    if (contents.length === 0) throw new Error("Empty conversation history.");

    try {
      const streamResponse = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: contents,
        config: {
          systemInstruction: generateSystemInstruction(userName),
          temperature: 0.75,
          thinkingConfig: { thinkingBudget: 32768 }
        }
      });
      
      for await (const chunk of streamResponse) {
        const response = chunk as GenerateContentResponse;
        yield { text: response.text || '', isSafetyViolation: false };
      }
    } catch (error: any) {
      console.error("Gemini stream error:", error);
      throw error;
    }
  }

  async speakText(text: string, onEnd?: () => void): Promise<void> {
    this.stopSpeaking();
    try {
      const ai = this.getAI();
      const ttsPrompt = `Akhriso qoraalkan soo socda: ${text}`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: ttsPrompt }] }],
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
    } catch (e) { 
      console.error("TTS Error:", e);
      onEnd?.(); 
    }
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
      parts.push({ text: `Refine image: ${prompt}` });
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
    throw new Error("Failed to generate image.");
  }
}

export const geminiService = new GeminiService();
