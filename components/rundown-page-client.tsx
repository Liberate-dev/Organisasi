"use client";

import Link from "next/link";
import { useState } from "react";

import { RundownEditor } from "@/components/rundown-editor";
import { getRundownById } from "@/lib/storage";
import { Rundown } from "@/lib/types";

type RundownPageClientProps = {
  id: string;
};

export function RundownPageClient({ id }: RundownPageClientProps) {
  const [rundown] = useState<Rundown | null>(() => getRundownById(id));

  if (!rundown) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-card">
          <h1 className="text-xl font-semibold text-ink">Rundown tidak ditemukan</h1>
          <p className="mt-2 text-sm text-slate-600">
            Data mungkin sudah dihapus dari local storage browser ini.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return <RundownEditor initialRundown={rundown} />;
}
