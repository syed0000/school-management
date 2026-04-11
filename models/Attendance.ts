import mongoose from 'mongoose';

const AttendanceSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  section: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
  records: [{
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    status: { 
      type: String, 
      enum: ['Present', 'Absent', 'Holiday'], 
      default: 'Present' 
    },
    remarks: { type: String }
  }],
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isHoliday: { type: Boolean, default: false },
  holidayReason: { type: String },
}, { timestamps: true });

// Compound unique index to prevent duplicate entries for same class/section/date
AttendanceSchema.index({ date: 1, classId: 1, section: 1 }, { unique: true });
AttendanceSchema.index({ date: 1 });
AttendanceSchema.index({ classId: 1, section: 1, date: 1 });
AttendanceSchema.index({ "records.studentId": 1, date: 1 });

export default mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);
