export type EntryFeeType = "admissionFees" | "registrationFees"

export function normalizeFeeType(feeType: string | null | undefined): string {
  const raw = (feeType || "").trim()
  const lower = raw.toLowerCase()

  if (lower === "admission") return "admissionFees"
  if (lower === "admissionfees") return "admissionFees"
  if (lower === "registration") return "registrationFees"
  if (lower === "registrationfees") return "registrationFees"

  return raw
}

export function normalizeEntryFeeType(feeType: string | null | undefined): EntryFeeType | null {
  const normalized = normalizeFeeType(feeType)
  if (normalized === "admissionFees" || normalized === "registrationFees") return normalized
  return null
}

