export function coerceBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === true) return true
  if (value === false) return false
  if (typeof value === "string") {
    const v = value.trim().toLowerCase()
    if (v === "true") return true
    if (v === "false") return false
    if (v === "1") return true
    if (v === "0") return false
  }
  if (typeof value === "number") {
    if (value === 1) return true
    if (value === 0) return false
  }
  return defaultValue
}

