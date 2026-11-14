"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { ThemedLogo } from "@/components/ui/themed-logo";
import { postAuth } from "@/lib/auth/auth-client";
import { nextPathFromLocation } from "@/lib/auth/redirect";
import { validateLogin } from "@/lib/auth/validation";
import type { CredentialErrors } from "@/lib/auth/validation";
import { AuthSwitchLink } from "./auth-switch-link";
import { FIELD_ERROR_CLASS } from "./form-styles";

const ERROR_MESSAGES: Record<string, string> = {
  failed: "Sign in failed. Please try again.",
  expired: "Your session expired. Sign in again to continue.",
};

const SUBMIT_ERRORS: Record<string, string> = {
  invalid: "Incorrect email/username or password.\nAfter five failed attempts, sign in is blocked for a few minutes.",
  rate_limited: "Too many sign in attempts. Wait a minute and try again.",
  forbidden: "Sign in failed. Reload the page and try again.",
  unavailable: "Sign in is unavailable right now. Please try again.",
};

export function LoginCard({ error }: { error?: string }) {
  const [identifier, setIdentifier]= useState("");
  const [password, setPassword]= useState("");
  const [errors, setErrors]= useState<CredentialErrors>({});
  const [formError, setFormError]= useState<string | undefined>(error ? ERROR_MESSAGES[error] : undefined);
  const [submitting, setSubmitting]= useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found= validateLogin(identifier, password);
    setErrors(found);
    setFormError(undefined);
    if (found.identifier || found.password) return;

    setSubmitting(true);
    const outcome= await postAuth("/api/auth/login", { identifier, password, next: nextPathFromLocation() });
    if (outcome.ok) {
      window.location.assign(outcome.next);
      return;
    }
    setSubmitting(false);
    setPassword("");
    setFormError(SUBMIT_ERRORS[outcome.error] ?? SUBMIT_ERRORS.unavailable);
  }

  return (
    <div className="login-card">
      <ThemedLogo className="login-logo" />
      <h1>Your architecture,<br /><span>all in one place.</span></h1>
      <p>Sign in to access your repositories, security insights, and interactive threat models.</p>
      <form className="site-login-form mt-7" onSubmit={handleSubmit} noValidate>
        <label htmlFor="account-identifier">Email or username</label>
        <input
          id="account-identifier"
          type="text"
          placeholder="you@company.com"
          value={identifier}
          onChange={(event) => { setIdentifier(event.target.value); setErrors((e) => ({ ...e, identifier: undefined })); }}
          autoComplete="username"
          aria-invalid={Boolean(errors.identifier)}
          aria-describedby={errors.identifier ? "account-identifier-error" : undefined}
        />
        {errors.identifier && <p id="account-identifier-error" role="alert" className={FIELD_ERROR_CLASS}>{errors.identifier}</p>}
        <label htmlFor="account-password">Password</label>
        <input
          id="account-password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => { setPassword(event.target.value); setErrors((e) => ({ ...e, password: undefined })); }}
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "account-password-error" : undefined}
        />
        {errors.password && <p id="account-password-error" role="alert" className={FIELD_ERROR_CLASS}>{errors.password}</p>}
        {formError && <p role="alert" className="mb-3 whitespace-pre-line text-sm text-red-500 [.theme-light_&]:text-red-700">{formError}</p>}
        <button type="submit" disabled={submitting} className="button button-primary">
          {submitting ? "Signing in" : "Sign In"} <Icon name="arrowRight" size={17} />
        </button>
      </form>
      <AuthSwitchLink to="/signup" prompt="New to RepoPrint?" label="Create an account" />
    </div>
  );
}
