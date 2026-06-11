// Shared duration-proportional stop layout used by PaulStopTrack and ChurchTrack
export const STOP_MIN_W    = 24
export const STOP_GAP      = 2
export const STOP_MARGIN_X = 8
const SCALE = 1100

export function buildStopLayout(journey) {
  if (!journey) return { stops: [], totalWidth: 400, xFromYear: () => STOP_MARGIN_X }

  const wps = journey.waypoints
  const totalDays = wps.reduce((s, w) => s + (w.durationDays || 1), 0)
  let x = STOP_MARGIN_X
  const stops = wps.map(wp => {
    const w = Math.max(STOP_MIN_W, (wp.durationDays || 1) / totalDays * SCALE)
    const result = { wp, x, w }
    x += w + STOP_GAP
    return result
  })
  const totalWidth = stops.length > 0
    ? stops[stops.length - 1].x + stops[stops.length - 1].w + STOP_MARGIN_X
    : 400

  function xFromYear(year) {
    for (let i = 0; i < stops.length; i++) {
      const { wp, x: sx, w } = stops[i]
      const arrivalYear   = wp.year
      const durationYears = (wp.durationDays || 1) / 365
      const departureYear = arrivalYear + durationYears

      // Year falls within this stop's dwell time
      if (year >= arrivalYear && year <= departureYear) {
        const t = (year - arrivalYear) / durationYears
        return sx + t * w
      }

      // Year falls in transit before the next stop
      if (i < stops.length - 1) {
        const nextArrival = stops[i + 1].wp.year
        if (year < nextArrival) {
          const gapDur = nextArrival - departureYear
          if (gapDur <= 0) return sx + w
          const t = Math.max(0, (year - departureYear) / gapDur)
          return sx + w + t * STOP_GAP
        }
      }
    }
    // Clamp to journey bounds
    if (stops.length === 0) return STOP_MARGIN_X
    if (year < stops[0].wp.year) return stops[0].x
    const last = stops[stops.length - 1]
    return last.x + last.w
  }

  return { stops, totalWidth, xFromYear }
}
