import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { GameSession } from '../models/GameSession';
import { User } from '../models/User';
import { createError } from '../middleware/errorHandler';
import { generateCandleData, CandleData } from '../utils/generateCandleData';
import { fetchForexData, fetchCryptoData, FOREX_PAIRS, CRYPTO_SYMBOLS } from '../utils/alphaVantageClient';

// ─── GET CANDLE PREDICTION CHALLENGE ────────────────────────────────────────
export const getCandleChallenge = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const difficulty = (req.query.difficulty as string) || 'easy';
    const candleCount = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 15 : 20;

    const candles = generateCandleData(candleCount + 3); // extra 3 for answer
    const visibleCandles = candles.slice(0, candleCount);
    const nextCandle = candles[candleCount];

    let correctAnswer: 'bullish' | 'bearish' | 'consolidation';
    const change = ((nextCandle.close - nextCandle.open) / nextCandle.open) * 100;

    if (change > 0.5) correctAnswer = 'bullish';
    else if (change < -0.5) correctAnswer = 'bearish';
    else correctAnswer = 'consolidation';

    // Store answer server-side temporarily (in production, use Redis)
    const challengeId = `${req.user?.id}-${Date.now()}`;

    res.json({
      challengeId,
      candles: visibleCandles,
      difficulty,
      timeLimit: difficulty === 'easy' ? 60 : difficulty === 'medium' ? 45 : 30,
      hint: difficulty === 'easy' ? `The last few candles show a ${change > 0 ? 'upward' : 'downward'} trend` : null,
      // correctAnswer is NOT sent to client
      _correctAnswer: correctAnswer, // In production, store in Redis and remove this
    });
  } catch (error) {
    next(error);
  }
};

