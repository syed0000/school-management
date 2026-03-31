import mongoose from 'mongoose';

const StudentSchema = new mongoose.Schema({
  registrationNumber: { type: String, required: false, unique: true },
  name: { type: String, required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  section: { type: String, enum: ['A', 'B', 'C', 'D'], default: 'A' },
  rollNumber: { type: String }, // Unique within class + section
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], default: null },
  aadhaar: { type: String, validate: {
    validator: function(v: string) {
      return !v || /^\d{12}$/.test(v);
    },
    message: 'Aadhaar number must be 12 digits'
  }},
  
  // Parent Details Restructuring
  parents: {
    father: {
      name: { type: String },
      aadhaarNumber: { type: String, validate: {
        validator: function(v: string) {
          return !v || /^\d{12}$/.test(v);
        },
        message: 'Aadhaar number must be 12 digits'
      }}
    },
    mother: {
      name: { type: String },
      aadhaarNumber: { type: String, validate: {
        validator: function(v: string) {
          return !v || /^\d{12}$/.test(v);
        },
        message: 'Aadhaar number must be 12 digits'
      }}
    }
  },

  address: { type: String, required: true },
  contacts: {
    email: [String],
    mobile: [String]
  },
  
  photo: { type: String }, // Path to local file or URL
  
  documents: [{
    type: { type: String },
    image: { type: String }, // Path to local file or URL
    documentNumber: { type: String }
  }],
  
  pen: { type: String }, // Permanent Education Number
  
  dateOfAdmission: { 
    type: Date, 
    default: Date.now,
    validate: {
      validator: function(v: Date) {
        return v <= new Date();
      },
      message: 'Date of admission cannot be in the future'
    }
  },
  lastInstitution: { type: String },
  tcNumber: { type: String },

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index for unique roll number within class and section
StudentSchema.index({ classId: 1, section: 1, rollNumber: 1 }, { unique: true, partialFilterExpression: { rollNumber: { $exists: true } } });

StudentSchema.index({ classId: 1, isActive: 1 });
StudentSchema.index({ name: 'text', 'parents.father.name': 'text', 'parents.mother.name': 'text' });

export default mongoose.models.Student || mongoose.model('Student', StudentSchema);
