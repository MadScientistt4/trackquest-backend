import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { User } from '../models/User';
import { createError } from '../middleware/errorHandler';

const signToken = (id: string, username: string, email: string): string => {
  return jwt.sign(
    { id, username, email },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as SignOptions
  );
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return next(createError(
        existingUser.email === email ? 'Email already registered' : 'Username already taken',
        400
      ));
    }

    const user = await User.create({ username, email, password });

    const token = signToken(user.id, user.username, user.email);

    res.status(201).json({
      message: 'Account created successfully! Welcome to TradeQuest.',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        level: user.level,
        xp: user.xp,
        xpToNextLevel: user.xpToNextLevel,
        coins: user.coins,
        rank: user.rank,
        streak: user.streak,
        badges: user.badges,
        stats: user.stats,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return next(createError('Invalid email or password', 401));
    }

    // Update streak
    const today = new Date();
    const lastActive = new Date(user.lastActiveDate);
    const diffDays = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      user.streak += 1;
    } else if (diffDays > 1) {
      user.streak = 1;
    }
    user.lastActiveDate = today;
    await user.save();

    const token = signToken(user.id, user.username, user.email);

    res.json({
      message: `Welcome back, ${user.username}!`,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        level: user.level,
        xp: user.xp,
        xpToNextLevel: user.xpToNextLevel,
        coins: user.coins,
        rank: user.rank,
        streak: user.streak,
        badges: user.badges,
        stats: user.stats,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request & { user?: { id: string } }, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) return next(createError('User not found', 404));

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        level: user.level,
        xp: user.xp,
        xpToNextLevel: user.xpToNextLevel,
        coins: user.coins,
        rank: user.rank,
        streak: user.streak,
        badges: user.badges,
        completedGames: user.completedGames,
        stats: user.stats,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};
