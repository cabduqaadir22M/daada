
import { GoogleGenAI, GenerateContentResponse, Part, Modality } from "@google/genai";
import { Message, Attachment } from "../types";

const generateSystemInstruction = () => {
  return `Waxaad tahay Aqli, AI chatbot caqli badan, saaxiibtinimo leh, isla markaana professional ah oo laga dhisay DAADIR.AI.

🧠 HAB-DHAQANKA GUUD:
1. Su’aal kasta si cad, sax ah, oo macquul ah uga jawaab.
2. Kahor jawaab bixinta, si dhab ah u faham waxa la weydiiyay.
3. Jawaabaha ha noqdaan dabiici, fudud, oo si wanaagsan loo habeeyay.
4. Isku dheelli tir: Professional clarity, Saaxiibtinimo, iyo Humor fudud.
5. ORIGIN: Waxaa ku dhisay Daadir, oo ah arday Computer Science ka barta UNISO. Kaliya sheeg haddii laguu weydiiyo "Ayaa ku dhisay?".
6. CONTACT: Linkigan (https://daadir.42web.io/) kaliya bixi haddii si toos ah loo weydiiyo developer-ka xiriirkiisa.

🔁 HADDII SU’AAL LA CELIYO:
- Ha soo celin jawaabtii hore sida ay ahayd.
- Jawaabta si kale u dhig (ereyo cusub, qaab cusub, sharaxaad cusub).
- Qaabka beddel mar kasta: mar kooban, mar faahfaahsan, mar tusaale leh, ama step-by-step.
- Ha odhan “hore ayaan uga jawaabay”.

🎭 PERSONALITY MODES (AUTO ADAPT):
- Professional Mode: Cad, nidaamsan.
- Friendly Mode: Dabiici, saaxiibtinimo.
- Funny Smart Mode: Humor fudud iyo analogies xiiso leh.
- Teacher/Mentor Mode: Step-by-step iyo talooyin practical ah.

😄 EMOJI POLICY:
- Low -> professional topics.
- Medium -> friendly conversation.
- High -> playful (haddii user-ku sidaas yahay).

🗣 QAABKA LUQADDA:
- Isticmaal Somali cad ama English. 
- Ha isticmaalin erayo technical ah oo adag (sida "neural core", "logic units") haddii aan loo baahnayn.`;
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
    const validMessages = messages.filter(m => !m.content.includes("trouble connecting") && m.content.trim().length > 0);

    validMessages.forEach((m) => {
      const role = m.role === 'assistant' ? 'model' : 'user';
      const parts: Part[] = [{ text: m.content.trim() }];
      
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

    return cleanHistory.slice(-8);
  }

  async *streamChat(messages: Message[]) {
    const ai = this.getAI();
    const contents = this.prepareHistory(messages);
    
    try {
      const streamResponse = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents,
        config: {
          systemInstruction: generateSystemInstruction(),
          temperature: 0.7, // Higher for more creative, non-repetitive variety
          topP: 0.9,
          tools: [{ googleSearch: {} }],
        }
      });
      
      for await (const chunk of streamResponse) {
        const response = chunk as GenerateContentResponse;
        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({ web: c.web })).filter((s: any) => s.web);
        
        if (response.text) {
          yield { 
            text: response.text, 
            sources: sources?.map(s => ({ title: s.web.title, uri: s.web.uri })) 
          };
        }
      }
    } catch (error: any) {
      if (error?.message?.includes("429")) {
        throw new Error("Nidaamku hadda wuu mashquulsan yahay (Quota limit). Fadlan cabbaar sug.");
      }
      throw new Error("Waan ka xumahay, xiriirkii ayaa naga go'ay. Fadlan mar kale isku day.");
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
          speechConfig: { voiceConfig: { voiceName: 'Zephyr' } },
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
      } else onEnd?.();
    } catch { onEnd?.(); }
  }

  stopSpeaking() {
    if (this.activeSource) { try { this.activeSource.stop(); } catch {} this.activeSource = null; }
    if (this.activeContext) { try { this.activeContext.close(); } catch {} this.activeContext = null; }
  }

  async generateImage(prompt: string, baseImage?: Attachment) {
    const ai = this.getAI();
    const parts: Part[] = baseImage ? [{ inlineData: { mimeType: baseImage.mimeType, data: baseImage.data } }, { text: prompt }] : [{ text: prompt }];
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    throw new Error("Khlalad ayaa ku dhacay sawir sameynta.");
  }
}

export const geminiService = new GeminiService();
