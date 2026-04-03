"use server"

import dbConnect from "@/lib/db";
import WhatsAppStat from "@/models/WhatsAppStat";
import WhatsAppPayment from "@/models/WhatsAppPayment";

export async function getWhatsAppHistory(page: number = 1, limit: number = 20) {
  await dbConnect();
  const skip = (page - 1) * limit;
  
  const [historyDoc, totalCount] = await Promise.all([
    WhatsAppStat.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    WhatsAppStat.countDocuments({})
  ]);

  const history = JSON.parse(JSON.stringify(historyDoc));
  return {
    history,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page
  };
}

export async function getWhatsAppSummary() {
  await dbConnect();

  const totalCostResult = await WhatsAppStat.aggregate([
    { $match: { status: { $in: ['success', 'partial'] } } },
    { $group: { _id: null, totalCost: { $sum: "$cost" } } },
  ]);

  const totalPaidResult = await WhatsAppPayment.aggregate([
    { $group: { _id: null, totalPaid: { $sum: "$amount" } } },
  ]);

  const totalCost = totalCostResult[0]?.totalCost || 0;
  const totalPaid = totalPaidResult[0]?.totalPaid || 0;
  const balance = totalPaid - totalCost;

  return {
    totalCost,
    totalPaid,
    balance,
  };
}
