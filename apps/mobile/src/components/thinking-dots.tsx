import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Box as View } from "@/components/ui/box";
import { motion, palette } from "@/constants/theme";

type ThinkingDotsProps = {
  color?: string;
  size?: number;
};

/** Pulsing dots shown while the agent is working — no native spinner. */
export function ThinkingDots({
  color = palette.mist as string,
  size = 6,
}: ThinkingDotsProps) {
  return (
    <View style={dotStyles.row}>
      {[0, 1, 2].map((index) => (
        <Dot color={color} index={index} key={index} size={size} />
      ))}
    </View>
  );
}

function Dot({
  color,
  index,
  size,
}: {
  color: string;
  index: number;
  size: number;
}) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withDelay(
      index * (motion.standard / 3),
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: motion.standard / 2,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0.3, {
            duration: motion.standard / 2,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
      ),
    );
    return () => {
      opacity.value = 0.3;
    };
  }, [index, opacity, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[
        dotStyles.dot,
        { backgroundColor: color, borderRadius: size / 2, height: size, width: size },
        style,
      ]}
    />
  );
}

const dotStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {},
});
