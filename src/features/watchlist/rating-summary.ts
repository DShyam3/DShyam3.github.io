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

/** Season average across external episode scores (IMDb / TMDB, 0.1 steps in (0, 10]). */
export function summarizeExternalScores(values: readonly (number | null | undefined)[]): {
  average: number | null;
  count: number;
} {
  const scores = values.filter((v): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 10,
  );
  return {
    average: scores.length ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10 : null,
    count: scores.length,
  };
}
