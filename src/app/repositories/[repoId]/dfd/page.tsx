import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CanvasLoader } from "@/components/canvas/canvas-loader";
import { LoadFailureView } from "@/components/repositories/load-failure";
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

  const load = await getRepositoryAnalysis(name, `/repositories/${repoId}/dfd`);
  if (load.status === "not-found") notFound();
  if (load.status === "failed") return <LoadFailureView failure={load.failure} />;
  const analysis = load.analysis;

  // O branch vem do dashboard (?branch=); se faltar ou não existir, usa o branch por defeito.
  const requested = (await searchParams).branch;
  const wanted = Array.isArray(requested) ? requested[0] : requested;
  const branch = wanted && analysis.branches.includes(wanted) ? wanted : analysis.defaultBranch;

  // A análise vem do servidor; o canvas em si é desenhado só no cliente (ver CanvasLoader).
  return <CanvasLoader analysis={analysis} branch={branch} />;
}
