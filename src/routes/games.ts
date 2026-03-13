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
} from '../controllers/gameController';

const router = Router();

// All game routes require authentication
router.use(authenticate);

// Candle Prediction
router.get('/candle-challenge', getCandleChallenge);
router.post('/candle-challenge/submit', submitCandlePrediction);

// Support/Resistance Drawing
router.get('/support-resistance', getSupportResistanceChallenge);
router.post('/support-resistance/submit', submitSupportResistance);

// Trade Simulation
router.get('/trade-scenario', getTradeScenario);
router.post('/trade-scenario/submit', submitTrade);

// Tax Simulator
router.post('/tax-calculate', calculateTax);

// Game History
router.get('/history', getGameHistory);

export default router;
