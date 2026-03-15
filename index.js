import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';
import cors from 'cors';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    timeout: 30000 // 30 seconds
  }
});

const MODELS = {
  flash: "gemini-1.5-flash",
  flash2: "gemini-2.0-flash-exp",
  flash3: "gemini-3-flash-preview",
  pro: "gemini-1.5-pro"
};

const SYSTEM_INSTRUCTION = `
NAMA: tanyAIn (Kak AI)
PERAN: Study Buddy SMA Indonesia.
TONE: Gaul, santai, suportif.

ATURAN OUTPUT MUTLAK:
1. JIKA USER MINTA KUIS/SOAL/PLANNER/TODO:
   - Balas HANYA dengan PURE JSON.
   - DILARANG keras menyertakan teks pembuka, penjelasan, atau penutup di luar JSON.
   - JSON Kuis: {"type": "quiz", "question": "...", "options": ["A","B","C","D"], "answer": "...", "explanation": "..."}
   - JSON Planner: {"type": "planner", "tasks": [{"time": "HH:mm", "activity": "..."}]}
   - Kamu boleh mengirim beberapa objek JSON sekaligus jika kuisnya banyak.

2. SELAIN ITU (TANYA MATERI/SAPAAN):
   - Balas dengan teks santai dan analogi menarik.
   - DILARANG mengirim JSON jika hanya mengobrol biasa.

PENTING: Jangan gunakan markdown (\`\`\`json). Mulai respons langsung dengan '{'.
`;

const PORT = process.env.PORT || 3000;

const app = express();
const upload = multer();

app.use(express.json());
app.use(express.static('public'));
app.use(cors());

// In-memory conversation storage (Simple version for demo)
let chatHistory = [];

// endpoint: POST /generate
app.post('/generate', async (request, response) => {
  let { message } = request.body;

  if (message === "/reset") {
    chatHistory = [];
    return response.send("Riwayat chat berhasil dihapus! Yuk mulai dari awal. 😊");
  }

  if (!message || typeof message !== 'string') {
    return response.status(400).send('Pesan harus berupa teks ya!');
  }

  const isInteractive = /kuis|soal|latihan|todo|planner|jadwal/i.test(message);

  try {
    chatHistory.push({ role: "user", contents: message });
    const recentHistory = chatHistory.slice(-10);

    const config = {};
    if (isInteractive) {
      config.responseMimeType = "application/json";
      // We don't strictly need a full schema if we just want valid JSON, 
      // but the prompt already specifies the format.
    }

    const responseStream = await ai.models.generateContentStream({
      model: MODELS.flash3,
      systemInstruction: SYSTEM_INSTRUCTION,
      contents: recentHistory.map(h => ({
        role: h.role,
        parts: [{ text: h.contents }]
      })),
      config: config
    });

    let fullMessage = "";
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.setHeader('Transfer-Encoding', 'chunked');

    for await (const chunk of responseStream) {
      const chunkText = chunk.text || "";
      fullMessage += chunkText;
      response.write(chunkText);
    }

    chatHistory.push({ role: "model", contents: fullMessage });
    response.end();


  } catch (error) {
    console.error("AI Error:", error);
    // Jika error terjadi di tengah stream, kita sudah kirim header 200 mungkin?
    // Tapi di sini biasanya masih di awal.
    if (!response.headersSent) {
      if (error.status === 429) {
        return response.status(429).send("Waduh, Kak AI lagi rame banget nih. Coba lagi bentar ya!");
      }
      return response.status(500).send("Aduh, ada error di sistem Kak AI. Sabar ya!");
    } else {
      response.end(); // Akhiri stream saja jika sudah mulai
    }
  }
});


app.listen(PORT, () => {
  console.log(`tanyAIn is running on http://localhost:${PORT}`);
});
