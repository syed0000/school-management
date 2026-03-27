"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { ImagePreview } from "@/components/ui/image-preview"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface WhatsAppStat {
  _id: string;
  type: string;
  description: string;
  recipientCount: number;
  cost: number;
  status: string;
  mediaUrl?: string;
  createdAt: string;
  workerDetails?: {
    phone: string;
    status: string;
    id: string;
    error?: string;
  }[];
}

interface WhatsAppHistoryProps {
  history: WhatsAppStat[];
  summary: {
    totalCost: number;
    totalPaid: number;
    balance: number;
  };
}

export function WhatsAppHistory({ history, summary }: WhatsAppHistoryProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{summary.totalCost.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{summary.totalPaid.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className={summary.balance < 0 ? "border-red-500" : "border-green-500"}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.balance < 0 ? "text-red-500" : "text-green-500"}`}>
              ₹{summary.balance.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Message History</CardTitle>
          <CardDescription>A log of all WhatsApp messages sent from the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="max-w-[250px]">Description</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Image</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((item) => (
                <TableRow key={item._id}>
                  <TableCell>{format(new Date(item.createdAt), "dd MMM yyyy, hh:mm a")}</TableCell>
                  <TableCell><Badge variant="secondary">{item.type}</Badge></TableCell>
                  <TableCell className="max-w-[250px] wrap-break-word">{item.description}</TableCell>
                  <TableCell>{item.recipientCount}</TableCell>
                  <TableCell>₹{item.cost.toFixed(2)}</TableCell>
                  <TableCell><Badge variant={item.status === 'success' ? 'default' : 'destructive'}>{item.status}</Badge></TableCell>
                  <TableCell>
                    {item.mediaUrl && (
                      <ImagePreview src={item.mediaUrl} alt="WhatsApp Image" width={40} height={40} />
                    )}
                  </TableCell>
                  <TableCell>
                    {item.workerDetails && item.workerDetails.length > 0 && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">View Log</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Broadcast Delivery Details</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Recipient</TableHead>
                                  <TableHead>Phone</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Reason</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {item.workerDetails.map((detail, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell>{detail.id || 'Unknown'}</TableCell>
                                    <TableCell>{detail.phone}</TableCell>
                                    <TableCell><Badge variant={detail.status === 'success' ? 'default' : 'destructive'}>{detail.status}</Badge></TableCell>
                                    <TableCell className="text-sm text-red-500 max-w-[200px] wrap-break-word whitespace-pre-wrap">
                                      {(() => {
                                        if (!detail.error) return '-';
                                        try {
                                          const parsed = JSON.parse(detail.error);
                                          return JSON.stringify(parsed, null, 2);
                                        } catch {
                                          return String(detail.error);
                                        }
                                      })()}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
