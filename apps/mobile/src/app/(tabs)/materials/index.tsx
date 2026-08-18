import { ProductPlaceholderScreen } from "@/components/shell/product-placeholder-screen";

export default function MaterialsScreen(): React.JSX.Element {
  return (
    <ProductPlaceholderScreen
      description="Lihat kebutuhan material bersama stok, reservasi, lokasi, dan kaitannya dengan budget Material."
      iconName="inventory_2"
      rows={["Kebutuhan proyek", "Stok tersedia", "Pergerakan material"]}
      title="Kontrol material"
    />
  );
}
