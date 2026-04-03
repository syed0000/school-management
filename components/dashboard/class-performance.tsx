"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface ClassPerformanceProps {
  data: {
    name: string
    collected: number
    pending: number
  }[]
}

export function ClassPerformance({ data }: ClassPerformanceProps) {
  return (
    <div className="rounded-md border">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-12">S.No</TableHead>
                    <TableHead>Class Name</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.map((item, index) => (
                    <TableRow key={item.name}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right text-green-600 font-medium">₹{item.collected.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-yellow-600 font-medium">₹{item.pending.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold">₹{(item.collected + item.pending).toLocaleString()}</TableCell>
                    </TableRow>
                ))}
                {data.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">No data available.</TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    </div>
  )
}
