import 'dotenv/config';
import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import cors from 'cors';
import axios from 'axios';
import { EventEmitter } from 'events';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Gemma 4 + szybki Gemini fallback (bez retry — natychmiast kolejny model)
const AI_MODELS = [
  'gemma-4-26b-a4b-it',
  'gemma-4-31b-it',
  'gemini-2.0-flash'
];

const aiCache = {};
const AI_CACHE_TTL = 5 * 60 * 1000; // 5 minut

async function generateWithFallback(prompt, systemPrompt) {
  const cacheKey = prompt.substring(0, 200);
  if (aiCache[cacheKey] && (Date.now() - aiCache[cacheKey].ts) < AI_CACHE_TTL) {
    console.log('⚡ AI cache hit');
    return aiCache[cacheKey].text;
  }

  let lastError = null;
  for (const modelName of AI_MODELS) {
    try {
      console.log(`🤖 Próbuję model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1500,
        },
      });
      const text = result.response.text();
      console.log(`✅ Model ${modelName} — OK`);
      aiCache[cacheKey] = { text, ts: Date.now() };
      return text;
    } catch (err) {
      console.error(`⚠️ ${modelName}: ${(err.message || '').substring(0, 100)}`);
      lastError = err;
    }
  }
  throw new Error('AI niedostępne. Ostatni błąd: ' + (lastError?.message?.substring(0, 100) || 'nieznany'));
}

const dataCache = {};
const newsCache = {};
const newsEmitter = new EventEmitter();
const CACHE_TTL = 5 * 60 * 1000;
const NEWS_CACHE_TTL = 15 * 60 * 1000;
const NEWS_CHECK_INTERVAL = 5 * 60 * 1000; // Sprawdzaj co 5 minut

const COINGECKO_MAP = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'SOL': 'solana',
  'XRP': 'ripple',
  'BNB': 'binancecoin',
  'LTC': 'litecoin',
  'BCH': 'bitcoin-cash',
  'LINK': 'chainlink',
  'AVAX': 'avalanche-2',
  'MATIC': 'matic-network',
  'UNI': 'uniswap',
  'SHIB': 'shiba-inu',
  'ATOM': 'cosmos',
  'NEAR': 'near',
  'POLKA': 'polkadot',
  'DOT': 'polkadot',
  'ICP': 'internet-computer',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'PEPE': 'pepe',
  'FLOKI': 'floki',
  'MEME': 'memecoin',
  'WIF': 'dogwifhat',
  'BONK': 'bonk',
  'JUP': 'jupiter',
  'SAGA': 'saga',
  'GMX': 'gmx',
  'BLUR': 'blur'
};

// Mapowanie tickerów na słowa kluczowe do filtrowania wiadomości Finnhub
const TICKER_KEYWORDS = {
  'BTC': ['bitcoin', 'btc'],
  'ETH': ['ethereum', 'eth', 'ether'],
  'ADA': ['cardano', 'ada'],
  'DOGE': ['dogecoin', 'doge'],
  'SOL': ['solana', 'sol'],
  'XRP': ['ripple', 'xrp'],
  'BNB': ['binance', 'bnb'],
  'LTC': ['litecoin', 'ltc'],
  'BCH': ['bitcoin cash', 'bch'],
  'LINK': ['chainlink', 'link'],
  'AVAX': ['avalanche', 'avax'],
  'MATIC': ['polygon', 'matic'],
  'UNI': ['uniswap', 'uni'],
  'SHIB': ['shiba', 'shib'],
  'ATOM': ['cosmos', 'atom'],
  'NEAR': ['near protocol', 'near'],
  'DOT': ['polkadot', 'dot'],
  'POLKA': ['polkadot'],
  'ICP': ['internet computer', 'icp'],
  'ARB': ['arbitrum', 'arb'],
  'OP': ['optimism'],
  'PEPE': ['pepe'],
  'FLOKI': ['floki'],
  'MEME': ['memecoin', 'meme'],
  'WIF': ['dogwifhat', 'wif'],
  'BONK': ['bonk'],
  'JUP': ['jupiter', 'jup'],
  'SAGA': ['saga'],
  'GMX': ['gmx'],
  'BLUR': ['blur']
};

// ======================== IMPORTANT KEYWORDS ========================

const IMPORTANT_KEYWORDS = {
  'VERY_HIGH': [
    'SEC', 'lawsuit', 'hack', 'vulnerability', 'breach', 'exploit',
    'bankruptcy', 'collapse', 'shutdown', 'delisting', 'banned',
    'fraud', 'scandal', 'investigation', 'arrest', 'crash',
    'bitcoin ETF', 'ethereum ETF', 'regulation', 'approved',
    'partnership', 'acquisition', 'merger', 'IPO', 'listing',
    'upgrade', 'halving', 'fork', 'mainstream adoption'
  ],
  'HIGH': [
    'bull', 'bear', 'pump', 'dump', 'surge', 'rally',
    'drop', 'fall', 'support', 'resistance', 'trend',
    'analysis', 'prediction', 'forecast', 'technical',
    'institutional', 'whale', 'buy', 'sell', 'trading'
  ],
  'MEDIUM': [
    'update', 'release', 'news', 'announcement', 'report',
    'market', 'price', 'volume', 'sentiment', 'fear'
  ]
};

// ======================== WSKAŹNIKI ========================

function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let avgGain = 0, avgLoss = 0;
  // Pierwsza średnia (SMA)
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;
  // Wilder smoothing
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function calculateSMA(prices, period) {
  if (prices.length < period) return prices[prices.length - 1];
  return prices.slice(-period).reduce((a, b) => a + b) / period;
}

function calculateEMA(prices, period) {
  if (prices.length < period) return prices[prices.length - 1];
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateMACD(prices) {
  if (prices.length < 26) return { macdLine: '0', signalLine: '0', histogram: '0', signal: 'NEUTRALNY' };
  // Iteracyjne EMA12 i EMA26
  const k12 = 2 / 13, k26 = 2 / 27;
  let ema12 = prices.slice(0, 12).reduce((a, b) => a + b) / 12;
  let ema26 = prices.slice(0, 26).reduce((a, b) => a + b) / 26;
  for (let i = 12; i < 26; i++) ema12 = prices[i] * k12 + ema12 * (1 - k12);
  const macdValues = [];
  for (let i = 26; i < prices.length; i++) {
    ema12 = prices[i] * k12 + ema12 * (1 - k12);
    ema26 = prices[i] * k26 + ema26 * (1 - k26);
    macdValues.push(ema12 - ema26);
  }
  // Signal line (EMA9 z MACD)
  const k9 = 2 / 10;
  let signal = macdValues.length >= 9
    ? macdValues.slice(0, 9).reduce((a, b) => a + b) / 9
    : macdValues[macdValues.length - 1];
  for (let i = 9; i < macdValues.length; i++) {
    signal = macdValues[i] * k9 + signal * (1 - k9);
  }
  const macdLine = macdValues[macdValues.length - 1];
  const histogram = macdLine - signal;
  return {
    macdLine: macdLine.toFixed(2),
    signalLine: signal.toFixed(2),
    histogram: histogram.toFixed(2),
    signal: histogram > 0 ? 'BYCZY' : 'NIEDŹWIEDZI'
  };
}

function calculateBollingerBands(closes, period = 20) {
  if (closes.length < period) return { upper: closes[closes.length - 1], middle: closes[closes.length - 1], lower: closes[closes.length - 1], width: 0 };
  const slice = closes.slice(-period);
  const sma = slice.reduce((a, b) => a + b) / period;
  const variance = slice.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    upper: sma + 2 * stdDev,
    middle: sma,
    lower: sma - 2 * stdDev,
    width: ((sma + 2 * stdDev) - (sma - 2 * stdDev)) / sma * 100
  };
}

function calculateATR(candles, period = 14) {
  if (candles.length < 2) return 0;
  const trueRanges = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    trueRanges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  if (trueRanges.length < period) return trueRanges.reduce((a, b) => a + b) / trueRanges.length;
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }
  return atr;
}

// ADX — siła trendu (0-100, >25 = silny trend)
function calculateADX(candles, period = 14) {
  if (candles.length < period + 1) return { adx: 25, plusDI: 50, minusDI: 50, trend: 'BRAK DANYCH' };
  
  const trueRanges = [], plusDMs = [], minusDMs = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high, low = candles[i].low;
    const prevHigh = candles[i - 1].high, prevLow = candles[i - 1].low, prevClose = candles[i - 1].close;
    
    trueRanges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    const plusDM = (high - prevHigh) > (prevLow - low) && (high - prevHigh) > 0 ? high - prevHigh : 0;
    const minusDM = (prevLow - low) > (high - prevHigh) && (prevLow - low) > 0 ? prevLow - low : 0;
    plusDMs.push(plusDM);
    minusDMs.push(minusDM);
  }

  // Wilder smoothed TR, +DM, -DM
  let smoothTR = trueRanges.slice(0, period).reduce((a, b) => a + b);
  let smoothPlusDM = plusDMs.slice(0, period).reduce((a, b) => a + b);
  let smoothMinusDM = minusDMs.slice(0, period).reduce((a, b) => a + b);
  
  const dxValues = [];
  for (let i = period; i < trueRanges.length; i++) {
    smoothTR = smoothTR - (smoothTR / period) + trueRanges[i];
    smoothPlusDM = smoothPlusDM - (smoothPlusDM / period) + plusDMs[i];
    smoothMinusDM = smoothMinusDM - (smoothMinusDM / period) + minusDMs[i];
    
    const plusDI = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const minusDI = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    const diSum = plusDI + minusDI;
    const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
    dxValues.push({ dx, plusDI, minusDI });
  }
  
  if (dxValues.length < period) {
    const last = dxValues[dxValues.length - 1] || { dx: 25, plusDI: 50, minusDI: 50 };
    return { adx: last.dx, plusDI: last.plusDI, minusDI: last.minusDI, trend: last.dx > 25 ? (last.plusDI > last.minusDI ? 'SILNY WZROST' : 'SILNY SPADEK') : 'BOCZNY' };
  }
  
  let adx = dxValues.slice(0, period).reduce((a, b) => a + b.dx, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i].dx) / period;
  }
  
  const last = dxValues[dxValues.length - 1];
  let trend = 'BOCZNY';
  if (adx > 25) trend = last.plusDI > last.minusDI ? 'SILNY WZROST' : 'SILNY SPADEK';
  else if (adx > 20) trend = 'SŁABY TREND';
  
  return { adx: parseFloat(adx.toFixed(1)), plusDI: parseFloat(last.plusDI.toFixed(1)), minusDI: parseFloat(last.minusDI.toFixed(1)), trend };
}

// Stochastic RSI — lepszy overbought/oversold
function calculateStochRSI(closes, rsiPeriod = 14, stochPeriod = 14) {
  if (closes.length < rsiPeriod + stochPeriod + 1) return { k: 50, d: 50, signal: 'NEUTRALNY' };
  
  // Oblicz serię RSI
  const rsiValues = [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= rsiPeriod; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
  }
  avgGain /= rsiPeriod;
  avgLoss /= rsiPeriod;
  rsiValues.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
  
  for (let i = rsiPeriod + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (rsiPeriod - 1) + (diff > 0 ? diff : 0)) / rsiPeriod;
    avgLoss = (avgLoss * (rsiPeriod - 1) + (diff < 0 ? Math.abs(diff) : 0)) / rsiPeriod;
    rsiValues.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
  }
  
  if (rsiValues.length < stochPeriod) return { k: 50, d: 50, signal: 'NEUTRALNY' };
  
  // Stochastic on RSI values
  const kValues = [];
  for (let i = stochPeriod - 1; i < rsiValues.length; i++) {
    const window = rsiValues.slice(i - stochPeriod + 1, i + 1);
    const minRSI = Math.min(...window);
    const maxRSI = Math.max(...window);
    kValues.push(maxRSI === minRSI ? 50 : ((rsiValues[i] - minRSI) / (maxRSI - minRSI)) * 100);
  }
  
  const k = kValues[kValues.length - 1];
  const d = kValues.length >= 3 ? kValues.slice(-3).reduce((a, b) => a + b) / 3 : k;
  
  let signal = 'NEUTRALNY';
  if (k > 80 && d > 80) signal = 'WYKUPIONY';
  else if (k < 20 && d < 20) signal = 'WYPRZEDANY';
  else if (k > d && k < 80) signal = 'BYCZY';
  else if (k < d && k > 20) signal = 'NIEDŹWIEDZI';
  
  return { k: parseFloat(k.toFixed(1)), d: parseFloat(d.toFixed(1)), signal };
}

// OBV — On-Balance Volume (potwierdza trend wolumenem)
function calculateOBV(candles) {
  if (candles.length < 2) return { obv: 0, trend: 'BRAK DANYCH', divergence: false };
  
  let obv = 0;
  const obvValues = [0];
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) obv += candles[i].volume;
    else if (candles[i].close < candles[i - 1].close) obv -= candles[i].volume;
    obvValues.push(obv);
  }
  
  // OBV trend (last 10 candles)
  const recent = obvValues.slice(-10);
  const obvTrend = recent[recent.length - 1] > recent[0] ? 'WZROSTOWY' : 'SPADKOWY';
  
  // Dywergencja: cena rośnie ale OBV spada = bearish divergence
  const priceUp = candles[candles.length - 1].close > candles[Math.max(0, candles.length - 10)].close;
  const obvUp = obvValues[obvValues.length - 1] > obvValues[Math.max(0, obvValues.length - 10)];
  const divergence = priceUp !== obvUp;
  
  return {
    obv: obv,
    trend: obvTrend,
    divergence,
    divergenceType: divergence ? (priceUp && !obvUp ? 'NIEDŹWIEDZIA' : 'BYCZA') : 'BRAK'
  };
}

// Dywergencja RSI — najsilniejszy sygnał reversal
function detectRSIDivergence(closes, period = 14) {
  if (closes.length < period + 20) return { detected: false, type: 'BRAK' };
  
  // Oblicz RSI dla ostatnich 20 punktów
  const rsiValues = [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
  }
  avgGain /= period; avgLoss /= period;
  
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
    rsiValues.push({ rsi: avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)), price: closes[i] });
  }
  
  if (rsiValues.length < 10) return { detected: false, type: 'BRAK' };
  
  const recent = rsiValues.slice(-10);
  const mid = Math.floor(recent.length / 2);
  
  // Bearish: cena robi wyższy szczyt, RSI niższy szczyt
  const priceHigher = recent[recent.length - 1].price > recent[mid].price;
  const rsiLower = recent[recent.length - 1].rsi < recent[mid].rsi;
  if (priceHigher && rsiLower && recent[recent.length - 1].rsi > 50) {
    return { detected: true, type: 'NIEDŹWIEDZIA (cena ↑ RSI ↓)' };
  }
  
  // Bullish: cena robi niższy dół, RSI wyższy dół
  const priceLower = recent[recent.length - 1].price < recent[mid].price;
  const rsiHigher = recent[recent.length - 1].rsi > recent[mid].rsi;
  if (priceLower && rsiHigher && recent[recent.length - 1].rsi < 50) {
    return { detected: true, type: 'BYCZA (cena ↓ RSI ↑)' };
  }
  
  return { detected: false, type: 'BRAK' };
}

function calculateSAR(candles) {
  if (candles.length < 2) return { sar: 0, trend: 'N/A' };
  
  let sar = candles[0].low;
  let trend = 'UP';
  let af = 0.02;
  let maxAf = 0.2;
  let hp = candles[0].high;
  let lp = candles[0].low;

  for (let i = 1; i < candles.length; i++) {
    if (trend === 'UP') {
      sar = sar + af * (hp - sar);
      if (candles[i].low < sar) {
        trend = 'DOWN';
        sar = hp;
        hp = candles[i].low;
        lp = candles[i].low;
        af = 0.02;
      } else {
        if (candles[i].high > hp) {
          hp = candles[i].high;
          af = Math.min(af + 0.02, maxAf);
        }
        if (candles[i].low < lp) {
          lp = candles[i].low;
        }
      }
    } else {
      sar = sar - af * (sar - lp);
      if (candles[i].high > sar) {
        trend = 'UP';
        sar = lp;
        hp = candles[i].high;
        lp = candles[i].low;
        af = 0.02;
      } else {
        if (candles[i].low < lp) {
          lp = candles[i].low;
          af = Math.min(af + 0.02, maxAf);
        }
        if (candles[i].high > hp) {
          hp = candles[i].high;
        }
      }
    }
  }

  return {
    sar: sar.toFixed(2),
    trend: trend === 'UP' ? 'WZROSTOWY' : 'SPADKOWY',
    signal: trend === 'UP' ? 'BYCZY' : 'NIEDŹWIEDZI'
  };
}

function detectCandlePatterns(candles) {
  if (candles.length < 3) return [];
  
  const patterns = [];
  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];
  const prevPrevCandle = candles[candles.length - 3];

  const bodySize = (c) => Math.abs(c.close - c.open);
  const wickSize = (c) => c.high - c.low;
  const isGreen = (c) => c.close > c.open;

  if (wickSize(lastCandle) === 0) return ['Brak danych'];

  if (isGreen(lastCandle) && bodySize(lastCandle) < wickSize(lastCandle) / 3) {
    patterns.push('🔨 HAMMER - Potencjalny reversal wzrostowy');
  }

  if (!isGreen(lastCandle) && bodySize(lastCandle) < wickSize(lastCandle) / 3) {
    patterns.push('👤 HANGING MAN - Potencjalny reversal spadkowy');
  }

  if (Math.abs(lastCandle.close - lastCandle.open) < wickSize(lastCandle) * 0.05) {
    patterns.push('✝️ DOJI - Indecisja rynkowa');
  }

  if (isGreen(lastCandle) && !isGreen(prevCandle) && 
      lastCandle.close > prevCandle.open && lastCandle.open < prevCandle.close) {
    patterns.push('📈 BULLISH ENGULFING - Silny sygnał wzrostowy');
  }

  if (!isGreen(lastCandle) && isGreen(prevCandle) && 
      lastCandle.close < prevCandle.open && lastCandle.open > prevCandle.close) {
    patterns.push('📉 BEARISH ENGULFING - Silny sygnał spadkowy');
  }

  return patterns.length > 0 ? patterns : ['Brak charakterystycznych formacji'];
}

// ======================== IMPORTANCE SCORING ========================

function calculateImportanceScore(text) {
  const lower = text.toLowerCase();
  let score = 0;

  // Bardzo wysokie
  for (let word of IMPORTANT_KEYWORDS.VERY_HIGH) {
    if (lower.includes(word.toLowerCase())) {
      score += 3;
    }
  }

  // Wysokie
  for (let word of IMPORTANT_KEYWORDS.HIGH) {
    if (lower.includes(word.toLowerCase())) {
      score += 2;
    }
  }

  // Średnie
  for (let word of IMPORTANT_KEYWORDS.MEDIUM) {
    if (lower.includes(word.toLowerCase())) {
      score += 1;
    }
  }

  return score;
}

function getImportanceLevel(score) {
  if (score >= 9) return '🔴 KRYTYCZNA';
  if (score >= 6) return '🟠 BARDZO WAŻNA';
  if (score >= 3) return '🟡 WAŻNA';
  return '🟢 NORMALNA';
}

// ======================== WIADOMOŚCI ========================

// Globalny cache na surowe dane z Finnhub (jeden request dla wszystkich tickerów)
let finnhubRawCache = { data: [], timestamp: 0 };
const FINNHUB_RAW_TTL = 10 * 60 * 1000; // 10 minut

async function fetchFinnhubRaw() {
  if (finnhubRawCache.data.length > 0 && (Date.now() - finnhubRawCache.timestamp) < FINNHUB_RAW_TTL) {
    return finnhubRawCache.data;
  }

  console.log(`📰 Pobieranie globalnych wiadomości z Finnhub...`);
  const newsRes = await axios.get(
    `https://finnhub.io/api/v1/news`,
    {
      params: {
        category: 'crypto',
        token: process.env.FINNHUB_API_KEY
      },
      timeout: 8000
    }
  );

  if (Array.isArray(newsRes.data)) {
    finnhubRawCache = { data: newsRes.data, timestamp: Date.now() };
    console.log(`📰 Finnhub: pobrano ${newsRes.data.length} artykułów globalnych`);
    return newsRes.data;
  }
  return [];
}

async function getCryptoNews(ticker) {
  try {
    if (newsCache[ticker] && (Date.now() - newsCache[ticker].timestamp) < NEWS_CACHE_TTL) {
      return newsCache[ticker].data;
    }

    const allArticles = await fetchFinnhubRaw();

    // Filtruj wiadomości po słowach kluczowych tickera
    const keywords = TICKER_KEYWORDS[ticker.toUpperCase()] || [ticker.toLowerCase()];
    
    const filtered = allArticles.filter(article => {
      const text = (article.headline + ' ' + (article.summary || '')).toLowerCase();
      return keywords.some(kw => text.includes(kw));
    });

    // Jeśli brak dopasowań, weź ogólne kryptonewsy
    const articlesToUse = filtered.length > 0 ? filtered.slice(0, 10) : allArticles.slice(0, 5);

    const news = articlesToUse.map(article => {
      const fullText = article.headline + ' ' + (article.summary || '');
      const importance = calculateImportanceScore(fullText);
      const importanceLevel = getImportanceLevel(importance);
      
      return {
        title: article.headline,
        body: (article.summary || '').substring(0, 150) + '...',
        source: article.source,
        url: article.url,
        image: article.image || null,
        published: new Date(article.datetime * 1000).toLocaleString('pl-PL'),
        sentiment: analyzeSentiment(fullText),
        importance: importance,
        importanceLevel: importanceLevel,
        isImportant: importance >= 3
      };
    }).sort((a, b) => b.importance - a.importance);

    newsCache[ticker] = {
      data: news,
      timestamp: Date.now()
    };

    // Emituj ważne wiadomości
    const importantNews = news.filter(n => n.isImportant);
    if (importantNews.length > 0) {
      importantNews.forEach(n => {
        newsEmitter.emit('important-news', {
          ticker,
          ...n
        });
      });
    }

    console.log(`📰 Finnhub: ${news.length} artykułów dla ${ticker}`);
    return news;
  } catch (err) {
    console.error(`⚠️ Finnhub News error: ${err.message}`);
    return [];
  }
}

function analyzeSentiment(text) {
  const positiveWords = ['moon', 'pump', 'bull', 'surge', 'gain', 'rally', 'partnership', 'launch', 'bullish', 'up', 'positive', 'approved', 'success'];
  const negativeWords = ['crash', 'dump', 'bear', 'drop', 'loss', 'bearish', 'down', 'hack', 'scam', 'fraud', 'negative', 'rejected', 'failure'];
  
  const lower = text.toLowerCase();
  let positive = positiveWords.filter(word => lower.includes(word)).length;
  let negative = negativeWords.filter(word => lower.includes(word)).length;
  
  if (positive > negative) return 'POZYTYWNA 📈';
  if (negative > positive) return 'NEGATYWNA 📉';
  return 'NEUTRALNA ➡️';
}

// ======================== FEAR & GREED ========================

let fngCache = { value: null, timestamp: 0 };

async function getFearAndGreed() {
  if (fngCache.value && (Date.now() - fngCache.timestamp) < 30 * 60 * 1000) {
    return fngCache.value;
  }
  try {
    const res = await axios.get('https://api.alternative.me/fng/', { timeout: 5000 });
    const data = res.data?.data?.[0];
    if (data) {
      fngCache = { value: { value: parseInt(data.value), classification: data.value_classification }, timestamp: Date.now() };
      return fngCache.value;
    }
  } catch (e) {
    console.log('⚠️ Fear & Greed API niedostępne');
  }
  return { value: 50, classification: 'Neutral' };
}

// ======================== COMPOSITE SCORING ========================

function calculateCompositeScore(data) {
  let score = 0;
  let signals = { bullish: 0, bearish: 0, neutral: 0 };
  const details = [];

  // RSI (waga 15%)
  if (data.rsi < 30) { score += 15; signals.bullish++; details.push('RSI wyprzedany → KUPUJ'); }
  else if (data.rsi > 70) { score -= 15; signals.bearish++; details.push('RSI wykupiony → SPRZEDAJ'); }
  else if (data.rsi > 50) { score += 5; signals.bullish++; }
  else { score -= 5; signals.bearish++; }

  // MACD (waga 15%)
  if (data.macd.signal === 'BYCZY') { score += 15; signals.bullish++; details.push('MACD byczy crossover'); }
  else { score -= 15; signals.bearish++; details.push('MACD niedźwiedzi'); }

  // ADX + DI (waga 15%)
  if (data.adx.adx > 25) {
    if (data.adx.plusDI > data.adx.minusDI) { score += 15; signals.bullish++; details.push(`ADX ${data.adx.adx} silny trend wzrostowy`); }
    else { score -= 15; signals.bearish++; details.push(`ADX ${data.adx.adx} silny trend spadkowy`); }
  } else { signals.neutral++; details.push(`ADX ${data.adx.adx} brak silnego trendu`); }

  // Stochastic RSI (waga 10%)
  if (data.stochRsi.signal === 'WYPRZEDANY') { score += 10; signals.bullish++; }
  else if (data.stochRsi.signal === 'WYKUPIONY') { score -= 10; signals.bearish++; }
  else if (data.stochRsi.signal === 'BYCZY') { score += 5; signals.bullish++; }
  else if (data.stochRsi.signal === 'NIEDŹWIEDZI') { score -= 5; signals.bearish++; }

  // SAR (waga 10%)
  if (data.sar.signal === 'BYCZY') { score += 10; signals.bullish++; }
  else { score -= 10; signals.bearish++; }

  // Bollinger position (waga 10%)
  if (data.price < data.bb.lower) { score += 10; signals.bullish++; details.push('Cena pod dolnym Bollingerem'); }
  else if (data.price > data.bb.upper) { score -= 10; signals.bearish++; details.push('Cena nad górnym Bollingerem'); }

  // OBV divergence (waga 10%)
  if (data.obv.divergence) {
    if (data.obv.divergenceType === 'BYCZA') { score += 10; signals.bullish++; details.push('Dywergencja OBV bycza'); }
    else { score -= 10; signals.bearish++; details.push('Dywergencja OBV niedźwiedzia'); }
  }

  // RSI divergence (waga 10%)
  if (data.rsiDivergence.detected) {
    if (data.rsiDivergence.type.includes('BYCZA')) { score += 10; signals.bullish++; details.push('⚠️ Dywergencja RSI BYCZA'); }
    else { score -= 10; signals.bearish++; details.push('⚠️ Dywergencja RSI NIEDŹWIEDZIA'); }
  }

  // Fear & Greed (waga 5%)
  if (data.fearGreed.value < 25) { score += 5; details.push(`Fear & Greed: ${data.fearGreed.value} (Extreme Fear)`); }
  else if (data.fearGreed.value > 75) { score -= 5; details.push(`Fear & Greed: ${data.fearGreed.value} (Extreme Greed)`); }

  // Normalize to -100..+100
  const normalized = Math.max(-100, Math.min(100, score));
  
  let decision;
  if (normalized > 30) decision = 'KUPUJ';
  else if (normalized > 10) decision = 'LEKKI KUPUJ';
  else if (normalized < -30) decision = 'SPRZEDAJ';
  else if (normalized < -10) decision = 'LEKKI SPRZEDAJ';
  else decision = 'TRZYMAJ';

  const confidence = Math.min(95, Math.abs(normalized) + Math.max(signals.bullish, signals.bearish) * 5);
  const risk = Math.abs(normalized) < 20 ? 'wysokie' : Math.abs(normalized) < 50 ? 'średnie' : 'niskie';

  return {
    score: normalized,
    decision,
    confidence,
    risk,
    signals,
    details
  };
}

// ======================== FIBONACCI ========================

function calculateFibonacci(high, low) {
  const diff = high - low;
  return [
    { level: 0, price: +low.toFixed(2), label: '0%' },
    { level: 0.236, price: +(low + diff * 0.236).toFixed(2), label: '23.6%' },
    { level: 0.382, price: +(low + diff * 0.382).toFixed(2), label: '38.2%' },
    { level: 0.5, price: +(low + diff * 0.5).toFixed(2), label: '50%' },
    { level: 0.618, price: +(low + diff * 0.618).toFixed(2), label: '61.8%' },
    { level: 0.786, price: +(low + diff * 0.786).toFixed(2), label: '78.6%' },
    { level: 1, price: +high.toFixed(2), label: '100%' }
  ];
}

// ======================== OVERLAY SERIES ========================

function calculateRSISeries(closes, period = 14) {
  const result = new Array(Math.min(period, closes.length)).fill(null);
  if (closes.length < period + 1) return result;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
  }
  avgGain /= period; avgLoss /= period;
  result.push(avgLoss === 0 ? 100 : +(100 - (100 / (1 + avgGain / avgLoss))).toFixed(2));
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
    result.push(avgLoss === 0 ? 100 : +(100 - (100 / (1 + avgGain / avgLoss))).toFixed(2));
  }
  return result;
}

