"use client";
import { Alert, Button } from "@/components/ui";
export default function ErrorPage({ reset }: { readonly reset: () => void }): React.JSX.Element {
  return (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Proyek belum dapat dimuat</Alert.Title>
        <Alert.Description>
          Periksa koneksi dan coba lagi. Data proyek tidak berubah.
        </Alert.Description>
        <Button size="sm" variant="secondary" onPress={reset} className="mt-3">
          Coba lagi
        </Button>
      </Alert.Content>
    </Alert>
  );
}
