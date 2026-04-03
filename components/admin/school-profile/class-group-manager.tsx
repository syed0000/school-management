"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
    Plus, Trash2, Pencil, Check, X, Layers, ChevronDown, ChevronUp,
    RotateCcw, Hash, AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Alert,
    AlertDescription,
} from "@/components/ui/alert"
import {
    createClassGroup,
    updateClassGroup,
    deleteClassGroup,
    type ClassGroupInfo,
} from "@/actions/school-settings"

interface ClassGroupManagerProps {
    groups: ClassGroupInfo[]
    allClasses: { id: string; name: string }[]
}

interface GroupFormState {
    name: string
    selectedClassIds: string[]
    startFrom: string
    resetCounter: boolean
}

const defaultForm = (): GroupFormState => ({
    name: "",
    selectedClassIds: [],
    startFrom: "1",
    resetCounter: false,
})

export function ClassGroupManager({ groups: initialGroups, allClasses }: ClassGroupManagerProps) {
    const [groups, setGroups] = useState<ClassGroupInfo[]>(initialGroups)
    const [createOpen, setCreateOpen] = useState(false)
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
    const [formState, setFormState] = useState<GroupFormState>(defaultForm())
    const [isSaving, setIsSaving] = useState(false)
    const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    // Reload groups from server after mutation
    const reloadGroups = async () => {
        const { getClassGroups } = await import("@/actions/school-settings")
        const fresh = await getClassGroups()
        setGroups(fresh)
    }

    const toggleClass = (id: string) => {
        setFormState(prev => ({
            ...prev,
            selectedClassIds: prev.selectedClassIds.includes(id)
                ? prev.selectedClassIds.filter(c => c !== id)
                : [...prev.selectedClassIds, id]
        }))
    }

    // Which class IDs are already assigned to other groups (excluding editing group)
    const assignedClassIds = new Set(
        groups
            .filter(g => g.id !== editingGroupId)
            .flatMap(g => g.classIds)
    )

    const handleCreate = async () => {
        const startFromNum = parseInt(formState.startFrom, 10)
        if (isNaN(startFromNum) || startFromNum < 0) {
            toast.error("Start from must be a valid non-negative number")
            return
        }
        setIsSaving(true)
        try {
            const result = await createClassGroup(formState.name, formState.selectedClassIds, startFromNum)
            if (result.success) {
                toast.success("Class group created")
                setCreateOpen(false)
                setFormState(defaultForm())
                await reloadGroups()
            } else {
                toast.error(result.error || "Failed to create group")
            }
        } catch {
            toast.error("Something went wrong")
        } finally {
            setIsSaving(false)
        }
    }

    const handleUpdate = async () => {
        if (!editingGroupId) return
        const startFromNum = parseInt(formState.startFrom, 10)
        if (isNaN(startFromNum) || startFromNum < 0) {
            toast.error("Start from must be a valid non-negative number")
            return
        }
        setIsSaving(true)
        try {
            const result = await updateClassGroup(
                editingGroupId,
                formState.name,
                formState.selectedClassIds,
                startFromNum,
                formState.resetCounter
            )
            if (result.success) {
                toast.success("Class group updated")
                setEditingGroupId(null)
                setFormState(defaultForm())
                await reloadGroups()
            } else {
                toast.error(result.error || "Failed to update group")
            }
        } catch {
            toast.error("Something went wrong")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (groupId: string) => {
        setDeletingId(groupId)
        try {
            const result = await deleteClassGroup(groupId)
            if (result.success) {
                toast.success("Class group removed")
                await reloadGroups()
            } else {
                toast.error(result.error || "Failed to delete group")
            }
        } catch {
            toast.error("Something went wrong")
        } finally {
            setDeletingId(null)
        }
    }

    const openEdit = (group: ClassGroupInfo) => {
        setEditingGroupId(group.id)
        setFormState({
            name: group.name,
            selectedClassIds: [...group.classIds],
            startFrom: String(group.startFrom),
            resetCounter: false,
        })
    }

    const cancelEdit = () => {
        setEditingGroupId(null)
        setFormState(defaultForm())
    }

    const getClassName = (id: string) => allClasses.find(c => c.id === id)?.name ?? id

    return (
        <div className="space-y-4">
            {/* Group list */}
            {groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center rounded-lg border border-dashed">
                    <Layers className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">No class groups yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Create groups to assign separate registration number sequences to sets of classes.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {groups.map((group) => {
                        const isExpanded = expandedGroupId === group.id
                        const isEditing = editingGroupId === group.id

                        return (
                            <div key={group.id} className="rounded-lg border bg-muted/20 overflow-hidden">
                                {/* Header row */}
                                <div className="flex items-center justify-between px-4 py-3 gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Layers className="h-4 w-4 shrink-0 text-primary" />
                                        <span className="font-medium text-sm truncate">{group.name}</span>
                                        <Badge variant="secondary" className="text-xs font-mono shrink-0">
                                            next: {group.nextFormatted}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => openEdit(group)}
                                            title="Edit group"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(group.id)}
                                            disabled={deletingId === group.id}
                                            title="Delete group"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                                        >
                                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>

                                {/* Expanded class list */}
                                {isExpanded && (
                                    <div className="px-4 pb-3 pt-0 border-t">
                                        <p className="text-xs text-muted-foreground mt-2 mb-1.5">Classes in this group</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {group.classIds.map(id => (
                                                <Badge key={id} variant="outline" className="text-xs">
                                                    {getClassName(id)}
                                                </Badge>
                                            ))}
                                        </div>
                                        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Hash className="h-3 w-3" />
                                            <span>Starts from <strong>{group.startFrom}</strong> · Current seq: <strong>{group.currentSeq}</strong></span>
                                        </div>
                                    </div>
                                )}

                                {/* Edit form inline */}
                                {isEditing && (
                                    <GroupForm
                                        formState={formState}
                                        setFormState={setFormState}
                                        allClasses={allClasses}
                                        assignedClassIds={assignedClassIds}
                                        toggleClass={toggleClass}
                                        onSave={handleUpdate}
                                        onCancel={cancelEdit}
                                        isSaving={isSaving}
                                        showResetCounter
                                        title="Edit group"
                                    />
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Create dialog */}
            <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setFormState(defaultForm()) }}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Class Group
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create Class Group</DialogTitle>
                        <DialogDescription>
                            Assign a separate registration number sequence to a set of classes.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>Group Name</Label>
                            <Input
                                placeholder="e.g. Primary, Secondary"
                                value={formState.name}
                                onChange={e => setFormState(prev => ({ ...prev, name: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>Start Registration From</Label>
                            <Input
                                type="number"
                                min={0}
                                step={1}
                                placeholder="e.g. 1001"
                                value={formState.startFrom}
                                onChange={e => setFormState(prev => ({ ...prev, startFrom: e.target.value }))}
                            />
                            <p className="text-xs text-muted-foreground">
                                The first registration number issued for students in this group.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Classes</Label>
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-md border p-3">
                                {allClasses.map(cls => {
                                    const alreadyAssigned = assignedClassIds.has(cls.id)
                                    return (
                                        <div key={cls.id} className="flex items-center gap-2">
                                            <Checkbox
                                                id={`create-cls-${cls.id}`}
                                                checked={formState.selectedClassIds.includes(cls.id)}
                                                onCheckedChange={() => !alreadyAssigned && toggleClass(cls.id)}
                                                disabled={alreadyAssigned}
                                            />
                                            <Label
                                                htmlFor={`create-cls-${cls.id}`}
                                                className={`text-sm cursor-pointer ${alreadyAssigned ? "text-muted-foreground line-through" : ""}`}
                                            >
                                                {cls.name}
                                            </Label>
                                        </div>
                                    )
                                })}
                            </div>
                            {formState.selectedClassIds.length === 0 && (
                                <p className="text-xs text-destructive">Select at least one class</p>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={isSaving}>
                            {isSaving ? "Creating..." : "Create Group"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Warning note */}
            <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
                    Classes not assigned to any group will use the global registration number sequence above.
                    A class can only belong to one group at a time.
                </AlertDescription>
            </Alert>
        </div>
    )
}

// ── Shared inline form for editing ────────────────────────────────────────────

interface GroupFormProps {
    formState: GroupFormState
    setFormState: (fn: (prev: GroupFormState) => GroupFormState) => void
    allClasses: { id: string; name: string }[]
    assignedClassIds: Set<string>
    toggleClass: (id: string) => void
    onSave: () => void
    onCancel: () => void
    isSaving: boolean
    showResetCounter?: boolean
    title: string
}

function GroupForm({
    formState,
    setFormState,
    allClasses,
    assignedClassIds,
    toggleClass,
    onSave,
    onCancel,
    isSaving,
    showResetCounter,
}: GroupFormProps) {
    return (
        <div className="px-4 py-4 border-t bg-muted/10 space-y-4">
            <div className="space-y-1.5">
                <Label className="text-xs">Group Name</Label>
                <Input
                    value={formState.name}
                    onChange={e => setFormState(prev => ({ ...prev, name: e.target.value }))}
                    className="h-8 text-sm"
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs">Start Registration From</Label>
                <Input
                    type="number"
                    min={0}
                    step={1}
                    value={formState.startFrom}
                    onChange={e => setFormState(prev => ({ ...prev, startFrom: e.target.value }))}
                    className="h-8 text-sm w-36"
                />
            </div>
            {showResetCounter && (
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="reset-counter"
                        checked={formState.resetCounter}
                        onCheckedChange={(v) => setFormState(prev => ({ ...prev, resetCounter: v === true }))}
                    />
                    <Label htmlFor="reset-counter" className="text-xs cursor-pointer text-muted-foreground">
                        Reset counter to new start value
                    </Label>
                    {formState.resetCounter && (
                        <RotateCcw className="h-3 w-3 text-amber-500" />
                    )}
                </div>
            )}
            <div className="space-y-1.5">
                <Label className="text-xs">Classes</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto rounded-md border p-2">
                    {allClasses.map(cls => {
                        const alreadyAssigned = assignedClassIds.has(cls.id)
                        return (
                            <div key={cls.id} className="flex items-center gap-2">
                                <Checkbox
                                    id={`edit-cls-${cls.id}`}
                                    checked={formState.selectedClassIds.includes(cls.id)}
                                    onCheckedChange={() => !alreadyAssigned && toggleClass(cls.id)}
                                    disabled={alreadyAssigned}
                                />
                                <Label
                                    htmlFor={`edit-cls-${cls.id}`}
                                    className={`text-xs cursor-pointer ${alreadyAssigned ? "text-muted-foreground line-through" : ""}`}
                                >
                                    {cls.name}
                                </Label>
                            </div>
                        )
                    })}
                </div>
            </div>
            <div className="flex gap-2">
                <Button type="button" size="sm" onClick={onSave} disabled={isSaving}>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {isSaving ? "Saving..." : "Save"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={isSaving}>
                    <X className="h-3.5 w-3.5 mr-1" />
                    Cancel
                </Button>
            </div>
        </div>
    )
}
