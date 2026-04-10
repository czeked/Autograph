import 'dotenv/config';
import express from 'express';
import Groq from 'groq-sdk';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const dataCache = {};
const CACHE_TTL = 60 * 60 * 1000;

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

async function getCoinbaseOHLC(productId) {
  try {
    console.log(`🔄 Coinbase OHLC: ${productId}`);
    
    const res = await axios.get(
      `https://api.exchange.coinbase.com/products/${productId}/candles`,
      {
        params: {
          granularity: 86400,
        },
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      }
    );

    if (!res.data || res.data.length === 0) {
      throw new Error(`Brak danych dla ${productId}`);
    }

    let candles = res.data.map(d => ({
      timestamp: d[0],
      low: parseFloat(d[1]),
      high: parseFloat(d[2]),
      open: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5])
    })).reverse();

    candles = candles.slice(-30);

    const closes = candles.map(c => c.close);
    const currentPrice = closes[closes.length - 1];
    const prevPrice = closes[closes.length - 2] || currentPrice;
    
    const change = currentPrice - prevPrice;
    const changePercent = (change / prevPrice) * 100;
    const high = Math.max(...candles.map(c => c.high));
    const low = Math.min(...candles.map(c => c.low));
    const range = high - low;

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
      closes,
      volume: candles[candles.length - 1].volume
    };
  } catch (err) {
    console.error(`❌ Coinbase error: ${err.message}`);
    throw err;
  }
}

async function getCoinbasePrice(productId) {
  try {
    const res = await axios.get(
      `https://api.exchange.coinbase.com/products/${productId}/ticker`,
      { 
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }
    );
    return parseFloat(res.data.price);
  } catch (err) {
    console.error(`❌ Coinbase ticker error: ${err.message}`);
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
    
    const productId = `${symbol}-${currency}`;
    
    const ohlcData = await getCoinbaseOHLC(productId);
    const currentPrice = await getCoinbasePrice(productId);

    const closes = ohlcData.closes;
    const high = ohlcData.high;
    const low = ohlcData.low;
    const range = high - low;

    const data = {
      ticker: symbol,
      pair: productId,
      currency: currency,
      price: currentPrice,
      change: ohlcData.change,
      changePercent: ohlcData.changePercent,
      high,
      low,
      support1: low,
      resistance1: high,
      support2: low - range * 0.236,
      resistance2: high + range * 0.236,
      rsi: calculateRSI(closes),
      sma20: calculateSMA(closes, 20),
      sma50: calculateSMA(closes, 50),
      ema12: calculateEMA(closes, 12),
      ema26: calculateEMA(closes, 26),
      volume: ohlcData.volume,
      lastUpdate: new Date().toISOString(),
      source: 'Coinbase',
      chartData: ohlcData.chartData,
      days: ohlcData.chartData.length
    };

    dataCache[cacheKey] = {
      data,
      timestamp: Date.now()
    };

    console.log(`✅ ${productId}: $${currentPrice.toFixed(2)}`);
    return data;
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    throw err;
  }
}

app.post('/api/analyze', async (req, res) => {
  try {
    const { prompt, ticker, currency } = req.body;

    if (!ticker) {
      return res.status(400).json({ error: "Brak tickera" });
    }

    console.log(`📊 Analizuję: ${ticker}/${currency}`);
    
    const data = await getMarketData(ticker, currency);

    const analysis = `
📊 DANE (${data.ticker}/${currency}): ${data.lastUpdate}
💰 Cena: ${data.price.toFixed(2)} ${currency} (${data.changePercent > 0 ? '+' : ''}${data.changePercent.toFixed(2)}%)
📈 High/Low: ${data.high.toFixed(2)} / ${data.low.toFixed(2)}
🎯 Opór: ${data.resistance1.toFixed(2)} | Wsparcie: ${data.support1.toFixed(2)}
🔧 RSI: ${data.rsi.toFixed(2)} | SMA20: ${data.sma20.toFixed(2)} | SMA50: ${data.sma50.toFixed(2)}
Pytanie: ${prompt || 'Analiza techniczny'}`;

    const completion = await groq.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: `Jesteś analitykiem rynku. Zwróć odpowiedź:
1️⃣ CENA I TREND
2️⃣ WSPARCIE/OPÓR
3️⃣ SCENARIUSZE
4️⃣ RSI
5️⃣ ŚREDNIE KROCZĄCE
6️⃣ RYZYKO/OKAZJA
7️⃣ POZIOMY
8️⃣ REKOMENDACJA
PO POLSKU, konkretnie.`
        },
        { role: "user", content: analysis }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 2000,
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
        rsi: data.rsi,
        sma20: data.sma20,
        sma50: data.sma50,
        support1: data.support1,
        resistance1: data.resistance1,
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

app.get('/', (req, res) => {
  res.json({ status: "✅ Online - COINBASE LIVE" });
});

app.listen(PORT, () => {
  console.log(`\n✅ Backend: http://localhost:${PORT}`);
  console.log(`📊 Coinbase Exchange API - OHLC 30 dni`);
  console.log(`💱 Wyszukiwarka kryptowalut w USD\n`);
});