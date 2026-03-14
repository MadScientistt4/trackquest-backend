import axios from 'axios';

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PolygonBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  n?: number;
  vw?: number;
}

const API_KEY = process.env.POLYGON_API_KEY || '';
const BASE_URL = 'https://api.polygon.io/v2';

// Cache to avoid hitting rate limits
const cache: Map<string, { data: CandleData[]; timestamp: number }> = new Map();
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

export const STOCK_ASSETS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'AMZN', name: 'Amazon Inc.' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
];

export const CRYPTO_ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', pair: 'BTC/USD' },
  { symbol: 'ETH', name: 'Ethereum', pair: 'ETH/USD' },
  { symbol: 'DOGE', name: 'Dogecoin', pair: 'DOGE/USD' },
  { symbol: 'XRP', name: 'Ripple', pair: 'XRP/USD' },
];

/**
 * Fetch stock data from Polygon.io
 * @param ticker - Stock ticker symbol (e.g., AAPL)
 * @param timespan - Timespan ('minute', 'hour', 'day', 'week', 'month', 'quarter', 'year')
 * @param limit - Max number of candles to fetch (default: 50)
 */
export const fetchStockData = async (
  ticker: string,
  timespan: string = 'day',
  limit: number = 50
): Promise<CandleData[]> => {
  if (!API_KEY) {
    throw new Error('POLYGON_API_KEY not configured in .env');
  }

  const cacheKey = `stock_${ticker}_${timespan}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    console.log(`[Cache] Using cached stock data for ${ticker}`);
    return cached.data;
  }

  try {
    console.log(`[Polygon.io] Fetching stock data for ${ticker} (${timespan})...`);

    const url = `${BASE_URL}/aggs/ticker/${ticker}/range/1/${timespan}/2020-01-01/2025-12-31`;

    const response = await axios.get(url, {
      params: {
        limit: limit,
        apiKey: API_KEY,
      },
      timeout: 10000,
    });

    const data = response.data;

    // Check for errors
    if (data.status === 'NOT_FOUND') {
      throw new Error(`Ticker ${ticker} not found on Polygon.io`);
    }

    if (!data.results || data.results.length === 0) {
      throw new Error('No data returned from Polygon.io');
    }

    // Convert to candle format
    const candles: CandleData[] = data.results
      .map((bar: PolygonBar) => ({
        timestamp: Math.floor(bar.t),
        open: bar.o || 0,
        high: bar.h || 0,
        low: bar.l || 0,
        close: bar.c || 0,
        volume: bar.v || 0,
      }))
      .filter((c: CandleData) => c.open > 0)
      .sort((a: CandleData, b: CandleData) => a.timestamp - b.timestamp);

    // Cache the results
    cache.set(cacheKey, { data: candles, timestamp: Date.now() });

    return candles;
  } catch (error: any) {
    console.error(`[Polygon.io] Error fetching ${ticker}:`, error.message);

    if (error.response?.status === 429) {
      throw new Error('Polygon.io rate limit exceeded. Try again in a moment.');
    }

    throw error;
  }
};

/**
 * Fetch crypto data from Polygon.io
 * @param from - Base currency (e.g., BTC)
 * @param to - Quote currency (e.g., USD)
 * @param timespan - Timespan ('minute', 'hour', 'day', 'week', 'month', 'quarter', 'year')
 * @param limit - Max number of candles to fetch (default: 50)
 */
export const fetchCryptoData = async (
  from: string,
  to: string = 'USD',
  timespan: string = 'day',
  limit: number = 50
): Promise<CandleData[]> => {
  if (!API_KEY) {
    throw new Error('POLYGON_API_KEY not configured in .env');
  }

  const cacheKey = `crypto_${from}/${to}_${timespan}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    console.log(`[Cache] Using cached crypto data for ${from}/${to}`);
    return cached.data;
  }

  try {
    console.log(`[Polygon.io] Fetching crypto data for ${from}/${to} (${timespan})...`);

    const pair = `X:${from}${to}`;
    const url = `${BASE_URL}/aggs/ticker/${pair}/range/1/${timespan}/2020-01-01/2025-12-31`;

    const response = await axios.get(url, {
      params: {
        limit: limit,
        apiKey: API_KEY,
      },
      timeout: 10000,
    });

    const data = response.data;

    // Check for errors
    if (data.status === 'NOT_FOUND') {
      throw new Error(`Crypto pair ${pair} not found on Polygon.io`);
    }

    if (!data.results || data.results.length === 0) {
      throw new Error('No crypto data returned from Polygon.io');
    }

    // Convert to candle format
    const candles: CandleData[] = data.results
      .map((bar: PolygonBar) => ({
        timestamp: Math.floor(bar.t),
        open: bar.o || 0,
        high: bar.h || 0,
        low: bar.l || 0,
        close: bar.c || 0,
        volume: bar.v || 0,
      }))
      .filter((c: CandleData) => c.open > 0)
      .sort((a: CandleData, b: CandleData) => a.timestamp - b.timestamp);

    // Cache the results
    cache.set(cacheKey, { data: candles, timestamp: Date.now() });

    return candles;
  } catch (error: any) {
    console.error(`[Polygon.io] Error fetching ${from}/${to}:`, error.message);

    if (error.response?.status === 429) {
      throw new Error('Polygon.io rate limit exceeded. Try again in a moment.');
    }

    throw error;
  }
};

/**
 * Get available stock tickers for the game
 */
export const getAvailableStocks = () => STOCK_ASSETS;

/**
 * Get available crypto pairs for the game
 */
export const getAvailableCrypto = () => CRYPTO_ASSETS;
