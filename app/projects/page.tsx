import { Badge, Card, CardDescription, CardHeader, CardTitle } from "@/components/ui";

export default function ProjectsPage(): React.JSX.Element {
  return (
    <section className="space-y-4">
      <Badge status="DRAFT">Module Shell</Badge>
      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>
            Daftar proyek dan ringkasan budget akan ditampilkan di modul ini setelah lapisan data siap.
          </CardDescription>
        </CardHeader>
      </Card>
    </section>
  );
}
