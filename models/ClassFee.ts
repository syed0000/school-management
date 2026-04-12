import mongoose from 'mongoose';

const ClassFeeSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  type: { type: String, enum: ['monthly', 'examination', 'admissionFees', 'registrationFees'], required: true },
  amount: { type: Number, required: true },
  title: { type: String },
  month: { type: String }, // For exam month (e.g. "March")
  effectiveFrom: { type: Date, required: true },
  effectiveTo: { type: Date },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

ClassFeeSchema.index({ classId: 1, isActive: 1, type: 1, effectiveFrom: -1 })

export default mongoose.models.ClassFee || mongoose.model('ClassFee', ClassFeeSchema);
