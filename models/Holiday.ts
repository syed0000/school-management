import mongoose from 'mongoose';

const HolidaySchema = new mongoose.Schema({
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  description: { type: String, required: true },
  affectedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  createdAt: { type: Date, default: Date.now }
});

// Force model rebuild in development to ensure schema changes (like removing hooks) are applied
if (process.env.NODE_ENV !== 'production') {
  if (mongoose.models.Holiday) {
    delete mongoose.models.Holiday;
  }
}

export default mongoose.models.Holiday || mongoose.model('Holiday', HolidaySchema);
