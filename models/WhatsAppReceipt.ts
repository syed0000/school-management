import mongoose from 'mongoose';

const WhatsAppReceiptSchema = new mongoose.Schema({
  receiptNumber: { type: String, required: true },
  studentName: { type: String, required: true },
  studentRegNo: { type: String },
  rollNumber: { type: String },
  className: { type: String },
  section: { type: String },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  feeType: { type: String },
  months: { type: String },
  year: { type: String },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 } // Expire after 30 days
});

export default mongoose.models.WhatsAppReceipt || mongoose.model('WhatsAppReceipt', WhatsAppReceiptSchema);
