import 'dotenv/config';
import express from 'express';
import Groq from 'groq-sdk';
import cors from 'cors';
import axios from 'axios';
import { EventEmitter } from 'events';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const dataCache = {};
const newsCache = {};
const newsEmitter = new EventEmitter();
const CACHE_TTL = 60 * 60 * 1000;
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
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
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
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macdLine = ema12 - ema26;
  
  let signalLine = macdLine;
  if (prices.length >= 35) {
    const macdValues = [];
    for (let i = 25; i < prices.length; i++) {
      const e12 = calculateEMA(prices.slice(0, i + 1), 12);
      const e26 = calculateEMA(prices.slice(0, i + 1), 26);
      macdValues.push(e12 - e26);
    }
    signalLine = calculateEMA(macdValues, 9);
  }
  
  const histogram = macdLine - signalLine;
  
  return {
    macdLine: macdLine.toFixed(6),
    signalLine: signalLine.toFixed(6),
    histogram: histogram.toFixed(6),
    signal: histogram > 0 ? 'BULLISH' : 'BEARISH'
  };
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
    trend: trend,
    signal: trend === 'UP' ? 'BULLISH' : 'BEARISH'
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

async function getCryptoNews(ticker) {
  try {
    if (newsCache[ticker] && (Date.now() - newsCache[ticker].timestamp) < NEWS_CACHE_TTL) {
      return newsCache[ticker].data;
    }

    console.log(`📰 Pobierám wiadomości: ${ticker}`);

    const newsRes = await axios.get(
      `https://min-api.cryptocompare.com/data/v2/news/`,
      {
        params: {
          lang: 'EN',
          sortOrder: 'latest',
          categories: ticker.toLowerCase()
        },
        timeout: 5000
      }
    );

    let news = [];
    if (newsRes.data.Data) {
      news = newsRes.data.Data.slice(0, 10).map(article => {
        const importance = calculateImportanceScore(article.title + ' ' + article.body);
        const importanceLevel = getImportanceLevel(importance);
        
        return {
          title: article.title,
          body: article.body.substring(0, 150) + '...',
          source: article.source,
          url: article.url,
          published: new Date(article.published_on * 1000).toLocaleString('pl-PL'),
          sentiment: analyzeSentiment(article.title + ' ' + article.body),
          importance: importance,
          importanceLevel: importanceLevel,
          isImportant: importance >= 3
        };
      }).sort((a, b) => b.importance - a.importance);
    }

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

    return news;
  } catch (err) {
    console.error(`⚠️ News error: ${err.message}`);
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

// ======================== COINGECKO ========================

async function getCoinGeckoData(ticker, currency = 'USD') {
  try {
    const coinId = COINGECKO_MAP[ticker.toUpperCase()];
    if (!coinId) {
      throw new Error(`Nieznana kryptowaluta: ${ticker}`);
    }

    console.log(`🔄 CoinGecko: ${ticker} (${coinId})`);

    const res = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`,
      {
        params: {
          vs_currency: currency.toLowerCase(),
          days: 30,
          interval: 'daily'
        },
        timeout: 10000
      }
    );

    const prices = res.data.prices.map(p => parseFloat(p[1]));
    const volumes = res.data.total_volumes?.map(v => parseFloat(v[1])) || [];
    const marketCaps = res.data.market_caps?.map(m => parseFloat(m[1])) || [];

    if (prices.length === 0) {
      throw new Error(`Brak danych dla ${ticker}`);
    }

    const currentPrice = prices[prices.length - 1];
    const prevPrice = prices[prices.length - 2] || currentPrice;
    const change = currentPrice - prevPrice;
    const changePercent = (change / prevPrice) * 100;

    const high = Math.max(...prices.slice(-30));
    const low = Math.min(...prices.slice(-30));
    const range = high - low;

    const avgVolume = volumes.length > 0 ? volumes.reduce((a, b) => a + b) / volumes.length : 0;
    const lastVolume = volumes.length > 0 ? volumes[volumes.length - 1] : 0;
    const marketCap = marketCaps.length > 0 ? marketCaps[marketCaps.length - 1] : 0;

    const candles = [];
    for (let i = 0; i < Math.min(prices.length - 1, 30); i++) {
      candles.push({
        timestamp: Math.floor(Date.now() / 1000) - (30 - i) * 86400,
        open: prices[i],
        close: prices[i + 1],
        high: Math.max(prices[i], prices[i + 1]) * 1.01,
        low: Math.min(prices[i], prices[i + 1]) * 0.99,
        volume: lastVolume
      });
    }

    const chartData = candles.map((candle) => {
      const date = new Date(candle.timestamp * 1000);
      return {
        date: date.toLocaleDateString('pl-PL', { month: 'short', day: 'numeric' }),
        dayOfWeek: date.toLocaleDateString('pl-PL', { weekday: 'short' }),
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
      closes: prices,
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
    const patterns = detectCandlePatterns(geckoData.candles);

    const data = {
      ticker: symbol,
      pair: `${symbol}-${currency}`,
      currency: currency,
      price: geckoData.currentPrice,
      change: geckoData.change,
      changePercent: geckoData.changePercent,
      high,
      low,
      support1: low,
      resistance1: high,
      support2: low - range * 0.236,
      resistance2: high + range * 0.236,
      rsi: calculateRSI(closes),
      sma20: calculateSMA(closes, 20),
      sma50: calculateSMA(closes, 50),
      ema12: ema12,
      ema26: ema26,
      macd: macdData,
      sar: sarData,
      volume: geckoData.volume,
      avgVolume: geckoData.avgVolume,
      marketCap: geckoData.marketCap,
      patterns: patterns,
      news: news,
      importantNews: news.filter(n => n.isImportant),
      lastUpdate: new Date().toISOString(),
      source: 'CoinGecko',
      chartData: geckoData.chartData,
      days: geckoData.chartData.length
    };

    dataCache[cacheKey] = {
      data,
      timestamp: Date.now()
    };

    console.log(`✅ ${symbol}: ${currency} ${geckoData.currentPrice.toFixed(2)}`);
    return data;
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    throw err;
  }
}

// ======================== BACKGROUND NEWS MONITOR ========================

function startNewsMonitoring() {
  const tickers = Object.keys(COINGECKO_MAP);
  
  setInterval(async () => {
    for (let ticker of tickers) {
      try {
        await getCryptoNews(ticker);
      } catch (err) {
        console.error(`Error monitoring ${ticker}:`, err.message);
      }
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
💰 Cena: ${data.price.toFixed(2)} ${currency}
📈 Zmiana: ${data.changePercent > 0 ? '+' : ''}${data.changePercent.toFixed(2)}%
💎 Kapitalizacja: $${data.marketCap > 0 ? (data.marketCap / 1000000000).toFixed(2) + 'B' : 'N/A'}
📊 High/Low: ${data.high.toFixed(2)} / ${data.low.toFixed(2)}
🎯 Opór: ${data.resistance1.toFixed(2)} | Wsparcie: ${data.support1.toFixed(2)}
📈 Wolumen dzisiejszego dnia: ${data.volume.toFixed(0)} | Średni: ${data.avgVolume.toFixed(0)}
🔧 RSI: ${data.rsi.toFixed(2)}
📊 SMA20: ${data.sma20.toFixed(2)} | SMA50: ${data.sma50.toFixed(2)}
📈 EMA12: ${data.ema12.toFixed(2)} | EMA26: ${data.ema26.toFixed(2)}
🎯 MACD: ${data.macd.macdLine} (Signal: ${data.macd.signalLine}, Histogram: ${data.macd.histogram}) - ${data.macd.signal}
🛑 SAR: ${data.sar.sar} - Trend: ${data.sar.trend} (${data.sar.signal})
🕯️ Formacje świec: ${data.patterns.join(', ')}${newsText}
Pytanie: ${prompt || 'Analiza techniczny'}`;

    const completion = await groq.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: `Jesteś zaawansowanym analitykiem technicznym kryptowalut. Dokonaj analizy:
1️⃣ TREND GŁÓWNY - RSI, MACD, SAR
2️⃣ ŚREDNIE KROCZĄCE - EMA12/26, SMA20/50
3️⃣ WSPARCIE/OPÓR - Poziomy, Fibonacci
4️⃣ FORMACJE ŚWIEC - Interpretacja
5️⃣ WOLUMEN - Potwierdza czy zagraża trendowi?
6️⃣ KAPITALIZACJA - Co to oznacza dla projektu?
7️⃣ WIADOMOŚCI - Jakie mogą mieć wpływ na cenę?
8️⃣ SCENARIUSZE - Byczy, niedźwiedzi, neutralny
9️⃣ ENTRY/EXIT - Gdzie wejść, gdzie wyjść
🔟 PODSUMOWANIE - Co robić teraz?
PO POLSKU, konkretnie, z cyframi!`
        },
        { role: "user", content: analysis }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 3000,
    });

    res.json({
      success: true,
      ticker: data.ticker,
      currency: currency,
      analysis: completion.choices[0].message.content,
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
        support1: data.support1,
        resistance1: data.resistance1,
        patterns: data.patterns,
        news: data.news,
        importantNews: data.importantNews,
        lastUpdate: data.lastUpdate,
        source: data.source
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
  res.json({ status: "✅ Online - COINGECKO + LIVE NEWS" });
});

const server = app.listen(PORT, () => {
  console.log(`\n✅ Backend: http://localhost:${PORT}`);
  console.log(`📊 CoinGecko API - OHLC 30 dni`);
  console.log(`📰 CryptoCompare News - Real Time Monitoring\n`);
  
  // Uruchom monitoring wiadomości
  startNewsMonitoring();
});