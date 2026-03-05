import { calculateEndTime } from "@/lib/time";
import { Rundown, RundownItem } from "@/lib/types";

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/** Group items by date */
function groupByDate(items: RundownItem[]): Map<string, RundownItem[]> {
  const map = new Map<string, RundownItem[]>();
  for (const item of items) {
    const key = item.date;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}

/** Build HTML rows for one date group */
function buildRows(items: RundownItem[]): string {
  return items
    .map((item, idx) => {
      const end = calculateEndTime(item.start, item.durationMinutes);
      const customFields = item.customFields
        .filter((f) => f.key || f.value)
        .map((f) => `<span class="cf-label">${esc(f.key)}</span> ${esc(f.value)}`)
        .join("<br>");

      const rowClass = idx % 2 === 0 ? "even" : "odd";
      return `
        <tr class="${rowClass}">
          <td class="col-time">${esc(item.start)}</td>
          <td class="col-end">${esc(end || "--:--")}</td>
          <td class="col-dur">${esc(String(item.durationMinutes))} min</td>
          <td class="col-agenda">${esc(item.agenda)}</td>
          <td class="col-pic">${esc(item.pic)}</td>
          <td class="col-loc">${esc(item.location)}</td>
          <td class="col-notes">${esc(item.notes)}${customFields ? `<br><div class="custom-fields">${customFields}</div>` : ""}</td>
        </tr>`;
    })
    .join("\n");
}

/** Build full HTML document */
function buildHtmlDocument(rundown: Rundown): string {
  const grouped = groupByDate(rundown.items);
  const now = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const sections = [...grouped.entries()]
    .map(([date, items]) => {
      const dateLabel = formatDate(date);
      const rows = buildRows(items);
      const totalDur = items.reduce((s, i) => s + i.durationMinutes, 0);
      const hours = Math.floor(totalDur / 60);
      const mins = totalDur % 60;
      const durLabel = hours > 0 ? `${hours} jam ${mins > 0 ? mins + " menit" : ""}` : `${mins} menit`;

      return `
        <div class="date-section">
          <div class="date-header">
            <span class="date-icon">📅</span>
            <div>
              <div class="date-label">${esc(dateLabel)}</div>
              <div class="date-meta">${items.length} sesi &bull; Total durasi: ${durLabel}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th class="col-time">Mulai</th>
                <th class="col-end">Selesai</th>
                <th class="col-dur">Durasi</th>
                <th class="col-agenda">Agenda</th>
                <th class="col-pic">PIC</th>
                <th class="col-loc">Lokasi</th>
                <th class="col-notes">Catatan</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    })
    .join("\n");

  const totalItems = rundown.items.length;
  const totalDays = grouped.size;

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(rundown.title)} — Rundown</title>
  <style>
    /* ── Page setup ─────────────────────────────── */
    @page {
      size: A4 portrait;
      margin: 14mm 12mm 14mm 12mm;
    }

    @media print {
      .no-print { display: none !important; }
      .date-section { page-break-inside: avoid; }
      body { font-size: 10.5px; }
    }

    /* ── Base ───────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; }

    body {
      font-family: "Segoe UI", "Trebuchet MS", "Arial", sans-serif;
      color: #1a2535;
      margin: 0;
      padding: 0;
      background: #fff;
      font-size: 11px;
      line-height: 1.45;
    }

    /* ── Header ─────────────────────────────────── */
    .doc-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 3px solid #4f46e5;
      padding-bottom: 10px;
      margin-bottom: 16px;
    }

    .doc-header-left {
      flex: 1;
    }

    .doc-brand {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #6366f1;
      margin-bottom: 4px;
    }

    .doc-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 4px;
      line-height: 1.2;
    }

    .doc-meta {
      font-size: 9px;
      color: #64748b;
    }

    .doc-stats {
      text-align: right;
      font-size: 8.5px;
      color: #475569;
    }

    .doc-stats strong {
      display: block;
      font-size: 18px;
      font-weight: 800;
      color: #4f46e5;
      line-height: 1;
    }

    /* ── Date section ───────────────────────────── */
    .date-section {
      margin-bottom: 18px;
    }

    .date-header {
      display: flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #eef2ff, #f8faff);
      border-left: 4px solid #6366f1;
      border-radius: 0 6px 6px 0;
      padding: 7px 10px;
      margin-bottom: 6px;
    }

    .date-icon { font-size: 14px; }

    .date-label {
      font-weight: 700;
      font-size: 11.5px;
      color: #1e1b4b;
    }

    .date-meta {
      font-size: 9px;
      color: #6366f1;
      margin-top: 1px;
    }

    /* ── Table ──────────────────────────────────── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
    }

    thead tr {
      background: #1e1b4b;
      color: #fff;
    }

    th, td {
      vertical-align: top;
      padding: 5px 6px;
      border: 1px solid #e2e8f0;
      text-align: left;
    }

    th {
      font-weight: 600;
      font-size: 8.5px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    tr.even td { background: #fff; }
    tr.odd td  { background: #f8faff; }

    tr:last-child td {
      border-bottom: 2px solid #6366f1;
    }

    /* Column widths */
    .col-time   { width: 44px; font-family: "Courier New", monospace; font-weight: 600; color: #1e1b4b; }
    .col-end    { width: 44px; font-family: "Courier New", monospace; color: #475569; }
    .col-dur    { width: 46px; color: #64748b; }
    .col-agenda { width: auto; font-weight: 600; color: #0f172a; }
    .col-pic    { width: 90px; color: #475569; }
    .col-loc    { width: 80px; color: #475569; font-style: italic; }
    .col-notes  { width: 120px; color: #374151; }

    /* Custom fields */
    .custom-fields {
      margin-top: 3px;
      padding-top: 3px;
      border-top: 1px dashed #cbd5e1;
      font-size: 8.5px;
    }
    .cf-label {
      font-weight: 600;
      color: #6366f1;
    }

    /* ── Footer ─────────────────────────────────── */
    .doc-footer {
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 8px;
      color: #94a3b8;
    }

    /* ── Print button ───────────────────────────── */
    .print-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #4f46e5;
      color: #fff;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 999;
      font-family: "Segoe UI", sans-serif;
      font-size: 13px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }

    .print-bar button {
      background: #fff;
      color: #4f46e5;
      border: none;
      border-radius: 8px;
      padding: 7px 18px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }

    .print-bar button:hover { background: #e0e7ff; }

    @media screen {
      body { padding-top: 52px; max-width: 900px; margin: 0 auto; padding: 72px 32px 32px; }
    }
  </style>
</head>
<body>

  <!-- Print bar (only on screen) -->
  <div class="print-bar no-print">
    <span>📄 Preview Rundown — ${esc(rundown.title)}</span>
    <div style="display:flex;gap:8px">
      <button onclick="window.print()">🖨️ Print / Save PDF</button>
      <button onclick="window.close()" style="background:#f1f5f9;color:#64748b">✕ Tutup</button>
    </div>
  </div>

  <!-- Document header -->
  <div class="doc-header">
    <div class="doc-header-left">
      <div class="doc-brand">Rundown Builder &bull; Organisasi Mahasiswa</div>
      <h1 class="doc-title">${esc(rundown.title)}</h1>
      <div class="doc-meta">Dicetak: ${esc(now)}</div>
    </div>
    <div class="doc-stats">
      <strong>${totalItems}</strong>
      sesi total<br>
      <span style="margin-top:6px;display:block">${totalDays} hari acara</span>
    </div>
  </div>

  <!-- Date sections -->
  ${sections}

  <!-- Footer -->
  <div class="doc-footer">
    <span>Rundown Builder &bull; Organisasi Mahasiswa</span>
    <span>${esc(rundown.title)}</span>
    <span>Dicetak: ${esc(now)}</span>
  </div>

</body>
</html>`;
}

/**
 * Export rundown to PDF via print dialog.
 * Uses Blob URL to avoid popup blocker.
 */
export function exportRundownToPdf(rundown: Rundown): void {
  if (typeof window === "undefined") return;

  const html = buildHtmlDocument(rundown);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  // Open in new tab (not popup — less likely to be blocked)
  const tab = window.open(url, "_blank");

  if (!tab) {
    // Fallback: create hidden iframe for printing
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(iframe);

    iframe.onload = () => {
      const iwin = iframe.contentWindow;
      if (!iwin) return;
      setTimeout(() => {
        iwin.focus();
        iwin.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }, 1000);
      }, 300);
    };

    iframe.src = url;
    return;
  }

  // Revoke blob URL after a delay (tab already loaded it)
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
