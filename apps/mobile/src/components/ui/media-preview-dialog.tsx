import type { ImageProps } from "expo-image";
import { useRef } from "react";
import { Platform, ScrollView, useWindowDimensions } from "react-native";
import { DialogFrame } from "./dialog-frame";
import { LoadingImage } from "./loading-image";

export type MediaPreviewDialogProps = {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly source: ImageProps["source"];
  readonly title?: string;
  readonly returnFocusField?: string;
};
export function MediaPreviewDialog({
  visible,
  onClose,
  source,
  title = "Pratinjau bukti",
  returnFocusField,
}: MediaPreviewDialogProps): React.JSX.Element {
  const viewport = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const width = Math.min(360, viewport.width - 24) - 32;
  const height = Math.min(520, viewport.height * 0.6);
  return (
    <DialogFrame
      visible={visible}
      onClose={onClose}
      title={title}
      returnFocusField={returnFocusField}
      scroll={false}
      onShow={() => {
        if (Platform.OS === "ios")
          scroll.current?.scrollResponderZoomTo({ x: 0, y: 0, width, height, animated: false });
      }}
    >
      <ScrollView
        ref={scroll}
        style={{ height, maxHeight: height }}
        contentContainerStyle={{ width, height }}
        centerContent
        minimumZoomScale={1}
        maximumZoomScale={4}
        pinchGestureEnabled
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <LoadingImage
          source={source}
          contentFit="contain"
          accessibilityLabel={title}
          style={{ width, height }}
        />
      </ScrollView>
    </DialogFrame>
  );
}
