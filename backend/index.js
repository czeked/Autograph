// index.js - Complete Massive + Groq Integration
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

// ============ TECHNICAL INDICATORS ============

function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

function calculateEMA(prices, period) {
  if (prices.length < period) return null;
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * multiplier + ema * (1 - multiplier);
  }
  
  return ema;
}

// ============ MAIN MARKET DATA FUNCTION ============

async function getMarketData(ticker) {
  try {
    const apiKey = process.env.MASSIVE_API_KEY;
    
    let isCrypto = false;
    let symbol = ticker.toUpperCase();
    
    if (symbol === 'BTC' || symbol === 'ETH' || symbol === 'ADA' || symbol === 'DOGE' || symbol === 'SOL') {
      isCrypto = true;
      symbol = `X:${symbol}USD`;
    }

    console.log(`🔍 Pobieranie danych dla: ${symbol}`);

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const aggsUrl = isCrypto 
      ? `https://api.massive.com/v1/aggs/crypto/${symbol}/range/1/day/${startDate}/${endDate}`
      : `https://api.massive.com/v1/aggs/stocks/${symbol}/range/1/day/${startDate}/${endDate}`;

    const response = await axios.get(aggsUrl, {
      params: { apiKey },
      timeout: 10000
    });

    if (!response.data.results || response.data.results.length === 0) {
      console.error(`Brak danych dla ${symbol}`);
      return null;
    }

    const data = response.data.results;
    const prices = data.map(d => d.c);
    const currentPrice = prices[prices.length - 1];
    const previousClose = prices[prices.length - 2];
    
    const change = currentPrice - previousClose;
    const changePercent = (change / previousClose) * 100;
    
    const last20Days = data.slice(-20);
    const high = Math.max(...last20Days.map(d => d.h));
    const low = Math.min(...last20Days.map(d => d.l));
    
    const range = high - low;
    const support1 = low;
    const resistance1 = high;
    const support2 = low - (range * 0.236);
    const resistance2 = high + (range * 0.236);
    
    const rsi = calculateRSI(prices);
    const sma20 = calculateSMA(prices, 20);
    const sma50 = calculateSMA(prices, 50);
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    
    const volume = data[data.length - 1].v || 0;

    return {
      ticker: symbol,
      price: currentPrice,
      change,
      changePercent,
      high: Math.max(...data.map(d => d.h)),
      low: Math.min(...data.map(d => d.l)),
      support1,
      resistance1,
      support2,
      resistance2,
      rsi,
      sma20,
      sma50,
      ema12,
      ema26,
      volume,
      lastUpdate: new Date().toISOString()
    };
  } catch (error) {
    console.error(`❌ Błąd pobierania danych: ${error.message}`);
    return null;
  }
}

// ============ MAIN ANALYZE ENDPOINT ============

