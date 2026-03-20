
# TCM WuXing Pro - Clinical Decision Support System (CDSS)

TCM WuXing Pro adalah asisten digital canggih untuk praktisi Pengobatan Tradisional Tiongkok (TCM). Aplikasi ini menggabungkan kecerdasan buatan (Google Gemini API) dengan database protokol klinis Giovanni Maciocia untuk membantu diagnosis, pemilihan titik akupunktur, dan manajemen pasien.

## 🚀 Fitur Utama

- **AI Diagnosis (Gemini 2.5 Flash)**: Analisis gejala real-time dengan output terstruktur (Ben/Root & Biao/Branch).
- **Wu Xing Visualizer**: Diagram interaktif Lima Unsur yang menunjukkan hubungan patologis (Sheng, Ke, Cheng, Wu).
- **Patient Intake Form**: Form medis lengkap mencakup anamnesa, pemeriksaan lidah, nadi, dan kode ICD-10.
- **Archive System**: Penyimpanan data pasien secara lokal (IndexedDB/LocalStorage) untuk pelacakan perkembangan klinis.
- **UKOM Practice**: Modul latihan soal untuk persiapan Uji Kompetensi nasional.
- **Professional Rx Export**: Pembuatan nota resep dokter dalam format PDF (A5) yang siap cetak.

## 🛠️ Tech Stack

- **Frontend**: React 18 (ESM Modules)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **AI Engine**: Google GenAI (@google/genai) - Model: `gemini-3-flash-preview`
- **PDF Engine**: jsPDF & html2canvas
- **Data Persistence**: Local Storage Service

## 📁 Struktur Proyek

```text
/
├── src/                 # Source code (React & Server)
│   ├── components/      # Komponen UI (Atomic & Composite)
│   ├── services/        # Logika Bisnis & API
│   ├── App.tsx          # Root Layout & State Management
│   ├── server.ts        # Express Server (Proxy AI)
│   └── ...
├── public/              # Aset statis & PWA (manifest, sw)
├── netlify/             # Konfigurasi Netlify Functions
├── index.html           # Entry point
└── vite.config.ts       # Konfigurasi Build
```

## 🧠 Logika TCM & AI

Aplikasi ini menggunakan pendekatan **Pattern Differentiation** (Bian Zheng). 

### 1. Matching Engine
Sistem melakukan *fuzzy matching* antara input user dengan `constants.ts` menggunakan bobot:
- **Gejala Kunci**: 50 poin
- **Manifestasi Umum**: 15 poin
- **Lidah**: 20 poin
- **Nadi**: 20 poin

### 2. AI Prompting
AI diberikan instruksi sistem (System Instruction) untuk berperan sebagai "Senior TCM Expert". AI diwajibkan memberikan output JSON dengan struktur:
- `differentiation.ben`: Akar masalah (Chronic condition).
- `differentiation.biao`: Manifestasi akut (Symptoms).
- `score`: Persentase kecocokan klinis.

## 🚀 Deployment (Netlify)

Untuk mengatasi masalah "blank page" dan memastikan backend berjalan di Netlify:

1.  **Build Settings**:
    *   **Build Command**: `npm run build`
    *   **Publish Directory**: `dist`
    *   **Functions Directory**: `netlify/functions`

2.  **Environment Variables**:
    *   Tambahkan variabel berikut di Netlify (Site Settings > Build & deploy > Environment):
        *   `GEMINI_API_KEY`: API Key Google Gemini Anda.
        *   `VITE_SUPABASE_URL`: URL Proyek Supabase Anda.
        *   `VITE_SUPABASE_ANON_KEY`: Anon Key Supabase Anda.
        *   `NETLIFY`: `true` (Penting untuk mode serverless).

3.  **PWA**:
    *   Aplikasi sudah mendukung PWA. Setelah deploy, Anda bisa "Install" aplikasi ini di HP atau Desktop untuk akses offline.

## ⚙️ Instalasi & Konfigurasi

1. Pastikan Anda memiliki API Key dari [Google AI Studio](https://aistudio.google.com/).
2. Tambahkan variabel lingkungan `GEMINI_API_KEY`, `VITE_SUPABASE_URL`, dan `VITE_SUPABASE_ANON_KEY`.
3. Jalankan `npm run dev` untuk pengembangan lokal.

## 📄 Lisensi
Sistem ini dikembangkan untuk tujuan edukasi dan asisten klinis profesional. Diagnosis akhir tetap menjadi tanggung jawab praktisi medis berlisensi.
