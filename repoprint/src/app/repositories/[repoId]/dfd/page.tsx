import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CanvasView } from "@/components/canvas/canvas-view";
import { getRepositoryAnalysis } from "@/lib/api/analysis";
import { repoFromSlug } from "@/lib/api/repositories";

type PageProps = {
  params: Promise<{ repoId: string }>;
  searchParams: Promise<{ branch?: string | string[] }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { repoId } = await params;
  const name = repoFromSlug(repoId);
  return { title: name ? `${name} · Data Flow Diagram · RepoPrint` : "RepoPrint" };
}

export default async function DfdCanvasPage({ params, searchParams }: PageProps) {
  const { repoId } = await params;
  const name = repoFromSlug(repoId);
  if (!name) notFound();

  const analysis = await getRepositoryAnalysis(name);

  // O branch vem do dashboard (?branch=); se faltar ou não existir, usa o branch por defeito.
  const requested = (await searchParams).branch;
  const wanted = Array.isArray(requested) ? requested[0] : requested;
  const branch = wanted && analysis.branches.includes(wanted) ? wanted : analysis.defaultBranch;

  return <CanvasView analysis={analysis} branch={branch} />;
}
