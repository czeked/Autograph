import 'dotenv/config';
import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import cors from 'cors';
import axios from 'axios';

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

function calculateRSI(history, periods = 14) {
    if (history.length < periods + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= periods; i++) {
        let diff = history[i].c - history[i - 1].c;
        if (diff >= 0) gains += diff; else losses -= diff;
    }
    let avgGain = gains / periods, avgLoss = losses / periods;
    for (let i = periods + 1; i < history.length; i++) {
        let diff = history[i].c - history[i - 1].c;
        let gain = diff >= 0 ? diff : 0;
        let loss = diff < 0 ? -diff : 0;
        avgGain = (avgGain * (periods - 1) + gain) / periods;
        avgLoss = (avgLoss * (periods - 1) + loss) / periods;
    }
    return avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
}

function getSMA(history, periods) {
    if (history.length < periods) return history[history.length - 1]?.c || 0;
    const slice = history.slice(-periods);
    return slice.reduce((sum, h) => sum + h.c, 0) / periods;
}

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
    if (!ticker) return res.status(400).json({ error: 'Brak symbolu.' });

    const symbol = ticker.toUpperCase();
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
        let allHistory = [], allNews = [], allEarnings = [];

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

            // Massive API news — pełne 365 dni z URL artykułów (Polygon-compatible)
            let allNewsArray = [];
            try {
                const d365 = new Date(); d365.setDate(d365.getDate() - 365);
                const from365 = d365.toISOString().split('T')[0];

                const rEarn = await axios.get(`https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&token=${FINNHUB_KEY}`).catch(() => ({ data: [] }));

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

            } catch (e) {
                console.error("News/Earnings batch error", e.message);
            }

            allHistory = yfHistory.map(item => ({
                t: new Date(item.date).getTime(), c: item.close, o: item.open, h: item.high, l: item.low, v: item.volume
            })).sort((a, b) => a.t - b.t);

            allNews = allNewsArray;

            analysisCache.set(`${symbol}_BASE`, { timestamp: Date.now(), allHistory, allNews, allEarnings });
        } else {
            allHistory = baseData.allHistory;
            allNews = baseData.allNews;
            allEarnings = baseData.allEarnings;
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
        const isDistribution = mom5 < 0 && volumeTrend === 'ROSNĄCY'; // Cena spada przy rosnącym wolumenie — klasyczna dystrybucja

        // Ocena wyrównania sygnałów — ile wskazuje na bear vs bull
        let bearSignals = 0, bullSignals = 0;
        if (rsi > 70) bearSignals++; // Przegrzanie
        if (rsi < 30) bullSignals++; // Wyprzedanie (okazja)
        if (rsi > 50) bullSignals++; // Momentum wzrostowe
        if (rsi < 50) bearSignals++; // Momentum spadkowe
        if (sma50Slope < -1.5) bearSignals++; else if (sma50Slope > 0.5) bullSignals++;
        if (mom5 < -1) bearSignals++; else if (mom5 > 1) bullSignals++;
        if (lastC < sma50) bearSignals++; else bullSignals++;
        if (lastC < sma20) bearSignals++; else bullSignals++;
        if (isDistribution) bearSignals += 2;
        const signalBias = bearSignals > bullSignals ? `NIEDŹWIEDZI (${bearSignals} sygnałów SHORT vs ${bullSignals} LONG)` : `BYCZY (${bullSignals} sygnałów LONG vs ${bearSignals} SHORT)`;

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
            if (absPct < 2.0) {
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


        const userPositionStr = (entryPrice || stopLoss)
            ? `\nPOZYCJA WŁASNA INWESTORA DO PRZEANALIZOWANIA:\nZadeklarowana cena wejścia: $${entryPrice || 'Brak'}\nZadeklarowany Stop Loss: $${stopLoss || 'Brak'}\nOceń obiektywnie: czy pozycja jest bezpieczna, czy narażona na ryzyko? Podaj konkretne liczby R:R.`
            : `\nINWESTOR NIE POSIADA POZYCJI. Oceń czy aktywo zasługuje na wejście TERAZ — jeśli Signal Bias jest byczy i trend silny, zaproponuj entry. Jeśli dane są mieszane lub niedźwiedzie — rekomenduj NEUTRAL lub czekaj.`;

        // Wyznacz sugerowaną rekomendację na podstawie twardych danych — AI ma to potwierdzić lub zakwestionować
        const periodReturn = (((lastC - (history[0]?.c || lastC)) / (history[0]?.c || lastC)) * 100);
        const bearCount = parseInt(quantStats.signal_bias.match(/(\d+) sygnałów SHORT/)?.[1] || '0');
        const bullCount = parseInt(quantStats.signal_bias.match(/(\d+) sygnałów LONG/)?.[1] || '0');
        const dataRecommendation = bullCount > bearCount ? 'LONG' : (bearCount > bullCount ? 'SHORT' : 'NEUTRAL');
        const currentDate = new Date().toISOString().split('T')[0]; // Pobierze "2026-04-13"
        // PROMPT 5.7 — Obiektywny Quant (zbalansowany)
        const prompt = `Jesteś obiektywnym, precyzyjnym analitykiem quant w funduszu multi-strategy. Analizujesz spółkę ${symbol} dla okresu ${timeframe}.
NIE masz domyślnego nastawienia — Twoja rekomendacja wynika WYŁĄCZNIE z twardych danych kwantowych i newsów.
NIE zmyślaj dat ani URL-ów. Używaj wyłącznie dostarczonych danych. DZISIEJSZA DATA: ${currentDate}.



DANE KWANTOWE (OBIEKTYWNE SYGNAŁY — interpretuj bez uprzedzeń):
RSI: ${quantStats.rsi}${quantStats.is_overbought ? ' ⚠️ Strefa wykupienia (>70) — potencjalne ryzyko odwrócenia' : quantStats.is_oversold ? ' 📉 Strefa wyprzedania (<30) — możliwe odbicie' : ' ✓ Neutralna strefa RSI'}
Momentum 5d: ${quantStats.momentum5d}%
Trend Długoterminowy (SMA50 + nachylenie): ${quantStats.trend}
Trend Krótkoterminowy (SMA20): ${quantStats.short_trend}
Nachylenie SMA50: ${quantStats.sma50_slope} (+ rosnący trend / - zakręt w dół)
Trend Wolumenu: ${quantStats.volume_trend}${quantStats.is_distribution ? ' 🚨 DYSTRYBUCJA: cena spada przy rosnącym wolumenie!' : ''}
Wyrównanie sygnałów: ${quantStats.signal_bias}
Zmiana kursu w okresie ${timeframe}: ${periodReturn.toFixed(1)}%
Pierwsza cena z okresu: $${history[0]?.c.toFixed(2)} → Obecna: $${lastC.toFixed(2)}
${userPositionStr}

SUGESTIA ALGORYTMU (na podstawie signal_bias — Ty możesz ją podtrzymać lub obalić argumentami z newsów):
Algorytm sugeruje: ${dataRecommendation}
Uzasadnienie: ${quantStats.signal_bias}

ZASADY DECYZYJNE (stosuj z głową, nie mechanicznie):
- Signal Bias byczy + silny trend + pozytywne momentum → LONG z konkretnym entry/TP/SL
- Signal Bias mieszany lub cena w konsolidacji → NEUTRAL, wskaż warunki do zmiany
- Signal Bias niedźwiedzi + ujemne momentum + dystrybucja → SHORT lub NEUTRAL
- RSI > 70 przy słabnącym SMA50 → sygnał ostrzegawczy nawet w silnym trendzie wzrostowym
- Cena spada + rosnący wolumen → zawsze traktuj priorytetowo jako sygnał negatywny

NEWSY I ZMIANY CENY PRZY NAJWIĘKSZYCH WAHANIACH W TYM OKRESIE:
${newsContext.substring(0, 8000)}

ZASADY FORMATOWANIA JSON:
1. bull_case i bear_case mają być PROPORCJONALNE do rzeczywistych danych — nie faworyzuj żadnej strony bez uzasadnienia.
2. Pierwszy akapit "summary" musi opisywać stan na dzień ${currentDate} oraz najważniejszy driver.
3. WARTOŚCI probability_long ORAZ probability_short MUSZĄ SUMOWAĆ SIĘ DOKŁADNIE DO 100%.
4. Rekomendacja LONG wymaga silnego wyrównania sygnałów bullish. Rekomendacja SHORT wymaga twardych dowodów presji sprzedażowej.
5. Zwróć CZYSTY OBIEKT JSON. Żadnych wstępów, tylko { }.

Format BEZWZGLĘDNY:
{
  "bull_case": ["co najmniej 3 twarde punkty pozytywne — TYLKO jeśli dane je potwierdzają"],
  "bear_case": ["minimum 5 punktów negatywnych, szczegółowych, z konkretnymi liczbami"],
  "summary": "3 Akapity (Akapit 1: Dominujący czynnik rynkowy i ocena trendu, Akapit 2: Kontekst makro i newsy, Akapit 3: Twarda ocena inwestycyjna z konkretną rekomendacją)",
  "quant_analysis": {
    "recommendation": "LONG / SHORT / NEUTRAL",
"probability_long": "XX% (Suma z short musi dawać 100%)",
    "probability_short": "XX% (Suma z long musi dawać 100%)",
    "entry_target": "$XXXX lub 'NIE WCHODŹ — czekaj na potwierdzenie trendu'",
    "stop_loss": "$XXXX (uwzględnij SL użytkownika jeśli podany)",
    "take_profit_analysis": "Analiza R:R z twardą oceną czy stosunek zysku do ryzyka jest akceptowalny",
    "micro_trend": "UPTREND / DOWNTREND / CONSOLIDATION",
    "macro_trend": "UPTREND / DOWNTREND / CONSOLIDATION"
  },
  "global_data": {
    "current_status": "Bieżąca sytuacja i wpływ makro",
    "future_outlook": "Przedstaw najbardziej prawdopodobny scenariusz bazowy na najbliższy miesiąc.",
    "elite_view": "Wypowiedzi elit, pozycje wielorybów, sygnały instytucjonalne",
    "dividend_trend": "Trend dywidendy: wzrostowy/spadkowy/brak — i co to mówi o kondycji spółki",
    "sex_appeal": "Sentyment medialny i publiczny — czy jest hype czy strach?",
    "final_direction": "TWARDY WERDYKT: kierunek + siła przekonania (wysoka/średnia/niska) + główne ryzyko"
  },
  "radar": {"patterns":["wzorzec1"],"scenarios":[{"name":"Bear","probability":"XX%","trigger":"...","target":"$XXX"},{"name":"Bull","probability":"XX%","trigger":"...","target":"$XXX"}],"key_dates":["data1"]},
  "sentiment_score": <liczba 0-100 odzwierciedlająca RZECZYWISTY sentyment danych, nie domyślna wartość>
}

Klucze JSON muszą być dokładnie takie jak podane! Język: POLSKI, Profesjonalny slang Quant. Zero błędów parsowania!`;

        let rawText = "";
        let parsedAnalysis = null;
        for (let i = 0; i < 3; i++) {
            try {
                const model = genAI.getGenerativeModel({
                    model: process.env.GEMINI_MODEL || 'gemma-4-31b-it',
                    generationConfig: {
                        responseMimeType: "application/json",
                        temperature: 0.2  // Zbalansowana temperatura — precyzja bez mechanicznego nastawienia
                    }
                });
                const result = await model.generateContent(prompt + "\n\nZAPAMIĘTAJ: ZWRÓĆ TYLKO JSON ROZPOCZYNAJĄCY SIĘ OD { I KOŃCZĄCY NA }, NIE PISZ NIC WIĘCEJ BO SPRAWISZ AWARIĘ.");
                rawText = result.response.text();

                let cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
                const match = cleanedText.match(/\{\s*"bull_case"[\s\S]*\}/);
                if (match) cleanedText = match[0];

                parsedAnalysis = JSON.parse(cleanedText);

                // Ręczne wygenerowanie tabeli anomalii na postawie newsów wyciągniętych przez system
                parsedAnalysis.anomalies = [];
                const allNewsDates = [...new Set(filteredNews.map(n => new Date(n.datetime * 1000).toISOString().split('T')[0]))];
                for (const date of allNewsDates) {
                    const dn = filteredNews.filter(n => new Date(n.datetime * 1000).toISOString().split('T')[0] === date);
                    parsedAnalysis.anomalies.push({
                        date: date,
                        short_desc: `Informacje z rynku (${dn.length})`,
                        details: `System błyskawicznie przefiltrował ${dn.length} ściśle powiązanych wiadomości z tego dnia:`,
                        url: null,
                        articles: dn.map(art => ({ headline: art.headline, url: art.url }))
                    });
                }

                break;
            } catch (err) {
                console.warn(`[Gemma Retry ${i + 1}/3]`, err.message);
                if (i === 2) throw new Error("Błąd podczas strukturyzowania odpowiedzi AI. Spróbuj ponownie.");
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        const responseData = {
            analysis: parsedAnalysis,
            history,
            earnings,
            quant_stats: quantStats,
            ticker: symbol,
            timeframe,
            volatile_days: pctChanges.slice(0, 40).map(v => ({ date: v.date, pct: v.pct }))
        };

        analysisCache.set(cacheKey, { timestamp: Date.now(), data: responseData });
        res.json(responseData);

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message || 'Wewnętrzny błąd serwera.' });
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

app.listen(PORT, () => console.log(`Specjalista do analizy ${PORT}`));