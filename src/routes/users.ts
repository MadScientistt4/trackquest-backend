import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { createError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

// GET /api/users/profile
router.get('/profile', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user?.id).select('-password');
    if (!user) return next(createError('User not found', 404));
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/profile
router.patch('/profile', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const allowed = ['username', 'avatar'];
    const updates: Record<string, string> = {};

    allowed.forEach((field) => {
      if (req.body[field]) updates[field] = req.body[field];
    });

    if (updates.username) {
      const exists = await User.findOne({ username: updates.username, _id: { $ne: req.user?.id } });
      if (exists) return next(createError('Username already taken', 400));
    }

    const user = await User.findByIdAndUpdate(req.user?.id, updates, {
      new: true,
      runValidators: true,
    }).select('-password');

    res.json({ message: 'Profile updated', user });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/stats
router.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user?.id).select('stats level xp coins streak rank');
    if (!user) return next(createError('User not found', 404));
    res.json({ stats: user.stats, level: user.level, xp: user.xp, coins: user.coins, streak: user.streak, rank: user.rank });
  } catch (error) {
    next(error);
  }
});

export default router;
