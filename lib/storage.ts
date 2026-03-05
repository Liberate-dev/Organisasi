import { RUNDOWN_TEMPLATES } from "@/lib/templates";
import { CustomField, Rundown, RundownItem } from "@/lib/types";

const STORAGE_KEY = "rundown_builder_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function nowIso(): string {
  return new Date().toISOString();
}

export function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function parseStorage(raw: string | null): Rundown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Rundown[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function readRundowns(): Rundown[] {
  if (!isBrowser()) return [];
  const stored = parseStorage(window.localStorage.getItem(STORAGE_KEY));
  return stored.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function writeRundowns(rundowns: Rundown[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rundowns));
}

export function createRundownItem(seed?: Partial<RundownItem>): RundownItem {
  return {
    id: makeId(),
    date: seed?.date ?? new Date().toISOString().slice(0, 10),
    start: seed?.start ?? "08:00",
    durationMinutes: seed?.durationMinutes ?? 30,
    agenda: seed?.agenda ?? "",
    pic: seed?.pic ?? "",
    location: seed?.location ?? "",
    notes: seed?.notes ?? "",
    customFields:
      seed?.customFields?.map((field) => ({
        id: field.id ?? makeId(),
        key: field.key,
        value: field.value,
      })) ?? [],
  };
}

function createRundown(title: string, items: RundownItem[]): Rundown {
  const timestamp = nowIso();
  return {
    id: makeId(),
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
    items,
  };
}

export function upsertRundown(rundown: Rundown): void {
  const current = readRundowns();
  const next = current.filter((entry) => entry.id !== rundown.id);
  next.push(rundown);
  writeRundowns(next);
}

export function getRundownById(rundownId: string): Rundown | null {
  const list = readRundowns();
  return list.find((entry) => entry.id === rundownId) ?? null;
}

export function createBlankRundown(title: string, date: string): Rundown {
  const firstItem = createRundownItem({
    date,
    start: "08:00",
    durationMinutes: 30,
    agenda: "Pembukaan",
  });

  const rundown = createRundown(title, [firstItem]);
  upsertRundown(rundown);
  return rundown;
}

export function createTemplateRundown(templateId: string, title: string, date: string): Rundown {
  const template = RUNDOWN_TEMPLATES.find((entry) => entry.id === templateId);
  const source = template ?? RUNDOWN_TEMPLATES[0];

  const items = source.items.map((item) =>
    createRundownItem({
      date,
      start: item.start,
      durationMinutes: item.durationMinutes,
      agenda: item.agenda,
      pic: item.pic,
      location: item.location,
      notes: item.notes,
    }),
  );

  const rundown = createRundown(title || source.name, items);
  upsertRundown(rundown);
  return rundown;
}

export function duplicateRundown(rundownId: string): Rundown | null {
  const existing = getRundownById(rundownId);
  if (!existing) return null;

  const duplicatedItems: RundownItem[] = existing.items.map((item) =>
    createRundownItem({
      ...item,
      customFields: item.customFields.map((field: CustomField) => ({
        id: makeId(),
        key: field.key,
        value: field.value,
      })),
    }),
  );

  const copy = createRundown(`${existing.title} (Copy)`, duplicatedItems);
  upsertRundown(copy);
  return copy;
}

export function deleteRundown(rundownId: string): void {
  const next = readRundowns().filter((entry) => entry.id !== rundownId);
  writeRundowns(next);
}

