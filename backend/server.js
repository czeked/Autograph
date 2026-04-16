import 'dotenv/config';
import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import cors from 'cors';
import axios from 'axios';
import { calculateRSI, getSMA, calculateEMA, calculateEMASeries, calculateMACD, calculateBollingerBands, calculateATR, calculateADX, calculateStochRSI, calculateOBV, calculatePivotPoints, calculateFibonacci } from './indicators/index.js';
import { AI_RESPONSE_SCHEMA } from './config/aiSchema.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- CACHE ---
const analysisCache = new Map();
const dayAnalysisCache = new Map();
const CACHE_TTL = 1000 * 60 * 60 * 2; // 2h
const DAY_CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

// --- RATE LIMITER ---
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 1000 * 60 * 60; // 1h

function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

// Indicator functions imported from ./indicators/index.js


function checkRateLimit(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
        rateLimitMap.set(ip, { count: 1, windowStart: now });
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
    }
    if (entry.count >= RATE_LIMIT_MAX) {
        const resetIn = Math.ceil((RATE_LIMIT_WINDOW - (now - entry.windowStart)) / 1000 / 60);
        return { allowed: false, remaining: 0, resetIn };
    }
    entry.count++;
    return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

setInterval(() => {
    const now = Date.now();
    for (const [key, val] of analysisCache.entries()) if (now - val.timestamp > CACHE_TTL) analysisCache.delete(key);
    for (const [key, val] of dayAnalysisCache.entries()) if (now - val.timestamp > DAY_CACHE_TTL) dayAnalysisCache.delete(key);
    for (const [ip, val] of rateLimitMap.entries()) if (now - val.windowStart > RATE_LIMIT_WINDOW) rateLimitMap.delete(ip);
}, 1000 * 60 * 30);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'Brak_GEMINI_API_KEY');

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const MASSIVE_KEY = process.env.MASSIVE_API_KEY;

app.get('/api/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    try {
        const response = await axios.get(`https://finnhub.io/api/v1/search?q=${q.toUpperCase()}&token=${FINNHUB_KEY}`);
        res.json((response.data.result || []).map(i => ({ ticker: i.symbol, name: i.description })).slice(0, 8));
    } catch (e) { res.json([]); }
});

