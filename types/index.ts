export interface Parent {
  name?: string;
  aadhaarNumber?: string;
}

export interface Parents {
  father: Parent;
  mother: Parent;
}

export interface Document {
  type: string;
  image: string; // base64
  documentNumber?: string;
}

export interface Student {
  _id: string;
  id: string; // virtual getter often used
  registrationNumber: string;
  name: string;
  classId: string;
  className?: string; // populated
  section: string;
  rollNumber?: string;
  dateOfBirth: string | Date; // Date object or string depending on context (form vs db)
  gender?: "Male" | "Female" | "Other";
  parents: Parents;
  address: string;
  contacts: {
    mobile: string[];
    email: string[];
  };
  photo?: string;
  documents: Document[];
  pen?: string;
  dateOfAdmission?: string | Date;
  lastInstitution?: string;
  tcNumber?: string;
  updatedAt: string | Date;
  pushTokens?: string[];
  notificationSettings?: {
    pushEnabled: boolean;
  };

  
  // Legacy/Fallback fields for UI components that might expect flat structure
  fatherName?: string;
  fatherAadhaar?: string;
  motherName?: string;
  motherAadhaar?: string;
}

export interface Salary {
  amount: number;
  effectiveDate: string | Date;
}

export interface AssignedClass {
  classId: string;
  section: string;
  attendanceAccess: boolean; // per-class attendance marking permission
  className?: string; // populated
}

export interface Teacher {
  _id: string;
  id: string;
  name: string;
  email: string;
  phone: string;
  joiningDate: string | Date;
  photo?: string;
  pastExperience?: {
    totalExperience: number;
    experienceLetter?: string;
  };
  experienceCertificate?: string;
  aadhaar: string;
  parents?: {
    fatherName?: string;
    motherName?: string;
  };
  governmentTeacherId?: string;
  teacherId: string;
  salary: Salary;
  documents: Document[];
  assignedClasses: AssignedClass[];
  updatedAt: string | Date;
  pushTokens?: string[];
  notificationSettings?: {
    pushEnabled: boolean;
  };

}

// --- Parent Portal Types ---

export interface ParentStudentProfile {
  _id: string;
  name: string;
  registrationNumber: string;
  className: string;
  classId: string;
  section: string;
  rollNumber?: string;
  dateOfBirth: string;
  gender?: string;
  photo?: string;
  address: string;
  contacts: { mobile: string[]; email: string[] };
  parents: Parents;
  dateOfAdmission?: string;
  isActive: boolean;
  notificationSettings?: {
    pushEnabled: boolean;
  };
}


export type AttendanceStatus = 'Present' | 'Absent' | 'Holiday' | null;

export interface AttendanceCalendarEntry {
  date: string; // "yyyy-MM-dd"
  status: AttendanceStatus;
  remarks?: string;
}

export interface MonthlyFeeStatus {
  month: number; // 1-12
  year: number;
  monthName: string;
  expected: number;
  paid: number;
  due: number;
  status: 'Paid' | 'Due' | 'Partial' | 'Included in Admission/Registration';
  transactionDate?: string;
}

export interface StudentFeeOverview {
  totalExpected: number;
  totalPaid: number;
  totalDue: number;
  monthlyBreakdown: MonthlyFeeStatus[];
  otherFees: { label: string; expected: number; paid: number; due: number; transactionDate?: string }[];
}

// --- Teacher Portal Types ---

export interface TeacherClassAccess {
  classId: string;
  className: string;
  section: string;
  attendanceAccess: boolean; // per-class: can this teacher mark/edit attendance here?
  feeAccess: boolean;        // per-class: can this teacher view fee reports here?
}

