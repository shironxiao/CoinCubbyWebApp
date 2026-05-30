export function formatDateTime(msOrValue) {
  const ms = typeof msOrValue === 'number' ? msOrValue : new Date(msOrValue).getTime()
  if (!ms || Number.isNaN(ms) || ms < 0) return '-'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms))
}

export function formatDuration(ms) {
  const safeMs = Math.max(0, ms || 0)
  const totalSeconds = Math.floor(safeMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

export function formatMinutes(totalMinutes) {
  if (!totalMinutes) return '-'
  if (totalMinutes < 60) return `${totalMinutes}m`

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`
}
