import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getRepositoryAnalysis } from "@/lib/api/analysis";
import { repoFromSlug } from "@/lib/api/repositories";

type PageProps = { params: Promise<{ repoId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { repoId } = await params;
  const name = repoFromSlug(repoId);
  return { title: name ? `${name} · RepoPrint` : "RepoPrint" };
}

export default async function RepositoryDashboardPage({ params }: PageProps) {
  const { repoId } = await params;
  const name = repoFromSlug(repoId);
  if (!name) notFound();

  const analysis = await getRepositoryAnalysis(name);
  if (!analysis) notFound();

  // Suspense: o DashboardView lê ?tab= com useSearchParams. Não acrescenta nenhum elemento ao DOM,
  // por isso o <main> e o relatório continuam a ser filhos diretos do .app-shell (o CSS de impressão depende disso).
  return (
    <Suspense fallback={null}>
      <DashboardView analysis={analysis} />
    </Suspense>
  );
}
