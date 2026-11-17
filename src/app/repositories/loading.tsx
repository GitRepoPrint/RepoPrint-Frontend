import { PageLoading } from "@/components/ui/page-loading";

export default function Loading() {
  return <PageLoading title="Loading your repositories" detail="Fetching the repositories saved in your account…" slowNote="Still working. The server is taking longer than usual." />;
}
