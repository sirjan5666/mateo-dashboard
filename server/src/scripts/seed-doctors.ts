// Seed the parent-facing "Find a doctor" directory with a diverse set of demo
// doctors + ratings/reviews, so the booking panel looks realistic in dev.
//
//   npx tsx src/scripts/seed-doctors.ts          (add/refresh the demo doctors)
//   npx tsx src/scripts/seed-doctors.ts --wipe   (remove every seeded doctor + review)
//
// Everything created here is scoped to identifiable `seed.*@mateo.local` accounts
// so it never touches a real doctor (e.g. docphone@example.com). Re-running is
// idempotent: profiles are upserted and each doctor's seeded reviews are rebuilt.
//
// COMPLIANCE (CLAUDE.md hard rule 4): all copy here is brand-neutral and
// breastfeeding-first. No review or bio mentions infant formula / milk
// substitutes (IMS Act 1992).
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { DoctorProfile } from '../models/DoctorProfile.js';
import { DoctorReview } from '../models/DoctorReview.js';

const SEED_PASSWORD = 'Test1234!'; // every seeded login shares this dev password
const REVIEWER_DOMAIN = '@mateo.local';

// Indian-name review authors (first name is all that ever shows, for privacy).
const REVIEWERS = [
  'Priya Sharma',
  'Ananya Iyer',
  'Meera Nair',
  'Sneha Reddy',
  'Kavya Menon',
  'Divya Patel',
  'Pooja Gupta',
  'Riya Banerjee',
  'Aisha Khan',
  'Neha Joshi',
];

// Brand-neutral, breastfeeding-first review snippets (IMS-compliant).
const COMMENTS = [
  'So patient with all my first-time-mom questions. Walked me through the whole vaccine schedule.',
  'Very reassuring when my baby had a fever at midnight — quick to reply on chat and calmed me down.',
  'Helped us get growth back on track with gentle, practical advice. Never rushed the visit.',
  'Lovely guidance on starting solids at 6 months — simple homemade ideas we actually used.',
  'Really supportive with breastfeeding. Listened properly and never made me feel judged.',
  'Explained everything in Hindi so my mother-in-law could follow too. Felt very cared for.',
  'Thorough with the milestone check and flagged a small concern early. So glad we went.',
  'Gentle with my toddler and great with the rash we were worried about. Cleared up fast.',
  'Booking was easy and the follow-up note was detailed. Highly recommend for new parents.',
  'Answered our diaper and sleep worries without any fuss. Sensible, kind advice.',
  '',
  '',
];

interface SeedDoctor {
  name: string;
  specialization: string;
  qualifications: string;
  experienceYears: number;
  consultationFee: number;
  languages: string[];
  clinicName: string;
  city: string;
  bio: string;
  availability: { days: number[]; startTime: string; endTime: string; slotMinutes: number };
  ratings: number[]; // one entry per seeded review → drives avg + "trusted by N"
}

