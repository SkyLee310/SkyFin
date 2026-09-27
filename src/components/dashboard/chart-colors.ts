// Categorical slots in fixed order (never cycled): a donut shows at most 7 categories and folds
// the rest into "Other". The values are the --chart-* tokens in globals.css, so the charts follow
// light and dark mode with the rest of the app.
export const SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
] as const;
export const OTHER = "var(--chart-other)";
