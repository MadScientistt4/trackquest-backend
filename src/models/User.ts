import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  avatar: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  coins: number;
  streak: number;
  lastActiveDate: Date;
  badges: string[];
  completedGames: string[];
  stats: {
    candlePrediction: { played: number; correct: number; accuracy: number };
    patternRecognition: { played: number; correct: number; accuracy: number };
    tradeSimulation: { played: number; profitableTrades: number; totalPnL: number };
    taxSimulator: { completed: number; taxSaved: number };
    supportResistance: { played: number; correct: number; accuracy: number };
    stockPrediction: { played: number; correct: number; accuracy: number };
    cryptoPrediction: { played: number; correct: number; accuracy: number };
  };
  rank: string;
  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  calculateLevel(): void;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [20, 'Username cannot exceed 20 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    avatar: { type: String, default: 'default' },
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    xpToNextLevel: { type: Number, default: 100 },
    coins: { type: Number, default: 500 },
    streak: { type: Number, default: 0 },
    lastActiveDate: { type: Date, default: Date.now },
    badges: [{ type: String }],
    completedGames: [{ type: String }],
    stats: {
      candlePrediction: {
        played: { type: Number, default: 0 },
        correct: { type: Number, default: 0 },
        accuracy: { type: Number, default: 0 },
      },
      patternRecognition: {
        played: { type: Number, default: 0 },
        correct: { type: Number, default: 0 },
        accuracy: { type: Number, default: 0 },
      },
      tradeSimulation: {
        played: { type: Number, default: 0 },
        profitableTrades: { type: Number, default: 0 },
        totalPnL: { type: Number, default: 0 },
      },
      taxSimulator: {
        completed: { type: Number, default: 0 },
        taxSaved: { type: Number, default: 0 },
      },
      supportResistance: {
        played: { type: Number, default: 0 },
        correct: { type: Number, default: 0 },
        accuracy: { type: Number, default: 0 },
      },
      stockPrediction: {
        played: { type: Number, default: 0 },
        correct: { type: Number, default: 0 },
        accuracy: { type: Number, default: 0 },
      },
      cryptoPrediction: {
        played: { type: Number, default: 0 },
        correct: { type: Number, default: 0 },
        accuracy: { type: Number, default: 0 },
      },
    },
    rank: { type: String, default: 'Novice Trader' },
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare passwords
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Calculate level based on XP
UserSchema.methods.calculateLevel = function () {
  const xpThresholds = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 5800, 8000];
  const ranks = [
    'Novice Trader', 'Apprentice Analyst', 'Market Observer', 'Chart Reader',
    'Pattern Hunter', 'Risk Manager', 'Trend Follower', 'Swing Trader',
    'Market Veteran', 'Elite Investor', 'Market Wizard'
  ];

  for (let i = xpThresholds.length - 1; i >= 0; i--) {
    if (this.xp >= xpThresholds[i]) {
      this.level = i + 1;
      this.xpToNextLevel = xpThresholds[i + 1] ? xpThresholds[i + 1] - this.xp : 0;
      this.rank = ranks[i];
      break;
    }
  }
};

export const User = mongoose.model<IUser>('User', UserSchema);