// Curated-but-varied demo roster. Pediatric / child-health focused so it fits the
// app. registrationNo is generated for all → every doctor shows the Verified badge.
const DOCTORS: SeedDoctor[] = [
  {
    name: 'Sonal Kapoor',
    specialization: 'Pediatrician',
    qualifications: 'MBBS, MD (Pediatrics), DCH',
    experienceYears: 15,
    consultationFee: 500,
    languages: ['English', 'Hindi', 'Punjabi'],
    clinicName: 'Happy Tots Pediatric Clinic',
    city: 'Bengaluru',
    bio: 'Pediatrician with 15+ years caring for newborns and toddlers, with a special interest in routine immunisation and gentle first-year guidance for new parents.',
    availability: { days: [1, 2, 3, 4, 5], startTime: '10:00', endTime: '17:00', slotMinutes: 30 },
    ratings: [5, 5, 4],
  },
  {
    name: 'Vikram Desai',
    specialization: 'Neonatologist',
    qualifications: 'MBBS, MD (Pediatrics), DM (Neonatology)',
    experienceYears: 18,
    consultationFee: 800,
    languages: ['English', 'Hindi', 'Gujarati'],
    clinicName: 'Cradle Care Neonatal Centre',
    city: 'Mumbai',
    bio: 'Neonatologist supporting premature and low-birth-weight babies, with two decades in NICU care and follow-up of high-risk newborns.',
    availability: { days: [1, 3, 5], startTime: '09:00', endTime: '13:00', slotMinutes: 20 },
    ratings: [5, 4, 5, 5],
  },
  {
    name: 'Lakshmi Iyer',
    specialization: 'Lactation Consultant',
    qualifications: 'IBCLC, BSc Nursing',
    experienceYears: 9,
    consultationFee: 350,
    languages: ['English', 'Tamil', 'Malayalam'],
    clinicName: 'Latch & Nurture Support',
    city: 'Chennai',
    bio: 'Certified lactation consultant helping mothers with latch, positioning and supply. Breastfeeding-first support delivered with warmth and patience.',
    availability: { days: [1, 2, 3, 4, 5, 6], startTime: '11:00', endTime: '16:00', slotMinutes: 30 },
    ratings: [5, 5, 5, 4],
  },
  {
    name: 'Rohan Mehta',
    specialization: 'Pediatric Dermatologist',
    qualifications: 'MBBS, MD (Dermatology)',
    experienceYears: 11,
    consultationFee: 600,
    languages: ['English', 'Hindi'],
    clinicName: 'SkinKind Child Dermatology',
    city: 'Delhi',
    bio: 'Pediatric dermatologist focused on eczema, nappy rash, cradle cap and sensitive baby skin, with practical everyday skincare routines for families.',
    availability: { days: [2, 4, 6], startTime: '16:00', endTime: '20:00', slotMinutes: 20 },
    ratings: [4, 5, 4],
  },
  {
    name: 'Sunita Pillai',
    specialization: 'Pediatric Nutritionist',
    qualifications: 'MSc (Clinical Nutrition), RD',
    experienceYears: 7,
    consultationFee: 400,
    languages: ['English', 'Malayalam', 'Hindi'],
    clinicName: 'GrowWell Child Nutrition',
    city: 'Kochi',
    bio: 'Child nutritionist guiding families through complementary feeding from 6 months with homemade, age-appropriate meals and healthy weight gain.',
    availability: { days: [1, 2, 3, 4, 5], startTime: '10:00', endTime: '14:00', slotMinutes: 30 },
    ratings: [5, 4, 5],
  },
  {
    name: 'Arjun Nair',
    specialization: 'Pediatric Pulmonologist',
    qualifications: 'MBBS, MD (Pediatrics), Fellowship in Pediatric Pulmonology',
    experienceYears: 13,
    consultationFee: 700,
    languages: ['English', 'Malayalam', 'Tamil'],
    clinicName: 'Easy Breath Children Chest Clinic',
    city: 'Hyderabad',
    bio: 'Pediatric chest specialist managing recurrent cough, wheeze and childhood asthma, with a calm, parent-friendly approach to breathing problems.',
    availability: { days: [1, 3, 5], startTime: '15:00', endTime: '19:00', slotMinutes: 20 },
    ratings: [5, 5, 4, 5, 4],
  },
  {
    name: 'Neha Kulkarni',
    specialization: 'Child Development Specialist',
    qualifications: 'MBBS, DCH, Fellowship in Developmental Pediatrics',
    experienceYears: 10,
    consultationFee: 650,
    languages: ['English', 'Hindi', 'Marathi'],
    clinicName: 'Milestones Child Development Centre',
    city: 'Pune',
    bio: 'Developmental pediatrician supporting early milestones, speech and motor development, with thoughtful early-intervention guidance for parents.',
    availability: { days: [2, 3, 4, 5], startTime: '10:00', endTime: '15:00', slotMinutes: 30 },
    ratings: [5, 4],
  },
  {
    name: 'Imran Sheikh',
    specialization: 'Pediatric ENT',
    qualifications: 'MBBS, MS (ENT)',
    experienceYears: 16,
    consultationFee: 550,
    languages: ['English', 'Hindi', 'Urdu'],
    clinicName: 'TinyEars Child ENT Clinic',
    city: 'Lucknow',
    bio: 'Pediatric ENT surgeon treating ear infections, blocked noses and throat concerns in children, with a gentle touch for anxious little patients.',
    availability: { days: [1, 2, 4, 6], startTime: '11:00', endTime: '17:00', slotMinutes: 20 },
    ratings: [4, 4, 5],
  },
  {
    name: 'Ritu Banerjee',
    specialization: 'Pediatric Gastroenterologist',
    qualifications: 'MBBS, MD (Pediatrics), DM (Gastroenterology)',
    experienceYears: 12,
    consultationFee: 750,
    languages: ['English', 'Bengali', 'Hindi'],
    clinicName: 'TummyCare Child GI Clinic',
    city: 'Kolkata',
    bio: 'Pediatric gastroenterologist for reflux, colic, constipation and feeding difficulties, helping families settle tummy troubles step by step.',
    availability: { days: [1, 3, 5], startTime: '14:00', endTime: '18:00', slotMinutes: 30 },
    ratings: [5, 5, 4, 5],
  },
  {
    name: 'Karthik Subramaniam',
    specialization: 'Pediatrician',
    qualifications: 'MBBS, DCH, DNB (Pediatrics)',
    experienceYears: 6,
    consultationFee: 300,
    languages: ['English', 'Tamil', 'Telugu'],
    clinicName: 'Sunshine Kids Clinic',
    city: 'Coimbatore',
    bio: 'General pediatrician for everyday childhood illnesses, vaccinations and well-baby checks, known for clear advice and prompt chat replies.',
    availability: { days: [1, 2, 3, 4, 5, 6], startTime: '09:00', endTime: '12:00', slotMinutes: 15 },
    ratings: [4, 5],
  },
];