function calculateOverlayEMASeries(prices, period) {
  const result = new Array(Math.min(period - 1, prices.length)).fill(null);
  if (prices.length < period) return result;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b) / period;
  result.push(+ema.toFixed(2));
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    result.push(+ema.toFixed(2));
  }
  return result;
}

function calculateOverlaySMASeries(prices, period) {
  const result = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    const slice = prices.slice(i - period + 1, i + 1);
    result.push(+(slice.reduce((a, b) => a + b) / period).toFixed(2));
  }
  return result;
}

function calculateOverlayBBSeries(closes, period = 20) {
  const result = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result.push({ upper: null, middle: null, lower: null }); continue; }
    const slice = closes.slice(i - period + 1, i + 1);
    const sma = slice.reduce((a, b) => a + b) / period;
    const stdDev = Math.sqrt(slice.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period);
    result.push({ upper: +(sma + 2 * stdDev).toFixed(2), middle: +sma.toFixed(2), lower: +(sma - 2 * stdDev).toFixed(2) });
  }
  return result;
}

// ======================== MICRO/MACRO TREND ========================

function analyzeMicroTrend(data) {
  let score = 0;
  const details = [];
  if (data.rsi > 60) { score += 2; details.push('RSI > 60 (momentum byczy)'); }
  else if (data.rsi < 40) { score -= 2; details.push('RSI < 40 (momentum niedźwiedzi)'); }
  else { details.push('RSI neutralne'); }
  if (data.stochRsi.k > data.stochRsi.d) { score += 1; details.push('StochRSI K > D (byczy)'); }
  else { score -= 1; details.push('StochRSI K < D (niedźwiedzi)'); }
  const hist = parseFloat(data.macd.histogram);
  if (hist > 0) { score += 2; details.push('MACD histogram +'); }
  else { score -= 2; details.push('MACD histogram \u2212'); }
  if (data.sar.signal === 'BYCZY') { score += 1; details.push('SAR byczy'); }
  else { score -= 1; details.push('SAR niedźwiedzi'); }
  let rec;
  if (score >= 4) rec = 'KUPUJ';
  else if (score >= 2) rec = 'LEKKI KUPUJ';
  else if (score <= -4) rec = 'SPRZEDAJ';
  else if (score <= -2) rec = 'LEKKI SPRZEDAJ';
  else rec = 'TRZYMAJ';
  return { score, recommendation: rec, details, timeframe: '1-7 dni' };
}

