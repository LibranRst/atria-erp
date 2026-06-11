import { Badge, Card, CardDescription, CardHeader, CardTitle } from "@/components/ui";

export default function LedgerPage(): React.JSX.Element {
  return (
    <section className="space-y-4">
      <Badge status="DRAFT">Module Shell</Badge>
      <Card>
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
          <CardDescription>
            Mutasi kas dan rekonsiliasi bank akan ditampilkan di modul ini setelah ledger transaksional siap.
          </CardDescription>
        </CardHeader>
      </Card>
    </section>
  );
}
