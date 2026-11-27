/**
 * The body, up to `max` bytes. `whole` says whether it all fit: an image cut
 * short is useless, a page cut short is still worth reading.
 */
export async function readCapped(
  response: Response,
  max: number,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; whole: boolean }> {
  const reader = response.body?.getReader()
  if (!reader) return { bytes: new Uint8Array(), whole: true }
  const chunks: Uint8Array[] = []
  let total = 0
  let whole = true
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (total + value.length > max) {
        chunks.push(value.subarray(0, max - total))
        total = max
        whole = false
        break
      }
      chunks.push(value)
      total += value.length
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return { bytes, whole }
}
