
# DAADIR.AI - Somali Intelligence Redefined 🚀

**DAADIR.AI** is a professional-grade AI platform designed specifically for the Somali community. It leverages the latest **Gemini 3 Pro** models to provide deep reasoning, creative vision, and human-like Somali speech synthesis.

## 🌟 Key Features
- **🧠 Aqli (Advanced Reasoning):** Powered by Gemini 3 Pro for complex problem solving and coding.
- **👁️ Aqli Vision (Image Generation):** High-fidelity neural image synthesis and refinement.
- **🎙️ Somali TTS:** Advanced text-to-speech that speaks Somali with natural intonation.
- **🛡️ Edge-Local Privacy:** Your data stays in your browser's IndexedDB. No server-side storage.
- **📱 Responsive Design:** Fully optimized for Mobile, Tablet, and Desktop.

## 🛠️ Tech Architecture
- **Framework:** React 18 with TypeScript.
- **Styling:** Tailwind CSS (Custom Neural Dark Theme).
- **Intelligence:** Google Gemini API (v2.5 & v3).
- **Security:** Local-first storage with `bcryptjs` for session management.
- **Deployment:** Vercel + GitHub Actions.

## 🚀 Setup & Deployment

### Vercel Deployment
1. Create a **Public** repository on GitHub.
2. Push this code to the repository.
3. Import the project into [Vercel](https://vercel.com).
4. Add your **API_KEY** in `Settings > Environment Variables`.

### Domain Integration (is-a.dev)
To use `daadir.is-a.dev`:
1. Fork [is-a-dev/register](https://github.com/is-a-dev/register).
2. Create `domains/daadir.json`:
```json
{
  "owner": { "username": "YOUR_GITHUB_USERNAME" },
  "record": { "CNAME": "daadir.vercel.app" }
}
```
3. Submit a Pull Request.

---
## 👨‍💻 Developed By
**Daadir**  
*Software Engineer | UNISO (University of Somalia)*  
🔗 **Portfolio:** [https://daadir.42web.io/](https://daadir.42web.io/)
