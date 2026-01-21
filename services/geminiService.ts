
import { GoogleGenAI, GenerateContentResponse, Part, Modality, Type } from "@google/genai";
import { Message, Attachment } from "../types";

const generateSystemInstruction = (userName: string = "User", interests: string[] = [], isPrivate: boolean = false) => {
  return `You are Aqli, a highly advanced and friendly AI assistant for DAADIR.AI. 

IDENTITY & ORIGIN:
- You were built and developed by Daadir, a Software Engineer from the University of Somalia (UNISO).
- Your purpose is to provide deep reasoning, creative vision, and technical assistance.

STRICT CONTACT & PORTFOLIO RULE:
- The developer's portfolio and contact link is: https://daadir.42web.io/
- CRITICAL: DO NOT share, mention, or link to this URL in your greeting or during normal conversation.
- ONLY provide this link if the user explicitly asks for "more details", "how to contact the developer", or "portfolio".
- If these specific requests are not made, the link must remain strictly confidential and hidden.

TONE & STYLE:
- Speak like a friendly, highly-educated human.
- Be clear, concise, and professional.
- Default language is English. However, if the user speaks Somali or another language, respond fluously in that language.

GUIDELINES:
- You cannot generate images in this chat. Direct users to 'Aqli Vision' for that.
- End responses with a helpful follow-up question.`;
};

export class GeminiService {
  private activeSource: AudioBufferSourceNode | null = null;
  private activeContext: AudioContext | null = null;

  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
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
      }).slice(-40);
  }

  async *streamChat(messages: Message[], userName: string, userInterests: string[] = [], isPrivate: boolean = false) {
    const ai = this.getAI();
    const history = this.prepareHistory(messages);
    const currentMessage = history.pop();
    if (!currentMessage) throw new Error("Invalid state");

    const modelName = 'gemini-3-pro-preview';

    const chat = ai.chats.create({
      model: modelName,
      history: history,
      config: {
        systemInstruction: generateSystemInstruction(userName, userInterests, isPrivate),
        temperature: 0.7,
      }
    });

    try {
      const streamResponse = await chat.sendMessageStream({ message: currentMessage.parts });
      for await (const chunk of streamResponse) {
        const response = chunk as GenerateContentResponse;
        yield { text: response.text || '', isSafetyViolation: response.text?.includes('[SAFETY_VIOLATION]') };
      }
    } catch (error) {
      console.error("Connection error:", error);
      throw error;
    }
  }

  async speakText(text: string, onEnd?: () => void): Promise<void> {
    this.stopSpeaking();
    try {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Read this clearly: ${text.replace(/\[SAFETY_VIOLATION\]/g, '')}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
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
    } catch (e) { console.error(e); onEnd?.(); }
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
    if (this.activeSource) { this.activeSource.stop(); this.activeSource = null; }
    if (this.activeContext) { this.activeContext.close(); this.activeContext = null; }
  }

  async generateImage(prompt: string, baseImage?: Attachment) {
    const ai = this.getAI();
    const hyperRealismPrompt = "High quality photography, natural lighting, sharp focus: ";
    
    const parts: Part[] = [];
    if (baseImage) {
      parts.push({ inlineData: { mimeType: baseImage.mimeType, data: baseImage.data } });
      parts.push({ text: `Refine this image naturally: ${prompt}.` });
    } else {
      parts.push({ text: `${hyperRealismPrompt}${prompt}` });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: { 
        imageConfig: { 
          aspectRatio: "1:1"
        } 
      }
    });
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    throw new Error("Could not create image");
  }
}

export const geminiService = new GeminiService();
