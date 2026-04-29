import { DashboardShell } from "@/components/dashboard-shell";

const placeholderCards = [
  {
    label: "Runs",
    value: "0",
    helper: "Run storage arrives in Milestone 1.",
  },
  {
    label: "Average latency",
    value: "--",
    helper: "Waiting for backend metrics.",
  },
  {
    label: "Model coverage",
    value: "--",
    helper: "Provider adapters are intentionally deferred.",
  },
];

export default function DashboardPage() {
  return (
    <DashboardShell>
      <section className="grid gap-4 md:grid-cols-3">
        {placeholderCards.map((card) => (
          <article
            className="rounded-3xl border border-observatory-line bg-observatory-panel/80 p-5"
            key={card.label}
          >
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-observatory-muted">
              {card.label}
            </p>
            <p className="mt-5 text-4xl font-semibold tracking-tight">
              {card.value}
            </p>
            <p className="mt-3 text-sm leading-6 text-observatory-muted">
              {card.helper}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-3xl border border-observatory-line bg-observatory-panel/80 p-6">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-observatory-amber">
            Milestone 0
          </p>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight">
            Project shell initialized
          </h3>
          <p className="mt-4 text-sm leading-7 text-observatory-muted">
            This placeholder dashboard establishes the dark observability shell
            without connecting to the API, rendering charts, storing runs, or
            configuring LLM providers.
          </p>
        </div>
      </section>
    </DashboardShell>
  );
}