app.post('/api/analyze', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Brak promptu" });
  }

  try {
    const tickerMatch = prompt.match(/\b([A-Z]{1,5})\b/);
    const ticker = tickerMatch ? tickerMatch[1].toUpperCase() : null;

    if (!ticker) {
      return res.status(400).json({ error: "Nie znaleziono tickera (np. BTC, AAPL, ETH)" });
    }

    const marketData = await getMarketData(ticker);

    if (!marketData) {
      return res.status(400).json({ error: `Nie można pobrać danych dla ${ticker}` });
    }

    const technicalAnalysis = `
📊 DANE TECHNICZNE (${marketData.ticker}):

💰 Cena & Trend:
- Cena bieżąca: ${marketData.price.toFixed(2)} USD
- Zmiana dzisiaj: ${marketData.change > 0 ? '+' : ''}${marketData.changePercent.toFixed(2)}%
- 24h High: ${marketData.high.toFixed(2)} USD
- 24h Low: ${marketData.low.toFixed(2)} USD
- Wolumen: ${(marketData.volume / 1000000).toFixed(2)}M

📈 Wsparcie & Opór (Fibonacci):
- Opór 1: ${marketData.resistance1.toFixed(2)} USD
- Wsparcie 1: ${marketData.support1.toFixed(2)} USD
- Opór 2: ${marketData.resistance2.toFixed(2)} USD
- Wsparcie 2: ${marketData.support2.toFixed(2)} USD

🔧 Wskaźniki Techniczne:
- RSI(14): ${marketData.rsi?.toFixed(2) || 'N/A'} [Wykupienie >70, Wyprzedanie <30]
- SMA(20): ${marketData.sma20?.toFixed(2) || 'N/A'} USD
- SMA(50): ${marketData.sma50?.toFixed(2) || 'N/A'} USD
- EMA(12): ${marketData.ema12?.toFixed(2) || 'N/A'} USD
- EMA(26): ${marketData.ema26?.toFixed(2) || 'N/A'} USD

📊 Relacje Cenowe:
- Cena vs SMA20: ${marketData.price > marketData.sma20 ? '⬆️ POWYŻEJ' : '⬇️ PONIŻEJ'}
- Cena vs SMA50: ${marketData.price > marketData.sma50 ? '⬆️ POWYŻEJ' : '⬇️ PONIŻEJ'}
- EMA12 vs EMA26: ${marketData.ema12 > marketData.ema26 ? '⬆️ BYCZE' : '⬇️ NIEDŹWIEDIE'}

Pytanie użytkownika: ${prompt}
`;

    const systemPrompt = `Jesteś eksperckim analitykiem rynku finansowego z 10+ latami doświadczenia w tradingu na akcjach i kryptowalutach.

ZAWSZE zwróć analizę w DOKŁADNIE tym formacie (każda sekcja w nowej linii):

═══════════════════════════════════════════════════════════

1️⃣ CENA BIEŻĄCA I TREND DZISIAJ
[Podaj cenę, zmianę procentową, interpretacja trendu dzisiaj - czy rośnie/pada/konsoliduje]

2️⃣ WSPARCIE/OPÓR (FIBONACCI)
- Opór 1: XXX USD
- Wsparcie 1: XXX USD
- Opór 2: XXX USD
- Wsparcie 2: XXX USD
[Krótka interpretacja - gdzie może sięgnąć cena]

3��⃣ POTENCJALNE SCENARIUSZE
- Scenariusz 1: [WYBICIE/KOREKTA/KONSOLIDACJA] - jeśli cena przekroczy XXXX USD
- Scenariusz 2: [Alternatywny scenariusz]
- Prawdopodobieństwo: [Szacunek % dla każdego]

4️⃣ RSI - MOMENTUM
RSI: XX [Stan: Wykupienie/Wyprzedanie/Neutralne]
[Interpretacja: co to oznacza dla momentum rynku]

5️⃣ ŚREDNIE KROCZĄCE - TREND DŁUGOTERMINOWY
- SMA20 vs SMA50: [BYCZE/NIEDŹWIEDIE trend]
- EMA12 vs EMA26: [BYCZE/NIEDŹWIEDIE momentum]
[Analiza: czy trend się zmienia czy utrzymuje się]

6️⃣ RYZYKO / OKAZJA
✅ Okazje: [Lista 2-3 konkretnych okazji z poziomami]
⚠️ Ryzyka: [Lista 2-3 ryzyk z poziomami stop-loss]
Stosunek Ryzyko/Nagroda: [Szacunek np. 1:3]

7️⃣ POZIOMY DOCELOWE
- Target 1 (Short-term, 4H): XXX USD
- Target 2 (Mid-term, 1D): XXX USD
- Stop-Loss: XXX USD
[Jak je osiągnąć - jakie warunki muszą się spełnić]

8️⃣ REKOMENDACJA HANDLOWA
🎯 REKOMENDACJA: [KUPUJ / TRZYMAJ / SPRZEDAJ]
📍 Horyzont czasowy: [4H / 1D / 1W]
✏️ Uzasadnienie: [Konkretne 2-3 punkty z danych]
⏰ Ważność analizy: [Do kiedy - ile godzin/dni]

═══════════════════════════════════════════════════════════

ZASADY:
- Bądź konkretny - podawaj liczby z podanych danych
- Bądź szczery w ocenie - nie wmawiaj wysoce ryzykownych inwestycji
- Odpowiadaj PO POLSKU
- Bądź profesjonalny ale z lekkim humorem
- Każda sekcja powinna mieć 2-4 zdania`;

    console.log('🤖 Wysyłam do Groq...');

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: technicalAnalysis }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 2000,
    });

    const answer = completion.choices[0]?.message?.content || "Brak odpowiedzi";

    res.json({
      success: true,
      ticker: marketData.ticker,
      analysis: answer,
      marketData: {
        price: marketData.price,
        change: marketData.change,
        changePercent: marketData.changePercent,
        rsi: marketData.rsi,
        sma20: marketData.sma20,
        sma50: marketData.sma50,
        support1: marketData.support1,
        resistance1: marketData.resistance1
      }
    });

  } catch (error) {
    console.error("❌ Błąd:", error.message);
    res.status(500).json({ error: "Błąd podczas analizy: " + error.message });
  }
});

// ============ ROUTES ============

app.get('/', (req, res) => {
  res.json({ status: "✅ Backend online", message: "Use POST /api/analyze" });
});

app.get('/api/health', (req, res) => {
  res.json({ status: "✅ Backend online", timestamp: new Date().toISOString() });
});

// ============ START SERVER ============

app.listen(PORT, () => {
  console.log(`✅ Backend uruchomiony na http://localhost:${PORT}`);
  console.log(`🔑 Massive API Key: ${process.env.MASSIVE_API_KEY ? '✅ załadowany' : '❌ BRAK'}`);
  console.log(`🤖 Groq API Key: ${process.env.GROQ_API_KEY ? '✅ załadowany' : '❌ BRAK'}`);
});