/** Format epoch nanoseconds as wall-clock time: HH:MM:SS.mmm */
export function formatWallClock(ns: number): string {
  const ms = ns / 1_000_000
  const d = new Date(ms)
  const hms = d.toLocaleTimeString([], { hour12: false })
  const msStr = String(d.getMilliseconds()).padStart(3, '0')
  return `${hms}.${msStr}`
}

/** Format a nanosecond duration as a human-readable relative offset */
export function fmtRelNs(ns: number): string {
  const us = ns / 1_000
  if (us < 1_000) return `${us.toFixed(1)} µs`
  const ms = us / 1_000
  if (ms < 1_000) return `${ms.toFixed(2)} ms`
  return `${(ms / 1_000).toFixed(3)} s`
}

/** Format a nanosecond duration as µs / ms / s */
export function fmtDurNs(ns: number): string {
  return fmtRelNs(ns)
}
