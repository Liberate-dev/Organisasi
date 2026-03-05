"use client";

import { useState } from "react";
import { RundownItem } from "@/lib/types";
import { makeId } from "@/lib/storage";

export type AiPanelMode = "dashboard" | "editor";

type AiPromptPanelProps = {
    mode: AiPanelMode;
    eventDate?: string;
    onApply?: (items: RundownItem[]) => void;
    onCreateNew?: (title: string, items: RundownItem[]) => void;
};

const EVENT_TYPE_PRESETS = [
    { label: "Seminar / Webinar", value: "seminar" },
    { label: "Rapat Koordinasi", value: "rapat" },
    { label: "Workshop / Pelatihan", value: "workshop" },
    { label: "Kegiatan Kampus", value: "kampus" },
    { label: "Gala Dinner / Malam Puncak", value: "gala" },
    { label: "Custom (tulis sendiri)", value: "custom" },
];

const PRESET_PROMPT_HINTS: Record<string, string> = {
    seminar:
        "Seminar nasional tentang kepemimpinan mahasiswa, mulai pukul 08.00, durasi 6 jam, ada sesi pembukaan, keynote speaker, panel diskusi, tanya jawab, dan penutupan.",
    rapat:
        "Rapat koordinasi kepanitiaan acara besar, mulai pukul 09.00, durasi 2 jam, ada laporan divisi, evaluasi, dan rencana tindak lanjut.",
    workshop:
        "Workshop desain grafis untuk pemula, mulai pukul 13.00, durasi 4 jam, ada pengenalan tools, sesi latihan, presentasi hasil, dan feedback.",
    kampus:
        "Kegiatan PKKMB (orientasi mahasiswa baru), mulai pukul 07.00, durasi 8 jam, ada apel pagi, pengenalan kampus, sesi dekan, ishoma, dan kegiatan sore.",
    gala:
        "Malam puncak wisuda dan gala dinner, mulai pukul 18.00, durasi 4 jam, ada cocktail, sambutan, awarding, hiburan, dan penutupan.",
    custom: "",
};

type ApiResponseItem = {
    start: string;
    durationMinutes: number;
    agenda: string;
    pic: string;
    location: string;
    notes: string;
};

type ApiResponse = {
    ok: boolean;
    provider?: string;
    title?: string;
    items?: ApiResponseItem[];
    error?: string;
};

type PreviewItem = RundownItem & { _provider?: string };

