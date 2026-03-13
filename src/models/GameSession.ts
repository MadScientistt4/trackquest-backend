import mongoose, { Document, Schema } from 'mongoose';

export type GameType =
  | 'candle-prediction'
  | 'pattern-recognition'
  | 'support-resistance'
  | 'trade-simulation'
  | 'market-replay'
  | 'financial-life'
  | 'tax-simulator';

export interface IGameSession extends Document {
  userId: mongoose.Types.ObjectId;
  gameType: GameType;
  score: number;
  xpEarned: number;
  coinsEarned: number;
  duration: number; // seconds
  result: 'win' | 'loss' | 'incomplete';
  details: Record<string, unknown>;
  createdAt: Date;
}

const GameSessionSchema = new Schema<IGameSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    gameType: {
      type: String,
      required: true,
      enum: [
        'candle-prediction',
        'pattern-recognition',
        'support-resistance',
        'trade-simulation',
        'market-replay',
        'financial-life',
        'tax-simulator',
      ],
    },
    score: { type: Number, default: 0 },
    xpEarned: { type: Number, default: 0 },
    coinsEarned: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    result: {
      type: String,
      enum: ['win', 'loss', 'incomplete'],
      default: 'incomplete',
    },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const GameSession = mongoose.model<IGameSession>('GameSession', GameSessionSchema);
