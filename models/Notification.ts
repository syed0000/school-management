import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  type: { type: String, enum: ['broadcast', 'class', 'teacher', 'individual'], default: 'broadcast' },
  targetClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  targetTeachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }],
  targetStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  targetUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // For specific individuals if needed
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sentAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
  metadata: { type: Map, of: String }
}, { timestamps: true });

export default mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
