import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

/**
 * One staff member's attendance for one day. Tenant-scoped by doctorUserId like
 * every other doctor-domain document. `date` is an IST calendar day (YYYY-MM-DD)
 * so a day is unambiguous regardless of server timezone. One record per
 * (doctor, staff, date) — marking again updates it.
 */
export const ATTENDANCE_STATUSES = ['present', 'absent', 'half_day', 'leave'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface IStaffAttendance {
  doctorUserId: Types.ObjectId; // TENANT
  staffId: Types.ObjectId; // ref StaffMember
  date: string; // YYYY-MM-DD (IST)
  status: AttendanceStatus;
  checkIn?: string; // HH:MM
  checkOut?: string; // HH:MM
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IStaffAttendance>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'StaffMember', required: true, index: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    checkIn: { type: String, match: /^\d{2}:\d{2}$/ },
    checkOut: { type: String, match: /^\d{2}:\d{2}$/ },
    note: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

// One record per staff member per day, per doctor.
schema.index({ doctorUserId: 1, staffId: 1, date: 1 }, { unique: true });
schema.index({ doctorUserId: 1, date: 1 });

export const StaffAttendance = model<IStaffAttendance>('StaffAttendance', schema);