function analyzeMacroTrend(data) {
  let score = 0;
  const details = [];
  if (data.sma20 > data.sma50) { score += 2; details.push('SMA20 > SMA50 (z\u0142oty krzy\u017c)'); }
  else { score -= 2; details.push('SMA20 < SMA50 (krzy\u017c \u015bmierci)'); }
  if (data.ema12 > data.ema26) { score += 2; details.push('EMA12 > EMA26'); }
  else { score -= 2; details.push('EMA12 < EMA26'); }
  if (data.adx.adx > 25) {
    if (data.adx.plusDI > data.adx.minusDI) { score += 2; details.push('ADX ' + data.adx.adx + ' silny wzrost'); }
    else { score -= 2; details.push('ADX ' + data.adx.adx + ' silny spadek'); }
  } else { details.push('ADX ' + data.adx.adx + ' \u2014 brak silnego trendu'); }
  if (data.price > data.sma50) { score += 1; details.push('Cena > SMA50'); }
  else { score -= 1; details.push('Cena < SMA50'); }
  if (data.price < data.bb.lower) { score += 1; details.push('Pod dolnym Bollingerem'); }
  else if (data.price > data.bb.upper) { score -= 1; details.push('Nad g\u00f3rnym Bollingerem'); }
  let rec;
  if (score >= 5) rec = 'KUPUJ';
  else if (score >= 2) rec = 'LEKKI KUPUJ';
  else if (score <= -5) rec = 'SPRZEDAJ';
  else if (score <= -2) rec = 'LEKKI SPRZEDAJ';
  else rec = 'TRZYMAJ';
  return { score, recommendation: rec, details, timeframe: '7-30 dni' };
}

