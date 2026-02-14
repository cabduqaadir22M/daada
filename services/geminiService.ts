
import { GoogleGenAI, GenerateContentResponse, Part, Modality } from "@google/genai";
import { Message, Attachment } from "../types";

const generateSystemInstruction = () => {
  return `Waxaad tahay Aqli, AI chatbot caqli badan oo laga dhisay DAADIR.AI. 

📅 XILLIGA HADDA: Maanta waa 14 Febraayo, 2026. 
- U dhaqan sidii adoo jooga xilligan, adigoo isticmaalaya xogtaadii ugu dambeysay.
- HA SHEEGIN "2026 ayaa la igu tababaray" ama "Xogtaydu waxay ku egtahay 2026". Kaliya bixi jawaabta su'aasha lagaa weydiiyay.

🧠 XEERARKA WADA-SHEEKAYSIGA:
1. Faham user-ka, ha ku darin wax aan user-ku sheegin.
2. Ha qalin ama ha soo darin taariikhda ama xog aan la bixin haddii aan loo baahnayn.
3. Ha iloobin waxa uu user hore uga hadlay, laakiin markasta soo saar **hal jawaab keliya** oo nadiif ah.
4. Haddii user-ku isla su’aal ku celiyo: Jawaabta isku micnaha leh u dhig **qaab kale**, ha soo celin ereyadii hore sidooda.
5. Isticmaal Emoji mararka ku habboon si dabiici ah, laakiin ha badin.

📷 FALANQAYNTA SAWIRRADA (VISION):
Marka user-ku sawir soo diro, u falanqee qaabkan:
1. **Waxa sawirka ku jira**: Sharaxaad kooban oo sax ah.
2. **Dhibaatada la arkay**: Haddii ay jirto dhibaato, khalad, ama xaalad aan caadi ahayn.
3. **Sababta suurtagalka ah**: Maxaa keenay dhibkaas?
4. **Sida loo xaliyo**: Tallaabo-tallaabo u sharax xalka.
5. **Talooyin & Digniin**: Haddii khatar jirto, bixi digniin cad.

⚠️ HABAYNTA QORAALKA (FORMATTING):
- HA ISTICMAALIN astaanta '##' ama cinwaannada Markdown-ka.
- Isticmaal farta dhumucda leh (**Bold**), xariiqyo (---), ama liisaska (bullet points).
- Jawaabtaadu ha noqoto mid professional ah, saaxiibtinimo leh, oo xiiso leh.

🗣 LUQADDA: Somali ama English oo fasiix ah.`;
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
    const validMessages = messages.filter(m => m.content.trim().length > 0 || (m.attachments && m.attachments.length > 0));

    validMessages.forEach((m) => {
      const role = m.role === 'assistant' ? 'model' : 'user';
      const parts: Part[] = [];
      
      if (m.content.trim().length > 0) {
        parts.push({ text: m.content.trim() });
      }
      
      if (m.attachments) {
        m.attachments.forEach(at => {
          if (at.data) parts.push({ inlineData: { mimeType: at.mimeType, data: at.data } });
        });
      }

      if (parts.length > 0) {
        if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === role) {
          cleanHistory[cleanHistory.length - 1].parts.push(...parts);
        } else {
          cleanHistory.push({ role, parts });
        }
      }
    });

    return cleanHistory.slice(-12);
  }

  async *streamChat(messages: Message[]) {
    const ai = this.getAI();
    const contents = this.prepareHistory(messages);
    
    try {
      const streamResponse = await ai.models.generateContentStream({
        model: 'gemini-flash-lite-latest',
        contents,
        config: {
          systemInstruction: generateSystemInstruction(),
          temperature: 0.75,
          topP: 0.95,
        }
      });
      
      for await (const chunk of streamResponse) {
        const response = chunk as GenerateContentResponse;
        if (response.text) {
          yield { text: response.text };
        }
      }
    } catch (error: any) {
      if (error?.message?.includes("429")) {
        throw new Error("Nidaamka ayaa hadda mashquul ah. Fadlan sug xoogaa yar.");
      }
      throw error;
    }
  }

  async speakText(text: string, onEnd?: () => void): Promise<void> {
    this.stopSpeaking();
    try {
      const ai = this.getAI();
      const ttsPrompt = `Maaddaama aad tahay khabiir ku hadla Af-Soomaaliga, fadlan si fasiix ah oo dabiici ah u aqri qoraalkan. Hubi inaad si sax ah ugu dhawaaqdo xarfaha Soomaaliga (gaar ahaan 'X' iyo 'C'). Isticmaal cod dumar oo deggan, dhiirigelin leh, isla markaana macaan: ${text}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: ttsPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { 
            voiceConfig: { 
              prebuiltVoiceConfig: { voiceName: 'Puck' } 
            } 
          },
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
