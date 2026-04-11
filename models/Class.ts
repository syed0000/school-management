import mongoose from 'mongoose';

const ClassSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  exams: [{ type: String }], // Array of exam names like ["Annual", "Half Yearly"]
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ClassSchema.index({ isActive: 1, name: 1 });

export default mongoose.models.Class || mongoose.model('Class', ClassSchema);
