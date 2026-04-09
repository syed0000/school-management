import mongoose from 'mongoose';

const FeeTransactionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  feeType: { type: String, enum: ['monthly', 'examination', 'admissionFees', 'registrationFees', 'other'], required: true },
  amount: { type: Number, required: true },
  month: { type: Number }, // Only for monthly fees
  year: { type: Number, required: true },
  examType: { type: String }, // E.g., "Annual" for examination fee
  status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  transactionDate: { type: Date, default: Date.now },
  receiptNumber: { type: String, required: true, unique: true },
  verifiedAt: { type: Date },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  remarks: { type: String }
});

FeeTransactionSchema.index({ studentId: 1, month: 1, year: 1 });
FeeTransactionSchema.index({ status: 1, transactionDate: -1 });
FeeTransactionSchema.index({ collectedBy: 1, transactionDate: -1 });
FeeTransactionSchema.index({ status: 1, studentId: 1 });

export default mongoose.models.FeeTransaction || mongoose.model('FeeTransaction', FeeTransactionSchema);
