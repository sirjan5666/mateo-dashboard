import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { Baby } from '../models/Baby.js';
import { VaccineDose } from '../models/VaccineDose.js';
import { GrowthLog } from '../models/GrowthLog.js';
import { SkinLog } from '../models/SkinLog.js';
import { FoodLog } from '../models/FoodLog.js';
import { SleepLog } from '../models/SleepLog.js';
import { FeedLog } from '../models/FeedLog.js';
import { DiaperLog } from '../models/DiaperLog.js';
import { Allergy } from '../models/Allergy.js';
import { SymptomLog } from '../models/SymptomLog.js';
import { MedicineDoseLog } from '../models/MedicineDoseLog.js';
import { MedicineCourse } from '../models/MedicineCourse.js';
import { MilestoneAchievement } from '../models/MilestoneAchievement.js';
import { HealthRecord } from '../models/HealthRecord.js';
import { Appointment } from '../models/Appointment.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { ChatSession } from '../models/ChatSession.js';
import { EmergencyContact } from '../models/EmergencyContact.js';
import { DoctorProfile } from '../models/DoctorProfile.js';
import { Consultation } from '../models/Consultation.js';
import { ConsultationMessage } from '../models/ConsultationMessage.js';
import { Prescription } from '../models/Prescription.js';
import { DoctorReview } from '../models/DoctorReview.js';
import { CommunityPost } from '../models/CommunityPost.js';
import { CommunityReply } from '../models/CommunityReply.js';
import { Patient } from '../models/Patient.js';
import { PatientRecord } from '../models/PatientRecord.js';
import { Encounter } from '../models/Encounter.js';
import { DoctorAppointment } from '../models/DoctorAppointment.js';
import { DoctorPrescription } from '../models/DoctorPrescription.js';
import { CareMessage } from '../models/CareMessage.js';
import { SpecialtyTemplate } from '../models/SpecialtyTemplate.js';
import { ConsentRecord } from '../models/ConsentRecord.js';
import { User } from '../models/User.js';
import { uploadsDir } from '../middleware/upload.js';

// Permanently delete a user and ALL their data (babies + every tracker, chats,
// consultations, prescriptions, profile, uploaded images). Used by both the
// DPDP self-erasure (DELETE /api/account) and admin user-delete.
export async function eraseUserData(userId: string): Promise<void> {
  const babies = await Baby.find({ userId });
  const babyIds = babies.map((b) => b._id);

  // Unlink skin photos from disk before dropping the records.
  const skinLogs = await SkinLog.find({ babyId: { $in: babyIds } });
  await Promise.all(
    skinLogs.filter((l) => l.photoFile).map((l) => unlink(path.join(uploadsDir, l.photoFile!)).catch(() => {})),
  );

  await Promise.all([
    VaccineDose.deleteMany({ babyId: { $in: babyIds } }),
    GrowthLog.deleteMany({ babyId: { $in: babyIds } }),
    SkinLog.deleteMany({ babyId: { $in: babyIds } }),
    FoodLog.deleteMany({ babyId: { $in: babyIds } }),
    SleepLog.deleteMany({ babyId: { $in: babyIds } }),
    FeedLog.deleteMany({ babyId: { $in: babyIds } }),
    DiaperLog.deleteMany({ babyId: { $in: babyIds } }),
    Allergy.deleteMany({ babyId: { $in: babyIds } }),
    SymptomLog.deleteMany({ babyId: { $in: babyIds } }),
    MedicineDoseLog.deleteMany({ babyId: { $in: babyIds } }),
    MedicineCourse.deleteMany({ babyId: { $in: babyIds } }),
    MilestoneAchievement.deleteMany({ babyId: { $in: babyIds } }),
    HealthRecord.deleteMany({ babyId: { $in: babyIds } }),
    Appointment.deleteMany({ babyId: { $in: babyIds } }),
    ChatMessage.deleteMany({ babyId: { $in: babyIds } }),
    ChatSession.deleteMany({ babyId: { $in: babyIds } }),
  ]);
  await Baby.deleteMany({ userId });
  await EmergencyContact.deleteMany({ userId });
  await DoctorProfile.deleteOne({ userId });

  // Consultations the user is part of (parent or doctor) + their chat + Rx.
  const myConsults = await Consultation.find({ $or: [{ parentUserId: userId }, { doctorUserId: userId }] }).select('_id');
  const consultIds = myConsults.map((c) => c._id);
  const chatMsgs = await ConsultationMessage.find({ consultationId: { $in: consultIds } });
  await Promise.all(
    chatMsgs.filter((m) => m.imageFile).map((m) => unlink(path.join(uploadsDir, m.imageFile!)).catch(() => {})),
  );
  await ConsultationMessage.deleteMany({ consultationId: { $in: consultIds } });
  await Prescription.deleteMany({ $or: [{ parentUserId: userId }, { doctorUserId: userId }] });
  await DoctorReview.deleteMany({ $or: [{ parentUserId: userId }, { doctorUserId: userId }] });
  await Consultation.deleteMany({ _id: { $in: consultIds } });

  // Community: drop the user's posts (+ their replies) and their replies.
  const myPosts = await CommunityPost.find({ authorUserId: userId }).select('_id');
  await CommunityReply.deleteMany({ postId: { $in: myPosts.map((p) => p._id) } });
  await CommunityPost.deleteMany({ authorUserId: userId });
  await CommunityReply.deleteMany({ authorUserId: userId });

  // Doctor EHR domain (doctor-owned PHI). If this user is a doctor, erase the
  // patients, their records, their consent history, and the templates they own.
  await Promise.all([
    PatientRecord.deleteMany({ doctorUserId: userId }),
    Encounter.deleteMany({ doctorUserId: userId }),
    DoctorAppointment.deleteMany({ doctorUserId: userId }),
    DoctorPrescription.deleteMany({ doctorUserId: userId }),
    CareMessage.deleteMany({ doctorUserId: userId }),
    ConsentRecord.deleteMany({ doctorUserId: userId }),
  ]);
  await Patient.deleteMany({ doctorUserId: userId });
  await SpecialtyTemplate.deleteMany({ ownerUserId: userId });
  // If this user is a portal patient, UNLINK them from any doctor's record rather
  // than deleting it — the doctor remains the data fiduciary and clinical records
  // are retained under the lawful treatment basis.
  // COMPLIANCE: confirm the retention basis for portal-patient erasure with legal.
  await Patient.updateMany({ patientUserId: userId }, { $unset: { patientUserId: '' } });
  // Same for a doctor-invited PARENT: sever the invite-bridge provenance links
  // (the doctor's clinical Patient record itself is retained, as above).
  await Patient.updateMany({ parentUserId: userId }, { $unset: { parentUserId: '', babyId: '' } });
  // Mirror the unlink onto append-only consent history: a portal patient's
  // identifier (subjectUserId) and the metadata captured at grant time must not
  // survive their erasure. $unset preserves the grant/withdraw history (purpose,
  // status, policyVersion, timestamps) while severing the link to the erased
  // principal. (The doctorUserId-keyed deleteMany above covers the doctor case.)
  await ConsentRecord.updateMany(
    { subjectUserId: userId },
    { $unset: { subjectUserId: '', grantedIp: '', userAgent: '' } },
  );
  // NOTE: AuditLog is intentionally NOT erased — it is the accountability record
  // and holds no PHI values (only field keys + ids). COMPLIANCE: decide whether to
  // pseudonymise actorUserId on erasure.

  await User.findByIdAndDelete(userId);
}
