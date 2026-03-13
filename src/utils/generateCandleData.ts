export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type TrendType = 'up' | 'down' | 'sideways';

const randomBetween = (min: number, max: number): number =>
  Math.random() * (max - min) + min;

const randomInt = (min: number, max: number): number =>
  Math.floor(randomBetween(min, max + 1));

/**
 * Generate realistic OHLCV candle data with trend following
 */
export const generateCandleData = (
  count: number,
  startPrice?: number,
  trend?: TrendType
): CandleData[] => {
  const candles: CandleData[] = [];
  let price = startPrice || randomBetween(500, 3000);
  const selectedTrend = trend || (['up', 'down', 'sideways'] as TrendType[])[randomInt(0, 2)];

  const trendBias = selectedTrend === 'up' ? 0.55 : selectedTrend === 'down' ? 0.45 : 0.5;
  const volatility = randomBetween(0.01, 0.025); // 1-2.5% daily volatility

  // Start timestamp: 30 days ago, daily candles
  const startTime = Date.now() - count * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const isBullish = Math.random() < trendBias;

    // Determine open (with slight gap from previous close)
    const open = i === 0 ? price : candles[i - 1].close * (1 + randomBetween(-0.005, 0.005));

    // Body range
    const bodySize = open * volatility * randomBetween(0.5, 1.5);
    const close = isBullish ? open + bodySize : open - bodySize;

    // Wicks
    const upperWick = Math.max(open, close) * randomBetween(0.001, 0.012);
    const lowerWick = Math.min(open, close) * randomBetween(0.001, 0.012);

    const high = Math.max(open, close) + upperWick;
    const low = Math.min(open, close) - lowerWick;

    // Volume: higher on strong moves
    const bodyPercent = Math.abs(close - open) / open;
    const baseVolume = randomBetween(500000, 2000000);
    const volume = Math.floor(baseVolume * (1 + bodyPercent * 10));

    candles.push({
      timestamp: startTime + i * 24 * 60 * 60 * 1000,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume,
    });

    price = close;
  }

  return candles;
};

/**
 * Generate candles for a specific historical scenario
 */
export const generateScenario = (
  scenario: 'bull_run' | 'crash' | 'consolidation' | 'recovery',
  count: number = 30
): CandleData[] => {
  switch (scenario) {
    case 'bull_run':
      return generateCandleData(count, 1000, 'up');
    case 'crash':
      return generateCandleData(count, 2000, 'down');
    case 'consolidation':
      return generateCandleData(count, 1500, 'sideways');
    case 'recovery':
      return [
        ...generateCandleData(Math.floor(count / 2), 2000, 'down'),
        ...generateCandleData(Math.ceil(count / 2), undefined, 'up'),
      ];
    default:
      return generateCandleData(count);
  }
};

/**
 * Common chart patterns for pattern recognition game
 */
export const CHART_PATTERNS = {
  doubleTop: {
    name: 'Double Top',
    description: 'A bearish reversal pattern with two peaks at similar price levels',
    difficulty: 'easy',
  },
  doubleBottom: {
    name: 'Double Bottom',
    description: 'A bullish reversal pattern with two troughs at similar price levels',
    difficulty: 'easy',
  },
  headAndShoulders: {
    name: 'Head and Shoulders',
    description: 'Bearish reversal: left shoulder, higher head, right shoulder',
    difficulty: 'medium',
  },
  inverseHeadAndShoulders: {
    name: 'Inverse Head & Shoulders',
    description: 'Bullish reversal: inverse of the standard H&S pattern',
    difficulty: 'medium',
  },
  bullishEngulfing: {
    name: 'Bullish Engulfing',
    description: 'A large green candle engulfs the previous red candle',
    difficulty: 'easy',
  },
  bearishEngulfing: {
    name: 'Bearish Engulfing',
    description: 'A large red candle engulfs the previous green candle',
    difficulty: 'easy',
  },
  doji: {
    name: 'Doji',
    description: 'Open and close are nearly equal, indicating indecision',
    difficulty: 'easy',
  },
  hammer: {
    name: 'Hammer',
    description: 'Bullish reversal candle with a long lower wick',
    difficulty: 'medium',
  },
};
