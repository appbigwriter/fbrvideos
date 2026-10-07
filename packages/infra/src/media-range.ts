export interface MediaByteRange { start: number; end: number }
/** A single byte range is supported; malformed/multiple ranges yield 416 at the API boundary. */
export function parseMediaRange(header: string | undefined, bytes: number): MediaByteRange | null {
  if (!Number.isSafeInteger(bytes) || bytes < 1) throw new Error('media_range_size_invalid');
  if (header === undefined) return null;
  const match = /^bytes=(\d*)-(\d*)$/u.exec(header);
  if (!match || (!match[1] && !match[2])) throw new Error('media_range_unsatisfiable');
  let start: number, end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) throw new Error('media_range_unsatisfiable');
    start = Math.max(0, bytes - suffix); end = bytes - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Number(match[2]) : bytes - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= bytes || end < start) throw new Error('media_range_unsatisfiable');
    end = Math.min(end, bytes - 1);
  }
  return { start, end };
}
