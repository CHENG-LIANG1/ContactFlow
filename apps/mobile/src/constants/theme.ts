import { DynamicColorIOS, Platform, type ColorValue } from "react-native";

import type { ThemeMode } from "@/domain/preferences";

type ThemeColors = {
  void: string;
  ink: string;
  graphite: string;
  line: string;
  lineSoft: string;
  lineFaint: string;
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

/** Calm surfaces with a Vue-green brand accent (#42B883 / #42D392). */
export const themeColors: Record<ThemeMode, ThemeColors> = {
  light: {
    void: "#F3F5F0",
    ink: "#FCFDFB",
    graphite: "#E8EDE6",
    line: "#D4DCD2",
    lineSoft: "rgba(24, 32, 25, 0.08)",
    lineFaint: "rgba(24, 32, 25, 0.05)",
    paper: "#182019",
    smoke: "#687269",
    mist: "#465148",
    success: "#2FA36B",
    warning: "#9A6820",
    danger: "#A54842",
    glow: "rgba(66, 184, 131, 0.12)",
    transparent: "rgba(243, 245, 240, 0)",
    accent: "#42B883",
    overlay: "rgba(18, 24, 19, 0.28)",
  },
  dark: {
    void: "#0E1210",
    ink: "#161B18",
    graphite: "#1F2622",
    line: "rgba(235, 244, 238, 0.14)",
    lineSoft: "rgba(235, 244, 238, 0.08)",
    lineFaint: "rgba(235, 244, 238, 0.045)",
    paper: "#EDF3EE",
    smoke: "#8B968D",
    mist: "#BCC7BE",
    success: "#42D392",
    warning: "#DFC180",
    danger: "#E3A29B",
    glow: "rgba(66, 211, 146, 0.14)",
    transparent: "rgba(14, 18, 16, 0)",
    accent: "#42D392",
    overlay: "rgba(3, 6, 4, 0.6)",
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

export type HueName = "green" | "blue" | "violet" | "orange" | "teal" | "rose";

const hueColors: Record<HueName, { light: string; dark: string }> = {
  green: { light: "#35A174", dark: "#42D392" },
  blue: { light: "#3B82C4", dark: "#7FB5EC" },
  violet: { light: "#7C66C7", dark: "#A89BE8" },
  orange: { light: "#C77B36", dark: "#E8A866" },
  teal: { light: "#2E9C9C", dark: "#63CFCF" },
  rose: { light: "#C25E7A", dark: "#E895AD" },
};

/** Decorative hues for settings icons; soft tile backgrounds track the theme. */
export const hues = Object.fromEntries(
  (Object.entries(hueColors) as [HueName, { light: string; dark: string }][]).map(
    ([name, value]) => [
      name,
      {
        foreground: dynamic(value.light, value.dark),
        background: dynamic(`${value.light}1F`, `${value.dark}33`),
      },
    ],
  ),
) as Record<HueName, { foreground: ColorValue; background: ColorValue }>;

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
