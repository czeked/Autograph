<<<<<<< HEAD
﻿import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const apiKey = process.env.MASSIVE_API_KEY || process.env.KEY;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.join(__dirname, "..", "frontend");

app.use(express.static(frontendDir));

function createMassiveUrl(route, params = {}) {
  const url = new URL(`https://api.massive.com${route}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  url.searchParams.set("apiKey", apiKey);
  return url;
}

async function fetchMassiveJson(route, params = {}) {
  const response = await fetch(createMassiveUrl(route, params));
  const payload = await response.json();

  if (!response.ok) {
    const message = payload.error || payload.message || "Massive API request failed.";
    throw new Error(message);
  }

  return payload;
}

function normalizeStockSymbol(symbol = "") {
  return symbol.trim().toUpperCase();
}

function parseCryptoInput(symbol = "") {
  const cleaned = symbol.trim().toUpperCase().replace(/\s+/g, "");

  if (cleaned.startsWith("X:")) {
    const pair = cleaned.slice(2);
    return {
      directTicker: cleaned,
      base: pair.slice(0, 3),
      quote: pair.slice(3),
    };
  }

  const separator = cleaned.includes("/") ? "/" : cleaned.includes("-") ? "-" : null;

  if (!separator) {
    throw new Error("Dla rynku crypto podaj pare w formacie BTC/USD albo ETH/BTC.");
  }

  const [base, quote] = cleaned.split(separator);

  if (!base || !quote) {
    throw new Error("Nieprawidlowy format pary crypto. Uzyj np. BTC/USD.");
  }

  return {
    directTicker: `X:${base}${quote}`,
    reverseTicker: `X:${quote}${base}`,
    base,
    quote,
  };
}

async function getTickerDetails(ticker) {
  const payload = await fetchMassiveJson(`/v3/reference/tickers/${encodeURIComponent(ticker)}`);
  return payload.results || null;
}

async function resolveCryptoTicker(input) {
  const parsed = parseCryptoInput(input);

  try {
    const details = await getTickerDetails(parsed.directTicker);
    return {
      ticker: parsed.directTicker,
      displaySymbol: `${parsed.base}/${parsed.quote}`,
      base: parsed.base,
      quote: parsed.quote,
      inverse: false,
      details,
    };
  } catch (error) {
    if (!parsed.reverseTicker) {
      throw error;
    }
  }

  const reverseDetails = await getTickerDetails(parsed.reverseTicker);

  return {
    ticker: parsed.reverseTicker,
    displaySymbol: `${parsed.base}/${parsed.quote}`,
    base: parsed.base,
    quote: parsed.quote,
    inverse: true,
    details: reverseDetails,
  };
}

function formatDateOffset(days) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function transformInverseBar(bar) {
  const reciprocal = (value) => (value ? 1 / value : null);
  const vwap = bar.vw || bar.c || null;

  return {
    ...bar,
    o: reciprocal(bar.o),
    c: reciprocal(bar.c),
    h: reciprocal(bar.l),
    l: reciprocal(bar.h),
    vw: reciprocal(vwap),
    v: vwap ? bar.v * vwap : null,
  };
}

async function getDailyBars(ticker, { inverse = false } = {}) {
  const payload = await fetchMassiveJson(
    `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${formatDateOffset(220)}/${formatDateOffset(0)}`,
    {
      adjusted: "true",
      sort: "asc",
      limit: 220,
    },
  );

  const results = Array.isArray(payload.results) ? payload.results : [];
  return inverse ? results.map(transformInverseBar) : results;
}

function getCloses(bars) {
  return bars.map((bar) => bar.c).filter((value) => typeof value === "number");
}

function computeSMA(values, window) {
  if (values.length < window) {
    return null;
  }

  const slice = values.slice(-window);
  return slice.reduce((sum, value) => sum + value, 0) / window;
}

function computeEMA(values, window) {
  if (values.length < window) {
    return null;
  }

  const multiplier = 2 / (window + 1);
  let ema = values.slice(0, window).reduce((sum, value) => sum + value, 0) / window;

  for (let index = window; index < values.length; index += 1) {
    ema = (values[index] - ema) * multiplier + ema;
  }

  return ema;
}

function computeRSI(values, window = 14) {
  if (values.length <= window) {
    return null;
  }

  let gains = 0;
  let losses = 0;

  for (let index = 1; index <= window; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }

  let averageGain = gains / window;
  let averageLoss = losses / window;

  for (let index = window + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    averageGain = ((averageGain * (window - 1)) + gain) / window;
    averageLoss = ((averageLoss * (window - 1)) + loss) / window;
  }

  if (averageLoss === 0) {
    return 100;
  }

  const relativeStrength = averageGain / averageLoss;
  return 100 - (100 / (1 + relativeStrength));
}

function computeVolatility(values, window = 30) {
  if (values.length <= window) {
    return null;
  }

  const returns = [];

  for (let index = values.length - window; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];

    if (previous && current) {
      returns.push((current - previous) / previous);
    }
  }

  if (!returns.length) {
    return null;
  }

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function computeDailyChangePercent(values) {
  if (values.length < 2) {
    return null;
  }

  const previous = values.at(-2);
  const current = values.at(-1);

  if (!previous || !current) {
    return null;
  }

  return ((current - previous) / previous) * 100;
}

function summarizeNewsSentiment(news = [], trackedTicker) {
  const summary = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };

  news.forEach((item) => {
    const insight = item.insights?.find((entry) => entry.ticker === trackedTicker);
    const sentiment = insight?.sentiment;

    if (sentiment === "positive" || sentiment === "negative" || sentiment === "neutral") {
      summary[sentiment] += 1;
    }
  });

  return summary;
}

function determineTrend({ lastClose, sma50, ema20 }) {
  if (lastClose && sma50 && ema20 && lastClose > sma50 && ema20 > sma50) {
    return "bullish";
  }

  if (lastClose && sma50 && ema20 && lastClose < sma50 && ema20 < sma50) {
    return "bearish";
  }

  return "neutral";
}

function assessCorrectionRisk({ market, lastClose, sma20, ema20, rsi14, volatility30d, newsSentiment, dailyChangePercent }) {
  const reasons = [];
  let score = 0;

  if (rsi14 !== null && rsi14 >= 70) {
    score += 2;
    reasons.push("RSI jest w strefie wykupienia powyzej 70.");
  } else if (rsi14 !== null && rsi14 >= 63) {
    score += 1;
    reasons.push("RSI zbliza sie do strefy wykupienia.");
  }

  if (lastClose && sma20 && lastClose > sma20 * 1.05) {
    score += 1;
    reasons.push("Cena jest wyraznie powyzej SMA 20.");
  }

  if (lastClose && ema20 && lastClose > ema20 * 1.05) {
    score += 1;
    reasons.push("Cena jest wyraznie powyzej EMA 20.");
  }

  const volatilityThreshold = market === "crypto" ? 85 : 35;

  if (volatility30d !== null && volatility30d > volatilityThreshold) {
    score += 1;
    reasons.push("Zmiennosc 30D jest podwyzszona.");
  }

  if (dailyChangePercent !== null && dailyChangePercent <= -4) {
    score += 1;
    reasons.push("Ostatnia sesja pokazala mocniejsze cofniecie ceny.");
  }

  if (newsSentiment.negative > newsSentiment.positive) {
    score += 1;
    reasons.push("W newsach przewaza negatywny sentyment.");
  }

  let level = "low";

  if (score >= 5) {
    level = "high";
  } else if (score >= 3) {
    level = "elevated";
  } else if (score >= 1) {
    level = "moderate";
  }

  if (!reasons.length) {
    reasons.push("Brak silnych sygnalow przegrzania w ostatnich danych.");
  }

  return {
    level,
    score,
    methodology: "Heurystyka oparta na RSI, SMA, EMA, zmiennosci i sentymencie newsow. To nie jest pewna prognoza rynku.",
    reasons,
  };
}

function formatCompactNews(items = [], trackedTicker) {
  return items.map((item) => {
    const insight = item.insights?.find((entry) => entry.ticker === trackedTicker);

    return {
      title: item.title,
      publishedUtc: item.published_utc,
      source: item.publisher?.name || "Unknown",
      url: item.article_url,
      description: item.description,
      sentiment: insight?.sentiment || null,
      sentimentReasoning: insight?.sentiment_reasoning || null,
    };
  });
}

async function getNews({ assetTicker }) {
  const [assetPayload, globalPayload] = await Promise.all([
    fetchMassiveJson("/v2/reference/news", { ticker: assetTicker, limit: 5 }),
    fetchMassiveJson("/v2/reference/news", { limit: 5 }),
  ]);

  return {
    assetNews: assetPayload.results || [],
    globalNews: globalPayload.results || [],
  };
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  return Number(value.toFixed(digits));
}

app.get("/api", (req, res) => {
  res.json({ message: "API backend dziala." });
});

app.get("/api/asset-search", async (req, res) => {
  if (!apiKey) {
    return res.status(500).json({ error: "Brak klucza MASSIVE_API_KEY w konfiguracji backendu." });
  }

  const market = req.query.market === "crypto" ? "crypto" : "stocks";
  const query = String(req.query.query || "").trim();

  if (!query) {
    return res.status(400).json({ error: "Podaj query do wyszukania." });
  }

  try {
    const payload = await fetchMassiveJson("/v3/reference/tickers", {
      market,
      search: query,
      active: "true",
      limit: 10,
    });

    return res.json({
      market,
      results: (payload.results || []).map((item) => ({
        ticker: item.ticker,
        name: item.name,
        locale: item.locale,
        baseCurrencySymbol: item.base_currency_symbol || null,
        currencySymbol: item.currency_symbol || null,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Nie udalo sie wyszukac aktywow.",
    });
  }
});

app.get("/api/analyze", async (req, res) => {
  if (!apiKey) {
    return res.status(500).json({ error: "Brak klucza MASSIVE_API_KEY w konfiguracji backendu." });
  }

  const market = req.query.market === "crypto" ? "crypto" : "stocks";
  const symbol = String(req.query.symbol || "").trim();

  if (!symbol) {
    return res.status(400).json({ error: "Podaj symbol lub pare do analizy." });
  }

  try {
    let details;
    let resolvedTicker;
    let displaySymbol;
    let trackedNewsTicker;
    let inverse = false;

    if (market === "stocks") {
      resolvedTicker = normalizeStockSymbol(symbol);
      details = await getTickerDetails(resolvedTicker);
      displaySymbol = resolvedTicker;
      trackedNewsTicker = resolvedTicker;
    } else {
      const crypto = await resolveCryptoTicker(symbol);
      resolvedTicker = crypto.ticker;
      details = crypto.details;
      displaySymbol = crypto.displaySymbol;
      trackedNewsTicker = crypto.base;
      inverse = crypto.inverse;
    }

    const [bars, newsBundle] = await Promise.all([
      getDailyBars(resolvedTicker, { inverse }),
      getNews({ assetTicker: trackedNewsTicker }),
    ]);

    if (bars.length < 20) {
      return res.status(404).json({
        error: `Za malo danych historycznych dla ${displaySymbol}.`,
      });
    }

    const closes = getCloses(bars);
    const latestBar = bars.at(-1);
    const latestClose = latestBar?.c ?? null;
    const latestVolume = latestBar?.v ?? null;
    const sma20 = computeSMA(closes, 20);
    const sma50 = computeSMA(closes, 50);
    const ema20 = computeEMA(closes, 20);
    const ema50 = computeEMA(closes, 50);
    const rsi14 = computeRSI(closes, 14);
    const volatility30d = computeVolatility(closes, 30);
    const dailyChangePercent = computeDailyChangePercent(closes);
    const newsSentiment = summarizeNewsSentiment(newsBundle.assetNews, trackedNewsTicker);
    const trend = determineTrend({ lastClose: latestClose, sma50, ema20 });
    const correctionRisk = assessCorrectionRisk({
      market,
      lastClose: latestClose,
      sma20,
      ema20,
      rsi14,
      volatility30d,
      newsSentiment,
      dailyChangePercent,
    });

    return res.json({
      market,
      symbol: displaySymbol,
      requestedSymbol: symbol,
      sourceTicker: resolvedTicker,
      inversePairUsed: inverse,
      delayedData: true,
      overview: {
        name: details?.name || displaySymbol,
        marketCap: details?.market_cap ?? null,
        marketCapAvailable: typeof details?.market_cap === "number",
        currency: details?.currency_name || details?.currency_symbol || "usd",
        description: details?.description || null,
        exchange: details?.primary_exchange || details?.market || null,
      },
      price: {
        close: formatNumber(latestClose, 6),
        open: formatNumber(latestBar?.o, 6),
        high: formatNumber(latestBar?.h, 6),
        low: formatNumber(latestBar?.l, 6),
        volume: formatNumber(latestVolume, 4),
        volumeWeightedAveragePrice: formatNumber(latestBar?.vw, 6),
        transactions: latestBar?.n ?? null,
        timestamp: latestBar?.t ?? null,
        dailyChangePercent: formatNumber(dailyChangePercent, 2),
      },
      indicators: {
        rsi14: formatNumber(rsi14, 2),
        sma20: formatNumber(sma20, 6),
        sma50: formatNumber(sma50, 6),
        ema20: formatNumber(ema20, 6),
        ema50: formatNumber(ema50, 6),
        volatility30d: formatNumber(volatility30d, 2),
        trend,
      },
      correctionRisk,
      news: {
        trackedTicker: trackedNewsTicker,
        sentiment: newsSentiment,
        asset: formatCompactNews(newsBundle.assetNews, trackedNewsTicker),
        global: formatCompactNews(newsBundle.globalNews, trackedNewsTicker),
      },
      history: bars.slice(-60).map((bar) => ({
        timestamp: bar.t,
        open: formatNumber(bar.o, 6),
        high: formatNumber(bar.h, 6),
        low: formatNumber(bar.l, 6),
        close: formatNumber(bar.c, 6),
        volume: formatNumber(bar.v, 4),
      })),
      notes: [
        "To nie jest porada inwestycyjna.",
        "Ocena ryzyka korekty jest inferencja oparta na danych Massive i lokalnej heurystyce.",
        inverse ? "Pokazano odwrotna pare przeliczona z dostepnego rynku odwrotnego." : null,
        market === "crypto" && typeof details?.market_cap !== "number"
          ? "Massive nie zwraca market cap dla tej pary crypto w obecnej odpowiedzi API."
          : null,
      ].filter(Boolean),
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Nie udalo sie przygotowac analizy rynku.",
    });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

app.listen(port, () => {
  console.log(`Serwer dziala na http://localhost:${port}`);
});
=======
// index.js
import 'dotenv/config';
import express from 'express';
import Groq from 'groq-sdk';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function getStockData(ticker) {
  try {
    const response = await axios.get(`https://api.massive.com/v1/stocks/${ticker.toUpperCase()}`, {
      headers: {
        'Authorization': `Bearer ${process.env.MASSIVE_API_KEY}`,
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Nie udało się pobrać danych dla ${ticker}`);
    return null;
  }
}

app.post('/api/analyze', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Brak promptu" });
  }

  try {
    const tickerMatch = prompt.match(/\b([A-Z]{1,5})\b/);
    const ticker = tickerMatch ? tickerMatch[1].toUpperCase() : null;

    let marketData = null;
    let dataSection = "";

    if (ticker) {
      marketData = await getStockData(ticker);

      if (marketData) {
        const price = marketData.price ? marketData.price.toFixed(2) : "N/A";
        const change = marketData.changePercent ? marketData.changePercent.toFixed(2) : "N/A";
        const changeSign = change > 0 ? "+" : "";

        dataSection = `
Aktualne dane rynkowe (${ticker}):
- Aktualna cena: ${price} USD
- Zmiana dzisiaj: ${changeSign}${change}%
- Wolumen: ${marketData.volume || "N/A"}
- Market Cap: ${marketData.marketCap || "N/A"}
- P/E: ${marketData.pe || "N/A"}
`;
      }
    }

    const systemPrompt = `Jesteś profesjonalnym analitykiem giełdowym. Zawsze odpowiadaj dokładnie w tym formacie (nie dodawaj nic poza tymi sekcjami):

Aktualna cena
Cena wynosi obecnie X.XX USD

Zmiana dzisiaj
+1.87% (lub -0.45%)

Wzrost i perspektywy
(tutaj analiza wzrostu, dobre strony, szanse na przyszłość)

Na jakich giełdach działa
(główna giełda + ewentualnie inne)

Wyzwania i zagrożenia
(główne ryzyka, problemy, zagrożenia)

Wnioski
(krótkie podsumowanie)

Rekomendacja
(np. Kupuj / Trzymaj / Sprzedaj / Ostrożnie obserwuj) + krótki uzasadnienie

Używaj rzeczywistych danych, które dostałeś. Odpowiadaj po polsku, konkretnie, szczerze i z lekkim humorem.`;

    const userPrompt = dataSection 
      ? `${dataSection}\nZapytanie użytkownika: ${prompt}`
      : prompt;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.65,
      max_tokens: 1300,
    });

    let answer = completion.choices[0]?.message?.content || "Brak odpowiedzi";

    res.json({ 
      answer,
      tickerUsed: ticker,
      hadRealData: !!marketData 
    });

  } catch (error) {
    console.error("Błąd:", error.message);
    res.status(500).json({ error: "Błąd podczas analizy" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend uruchomiony na http://localhost:${PORT}`);
});
>>>>>>> dfd78d7719beb41fca0c56c1afe0f1fd4a90f45b