app.post('/api/analyze', async (req, res) => {
    const { ticker, timeframe = '1Y', entryPrice, stopLoss } = req.body;
    const reqStart = Date.now();

    // Walidacja symbolu
    const symbol = (ticker || '').toUpperCase().trim().replace(/[^A-Z0-9.]/g, '');
    if (!symbol || symbol.length > 10) {
        return res.status(400).json({ error: 'Niepoprawny symbol (max 10 znaków, tylko litery/cyfry).' });
    }
    const ip = getClientIp(req);
    const cacheKey = `${symbol}_${timeframe}_E${entryPrice || 'none'}_S${stopLoss || 'none'}`;

    if (analysisCache.has(cacheKey)) {
        const cached = analysisCache.get(cacheKey);
        return res.json({ ...cached.data, _cached: true });
    }

    const { allowed, remaining, resetIn } = checkRateLimit(ip);
    if (!allowed) {
        return res.status(429).json({ error: `Limit wyczerpany. Spróbuj za ${resetIn} min.` });
    }

    try {
        let allHistory = [], allNews = [], allEarnings = [], allMetric = {};

        let baseData = analysisCache.get(`${symbol}_BASE`);
        if (!baseData) {
            const todayDate = new Date();
            const dateToStr = todayDate.toISOString().split('T')[0];
            const dateFromObj = new Date(todayDate.setFullYear(todayDate.getFullYear() - 2));
            const dateFromStr = dateFromObj.toISOString().split('T')[0];

            // Massive API (Polygon-compatible) — oficjalne, niezawodne źródło danych
            let yfHistory = [];
            try {
                const massiveRes = await axios.get(
                    `https://api.massive.com/v2/aggs/ticker/${symbol}/range/1/day/${dateFromStr}/${dateToStr}?adjusted=true&sort=asc&limit=730&apiKey=${MASSIVE_KEY}`
                );
                const results = massiveRes.data.results || [];
                for (const bar of results) {
                    if (bar.c !== null && bar.c !== undefined) {
                        yfHistory.push({
                            date: new Date(bar.t).toISOString(),
                            close: bar.c,
                            open: bar.o,
                            high: bar.h,
                            low: bar.l,
                            volume: bar.v
                        });
                    }
                }
            } catch (err) {
                console.error("Massive API Error:", err.response?.data || err.message);
            }

            // Fallback: Finnhub candles (daily) when Massive returns nothing
            if (yfHistory.length === 0) {
                try {
                    console.log(`[FALLBACK] Trying Finnhub candles for ${symbol}`);
                    const fromTs = Math.floor(dateFromObj.getTime() / 1000);
                    const toTs   = Math.floor(Date.now() / 1000);
                    const fhRes  = await axios.get(
                        `https://finnhub.io/api/v1/stock/candles?symbol=${symbol}&resolution=D&from=${fromTs}&to=${toTs}&token=${FINNHUB_KEY}`
                    );
                    if (fhRes.data.s === 'ok' && fhRes.data.c?.length) {
                        yfHistory = fhRes.data.t.map((ts, i) => ({
                            date:   new Date(ts * 1000).toISOString(),
                            close:  fhRes.data.c[i],
                            open:   fhRes.data.o[i],
                            high:   fhRes.data.h[i],
                            low:    fhRes.data.l[i],
                            volume: fhRes.data.v[i]
                        }));
                        console.log(`[FALLBACK] Finnhub OK: ${yfHistory.length} bars for ${symbol}`);
                    }
                } catch (fhErr) {
                    console.error("Finnhub fallback error:", fhErr.message);
                }
            }

            // Massive API news — pełne 365 dni z URL artykułów (Polygon-compatible)
            let allNewsArray = [];
            try {
                const d365 = new Date(); d365.setDate(d365.getDate() - 365);
                const from365 = d365.toISOString().split('T')[0];

                const [rEarn, rMetric] = await Promise.all([
                    axios.get(`https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&token=${FINNHUB_KEY}`).catch(() => ({ data: [] })),
                    axios.get(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`, { timeout: 5000 }).catch(() => ({ data: {} })),
                ]);

                // Omijamy limit 1000 dla gigantów medialnych (jak NVDA), wykorzystując paginację
                let rawArticles = [];
                let nextUrl = `https://api.massive.com/v2/reference/news?ticker=${symbol}&published_utc.gte=${from365}&limit=1000&sort=published_utc&order=desc&apiKey=${MASSIVE_KEY}`;

                try {
                    for (let k = 0; k < 5; k++) { // Max 5 stron by zabezpieczyć czas (~5000 wiadomości)
                        const r = await axios.get(nextUrl);
                        if (r.data?.results) rawArticles.push(...r.data.results);
                        if (r.data?.next_url) {
                            nextUrl = r.data.next_url + `&apiKey=${MASSIVE_KEY}`;
                        } else {
                            break;
                        }
                    }
                } catch (e) {
                    // ignoruj jeśli kolejne trzaśnięcia napotkały koniec limitów
                }

                // Pobieranie nazwy firmy z profilu by wykluczyć potem fałszywe newsy
                let companyName = symbol;
                try {
                    const prof = await axios.get(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`);
                    if (prof.data && prof.data.name) {
                        companyName = prof.data.name.split(' ')[0].toLowerCase(); // np. "Tesla Inc" -> "tesla"
                    }
                } catch (e) { }

                // Mapowanie Massive news z RYGORYSTYCZNYM filtrem
                const massiveNews = rawArticles.map(n => ({
                    headline: n.title,
                    datetime: Math.floor(new Date(n.published_utc).getTime() / 1000),
                    url: n.article_url || null,
                    description: n.description || null,
                    source: n.publisher?.name || 'Massive',
                    sentiment: n.insights?.find(ins => ins.ticker === symbol)?.sentiment || null
                })).filter(n => {
                    if (!n.headline) return false;
                    const txt = (n.headline).toLowerCase();
                    const tick = symbol.toLowerCase();
                    // Zostaw tylko, jeśli nazwa spółki albo ticker są bezpośrednio w NAGŁÓWKU 
                    // Odrzuca to zgiełk, pakiety zbiorcze (Dogecoin, Dow Jones itp.)
                    return txt.includes(tick) || txt.includes(companyName);
                });

                allNewsArray = massiveNews;
                allEarnings = Array.isArray(rEarn.data) ? rEarn.data : [];
                allMetric = rMetric.data?.metric || {};

            } catch (e) {
                console.error("News/Earnings batch error", e.message);
            }

            allHistory = yfHistory.map(item => ({
                t: new Date(item.date).getTime(), c: item.close, o: item.open, h: item.high, l: item.low, v: item.volume
            })).sort((a, b) => a.t - b.t);

            allNews = allNewsArray;

            analysisCache.set(`${symbol}_BASE`, { timestamp: Date.now(), allHistory, allNews, allEarnings, allMetric });
        } else {
            allHistory = baseData.allHistory;
            allNews = baseData.allNews;
            allEarnings = baseData.allEarnings;
            allMetric = baseData.allMetric || {};
        }

        if (!allHistory || allHistory.length === 0) throw new Error("Massive API nie zwróciło danych. Sprawdź MASSIVE_API_KEY lub symbol.");

        // Obliczenia QUANT na CAŁEJ historii
        const rsi = calculateRSI(allHistory);
        const sma50 = getSMA(allHistory, 50);
        const sma20 = getSMA(allHistory, 20);
        const lastC = allHistory[allHistory.length - 1]?.c || 0;

        // Trend krótkoterminowy na podstawie średniej 5-dniowej
        const sma5 = getSMA(allHistory, 5);
        const mom5 = allHistory.length > 5 ? ((lastC - sma5) / sma5) * 100 : 0;

        // Nachylenie SMA50 — czy trend długoterminowy rośnie czy zakręca w dół
        const prevSma50 = getSMA(allHistory.slice(0, -5), 50);
        const sma50Slope = prevSma50 > 0 ? ((sma50 - prevSma50) / prevSma50) * 100 : 0;

        // Trend wolumenu — porównanie średniej z ostatnich 5 dni do ostatnich 20 dni
        const recentVol5 = allHistory.slice(-5).reduce((s, h) => s + (h.v || 0), 0) / 5;
        const recentVol20 = allHistory.slice(-20).reduce((s, h) => s + (h.v || 0), 0) / 20;
        const volumeTrend = recentVol5 > recentVol20 * 1.2 ? 'ROSNĄCY' : (recentVol5 < recentVol20 * 0.8 ? 'MALEJĄCY' : 'NEUTRALNY');
        const isDistribution = mom5 < 0 && volumeTrend === 'ROSNĄCY';

        // --- NOWE WSKAŹNIKI ---
        const ema9  = calculateEMA(allHistory, 9);
        const ema21 = calculateEMA(allHistory, 21);
        const ema50 = calculateEMA(allHistory, 50);
        const ema200 = calculateEMA(allHistory, 200);
        const macdData = calculateMACD(allHistory);
        const bbData = calculateBollingerBands(allHistory);
        const atrData = calculateATR(allHistory);
        const adxData = calculateADX(allHistory);
        const stochRsi = calculateStochRSI(allHistory);

        // EMA Crossovers
        const ema9_21Cross = ema9 > ema21 ? 'BULLISH (9 > 21)' : 'BEARISH (9 < 21)';
        const goldenDeathCross = ema50 > ema200 ? 'GOLDEN CROSS (EMA50 > EMA200) ' : 'DEATH CROSS (EMA50 < EMA200) ';
        const priceVsEma200 = lastC > ema200 ? 'POWYŻEJ EMA200 (strefa byków)' : 'PONIŻEJ EMA200 (strefa niedźwiedzi)';

        // MACD interpretation (fixed)
        const macdCross = macdData.macd > macdData.signal ? 'MACD POWYŻEJ SYGNAŁU (bullish)' : 'MACD PONIŻEJ SYGNAŁU (bearish)';

        // Bollinger Bands interpretation
        const bbPosition = bbData.percentB > 80 ? 'PRZY GÓRNYM PAŚMIE (wykupienie)' : bbData.percentB < 20 ? 'PRZY DOLNYM PAŚMIE (wyprzedanie)' : 'WEWNĄTRZ PASM (normalny zakres)';
        const bbSqueeze = bbData.bandwidth < 5 ? 'SQUEEZE — oczekuj wybicia!' : bbData.bandwidth > 20 ? 'ROZSZERZENIE — wysoka zmienność' : 'NORMALNE PASMA';

        // ATR-based dynamic stop loss
        const atrSL = (lastC - atrData * 2).toFixed(2);
        const atrPercent = lastC > 0 ? ((atrData / lastC) * 100).toFixed(2) : '0';

        // OBV — potwierdza trend wolumenem
        const obvData = calculateOBV(allHistory);

        // Fibonacci retracement od 52W High/Low
        const hist52w = allHistory.slice(-252);
        const high52w = hist52w.length ? Math.max(...hist52w.map(h => h.c)) : lastC;
        const low52w  = hist52w.length ? Math.min(...hist52w.map(h => h.c)) : lastC;
        const fib = calculateFibonacci(high52w, low52w);

        // Pivot Points (tygodniowe)
        const pivots = calculatePivotPoints(allHistory);

        // P/E, P/B z Finnhub metrics
        const peRatio = allMetric['peNormalizedAnnual'] || allMetric['peTTM'] || null;
        const pbRatio = allMetric['pbAnnual'] || allMetric['pbQuarterly'] || null;
        const epsGrowth = allMetric['epsGrowth3Y'] || allMetric['epsGrowth5Y'] || null;
        const revenueGrowth = allMetric['revenueGrowth3Y'] || null;

        // Ocena wyrównania sygnałów — system ważony
        const distFromHigh52w = high52w > 0 ? ((lastC - high52w) / high52w * 100).toFixed(1) : '0';
        const distFromLow52w  = low52w  > 0 ? ((lastC - low52w)  / low52w  * 100).toFixed(1) : '0';

        // Period returns
        const periodRet = (bars) => {
            const sl = allHistory.slice(-bars - 1);
            if (sl.length < 2) return null;
            return ((sl[sl.length - 1].c - sl[0].c) / sl[0].c * 100).toFixed(1);
        };
        const ret1w  = periodRet(5);
        const ret1m  = periodRet(21);
        const ret3m  = periodRet(63);
        const ret6m  = periodRet(126);
        const ret1y  = periodRet(252);

        // News sentiment aggregate (Massive API insights)
        const sentArticles = allNews.filter(n => n.sentiment);
        const sentBull = sentArticles.filter(n => n.sentiment === 'positive').length;
        const sentBear = sentArticles.filter(n => n.sentiment === 'negative').length;
        const sentTotal = sentArticles.length || 1;
        const sentBullPct = Math.round(sentBull / sentTotal * 100);
        const sentBearPct = Math.round(sentBear / sentTotal * 100);

        let bearScore = 0, bullScore = 0;
        // RSI (waga 1)
        if (rsi > 70) bearScore += 1;
        else if (rsi < 30) bullScore += 1;
        if (rsi > 50) bullScore += 1; else bearScore += 1;
        // Stochastic RSI (waga 1)
        if (stochRsi.k > 80) bearScore += 1;
        else if (stochRsi.k < 20) bullScore += 1;
        // SMA pozycja (waga 1)
        if (lastC < sma50) bearScore += 1; else bullScore += 1;
        if (lastC < sma20) bearScore += 1; else bullScore += 1;
        // SMA50 slope (waga 1)
        if (sma50Slope < -1.5) bearScore += 1; else if (sma50Slope > 0.5) bullScore += 1;
        // Momentum (waga 1)
        if (mom5 < -1) bearScore += 1; else if (mom5 > 1) bullScore += 1;
        // Dystrybucja (waga 2)
        if (isDistribution) bearScore += 2;
        // EMA Crossovers (waga 2)
        if (ema9 > ema21) bullScore += 2; else bearScore += 2;
        if (ema50 > ema200) bullScore += 2; else bearScore += 2;
        // MACD (waga 2)
        if (macdData.macd > macdData.signal) bullScore += 2; else bearScore += 2;
        if (macdData.histogram > 0) bullScore += 1; else bearScore += 1;
        // Bollinger Bands (waga 1)
        if (bbData.percentB > 80) bearScore += 1;
        else if (bbData.percentB < 20) bullScore += 1;
        // ADX direction (waga 2 — tylko jeśli trend jest silny ADX>25)
        if (adxData.adx >= 25) {
            if (adxData.plusDI > adxData.minusDI) bullScore += 2; else bearScore += 2;
        }
        // Cena vs EMA200 (waga 2 — kluczowy filtr instytucjonalny)
        if (lastC > ema200) bullScore += 2; else bearScore += 2;

        const signalBias = bearScore > bullScore
            ? `NIEDŹWIEDZI (${bearScore} pkt SHORT vs ${bullScore} pkt LONG)`
            : `BYCZY (${bullScore} pkt LONG vs ${bearScore} pkt SHORT)`;

        // Trend określany łącznie — cena + nachylenie SMA (nie tylko pozycja względem średniej)
        const longTrend = lastC > sma50 && sma50Slope > 0 ? 'SILNY BYCZY' :
            lastC < sma50 && sma50Slope < 0 ? 'SILNY NIEDŹWIEDZI' :
                lastC > sma50 && sma50Slope < -0.3 ? 'SŁABNĄCY BYCZY (zakręt w dół)' :
                    lastC < sma50 && sma50Slope > 0.3 ? 'SŁABNĄCY NIEDŹWIEDZI (możliwe dno)' :
                        'NIEPEWNY / KONSOLIDACJA';

        const quantStats = {
            rsi: Math.round(rsi),
            momentum5d: mom5.toFixed(1),
            trend: longTrend,
            short_trend: lastC > sma20 ? 'BYCZY (Krótkoterm)' : 'NIEDŹWIEDZI (Krótkoterm)',
            sma50_slope: sma50Slope.toFixed(2) + '%',
            volume_trend: volumeTrend,
            is_distribution: isDistribution,
            is_overbought: rsi > 70,
            is_oversold: rsi < 30,
            signal_bias: signalBias,
            // EMA
            ema9: ema9.toFixed(2),
            ema21: ema21.toFixed(2),
            ema50: ema50.toFixed(2),
            ema200: ema200.toFixed(2),
            ema9_21_cross: ema9_21Cross,
            golden_death_cross: goldenDeathCross,
            price_vs_ema200: priceVsEma200,
            // MACD
            macd: macdData.macd.toFixed(4),
            macd_signal: macdData.signal.toFixed(4),
            macd_histogram: macdData.histogram.toFixed(4),
            macd_cross: macdCross,
            // Bollinger Bands
            bb_upper: bbData.upper?.toFixed(2),
            bb_middle: bbData.middle?.toFixed(2),
            bb_lower: bbData.lower?.toFixed(2),
            bb_bandwidth: bbData.bandwidth.toFixed(2) + '%',
            bb_percentB: bbData.percentB.toFixed(1) + '%',
            bb_position: bbPosition,
            bb_squeeze: bbSqueeze,
            // ATR
            atr: atrData.toFixed(2),
            atr_percent: atrPercent + '%',
            atr_stop_loss: '$' + atrSL,
            // ADX
            adx: adxData.adx,
            adx_plus_di: adxData.plusDI,
            adx_minus_di: adxData.minusDI,
            adx_trend: adxData.trend,
            // Stochastic RSI
            stoch_rsi_k: stochRsi.k,
            stoch_rsi_d: stochRsi.d,
            stoch_rsi_signal: stochRsi.signal,
            // SMA actual values
            sma20: sma20.toFixed(2),
            sma50: sma50.toFixed(2),
            // OBV
            obv_trend: obvData.trend,
            // Fibonacci retracement (52W High/Low)
            fib_236: fib.fib_236,
            fib_382: fib.fib_382,
            fib_500: fib.fib_500,
            fib_618: fib.fib_618,
            fib_786: fib.fib_786,
            // Pivot Points (weekly)
            pivot_p:  pivots?.P  ?? null,
            pivot_r1: pivots?.R1 ?? null,
            pivot_r2: pivots?.R2 ?? null,
            pivot_s1: pivots?.S1 ?? null,
            pivot_s2: pivots?.S2 ?? null,
            // Fundamentals
            pe_ratio: peRatio != null ? Number(peRatio).toFixed(1) : 'N/A',
            pb_ratio: pbRatio != null ? Number(pbRatio).toFixed(2) : 'N/A',
            eps_growth: epsGrowth != null ? Number(epsGrowth).toFixed(1) + '%' : 'N/A',
            revenue_growth: revenueGrowth != null ? Number(revenueGrowth).toFixed(1) + '%' : 'N/A',
            // 52-week context
            high52w: high52w.toFixed(2),
            low52w: low52w.toFixed(2),
            dist_from_high52w: distFromHigh52w + '%',
            dist_from_low52w: distFromLow52w + '%',
            // Period returns
            ret1w:  ret1w  !== null ? ret1w  + '%' : 'N/A',
            ret1m:  ret1m  !== null ? ret1m  + '%' : 'N/A',
            ret3m:  ret3m  !== null ? ret3m  + '%' : 'N/A',
            ret6m:  ret6m  !== null ? ret6m  + '%' : 'N/A',
            ret1y:  ret1y  !== null ? ret1y  + '%' : 'N/A',
            // Sentiment
            sent_bull_pct: sentBullPct + '%',
            sent_bear_pct: sentBearPct + '%',
            sent_total: sentTotal,
            // Defensive BB/MACD/ATR (ensure no undefined)
            bb_upper:  bbData.upper  != null ? Number(bbData.upper).toFixed(2)  : null,
            bb_middle: bbData.middle != null ? Number(bbData.middle).toFixed(2) : null,
            bb_lower:  bbData.lower  != null ? Number(bbData.lower).toFixed(2)  : null,
        };

        // --- FILTORWANIE ZBIORÓW DANYCH WG WYBRANEJ RAMY CZASOWEJ (Timeframe) ---
        const cutoffDays = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '2Y': 730 }[timeframe] || 365;
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - cutoffDays);
        const limitTime = limitDate.getTime();

        const history = allHistory.filter(h => h.t >= limitTime);

        const news = allNews.filter(n => (n.datetime * 1000) >= limitTime);
        const earnings = allEarnings.filter(e => new Date(e.period).getTime() >= limitTime);


        // Znajdywanie anomalii cenowych w tym wyciętym okresie
        let pctChanges = [];
        for (let i = 1; i < history.length; i++) {
            const h = history[i];
            const prev = history[i - 1];
            const pct = ((h.c - prev.c) / prev.c) * 100;
            pctChanges.push({ pct, date: new Date(h.t).toISOString().split('T')[0] });
        }
        pctChanges.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

        // Słownik: data → zmiana % (do wzbogacenia kontekstu AI)
        const pctByDate = {};
        for (const p of pctChanges) pctByDate[p.date] = p.pct;

        const filteredNews = [...news].sort((a, b) => b.datetime - a.datetime);
        let newsByDate = new Map();
        for (const n of filteredNews) {
            const date = new Date(n.datetime * 1000).toISOString().split('T')[0];
            if (!newsByDate.has(date)) newsByDate.set(date, []);
            newsByDate.get(date).push({ ...n, pct: pctByDate[date] ?? 0 });
        }

        let diverseNews = [];
        let curCount = 0;
        const maxContextArticles = 100;

        let sortedDates = [...newsByDate.keys()].sort((a, b) => new Date(b) - new Date(a));
        for (const date of sortedDates) {
            const arr = newsByDate.get(date);
            const absPct = Math.abs(arr[0].pct || 0);

            // Odrzucamy dni bez drgań z kontekstu AI, aby limit 100 starczył na CAŁY rok (a nie uciął się w lutym na Nvidii)
            if (absPct < 1.0) {
                continue;
            }

            let takeCount = 1;
            if (absPct >= 4.0) takeCount = 3;
            else if (absPct >= 2.0) takeCount = 2;

            const selection = arr.slice(0, takeCount);
            diverseNews.push(...selection);
            curCount += selection.length;

            if (curCount > maxContextArticles) break;
        }

        diverseNews.sort((a, b) => {
            const dA = new Date(a.datetime * 1000).toISOString().split('T')[0];
            const dB = new Date(b.datetime * 1000).toISOString().split('T')[0];
            return Math.abs(pctByDate[dB] ?? 0) - Math.abs(pctByDate[dA] ?? 0);
        });

        // Ponieważ wyświetlamy nagłówki bez analizy AI, nie ma sensu pakować ogromnego kontekstu.
        // Zostawiamy mniejszy zestaw tytułów do ogólnego summary.
        const newsContext = diverseNews
            .map(n => {
                const date = new Date(n.datetime * 1000).toISOString().split('T')[0];
                return `DATA: ${date} | TYTUŁ: ${n.headline}`;
            })
            .join('\n');


        // 30 most recent articles (for current narrative, regardless of pct move)
        const recentNews = [...filteredNews].sort((a, b) => b.datetime - a.datetime).slice(0, 30);
        const recentNewsCtx = recentNews.map(n => {
            const date = new Date(n.datetime * 1000).toISOString().split('T')[0];
            const sent = n.sentiment ? ` [${n.sentiment}]` : '';
            return `${date}${sent}: ${n.headline}`;
        }).join('\n');

        // Earnings context (Finnhub)
        const earningsCtx = allEarnings.slice(0, 6).map(e => {
            const surp = e.surprisePercent != null ? ` (surprise: ${e.surprisePercent > 0 ? '+' : ''}${Number(e.surprisePercent).toFixed(1)}%)` : '';
            return `${e.period}: EPS actual=${e.actual ?? 'N/A'} vs est=${e.estimate ?? 'N/A'}${surp}`;
        }).join('\n') || 'No earnings data.';

        const userPositionStr = (entryPrice || stopLoss)
            ? `\nPOZYCJA WŁASNA INWESTORA DO PRZEANALIZOWANIA:\nZadeklarowana cena wejścia: $${entryPrice || 'Brak'}\nZadeklarowany Stop Loss: $${stopLoss || 'Brak'}\nOceń obiektywnie: czy pozycja jest bezpieczna, czy narażona na ryzyko? Podaj konkretne liczby R:R.`
            : `\nINWESTOR NIE POSIADA POZYCJI. Oceń czy aktywo zasługuje na wejście TERAZ — jeśli Signal Bias jest byczy i trend silny, zaproponuj entry. Jeśli dane są mieszane lub niedźwiedzie — rekomenduj NEUTRAL lub czekaj.`;

        const periodReturn = (((lastC - (history[0]?.c || lastC)) / (history[0]?.c || lastC)) * 100);
        const dataRecommendation = bullScore > bearScore ? 'LONG' : (bearScore > bullScore ? 'SHORT' : 'NEUTRAL');
        const currentDate = new Date().toISOString().split('T')[0];

        const promptFull = `Jestes obiektywnym, precyzyjnym analitykiem quant. Analizujesz spolke ${symbol} dla okresu ${timeframe}. DZISIEJSZA DATA: ${currentDate}.
NIE zmyslaj danych. Uzywaj wylacznie dostarczonych wartosci. Jezyk odpowiedzi: POLSKI.

=== PELNY ZESTAW WSKAZNIKOW TECHNICZNYCH ===

[OSCYLATORY MOMENTUM]
RSI(14): ${quantStats.rsi}${quantStats.is_overbought ? ' WYKUPIONY >70 - ryzyko odwrocenia' : quantStats.is_oversold ? ' WYPRZEDANY <30 - mozliwe odbicie' : ' - strefa neutralna'}
Stochastic RSI: K=${quantStats.stoch_rsi_k} D=${quantStats.stoch_rsi_d} => ${quantStats.stoch_rsi_signal}
Momentum 5d: ${quantStats.momentum5d}%

[MACD 12/26/9]
MACD: ${quantStats.macd} | Signal: ${quantStats.macd_signal} | Histogram: ${quantStats.macd_histogram}
Status: ${quantStats.macd_cross}

[EMA CROSSOVERS]
EMA9=$${quantStats.ema9} EMA21=$${quantStats.ema21} => ${quantStats.ema9_21_cross}
EMA50=$${quantStats.ema50} EMA200=$${quantStats.ema200} => ${quantStats.golden_death_cross}
Cena $${lastC.toFixed(2)} vs EMA200: ${quantStats.price_vs_ema200}

[SMA TREND]
Trend dlugotermninowy: ${quantStats.trend}
Trend krotkoterminowy (SMA20): ${quantStats.short_trend}
Nachylenie SMA50: ${quantStats.sma50_slope}

[BOLLINGER BANDS 20/2sigma]
Gorna=$${quantStats.bb_upper} Srodkowa=$${quantStats.bb_middle} Dolna=$${quantStats.bb_lower}
%B: ${quantStats.bb_percentB} => ${quantStats.bb_position}
Bandwidth: ${quantStats.bb_bandwidth} => ${quantStats.bb_squeeze}

[ADX - SILA TRENDU 14]
ADX: ${quantStats.adx} | +DI: ${quantStats.adx_plus_di} | -DI: ${quantStats.adx_minus_di}
Ocena: ${quantStats.adx_trend}
(ADX <20=brak trendu, 20-25=slaby, 25-40=silny, >40=bardzo silny)

[ATR - ZMIENNOSC 14]
ATR: $${quantStats.atr} (${quantStats.atr_percent} ceny) | Sugerowany SL (2xATR): ${quantStats.atr_stop_loss}

[WOLUMEN I OBV]
Trend wolumenu (5d vs 20d): ${quantStats.volume_trend}${quantStats.is_distribution ? ' DYSTRYBUCJA: cena spada przy rosnacym wolumenie!' : ''}
Sredni wolumen 20d: ${Math.round(history.slice(-20).reduce((s, h) => s + (h.v || 0), 0) / 20).toLocaleString()} | Wczoraj: ${(history[history.length - 1]?.v || 0).toLocaleString()}
OBV (On-Balance Volume): ${quantStats.obv_trend}

[FIBONACCI RETRACEMENT (52W High=$${quantStats.high52w} / Low=$${quantStats.low52w})]
23.6%: $${quantStats.fib_236} | 38.2%: $${quantStats.fib_382} | 50%: $${quantStats.fib_500} | 61.8%: $${quantStats.fib_618} | 78.6%: $${quantStats.fib_786}
Cena $${lastC.toFixed(2)} vs poziomy Fibonacciego — sprawdz ktory poziom dziala jako wsparcie/opor

[PIVOT POINTS (tygodniowe)]
P: $${quantStats.pivot_p} | R1: $${quantStats.pivot_r1} | R2: $${quantStats.pivot_r2} | S1: $${quantStats.pivot_s1} | S2: $${quantStats.pivot_s2}

[FUNDAMENTY]
SMA20: $${quantStats.sma20} | SMA50: $${quantStats.sma50}
P/E: ${quantStats.pe_ratio} | P/B: ${quantStats.pb_ratio}
EPS Growth 3Y: ${quantStats.eps_growth} | Revenue Growth 3Y: ${quantStats.revenue_growth}

[SUROWE DANE CENOWE - OSTATNIE 30 SWIEC (date,open,high,low,close,vol)]
${history.slice(-30).map(h => {
    const d = new Date(h.t).toISOString().split('T')[0];
    return `${d} O:${h.o?.toFixed(2)} H:${h.h?.toFixed(2)} L:${h.l?.toFixed(2)} C:${h.c?.toFixed(2)} V:${Math.round(h.v/1000)}K`;
}).join('\n')}

[KONTEKST 52-TYGODNIOWY]
52W High: $${quantStats.high52w} | 52W Low: $${quantStats.low52w}
Odleglosc od szczytu 52W: ${quantStats.dist_from_high52w} | Od dna 52W: ${quantStats.dist_from_low52w}

[ZWROTY MULTITIMEFRAME]
1T: ${quantStats.ret1w} | 1M: ${quantStats.ret1m} | 3M: ${quantStats.ret3m} | 6M: ${quantStats.ret6m} | 1R: ${quantStats.ret1y}

[SENTYMENT NEWSOW (AI Insights - Massive API)]
Artykuly z sentymentem: ${quantStats.sent_total} | Pozytywnych: ${quantStats.sent_bull_pct} | Negatywnych: ${quantStats.sent_bear_pct}

[SCORING WAZONY]
Bias techniczny: ${quantStats.signal_bias}
Zmiana w wybranym oknie ${timeframe}: ${periodReturn.toFixed(1)}%
Cena poczatkowa: $${history[0]?.c.toFixed(2)} => Obecna: $${lastC.toFixed(2)}
${userPositionStr}

SUGESTIA ALGORYTMU: ${dataRecommendation}
KRYTYCZNE: Trzymaj sie tej sugestii! Zmien na NEUTRAL TYLKO gdy RSI>70 i StochRSI>80 jednoczesnie, lub newsy sa skrajnie negatywne. Niskie ADX samo w sobie NIE jest powodem do NEUTRAL!

ZASADY DECYZYJNE:
- LONG: Golden Cross (EMA50>EMA200) + MACD>Signal + Cena>EMA200 + RSI<70 => dawaj LONG (ADX = sila, nie kierunek; niskie ADX nie blokuje LONG!)
- SHORT: Death Cross (EMA50<EMA200) + MACD<Signal + Cena<EMA200 => dawaj SHORT
- NEUTRAL: TYLKO gdy sygnaly sa sprzeczne LUB BB Squeeze (bandwidth<5%)
- Wyrazna przewaga sygnalow LONG + Golden Cross => ZAWSZE LONG chyba ze RSI>70 i StochRSI>80
- Wyrazna przewaga sygnalow SHORT + Death Cross => ZAWSZE SHORT chyba ze RSI<30
- ATR rosnacy = wieksze ryzyko, dostosuj SL do 2xATR; rozwaztarget = 3xATR

[WYNIKI KWARTALNE (Finnhub)]
${earningsCtx}

[NAJSWIEZSZE NEWSY - ostatnie 30 artykulow z sentymentem]
${recentNewsCtx}

[NEWSY PRZY NAJWIEKSZYCH WAHANIACH CENOWYCH (posortowane wg ruchu %)]
${newsContext.substring(0, 4500)}

INSTRUKCJE DOTYCZACE TRESCI (format jest wymuszony przez system — pisz tylko tresc):

bull_case: minimum 3 punkty. Kazdy punkt musi zawierac KONKRETNE wartosci wskaznikow, np. "EMA50=$258.92 > EMA200=$251.81 — Golden Cross aktywny", "MACD histogram dodatni: +1.56 — momentum rosnie".

bear_case: minimum 4 punkty. Kazdy z konkretnymi danymi. Nie generalizuj. Np. "ADX=15 — trend zbyt slaby by utrzymac wzrost", "Cena 6.9% ponizej 52W High ($286.19) — opor blisko".

summary: Napisz TRZY pelne akapity rozdzielone podwojna nowa linia (\n\n):
  Akapit 1 (TECHNICZNY): Aktualny stan na ${currentDate} — EMA cross, MACD, RSI, pozycja vs 52W High/Low, sila trendu ADX.
  Akapit 2 (KATALIZATORY I FUNDAMENTY): Wymien KONKRETNE nadchodzace wydarzenia ktore moga zmienic cene: najblizszy raport earnings (kiedy, czego sie spodziewac po ostatnim EPS surprise%), konferencje produktowe, zmiany regulacyjne, decyzje Fed, geopolityka — wszystko co jest widoczne w newsach i danych. Dodaj sentyment newsow (${quantStats.sent_bull_pct}% pozytywnych). Jesli nie ma bliskiego triggera — napisz to wprost i podaj co jest nastepnym kluczowym wydarzeniem w kalendarzu.
  Akapit 3 (REKOMENDACJA): Konkretne entry/SL/TP w dolarach, R:R, poziom przekonania, kluczowe ryzyko. ZAKAZ wymieniania slow "bullScore", "bearScore", "Bias Score" ani zadnych wewnetrznych zmiennych systemowych — pisz tylko o wskaznikach technicznych i danych rynkowych.

quant_analysis.recommendation: dokladnie "LONG", "SHORT" lub "NEUTRAL".
quant_analysis.probability_long + probability_short musi sumowac sie do DOKLADNIE 100%.
quant_analysis.entry_target: konkretna cena w dolarach lub "NIE WCHODZ" z uzasadnieniem.
quant_analysis.stop_loss: konkretna cena w dolarach (ATR-based, referencja: ${quantStats.atr_stop_loss}).

global_data.current_status: biezaca sytuacja rynkowa, pozycja wzgledem 52W High/Low i makro.
global_data.future_outlook: scenariusz bazowy na najblizszy miesiac, uwzgledniaj daty earnings.
global_data.elite_view: pozycje instytucjonalne, sygnaly smart money.
global_data.dividend_trend: trend dywidendy i kondycja finansowa spolki.
global_data.sex_appeal: sentyment medialny — ${quantStats.sent_bull_pct}% pozytywnych vs ${quantStats.sent_bear_pct}% negatywnych artykulow.
global_data.final_direction: TWARDY WERDYKT: kierunek + sila przekonania (wysoka/srednia/niska) + kluczowy katalizator + glowne ryzyko.

radar.scenarios: dwa scenariusze — Bear i Bull — z konkretnymi triggerami i targetami cenowymi.
sentiment_score: liczba 0-100 odzwierciedlajaca RZECZYWISTY sentyment na podstawie danych (nie domyslna wartosc 50).`;
        // --- GENERACJA AI (Structured Output — dane tylko z API) ---
        console.log(`[AI] ${symbol} ${timeframe} | bulls=${bullScore} bears=${bearScore} | news=${filteredNews.length}`);
        const aiStart = Date.now();

        const AI_MODELS = [
            process.env.GEMINI_MODEL || 'gemma-4-31b-it'
        ];
        const AI_TIMEOUT_MS = 80_000;
        const aiTimeoutPromise = () => new Promise((_, reject) =>
            setTimeout(() => reject(new Error('AI timeout (>80s)')), AI_TIMEOUT_MS)
        );
        let parsedAnalysis;
        for (let mi = 0; mi < AI_MODELS.length; mi++) {
            try {
                const model = genAI.getGenerativeModel({
                    model: AI_MODELS[mi],
                    generationConfig: { responseMimeType: "application/json", responseSchema: AI_RESPONSE_SCHEMA, temperature: 0.2 },
                });
                const result = await Promise.race([model.generateContent(promptFull), aiTimeoutPromise()]);
                parsedAnalysis = JSON.parse(result.response.text());
                if (mi > 0) console.log(`[AI] Fallback model used: ${AI_MODELS[mi]}`);
                break;
            } catch (aiErr) {
                console.warn(`[AI] ${AI_MODELS[mi]} failed: ${aiErr.message?.substring(0, 120)}`);
                if (mi === AI_MODELS.length - 1) throw new Error('AI nie zwrocilo odpowiedzi. Sprobuj ponownie.');
            }
        }

        // Anomalie generowane z newsow zebranych przez system (nie AI)
        parsedAnalysis.anomalies = [];
        const allNewsDates = [...new Set(filteredNews.map(n => new Date(n.datetime * 1000).toISOString().split('T')[0]))];
        for (const date of allNewsDates) {
            const dn = filteredNews.filter(n => new Date(n.datetime * 1000).toISOString().split('T')[0] === date);
            parsedAnalysis.anomalies.push({
                date,
                short_desc: `Informacje z rynku (${dn.length})`,
                details: `System przefiltrowal ${dn.length} powiazan wiadomosci z tego dnia:`,
                url: null,
                articles: dn.map(art => ({ headline: art.headline, url: art.url }))
            });
        }

        console.log(`[AI] Done in ${Date.now() - aiStart}ms | Total: ${Date.now() - reqStart}ms`);

        // Chart series computed on filtered timeframe history (single source of truth for frontend)
        const csMACD = calculateMACD(history);
        const csBB   = calculateBollingerBands(history);

        // Trend Alignment Matrix — obliczane raz na backendzie, frontend tylko renderuje
        const MATRIX_FRAMES = [
            { label: '1W', days: 7 }, { label: '1M', days: 30 },
            { label: '3M', days: 90 }, { label: '6M', days: 180 }, { label: '1Y', days: 365 },
        ];
        const trend_matrix = MATRIX_FRAMES.map(({ label, days }) => {
            const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
            const slice = allHistory.filter(h => new Date(h.t) >= cutoff);
            if (slice.length < 5) return { label, pct: null, emaSignal: 'N/A', macdSignal: 'N/A', rsiSignal: 'N/A' };
            const pct = ((slice[slice.length - 1].c - slice[0].c) / slice[0].c) * 100;
            const ema9s  = calculateEMASeries(slice, Math.min(9,  slice.length));
            const ema21s = calculateEMASeries(slice, Math.min(21, slice.length));
            const last9  = ema9s[ema9s.length - 1], last21 = ema21s[ema21s.length - 1];
            const emaSignal = (last9 && last21) ? (last9 > last21 ? 'BULL' : 'BEAR') : 'N/A';
            const { macdSeries, signalSeries } = calculateMACD(slice);
            const lm = macdSeries[macdSeries.length - 1], ls = signalSeries[signalSeries.length - 1];
            const macdSignal = (lm != null && ls != null) ? (lm > ls ? 'BULL' : 'BEAR') : 'N/A';
            const rsi = calculateRSI(slice.slice(-15));
            const rsiSignal = rsi > 70 ? 'OVERBOUGHT' : rsi < 30 ? 'OVERSOLD' : 'NEUTRAL';
            return { label, pct: +pct.toFixed(1), emaSignal, macdSignal, rsiSignal };
        });

        const chart_series = {
            ema9:   calculateEMASeries(history, 9),
            ema21:  calculateEMASeries(history, 21),
            ema50:  calculateEMASeries(history, 50),
            ema200: calculateEMASeries(history, 200),
            macd:        csMACD.macdSeries,
            macd_signal: csMACD.signalSeries,
            macd_hist:   csMACD.histSeries,
            bb_upper:  csBB.series.map(s => s.upper),
            bb_middle: csBB.series.map(s => s.middle),
            bb_lower:  csBB.series.map(s => s.lower),
            trend_matrix,
        };

        const responseData = {
            analysis: parsedAnalysis,
            history,
            earnings,
            quant_stats: quantStats,
            chart_series,
            ticker: symbol,
            timeframe,
            volatile_days: pctChanges.slice(0, 40).map(v => ({ date: v.date, pct: v.pct }))
        };

        analysisCache.set(cacheKey, { timestamp: Date.now(), data: responseData });
        res.json(responseData);

    } catch (e) {
        console.error(`[ERROR] ${e.message}`);
        res.status(500).json({ error: e.message || 'Wewnetrzny blad serwera.' });
    }
});

app.post('/api/analyze-day', async (req, res) => {
    const { ticker, date } = req.body;
    if (!ticker || !date) return res.status(400).end();

    const dayCacheKey = `DAY_${ticker}_${date}`;
    if (dayAnalysisCache.has(dayCacheKey)) {
        const cachedDay = dayAnalysisCache.get(dayCacheKey);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.flushHeaders();
        res.write(`data: ${JSON.stringify({ text: cachedDay.text, cached: true })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
    }

    const cachedBase = analysisCache.get(`${ticker.toUpperCase()}_BASE`);
    const dayNews = (cachedBase?.allNews || []).filter(n => {
        const d = new Date(n.datetime * 1000).toISOString().split('T')[0];
        return d === date;
    });

    const newsInfo = dayNews.length > 0
        ? dayNews.map(n => {
            const desc = n.description ? `\n  Opis: ${n.description.substring(0, 300)}` : '';
            const src = n.source ? ` (${n.source})` : '';
            return `- ${n.headline}${src}${desc}`;
        }).join('\n')
        : 'Brak specyficznego newsa rynkowego (możliwy ruch napędzany szerszym sektorem lub brakiem pokrycia w wybranym źródle).';

    const prompt = `Zadanie: Napisz w 3 zdaniach chłodną, obiektywną analizę dlaczego cena akcji ${ticker} zmieniła się mocno w dniu ${date}.
Dane informacyjne na ten dzień: ${newsInfo}

Wymóg krytyczny: Otrzymujesz surowe dane. Twoja odpowiedź powraca bezpośrednio do użytkownika. NIE używaj myślników, powitań, ani procesu myślowego. Od razu podajesz wnioski końcowe. 

Przykład prawidłowej odpowiedzi:
"Brak istotnych komunikatów ze spółki sugeruje, że wybuch wolumenu jest efektem rotacji kapitału w całym sektorze. Ruch ceny nie ma podłoża fundamentalnego, lecz wynika z korelacji z rynkiem bazowym. Stanowi to typowy szum systemowy, na który nie należy reagować w długim terminie."

Twoja odpowiedź dla ${ticker}:`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || 'gemma-4-31b-it',
            systemInstruction: "Jesteś polskojęzycznym asystentem giełdowym. Wypluwaj jedynie czysty, finałowy tekst. ZABRONIONE JEST PRZEPROWADZANIE PROCESU MYŚLOWEGO ORAZ UŻYWANIE JĘZYKA ANGIELSKIEGO.",
            generationConfig: { temperature: 0.1 }
        });

        const result = await model.generateContentStream(prompt);
        let fullText = '';
        for await (const chunk of result.stream) {
            const text = chunk.text() || '';
            if (text) {
                fullText += text;
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
        }
        dayAnalysisCache.set(dayCacheKey, { timestamp: Date.now(), text: fullText });
        res.write('data: [DONE]\n\n');
    } catch (err) {
        res.write(`data: ${JSON.stringify({ text: 'Błąd AI. Zaskórnik limitowy chmury (Gemma).', error: true })}\n\n`);
        res.write('data: [DONE]\n\n');
    }
    res.end();
});

// --- QUOTE (szybki kurs z cache lub Finnhub) ---
app.get('/api/quote/:symbol', async (req, res) => {
    const symbol = req.params.symbol.toUpperCase().replace(/[^A-Z0-9.]/g, '');
    if (!symbol) return res.status(400).json({ error: 'Bad symbol' });
    const cached = analysisCache.get(`${symbol}_BASE`);
    if (cached?.allHistory?.length) {
        const last = cached.allHistory[cached.allHistory.length - 1];
        const prev = cached.allHistory[cached.allHistory.length - 2];
        const changePct = prev ? ((last.c - prev.c) / prev.c * 100) : 0;
        return res.json({ symbol, price: last.c, changePct: +changePct.toFixed(2), date: new Date(last.t).toISOString().split('T')[0] });
    }
    try {
        const r = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`, { timeout: 4000 });
        if (!r.data.c) return res.status(404).json({ error: 'Symbol not found' });
        res.json({ symbol, price: r.data.c, changePct: +(r.data.dp || 0).toFixed(2) });
    } catch { res.status(404).json({ error: 'Symbol not found' }); }
});

// --- BACKTEST (Golden Cross strategy na 2Y OHLCV) ---
app.post('/api/backtest', (req, res) => {
    const { ticker, slPct = 7, tpPct = 20 } = req.body;
    const symbol = (ticker || '').toUpperCase().trim();
    if (!symbol) return res.status(400).json({ error: 'Missing ticker' });
    const cached = analysisCache.get(`${symbol}_BASE`);
    if (!cached?.allHistory?.length)
        return res.status(404).json({ error: 'Brak danych. Najpierw uruchom pełną analizę.' });

    const history = cached.allHistory;
    const ema50s  = calculateEMASeries(history, 50);
    const ema200s = calculateEMASeries(history, 200);

    const trades = [];
    let inTrade = false, entryIdx = -1, entryPrice = 0;

    for (let i = 201; i < history.length; i++) {
        if (!ema50s[i] || !ema200s[i] || !ema50s[i-1] || !ema200s[i-1]) continue;
        if (!inTrade) {
            if (ema50s[i-1] <= ema200s[i-1] && ema50s[i] > ema200s[i]) {
                inTrade = true; entryIdx = i; entryPrice = history[i].c;
            }
        } else {
            const curr = history[i].c;
            const pnl  = (curr - entryPrice) / entryPrice * 100;
            const dead = ema50s[i-1] >= ema200s[i-1] && ema50s[i] < ema200s[i];
            if (dead || pnl <= -slPct || pnl >= tpPct) {
                trades.push({
                    entry:      new Date(history[entryIdx].t).toISOString().split('T')[0],
                    exit:       new Date(history[i].t).toISOString().split('T')[0],
                    entryPrice: +entryPrice.toFixed(2),
                    exitPrice:  +curr.toFixed(2),
                    pnlPct:     +pnl.toFixed(1),
                    exitReason: pnl >= tpPct ? 'TP' : pnl <= -slPct ? 'SL' : 'DEATH CROSS',
                    durationDays: i - entryIdx,
                });
                inTrade = false;
            }
        }
    }

    if (!trades.length) return res.json({ symbol, trades: [], message: 'Brak Golden Cross w ostatnich 2 latach.' });

    const wins     = trades.filter(t => t.pnlPct > 0).length;
    const avgRet   = +(trades.reduce((s, t) => s + t.pnlPct, 0) / trades.length).toFixed(1);
    const totalRet = +trades.reduce((s, t) => s + t.pnlPct, 0).toFixed(1);
    const best     = +Math.max(...trades.map(t => t.pnlPct)).toFixed(1);
    const worst    = +Math.min(...trades.map(t => t.pnlPct)).toFixed(1);

    res.json({ symbol, trades, winRate: +(wins / trades.length * 100).toFixed(1), avgRet, totalRet, best, worst, totalTrades: trades.length, slPct, tpPct });
});

app.listen(PORT, () => console.log(`Specjalista do analizy ${PORT}`));