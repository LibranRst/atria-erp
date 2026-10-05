import { WebBridgeScreen } from "@/components/shell/web-bridge-screen";

export default function MaterialsScreen(): React.JSX.Element {
  return (
    <WebBridgeScreen
      title="Material & Stok"
      description="Kebutuhan, stok, reservasi, dan pergerakan material masih dibuka di web selama porting aplikasi."
      destination="/materials"
    />
  );
}