export function AiPromptPanel({
    mode,
    eventDate,
    onApply,
    onCreateNew,
}: AiPromptPanelProps) {
    const today = new Date().toISOString().slice(0, 10);

    const [eventType, setEventType] = useState("seminar");
    const [prompt, setPrompt] = useState(PRESET_PROMPT_HINTS["seminar"]);
    const [aiTitle, setAiTitle] = useState("Rundown Acara AI");
    const [aiDate, setAiDate] = useState(eventDate ?? today);
    const [startTime, setStartTime] = useState("08:00");
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
    const [generatedTitle, setGeneratedTitle] = useState("");
    const [providerUsed, setProviderUsed] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    function onEventTypeChange(value: string) {
        setEventType(value);
        if (PRESET_PROMPT_HINTS[value]) {
            setPrompt(PRESET_PROMPT_HINTS[value]);
        }
    }

    async function onGenerate() {
        if (!prompt.trim()) {
            setErrorMsg("Tuliskan deskripsi acara terlebih dahulu.");
            return;
        }
        setErrorMsg("");
        setStatus("loading");
        setPreviewItems([]);
        setProviderUsed("");

        try {
            const res = await fetch("/api/generate-rundown", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: prompt.trim(),
                    eventDate: aiDate,
                    startTime,
                }),
            });

            const data: ApiResponse = await res.json();

            if (!res.ok || !data.ok || !data.items || data.items.length === 0) {
                throw new Error(data.error ?? "Response tidak valid dari server.");
            }

            const items: PreviewItem[] = data.items.map((item) => ({
                id: makeId(),
                date: aiDate,
                start: item.start,
                durationMinutes: item.durationMinutes,
                agenda: item.agenda,
                pic: item.pic,
                location: item.location,
                notes: item.notes,
                customFields: [],
                _provider: data.provider,
            }));

            setPreviewItems(items);
            setGeneratedTitle(data.title ?? aiTitle);
            setProviderUsed(data.provider ?? "");
            setStatus("done");
        } catch (err) {
            setErrorMsg((err as Error).message);
            setStatus("error");
        }
    }

    function onApplyItems() {
        if (!previewItems.length) return;
        // Strip internal _provider field before passing up
        const clean: RundownItem[] = previewItems.map(({ _provider: _p, ...rest }) => rest);
        if (mode === "editor" && onApply) {
            onApply(clean);
            setStatus("idle");
            setPreviewItems([]);
        } else if (mode === "dashboard" && onCreateNew) {
            onCreateNew(generatedTitle || aiTitle, clean);
        }
    }

    function onRegenerate() {
        setStatus("idle");
        setPreviewItems([]);
        onGenerate();
    }

    const charCount = prompt.length;
    const isLoading = status === "loading";

    const PROVIDER_LABELS: Record<string, string> = {
        cerebras: "⚡ Cerebras (llama3.1-8b)",
        gemini: "✨ Google Gemini",
        openrouter: "🔀 OpenRouter (free)",
    };

    return (
        <div className="flex flex-col gap-5">
            {/* Header badge */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    AI Draft Generator
                </span>
                <span className="text-xs text-slate-500">
                    Cerebras → Gemini → OpenRouter
                </span>
            </div>

            {/* Form */}
            <div className="grid gap-4">
                {/* Judul (only dashboard) */}
                {mode === "dashboard" && (
                    <label className="grid gap-1">
                        <span className="text-sm font-medium text-slate-700">Judul Acara</span>
                        <input
                            value={aiTitle}
                            onChange={(e) => setAiTitle(e.target.value)}
                            placeholder="Contoh: Seminar Kepemimpinan 2026"
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-violet-400 transition focus:border-violet-400 focus:ring-2"
                        />
                    </label>
                )}

                {/* Jenis acara */}
                <label className="grid gap-1">
                    <span className="text-sm font-medium text-slate-700">Jenis Acara</span>
                    <select
                        value={eventType}
                        onChange={(e) => onEventTypeChange(e.target.value)}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-violet-400 transition focus:border-violet-400 focus:ring-2"
                    >
                        {EVENT_TYPE_PRESETS.map((preset) => (
                            <option key={preset.value} value={preset.value}>
                                {preset.label}
                            </option>
                        ))}
                    </select>
                </label>

                {/* Prompt */}
                <label className="grid gap-1">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">Deskripsi Acara & Kebutuhan</span>
                        <span className="text-xs text-slate-400">{charCount}/800</span>
                    </div>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value.slice(0, 800))}
                        rows={5}
                        placeholder="Ceritakan acara: jenis kegiatan, topik, tamu/narasumber, durasi total, sesi wajib, dll."
                        className="resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none ring-violet-400 transition focus:border-violet-400 focus:ring-2"
                    />
                    <p className="text-xs text-slate-400">
                        Semakin detail prompt, semakin relevan draft yang dihasilkan.
                    </p>
                </label>

                {/* Advanced toggle */}
                <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="flex w-fit items-center gap-1.5 text-xs font-semibold text-violet-600 hover:underline"
                >
                    <svg
                        className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                    >
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                    {showAdvanced ? "Sembunyikan" : "Opsi Lanjutan"}
                </button>

                {showAdvanced && (
                    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Parameter Tambahan</p>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="grid gap-1">
                                <span className="text-xs font-medium text-slate-700">Tanggal Acara</span>
                                <input
                                    type="date"
                                    value={aiDate}
                                    onChange={(e) => setAiDate(e.target.value)}
                                    className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none ring-violet-400 transition focus:border-violet-400 focus:ring-2"
                                />
                            </label>
                            <label className="grid gap-1">
                                <span className="text-xs font-medium text-slate-700">Jam Mulai Default</span>
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none ring-violet-400 transition focus:border-violet-400 focus:ring-2"
                                />
                            </label>
                        </div>
                    </div>
                )}

                {/* Error */}
                {(status === "error" || errorMsg) && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {errorMsg || "Generate gagal. Coba lagi."}
                    </div>
                )}

                {/* Generate button */}
                <button
                    type="button"
                    onClick={onGenerate}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isLoading ? (
                        <>
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                                <path d="M12 2a10 10 0 0 1 10 10" />
                            </svg>
                            Generating draft…
                        </>
                    ) : (
                        <>
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                            Generate Draft Rundown
                        </>
                    )}
                </button>
            </div>

            {/* Preview hasil */}
            {status === "done" && previewItems.length > 0 && (
                <div className="flex flex-col gap-4">
                    {/* Provider info + action bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                            <p className="text-sm font-semibold text-slate-800">
                                Draft Dihasilkan ({previewItems.length} item)
                            </p>
                            {providerUsed && (
                                <p className="text-xs text-slate-500">
                                    via {PROVIDER_LABELS[providerUsed] ?? providerUsed}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onRegenerate}
                                className="rounded-lg border border-violet-300 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50"
                            >
                                Regenerate
                            </button>
                            <button
                                type="button"
                                onClick={onApplyItems}
                                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
                            >
                                {mode === "dashboard" ? "Buat Rundown dari Draft Ini" : "Terapkan ke Editor"}
                            </button>
                        </div>
                    </div>

                    {/* Judul yang dihasilkan */}
                    {generatedTitle && (
                        <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-2.5">
                            <span className="text-xs font-semibold text-violet-600">Judul yang Diusulkan AI: </span>
                            <span className="text-sm font-medium text-slate-800">{generatedTitle}</span>
                        </div>
                    )}

                    {/* Preview table */}
                    <div className="overflow-x-auto rounded-2xl border border-violet-100 bg-violet-50/40">
                        <table className="min-w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="bg-violet-100/60 text-violet-700">
                                    <th className="border-b border-violet-200 px-3 py-2 font-semibold">Mulai</th>
                                    <th className="border-b border-violet-200 px-3 py-2 font-semibold">Durasi</th>
                                    <th className="border-b border-violet-200 px-3 py-2 font-semibold">Agenda</th>
                                    <th className="border-b border-violet-200 px-3 py-2 font-semibold">PIC</th>
                                    <th className="border-b border-violet-200 px-3 py-2 font-semibold">Lokasi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previewItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-violet-100/30">
                                        <td className="border-b border-violet-100 px-3 py-2 font-mono">{item.start}</td>
                                        <td className="border-b border-violet-100 px-3 py-2 text-slate-600">{item.durationMinutes} min</td>
                                        <td className="border-b border-violet-100 px-3 py-2 font-medium text-slate-800">{item.agenda}</td>
                                        <td className="border-b border-violet-100 px-3 py-2 text-slate-600">{item.pic}</td>
                                        <td className="border-b border-violet-100 px-3 py-2 text-slate-600">{item.location}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <p className="text-xs text-slate-500">
                        Draft bersifat sementara. Semua item bisa diubah bebas di editor.
                    </p>
                </div>
            )}
        </div>
    );
}
