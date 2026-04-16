import { useState, useEffect, useRef } from 'react';
import './AiTrader.css';

function AiTrader() {
  const [searchTicker, setSearchTicker] = useState('BTC');
  const [currency, setCurrency] = useState('USD');
  const [prompt, setPrompt] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [marketData, setMarketData] = useState(null);
  const [ticker, setTicker] = useState('');
  const [chartData, setChartData] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [livePrice, setLivePrice] = useState(null);
  const [priceFlash, setPriceFlash] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [chartType, setChartType] = useState('candlestick');
  const wsRef = useRef(null);
  const prevPriceRef = useRef(null);

  // Binance WebSocket for live price
  useEffect(() => {
    if (!ticker) return;
    if (wsRef.current) wsRef.current.close();

    const symbol = ticker.toLowerCase() + 'usdt';
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@trade`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const trade = JSON.parse(event.data);
      const price = parseFloat(trade.p);
      setLivePrice(price);

      if (prevPriceRef.current !== null) {
        if (price > prevPriceRef.current) setPriceFlash('up');
        else if (price < prevPriceRef.current) setPriceFlash('down');
      }
      prevPriceRef.current = price;
      setTimeout(() => setPriceFlash(null), 800);
    };

    ws.onerror = () => console.log('WebSocket: Binance niedostępny');

    return () => { if (ws.readyState === WebSocket.OPEN) ws.close(); };
  }, [ticker]);

  // Alerts system
  useEffect(() => {
    if (!marketData) return;
    const newAlerts = [];
    if (marketData.rsi < 30) {
      newAlerts.push({ type: 'oversold', text: `⚠️ RSI ${marketData.rsi.toFixed(1)} — Wyprzedanie! Szansa na odbicie.`, color: '#3fb950' });
    }
    if (marketData.rsi > 70) {
      newAlerts.push({ type: 'overbought', text: `⚠️ RSI ${marketData.rsi.toFixed(1)} — Wykupienie! Ryzyko korekty.`, color: '#f85149' });
    }
    if (marketData.importantNews && marketData.importantNews.length > 0) {
      newAlerts.push({ type: 'news', text: `📰 ${marketData.importantNews.length} ważna wiadomość!`, color: '#58a6ff' });
    }
    if (marketData.macd?.signal === 'NIEDŹWIEDZI' && marketData.sar?.signal === 'NIEDŹWIEDZI') {
      newAlerts.push({ type: 'bearish', text: '🔴 MACD + SAR = podwójny sygnał niedźwiedzi', color: '#f85149' });
    }
    if (marketData.macd?.signal === 'BYCZY' && marketData.sar?.signal === 'BYCZY') {
      newAlerts.push({ type: 'bullish', text: '🟢 MACD + SAR = podwójny sygnał byczy', color: '#3fb950' });
    }
    setAlerts(newAlerts);
  }, [marketData]);

  const cryptoList = [
    'BTC', 'ETH', 'ADA', 'DOGE', 'SOL', 'XRP', 'BNB', 'LTC', 
    'BCH', 'LINK', 'AVAX', 'MATIC', 'UNI', 'SHIB', 'ATOM', 'NEAR',
    'POLKA', 'DOT', 'ICP', 'ARB', 'OP', 'PEPE', 'FLOKI', 'MEME',
    'WIF', 'BONK', 'JUP', 'SAGA', 'GMX', 'BLUR'
  ];

  const currencyList = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];

  useEffect(() => {
    if (marketData && ticker) {
      const interval = setInterval(() => {
        console.log('🔄 Auto-odświeżanie...');
        handleSearch(ticker);
      }, 5 * 60 * 1000);

      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketData, ticker]);

  const handleSearchChange = (value) => {
    const upperValue = value.toUpperCase();
    setSearchTicker(upperValue);
    
    if (upperValue.length > 0) {
      const filtered = cryptoList.filter(crypto => 
        crypto.startsWith(upperValue)
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectCrypto = (crypto) => {
    setSearchTicker(crypto);
    setSuggestions([]);
    setShowSuggestions(false);
    handleSearch(crypto);
  };

  const handleSearch = async (searchValue) => {
    const value = searchValue || searchTicker;
    
    if (value.length === 0) return;
    
    setLoading(true);
    setError('');
    setAnalysis('');
    setMarketData(null);
    setChartData([]);

    try {
      const res = await fetch('http://localhost:3000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ticker: value.toUpperCase(), 
          currency: currency,
          prompt: prompt || `Analiza ${value.toUpperCase()}/${currency} na dzień ${new Date().toLocaleDateString('pl-PL')}`
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const mappedMarketData = { ...data.marketData };
        if (mappedMarketData.news && Array.isArray(mappedMarketData.news)) {
          const newsByDayObj = {};
          mappedMarketData.news.forEach(n => {
             const parts = n.published.split(/[, ]+/);
             const dateStr = parts[0]; 
             const timeStr = parts.slice(1).join(' ') || n.published;

             if (!newsByDayObj[dateStr]) {
                 newsByDayObj[dateStr] = { articles: [], lastUpdated: n.published };
             }
             newsByDayObj[dateStr].articles.push({
                 id: n.url || Math.random().toString(),
                 importance: n.importance,
                 isNew: false,
                 importanceLevel: n.importanceLevel,
                 sentiment: n.sentiment,
                 source: n.source,
                 title: n.title,
                 image: null,
                 body: n.body,
                 publishedString: timeStr,
                 url: n.url,
                 isImportant: n.isImportant
             });
          });
          
          mappedMarketData.newsData = {
             newsByDay: newsByDayObj,
             lastRefresh: new Date().toLocaleTimeString(),
             newArticlesCount: 0
          };
        }

        setAnalysis(data.analysis);
        setMarketData(mappedMarketData);
        setTicker(data.ticker);
        setChartData(data.chartData || []);
      } else {
        setError(`❌ ${data.error}`);
      }
    } catch (err) {
      setError(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      setShowSuggestions(false);
      handleSearch(searchTicker);
    }
  };

  const handleCurrencyChange = (newCurrency) => {
    setCurrency(newCurrency);
    if (marketData && ticker) {
      setTimeout(() => handleSearch(ticker), 100);
    }
  };

  const formatMarketCap = (cap) => {
    if (!cap) return 'N/A';
    if (cap > 1000000000) return `$${(cap / 1000000000).toFixed(2)}B`;
    if (cap > 1000000) return `$${(cap / 1000000).toFixed(2)}M`;
    return `$${cap.toFixed(2)}`;
  };

  const formatPrice = (price) => {
    if (!price) return '0.00';
    if (price > 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price > 1) return price.toFixed(4);
    return price.toFixed(6);
  };

  return (
    <div className="analyzer-container">
      <div className="analyzer-header">
        <h1>📈 Asystent Handlowy AI</h1>
        <p className="header-subtitle">CoinGecko DANE NA ŻYWO • Analiza Gemma 4 AI • Wiadomości Finnhub</p>
        <span className="date-badge">📅 {new Date().toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>

      {/* Search Section */}
      <div className="search-section">
        <div className="search-row">
          <div className="search-field">
            <label>🔍 Kryptowaluta</label>
            <div className="search-wrapper">
              <input
                type="text"
                value={searchTicker}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={() => searchTicker.length > 0 && setShowSuggestions(true)}
                placeholder="BTC, ETH, SOL..."
                className="search-input"
              />
              <button
                onClick={() => {
                  setShowSuggestions(false);
                  handleSearch(searchTicker);
                }}
                disabled={loading || searchTicker.length === 0}
                className={`search-button ${loading ? 'loading' : ''}`}
              >
                {loading ? '⏳ Analizuję...' : '🚀 Analizuj'}
              </button>

              {showSuggestions && suggestions.length > 0 && (
                <div className="suggestions-dropdown">
                  {suggestions.map(crypto => (
                    <div
                      key={crypto}
                      className="suggestion-item"
                      onClick={() => selectCrypto(crypto)}
                    >
                      {crypto}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="currency-field">
            <label>💵 Waluta</label>
            <div className="currency-buttons">
              {currencyList.map(curr => (
                <button
                  key={curr}
                  onClick={() => handleCurrencyChange(curr)}
                  className={`currency-btn ${currency === curr ? 'active' : ''}`}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Opcjonalnie: Dodaj pytanie lub notatkę do analizy..."
          rows={2}
          className="input-textarea"
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Pobieranie danych z CoinGecko i Finnhub...</p>
          <p className="loading-sub">Analiza Gemma 4 AI w toku</p>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="alerts-bar">
          {alerts.map((a, i) => (
            <div key={i} className="alert-item" style={{ borderLeftColor: a.color }}>
              {a.text}
            </div>
          ))}
        </div>
      )}

      {/* Market Data Dashboard */}
      {marketData && (
        <div className="dashboard">
          <div className="dashboard-header">
            <h2>
              <span className="ticker-label">{ticker}</span>
              <span className="pair-separator">/</span>
              <span className="currency-label">{currency}</span>
              <span className="live-dot"></span>
              <span className="live-text">NA ŻYWO</span>
            </h2>
            <div className="header-right">
              {livePrice && (
                <span className={`live-price ${priceFlash === 'up' ? 'flash-green' : priceFlash === 'down' ? 'flash-red' : ''}`}>
                  Binance: {formatPrice(livePrice)} USDT
                </span>
              )}
              <span className="last-update">Aktualizacja: {marketData.lastUpdate ? new Date(marketData.lastUpdate).toLocaleString('pl-PL') : '-'}</span>
            </div>
          </div>

          {/* Price Cards */}
          <div className="price-cards">
            <div className="price-card main-price">
              <span className="card-label">Cena</span>
              <span className="card-value">{formatPrice(marketData.price)} {currency}</span>
              <span className={`card-change ${marketData.changePercent > 0 ? 'positive' : 'negative'}`}>
                {marketData.changePercent > 0 ? '▲' : '▼'} {marketData.changePercent?.toFixed(2)}%
              </span>
            </div>
            <div className="price-card">
              <span className="card-label">Kapitalizacja</span>
              <span className="card-value">{formatMarketCap(marketData.marketCap)}</span>
            </div>
            <div className="price-card">
              <span className="card-label">Wolumen 24h</span>
              <span className="card-value">${(marketData.volume / 1000000).toFixed(1)}M</span>
            </div>
            <div className="price-card">
              <span className="card-label">Śr. Wolumen</span>
              <span className="card-value">${(marketData.avgVolume / 1000000).toFixed(1)}M</span>
            </div>
          </div>

          {/* Pivot Points */}
          <div className="sr-row">
            <div className="sr-card resistance">
              <span className="sr-icon">🔴</span>
              <span className="sr-label">Opór R1</span>
              <span className="sr-value">{formatPrice(marketData.resistance1)} {currency}</span>
            </div>
            <div className="sr-card pivot">
              <span className="sr-icon">⚪</span>
              <span className="sr-label">Pivot Point</span>
              <span className="sr-value">{formatPrice(marketData.pivotPoint)} {currency}</span>
            </div>
            <div className="sr-card support">
              <span className="sr-icon">🟢</span>
              <span className="sr-label">Wsparcie S1</span>
              <span className="sr-value">{formatPrice(marketData.support1)} {currency}</span>
            </div>
          </div>

          {/* Technical Indicators */}
          <div className="indicators-row">
            <div className={`indicator ${marketData.rsi > 70 ? 'overbought' : marketData.rsi < 30 ? 'oversold' : 'neutral-ind'}`}>
              <span className="ind-name">RSI (14)</span>
              <span className="ind-value">{marketData.rsi?.toFixed(1)}</span>
              <span className="ind-signal">{marketData.rsi > 70 ? 'Wykupiony' : marketData.rsi < 30 ? 'Wyprzedany' : 'Neutralny'}</span>
            </div>
            <div className={`indicator ${marketData.macd?.signal === 'BYCZY' ? 'bullish' : 'bearish'}`}>
              <span className="ind-name">MACD</span>
              <span className="ind-value">{marketData.macd?.signal}</span>
              <span className="ind-signal">Histogram: {marketData.macd?.histogram}</span>
            </div>
            <div className={`indicator ${marketData.sar?.signal === 'BYCZY' ? 'bullish' : 'bearish'}`}>
              <span className="ind-name">Parabolic SAR</span>
              <span className="ind-value">{marketData.sar?.trend}</span>
              <span className="ind-signal">{formatPrice(parseFloat(marketData.sar?.sar))}</span>
            </div>
            <div className="indicator neutral-ind">
              <span className="ind-name">EMA 12 / 26</span>
              <span className="ind-value">{formatPrice(marketData.ema12)}</span>
              <span className="ind-signal">{formatPrice(marketData.ema26)}</span>
            </div>
            <div className="indicator neutral-ind">
              <span className="ind-name">SMA 20 / 50</span>
              <span className="ind-value">{formatPrice(marketData.sma20)}</span>
              <span className="ind-signal">{formatPrice(marketData.sma50)}</span>
            </div>
          </div>

          {/* Bollinger + ATR + ADX row */}
          <div className="indicators-row secondary-indicators">
            <div className={`indicator ${marketData.price > marketData.bb?.upper ? 'overbought' : marketData.price < marketData.bb?.lower ? 'oversold' : 'neutral-ind'}`}>
              <span className="ind-name">Bollinger Bands</span>
              <span className="ind-value">{formatPrice(marketData.bb?.middle)}</span>
              <span className="ind-signal">
                {formatPrice(marketData.bb?.lower)} — {formatPrice(marketData.bb?.upper)}
              </span>
            </div>
            <div className={`indicator ${marketData.adx?.adx > 25 ? (marketData.adx?.plusDI > marketData.adx?.minusDI ? 'bullish' : 'bearish') : 'neutral-ind'}`}>
              <span className="ind-name">ADX (Siła trendu)</span>
              <span className="ind-value">{marketData.adx?.adx}</span>
              <span className="ind-signal">{marketData.adx?.trend}</span>
            </div>
            <div className={`indicator ${marketData.stochRsi?.signal === 'WYPRZEDANY' ? 'oversold' : marketData.stochRsi?.signal === 'WYKUPIONY' ? 'overbought' : marketData.stochRsi?.signal === 'BYCZY' ? 'bullish' : marketData.stochRsi?.signal === 'NIEDŹWIEDZI' ? 'bearish' : 'neutral-ind'}`}>
              <span className="ind-name">Stochastic RSI</span>
              <span className="ind-value">K: {marketData.stochRsi?.k} / D: {marketData.stochRsi?.d}</span>
              <span className="ind-signal">{marketData.stochRsi?.signal}</span>
            </div>
          </div>

          {/* OBV + Divergence + Fear&Greed row */}
          <div className="indicators-row secondary-indicators">
            <div className={`indicator ${marketData.obv?.divergence ? (marketData.obv?.divergenceType === 'BYCZA' ? 'bullish' : 'bearish') : 'neutral-ind'}`}>
              <span className="ind-name">OBV (Volume)</span>
              <span className="ind-value">{marketData.obv?.trend}</span>
              <span className="ind-signal">Dywergencja: {marketData.obv?.divergenceType || 'BRAK'}</span>
            </div>
            <div className={`indicator ${marketData.rsiDivergence?.detected ? (marketData.rsiDivergence?.type?.includes('BYCZA') ? 'bullish' : 'bearish') : 'neutral-ind'}`}>
              <span className="ind-name">RSI Divergence</span>
              <span className="ind-value">{marketData.rsiDivergence?.detected ? '⚠️ WYKRYTA' : '✅ Brak'}</span>
              <span className="ind-signal">{marketData.rsiDivergence?.detected ? marketData.rsiDivergence?.type : 'Brak rozbieżności'}</span>
            </div>
            <div className={`indicator ${marketData.fearGreed?.value < 25 ? 'oversold' : marketData.fearGreed?.value > 75 ? 'overbought' : 'neutral-ind'}`}>
              <span className="ind-name">Fear & Greed</span>
              <span className="ind-value">{marketData.fearGreed?.value}/100</span>
              <span className="ind-signal">{marketData.fearGreed?.classification}</span>
            </div>
          </div>

          {/* Composite Score Card */}
          {marketData.composite && (
            <div className={`composite-score-card ${marketData.composite.score > 10 ? 'score-bullish' : marketData.composite.score < -10 ? 'score-bearish' : 'score-neutral'}`}>
              <div className="composite-header">
                <span className="composite-label">🤖 COMPOSITE SCORE</span>
                <span className={`composite-decision ${marketData.composite.decision.includes('KUPUJ') ? 'decision-buy' : marketData.composite.decision.includes('SPRZEDAJ') ? 'decision-sell' : 'decision-hold'}`}>
                  {marketData.composite.decision}
                </span>
              </div>
              <div className="composite-body">
                <div className="score-meter">
                  <div className="score-bar">
                    <div className="score-fill" style={{ width: `${Math.abs(marketData.composite.score)}%`, background: marketData.composite.score > 0 ? '#3fb950' : '#f85149' }}></div>
                  </div>
                  <span className="score-value">{marketData.composite.score > 0 ? '+' : ''}{marketData.composite.score}</span>
                </div>
                <div className="composite-metrics">
                  <span>Pewność: <strong>{marketData.composite.confidence}%</strong></span>
                  <span>Ryzyko: <strong className={`risk-${marketData.composite.risk}`}>{marketData.composite.risk}</strong></span>
                  <span>Sygnały: <strong style={{ color: '#3fb950' }}>{marketData.composite.signals?.bullish}🟢</strong> <strong style={{ color: '#f85149' }}>{marketData.composite.signals?.bearish}🔴</strong></span>
                </div>
                {marketData.composite.details?.length > 0 && (
                  <div className="composite-details">
                    {marketData.composite.details.map((d, i) => (
                      <span key={i} className="detail-tag">{d}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Candle Patterns */}
          {marketData.patterns && marketData.patterns.length > 0 && (
            <div className="patterns-section">
              <h3>🕯️ Formacje świecowe</h3>
              <div className="patterns-list">
                {marketData.patterns.map((pattern, idx) => (
                  <span key={idx} className="pattern-tag">{pattern}</span>
                ))}
              </div>
            </div>
          )}

          {/* Chart with type switcher */}
          {chartData.length > 0 && (
            <div className="chart-section">
              <div className="chart-title-row">
                <h3>📊 Wykres — ostatnie {chartData.length} dni</h3>
                <div className="chart-controls">
                  <div className="chart-type-switcher">
                    {[
                      { type: 'candlestick', label: '🕯️ Świecowy' },
                      { type: 'line', label: '📈 Liniowy' },
                      { type: 'bar', label: '📊 Słupkowy' }
                    ].map(ct => (
                      <button
                        key={ct.type}
                        className={`chart-type-btn ${chartType === ct.type ? 'active' : ''}`}
                        onClick={() => setChartType(ct.type)}
                      >
                        {ct.label}
                      </button>
                    ))}
                  </div>
                  <div className="chart-legend">
                    <span className="legend-item green">▮ Wzrost</span>
                    <span className="legend-item red">▮ Spadek</span>
                  </div>
                </div>
              </div>
              <ChartComponent data={chartData} currency={currency} chartType={chartType} />
            </div>
          )}
        </div>
      )}

      {/* News Section */}
      {marketData && marketData.newsData && (
        <NewsSlider newsData={marketData.newsData} ticker={ticker} />
      )}

      {/* AI Analysis */}
      {analysis && <AnalysisDisplay analysis={analysis} ticker={ticker} currency={currency} />}

      <footer className="app-footer">
        <p>⚡ CoinGecko API • RSI, MACD, SAR, EMA • Gemma 4 AI • Wiadomości Finnhub</p>
        <p>📅 {new Date().toLocaleDateString('pl-PL')}</p>
      </footer>
    </div>
  );
}

/* ======================== ANALYSIS DISPLAY ======================== */

function AnalysisDisplay({ analysis, ticker, currency }) {
  const clean = (t) => t
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*(.*?)\*/g, '$1')
    .trim();

  const isJunk = (t) => /^(\*?\s*)?(use emoji|keep it|self-correct|i will|i'll|okay|sure|got it|understood|alright|polish only|no markdown|ensure|let me|let's go|wait,|double check|final check|final polish|language:|formatting:|style:|structure:|input data:|drafting|construction)/i.test(t);
  const isHeader = (t) => /^[1-9]️⃣|^🔟|^\*\*\s*\d+[.)]|^#{1,3}\s+\d|^\d+[.)]\s+[A-ZĄĆĘŁŃÓŚŹŻ]{2,}/i.test(t);
  const getSignal = (t) => {
    if (/KUPUJ|BUY|LONG/i.test(t)) return 'buy';
    if (/SPRZEDAJ|SELL|SHORT/i.test(t)) return 'sell';
    if (/TRZYMAJ|HOLD|NEUTRAL/i.test(t)) return 'hold';
    return null;
  };

  const sections = [];
  let cur = null;

  for (const raw of analysis.split('\n')) {
    const t = raw.trim();
    if (!t || /^[═─-]{4,}$/.test(t)) continue;
    const c = clean(t);
    if (!c || isJunk(c)) continue;

    if (isHeader(t)) {
      if (cur) sections.push(cur);
      cur = { title: c, lines: [], signal: null };
    } else if (cur) {
      cur.lines.push(c);
      if (getSignal(c)) cur.signal = getSignal(c);
    } else {
      if (sections.length && sections[sections.length - 1].type === 'intro') {
        sections[sections.length - 1].lines.push(c);
      } else {
        sections.push({ title: null, lines: [c], signal: getSignal(c), type: 'intro' });
      }
    }
  }
  if (cur) sections.push(cur);

  const overallSignal = getSignal(analysis);

  // Parse trading decision metrics from text
  const trendMatch = analysis.match(/[Ss]i[łl]a\s*trendu[:\s]*(\d+)\s*\/\s*10/i);
  const confMatch = analysis.match(/[Pp]ewno[śs][ćc][:\s]*(\d+)\s*%/i);
  const riskMatch = analysis.match(/[Rr]yzyko[:\s]*(niskie|średnie|wysokie|low|medium|high)/i);
  const trendScore = trendMatch ? parseInt(trendMatch[1]) : null;
  const confidence = confMatch ? parseInt(confMatch[1]) : null;
  const riskRaw = riskMatch ? riskMatch[1].toLowerCase() : null;
  const risk = riskRaw === 'niskie' || riskRaw === 'low' ? 'niskie' :
               riskRaw === 'wysokie' || riskRaw === 'high' ? 'wysokie' : 'średnie';

  return (
    <div className="analysis-section">
      <div className="analysis-hero">
        <div className="analysis-hero-bg"></div>
        <div className="analysis-hero-content">
          <div className="analysis-title-row">
            <h2>🤖 Analiza Gemma 4 AI</h2>
            <div className="analysis-badges">
              <span className="model-badge">Gemma 4</span>
              <span className="data-badge">📊 CoinGecko</span>
              {ticker && <span className="ticker-badge">{ticker}/{currency}</span>}
            </div>
          </div>

          {/* Trading Decision Card */}
          {overallSignal && (
            <div className={`trading-decision decision-${overallSignal}`}>
              <div className="decision-signal">
                <span className="decision-icon">
                  {overallSignal === 'buy' ? '🟢' : overallSignal === 'sell' ? '🔴' : '🟡'}
                </span>
                <span className="decision-label">
                  {overallSignal === 'buy' ? 'KUPUJ' :
                   overallSignal === 'sell' ? 'SPRZEDAJ' : 'TRZYMAJ'}
                </span>
              </div>
              <div className="decision-metrics">
                {trendScore !== null && (
                  <div className="metric">
                    <span className="metric-label">Siła trendu</span>
                    <div className="metric-bar">
                      <div className="metric-fill" style={{ width: `${trendScore * 10}%`, background: trendScore >= 7 ? '#3fb950' : trendScore >= 4 ? '#d29922' : '#f85149' }}></div>
                    </div>
                    <span className="metric-value">{trendScore}/10</span>
                  </div>
                )}
                {confidence !== null && (
                  <div className="metric">
                    <span className="metric-label">Pewność</span>
                    <div className="metric-bar">
                      <div className="metric-fill" style={{ width: `${confidence}%`, background: confidence >= 70 ? '#3fb950' : confidence >= 40 ? '#d29922' : '#f85149' }}></div>
                    </div>
                    <span className="metric-value">{confidence}%</span>
                  </div>
                )}
                {riskRaw && (
                  <div className="metric">
                    <span className="metric-label">Ryzyko</span>
                    <span className={`risk-badge risk-${risk}`}>
                      {risk === 'niskie' ? '🟢 Niskie' : risk === 'wysokie' ? '🔴 Wysokie' : '🟡 Średnie'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="analysis-body">
        {sections.map((section, idx) => (
          <div key={idx} className={`analysis-block ${section.type === 'intro' ? 'intro-block' : ''} ${section.signal ? `block-${section.signal}` : ''}`}>
            {section.title && (
              <div className="block-header">
                <span className="block-title">{section.title}</span>
              </div>
            )}
            <div className="block-content">
              {section.lines.map((l, li) => {
                const sig = getSignal(l);
                return (
                  <p key={li} className={
                    sig ? `sig-line sig-${sig}` :
                    /^[-•●▸▹]/.test(l) ? 'a-bullet' : 'a-line'
                  }>{l}</p>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="analysis-footer-info">
        <span>📊 CoinGecko (Binance, Coinbase, Kraken...)</span>
        <span>📰 Finnhub</span>
        <span>🕐 {new Date().toLocaleTimeString('pl-PL')}</span>
      </div>
    </div>
  );
}

/* ======================== CANDLESTICK CHART ======================== */

function ChartComponent({ data, currency, chartType = 'candlestick' }) {
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [crosshair, setCrosshair] = useState(null);
  const [containerWidth, setContainerWidth] = useState(900);

  useEffect(() => {
    const observe = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    observe();
    window.addEventListener('resize', observe);
    return () => window.removeEventListener('resize', observe);
  }, []);

  if (!data || data.length === 0) return null;

  const n = data.length;
  const paddingLeft = 80;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 55;
  const priceAreaH = 320;
  const volumeAreaH = 80;
  const totalH = priceAreaH + volumeAreaH + paddingTop + paddingBottom + 20;

  // Ensure minimum candle width of 10px; if too many candles, widen the SVG
  const minCandleW = 10;
  const minSpacing = minCandleW / 0.6;
  const neededW = paddingLeft + paddingRight + n * minSpacing;
  const chartW = Math.max(containerWidth, neededW);

  const usableW = chartW - paddingLeft - paddingRight;
  const candleSpacing = usableW / n;
  const candleW = Math.max(Math.min(candleSpacing * 0.6, 20), 6);

  const prices = data.flatMap(d => [d.high, d.low]);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const pricePad = (maxPrice - minPrice) * 0.08 || 1;
  const pMax = maxPrice + pricePad;
  const pMin = minPrice - pricePad;
  const pRange = pMax - pMin;

  const volumes = data.map(d => d.volume || 0);
  const maxVol = Math.max(...volumes) || 1;

  const getX = (i) => paddingLeft + i * candleSpacing + candleSpacing / 2;
  const getY = (price) => paddingTop + (1 - (price - pMin) / pRange) * priceAreaH;
  const volBase = paddingTop + priceAreaH + 20 + volumeAreaH;

  // Price grid
  const gridLines = [];
  for (let i = 0; i <= 5; i++) {
    const price = pMin + (pRange * i) / 5;
    gridLines.push({ y: getY(price), price });
  }

  // SMA20
  const smaPoints = [];
  for (let i = 0; i < n; i++) {
    if (i >= 19) {
      const slice = data.slice(i - 19, i + 1);
      const avg = slice.reduce((s, d) => s + d.close, 0) / 20;
      smaPoints.push({ x: getX(i), y: getY(avg) });
    }
  }
  const smaPath = smaPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Smart date label stepping
  const labelMinPx = 70;
  const labelStep = Math.max(1, Math.ceil(labelMinPx / candleSpacing));

  const handleMouseMove = (e, candle, i) => {
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const mx = e.clientX - rect.left + scrollLeft;
    const my = e.clientY - rect.top;
    setTooltip({ x: mx, y: my, candle, i });
    setCrosshair({ x: getX(i), y: my });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
    setCrosshair(null);
  };

  const formatP = (p) => {
    if (p > 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (p > 1) return p.toFixed(2);
    return p.toFixed(6);
  };

  return (
    <div className="chart-wrapper" ref={containerRef}>
      <svg
        width={chartW}
        height={totalH}
        className="chart-svg"
      >
        <rect width={chartW} height={totalH} fill="#0d1117" rx="12" />

        {/* Grid */}
        {gridLines.map((gl, i) => (
          <g key={`gl-${i}`}>
            <line x1={paddingLeft} y1={gl.y} x2={chartW - paddingRight} y2={gl.y}
              stroke="#161b22" strokeWidth="1" />
            <text x={paddingLeft - 8} y={gl.y + 4} fill="#8b949e" fontSize="11"
              textAnchor="end" fontFamily="monospace">
              {formatP(gl.price)}
            </text>
          </g>
        ))}

        {/* Volume separator line */}
        <line x1={paddingLeft} y1={paddingTop + priceAreaH + 10}
          x2={chartW - paddingRight} y2={paddingTop + priceAreaH + 10}
          stroke="#21262d" strokeWidth="1" strokeDasharray="4,4" />

        {/* Volume bars */}
        {data.map((candle, i) => {
          const x = getX(i);
          const isGreen = candle.close >= candle.open;
          const vol = candle.volume || 0;
          const barH = (vol / maxVol) * volumeAreaH;
          return (
            <rect key={`vol-${i}`} x={x - candleW / 2} y={volBase - barH}
              width={candleW} height={Math.max(barH, 1)}
              fill={isGreen ? 'rgba(35, 134, 54, 0.5)' : 'rgba(218, 54, 51, 0.5)'}
              rx="1" />
          );
        })}

        {/* SMA20 */}
        {smaPoints.length > 1 && (
          <path d={smaPath} fill="none" stroke="#f0883e" strokeWidth="1.5" opacity="0.7" />
        )}

        {/* === CANDLESTICK === */}
        {chartType === 'candlestick' && data.map((candle, i) => {
          const x = getX(i);
          const yOpen = getY(candle.open);
          const yClose = getY(candle.close);
          const yHigh = getY(candle.high);
          const yLow = getY(candle.low);
          const isGreen = candle.close >= candle.open;
          const bodyTop = Math.min(yOpen, yClose);
          const bodyH = Math.max(Math.abs(yOpen - yClose), 1.5);

          return (
            <g key={`c-${i}`} className="candle-group">
              <line x1={x} y1={yHigh} x2={x} y2={yLow}
                stroke={isGreen ? '#238636' : '#da3633'}
                strokeWidth={Math.max(candleW * 0.12, 1)} />
              <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH}
                fill={isGreen ? '#238636' : '#da3633'}
                stroke={isGreen ? '#2ea043' : '#f85149'}
                strokeWidth="0.5" rx="1" />
              <rect x={x - candleSpacing / 2} y={paddingTop}
                width={candleSpacing} height={priceAreaH + volumeAreaH + 20}
                fill="transparent"
                onMouseMove={(e) => handleMouseMove(e, candle, i)}
                onMouseLeave={handleMouseLeave} />
            </g>
          );
        })}

        {/* === LINE CHART === */}
        {chartType === 'line' && (() => {
          const linePath = data.map((candle, i) => {
            const x = getX(i);
            const y = getY(candle.close);
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
          }).join(' ');
          const areaPath = linePath + ` L ${getX(n - 1)} ${paddingTop + priceAreaH} L ${getX(0)} ${paddingTop + priceAreaH} Z`;
          return (
            <g>
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#58a6ff" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#58a6ff" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#lineGrad)" />
              <path d={linePath} fill="none" stroke="#58a6ff" strokeWidth="2.5" strokeLinejoin="round" />
              {data.map((candle, i) => (
                <g key={`lp-${i}`}>
                  <circle cx={getX(i)} cy={getY(candle.close)} r="3.5"
                    fill="#0d1117" stroke="#58a6ff" strokeWidth="1.5" />
                  <rect x={getX(i) - candleSpacing / 2} y={paddingTop}
                    width={candleSpacing} height={priceAreaH + volumeAreaH + 20}
                    fill="transparent"
                    onMouseMove={(e) => handleMouseMove(e, candle, i)}
                    onMouseLeave={handleMouseLeave} />
                </g>
              ))}
            </g>
          );
        })()}

        {/* === BAR (OHLC) CHART === */}
        {chartType === 'bar' && data.map((candle, i) => {
          const x = getX(i);
          const yOpen = getY(candle.open);
          const yClose = getY(candle.close);
          const yHigh = getY(candle.high);
          const yLow = getY(candle.low);
          const isGreen = candle.close >= candle.open;
          const color = isGreen ? '#238636' : '#da3633';
          const tickW = Math.max(candleW * 0.5, 4);

          return (
            <g key={`bar-${i}`}>
              <line x1={x} y1={yHigh} x2={x} y2={yLow}
                stroke={color} strokeWidth={Math.max(candleW * 0.15, 1.5)} />
              <line x1={x - tickW} y1={yOpen} x2={x} y2={yOpen}
                stroke={color} strokeWidth="2" />
              <line x1={x} y1={yClose} x2={x + tickW} y2={yClose}
                stroke={color} strokeWidth="2" />
              <rect x={x - candleSpacing / 2} y={paddingTop}
                width={candleSpacing} height={priceAreaH + volumeAreaH + 20}
                fill="transparent"
                onMouseMove={(e) => handleMouseMove(e, candle, i)}
                onMouseLeave={handleMouseLeave} />
            </g>
          );
        })}

        {/* Crosshair */}
        {crosshair && (
          <g>
            <line x1={crosshair.x} y1={paddingTop} x2={crosshair.x} y2={paddingTop + priceAreaH}
              stroke="#58a6ff" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.6" />
            <line x1={paddingLeft} y1={crosshair.y} x2={chartW - paddingRight} y2={crosshair.y}
              stroke="#58a6ff" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.6" />
          </g>
        )}

        {/* Date labels */}
        {data.map((candle, i) => {
          if (i % labelStep !== 0 && i !== n - 1) return null;
          return (
            <text key={`dt-${i}`} x={getX(i)} y={totalH - 10}
              fill="#8b949e" fontSize="10" textAnchor="middle" fontFamily="monospace">
              {candle.date}
            </text>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${paddingLeft + 10}, ${paddingTop - 15})`}>
          <rect width="8" height="8" fill="#238636" rx="1" />
          <text x="12" y="8" fill="#8b949e" fontSize="10">Wzrost</text>
          <rect x="60" width="8" height="8" fill="#da3633" rx="1" />
          <text x="72" y="8" fill="#8b949e" fontSize="10">Spadek</text>
          {smaPoints.length > 1 && (
            <>
              <line x1="120" y1="4" x2="140" y2="4" stroke="#f0883e" strokeWidth="1.5" />
              <text x="144" y="8" fill="#8b949e" fontSize="10">SMA20</text>
            </>
          )}
          <text x="200" y="8" fill="#484f58" fontSize="10">Vol ▼</text>
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div className="chart-tooltip" style={{
          left: Math.min(tooltip.x + 16, containerWidth - 200),
          top: Math.max(tooltip.y - 10, 10)
        }}>
          <div className="tt-date">{tooltip.candle.date} ({tooltip.candle.dayOfWeek})</div>
          <div className="tt-row"><span>Otwarcie:</span> <span>{formatP(tooltip.candle.open)}</span></div>
          <div className="tt-row"><span>Najwyższe:</span> <span className="tt-high">{formatP(tooltip.candle.high)}</span></div>
          <div className="tt-row"><span>Najniższe:</span> <span className="tt-low">{formatP(tooltip.candle.low)}</span></div>
          <div className="tt-row"><span>Zamknięcie:</span> <span>{formatP(tooltip.candle.close)}</span></div>
          {tooltip.candle.volume > 0 && (
            <div className="tt-row"><span>Wolumen:</span> <span>{(tooltip.candle.volume / 1e9).toFixed(2)}B</span></div>
          )}
          <div className={`tt-change ${tooltip.candle.changePercent >= 0 ? 'positive' : 'negative'}`}>
            {tooltip.candle.changePercent >= 0 ? '▲' : '▼'} {tooltip.candle.changePercent?.toFixed(2)}%
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================== NEWS SLIDER ======================== */

function NewsSlider({ newsData, ticker }) {
  const [selectedDay, setActiveDay] = useState(null);
  const [expandedNews, setExpandedNews] = useState(null);
  const [filterImportance, setFilterImportance] = useState('all');

  if (!newsData || !newsData.newsByDay || Object.keys(newsData.newsByDay).length === 0) {
    return (
      <div className="news-section">
        <div className="news-header">
          <h3>📰 Wiadomości {ticker}</h3>
          <span className="refresh-info">🔄 Auto-odświeżanie co 5 min</span>
        </div>
        <div className="news-empty">
          <p>📰 Brak wiadomości dla {ticker} — spróbuj później</p>
        </div>
      </div>
    );
  }

  const days = Object.keys(newsData.newsByDay);
  const activeDay = selectedDay && days.includes(selectedDay) ? selectedDay : days[0];

  const filterArticles = (articles) => {
    if (filterImportance === 'all') return articles;
    if (filterImportance === 'high') return articles.filter(a => a.importance >= 6);
    if (filterImportance === 'important') return articles.filter(a => a.isImportant);
    return articles;
  };

  const activeDayData = activeDay ? newsData.newsByDay[activeDay] : null;
  const filteredArticles = activeDayData ? filterArticles(activeDayData.articles) : [];

  return (
    <div className="news-section">
      <div className="news-header">
        <div>
          <h3>📰 Wiadomości — {ticker}</h3>
          <small>🔄 Aktualizacja: {newsData.lastRefresh} • Źródło: Finnhub</small>
        </div>
        {newsData.newArticlesCount > 0 && (
          <div className="new-articles-badge">✨ {newsData.newArticlesCount} nowych</div>
        )}
      </div>

      <div className="news-filters">
        {[
          { key: 'all', label: 'Wszystkie' },
          { key: 'high', label: '🔴 Krytyczne' },
          { key: 'important', label: '⭐ Ważne' }
        ].map(f => (
          <button
            key={f.key}
            className={`filter-btn ${filterImportance === f.key ? 'active' : ''}`}
            onClick={() => setFilterImportance(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="days-slider">
        {days.map((day) => {
          const dayData = newsData.newsByDay[day];
          return (
            <button
              key={day}
              onClick={() => { setActiveDay(day); setExpandedNews(null); }}
              className={`day-btn ${activeDay === day ? 'active' : ''}`}
            >
              <span className="day-name">{day}</span>
              <span className="article-count">{dayData.articles.length}</span>
            </button>
          );
        })}
      </div>

      {activeDay && activeDayData && (
        <div className="news-list">
          <div className="day-info-bar">
            <span>{filteredArticles.length} artykułów</span>
          </div>
          
          {filteredArticles.length > 0 ? (
            <div className="news-articles">
              {filteredArticles.map((article) => (
                <div 
                  key={article.id} 
                  className={`news-article ${article.importance >= 6 ? 'high-imp' : ''}`}
                >
                  <div className="article-badges">
                    <span className={`badge importance ${getImportanceClass(article.importance)}`}>
                      {article.importanceLevel}
                    </span>
                    <span className={`badge sentiment ${article.sentiment.includes('POZYTYWNA') ? 'pos' : article.sentiment.includes('NEGATYWNA') ? 'neg' : 'neu'}`}>
                      {article.sentiment}
                    </span>
                    <span className="badge source">{article.source}</span>
                  </div>

                  <h4>{article.title}</h4>

                  <p className={`article-body ${expandedNews === article.id ? 'expanded' : ''}`}>
                    {article.body}
                  </p>

                  <div className="article-footer">
                    <span className="article-time">🕐 {article.publishedString}</span>
                    <div className="article-actions">
                      {article.body.length > 100 && (
                        <button 
                          className="btn-small"
                          onClick={() => setExpandedNews(expandedNews === article.id ? null : article.id)}
                        >
                          {expandedNews === article.id ? '⬆ Zwiń' : '⬇ Więcej'}
                        </button>
                      )}
                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="btn-small btn-link">
                        🔗 Źródło
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="news-empty">
              <p>Brak artykułów spełniających filtr</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getImportanceClass(importance) {
  if (importance >= 9) return 'critical';
  if (importance >= 6) return 'high';
  if (importance >= 3) return 'medium';
  return 'low';
}

export default AiTrader;