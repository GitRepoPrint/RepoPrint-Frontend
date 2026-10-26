import type { Metadata } from "next";
import { RepositoriesView } from "@/components/repositories/repositories-view";

export const metadata: Metadata = { title: "Your repositories · RepoPrint" };

export default function RepositoriesPage() {
  return <RepositoriesView />;
}
