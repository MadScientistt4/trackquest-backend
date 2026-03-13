import axios from 'axios';

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface AlphaVantageQuote {
  '1. open': string;
  '2. high': string;
  '3. low': string;
  '4. close': string;
  '5. volume': string;
}

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'demo';
const BASE_URL = 'https://www.alphavantage.co/query';

// Cache to avoid hitting rate limits
const cache: Map<string, { data: CandleData[]; timestamp: number }> = new Map();
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetch real forex data from Alpha Vantage API
 * @param fromSymbol - Base currency (e.g., EUR)
 * @param toSymbol - Quote currency (e.g., USD)
 * @param interval - Time interval (1min, 5min, 15min, 30min, 60min, or daily)
 * @param outputSize - 'compact' (100 recent) or 'full' (20+ years)
 */
export const fetchForexData = async (
  fromSymbol: string = 'EUR',
  toSymbol: string = 'USD',
  interval: string = '60min',
  outputSize: 'compact' | 'full' = 'compact'
): Promise<CandleData[]> => {
  const cacheKey = `${fromSymbol}/${toSymbol}/${interval}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    console.log(`[Cache] Using cached data for ${cacheKey}`);
    return cached.data;
  }

  try {
    console.log(`[Alpha Vantage] Fetching ${fromSymbol}/${toSymbol} ${interval}...`);

    const params = {
      function: 'FX_INTRADAY',
      from_symbol: fromSymbol,
      to_symbol: toSymbol,
      interval: interval,
      outputsize: outputSize,
      apikey: API_KEY,
    };

    const response = await axios.get(BASE_URL, { params, timeout: 10000 });
    const data = response.data;

    // Check for API errors
    if (data['Error Message']) {
      throw new Error(`Alpha Vantage Error: ${data['Error Message']}`);
    }

    if (data['Note']) {
      throw new Error(
        `Alpha Vantage Rate Limited: ${data['Note']}. Use your own API key from https://www.alphavantage.co/api/`
      );
    }

    // Extract time series data
    const timeSeriesKey = `Time Series (${interval})`;
    const timeSeries = data[timeSeriesKey];

    if (!timeSeries) {
      throw new Error('No time series data returned from Alpha Vantage');
    }

    // Convert to candle format
    const candles: CandleData[] = Object.entries(timeSeries)
      .map(([dateStr, quote]: [string, any]) => {
        const timestamp = new Date(dateStr).getTime();
        return {
          timestamp,
          open: parseFloat((quote['1. open'] as string) || '0'),
          high: parseFloat((quote['2. high'] as string) || '0'),
          low: parseFloat((quote['3. low'] as string) || '0'),
          close: parseFloat((quote['4. close'] as string) || '0'),
          volume: parseInt((quote['5. volume'] as string) || '0', 10),
        };
      })
      .filter(c => c.open > 0) // Remove invalid entries
      .sort((a, b) => a.timestamp - b.timestamp) // Sort by time ascending
      .slice(-50); // Get last 50 candles

    if (candles.length === 0) {
      throw new Error('No valid candle data extracted from Alpha Vantage');
    }

    // Cache the result
    cache.set(cacheKey, { data: candles, timestamp: Date.now() });

    console.log(`[Alpha Vantage] Successfully fetched ${candles.length} candles`);
    return candles;
  } catch (error) {
    console.error('[Alpha Vantage] Error:', error instanceof Error ? error.message : error);
    throw error;
  }
};

/**
 * Fetch crypto data (Bitcoin, Ethereum) from Alpha Vantage
 */
export const fetchCryptoData = async (
  symbol: string = 'BTC',
  market: string = 'USD',
  interval: string = '60min',
  outputSize: 'compact' | 'full' = 'compact'
): Promise<CandleData[]> => {
  const cacheKey = `crypto-${symbol}/${market}/${interval}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    console.log(`[Cache] Using cached data for ${cacheKey}`);
    return cached.data;
  }

  try {
    console.log(`[Alpha Vantage] Fetching ${symbol}/${market}...`);

    const params = {
      function: 'CRYPTO_INTRADAY',
      symbol: symbol,
      market: market,
      interval: interval,
      outputsize: outputSize,
      apikey: API_KEY,
    };

    const response = await axios.get(BASE_URL, { params, timeout: 10000 });
    const data = response.data;

    if (data['Error Message']) {
      throw new Error(`Alpha Vantage Error: ${data['Error Message']}`);
    }

    if (data['Note']) {
      throw new Error(
        `Alpha Vantage Rate Limited: ${data['Note']}. Use your own API key from https://www.alphavantage.co/api/`
      );
    }

    const timeSeriesKey = `Time Series Crypto (${interval})`;
    const timeSeries = data[timeSeriesKey];

    if (!timeSeries) {
      throw new Error('No crypto time series data returned from Alpha Vantage');
    }

    const candles: CandleData[] = Object.entries(timeSeries)
      .map(([dateStr, quote]: [string, any]) => {
        const timestamp = new Date(dateStr).getTime();
        return {
          timestamp,
          open: parseFloat((quote['1a. open (USD)'] as string) || '0'),
          high: parseFloat((quote['2a. high (USD)'] as string) || '0'),
          low: parseFloat((quote['3a. low (USD)'] as string) || '0'),
          close: parseFloat((quote['4a. close (USD)'] as string) || '0'),
          volume: parseFloat((quote['5. volume'] as string) || '0'),
        };
      })
      .filter(c => c.open > 0)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-50);

    if (candles.length === 0) {
      throw new Error('No valid crypto candle data extracted from Alpha Vantage');
    }

    cache.set(cacheKey, { data: candles, timestamp: Date.now() });
    console.log(`[Alpha Vantage] Successfully fetched ${candles.length} crypto candles`);
    return candles;
  } catch (error) {
    console.error('[Alpha Vantage] Error:', error instanceof Error ? error.message : error);
    throw error;
  }
};

/**
 * Get list of supported forex pairs
 */
export const FOREX_PAIRS = [
  { symbol: 'EUR/USD', from: 'EUR', to: 'USD', label: 'Euro vs US Dollar' },
  { symbol: 'GBP/USD', from: 'GBP', to: 'USD', label: 'British Pound vs US Dollar' },
  { symbol: 'USD/JPY', from: 'USD', to: 'JPY', label: 'US Dollar vs Japanese Yen' },
  { symbol: 'AUD/USD', from: 'AUD', to: 'USD', label: 'Australian Dollar vs US Dollar' },
  { symbol: 'USD/CAD', from: 'USD', to: 'CAD', label: 'US Dollar vs Canadian Dollar' },
  { symbol: 'USD/CHF', from: 'USD', to: 'CHF', label: 'US Dollar vs Swiss Franc' },
];

/**
 * Get list of supported crypto symbols
 */
export const CRYPTO_SYMBOLS = [
  { symbol: 'BTC', label: 'Bitcoin', market: 'USD' },
  { symbol: 'ETH', label: 'Ethereum', market: 'USD' },
  { symbol: 'LTC', label: 'Litecoin', market: 'USD' },
  { symbol: 'BNB', label: 'Binance Coin', market: 'USD' },
];
