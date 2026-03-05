"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { RUNDOWN_TEMPLATES } from "@/lib/templates";
import {
  createBlankRundown,
  createTemplateRundown,
  deleteRundown,
  duplicateRundown,
  readRundowns,
  upsertRundown,
} from "@/lib/storage";
import { Rundown, RundownItem } from "@/lib/types";
import { AiPromptPanel } from "@/components/ai-prompt-panel";

function todayInputDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function Dashboard() {
  const [rundowns, setRundowns] = useState<Rundown[]>(() => readRundowns());
  const [title, setTitle] = useState("Rundown Acara Baru");
  const [eventDate, setEventDate] = useState(todayInputDate());
  const [templateId, setTemplateId] = useState(RUNDOWN_TEMPLATES[0]?.id ?? "");
  const [showAiPanel, setShowAiPanel] = useState(false);
  const router = useRouter();

  const totalItems = useMemo(
    () => rundowns.reduce((acc, rundown) => acc + rundown.items.length, 0),
    [rundowns],
  );

  function refresh() {
    setRundowns(readRundowns());
  }

  function onCreateBlank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rundown = createBlankRundown(title.trim() || "Rundown Tanpa Judul", eventDate);
    router.push(`/rundown/${rundown.id}`);
  }

  function onCreateFromTemplate() {
    const label = RUNDOWN_TEMPLATES.find((entry) => entry.id === templateId)?.name ?? "Template";
    const rundown = createTemplateRundown(
      templateId,
      title.trim() || `${label} ${eventDate}`,
      eventDate,
    );
    router.push(`/rundown/${rundown.id}`);
  }

  function onDuplicate(rundownId: string) {
    const copy = duplicateRundown(rundownId);
    if (!copy) return;
    refresh();
    router.push(`/rundown/${copy.id}`);
  }

  function onDelete(rundownId: string) {
    const accepted = window.confirm("Hapus rundown ini dari local storage?");
    if (!accepted) return;
    deleteRundown(rundownId);
    refresh();
  }

  function onCreateFromAi(aiTitle: string, items: RundownItem[]) {
    const rundown = createBlankRundown(
      aiTitle.trim() || "Rundown AI Baru",
      items[0]?.date ?? todayInputDate(),
    );
    const rundownWithItems: Rundown = {
      ...rundown,
      items,
      updatedAt: new Date().toISOString(),
    };
    upsertRundown(rundownWithItems);
    router.push(`/rundown/${rundown.id}`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-8 md:px-8">
      <section className="rounded-3xl border border-white/70 bg-gradient-to-br from-linen via-shell to-emerald-50 p-6 shadow-card md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-tide">Organisasi Mahasiswa</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-ink md:text-4xl">
          Rundown Builder
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-700 md:text-base">
          Buat, edit, dan ekspor rundown acara dengan mudah. Data disimpan di <strong>local storage browser kamu</strong> — tidak tersimpan di server, sehingga jika berpindah device atau menghapus data browser, rundown akan hilang.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
            Rundown: {rundowns.length}
          </span>
          <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
            Total item: {totalItems}
          </span>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <form
          onSubmit={onCreateBlank}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card md:p-7"
        >
          <h2 className="text-xl font-semibold text-ink">Buat Rundown</h2>
          <p className="mt-1 text-sm text-slate-600">Pilih mulai dari kosong atau template siap pakai.</p>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-1">
              <span className="text-sm font-medium text-slate-700">Judul Acara</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-coral transition focus:border-coral focus:ring-2"
                placeholder="Contoh: Seminar Kepemimpinan 2026"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-medium text-slate-700">Tanggal Acara</span>
              <input
                type="date"
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-coral transition focus:border-coral focus:ring-2"
              />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Buat Dari Kosong
            </button>
          </div>

          <hr className="my-6 border-slate-200" />

          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-sm font-medium text-slate-700">Template</span>
              <select
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-coral transition focus:border-coral focus:ring-2"
              >
                {RUNDOWN_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} - {template.description}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={onCreateFromTemplate}
              className="mt-2 w-fit rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Buat Dari Template
            </button>
          </div>
        </form>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card md:p-7">
          <h2 className="text-xl font-semibold text-ink">Template Tersedia</h2>
          <div className="mt-4 grid gap-3">
            {RUNDOWN_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
              >
                <p className="font-semibold text-slate-800">{template.name}</p>
                <p className="text-sm text-slate-600">{template.description}</p>
                <p className="mt-1 text-xs text-slate-500">{template.items.length} item awal</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Generate Section ─────────────────────────── */}
      <section
        className={`rounded-3xl border shadow-card transition-all md:p-7 ${showAiPanel
          ? "border-violet-300 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-6"
          : "border-slate-200 bg-white p-6"
          }`}
      >
        <button
          type="button"
          onClick={() => setShowAiPanel((v) => !v)}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-2xl transition ${showAiPanel ? "bg-violet-600" : "bg-violet-100"
                }`}
            >
              <svg
                className={`h-5 w-5 ${showAiPanel ? "text-white" : "text-violet-600"}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-ink">Generate dengan AI</h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Deskripsikan acaramu, AI akan buat draft rundown otomatis.
              </p>
            </div>
          </div>
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${showAiPanel
              ? "bg-violet-100 text-violet-700"
              : "bg-slate-100 text-slate-600"
              }`}
          >
            {showAiPanel ? "Tutup" : "Buka Panel"}
            <svg
              className={`h-3.5 w-3.5 transition-transform ${showAiPanel ? "rotate-180" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {showAiPanel && (
          <div className="mt-6 border-t border-violet-200 pt-6">
            <AiPromptPanel
              mode="dashboard"
              eventDate={eventDate}
              onCreateNew={onCreateFromAi}
            />
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card md:p-7">
        <h2 className="text-xl font-semibold text-ink">Rundown Tersimpan</h2>
        {rundowns.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            Belum ada rundown. Buat pertama kali dari panel di atas.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="text-slate-600">
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Judul</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Items</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Update</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rundowns.map((rundown) => (
                  <tr key={rundown.id} className="text-slate-700">
                    <td className="border-b border-slate-100 px-3 py-3 font-medium">{rundown.title}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{rundown.items.length}</td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      {rundown.updatedAt.slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/rundown/${rundown.id}`}
                          className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                        >
                          Buka
                        </Link>
                        <button
                          type="button"
                          onClick={() => onDuplicate(rundown.id)}
                          className="rounded-lg bg-tide px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                        >
                          Duplikasi
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(rundown.id)}
                          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
