/** Visual tokens translate Mesh's monochrome glow into a tactile iOS product. */
export const palette = {
  void: "#090A09",
  ink: "#111210",
  graphite: "#1A1B18",
  line: "#2C2E29",
  lineSoft: "rgba(247, 246, 238, 0.11)",
  paper: "#F7F6EE",
  smoke: "#969890",
  mist: "#C9CBC3",
  success: "#CDE8D4",
  warning: "#E8D9B6",
  danger: "#E4B9B1",
  glow: "rgba(247, 246, 238, 0.22)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  hero: 48,
} as const;

export const radius = {
  sm: 12,
  md: 18,
  lg: 26,
  pill: 999,
} as const;

export const fonts = {
  display: "AvenirNextCondensed-DemiBold",
  body: "AvenirNext-Regular",
  bodyMedium: "AvenirNext-Medium",
  utility: "Menlo-Regular",
} as const;

export const accentThemes = {
  paper: { color: "#F7F6EE", label: "Paper" },
  sage: { color: "#BFE3CA", label: "Sage" },
  sky: { color: "#BFD8F2", label: "Sky" },
  amber: { color: "#E8CF9C", label: "Amber" },
} as const;
