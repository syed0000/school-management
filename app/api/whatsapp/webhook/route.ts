import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import WhatsAppStat from "@/models/WhatsAppStat";
import WhatsAppPricing from "@/models/WhatsAppPricing";

/**
 * POST /api/whatsapp/webhook
 *
 * Receives the final broadcast result from feeease-worker after a bulk job completes.
 * Updates the corresponding WhatsAppStat record by batchId → jobId.
 * Also handles the fallback case where the worker writes directly to this DB
 * (in that case, no webhook fires — this endpoint is only for the HTTP delivery path).
 */
export async function POST(req: NextRequest) {
  try {
    // ── Auth: validate shared worker secret ──────────────────────────────────
    const incomingSecret = req.headers.get("x-worker-secret");
    const expectedSecret = process.env.WORKER_WEBHOOK_SECRET;

    if (!expectedSecret || incomingSecret !== expectedSecret) {
      console.warn("[whatsapp/webhook] Unauthorised call — secret mismatch");
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const body = await req.json();
    const jobId = body.jobId;
    const summary = body.result || {};
    const total = summary.total || 0;
    const sent = summary.success || 0;
    const failed = summary.failed || 0;
    const skipped = summary.skipped || 0;
    const details = summary.results || [];

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    await dbConnect();

    // Determine final status
    const finalStatus: "success" | "partial" | "failed" =
      sent === total ? "success" : sent > 0 ? "partial" : "failed";

    const costPerMessage = await WhatsAppPricing.getCurrentPrice();
    const finalCost = sent * costPerMessage;

    // Update the WhatsAppStat record that the action created with batchId = jobId
    const updated = await WhatsAppStat.findOneAndUpdate(
      { batchId: jobId },
      {
        $set: {
          status: finalStatus,
          sentCount: sent,
          failedCount: failed,
          skippedCount: skipped ?? 0,
          cost: finalCost,
          workerDetails: details, // full per-recipient result array
          completedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!updated) {
      // Stat may have been created after job ID was allocated — allow it to be created
      console.warn(`[whatsapp/webhook] No WhatsAppStat found for batchId: ${jobId}`);
    }

    console.log(
      `[whatsapp/webhook] Job ${jobId} — status: ${finalStatus}, sent: ${sent}/${total}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[whatsapp/webhook] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
