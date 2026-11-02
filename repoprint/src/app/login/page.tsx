import type { Metadata } from "next";
import { LoginCard } from "@/components/login/login-card";

export const metadata: Metadata = { title: "Sign in · RepoPrint" };

export default function LoginPage() {
  return (
    <main className="login-main">
      <div className="login-glow" />
      <LoginCard />
    </main>
  );
}
