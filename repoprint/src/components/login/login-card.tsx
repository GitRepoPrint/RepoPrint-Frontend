"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { ThemedLogo } from "@/components/ui/themed-logo";
import { useAuth } from "@/lib/auth/auth-provider";
import { resolveNextPath } from "@/lib/auth/redirect";
import { validateCredentials } from "@/lib/auth/validation";
import { AuthSwitchLink } from "./auth-switch-link";
import type { CredentialErrors } from "@/lib/auth/validation";

const ERROR_CLASS = "-mt-3 mb-3 text-xs text-red-500";

export function LoginCard() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<CredentialErrors>({});

  // Lido só no momento do clique (no cliente): o cartão fica no HTML inicial, sem <Suspense>.
  function destination() {
    const next = new URLSearchParams(window.location.search).get("next");
    return resolveNextPath(next, window.location.origin);
  }

  function continueWithGitHub() {
    signIn("GitHub");
    router.push(destination());
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateCredentials(email, password);
    setErrors(found);
    if (found.email || found.password) return;
    signIn("RepoPrint");
    setPassword("");
    router.push(destination());
  }

  return (
    <div className="login-card">
      <ThemedLogo className="login-logo" />
      <h1>Your architecture,<br /><span>all in one place.</span></h1>
      <p>Sign in to access your repositories, security insights, and interactive threat models.</p>
      <div className="login-providers">
        <button type="button" onClick={continueWithGitHub}>
          <Icon name="github" size={21} /> Continue with GitHub <Icon name="arrowRight" size={17} />
        </button>
      </div>
      <div className="login-separator"><span /> OR SIGN IN WITH YOUR REPOPRINT ACCOUNT <span /></div>
      <form className="site-login-form" onSubmit={handleSubmit} autoComplete="off" noValidate>
        <label htmlFor="account-email">Email address</label>
        <input
          id="account-email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => { setEmail(event.target.value); setErrors((e) => ({ ...e, email: undefined })); }}
          autoComplete="off"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "account-email-error" : undefined}
        />
        {errors.email && <p id="account-email-error" role="alert" className={ERROR_CLASS}>{errors.email}</p>}
        <label htmlFor="account-password">Password</label>
        <input
          id="account-password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => { setPassword(event.target.value); setErrors((e) => ({ ...e, password: undefined })); }}
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "account-password-error" : undefined}
        />
        {errors.password && <p id="account-password-error" role="alert" className={ERROR_CLASS}>{errors.password}</p>}
        <button type="submit" className="button button-primary">Sign In <Icon name="arrowRight" size={17} /></button>
      </form>
      <AuthSwitchLink to="/signup" prompt="New to RepoPrint?" label="Create an account" />
    </div>
  );
}
