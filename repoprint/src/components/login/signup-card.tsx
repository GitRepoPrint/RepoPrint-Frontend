"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { ThemedLogo } from "@/components/ui/themed-logo";
import { useAuth } from "@/lib/auth/auth-provider";
import { nextPathFromLocation } from "@/lib/auth/redirect";
import { validateSignUp } from "@/lib/auth/validation";
import type { SignUpErrors, SignUpField, SignUpValues } from "@/lib/auth/validation";
import { AuthSwitchLink } from "./auth-switch-link";
import { FIELD_ERROR_CLASS } from "./form-styles";

const CHECK_TEXT = "text-sm leading-relaxed text-[#999bab] [.theme-light_&]:text-[#6f7586]";
const CHECK_LINK = "font-semibold underline underline-offset-2 text-[#b5a0ff] [.theme-light_&]:text-[#7559c9]";

type AgreementProps = {
  checked: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  children: ReactNode;
};

/** Caixa de consentimento obrigatória (termos, privacidade) com a mensagem de erro por baixo. */
function Agreement({ checked, onChange, error, children }: AgreementProps) {
  return (
    <div>
      <label className={`flex items-start gap-2.5 ${CHECK_TEXT}`}>
        <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[#7559c9]" checked={checked} onChange={onChange} aria-invalid={Boolean(error)} />
        <span>{children}</span>
      </label>
      {error && <p role="alert" className="ml-[26px] mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

const INITIAL: SignUpValues = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  acceptTerms: false,
  acceptPrivacy: false,
};

export function SignUpCard() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [values, setValues] = useState<SignUpValues>(INITIAL);
  const [errors, setErrors] = useState<SignUpErrors>({});

  function change<K extends SignUpField>(field: K, value: SignUpValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }
  const onText = (field: SignUpField) => (event: ChangeEvent<HTMLInputElement>) => change(field, event.target.value);
  const onCheck = (field: "acceptTerms" | "acceptPrivacy") => (event: ChangeEvent<HTMLInputElement>) =>
    change(field, event.target.checked);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateSignUp(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // Mock: "cria" a conta e entra logo. O username e o email não são guardados em lado nenhum.
    signIn("RepoPrint");
    setValues((current) => ({ ...current, password: "", confirmPassword: "" }));
    router.push(nextPathFromLocation());
  }

  const field = (id: SignUpField, label: string, type: string, placeholder: string, autoComplete: string) => (
    <>
      <label htmlFor={`signup-${id}`}>{label}</label>
      <input
        id={`signup-${id}`}
        type={type}
        placeholder={placeholder}
        value={values[id] as string}
        onChange={onText(id)}
        autoComplete={autoComplete}
        aria-invalid={Boolean(errors[id])}
        aria-describedby={errors[id] ? `signup-${id}-error` : undefined}
      />
      {errors[id] && <p id={`signup-${id}-error`} role="alert" className={FIELD_ERROR_CLASS}>{errors[id]}</p>}
    </>
  );

  return (
    <div className="login-card">
      <ThemedLogo className="login-logo" />
      <h1>Start mapping<br /><span>your threats.</span></h1>
      <p>Create an account to save analyses, audit private repositories, and track risk over time.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-7">
        <div className="site-login-form">
          {field("username", "Username", "text", "your-username", "username")}
          {field("email", "Email address", "email", "you@company.com", "email")}
          {field("password", "Password", "password", `At least 8 characters`, "new-password")}
          {field("confirmPassword", "Confirm password", "password", "Repeat your password", "new-password")}
        </div>

        {/* Fora do .site-login-form: o CSS do mockup dá 100% de largura e 45px de altura a todos os inputs lá dentro. */}
        <div role="group" aria-label="Agreements" className="mb-5 mt-1 flex flex-col gap-3 text-left">
          <Agreement checked={values.acceptTerms} onChange={onCheck("acceptTerms")} error={errors.acceptTerms}>
            I agree to the <Link href="/terms" target="_blank" rel="noopener" className={CHECK_LINK}>Terms of Service</Link>.
          </Agreement>
          <Agreement checked={values.acceptPrivacy} onChange={onCheck("acceptPrivacy")} error={errors.acceptPrivacy}>
            I have read the <Link href="/privacy" target="_blank" rel="noopener" className={CHECK_LINK}>Privacy Policy</Link> and consent to the processing of my personal data under the GDPR.
          </Agreement>
        </div>

        <button type="submit" className="button button-primary h-[45px]! w-full text-sm!">
          Create account <Icon name="arrowRight" size={17} />
        </button>
      </form>

      <AuthSwitchLink to="/login" prompt="Already have an account?" label="Sign in" />
    </div>
  );
}
