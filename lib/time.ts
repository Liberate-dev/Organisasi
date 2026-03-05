import { RundownItem } from "@/lib/types";

export function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (normalized % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function calculateEndTime(start: string, durationMinutes: number): string {
  const parsed = parseTimeToMinutes(start);
  if (parsed === null || durationMinutes <= 0) return "";
  return minutesToTime(parsed + durationMinutes);
}

export function findOverlapItemIds(items: RundownItem[]): Set<string> {
  const overlaps = new Set<string>();
  const grouped: Record<string, Array<{ id: string; start: number; end: number }>> = {};

  for (const item of items) {
    const start = parseTimeToMinutes(item.start);
    if (start === null || item.durationMinutes <= 0) continue;
    const end = start + item.durationMinutes;
    grouped[item.date] ??= [];
    grouped[item.date].push({ id: item.id, start, end });
  }

  for (const date in grouped) {
    const rows = grouped[date].sort((a, b) => a.start - b.start);
    for (let i = 1; i < rows.length; i += 1) {
      const prev = rows[i - 1];
      const curr = rows[i];
      if (curr.start < prev.end) {
        overlaps.add(prev.id);
        overlaps.add(curr.id);
      }
    }
  }

  return overlaps;
}

export function findChainMismatchItemIds(items: RundownItem[]): Set<string> {
  const mismatches = new Set<string>();
  const lastEndByDate = new Map<string, string>();

  for (const item of items) {
    const lastEnd = lastEndByDate.get(item.date);
    if (lastEnd && item.start !== lastEnd) {
      mismatches.add(item.id);
    }

    const end = calculateEndTime(item.start, item.durationMinutes);
    lastEndByDate.set(item.date, end || item.start);
  }

  return mismatches;
}

export function syncTimesByDate(items: RundownItem[]): RundownItem[] {
  const lastEndByDate = new Map<string, string>();

  return items.map((item) => {
    const clone = {
      ...item,
      customFields: item.customFields.map((field) => ({ ...field })),
    };

    const previousEnd = lastEndByDate.get(clone.date);
    if (previousEnd) {
      clone.start = previousEnd;
    } else if (!clone.start) {
      clone.start = "08:00";
    }

    const end = calculateEndTime(clone.start, clone.durationMinutes);
    lastEndByDate.set(clone.date, end || clone.start);
    return clone;
  });
}

