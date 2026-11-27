import { cleanJpeg } from './jpeg.ts'
import { assertEquals, assertJsonEquals } from '../_shared/test-assert.ts'

/** Minimal valid JPEG bytes with an optional APP1 EXIF segment and custom scan entropy bytes. */
function makeJpeg(scanBytes: number[], withExif = false): Uint8Array {
  const soi = [0xff, 0xd8]
  const exif = withExif ? [0xff, 0xe1, 0x00, 0x06, 0x45, 0x78, 0x69, 0x66] : []
  // SOF0: length=11 (0x000b), precision=8, height=16, width=16, 1 component
  const sof0 = [0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x10, 0x00, 0x10, 0x01, 0x01, 0x11, 0x00]
  // SOS: length=8 (0x0008), 1 component, selector=1, tables=0, ss=0, se=63, ah/al=0
  const sos = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]
  const eoi = [0xff, 0xd9]
  return new Uint8Array([...soi, ...exif, ...sof0, ...sos, ...scanBytes, ...eoi])
}

Deno.test('strips EXIF metadata while keeping valid scan data', () => {
  const cleaned = cleanJpeg(makeJpeg([0x12, 0xff, 0x00, 0x34], true))
  const expected = makeJpeg([0x12, 0xff, 0x00, 0x34], false)
  assertJsonEquals([...cleaned], [...expected])
})

Deno.test('accepts restart markers preceded by 0xFF fill bytes inside entropy data', () => {
  const scan = [0x11, 0xff, 0xff, 0xd0, 0x22, 0xff, 0xff, 0xff, 0xd7, 0x33]
  const input = makeJpeg(scan)
  const cleaned = cleanJpeg(input)
  assertEquals(cleaned.length, input.length)
  assertJsonEquals([...cleaned], [...input])
})

Deno.test('rejects non-JPEG input', () => {
  let threw = false
  try {
    cleanJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))
  } catch {
    threw = true
  }
  assertEquals(threw, true)
})
