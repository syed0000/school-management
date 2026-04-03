import mongoose from 'mongoose';

const ClassGroupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  classIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true }],
  // The counter key used in the Counter collection for this group
  // Stored as "classGroup_<id>" on Counter
  startFrom: { type: Number, default: 1 }, // initial sequence value (last used)
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.ClassGroup || mongoose.model('ClassGroup', ClassGroupSchema);
