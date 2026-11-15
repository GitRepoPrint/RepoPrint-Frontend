export function NotAvailableCard({ title, reason }: { title: string; reason: string }) {
  return (
    <section className="dashboard-section team-page" aria-label={title}>
      <section className="team-box" aria-labelledby="not-available-title">
        <header className="team-box-header">
          <div>
            <h3 id="not-available-title">Not available</h3>
            <p>{reason}</p>
          </div>
        </header>
      </section>
    </section>
  );
}
