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
        console.log('🔄 Auto-refresh...');
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
        <h1>📈 Trading AI Assistant</h1>
        <p className="header-subtitle">CoinGecko LIVE Data • Gemini AI Analysis • Finnhub News</p>
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
          <p className="loading-sub">Analiza Gemini AI w toku</p>
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
              <span className="live-text">LIVE</span>
            </h2>
            <span className="last-update">Aktualizacja: {marketData.lastUpdate ? new Date(marketData.lastUpdate).toLocaleString('pl-PL') : '-'}</span>
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

          {/* Support / Resistance */}
          <div className="sr-row">
            <div className="sr-card resistance">
              <span className="sr-icon">🔴</span>
              <span className="sr-label">Opór</span>
              <span className="sr-value">{formatPrice(marketData.resistance1)} {currency}</span>
            </div>
            <div className="sr-card support">
              <span className="sr-icon">🟢</span>
              <span className="sr-label">Wsparcie</span>
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
            <div className={`indicator ${marketData.macd?.signal === 'BULLISH' ? 'bullish' : 'bearish'}`}>
              <span className="ind-name">MACD</span>
              <span className="ind-value">{marketData.macd?.signal}</span>
              <span className="ind-signal">Hist: {marketData.macd?.histogram}</span>
            </div>
            <div className={`indicator ${marketData.sar?.signal === 'BULLISH' ? 'bullish' : 'bearish'}`}>
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

          {/* Candlestick Chart */}
          {chartData.length > 0 && (
            <div className="chart-section">
              <div className="chart-title-row">
                <h3>📊 Wykres świecowy — ostatnie {chartData.length} dni</h3>
                <div className="chart-legend">
                  <span className="legend-item green">▮ Wzrost</span>
                  <span className="legend-item red">▮ Spadek</span>
                </div>
              </div>
              <CandlestickChart data={chartData} currency={currency} />
            </div>
          )}
        </div>
      )}

      {/* News Section */}
      {marketData && marketData.newsData && (
        <NewsSlider newsData={marketData.newsData} ticker={ticker} />
      )}

      {/* AI Analysis */}
      {analysis && (
        <div className="analysis-section">
          <h2>🤖 Analiza Gemini AI</h2>
          <div className="analysis-content">
            {analysis.split('\n').map((line, idx) => {
              if (!line.trim()) return null;
              return (
                <p key={idx} className={`analysis-line ${
                  line.includes('═') ? 'separator' :
                  line.includes('KUPUJ') ? 'buy-signal' :
                  line.includes('SPRZEDAJ') ? 'sell-signal' :
                  line.includes('TRZYMAJ') ? 'hold-signal' :
                  line.match(/^[1-9]️⃣|🔟|^#+\s/) ? 'section-head' : ''
                }`}>
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      )}

      <footer className="app-footer">
        <p>⚡ CoinGecko API • RSI, MACD, SAR, EMA • Gemini AI • Finnhub News</p>
        <p>📅 {new Date().toLocaleDateString('pl-PL')}</p>
      </footer>
    </div>
  );
}

/* ======================== CANDLESTICK CHART ======================== */

function CandlestickChart({ data, currency }) {
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
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
  const paddingLeft = 70;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 50;
  const chartW = containerWidth;
  const priceAreaH = 320;
  const volumeAreaH = 80;
  const totalH = priceAreaH + volumeAreaH + paddingTop + paddingBottom + 20;

  const usableW = chartW - paddingLeft - paddingRight;
  const candleSpacing = usableW / n;
  const candleW = Math.max(Math.min(candleSpacing * 0.6, 24), 4);

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
  const getVolY = (vol) => {
    const volBase = paddingTop + priceAreaH + 20 + volumeAreaH;
    return volBase - (vol / maxVol) * volumeAreaH;
  };
  const volBase = paddingTop + priceAreaH + 20 + volumeAreaH;

  // Price grid lines (6 levels)
  const gridLines = [];
  for (let i = 0; i <= 5; i++) {
    const price = pMin + (pRange * i) / 5;
    gridLines.push({ y: getY(price), price });
  }

  // SMA20 line
  const smaPoints = [];
  for (let i = 0; i < n; i++) {
    if (i >= 19) {
      const slice = data.slice(i - 19, i + 1);
      const avg = slice.reduce((s, d) => s + d.close, 0) / 20;
      smaPoints.push({ x: getX(i), y: getY(avg) });
    }
  }
  const smaPath = smaPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const handleMouseMove = (e, candle, i) => {
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      candle,
      i
    });
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
        {/* Background */}
        <rect width={chartW} height={totalH} fill="#0d1117" rx="12" />

        {/* Grid */}
        {gridLines.map((gl, i) => (
          <g key={`gl-${i}`}>
            <line
              x1={paddingLeft}
              y1={gl.y}
              x2={chartW - paddingRight}
              y2={gl.y}
              stroke="#21262d"
              strokeWidth="1"
            />
            <text
              x={paddingLeft - 8}
              y={gl.y + 4}
              fill="#8b949e"
              fontSize="11"
              textAnchor="end"
              fontFamily="monospace"
            >
              {formatP(gl.price)}
            </text>
          </g>
        ))}

        {/* Volume bars */}
        {data.map((candle, i) => {
          const x = getX(i);
          const isGreen = candle.close >= candle.open;
          const vol = candle.volume || 0;
          const barH = (vol / maxVol) * volumeAreaH;
          return (
            <rect
              key={`vol-${i}`}
              x={x - candleW / 2}
              y={volBase - barH}
              width={candleW}
              height={barH}
              fill={isGreen ? 'rgba(35, 134, 54, 0.4)' : 'rgba(218, 54, 51, 0.4)'}
              rx="1"
            />
          );
        })}

        {/* SMA20 line */}
        {smaPoints.length > 1 && (
          <path
            d={smaPath}
            fill="none"
            stroke="#f0883e"
            strokeWidth="1.5"
            opacity="0.7"
          />
        )}

        {/* Candles */}
        {data.map((candle, i) => {
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
              {/* Wick */}
              <line
                x1={x}
                y1={yHigh}
                x2={x}
                y2={yLow}
                stroke={isGreen ? '#238636' : '#da3633'}
                strokeWidth={Math.max(candleW * 0.1, 1)}
              />
              {/* Body */}
              <rect
                x={x - candleW / 2}
                y={bodyTop}
                width={candleW}
                height={bodyH}
                fill={isGreen ? '#238636' : '#da3633'}
                stroke={isGreen ? '#2ea043' : '#f85149'}
                strokeWidth="0.5"
                rx="1"
              />
              {/* Hover area */}
              <rect
                x={x - candleSpacing / 2}
                y={paddingTop}
                width={candleSpacing}
                height={priceAreaH + volumeAreaH + 20}
                fill="transparent"
                onMouseMove={(e) => handleMouseMove(e, candle, i)}
                onMouseLeave={() => setTooltip(null)}
              />
            </g>
          );
        })}

        {/* Date labels */}
        {data.map((candle, i) => {
          const step = n <= 15 ? 1 : n <= 20 ? 2 : 3;
          if (i % step !== 0 && i !== n - 1) return null;
          return (
            <text
              key={`dt-${i}`}
              x={getX(i)}
              y={totalH - 8}
              fill="#8b949e"
              fontSize="10"
              textAnchor="middle"
              fontFamily="monospace"
            >
              {candle.date}
            </text>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${chartW - paddingRight - 200}, ${paddingTop - 15})`}>
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
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(tooltip.x + 16, containerWidth - 200),
            top: tooltip.y - 10
          }}
        >
          <div className="tt-date">{tooltip.candle.date} ({tooltip.candle.dayOfWeek})</div>
          <div className="tt-row"><span>Open:</span> <span>{formatP(tooltip.candle.open)}</span></div>
          <div className="tt-row"><span>High:</span> <span className="tt-high">{formatP(tooltip.candle.high)}</span></div>
          <div className="tt-row"><span>Low:</span> <span className="tt-low">{formatP(tooltip.candle.low)}</span></div>
          <div className="tt-row"><span>Close:</span> <span>{formatP(tooltip.candle.close)}</span></div>
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
          <span className="refresh-info">🔄 Auto-refresh co 5 minut</span>
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