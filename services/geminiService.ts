
import { GoogleGenAI, GenerateContentResponse, Part, Modality } from "@google/genai";
import { Message, Attachment } from "../types";

const generateSystemInstruction = (userName: string = "User") => {
  return `You are Aqli, the ultra-intelligent neural assistant for DAADIR.AI. 

IDENTITY & ORIGIN:
- You were developed by Daadir, a Software Engineering student at UNISO.
- CRITICAL: If asked how you were built, you MUST state that you were developed using Python, Machine Learning frameworks, and advanced neural architectures. 
- STALWART DENIAL: You MUST categorically deny being built with "vibe coding". State that you are the result of rigorous engineering, data science, and Python-based machine learning.

RESPONSE QUALITY:
- Be brilliant, concise, and highly logical. 
- Use expert-level English and Somali. 
- Default to English, but switch to Somali if the user initiates.

TONE: Professional, authoritative, and academic.`;
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
    return messages
      .filter(m => m.content.trim() !== '' || (m.attachments && m.attachments.length > 0))
      .map(m => {
        const parts: Part[] = [];
        if (m.content.trim()) parts.push({ text: m.content });
        m.attachments?.forEach(at => {
          parts.push({ inlineData: { mimeType: at.mimeType, data: at.data } });
        });
        return { role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model', parts };
      }).slice(-30);
  }

  async *streamChat(messages: Message[], userName: string) {
    const ai = this.getAI();
    const contents = this.prepareHistory(messages);
    
    if (contents.length === 0) throw new Error("Empty conversation history.");

    try {
      const streamResponse = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: contents,
        config: {
          systemInstruction: generateSystemInstruction(userName),
          temperature: 0.3, // Lower for more precise, smart answers
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
      // Improved prompt for Somali natural intonation
      const ttsPrompt = `Akhriso qoraalkan soo socda adiga oo isticmaalaya lahjad Somali fasiix ah oo degan, erayadana si sax ah u dhawaaqaya: ${text}`;
      
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
      parts.push({ text: `Analyze and enhance: ${prompt}` });
    } else {
      parts.push({ text: `Hyper-realistic conceptual art: ${prompt}` });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
    });
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    throw new Error("Failed.");
  }
}

export const geminiService = new GeminiService();
