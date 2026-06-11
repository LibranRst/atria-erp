import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";

export default function Home(): React.JSX.Element {
  return (
    <section className="flex min-h-[calc(100dvh-7rem)] flex-col justify-between gap-8">
      <div className="space-y-6">
        <Card className="rounded-3xl p-5 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
              Atria ERP
            </p>
            <CardTitle className="pt-4 text-3xl">
              Finance-first control room for interior projects.
            </CardTitle>
            <CardDescription>
              Pantau proyek, ledger kas, dan pengeluaran lapangan dari satu shell seluler yang siap dipakai Project Manager di lapangan.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge status="APPROVED">Shell Ready</Badge>
            <Badge status="PENDING">UI Foundation</Badge>
          </CardContent>
        </Card>

        <div className="grid gap-3">
          <Card variant="elevated">
            <CardHeader>
              <p className="text-xs font-medium text-muted">Primary workflow</p>
              <CardTitle className="text-base">
                Projects → Ledger → Add Expense → Profile
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <p className="text-xs font-medium text-muted">Design foundation</p>
              <CardTitle className="text-base">
                iOS 26 Solid tokens, 48px touch targets, and sticky thumb navigation.
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      <p className="pb-2 text-center text-xs leading-5 text-muted">
        Gunakan navigasi bawah untuk berpindah ke modul utama Atria ERP.
      </p>
    </section>
  );
}
