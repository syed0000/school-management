import mongoose from 'mongoose';

const TeacherSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  joiningDate: { type: Date, required: true },
  
  // Refactored to match Student model structure
  photo: { type: String }, // Path to local file or URL
  documents: [{
    type: { type: String }, // e.g., PAN, Aadhaar, Experience Certificate
    image: { type: String }, // Path to local file or URL
    documentNumber: { type: String }
  }],

  pastExperience: {
    totalExperience: { type: Number },
    experienceLetter: { type: String }, // Path to local file or URL
  },

  aadhaar: { type: String, required: true },
  parents: {
    fatherName: String,
    motherName: String,
  },
  governmentTeacherId: { type: String, unique: true, sparse: true },
  teacherId: { type: String, unique: true, required: true }, // 8 chars generated
  salary: {
    amount: { type: Number, required: true },
    effectiveDate: { type: Date, default: Date.now },
  },

  // Portal access: which classes/sections this teacher can view
  // attendanceAccess per entry controls whether the teacher can mark/edit attendance for that class
  assignedClasses: [{
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    section: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
    attendanceAccess: { type: Boolean, default: false },
    feeAccess: { type: Boolean, default: false },
  }],

  pushTokens: [String],
  notificationSettings: {
    pushEnabled: { type: Boolean, default: true }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

});

// Delete existing model to prevent hot-reload errors with schema changes
if (mongoose.models.Teacher) {
  delete mongoose.models.Teacher;
}

export default mongoose.model('Teacher', TeacherSchema);
