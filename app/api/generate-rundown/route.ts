import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Increase Vercel function timeout (default 10s is too short for AI calls)
export const maxDuration = 30;

// ─── Zod-style type for our structured output ─────────────────────────────
// We validate manually (no extra deps) so we keep the bundle lean.
type RawAiItem = {
    start?: unknown;
    durationMinutes?: unknown;
    agenda?: unknown;
    pic?: unknown;
    location?: unknown;
    notes?: unknown;
};

type RundownDraft = {
    title: string;
    items: Array<{
        start: string;
        durationMinutes: number;
        agenda: string;
        pic: string;
        location: string;
        notes: string;
    }>;
};

// ─── System prompt ─────────────────────────────────────────────────────────
function buildSystemPrompt(): string {
    return `Kamu adalah asisten pembuat rundown acara profesional.
Tugasmu: hasilkan draft rundown dalam format JSON terstruktur berdasarkan deskripsi acara dari user.

WAJIB kembalikan HANYA JSON berikut (tanpa markdown, tanpa kode fence, tanpa teks lain):
{
  "title": "Judul acara yang sesuai",
  "items": [
    {
      "start": "HH:MM",
      "durationMinutes": <angka positif>,
      "agenda": "Nama sesi/kegiatan",
      "pic": "Nama penanggung jawab",
      "location": "Tempat/ruangan",
      "notes": "Catatan singkat"
    }
  ]
}

Aturan wajib:
- Format start: HH:MM (24 jam), contoh "08:00", "13:30"
- durationMinutes: angka bulat positif (menit)
- Minimal 4 item, maksimal 15 item
- Hasilkan item yang realistis dan sesuai jenis acara
- Jangan tambahkan field lain selain di atas
- Jangan bungkus JSON dengan \`\`\` atau markdown apapun`;
}

// ─── Validation helper ────────────────────────────────────────────────────
function parseAndValidate(raw: string): RundownDraft {
    // Strip code fences if model ignores instruction
    const stripped = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let parsed: unknown;
    try {
        parsed = JSON.parse(stripped);
    } catch {
        throw new Error("Output model bukan JSON valid");
    }

    if (typeof parsed !== "object" || parsed === null || !("items" in parsed)) {
        throw new Error("Struktur JSON tidak sesuai schema");
    }

    const obj = parsed as Record<string, unknown>;

    if (!Array.isArray(obj.items) || obj.items.length === 0) {
        throw new Error("Field 'items' kosong atau bukan array");
    }

    const items = (obj.items as RawAiItem[]).map((item, idx) => {
        if (typeof item.start !== "string" || !/^\d{1,2}:\d{2}$/.test(item.start)) {
            throw new Error(`Item[${idx}].start tidak valid: ${item.start}`);
        }
        const dur = Number(item.durationMinutes);
        if (!Number.isInteger(dur) || dur <= 0) {
            throw new Error(`Item[${idx}].durationMinutes tidak valid: ${item.durationMinutes}`);
        }
        return {
            start: item.start,
            durationMinutes: dur,
            agenda: String(item.agenda ?? ""),
            pic: String(item.pic ?? ""),
            location: String(item.location ?? ""),
            notes: String(item.notes ?? ""),
        };
    });

    return {
        title: String(obj.title ?? "Rundown AI"),
        items,
    };
}

// ─── Providers ────────────────────────────────────────────────────────────

// 1. Cerebras — llama3.1-8b (fastest)
async function generateWithCerebras(userPrompt: string): Promise<string> {
    const key = process.env.CEREBRAS_API_KEY;
    if (!key) throw new Error("CEREBRAS_API_KEY not set");

    const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
            model: "llama3.1-8b",
            messages: [
                { role: "system", content: buildSystemPrompt() },
                { role: "user", content: userPrompt },
            ],
            max_completion_tokens: 4096,
            temperature: 0.7,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Cerebras ${res.status}: ${err}`);
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0].message.content;
}

// 2. Gemini — cascade fallback
async function generateWithGemini(userPrompt: string): Promise<string> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY not set");

    const MODELS = [
        "gemini-2.5-flash-preview-04-17",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
    ];

    const genAI = new GoogleGenerativeAI(key);
    const fullPrompt = `${buildSystemPrompt()}\n\nUser: ${userPrompt}`;

    for (const modelName of MODELS) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(fullPrompt);
            const text = result.response.text();
            console.log(`✅ Gemini [${modelName}] OK`);
            return text;
        } catch (err) {
            console.warn(`⚠️ Gemini [${modelName}] failed:`, (err as Error).message);
        }
    }
    throw new Error("All Gemini models failed");
}

// 3. OpenRouter — free tier fallback
async function generateWithOpenRouter(userPrompt: string): Promise<string> {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY not set");

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
            "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://organisasi.vercel.app",
            "X-Title": "Rundown Builder AI",
        },
        body: JSON.stringify({
            models: [
                "meta-llama/llama-3.3-70b-instruct:free",
                "google/gemini-2.0-flash-exp:free",
                "mistralai/mistral-small-3.1-24b-instruct:free",
            ],
            messages: [
                { role: "system", content: buildSystemPrompt() },
                { role: "user", content: userPrompt },
            ],
            max_tokens: 4096,
            temperature: 0.7,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenRouter ${res.status}: ${err}`);
    }

    const data = await res.json() as {
        choices: Array<{ message: { content: string } }>;
        model?: string;
    };
    const usedModel = data.model ?? "openrouter-free";
    console.log(`✅ OpenRouter [${usedModel}] OK`);
    return data.choices[0].message.content;
}

// ─── Smart Router: Cerebras → Gemini → OpenRouter ──────────────────────────
async function routeGenerate(userPrompt: string): Promise<{ raw: string; provider: string }> {
    const providers: Array<{ name: string; fn: () => Promise<string> }> = [
        { name: "cerebras", fn: () => generateWithCerebras(userPrompt) },
        { name: "gemini", fn: () => generateWithGemini(userPrompt) },
        { name: "openrouter", fn: () => generateWithOpenRouter(userPrompt) },
    ];

    for (const { name, fn } of providers) {
        try {
            const raw = await fn();
            return { raw, provider: name };
        } catch (err) {
            console.warn(`⚠️ Provider [${name}] failed:`, (err as Error).message);
        }
    }

    throw new Error("Semua provider AI gagal. Coba lagi nanti.");
}

// ─── Route Handler ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as {
            prompt?: string;
            eventDate?: string;
            startTime?: string;
        };

        const { prompt, eventDate, startTime } = body;

        if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
            return NextResponse.json(
                { error: "Prompt terlalu pendek atau kosong." },
                { status: 400 },
            );
        }

        const userPrompt = `
Tanggal acara: ${eventDate ?? "tidak disebutkan"}
Jam mulai default: ${startTime ?? "08:00"}

Deskripsi acara:
${prompt.trim()}

Hasilkan draft rundown dalam format JSON seperti yang diminta.
`.trim();

        const { raw, provider } = await routeGenerate(userPrompt);

        let draft: RundownDraft;
        try {
            draft = parseAndValidate(raw);
        } catch (validationErr) {
            console.error("Validation error:", validationErr);
            return NextResponse.json(
                {
                    error: `Output AI tidak valid: ${(validationErr as Error).message}. Coba regenerate.`,
                    rawOutput: raw,
                },
                { status: 422 },
            );
        }

        return NextResponse.json({
            ok: true,
            provider,
            title: draft.title,
            items: draft.items,
        });
    } catch (err) {
        const message = (err as Error).message ?? "Internal server error";
        console.error("AI generate error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
