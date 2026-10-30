/**
 * The two assertions the `_shared` Deno tests use, in one place rather than a
 * copy per file. No std import, so the tests need no network to run.
 */

/** Strict equality, for primitives. */
export function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
  }
}

/** Structural equality, by JSON serialisation (key order matters). */
export function assertJsonEquals(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`)
}