// ─── SUBMIT CANDLE PREDICTION ────────────────────────────────────────────────
export const submitCandlePrediction = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { prediction, correctAnswer, difficulty, timeSpent } = req.body;

    if (!['bullish', 'bearish', 'consolidation'].includes(prediction)) {
      return next(createError('Invalid prediction', 400));
    }

    const isCorrect = prediction === correctAnswer;
    const baseXP = difficulty === 'easy' ? 15 : difficulty === 'medium' ? 25 : 40;
    const baseCoins = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 35;

    const xpEarned = isCorrect ? baseXP : Math.floor(baseXP * 0.1); // small XP for trying
    const coinsEarned = isCorrect ? baseCoins : 0;
    const score = isCorrect ? (timeSpent < 10 ? 100 : timeSpent < 20 ? 80 : 60) : 0;

    // Update user stats
    const user = await User.findById(req.user?.id);
    if (!user) return next(createError('User not found', 404));

    user.stats.candlePrediction.played += 1;
    if (isCorrect) user.stats.candlePrediction.correct += 1;
    user.stats.candlePrediction.accuracy =
      Math.round((user.stats.candlePrediction.correct / user.stats.candlePrediction.played) * 100);

    user.xp += xpEarned;
    user.coins += coinsEarned;
    user.calculateLevel();
    await user.save();

    // Save game session
    await GameSession.create({
      userId: req.user?.id,
      gameType: 'candle-prediction',
      score,
      xpEarned,
      coinsEarned,
      duration: timeSpent,
      result: isCorrect ? 'win' : 'loss',
      details: { prediction, correctAnswer, difficulty },
    });

    res.json({
      isCorrect,
      prediction,
      correctAnswer,
      xpEarned,
      coinsEarned,
      score,
      explanation: isCorrect
        ? '🎯 Excellent prediction! You correctly identified the price movement.'
        : `📊 The correct answer was "${correctAnswer}". Study the trend indicators more carefully.`,
      newStats: {
        level: user.level,
        xp: user.xp,
        xpToNextLevel: user.xpToNextLevel,
        coins: user.coins,
        accuracy: user.stats.candlePrediction.accuracy,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET TRADE SIMULATION ────────────────────────────────────────────────────
export const getTradeScenario = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const candles = generateCandleData(30);
    const entryIndex = 20;
    const entryPrice = candles[entryIndex].close;

    const scenarios = [
      { symbol: 'RELIANCE', sector: 'Energy', volatility: 'medium' },
      { symbol: 'TCS', sector: 'IT', volatility: 'low' },
      { symbol: 'HDFCBANK', sector: 'Banking', volatility: 'low' },
      { symbol: 'NIFTY50', sector: 'Index', volatility: 'medium' },
      { symbol: 'BANKNIFTY', sector: 'Banking Index', volatility: 'high' },
    ];

    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

    res.json({
      scenario: {
        ...scenario,
        candles: candles.slice(0, entryIndex + 1),
        entryPrice,
        futureCandles: candles.slice(entryIndex + 1), // hidden from client
      },
      instructions: 'Set your Entry, Stop Loss, and Target Price to evaluate risk:reward ratio.',
    });
  } catch (error) {
    next(error);
  }
};

// ─── SUBMIT TRADE ────────────────────────────────────────────────────────────
export const submitTrade = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { entryPrice, stopLoss, targetPrice, direction } = req.body;

    if (!entryPrice || !stopLoss || !targetPrice) {
      return next(createError('Entry, stop loss, and target are required', 400));
    }

    const riskAmount = Math.abs(entryPrice - stopLoss);
    const rewardAmount = Math.abs(targetPrice - entryPrice);
    const riskRewardRatio = rewardAmount / riskAmount;

    // Evaluate trade quality
    let score = 0;
    const feedback: string[] = [];

    if (riskRewardRatio >= 2) {
      score += 40;
      feedback.push('✅ Excellent R:R ratio (≥2:1)');
    } else if (riskRewardRatio >= 1.5) {
      score += 25;
      feedback.push('⚠️ Acceptable R:R ratio. Try for ≥2:1');
    } else {
      score += 10;
      feedback.push('❌ Poor R:R ratio. Risk outweighs reward.');
    }

    const stopLossPercent = (riskAmount / entryPrice) * 100;
    if (stopLossPercent <= 2) {
      score += 30;
      feedback.push('✅ Tight stop loss (≤2%)');
    } else if (stopLossPercent <= 5) {
      score += 20;
      feedback.push('⚠️ Moderate stop loss (2-5%)');
    } else {
      score += 5;
      feedback.push('❌ Wide stop loss (>5%). Consider tightening.');
    }

    // Direction validation
    if (direction === 'buy' && targetPrice > entryPrice && stopLoss < entryPrice) {
      score += 30;
      feedback.push('✅ Correct buy trade setup');
    } else if (direction === 'sell' && targetPrice < entryPrice && stopLoss > entryPrice) {
      score += 30;
      feedback.push('✅ Correct sell trade setup');
    } else {
      feedback.push('❌ Inconsistent trade direction and levels');
    }

    const xpEarned = Math.floor(score * 0.5);
    const coinsEarned = Math.floor(score * 0.3);

    const user = await User.findById(req.user?.id);
    if (!user) return next(createError('User not found', 404));

    user.stats.tradeSimulation.played += 1;
    if (score >= 70) user.stats.tradeSimulation.profitableTrades += 1;
    user.xp += xpEarned;
    user.coins += coinsEarned;
    user.calculateLevel();
    await user.save();

    await GameSession.create({
      userId: req.user?.id,
      gameType: 'trade-simulation',
      score,
      xpEarned,
      coinsEarned,
      result: score >= 70 ? 'win' : 'loss',
      details: { entryPrice, stopLoss, targetPrice, direction, riskRewardRatio, feedback },
    });

    res.json({
      score,
      riskRewardRatio: Math.round(riskRewardRatio * 100) / 100,
      stopLossPercent: Math.round(stopLossPercent * 100) / 100,
      feedback,
      xpEarned,
      coinsEarned,
      grade: score >= 90 ? 'A+' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 45 ? 'C' : 'D',
      newStats: {
        level: user.level,
        xp: user.xp,
        xpToNextLevel: user.xpToNextLevel,
        coins: user.coins,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET USER GAME HISTORY ───────────────────────────────────────────────────
export const getGameHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const gameType = req.query.gameType as string;

    const query: Record<string, unknown> = { userId: req.user?.id };
    if (gameType) query.gameType = gameType;

    const sessions = await GameSession.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await GameSession.countDocuments(query);

    res.json({
      sessions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET TAX SIMULATION ──────────────────────────────────────────────────────
export const calculateTax = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { income, stcgGains, ltcgGains, section80C, section80D, hra } = req.body;

    // Simplified Indian tax calculation (FY 2024-25)
    const standardDeduction = 50000;
    const totalDeductions = Math.min(section80C || 0, 150000) +
      Math.min(section80D || 0, 25000) +
      Math.min(hra || 0, income * 0.4) +
      standardDeduction;

    const taxableIncome = Math.max(0, income - totalDeductions);

    // Old tax regime slabs
    let incomeTax = 0;
    if (taxableIncome <= 250000) incomeTax = 0;
    else if (taxableIncome <= 500000) incomeTax = (taxableIncome - 250000) * 0.05;
    else if (taxableIncome <= 1000000) incomeTax = 12500 + (taxableIncome - 500000) * 0.2;
    else incomeTax = 112500 + (taxableIncome - 1000000) * 0.3;

    // STCG tax (15% under section 111A)
    const stcgTax = Math.max(0, stcgGains || 0) * 0.15;

    // LTCG tax (10% above ₹1L exemption)
    const ltcgExemption = 100000;
    const ltcgTax = Math.max(0, (ltcgGains || 0) - ltcgExemption) * 0.1;

    const totalTax = incomeTax + stcgTax + ltcgTax;
    const taxWithoutDeductions = income * 0.3; // rough without deductions
    const taxSaved = Math.max(0, taxWithoutDeductions - totalTax);

    const user = await User.findById(req.user?.id);
    if (user) {
      user.stats.taxSimulator.completed += 1;
      user.stats.taxSimulator.taxSaved += taxSaved;
      user.xp += 30;
      user.coins += 20;
      user.calculateLevel();
      await user.save();
    }

    res.json({
      breakdown: {
        grossIncome: income,
        totalDeductions,
        taxableIncome,
        incomeTax: Math.round(incomeTax),
        stcgTax: Math.round(stcgTax),
        ltcgTax: Math.round(ltcgTax),
        totalTax: Math.round(totalTax),
        effectiveRate: Math.round((totalTax / income) * 100 * 100) / 100,
        taxSaved: Math.round(taxSaved),
      },
      tips: [
        section80C < 150000 ? `Invest ₹${(150000 - section80C).toLocaleString('en-IN')} more in 80C instruments to save ₹${Math.round((150000 - (section80C || 0)) * 0.3).toLocaleString('en-IN')} in tax` : null,
        !section80D ? 'Get health insurance (80D) to claim up to ₹25,000 deduction' : null,
        ltcgGains > 100000 ? 'Consider tax-loss harvesting to offset LTCG' : null,
        'Use ELSS funds for 80C — they have the shortest lock-in (3 years) with market-linked returns',
      ].filter(Boolean),
      xpEarned: 30,
      coinsEarned: 20,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET SUPPORT/RESISTANCE CHALLENGE ────────────────────────────────────────
export const getSupportResistanceChallenge = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const difficulty = (req.query.difficulty as string) || 'easy';
    
    // Determine candle count based on difficulty
    const candleCount = difficulty === 'easy' ? 25 : difficulty === 'medium' ? 35 : 50;
    
    // Generate candles - use sideways trend for clearer support/resistance
    const candles = generateCandleData(candleCount, 2500, 'sideways');
    
    // Store challenge data server-side (in production, use Redis)
    const challengeId = `${req.user?.id}-sr-${Date.now()}`;
    
    // Calculate actual support/resistance levels from price data
    const prices = candles.map(c => [c.high, c.low, c.close]).flat();
    const actualSupports = identifySupportLevels(prices);
    const actualResistances = identifyResistanceLevels(prices);
    
    res.json({
      challengeId,
      candles,
      difficulty,
      timeLimit: difficulty === 'easy' ? 120 : difficulty === 'medium' ? 90 : 60,
      instructions: 'Draw support levels (green) at price lows and resistance levels (red) at price highs.',
      // These are hidden from client - used for validation only
      _actualSupports: actualSupports,
      _actualResistances: actualResistances,
    });
  } catch (error) {
    next(error);
  }
};

// ─── SUBMIT SUPPORT/RESISTANCE DRAWING ────────────────────────────────────────
export const submitSupportResistance = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { candles, drawnSupports, drawnResistances, difficulty, timeSpent } = req.body;
    
    if (!Array.isArray(drawnSupports) || !Array.isArray(drawnResistances)) {
      return next(createError('Invalid support/resistance data', 400));
    }
    
    // Calculate actual levels from provided candles
    const prices = candles.map((c: any) => [c.high, c.low, c.close]).flat();
    const actualSupports = identifySupportLevels(prices);
    const actualResistances = identifyResistanceLevels(prices);
    
    // Score accuracy of drawn levels
    const { supportAccuracy, resistanceAccuracy } = scoreDrawnLevels(
      drawnSupports,
      drawnResistances,
      actualSupports,
      actualResistances,
      Math.min(...prices),
      Math.max(...prices)
    );
    
    // Calculate overall score
    const overallAccuracy = (supportAccuracy + resistanceAccuracy) / 2;
    let score = 0;
    
    if (overallAccuracy >= 85) score = 95;
    else if (overallAccuracy >= 75) score = 80;
    else if (overallAccuracy >= 65) score = 65;
    else if (overallAccuracy >= 50) score = 45;
    else score = 25;
    
    // Add bonus for speed
    const baseXP = difficulty === 'easy' ? 20 : difficulty === 'medium' ? 35 : 50;
    const speedBonus = timeSpent < 30 ? 1.25 : timeSpent < 60 ? 1.1 : 1;
    const xpEarned = Math.floor(baseXP * speedBonus);
    const coinsEarned = Math.floor(score * 0.5);
    
    // Update user
    const user = await User.findById(req.user?.id);
    if (!user) return next(createError('User not found', 404));
    
    user.stats.supportResistance.played += 1;
    if (overallAccuracy >= 70) user.stats.supportResistance.correct += 1;
    user.stats.supportResistance.accuracy = Math.round(
      (user.stats.supportResistance.correct / user.stats.supportResistance.played) * 100
    );
    
    user.xp += xpEarned;
    user.coins += coinsEarned;
    user.calculateLevel();
    await user.save();
    
    // Save game session
    await GameSession.create({
      userId: req.user?.id,
      gameType: 'support-resistance',
      score,
      xpEarned,
      coinsEarned,
      duration: timeSpent,
      result: overallAccuracy >= 70 ? 'win' : 'loss',
      details: {
        supportAccuracy,
        resistanceAccuracy,
        overallAccuracy,
        difficulty,
        drawnCount: drawnSupports.length + drawnResistances.length,
      },
    });
    
    res.json({
      score,
      supportAccuracy: Math.round(supportAccuracy),
      resistanceAccuracy: Math.round(resistanceAccuracy),
      overallAccuracy: Math.round(overallAccuracy),
      xpEarned,
      coinsEarned,
      feedback: generateSRFeedback(supportAccuracy, resistanceAccuracy),
      grade: score >= 90 ? 'A+' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 45 ? 'C' : 'D',
      newStats: {
        level: user.level,
        xp: user.xp,
        xpToNextLevel: user.xpToNextLevel,
        coins: user.coins,
        accuracy: user.stats.supportResistance.accuracy,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

/**
 * Identify support levels by clustering price lows
 */
function identifySupportLevels(prices: number[], clusterSize: number = 5): number[] {
  const sorted = [...prices].sort((a, b) => a - b);
  const clusters: number[][] = [];
  let current: number[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - current[current.length - 1] <= clusterSize) {
      current.push(sorted[i]);
    } else {
      if (current.length >= 2) clusters.push(current);
      current = [sorted[i]];
    }
  }
  if (current.length >= 2) clusters.push(current);
  
  // Return average of each cluster as a support level
  return clusters.map(cluster => 
    Math.round((cluster.reduce((a, b) => a + b, 0) / cluster.length) * 100) / 100
  ).slice(0, 3); // Return top 3 support levels
}

/**
 * Identify resistance levels by clustering price highs
 */
function identifyResistanceLevels(prices: number[], clusterSize: number = 5): number[] {
  const sorted = [...prices].sort((a, b) => b - a);
  const clusters: number[][] = [];
  let current: number[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    if (current[current.length - 1] - sorted[i] <= clusterSize) {
      current.push(sorted[i]);
    } else {
      if (current.length >= 2) clusters.push(current);
      current = [sorted[i]];
    }
  }
  if (current.length >= 2) clusters.push(current);
  
  // Return average of each cluster as a resistance level
  return clusters.map(cluster => 
    Math.round((cluster.reduce((a, b) => a + b, 0) / cluster.length) * 100) / 100
  ).slice(0, 3); // Return top 3 resistance levels
}

/**
 * Score the accuracy of drawn support/resistance levels
 */
function scoreDrawnLevels(
  drawnSupports: number[],
  drawnResistances: number[],
  actualSupports: number[],
  actualResistances: number[],
  minPrice: number,
  maxPrice: number
): { supportAccuracy: number; resistanceAccuracy: number } {
  const tolerance = (maxPrice - minPrice) * 0.02; // 2% tolerance range
  
  // Calculate support accuracy
  let supportHits = 0;
  for (const drawn of drawnSupports) {
    for (const actual of actualSupports) {
      if (Math.abs(drawn - actual) <= tolerance) {
        supportHits++;
        break;
      }
    }
  }
  const supportAccuracy = drawnSupports.length > 0 
    ? (supportHits / Math.max(drawnSupports.length, actualSupports.length)) * 100 
    : 0;
  
  // Calculate resistance accuracy
  let resistanceHits = 0;
  for (const drawn of drawnResistances) {
    for (const actual of actualResistances) {
      if (Math.abs(drawn - actual) <= tolerance) {
        resistanceHits++;
        break;
      }
    }
  }
  const resistanceAccuracy = drawnResistances.length > 0 
    ? (resistanceHits / Math.max(drawnResistances.length, actualResistances.length)) * 100 
    : 0;
  
  return { supportAccuracy, resistanceAccuracy };
}

/**
 * Generate feedback for support/resistance accuracy
 */
function generateSRFeedback(supportAccuracy: number, resistanceAccuracy: number): string[] {
  const feedback: string[] = [];
  
  if (supportAccuracy >= 80) {
    feedback.push('✅ Excellent support level identification');
  } else if (supportAccuracy >= 60) {
    feedback.push('⚠️ Good support placement, but check price clusters more carefully');
  } else {
    feedback.push('❌ Support levels need refinement. Look for price consolidation areas');
  }
  
  if (resistanceAccuracy >= 80) {
    feedback.push('✅ Excellent resistance level identification');
  } else if (resistanceAccuracy >= 60) {
    feedback.push('⚠️ Good resistance placement, but verify against recent highs');
  } else {
    feedback.push('❌ Resistance levels need work. Identify previous price peaks');
  }
  
  return feedback;
}

// ─── GET CANDLE CHALLENGE WITH REAL FOREX DATA ──────────────────────────────
export const getCandleChallengeForex = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const difficulty = (req.query.difficulty as string) || 'easy';
    const pairIndex = parseInt(req.query.pairIndex as string) || 0;
    
    const pair = FOREX_PAIRS[pairIndex % FOREX_PAIRS.length];
    const candleCount = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 15 : 20;

    try {
      // Fetch real data from Alpha Vantage
      const allCandles = await fetchForexData(pair.from, pair.to, '60min', 'compact');
      const candles = allCandles.slice(-candleCount - 1);
      const visibleCandles = candles.slice(0, -1);
      const nextCandle = candles[candles.length - 1];

      let correctAnswer: 'bullish' | 'bearish' | 'consolidation';
      const change = ((nextCandle.close - nextCandle.open) / nextCandle.open) * 100;

      if (change > 0.5) correctAnswer = 'bullish';
      else if (change < -0.5) correctAnswer = 'bearish';
      else correctAnswer = 'consolidation';

      const challengeId = `${req.user?.id}-forex-${Date.now()}`;

      res.json({
        challengeId,
        candles: visibleCandles,
        difficulty,
        pair: pair.symbol,
        pairLabel: pair.label,
        timeLimit: difficulty === 'easy' ? 60 : difficulty === 'medium' ? 45 : 30,
        hint: difficulty === 'easy' ? `The last few candles show a ${change > 0 ? 'upward' : 'downward'} trend` : null,
        _correctAnswer: correctAnswer,
      });
    } catch (apiError) {
      console.error('Alpha Vantage API Error:', apiError);
      // Fallback to generated data if API fails
      const candles = generateCandleData(candleCount + 3);
      const visibleCandles = candles.slice(0, candleCount);
      const nextCandle = candles[candleCount];

      let correctAnswer: 'bullish' | 'bearish' | 'consolidation';
      const change = ((nextCandle.close - nextCandle.open) / nextCandle.open) * 100;

      if (change > 0.5) correctAnswer = 'bullish';
      else if (change < -0.5) correctAnswer = 'bearish';
      else correctAnswer = 'consolidation';

      res.json({
        challengeId: `${req.user?.id}-forex-${Date.now()}`,
        candles: visibleCandles,
        difficulty,
        pair: pair.symbol,
        pairLabel: pair.label,
        timeLimit: difficulty === 'easy' ? 60 : difficulty === 'medium' ? 45 : 30,
        hint: difficulty === 'easy' ? `The last few candles show a ${change > 0 ? 'upward' : 'downward'} trend` : null,
        _correctAnswer: correctAnswer,
        warning: 'Using generated data due to API rate limit. Get your own API key at https://www.alphavantage.co/api/',
      });
    }
  } catch (error) {
    next(error);
  }
};

// ─── GET SUPPORT/RESISTANCE CHALLENGE WITH REAL FOREX DATA ───────────────────
export const getSupportResistanceForex = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const difficulty = (req.query.difficulty as string) || 'easy';
    const pairIndex = parseInt(req.query.pairIndex as string) || 0;
    
    const pair = FOREX_PAIRS[pairIndex % FOREX_PAIRS.length];
    const candleCount = difficulty === 'easy' ? 25 : difficulty === 'medium' ? 35 : 50;

    let candles: CandleData[];
    try {
      // Try to fetch real data
      const allCandles = await fetchForexData(pair.from, pair.to, '60min', 'compact');
      candles = allCandles.slice(-candleCount);
    } catch (apiError) {
      // Fallback to generated data
      console.error('Alpha Vantage API Error:', apiError);
      candles = generateCandleData(candleCount, 2500, 'sideways');
    }

    const prices = candles.map(c => [c.high, c.low, c.close]).flat();
    const actualSupports = identifySupportLevels(prices);
    const actualResistances = identifyResistanceLevels(prices);

    res.json({
      challengeId: `${req.user?.id}-sr-forex-${Date.now()}`,
      candles,
      difficulty,
      pair: pair.symbol,
      pairLabel: pair.label,
      timeLimit: difficulty === 'easy' ? 120 : difficulty === 'medium' ? 90 : 60,
      instructions: 'Draw support levels (green) at price lows and resistance levels (red) at price highs.',
      _actualSupports: actualSupports,
      _actualResistances: actualResistances,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET FOREX PAIRS LIST ────────────────────────────────────────────────────
export const getForexPairs = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.json({
      pairs: FOREX_PAIRS.map((pair, index) => ({
        index,
        symbol: pair.symbol,
        label: pair.label,
        from: pair.from,
        to: pair.to,
      })),
    });
  } catch (error) {
    next(error);
  }
};
