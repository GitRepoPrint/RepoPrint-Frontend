"use client";

import { useParams } from "next/navigation";
import { PageLoading } from "@/components/ui/page-loading";
import { repoFromSlug } from "@/lib/api/repositories";

export default function Loading() {
  const { repoId } = useParams<{ repoId: string }>();
  const name = repoFromSlug(String(repoId ?? ""));
  return <PageLoading title={name ? `Opening the diagram of ${name}` : "Opening the diagram"} detail="Getting the repository ready…" />;
}
