import { Request, Response, NextFunction } from 'express';
import jwt, { VerifyOptions } from 'jsonwebtoken';
import { User } from '../models/User';

export interface AuthRequest extends Request {
  user?: { id: string; username: string; email: string };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required. Please log in.' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'fallback_secret';
    const decoded = jwt.verify(token, secret) as {
      id: string;
      username: string;
      email: string;
    };

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      res.status(401).json({ error: 'User not found. Please log in again.' });
      return;
    }

    req.user = { id: decoded.id, username: decoded.username, email: decoded.email };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Session expired. Please log in again.' });
    } else {
      res.status(401).json({ error: 'Invalid token. Please log in again.' });
    }
  }
};
