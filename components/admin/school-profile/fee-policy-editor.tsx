"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { updateFeePolicySettings } from "@/actions/school-settings"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Save } from "lucide-react"

interface FeePolicyEditorProps {
    initialAdmission: boolean
    initialRegistration: boolean
}

export function FeePolicyEditor({ initialAdmission, initialRegistration }: FeePolicyEditorProps) {
    const [admission, setAdmission] = useState(initialAdmission)
    const [registration, setRegistration] = useState(initialRegistration)
    const [isPending, setIsPending] = useState(false)

    const handleSave = async () => {
        setIsPending(true)
        try {
            const result = await updateFeePolicySettings(admission, registration)
            if (result.success) {
                toast.success("Fee policy settings updated successfully.")
            } else {
                toast.error(result.error || "Failed to update settings")
            }
        } catch (error) {
            console.error(error)
            toast.error("An error occurred")
        } finally {
            setIsPending(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between space-x-2">
                <div className="space-y-1">
                    <Label htmlFor="admissionFeeIncludesApril" className="font-semibold text-base">Admission Fee Includes April Month Fee</Label>
                    <p className="text-sm text-muted-foreground">
                        If enabled, collecting an Admission Fee will automatically mark the April monthly fee as paid for that student.
                    </p>
                </div>
                <Switch 
                    id="admissionFeeIncludesApril" 
                    checked={admission} 
                    onCheckedChange={setAdmission} 
                    disabled={isPending}
                />
            </div>
            
            <div className="flex items-center justify-between space-x-2">
                <div className="space-y-1">
                    <Label htmlFor="registrationFeeIncludesApril" className="font-semibold text-base">Registration Fee Includes April Month Fee</Label>
                    <p className="text-sm text-muted-foreground">
                        If enabled, collecting a Registration Fee will automatically mark the April monthly fee as paid for that student.
                    </p>
                </div>
                <Switch 
                    id="registrationFeeIncludesApril" 
                    checked={registration} 
                    onCheckedChange={setRegistration} 
                    disabled={isPending}
                />
            </div>

            <div className="flex justify-end pt-2">
                <Button 
                    onClick={handleSave} 
                    disabled={isPending || (admission === initialAdmission && registration === initialRegistration)}
                >
                    <Save className="mr-2 h-4 w-4" />
                    {isPending ? "Saving..." : "Save Settings"}
                </Button>
            </div>
        </div>
    )
}
