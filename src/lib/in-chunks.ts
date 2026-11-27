/** `items` in runs of at most `size`, in order: for batching writes and `in` filters under a request's limits. */
export const inChunks = <T,>(items: readonly T[], size: number): T[][] => {
  const runs: T[][] = [];
  for (let at = 0; at < items.length; at += size) runs.push(items.slice(at, at + size));
  return runs;
};
