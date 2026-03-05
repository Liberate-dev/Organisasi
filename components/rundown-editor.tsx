"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { exportRundownToPdf } from "@/lib/pdf-export";
import { makeId, upsertRundown } from "@/lib/storage";
import {
  calculateEndTime,
  findChainMismatchItemIds,
  findOverlapItemIds,
  syncTimesByDate,
} from "@/lib/time";
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
  const [selectedItemId, setSelectedItemId] = useState<string>(
    initialRundown.items[0]?.id ?? ""
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("custom-fields");

  const overlapIds = useMemo(
    () => findOverlapItemIds(rundown.items),
    [rundown.items]
  );
  const chainMismatchIds = useMemo(
    () => findChainMismatchItemIds(rundown.items),
    [rundown.items]
  );

  const selectedItem =
    rundown.items.find((item) => item.id === selectedItemId) ?? null;

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

  /** Update sebuah item tanpa sync rantai (untuk kolom non-waktu) */
  function updateItem(
    itemId: string,
    updater: (item: RundownItem) => RundownItem
  ) {
    const nextItems = rundown.items.map((item) =>
      item.id === itemId ? updater(cloneItem(item)) : cloneItem(item)
    );
    applyItems(nextItems);
  }

  /** Update item lalu otomatis sinkron rantai waktu (untuk kolom durasi & mulai) */
  function updateItemAndSync(
    itemId: string,
    updater: (item: RundownItem) => RundownItem
  ) {
    const nextItems = rundown.items.map((item) =>
      item.id === itemId ? updater(cloneItem(item)) : cloneItem(item)
    );
    applyItems(syncTimesByDate(nextItems));
  }

  function addRow() {
    const anchorIndex = selectedItemId
      ? rundown.items.findIndex((item) => item.id === selectedItemId)
      : rundown.items.length - 1;
    const insertIndex =
      anchorIndex >= 0 ? anchorIndex + 1 : rundown.items.length;
    const anchor = rundown.items[insertIndex - 1];

    const date = anchor?.date ?? new Date().toISOString().slice(0, 10);
    const start =
      anchor && anchor.date === date
        ? calculateEndTime(anchor.start, anchor.durationMinutes) ||
        anchor.start ||
        "08:00"
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

    const nextItems = rundown.items
      .filter((item) => item.id !== itemId)
      .map((item) => cloneItem(item));
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
        field.id === fieldId ? { ...field, ...patch } : field
      ),
    }));
  }

  function addCustomField() {
    if (!selectedItem) return;
    updateItem(selectedItem.id, (item) => ({
      ...item,
      customFields: [
        ...item.customFields,
        { id: makeId(), key: "", value: "" },
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
      {/* Header */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100"
            >
              Kembali
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-tide">
              Editor Rundown
            </p>
          </div>
          <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Auto-save: {saveState === "saved" ? "tersimpan" : "siap"}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="grid min-w-[260px] flex-1 gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Judul Acara
            </span>
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

      {/* Editor + Sidebar */}
      <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
        {/* Table — no horizontal scroll */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-700">
                <th className="border-b border-slate-200 px-3 py-3 font-semibold">
                  Tanggal
                </th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold">
                  Mulai
                </th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold">
                  Durasi
                </th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold">
                  Selesai
                </th>
                <th className="w-full border-b border-slate-200 px-3 py-3 font-semibold">
                  Agenda
                </th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold">
                  PIC
                </th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold">
                  Lokasi
                </th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {rundown.items.map((item, index) => {
                const isSelected = item.id === selectedItemId;
                const end = calculateEndTime(item.start, item.durationMinutes);
                const hasError =
                  item.durationMinutes <= 0 || item.start.trim() === "";
                const hasOverlap = overlapIds.has(item.id);
                const hasChain = chainMismatchIds.has(item.id);

                const rowBorder = hasError
                  ? "border-l-4 border-l-rose-400"
                  : hasOverlap
                    ? "border-l-4 border-l-amber-400"
                    : hasChain
                      ? "border-l-4 border-l-sky-400"
                      : "border-l-4 border-l-transparent";

                return (
                  <tr
                    key={item.id}
                    className={`align-middle transition ${rowBorder} ${isSelected
                        ? "bg-amber-50/70"
                        : "odd:bg-white even:bg-slate-50/35"
                      }`}
                    onClick={() => setSelectedItemId(item.id)}
                  >
                    {/* Tanggal */}
                    <td className="border-b border-slate-100 px-3 py-2">
                      <input
                        type="date"
                        value={item.date}
                        onChange={(e) =>
                          updateItem(item.id, (cur) => ({
                            ...cur,
                            date: e.target.value,
                          }))
                        }
                        className="w-[120px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      />
                    </td>

                    {/* Mulai */}
                    <td className="border-b border-slate-100 px-3 py-2">
                      <input
                        type="time"
                        value={item.start}
                        onChange={(e) =>
                          updateItemAndSync(item.id, (cur) => ({
                            ...cur,
                            start: e.target.value,
                          }))
                        }
                        className="w-[100px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      />
                    </td>

                    {/* Durasi */}
                    <td className="border-b border-slate-100 px-3 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          value={item.durationMinutes}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val >= 1) {
                              updateItemAndSync(item.id, (cur) => ({
                                ...cur,
                                durationMinutes: val,
                              }));
                            }
                          }}
                          onBlur={(e) => {
                            const val = Math.max(
                              1,
                              parseInt(e.target.value, 10) || 1
                            );
                            // Normalize display (strip leading zeros etc.)
                            e.target.value = String(val);
                            if (val !== item.durationMinutes) {
                              updateItemAndSync(item.id, (cur) => ({
                                ...cur,
                                durationMinutes: val,
                              }));
                            }
                          }}
                          className="w-[64px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                        />
                        <span className="text-xs text-slate-500">min</span>
                      </div>
                    </td>

                    {/* Selesai */}
                    <td className="border-b border-slate-100 px-3 py-2">
                      <div className="rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
                        {end || "--:--"}
                      </div>
                    </td>

                    {/* Agenda */}
                    <td className="w-full border-b border-slate-100 px-3 py-2">
                      <input
                        value={item.agenda}
                        onChange={(e) =>
                          updateItem(item.id, (cur) => ({
                            ...cur,
                            agenda: e.target.value,
                          }))
                        }
                        className="w-full min-w-[140px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      />
                    </td>

                    {/* PIC */}
                    <td className="border-b border-slate-100 px-3 py-2">
                      <input
                        value={item.pic}
                        onChange={(e) =>
                          updateItem(item.id, (cur) => ({
                            ...cur,
                            pic: e.target.value,
                          }))
                        }
                        className="w-[110px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      />
                    </td>

                    {/* Lokasi */}
                    <td className="border-b border-slate-100 px-3 py-2">
                      <input
                        value={item.location}
                        onChange={(e) =>
                          updateItem(item.id, (cur) => ({
                            ...cur,
                            location: e.target.value,
                          }))
                        }
                        className="w-[100px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      />
                    </td>

                    {/* Aksi — icon buttons */}
                    <td className="border-b border-slate-100 px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Duplikat"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateRow(item.id);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Naik"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveRow(item.id, -1);
                          }}
                          disabled={index === 0}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                            <path d="M18 15l-6-6-6 6" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Turun"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveRow(item.id, 1);
                          }}
                          disabled={index === rundown.items.length - 1}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Hapus"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteRow(item.id);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-500 hover:bg-rose-100"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 border-t border-slate-100 px-4 py-3 text-[10px] font-semibold text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-1 rounded-full bg-rose-400" />
              Durasi / waktu tidak valid
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-1 rounded-full bg-amber-400" />
              Overlap
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-1 rounded-full bg-sky-400" />
              Belum sinkron
            </span>
          </div>
        </div>

        {/* Sidebar */}
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
              Detail & Field
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

          {/* Tab: Detail & Custom Fields */}
          {sidebarTab === "custom-fields" && (
            <div className="p-5">
              {!selectedItem ? (
                <p className="mt-3 text-sm text-slate-600">
                  Pilih satu baris untuk melihat detail.
                </p>
              ) : (
                <>
                  <p className="text-xs text-slate-500">
                    Item terpilih:{" "}
                    <span className="font-semibold text-slate-700">
                      {selectedItem.agenda || "(Tanpa agenda)"}
                    </span>
                  </p>

                  {/* Status badge */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedItem.durationMinutes <= 0 && (
                      <span className="rounded bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700">
                        Durasi tidak valid
                      </span>
                    )}
                    {selectedItem.start.trim() === "" && (
                      <span className="rounded bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700">
                        Jam mulai kosong
                      </span>
                    )}
                    {overlapIds.has(selectedItem.id) && (
                      <span className="rounded bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-800">
                        Overlap
                      </span>
                    )}
                    {chainMismatchIds.has(selectedItem.id) && (
                      <span className="rounded bg-sky-100 px-2 py-1 text-[10px] font-semibold text-sky-800">
                        Belum sinkron
                      </span>
                    )}
                    {selectedItem.durationMinutes > 0 &&
                      selectedItem.start.trim() !== "" &&
                      !overlapIds.has(selectedItem.id) &&
                      !chainMismatchIds.has(selectedItem.id) && (
                        <span className="rounded bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-800">
                          OK
                        </span>
                      )}
                  </div>

                  {/* Catatan */}
                  <div className="mt-4">
                    <label className="grid gap-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Catatan
                      </span>
                      <textarea
                        value={selectedItem.notes}
                        onChange={(e) =>
                          updateItem(selectedItem.id, (cur) => ({
                            ...cur,
                            notes: e.target.value,
                          }))
                        }
                        rows={3}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs resize-y"
                        placeholder="Catatan tambahan untuk item ini..."
                      />
                    </label>
                  </div>

                  <hr className="my-4 border-slate-200" />

                  {/* Custom Fields */}
                  <h2 className="text-sm font-semibold text-ink">
                    Custom Field
                  </h2>
                  <div className="mt-3 grid gap-3">
                    {selectedItem.customFields.length === 0 && (
                      <p className="text-xs text-slate-500">
                        Belum ada field tambahan.
                      </p>
                    )}
                    {selectedItem.customFields.map((field) => (
                      <div
                        key={field.id}
                        className="rounded-2xl border border-slate-200 p-3"
                      >
                        <label className="grid gap-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Label
                          </span>
                          <input
                            value={field.key}
                            onChange={(e) =>
                              updateCustomField(field.id, {
                                key: e.target.value,
                              })
                            }
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                            placeholder="Contoh: Kebutuhan alat"
                          />
                        </label>
                        <label className="mt-2 grid gap-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Text
                          </span>
                          <textarea
                            value={field.value}
                            onChange={(e) =>
                              updateCustomField(field.id, {
                                value: e.target.value,
                              })
                            }
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
                  Draft AI akan <strong>menggantikan</strong> semua item yang
                  ada. Simpan dulu jika perlu.
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
