import { Badge, Card, CardDescription, CardHeader, CardTitle } from "@/components/ui";

export default function ProfilePage(): React.JSX.Element {
  return (
    <section className="space-y-4">
      <Badge status="DRAFT">Module Shell</Badge>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Profil pengguna, sesi, dan preferensi aplikasi akan ditampilkan setelah auth dan RBAC siap.
          </CardDescription>
        </CardHeader>
      </Card>
    </section>
  );
}
