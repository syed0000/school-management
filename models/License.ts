import mongoose from 'mongoose';

const LicenseSchema = new mongoose.Schema({
  key: { type: String, required: true }, // Immutable License Key
  token: { type: String }, // Signed JWT Token
  schoolId: { type: String, required: true },
  schoolName: { type: String },
  plan: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  lastVerifiedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Ensure only one license exists
// LicenseSchema.index({}, { unique: true }); 

export default mongoose.models.License || mongoose.model('License', LicenseSchema);
