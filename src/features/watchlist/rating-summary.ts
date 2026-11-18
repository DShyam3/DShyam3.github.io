/** Personal overall ratings remain independent from this episode average. */
export function summarizeRatings(values: readonly (number | null | undefined)[]): {
  average: number | null;
  rated: number;
  total: number;
} {
  const scores = values.filter((value): value is number =>
    typeof value === 'number' && Number.isFinite(value) &&
    value >= 0.5 && value <= 10 && Number.isInteger(value * 2),
  );
  return {
    average: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 10) / 10 : null,
    rated: scores.length,
    total: values.length,
  };
}
