"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Pencil, Check, X, RotateCcw, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { updateCounter, type CounterInfo } from "@/actions/school-settings"

interface CounterEditorProps {
    counters: CounterInfo[]
}

interface CounterRowState {
    editing: boolean
    inputValue: string
    loading: boolean
}

export function CounterEditor({ counters }: CounterEditorProps) {
    // per-counter edit state keyed by counter id
    const [states, setStates] = useState<Record<string, CounterRowState>>(() =>
        Object.fromEntries(
            counters.map((c) => [
                c.id,
                { editing: false, inputValue: String(c.seq), loading: false },
            ])
        )
    )

    // The "live" seq values so UI updates immediately after save
    const [liveSeqs, setLiveSeqs] = useState<Record<string, number>>(() =>
        Object.fromEntries(counters.map((c) => [c.id, c.seq]))
    )

    const setRowState = (id: string, patch: Partial<CounterRowState>) =>
        setStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))

    const handleEdit = (id: string) => {
        setRowState(id, { editing: true, inputValue: String(liveSeqs[id]) })
    }

    const handleCancel = (id: string) => {
        setRowState(id, { editing: false, inputValue: String(liveSeqs[id]) })
    }

    const handleSave = async (id: string) => {
        const raw = states[id].inputValue.trim()
        const seq = parseInt(raw, 10)

        if (isNaN(seq) || seq < 0 || !Number.isInteger(seq)) {
            toast.error("Enter a valid non-negative whole number")
            return
        }

        setRowState(id, { loading: true })
        try {
            const result = await updateCounter(id, seq)
            if (result.success) {
                setLiveSeqs((prev) => ({ ...prev, [id]: seq }))
                setRowState(id, { editing: false, loading: false, inputValue: String(seq) })
                toast.success("Counter updated successfully")
            } else {
                toast.error(result.error || "Failed to update counter")
                setRowState(id, { loading: false })
            }
        } catch {
            toast.error("Something went wrong")
            setRowState(id, { loading: false })
        }
    }

    const formatNext = (id: string, seq: number) => {
        if (id === "registrationNumber") {
            return String(seq + 1).padStart(4, "0")
        }
        return String(seq + 1)
    }

    return (
        <div className="space-y-4">
            {counters.map((counter) => {
                const row = states[counter.id]
                const currentSeq = liveSeqs[counter.id]
                const nextVal = formatNext(counter.id, currentSeq)

                return (
                    <div
                        key={counter.id}
                        className="rounded-lg border bg-muted/30 px-4 py-3.5 flex flex-col gap-3"
                    >
                        {/* Top row: label + badge */}
                        <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-sm font-medium">{counter.label}</span>
                                </div>
                                <p className="text-xs text-muted-foreground pl-5">
                                    {counter.description}
                                </p>
                            </div>
                            <Badge variant="outline" className="shrink-0 text-xs font-mono">
                                next: {nextVal}
                            </Badge>
                        </div>

                        {/* Bottom row: current seq + edit controls */}
                        <div className="flex items-center gap-2 pl-5">
                            {row.editing ? (
                                <>
                                    <div className="flex flex-col gap-0.5">
                                        <p className="text-[10px] text-muted-foreground">Current sequence (last used)</p>
                                        <Input
                                            type="number"
                                            min={0}
                                            step={1}
                                            value={row.inputValue}
                                            onChange={(e) =>
                                                setRowState(counter.id, { inputValue: e.target.value })
                                            }
                                            className="h-8 w-36 text-sm font-mono"
                                            disabled={row.loading}
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleSave(counter.id)
                                                if (e.key === "Escape") handleCancel(counter.id)
                                            }}
                                        />
                                    </div>
                                    <div className="flex gap-1 mt-4">
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="default"
                                            className="h-8 w-8"
                                            disabled={row.loading}
                                            onClick={() => handleSave(counter.id)}
                                            title="Save"
                                        >
                                            <Check className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="outline"
                                            className="h-8 w-8"
                                            disabled={row.loading}
                                            onClick={() => handleCancel(counter.id)}
                                            title="Cancel"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex flex-col gap-0.5">
                                        <p className="text-[10px] text-muted-foreground">Current sequence</p>
                                        <p className="text-xl font-mono font-semibold tracking-tight">
                                            {currentSeq}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 mt-3.5"
                                        onClick={() => handleEdit(counter.id)}
                                        title="Edit counter"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                )
            })}

            {/* Warning note */}
            <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
                <RotateCcw className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    Lowering a counter may cause number conflicts if those numbers are already in use.
                    Only increase the counter or set it to a value higher than the last issued number.
                </p>
            </div>
        </div>
    )
}