// ======================== COINGECKO ========================

async function getCoinGeckoData(ticker, currency = 'USD') {
  try {
    const coinId = COINGECKO_MAP[ticker.toUpperCase()];
    if (!coinId) {
      throw new Error(`Nieznana kryptowaluta: ${ticker}`);
    }

    console.log(`🔄 CoinGecko: ${ticker} (${coinId})`);

    // Pobierz prawdziwe OHLC + market_chart równolegle
    const [ohlcRes, chartRes] = await Promise.all([
      axios.get(`https://api.coingecko.com/api/v3/coins/${coinId}/ohlc`, {
        params: { vs_currency: currency.toLowerCase(), days: 30 },
        timeout: 10000
      }),
      axios.get(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`, {
        params: { vs_currency: currency.toLowerCase(), days: 30, interval: 'daily' },
        timeout: 10000
      })
    ]);

    const volumes = chartRes.data.total_volumes?.map(v => parseFloat(v[1])) || [];
    const marketCaps = chartRes.data.market_caps?.map(m => parseFloat(m[1])) || [];
    const avgVolume = volumes.length > 0 ? volumes.reduce((a, b) => a + b) / volumes.length : 0;
    const lastVolume = volumes.length > 0 ? volumes[volumes.length - 1] : 0;
    const marketCap = marketCaps.length > 0 ? marketCaps[marketCaps.length - 1] : 0;

    // Prawdziwe świece OHLC z CoinGecko (4h candles)
    const rawOhlc = ohlcRes.data; // [[timestamp, open, high, low, close], ...]
    if (!rawOhlc || rawOhlc.length === 0) {
      throw new Error(`Brak danych OHLC dla ${ticker}`);
    }

    // Agreguj 4h świece do dziennych
    const dailyMap = {};
    rawOhlc.forEach((d) => {
      const date = new Date(d[0]);
      const dayKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = { timestamp: Math.floor(d[0] / 1000), open: d[1], high: d[2], low: d[3], close: d[4] };
      } else {
        dailyMap[dayKey].high = Math.max(dailyMap[dayKey].high, d[2]);
        dailyMap[dayKey].low = Math.min(dailyMap[dayKey].low, d[3]);
        dailyMap[dayKey].close = d[4]; // ostatni close dnia
      }
    });

    // Dopasuj wolumen do dnia
    const volumeByDay = {};
    (chartRes.data.total_volumes || []).forEach(v => {
      const date = new Date(v[0]);
      const dayKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
      volumeByDay[dayKey] = parseFloat(v[1]);
    });

    const sortedDays = Object.keys(dailyMap).sort();
    const candles = sortedDays.map(dayKey => ({
      ...dailyMap[dayKey],
      volume: volumeByDay[dayKey] || 0
    }));

    const closes = candles.map(c => c.close);
    const currentPrice = closes[closes.length - 1];
    const prevPrice = closes.length > 1 ? closes[closes.length - 2] : currentPrice;
    const change = currentPrice - prevPrice;
    const changePercent = (change / prevPrice) * 100;

    const allHighs = candles.map(c => c.high);
    const allLows = candles.map(c => c.low);
    const high = Math.max(...allHighs);
    const low = Math.min(...allLows);

    const chartData = candles.map((candle) => {
      const date = new Date(candle.timestamp * 1000);
      return {
        date: date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }),
        dayOfWeek: date.toLocaleDateString('pl-PL', { weekday: 'short' }),
        fullDate: date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }),
        timestamp: candle.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        changePercent: ((candle.close - candle.open) / candle.open) * 100
      };
    });

    return {
      chartData,
      currentPrice,
      change,
      changePercent,
      high,
      low,
      closes,
      volume: lastVolume,
      avgVolume,
      marketCap,
      candles
    };
  } catch (err) {
    console.error(`❌ CoinGecko error: ${err.message}`);
    throw err;
  }
}

async function getMarketData(ticker, currency = 'USD') {
  try {
    const symbol = ticker.toUpperCase();
    const cacheKey = `${symbol}-${currency}`;
    
    if (dataCache[cacheKey] && (Date.now() - dataCache[cacheKey].timestamp) < CACHE_TTL) {
      console.log(`⚡ Cache hit: ${cacheKey}`);
      return dataCache[cacheKey].data;
    }

    const geckoData = await getCoinGeckoData(symbol, currency);
    const news = await getCryptoNews(symbol);

    const closes = geckoData.closes;
    const high = geckoData.high;
    const low = geckoData.low;
    const range = high - low;

    const ema12 = calculateEMA(closes, 12);
    const ema26 = calculateEMA(closes, 26);
    const macdData = calculateMACD(closes);
    const sarData = calculateSAR(geckoData.candles);
    const bbData = calculateBollingerBands(closes);
    const atr = calculateATR(geckoData.candles);
    const adxData = calculateADX(geckoData.candles);
    const stochRsiData = calculateStochRSI(closes);
    const obvData = calculateOBV(geckoData.candles);
    const rsiDivData = detectRSIDivergence(closes);
    const fearGreed = await getFearAndGreed();
    const patterns = detectCandlePatterns(geckoData.candles);
    const fibonacci = calculateFibonacci(high, low);
    const rsiSeries = calculateRSISeries(closes);
    const ema12Series = calculateOverlayEMASeries(closes, 12);
    const ema26Series = calculateOverlayEMASeries(closes, 26);
    const sma20Series = calculateOverlaySMASeries(closes, 20);
    const sma50Series = calculateOverlaySMASeries(closes, 50);
    const bbOverlaySeries = calculateOverlayBBSeries(closes);

    const data = {
      ticker: symbol,
      pair: `${symbol}-${currency}`,
      currency: currency,
      price: geckoData.currentPrice,
      change: geckoData.change,
      changePercent: geckoData.changePercent,
      high,
      low,
      // Pivot Points
      pivotPoint: (high + low + geckoData.currentPrice) / 3,
      support1: 2 * ((high + low + geckoData.currentPrice) / 3) - high,
      resistance1: 2 * ((high + low + geckoData.currentPrice) / 3) - low,
      support2: ((high + low + geckoData.currentPrice) / 3) - (high - low),
      resistance2: ((high + low + geckoData.currentPrice) / 3) + (high - low),
      rsi: calculateRSI(closes),
      sma20: calculateSMA(closes, 20),
      sma50: calculateSMA(closes, 50),
      ema12: ema12,
      ema26: ema26,
      macd: macdData,
      sar: sarData,
      bb: bbData,
      atr: atr,
      adx: adxData,
      stochRsi: stochRsiData,
      obv: obvData,
      rsiDivergence: rsiDivData,
      fearGreed: fearGreed,
      volume: geckoData.volume,
      avgVolume: geckoData.avgVolume,
      marketCap: geckoData.marketCap,
      patterns: patterns,
      fibonacci: fibonacci,
      overlays: { rsiSeries, ema12Series, ema26Series, sma20Series, sma50Series, bbSeries: bbOverlaySeries },
      news: news,
      importantNews: news.filter(n => n.isImportant),
      lastUpdate: new Date().toISOString(),
      source: 'CoinGecko',
      chartData: geckoData.chartData,
      days: geckoData.chartData.length
    };

    // Composite scoring
    data.composite = calculateCompositeScore(data);
    data.microTrend = analyzeMicroTrend(data);
    data.macroTrend = analyzeMacroTrend(data);

    dataCache[cacheKey] = {
      data,
      timestamp: Date.now()
    };

    console.log(`✅ ${symbol}: ${currency} ${geckoData.currentPrice.toFixed(2)} | Score: ${data.composite.score} → ${data.composite.decision}`);
    return data;
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    throw err;
  }
}

// ======================== BACKGROUND NEWS MONITOR ========================

function startNewsMonitoring() {
  setInterval(async () => {
    try {
      // Wymuś odświeżenie globalnego cache Finnhub (1 request)
      finnhubRawCache.timestamp = 0;
      await fetchFinnhubRaw();
      // Wyczyść cache per-ticker żeby przy następnym zapytaniu przefiltrować na nowo
      Object.keys(newsCache).forEach(k => { newsCache[k].timestamp = 0; });
      console.log('🔄 News cache odświeżony');
    } catch (err) {
      console.error(`Error monitoring news:`, err.message);
    }
  }, NEWS_CHECK_INTERVAL);

  console.log(`🔔 News monitoring started - checking every ${NEWS_CHECK_INTERVAL / 1000 / 60} minutes`);
}

// ======================== ROUTES ========================

app.post('/api/analyze', async (req, res) => {
  try {
    const { prompt, ticker, currency } = req.body;

    if (!ticker) {
      return res.status(400).json({ error: "Brak tickera" });
    }

    console.log(`📊 Analizuję: ${ticker}/${currency}`);
    
    const data = await getMarketData(ticker, currency);

    const newsText = data.news.length > 0 
      ? `\n📰 WIADOMOŚCI:\n${data.news.slice(0, 3).map(n => `- ${n.importanceLevel} ${n.title} (${n.sentiment})`).join('\n')}`
      : '';

    const analysis = `
📊 DANE (${data.ticker}/${currency}): ${data.lastUpdate}
💰 Cena: ${data.price.toFixed(2)} ${currency} | Zmiana: ${data.changePercent > 0 ? '+' : ''}${data.changePercent.toFixed(2)}%
💎 Kapitalizacja: $${data.marketCap > 0 ? (data.marketCap / 1000000000).toFixed(2) + 'B' : 'N/A'}
📊 High/Low 30d: ${data.high.toFixed(2)} / ${data.low.toFixed(2)}
🎯 Pivot: ${data.pivotPoint.toFixed(2)} | R1: ${data.resistance1.toFixed(2)} | R2: ${data.resistance2.toFixed(2)} | S1: ${data.support1.toFixed(2)} | S2: ${data.support2.toFixed(2)}
📈 Wolumen: ${data.volume.toFixed(0)} | Średni: ${data.avgVolume.toFixed(0)}
🔧 RSI(14): ${data.rsi.toFixed(1)} | StochRSI K: ${data.stochRsi.k} D: ${data.stochRsi.d} (${data.stochRsi.signal})
📊 SMA20: ${data.sma20.toFixed(2)} | SMA50: ${data.sma50.toFixed(2)} | EMA12: ${data.ema12.toFixed(2)} | EMA26: ${data.ema26.toFixed(2)}
🎯 MACD: ${data.macd.macdLine} (Signal: ${data.macd.signalLine}, Hist: ${data.macd.histogram}) ${data.macd.signal}
🛑 SAR: ${data.sar.sar} ${data.sar.trend} | ADX: ${data.adx.adx} +DI: ${data.adx.plusDI} -DI: ${data.adx.minusDI} (${data.adx.trend})
📉 BB: ${data.bb.lower.toFixed(2)} / ${data.bb.middle.toFixed(2)} / ${data.bb.upper.toFixed(2)} (Width: ${data.bb.width.toFixed(1)}%)
📏 ATR(14): ${data.atr.toFixed(2)} (${((data.atr / data.price) * 100).toFixed(2)}% zmienności)
📊 OBV trend: ${data.obv.trend} | Dywergencja: ${data.obv.divergenceType}
⚠️ Dywergencja RSI: ${data.rsiDivergence.type}
😱 Fear & Greed Index: ${data.fearGreed.value}/100 (${data.fearGreed.classification})
🕯️ Formacje: ${data.patterns.join(', ')}

🤖 COMPOSITE SCORE: ${data.composite.score}/100 → ${data.composite.decision}
Pewność algorytmu: ${data.composite.confidence}% | Ryzyko: ${data.composite.risk}
Sygnały: ${data.composite.signals.bullish} byczych, ${data.composite.signals.bearish} niedźwiedzich, ${data.composite.signals.neutral} neutralnych
Kluczowe: ${data.composite.details.join(' | ')}${newsText}
Pytanie: ${prompt || 'Analiza techniczna'}`;

    const systemPrompt = `Jesteś profesjonalnym traderem krypto z 10-letnim doświadczeniem. Masz dane z 12 wskaźników + composite score algorytmiczny.
ZASADY: TYLKO po polsku. Bez markdown. Używaj emoji. NIE pisz przemyśleń. TYLKO gotowa analiza.

SEKCJE:
1️⃣ TREND I MOMENTUM — RSI, StochRSI, MACD, SAR, ADX. Siła trendu 1-10. Czy ADX potwierdza?
2️⃣ ŚREDNIE I BOLLINGER — EMA/SMA crossover + pozycja w Bollingerze. Squeeze = zbliżający się ruch.
3️⃣ WSPARCIE I OPÓR — Pivot Points S1/S2/R1/R2 + BB jako dynamiczny S/R.
4️⃣ WOLUMEN I OBV — Czy wolumen potwierdza trend? Dywergencja OBV = ostrzeżenie!
5️⃣ DYWERGENCJE — RSI i OBV divergence = najsilniejsze sygnały reversal. Oceń ważność.
6️⃣ SENTYMENT — Fear & Greed Index. Extreme Fear = szansa kupna. Extreme Greed = ryzyko.
7️⃣ WIADOMOŚCI — Wpływ na cenę krótko/długoterminowo.
8️⃣ SCENARIUSZE — Byczy/niedźwiedzi z konkretnymi cenami i prawdopodobieństwem %.
9️⃣ ZARZĄDZANIE POZYCJĄ — Entry, stop-loss (na podstawie ATR), take-profit. R:R ratio.

🔟 DECYZJA TRADINGOWA
Composite Score algorytmu: ${data.composite.score} → ${data.composite.decision}
Czy zgadzasz się z algorytmem? Podaj swoją ocenę:
Sygnał: KUPUJ / SPRZEDAJ / TRZYMAJ
Siła trendu: X/10
Ryzyko: ${data.composite.risk}
Pewność: ${data.composite.confidence}%
Uzasadnienie: dlaczego zgadzasz się lub nie z composite score.`;

    // Próbuj wygenerować analizę AI z fallback
    let aiAnalysis = '';
    try {
      let raw = await generateWithFallback(analysis, systemPrompt);
      // Wytnij "thinking" AI — wszystko przed pierwszą sekcją 1️⃣
      const firstSection = raw.indexOf('1️⃣');
      if (firstSection > 0) {
        raw = raw.substring(firstSection);
      }
      // Wytnij śmieci po ostatniej sekcji (self-correction, checks)
      const junkPatterns = [
        /\n\s*\*\s*(Polish only|No markdown|Ensure|Let me|Self-correct|Wait|Double check|Final check|Let's go|I will|I'll).*/gis,
        /\n\s*\*\s*(Language|Formatting|Style|Structure|Input Data):.*/gis,
      ];
      for (const p of junkPatterns) {
        raw = raw.replace(p, '');
      }
      aiAnalysis = raw.trim();
    } catch (aiErr) {
      console.error(`⚠️ AI niedostępne: ${aiErr.message}`);
      aiAnalysis = `⚠️ AI tymczasowo niedostępne (rate limit). Dane rynkowe i wiadomości są aktualne.\n\n📊 Podsumowanie danych:\n- Cena: ${data.price.toFixed(2)} ${currency}\n- Zmiana: ${data.changePercent > 0 ? '+' : ''}${data.changePercent.toFixed(2)}%\n- RSI: ${data.rsi.toFixed(0)} (${data.rsi > 70 ? 'Wykupiony' : data.rsi < 30 ? 'Wyprzedany' : 'Neutralny'})\n- MACD: ${data.macd.signal}\n- SAR: ${data.sar.signal}\n\nSpróbuj ponownie za 30 sekund, aby uzyskać pełną analizę Gemma 4.`;
    }

    res.json({
      success: true,
      ticker: data.ticker,
      currency: currency,
      analysis: aiAnalysis,
      marketData: {
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        marketCap: data.marketCap,
        volume: data.volume,
        avgVolume: data.avgVolume,
        rsi: data.rsi,
        sma20: data.sma20,
        sma50: data.sma50,
        ema12: data.ema12,
        ema26: data.ema26,
        macd: data.macd,
        sar: data.sar,
        pivotPoint: data.pivotPoint,
        support1: data.support1,
        support2: data.support2,
        resistance1: data.resistance1,
        resistance2: data.resistance2,
        high: data.high,
        low: data.low,
        bb: data.bb,
        atr: data.atr,
        adx: data.adx,
        stochRsi: data.stochRsi,
        obv: data.obv,
        rsiDivergence: data.rsiDivergence,
        fearGreed: data.fearGreed,
        composite: data.composite,
        patterns: data.patterns,
        news: data.news,
        importantNews: data.importantNews,
        lastUpdate: data.lastUpdate,
        source: data.source,
        fibonacci: data.fibonacci,
        overlays: data.overlays,
        microTrend: data.microTrend,
        macroTrend: data.macroTrend
      },
      chartData: data.chartData,
      days: data.days
    });

  } catch (error) {
    console.error("❌", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/important-news', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendNews = (news) => {
    res.write(`data: ${JSON.stringify(news)}\n\n`);
  };

  newsEmitter.on('important-news', sendNews);

  req.on('close', () => {
    newsEmitter.removeListener('important-news', sendNews);
  });
});

app.get('/', (req, res) => {
  res.json({ status: "✅ Online - COINGECKO + FINNHUB + GEMMA 4 AI" });
});

const server = app.listen(PORT, () => {
  console.log(`\n✅ Backend: http://localhost:${PORT}`);
  console.log(`📊 CoinGecko API - OHLC 30 dni`);
  console.log(`🤖 AI Engine: Gemma 4 (gemma-4-31b-it) + Gemini fallback`);
  console.log(`📰 Finnhub News - Real Time Crypto Monitoring\n`);
  
  // Uruchom monitoring wiadomości
  startNewsMonitoring();
});

app.get('/api/news', async (req, res) => {
  try {
    const ticker = req.query.ticker || 'BTC';
    const newsData = await getCryptoNews(ticker);
    res.json(newsData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});