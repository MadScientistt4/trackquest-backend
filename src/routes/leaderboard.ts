import { Router, Request, Response, NextFunction } from 'express';
import { SortOrder } from 'mongoose';
import { User } from '../models/User';

const router = Router();

// GET /api/leaderboard?type=xp|accuracy|streak&limit=10
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = (req.query.type as string) || 'xp';
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    let sortField: Record<string, SortOrder> = { xp: -1 };
    if (type === 'accuracy') sortField = { 'stats.candlePrediction.accuracy': -1 };
    if (type === 'streak') sortField = { streak: -1 };
    if (type === 'coins') sortField = { coins: -1 };

    const users = await User.find()
      .sort(sortField)
      .limit(limit)
      .select('username avatar level xp coins streak rank stats.candlePrediction.accuracy');

    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      username: user.username,
      avatar: user.avatar,
      level: user.level,
      xp: user.xp,
      coins: user.coins,
      streak: user.streak,
      playerRank: user.rank,
      accuracy: user.stats?.candlePrediction?.accuracy || 0,
    }));

    res.json({ leaderboard, type, total: leaderboard.length });
  } catch (error) {
    next(error);
  }
});

export default router;