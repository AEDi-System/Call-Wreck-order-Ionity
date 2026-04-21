/** Ionity brand color palette */
export const IONITY_THEME = {
  background: "#0d0d14",
  nodePrimary: "#702C91",
  nodeAccent: "#FF006C",
  nodeGlow: "rgba(255, 0, 108, 0.35)",
  edgePrimary: "rgba(112, 44, 145, 0.55)",
  edgeAccent: "rgba(255, 0, 108, 0.30)",
  textPrimary: "#FFFFFF",
  textMuted: "#DDE1E4",
  particlePurple: "rgba(112, 44, 145, 0.70)",
  particleMagenta: "rgba(255, 0, 108, 0.70)",
} as const;

/** Gradient definition used for node fills and edges */
export type IonityTheme = typeof IONITY_THEME;
