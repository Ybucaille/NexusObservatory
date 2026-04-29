import type { ReactNode } from "react";
import Link from "next/link";

const navItems: Array<{ label: string; href: string }> = [
  { label: "Dashboard", href: "/" },
  { label: "Runs", href: "/runs" },
  { label: "Trace Explorer", href: "#" },
  { label: "Model Lab", href: "#" },
  { label: "Settings", href: "#" },
];

type DashboardShellProps = {
  activeItem?: string;
  badge?: string;
  children: ReactNode;
  title?: string;
};

export function DashboardShell({
  activeItem = "Dashboard",
  badge = "Runs dashboard",
  children,
  title = "Dashboard",
}: DashboardShellProps) {
  return (
    <main className="min-h-screen px-4 py-4 text-observatory-text sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-observatory-line/80 bg-observatory-ink/80 shadow-panel backdrop-blur">
        <aside className="hidden w-72 shrink-0 border-r border-observatory-line/80 bg-observatory-panel/90 p-6 lg:block">
          <div className="mb-10">
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-observatory-cyan">
              Nexus
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Observatory
            </h1>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive = item.label === activeItem;

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={[
                    "block rounded-2xl border px-4 py-3 text-sm transition",
                    isActive
                      ? "border-observatory-cyan/40 bg-observatory-cyan/10 text-white"
                      : "border-transparent text-observatory-muted hover:border-observatory-line hover:bg-white/[0.03] hover:text-observatory-text",
                  ].join(" ")}
                  href={item.href}
                  key={item.label}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-observatory-line/80 bg-observatory-panel/55 px-5 py-5 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-observatory-muted">
                  AI Observability
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {title}
                </h2>
              </div>
              <div className="rounded-full border border-observatory-line bg-observatory-panelSoft px-4 py-2 font-mono text-xs text-observatory-muted">
                {badge}
              </div>
            </div>
          </header>

          <div className="flex-1 p-5 sm:p-8">{children}</div>
        </section>
      </div>
    </main>
  );
}
