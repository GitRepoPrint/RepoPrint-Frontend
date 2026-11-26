import type { Metadata } from "next";
import { RepositoriesView } from "@/components/repositories/repositories-view";

export const metadata: Metadata = { title: "Your repositories · RepoPrint" };

export default async function RepositoriesPage({ searchParams }: { searchParams: Promise<{ github?: string; github_app?: string }> }) {
  const { github, github_app } = await searchParams;
  return <RepositoriesView githubStatus={github} githubAppStatus={github_app} />;
}
