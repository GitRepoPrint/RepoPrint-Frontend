import type { Metadata } from "next";
import { SignUpCard } from "@/components/login/signup-card";

export const metadata: Metadata = { title: "Create account · RepoPrint" };

export default function SignUpPage() {
  return (
    <main className="login-main">
      <div className="login-glow" />
      <SignUpCard />
    </main>
  );
}
