import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getCandleChallenge,
  submitCandlePrediction,
  getTradeScenario,
  submitTrade,
  getGameHistory,
  calculateTax,
  getSupportResistanceChallenge,
  submitSupportResistance,
  getCandleChallengeForex,
  getSupportResistanceForex,
  getForexPairs,
  getStockChallenge,
  submitStockPrediction,
  getCryptoChallenge,
  submitCryptoPrediction,
  getAvailableStocksList,
  getAvailableCryptoList,
} from '../controllers/gameController';

const router = Router();

// All game routes require authentication
router.use(authenticate);

// Candle Prediction (Generated Data)
router.get('/candle-challenge', getCandleChallenge);
router.post('/candle-challenge/submit', submitCandlePrediction);

// Candle Prediction (Real Forex Data)
router.get('/candle-challenge-forex', getCandleChallengeForex);

// Support/Resistance Drawing (Generated Data)
router.get('/support-resistance', getSupportResistanceChallenge);
router.post('/support-resistance/submit', submitSupportResistance);

// Support/Resistance Drawing (Real Forex Data)
router.get('/support-resistance-forex', getSupportResistanceForex);

// Forex Pairs
router.get('/forex-pairs', getForexPairs);

// Stock Prediction (Real Data)
router.get('/stock-challenge', getStockChallenge);
router.post('/stock-challenge/submit', submitStockPrediction);
router.get('/stocks', getAvailableStocksList);

// Crypto Prediction (Real Data)
router.get('/crypto-challenge', getCryptoChallenge);
router.post('/crypto-challenge/submit', submitCryptoPrediction);
router.get('/cryptos', getAvailableCryptoList);

// Trade Simulation
router.get('/trade-scenario', getTradeScenario);
router.post('/trade-scenario/submit', submitTrade);

// Tax Simulator
router.post('/tax-calculate', calculateTax);

// Game History
router.get('/history', getGameHistory);

export default router;
