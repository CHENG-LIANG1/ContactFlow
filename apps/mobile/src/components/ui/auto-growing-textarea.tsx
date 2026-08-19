import { forwardRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";

type AutoGrowingTextareaProps = Omit<
  TextInputProps,
  "multiline" | "onContentSizeChange" | "scrollEnabled"
> & {
  maxHeight?: number;
  minHeight?: number;
};

/** Grows with message content, then becomes internally scrollable at a safe cap. */
export const AutoGrowingTextarea = forwardRef<
  TextInput,
  AutoGrowingTextareaProps
>(function AutoGrowingTextarea(
  { maxHeight = 112, minHeight = 44, style, value, ...props },
  ref,
) {
  const [measuredHeight, setMeasuredHeight] = useState(minHeight);
  const height = value ? measuredHeight : minHeight;

  return (
    <View style={[styles.container, { height }]}>
      <Text
        onLayout={({ nativeEvent }) => {
          const nextHeight = Math.min(
            maxHeight,
            Math.max(minHeight, Math.ceil(nativeEvent.layout.height)),
          );
          setMeasuredHeight(nextHeight);
        }}
        pointerEvents="none"
        style={[style, styles.measureText]}
      >
        {value || " "}
      </Text>
      <TextInput
        {...props}
        multiline
        ref={ref}
        scrollEnabled={height >= maxHeight}
        style={[style, styles.input, { height }]}
        textAlignVertical="top"
        value={value}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { width: "100%", position: "relative" },
  input: { position: "absolute", inset: 0 },
  measureText: {
    position: "absolute",
    left: 0,
    right: 0,
    opacity: 0,
  },
});