function emailFor(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z]+/g, '.');
  return `seed.doctor.${slug}${REVIEWER_DOMAIN}`;
}

function registrationFor(i: number, city: string): string {
  const state = city.slice(0, 3).toUpperCase();
  return `${state}/2024/${String(10472 + i * 137).padStart(5, '0')}`;
}

// Upsert a user by email, returning its id. Idempotent across re-runs.
async function upsertUser(email: string, name: string, role: 'doctor' | 'parent', passwordHash: string): Promise<string> {
  const lower = email.toLowerCase().trim();
  const existing = await User.findOne({ email: lower });
  if (existing) {
    existing.name = name;
    existing.role = role;
    await existing.save();
    return existing.id;
  }
  const created = await User.create({ email: lower, name, role, passwordHash, consentAcceptedAt: new Date() });
  return created.id;
}

async function wipe() {
  const seeded = await User.find({ email: { $regex: `^seed\\.(doctor|parent)\\..*${REVIEWER_DOMAIN.replace('.', '\\.')}$` } }).select('_id');
  const ids = seeded.map((u) => u._id);
  const profiles = await DoctorProfile.find({ userId: { $in: ids } }).select('_id userId');
  const reviewDel = await DoctorReview.deleteMany({ doctorUserId: { $in: profiles.map((p) => p.userId) } });
  const profDel = await DoctorProfile.deleteMany({ userId: { $in: ids } });
  const userDel = await User.deleteMany({ _id: { $in: ids } });
  console.log(`Wiped ${userDel.deletedCount} seeded users, ${profDel.deletedCount} profiles, ${reviewDel.deletedCount} reviews.`);
}

async function main() {
  const wipeMode = process.argv.includes('--wipe');
  await mongoose.connect(env.MONGODB_URI);

  if (wipeMode) {
    await wipe();
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  // A reusable pool of mock parent reviewers (reused across doctors).
  const reviewerIds: string[] = [];
  for (let i = 0; i < REVIEWERS.length; i++) {
    const email = `seed.parent.${i + 1}${REVIEWER_DOMAIN}`;
    reviewerIds.push(await upsertUser(email, REVIEWERS[i], 'parent', passwordHash));
  }

  let docCount = 0;
  let reviewCount = 0;

  for (let i = 0; i < DOCTORS.length; i++) {
    const d = DOCTORS[i];
    const userId = await upsertUser(emailFor(d.name), d.name, 'doctor', passwordHash);

    const profileFields = {
      specialization: d.specialization,
      qualifications: d.qualifications,
      experienceYears: d.experienceYears,
      registrationNo: registrationFor(i, d.city),
      bio: d.bio,
      consultationFee: d.consultationFee,
      languages: d.languages,
      clinicName: d.clinicName,
      city: d.city,
      availability: d.availability,
      status: 'approved' as const,
    };
    const profile = await DoctorProfile.findOneAndUpdate(
      { userId },
      { $set: profileFields, $setOnInsert: { userId } },
      { upsert: true, new: true },
    );
    docCount++;

    // Rebuild this doctor's seeded reviews (idempotent — clear then re-insert).
    await DoctorReview.deleteMany({ doctorUserId: userId });
    const reviewDocs = d.ratings.map((rating, j) => {
      const reviewerIdx = (i * 3 + j) % reviewerIds.length;
      const commentIdx = (i * 5 + j * 2) % COMMENTS.length;
      // Stagger createdAt into the recent past so the carousel shows "x ago".
      const daysAgo = 3 + ((i * 7 + j * 11) % 40);
      const createdAt = new Date(Date.now() - daysAgo * 86_400_000);
      return {
        consultationId: new mongoose.Types.ObjectId(), // synthetic — demo reviews aren't tied to a real booking
        doctorUserId: new mongoose.Types.ObjectId(userId),
        doctorProfileId: profile!._id,
        parentUserId: new mongoose.Types.ObjectId(reviewerIds[reviewerIdx]),
        rating,
        comment: COMMENTS[commentIdx] || undefined,
        createdAt,
        updatedAt: createdAt,
      };
    });
    if (reviewDocs.length) {
      await DoctorReview.insertMany(reviewDocs, { timestamps: false });
      reviewCount += reviewDocs.length;
    }
  }

  console.log(`Seeded ${docCount} approved doctors and ${reviewCount} reviews.`);
  console.log(`All seeded logins use password "${SEED_PASSWORD}" (e.g. ${emailFor(DOCTORS[0].name)}).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
