import type { Metadata } from "next";
import { LoginCard } from "@/components/login/login-card";

export const metadata: Metadata = { title: "Sign in · RepoPrint" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error }= await searchParams;
  return (
    <main className="login-main">
      <div className="login-glow" />
      <LoginCard error={error} />
    </main>
  );
}
