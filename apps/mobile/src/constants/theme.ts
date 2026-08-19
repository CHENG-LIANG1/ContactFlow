import { DynamicColorIOS, Platform, type ColorValue } from "react-native";

import type { ThemeMode } from "@/domain/preferences";

type ThemeColors = {
  void: string;
  ink: string;
  graphite: string;
  line: string;
  lineSoft: string;
  paper: string;
  smoke: string;
  mist: string;
  success: string;
  warning: string;
  danger: string;
  glow: string;
  transparent: string;
  accent: string;
  overlay: string;
};

/** Calm, low-saturation surfaces echo Grow without copying its brand. */
export const themeColors: Record<ThemeMode, ThemeColors> = {
  light: {
    void: "#F3F5F0",
    ink: "#FCFDFB",
    graphite: "#E8EDE6",
    line: "#D4DCD2",
    lineSoft: "rgba(24, 32, 25, 0.09)",
    paper: "#182019",
    smoke: "#687269",
    mist: "#465148",
    success: "#2F714D",
    warning: "#9A6820",
    danger: "#A54842",
    glow: "rgba(76, 111, 80, 0.12)",
    transparent: "rgba(243, 245, 240, 0)",
    accent: "#356D4C",
    overlay: "rgba(18, 24, 19, 0.28)",
  },
  dark: {
    void: "#0D120F",
    ink: "#151B17",
    graphite: "#1C241E",
    line: "#303A32",
    lineSoft: "rgba(239, 244, 237, 0.10)",
    paper: "#F0F4ED",
    smoke: "#929D94",
    mist: "#C3CBC3",
    success: "#A8D8B4",
    warning: "#DFC180",
    danger: "#E3A29B",
    glow: "rgba(168, 198, 167, 0.13)",
    transparent: "rgba(13, 18, 15, 0)",
    accent: "#A9CBAA",
    overlay: "rgba(3, 6, 4, 0.64)",
  },
};

function dynamic(light: string, dark: string): ColorValue {
  if (Platform.OS !== "ios") return light;
  return DynamicColorIOS({ light, dark });
}

/** Semantic colors resolve natively after Appearance.setColorScheme changes. */
export const palette = Object.fromEntries(
  (Object.keys(themeColors.light) as (keyof ThemeColors)[]).map((key) => [
    key,
    dynamic(themeColors.light[key], themeColors.dark[key]),
  ]),
) as Record<keyof ThemeColors, ColorValue>;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 32,
  hero: 48,
} as const;

export const radius = {
  sm: 12,
  md: 18,
  input: 20,
  lg: 24,
  composer: 28,
  pill: 999,
} as const;

/** A compact mobile scale prevents one-off type and icon sizes from drifting. */
export const typeScale = {
  caption: 12,
  label: 14,
  body: 16,
  subheading: 18,
  heading: 20,
} as const;

export const iconSize = {
  tiny: 12,
  small: 16,
  medium: 20,
  large: 24,
} as const;

/** Shared motion timing keeps drawers, menus, navigation, and reveals coherent. */
export const motion = {
  fast: 180,
  standard: 240,
  emphasized: 300,
  stagger: 28,
} as const;

/** One humanist family keeps Chinese fallback and Latin text visually aligned. */
export const fonts = {
  display: "AvenirNext-DemiBold",
  body: "AvenirNext-Regular",
  bodyMedium: "AvenirNext-Medium",
  utility: "AvenirNext-Medium",
} as const;
