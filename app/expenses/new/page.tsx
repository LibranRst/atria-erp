import { Badge, Card, CardDescription, CardHeader, CardTitle } from "@/components/ui";

export default function NewExpensePage(): React.JSX.Element {
  return (
    <section className="space-y-4">
      <Badge status="DRAFT">Module Shell</Badge>
      <Card>
        <CardHeader>
          <CardTitle>Add Expense</CardTitle>
          <CardDescription>
            Form pengeluaran lapangan dan OCR nota akan dibangun setelah integrasi Server Actions dan AI siap.
          </CardDescription>
        </CardHeader>
      </Card>
    </section>
  );
}
