export default function Home(): React.JSX.Element {
  return (
    <section className="flex min-h-[calc(100dvh-7rem)] flex-col justify-between gap-8">
      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-surface p-5 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Atria ERP
          </p>
          <div className="mt-5 space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">
              Finance-first control room for interior projects.
            </h1>
            <p className="text-sm leading-6 text-secondary">
              Pantau proyek, ledger kas, dan pengeluaran lapangan dari satu shell seluler yang siap dipakai Project Manager di lapangan.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-2xl border border-border bg-elevated p-4">
            <p className="text-xs font-medium text-muted">Primary workflow</p>
            <p className="mt-1 text-base font-semibold text-text-primary">
              Projects → Ledger → Add Expense → Profile
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-medium text-muted">Design foundation</p>
            <p className="mt-1 text-base font-semibold text-text-primary">
              iOS 26 Solid tokens, 48px touch targets, and sticky thumb navigation.
            </p>
          </div>
        </div>
      </div>

      <p className="pb-2 text-center text-xs leading-5 text-muted">
        Gunakan navigasi bawah untuk berpindah ke modul utama Atria ERP.
      </p>
    </section>
  );
}
