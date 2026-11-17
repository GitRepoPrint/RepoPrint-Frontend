import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Terms of Service · RepoPrint" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="26 October 2026"
      intro="These terms govern your use of RepoPrint, a tool that builds a security and privacy fingerprint of a Git repository."
      sections={[
        { title: "Acceptance", body: <p>By creating an account or using the instant analysis you agree to these terms. If you do not agree, do not use the service.</p> },
        { title: "The service", body: <p>RepoPrint analyses repositories you point it to and produces indicators, a data flow diagram and a list of potential STRIDE and LINDDUN findings. Results are automated, can contain false positives and false negatives, and must be validated by the repository owner.</p> },
        { title: "Your account", body: <p>You are responsible for keeping your credentials safe and for all activity under your account. You must provide accurate information when registering.</p> },
        { title: "Acceptable use", body: <p>Only analyse public repositories, or private repositories you are authorised to access. Do not use RepoPrint to probe systems you do not own or to overload the service.</p> },
        { title: "No warranty", body: <p>The service is provided as is. RepoPrint does not guarantee that a repository is secure or compliant with NIS 2, ISO/IEC 27001 or the GDPR based on the generated reports.</p> },
        { title: "Changes and termination", body: <p>We may update these terms or suspend accounts that breach them. Continued use after a change means you accept the new version.</p> },
        { title: "Contact", body: <p>Questions about these terms: contact@repoprint.example (placeholder).</p> },
      ]}
    />
  );
}
