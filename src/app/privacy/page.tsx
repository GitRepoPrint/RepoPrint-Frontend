import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacy Policy · RepoPrint" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="26 October 2026"
      intro="This policy explains which personal data RepoPrint processes, why, and which rights you have under the GDPR."
      sections={[
        { title: "Data we process", body: <p>Account data (username, email address and authentication method), the repository URLs you analyse, and the results of those analyses when you use the authenticated platform. The instant analysis stores nothing.</p> },
        { title: "Purposes and legal basis", body: <p>We process your data to provide the service you requested (contract), to keep it secure (legitimate interest) and, for optional product updates, only with your consent.</p> },
        { title: "Repository data", body: <p>Analysis reads repository metadata and contributor information (such as names and commit counts) that is already visible in the repository. Secrets found in a commit history are reported, never stored in clear text.</p> },
        { title: "Retention", body: <p>Account data is kept while your account exists. Analysis history is kept until you delete the project or your account. Retention periods will be confirmed before launch.</p> },
        { title: "Your rights", body: <p>You can request access, rectification, erasure, restriction, portability and object to processing, and you can withdraw consent at any time. You may also lodge a complaint with your national data protection authority.</p> },
        { title: "Sharing", body: <p>We do not sell personal data. Infrastructure providers may process data on our behalf under data processing agreements.</p> },
        { title: "Contact", body: <p>Privacy requests: privacy@repoprint.example (placeholder).</p> },
      ]}
    />
  );
}
