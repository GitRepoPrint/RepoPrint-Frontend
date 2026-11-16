import Link from "next/link";
import { StatusPanel } from "@/components/repositories/status-panel";

export default function RepositoryNotFound() {
  return (
    <StatusPanel
      title="Repository not found"
      message="This repository does not exist, or it is private and your GitHub account is not connected or has no access to it. Connect GitHub from the profile menu, then open the repository again."
    >
      <Link href="/repositories" className="button button-primary">Back to repositories</Link>
    </StatusPanel>
  );
}
