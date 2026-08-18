import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { palette } from "@/constants/theme";

type OrbitBackgroundProps = {
  active?: boolean;
};

/** A single orbital motif gives the product its relationship-map signature. */
export function OrbitBackground({ active = false }: OrbitBackgroundProps) {
  const [rotation] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: active ? 7000 : 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [active, rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View pointerEvents="none" style={styles.container}>
      <LinearGradient
        colors={["rgba(247,246,238,0.12)", "rgba(9,10,9,0)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.haze}
      />
      <Animated.View style={[styles.orbit, { transform: [{ rotate }] }]}>
        <Svg width="520" height="520" viewBox="0 0 520 520">
          <Circle
            cx="260"
            cy="260"
            r="206"
            fill="none"
            stroke={palette.paper}
            strokeOpacity="0.18"
            strokeWidth="1"
          />
          <Circle
            cx="260"
            cy="260"
            r="178"
            fill="none"
            stroke={palette.paper}
            strokeOpacity="0.08"
            strokeDasharray="2 10"
            strokeWidth="2"
          />
          <Circle
            cx="260"
            cy="260"
            r="142"
            fill="none"
            stroke={palette.paper}
            strokeOpacity="0.06"
            strokeWidth="1"
          />
          <Circle
            cx="98"
            cy="132"
            r="5"
            fill={palette.paper}
            fillOpacity="0.68"
          />
          <Circle
            cx="98"
            cy="132"
            r="14"
            fill={palette.paper}
            fillOpacity="0.07"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    height: 360,
    overflow: "hidden",
  },
  haze: {
    position: "absolute",
    top: -80,
    left: 0,
    right: 0,
    height: 340,
    opacity: 0.4,
  },
  orbit: {
    position: "absolute",
    top: -300,
    left: "50%",
    marginLeft: -260,
    width: 520,
    height: 520,
  },
});
