"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type AuthSwitchLinkProps = {
  to: "/login" | "/signup";
  prompt: string;
  label: string;
};

function Content({ href, prompt, label }: { href: string; prompt: string; label: string }) {
  // Dentro de um <div> para não herdar a regra `.login-card>p` do CSS do mockup.
  return (
    <div className="mt-6 text-xs text-[#898b9b] [.theme-light_&]:text-[#777e8c]">
      {prompt}{" "}
      <Link href={href} className="font-semibold text-[#b5a0ff] hover:underline [.theme-light_&]:text-[#7559c9]">
        {label}
      </Link>
    </div>
  );
}

function WithNext({ to, prompt, label }: AuthSwitchLinkProps) {
  // Mantém o ?next= ao alternar entre login e registo, para o destino original não se perder.
  const next = useSearchParams().get("next");
  const href = next ? `${to}?next=${encodeURIComponent(next)}` : to;
  return <Content href={href} prompt={prompt} label={label} />;
}

export function AuthSwitchLink(props: AuthSwitchLinkProps) {
  return (
    <Suspense fallback={<Content href={props.to} prompt={props.prompt} label={props.label} />}>
      <WithNext {...props} />
    </Suspense>
  );
}
