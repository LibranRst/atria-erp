import { StyleSheet } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

/** Keep RN placement outside the native label, which owns visual composition. */
export function splitRowActionStyle(style: StyleProp<ViewStyle>): {
  readonly placement: ViewStyle;
  readonly content: ViewStyle;
} {
  const {
    flex,
    flexBasis,
    flexGrow,
    flexShrink,
    alignSelf,
    margin,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    marginHorizontal,
    marginVertical,
    marginStart,
    marginEnd,
    position,
    top,
    bottom,
    left,
    right,
    start,
    end,
    width,
    maxWidth,
    minWidth,
    ...content
  } = StyleSheet.flatten(style) ?? {};
  return {
    placement: {
      flex,
      flexBasis,
      flexGrow,
      flexShrink,
      alignSelf,
      margin,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      marginHorizontal,
      marginVertical,
      marginStart,
      marginEnd,
      position,
      top,
      bottom,
      left,
      right,
      start,
      end,
      width,
      maxWidth,
      minWidth,
    },
    content,
  };
}
