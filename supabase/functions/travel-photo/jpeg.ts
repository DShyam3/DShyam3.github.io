/** Validate JPEG framing and remove all application/comment metadata, including EXIF/GPS. */
export function cleanJpeg(input: Uint8Array): Uint8Array {
  if (input.length < 12 || input[0] !== 0xff || input[1] !== 0xd8) throw new Error('Invalid image');
  const chunks: Uint8Array[] = [input.subarray(0, 2)];
  let at = 2;
  let frame = false;
  let scan = false;
  let ended = false;
  while (at < input.length) {
    const start = at;
    if (input[at++] !== 0xff) throw new Error('Invalid marker');
    while (input[at] === 0xff) at++;
    const marker = input[at++];
    if (marker === 0xd9) {
      chunks.push(new Uint8Array([0xff, 0xd9]));
      ended = true;
      break; // Deliberately discard any trailing payload.
    }
    if (marker === undefined || marker === 0 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) throw new Error('Invalid marker');
    if (at + 2 > input.length) throw new Error('Truncated image');
    const length = input[at] * 256 + input[at + 1];
    const end = at + length;
    if (length < 2 || end > input.length) throw new Error('Invalid segment');
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8) throw new Error('Invalid frame');
      const height = input[at + 3] * 256 + input[at + 4];
      const width = input[at + 5] * 256 + input[at + 6];
      if (height < 1 || width < 1 || height > 2400 || width > 2400) throw new Error('Invalid dimensions');
      frame = true;
    }
    if (!((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe)) chunks.push(input.subarray(start, end));
    at = end;
    if (marker === 0xda) {
      if (!frame) throw new Error('Missing frame');
      scan = true;
      const scanStart = at;
      while (at < input.length) {
        if (input[at] !== 0xff) { at++; continue; }
        const next = input[at + 1];
        if (next === 0 || (next >= 0xd0 && next <= 0xd7)) { at += 2; continue; }
        break;
      }
      chunks.push(input.subarray(scanStart, at));
    }
  }
  if (!frame || !scan || !ended) throw new Error('Incomplete image');
  const output = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}
