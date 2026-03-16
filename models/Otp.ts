import mongoose from 'mongoose';

const OtpSchema = new mongoose.Schema({
  phone: { type: String, required: true },
  otp: { type: String, required: true },
  role: { type: String, enum: ['teacher', 'parent'], required: true },
  refId: { type: mongoose.Schema.Types.ObjectId, required: true }, // StudentId for parent, TeacherId for teacher
  expiresAt: { type: Date, required: true },
  isUsed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// Auto-delete expired OTPs
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for lookup
OtpSchema.index({ phone: 1, otp: 1, isUsed: 1 });

export default mongoose.models.Otp || mongoose.model('Otp', OtpSchema);
