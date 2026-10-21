// Decode note files without silently replacing Thai characters.
export function decodeTextBytes(bytes, encoding = 'auto') {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (encoding !== 'auto') {
    return { text: new TextDecoder(encoding, { fatal: true }).decode(data), encoding };
  }
  if (data[0] === 0xff && data[1] === 0xfe) return decodeTextBytes(data, 'utf-16le');
  if (data[0] === 0xfe && data[1] === 0xff) return decodeTextBytes(data, 'utf-16be');
  try { return decodeTextBytes(data, 'utf-8'); }
  catch { return decodeTextBytes(data, 'windows-874'); }
}

export async function readTextFile(file, encoding = 'auto') {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { ...decodeTextBytes(bytes, encoding), bytes };
}
