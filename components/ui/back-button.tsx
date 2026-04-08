"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { useI18n } from "@/components/i18n-provider"

export function BackButton() {
  const router = useRouter()
  const { t } = useI18n()

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 mb-4"
      onClick={() => router.back()}
    >
      <ArrowLeft className="h-4 w-4" />
      {t("common.back", "Back")}
    </Button>
  )
}
