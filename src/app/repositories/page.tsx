import type { Metadata } from "next";
import { RepositoriesView } from "@/components/repositories/repositories-view";

export const metadata: Metadata = { title: "Your repositories · RepoPrint" };

export default async function RepositoriesPage({ searchParams }: { searchParams: Promise<{ github?: string }> }) {
  const { github } = await searchParams;
  return <RepositoriesView githubStatus={github} />;
}
