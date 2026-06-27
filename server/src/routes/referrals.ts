import { Router } from 'express';
import { User } from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { REWARD_PER_REFERRAL, generateUniqueReferralCode } from '../lib/referral.js';

const router = Router();

// Parent's Refer & Earn summary. The code is generated lazily on first view so
// existing accounts get one without a migration.
router.get('/referrals/me', requireAuth, requireRole('parent'), async (req, res) => {
  const user = req.authUser!;
  if (!user.referralCode) {
    user.referralCode = await generateUniqueReferralCode(user.name);
    await user.save();
  }
  const referredCount = await User.countDocuments({ referredByCode: user.referralCode });
  res.json({
    code: user.referralCode,
    credits: user.referralCredits ?? 0,
    referredCount,
    rewardPerReferral: REWARD_PER_REFERRAL,
  });
});

export default router;
