import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export interface IMilestoneAchievement {
  babyId: Types.ObjectId;
  // String id from who-milestones.json (e.g. 'sitting') — NOT an ObjectId.
  milestoneId: string;
  achievedOn: Date;
  createdAt: Date;
}

const milestoneAchievementSchema = new Schema<IMilestoneAchievement>(
  {
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby', required: true, index: true },
    milestoneId: { type: String, required: true },
    achievedOn: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One achievement record per milestone per baby.
milestoneAchievementSchema.index({ babyId: 1, milestoneId: 1 }, { unique: true });

export const MilestoneAchievement = model<IMilestoneAchievement>('MilestoneAchievement', milestoneAchievementSchema);
