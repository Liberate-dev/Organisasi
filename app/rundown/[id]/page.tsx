"use client";

import { useParams } from "next/navigation";

import { RundownPageClient } from "@/components/rundown-page-client";

export default function RundownPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  if (!id) {
    return null;
  }

  return <RundownPageClient id={id} />;
}
