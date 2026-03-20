import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import rateLimit from "express-rate-limit";
import path from "path";
import { supabase } from "./supabase";

export async function createExpressApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' })); // Increase limit for images

  // --- Rate Limiting ---
  const chatLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per window
    message: { error: "Terlalu banyak permintaan. Silakan coba lagi dalam 15 menit." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // --- Gemini Chat Proxy ---
  app.post("/api/chat", chatLimiter, async (req, res) => {
    const { message, image, language, cdssAnalysis, userRole, username } = req.body;
    
    const today = new Date().toISOString().split('T')[0];
    const user = username || 'anonymous';
    
    // Define limits based on roles
    const limits: Record<string, number> = {
      'user': 5,
      'admin': 100,
      'super_saint': 1000
    };
    
    const userLimit = limits[userRole] || 5;

    try {
      // Check usage from Supabase
      const { data: usage, error: usageError } = await supabase
        .from('usage')
        .select('count')
        .eq('username', user)
        .eq('date', today)
        .single();

      const currentCount = usage ? usage.count : 0;

      if (currentCount >= userLimit) {
        return res.status(429).json({ 
          error: `Limit harian untuk akun ${userRole} (${userLimit}x) telah tercapai. Silakan coba lagi besok atau hubungi admin untuk upgrade.` 
        });
      }

      // Get API Key from Supabase settings first, then process.env
      const { data: dbKey } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'GEMINI_API_KEY')
        .single();
        
      const apiKey = dbKey?.value || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured on the server.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const parts: any[] = [{ text: message }];
      if (image) {
        const mimeType = image.split(';')[0].split(':')[1];
        const base64Data = image.split(',')[1];
        parts.push({
          inlineData: {
            mimeType,
            data: base64Data
          }
        });
      }

      const topSyndrome = cdssAnalysis && cdssAnalysis.length > 0 ? cdssAnalysis[0].syndrome : null;
      const tpContext = topSyndrome?.treatment_principle?.length ? `\nPRINSIP TERAPI DARI CDSS: ${topSyndrome.treatment_principle.join(', ')}` : '';
      const herbContext = topSyndrome?.herbal_prescription ? `\nRESEP KLASIK DARI CDSS: ${topSyndrome.herbal_prescription}` : '';

      const systemInstruction = `Anda adalah Pakar Senior TCM (Giovanni Maciocia). 
Tugas: Memberikan diagnosis instan dalam JSON.
WAJIB: Berikan 10-12 titik akupunktur. TAMBAHKAN juga rekomendasi titik dari Master Tung jika relevan.
PENTING: Pisahkan analisis menjadi BEN (Akar) dan BIAO (Cabang).
BARU: Sertakan "score" (0-100) untuk setiap item diferensiasi yang menunjukkan seberapa kuat gejala tersebut mendukung pola diagnosis.${tpContext}${herbContext}
Gunakan PRINSIP TERAPI dan RESEP KLASIK dari CDSS di atas jika tersedia untuk mengisi "treatment_principle" dan "classical_prescription".
Lakukan diferensiasi sindrom yang mendalam berdasarkan 8 Prinsip (Yin/Yang, Interior/Exterior, Cold/Heat, Deficiency/Excess) dan Organ Zang-Fu.
JIKA ada indikasi OBESITAS atau masalah terkait berat badan, berikan analisis khusus dan saran.
JIKA relevan atau diminta, berikan juga saran terkait AKUPUNTUR KECANTIKAN (Cosmetic Acupuncture).

Bahasa: ${language}.
Format JSON:
{
  "conversationalResponse": "1 kalimat penjelasan singkat.",
  "diagnosis": {
    "patternId": "Nama Sindrom (Pinyin - English)",
    "explanation": "Ringkasan kasus dan patogenesis (bagaimana sindrom ini berkembang).",
    "differentiation": {
      "ben": [{"label": "Akar Masalah (Misal: Defisiensi Yin Ginjal)", "value": "Penjelasan mengapa ini akar masalah", "score": 95}],
      "biao": [{"label": "Manifestasi Akut (Misal: Naiknya Yang Hati)", "value": "Penjelasan mengapa ini manifestasi akut", "score": 88}]
    },
    "treatment_principle": ["Tonify Kidney Yin", "Subdue Liver Yang"],
    "classical_prescription": "Liu Wei Di Huang Wan",
    "recommendedPoints": [{"code": "Kode", "description": "Fungsi spesifik untuk kasus ini"}],
    "masterTungPoints": [{"code": "Kode/Nama Titik Master Tung", "description": "Fungsi spesifik"}],
    "wuxingElement": "Wood/Fire/Earth/Metal/Water",
    "lifestyleAdvice": "Saran praktis spesifik untuk pasien",
    "herbal_recommendation": {"formula_name": "Nama Formula", "chief": ["Herbal1", "Herbal2"]},
    "obesity_indication": "Penjelasan jika ada indikasi obesitas, atau null jika tidak ada",
    "beauty_acupuncture": "Saran akupuntur kecantikan jika relevan, or null jika tidak ada"
  }
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.1,
          thinkingConfig: { thinkingBudget: 0 }
        }
      });

      // Increment usage in Supabase
      if (usage) {
        await supabase
          .from('usage')
          .update({ count: currentCount + 1 })
          .eq('username', user)
          .eq('date', today);
      } else {
        await supabase
          .from('usage')
          .insert({ username: user, date: today, count: 1 });
      }

      res.json(JSON.parse(response.text.trim()));
    } catch (error: any) {
      console.error("Gemini Proxy Error:", error);
      res.status(500).json({ error: error.message || "Gagal menghubungi AI. Silakan coba lagi nanti." });
    }
  });

  return app;
}

async function startServer() {
  const app = await createExpressApp();
  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (process.env.NODE_ENV !== "production" || !process.env.NETLIFY) {
  startServer();
}
