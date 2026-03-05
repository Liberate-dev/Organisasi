"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { exportRundownToPdf } from "@/lib/pdf-export";
import { makeId, upsertRundown } from "@/lib/storage";
import { calculateEndTime, findChainMismatchItemIds, findOverlapItemIds, syncTimesByDate } from "@/lib/time";
import { CustomField, Rundown, RundownItem } from "@/lib/types";
import { AiPromptPanel } from "@/components/ai-prompt-panel";

type SaveState = "idle" | "saved";
type SidebarTab = "custom-fields" | "ai-generate";

function cloneItem(item: RundownItem): RundownItem {
  return {
    ...item,
    customFields: item.customFields.map((field) => ({ ...field })),
  };
}

type RundownEditorProps = {
  initialRundown: Rundown;
};

export function RundownEditor({ initialRundown }: RundownEditorProps) {
  const [rundown, setRundown] = useState<Rundown>(initialRundown);
  const [selectedItemId, setSelectedItemId] = useState<string>(initialRundown.items[0]?.id ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("custom-fields");

  const overlapIds = useMemo(() => findOverlapItemIds(rundown.items), [rundown.items]);
  const chainMismatchIds = useMemo(() => findChainMismatchItemIds(rundown.items), [rundown.items]);

  const selectedItem = rundown.items.find((item) => item.id === selectedItemId) ?? null;

  function applyItems(nextItems: RundownItem[]) {
    const next: Rundown = {
      ...rundown,
      items: nextItems,
      updatedAt: new Date().toISOString(),
    };
    setRundown(next);
    upsertRundown(next);
    setSaveState("saved");
  }

  function updateTitle(value: string) {
    const next: Rundown = {
      ...rundown,
      title: value,
      updatedAt: new Date().toISOString(),
    };
    setRundown(next);
    upsertRundown(next);
    setSaveState("saved");
  }

  function updateItem(itemId: string, updater: (item: RundownItem) => RundownItem) {
    const nextItems = rundown.items.map((item) => (item.id === itemId ? updater(cloneItem(item)) : cloneItem(item)));
    applyItems(nextItems);
  }

  function addRow() {
    const anchorIndex = selectedItemId
      ? rundown.items.findIndex((item) => item.id === selectedItemId)
      : rundown.items.length - 1;
    const insertIndex = anchorIndex >= 0 ? anchorIndex + 1 : rundown.items.length;
    const anchor = rundown.items[insertIndex - 1];

    const date = anchor?.date ?? new Date().toISOString().slice(0, 10);
    const start =
      anchor && anchor.date === date
        ? calculateEndTime(anchor.start, anchor.durationMinutes) || anchor.start || "08:00"
        : "08:00";

    const newItem: RundownItem = {
      id: makeId(),
      date,
      start,
      durationMinutes: 30,
      agenda: "",
      pic: "",
      location: "",
      notes: "",
      customFields: [],
    };

    const nextItems = rundown.items.map((item) => cloneItem(item));
    nextItems.splice(insertIndex, 0, newItem);
    applyItems(nextItems);
    setSelectedItemId(newItem.id);
  }

  function duplicateRow(itemId: string) {
    const sourceIndex = rundown.items.findIndex((item) => item.id === itemId);
    if (sourceIndex < 0) return;

    const source = rundown.items[sourceIndex];
    const duplicate: RundownItem = {
      ...cloneItem(source),
      id: makeId(),
      customFields: source.customFields.map((field) => ({
        ...field,
        id: makeId(),
      })),
    };

    const nextItems = rundown.items.map((item) => cloneItem(item));
    nextItems.splice(sourceIndex + 1, 0, duplicate);
    applyItems(nextItems);
    setSelectedItemId(duplicate.id);
  }

  function moveRow(itemId: string, direction: -1 | 1) {
    const index = rundown.items.findIndex((item) => item.id === itemId);
    if (index < 0) return;

    const target = index + direction;
    if (target < 0 || target >= rundown.items.length) return;

    const nextItems = rundown.items.map((item) => cloneItem(item));
    const [moved] = nextItems.splice(index, 1);
    nextItems.splice(target, 0, moved);
    applyItems(nextItems);
  }

  function deleteRow(itemId: string) {
    if (rundown.items.length === 1) {
      window.alert("Minimal harus ada 1 baris rundown.");
      return;
    }

    const nextItems = rundown.items.filter((item) => item.id !== itemId).map((item) => cloneItem(item));
    applyItems(nextItems);
    if (selectedItemId === itemId) {
      setSelectedItemId(nextItems[0]?.id ?? "");
    }
  }

  function syncTimes() {
    applyItems(syncTimesByDate(rundown.items));
  }

  function updateCustomField(fieldId: string, patch: Partial<CustomField>) {
    if (!selectedItem) return;
    updateItem(selectedItem.id, (item) => ({
      ...item,
      customFields: item.customFields.map((field) =>
        field.id === fieldId
          ? {
            ...field,
            ...patch,
          }
          : field,
      ),
    }));
  }

  function addCustomField() {
    if (!selectedItem) return;
    updateItem(selectedItem.id, (item) => ({
      ...item,
      customFields: [
        ...item.customFields,
        {
          id: makeId(),
          key: "",
          value: "",
        },
      ],
    }));
  }

  function removeCustomField(fieldId: string) {
    if (!selectedItem) return;
    updateItem(selectedItem.id, (item) => ({
      ...item,
      customFields: item.customFields.filter((field) => field.id !== fieldId),
    }));
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-5 px-4 py-6 md:px-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100"
            >
              Kembali
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-tide">Editor Rundown</p>
          </div>
          <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Auto-save: {saveState === "saved" ? "tersimpan" : "siap"}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="grid min-w-[260px] flex-1 gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Judul Acara</span>
            <input
              value={rundown.title}
              onChange={(event) => updateTitle(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none ring-coral transition focus:border-coral focus:ring-2"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addRow}
              className="rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Tambah Baris
            </button>
            <button
              type="button"
              onClick={syncTimes}
              className="rounded-xl bg-tide px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Sinkron Waktu
            </button>
            <button
              type="button"
              onClick={() => exportRundownToPdf(rundown)}
              className="rounded-xl bg-coral px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Export PDF (A4 Portrait)
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-card">
          <table className="min-w-[1120px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-700">
                <th className="border-b border-slate-200 px-3 py-3 font-semibold">Tanggal</th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold">Mulai</th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold">Durasi</th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold">Selesai</th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold">Agenda</th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold">PIC</th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold">Lokasi</th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold">Catatan</th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold">Peringatan</th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rundown.items.map((item, index) => {
                const isSelected = item.id === selectedItemId;
                const end = calculateEndTime(item.start, item.durationMinutes);
                const warningBadDuration = item.durationMinutes <= 0;
                const warningMissingStart = item.start.trim() === "";

                return (
                  <tr
                    key={item.id}
                    className={`align-top transition ${isSelected ? "bg-amber-50/70" : "odd:bg-white even:bg-slate-50/35"
                      }`}
                    onClick={() => setSelectedItemId(item.id)}
                  >
                    <td className="border-b border-slate-100 px-3 py-2">
                      <input
                        type="date"
                        value={item.date}
                        onChange={(event) =>
                          updateItem(item.id, (current) => ({
                            ...current,
                            date: event.target.value,
                          }))
                        }
                        className="w-[145px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <input
                        type="time"
                        value={item.start}
                        onChange={(event) =>
                          updateItem(item.id, (current) => ({
                            ...current,
                            start: event.target.value,
                          }))
                        }
                        className="w-[110px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          value={item.durationMinutes}
                          onChange={(event) =>
                            updateItem(item.id, (current) => ({
                              ...current,
                              durationMinutes: Number(event.target.value),
                            }))
                          }
                          className="w-[88px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                        />
                        <span className="text-xs text-slate-500">min</span>
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <div className="rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-700">
                        {end || "--:--"}
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <input
                        value={item.agenda}
                        onChange={(event) =>
                          updateItem(item.id, (current) => ({
                            ...current,
                            agenda: event.target.value,
                          }))
                        }
                        className="w-[220px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <input
                        value={item.pic}
                        onChange={(event) =>
                          updateItem(item.id, (current) => ({
                            ...current,
                            pic: event.target.value,
                          }))
                        }
                        className="w-[150px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <input
                        value={item.location}
                        onChange={(event) =>
                          updateItem(item.id, (current) => ({
                            ...current,
                            location: event.target.value,
                          }))
                        }
                        className="w-[150px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <textarea
                        value={item.notes}
                        onChange={(event) =>
                          updateItem(item.id, (current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                        rows={2}
                        className="w-[220px] resize-y rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <div className="flex flex-col gap-1 text-[10px] font-semibold">
                        {warningBadDuration && (
                          <span className="w-fit rounded bg-rose-100 px-2 py-1 text-rose-700">
                            Durasi tidak valid
                          </span>
                        )}
                        {warningMissingStart && (
                          <span className="w-fit rounded bg-rose-100 px-2 py-1 text-rose-700">
                            Jam mulai kosong
                          </span>
                        )}
                        {overlapIds.has(item.id) && (
                          <span className="w-fit rounded bg-amber-100 px-2 py-1 text-amber-800">
                            Overlap
                          </span>
                        )}
                        {chainMismatchIds.has(item.id) && (
                          <span className="w-fit rounded bg-sky-100 px-2 py-1 text-sky-800">
                            Belum sinkron
                          </span>
                        )}
                        {!warningBadDuration &&
                          !warningMissingStart &&
                          !overlapIds.has(item.id) &&
                          !chainMismatchIds.has(item.id) && (
                            <span className="w-fit rounded bg-emerald-100 px-2 py-1 text-emerald-800">
                              OK
                            </span>
                          )}
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            duplicateRow(item.id);
                          }}
                          className="rounded-md bg-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-300"
                        >
                          Duplikat
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            moveRow(item.id, -1);
                          }}
                          disabled={index === 0}
                          className="rounded-md bg-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-300 disabled:opacity-40"
                        >
                          Naik
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            moveRow(item.id, 1);
                          }}
                          disabled={index === rundown.items.length - 1}
                          className="rounded-md bg-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-300 disabled:opacity-40"
                        >
                          Turun
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteRow(item.id);
                          }}
                          className="rounded-md bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-200"
                        >
                          Hapus
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedItemId(item.id);
                          }}
                          className="rounded-md bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-800 hover:bg-amber-200"
                        >
                          Field
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white shadow-card">
          {/* Tab bar */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setSidebarTab("custom-fields")}
              className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold transition ${sidebarTab === "custom-fields"
                  ? "border-b-2 border-ink text-ink"
                  : "text-slate-500 hover:text-slate-800"
                }`}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Custom Field
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("ai-generate")}
              className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold transition ${sidebarTab === "ai-generate"
                  ? "border-b-2 border-violet-600 text-violet-700"
                  : "text-slate-500 hover:text-slate-800"
                }`}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              AI Generate
            </button>
          </div>

          {/* Tab: Custom Fields */}
          {sidebarTab === "custom-fields" && (
            <div className="p-5">
              <h2 className="text-lg font-semibold text-ink">Custom Field (Text Only)</h2>
              {!selectedItem ? (
                <p className="mt-3 text-sm text-slate-600">Pilih satu baris untuk mengatur custom field.</p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-slate-500">
                    Item terpilih: <span className="font-semibold text-slate-700">{selectedItem.agenda || "(Tanpa agenda)"}</span>
                  </p>
                  <div className="mt-4 grid gap-3">
                    {selectedItem.customFields.length === 0 && (
                      <p className="text-sm text-slate-600">Belum ada field tambahan.</p>
                    )}
                    {selectedItem.customFields.map((field) => (
                      <div key={field.id} className="rounded-2xl border border-slate-200 p-3">
                        <label className="grid gap-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Label</span>
                          <input
                            value={field.key}
                            onChange={(event) => updateCustomField(field.id, { key: event.target.value })}
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                            placeholder="Contoh: Kebutuhan alat"
                          />
                        </label>
                        <label className="mt-2 grid gap-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Text</span>
                          <textarea
                            value={field.value}
                            onChange={(event) => updateCustomField(field.id, { value: event.target.value })}
                            rows={2}
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                            placeholder="Isi detail tambahan"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeCustomField(field.id)}
                          className="mt-2 rounded-md bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-200"
                        >
                          Hapus Field
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addCustomField}
                    className="mt-4 rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                  >
                    Tambah Field Text
                  </button>
                </>
              )}
            </div>
          )}

          {/* Tab: AI Generate */}
          {sidebarTab === "ai-generate" && (
            <div className="p-5">
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-violet-700">
                <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <span>
                  Draft AI akan <strong>menggantikan</strong> semua item yang ada. Simpan dulu jika perlu.
                </span>
              </div>
              <AiPromptPanel
                mode="editor"
                eventDate={rundown.items[0]?.date}
                onApply={(items) => {
                  applyItems(items);
                  setSidebarTab("custom-fields");
                }}
              />
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
