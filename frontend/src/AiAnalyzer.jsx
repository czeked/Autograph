import { useState } from 'react';
import './AiAnalyzer.css';

function AiAnalyzer() {
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
          prompt: `Analiza ${value.toUpperCase()}/${currency}`
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAnalysis(data.analysis);
        setMarketData(data.marketData);
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
      handleSearch(ticker);
    }
  };

  const formatMarketCap = (cap) => {
    if (cap > 1000000000) return `$${(cap / 1000000000).toFixed(2)}B`;
    if (cap > 1000000) return `$${(cap / 1000000).toFixed(2)}M`;
    return `$${cap.toFixed(2)}`;
  };

  return (
    <div className="analyzer-container">
      <div className="analyzer-header">
        <h1>📈 Trading AI Assistant</h1>
        <p>LIVE Candlestick Chart z Coinbase • Zaawansowana analiza techniczna</p>
      </div>

      <div className="analyzer-card">
        <div className="input-section">
          <div className="controls-top">
            <div className="search-container">
              <label>🔍 Szukaj kryptowaluty:</label>
              <div className="search-wrapper">
                <input
                  type="text"
                  value={searchTicker}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onFocus={() => searchTicker.length > 0 && setShowSuggestions(true)}
                  placeholder="Np. BTC, ETH, SOL, DOGE..."
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
                  {loading ? '⏳' : '🚀'}
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

            <div className="currency-container">
              <label>💵 Waluta:</label>
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
            placeholder="Opcjonalnie: Dodaj notatkę do analizy"
            rows={2}
            className="input-textarea"
          />

          {error && <div className="error-message">{error}</div>}
        </div>

        {marketData && (
          <div className="market-data-summary">
            <h3>📊 {ticker}/{currency} 🔴 LIVE (Coinbase)</h3>
            
            {/* Główne dane */}
            <div className="data-grid">
              <div className="data-item">
                <span className="label">Cena:</span>
                <span className="value pulse">${marketData.price?.toFixed(2)}</span>
              </div>
              <div className="data-item">
                <span className="label">Zmiana:</span>
                <span className={`value ${marketData.changePercent > 0 ? 'positive' : 'negative'}`}>
                  {marketData.changePercent > 0 ? '📈 +' : '📉 '}{marketData.changePercent?.toFixed(2)}%
                </span>
              </div>
              <div className="data-item">
                <span className="label">Kapitalizacja:</span>
                <span className="value">{formatMarketCap(marketData.marketCap)}</span>
              </div>
              <div className="data-item">
                <span className="label">Wolumen dzis:</span>
                <span className="value">${(marketData.volume / 1000000).toFixed(2)}M</span>
              </div>
            </div>

            {/* Wsparcie/Opór */}
            <div className="support-resistance">
              <div className="sr-item">
                <span>🔴 Opór: ${marketData.resistance1?.toFixed(2)}</span>
              </div>
              <div className="sr-item">
                <span>🟢 Wsparcie: ${marketData.support1?.toFixed(2)}</span>
              </div>
            </div>

            {/* Wskaźniki techniczne */}
            <div className="indicators-grid">
              <div className="indicator-box">
                <h4>📊 RSI (14)</h4>
                <div className={`indicator-value ${marketData.rsi > 70 ? 'overbought' : marketData.rsi < 30 ? 'oversold' : ''}`}>
                  {marketData.rsi?.toFixed(0)}
                </div>
                <small>{marketData.rsi > 70 ? 'Wykupiony' : marketData.rsi < 30 ? 'Wyprzedany' : 'Neutralny'}</small>
              </div>

              <div className="indicator-box">
                <h4>📈 EMA 12/26</h4>
                <div className="indicator-value">
                  <span>{marketData.ema12?.toFixed(2)}</span>
                  <span>/</span>
                  <span>{marketData.ema26?.toFixed(2)}</span>
                </div>
              </div>

              <div className="indicator-box">
                <h4>📊 MACD</h4>
                <div className={`indicator-value ${marketData.macd?.signal === 'BULLISH' ? 'bullish' : 'bearish'}`}>
                  {marketData.macd?.signal}
                </div>
                <small>Hist: {marketData.macd?.histogram}</small>
              </div>

              <div className="indicator-box">
                <h4>🛑 SAR</h4>
                <div className={`indicator-value ${marketData.sar?.signal === 'BULLISH' ? 'bullish' : 'bearish'}`}>
                  {marketData.sar?.trend}
                </div>
                <small>${marketData.sar?.sar}</small>
              </div>
            </div>

            {/* Formacje świec */}
            {marketData.patterns && (
              <div className="patterns-box">
                <h4>🕯️ Formacje świec:</h4>
                <div className="patterns-list">
                  {marketData.patterns.map((pattern, idx) => (
                    <span key={idx} className="pattern-tag">{pattern}</span>
                  ))}
                </div>
              </div>
            )}

            {chartData.length > 0 && (
              <div className="chart-container">
                <h4>📊 Candlestick Chart - Ostatnie 30 Dni</h4>
                <CandlestickChart data={chartData} currency={currency} />
              </div>
            )}
          </div>
        )}

        {analysis && (
          <div className="analysis-result">
            <h2>📋 Analiza AI</h2>
            <div className="analysis-content">
              {analysis.split('\n').map((line, idx) => (
                <p key={idx} className="analysis-line">
                  {line.includes('═') ? (
                    <span className="separator">{line}</span>
                  ) : line.includes('KUPUJ') ? (
                    <span className="recommendation buy">✅ {line}</span>
                  ) : line.includes('SPRZEDAJ') ? (
                    <span className="recommendation sell">❌ {line}</span>
                  ) : line.includes('TRZYMAJ') ? (
                    <span className="recommendation hold">⏸️ {line}</span>
                  ) : line.match(/^[1-9]️⃣|🔟/) ? (
                    <span className="section-header">{line}</span>
                  ) : (
                    line
                  )}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="footer">
        <p>⚡ LIVE Coinbase Exchange API • RSI, MACD, SAR, EMA, Formacje • Groq AI</p>
      </div>
    </div>
  );
}

function CandlestickChart({ data, currency }) {
  if (!data || data.length === 0) return null;

  const chartHeight = 600;
  const chartWidth = Math.max(data.length * 40, 900);
  const padding = 80;
  const candleWidth = 32;

  const maxPrice = Math.max(...data.map(d => d.high));
  const minPrice = Math.min(...data.map(d => d.low));
  const priceRange = maxPrice - minPrice || 1;

  const getY = (price) => {
    return chartHeight - padding - ((price - minPrice) / priceRange) * (chartHeight - padding * 2);
  };

  const getX = (index) => {
    return padding + (index * 40) + 20;
  };

  const chartLines = [];
  for (let i = 0; i <= 4; i++) {
    const ratio = i / 4;
    const y = chartHeight - padding - (ratio * (chartHeight - padding * 2));
    const price = minPrice + ratio * priceRange;
    chartLines.push({ y, price, ratio });
  }

  return (
    <div className="candlestick-wrapper">
      <svg 
        className="candlestick-chart" 
        width="100%" 
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="gridPattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#1a1a2e" strokeWidth="0.8"/>
          </pattern>
        </defs>

        <rect width={chartWidth} height={chartHeight} fill="#0a0e27"/>
        <rect width={chartWidth} height={chartHeight} fill="url(#gridPattern)" opacity="0.5"/>

        <line 
          x1={padding} 
          y1={padding} 
          x2={padding} 
          y2={chartHeight - padding} 
          stroke="#999" 
          strokeWidth="2.5"
        />
        <line 
          x1={padding} 
          y1={chartHeight - padding} 
          x2={chartWidth - padding} 
          y2={chartHeight - padding} 
          stroke="#999" 
          strokeWidth="2.5"
        />

        {chartLines.map((line, idx) => (
          <g key={`price-line-${idx}`}>
            <line 
              x1={padding} 
              y1={line.y} 
              x2={chartWidth - padding} 
              y2={line.y} 
              stroke="#3a3a5a" 
              strokeWidth="1.2" 
              strokeDasharray="10,5"
              opacity="0.6"
            />
            <text 
              x={padding - 15} 
              y={line.y + 5} 
              fontSize="14" 
              fill="#bbb" 
              textAnchor="end"
              fontWeight="600"
            >
              {currency} {line.price.toFixed(line.price < 100 ? 2 : 0)}
            </text>
          </g>
        ))}

        {data.map((candle, i) => {
          const x = getX(i);
          const yOpen = getY(candle.open);
          const yClose = getY(candle.close);
          const yHigh = getY(candle.high);
          const yLow = getY(candle.low);

          const isGreen = candle.close >= candle.open;
          const bodyColor = isGreen ? '#00ff88' : '#ff3333';
          const wickColor = isGreen ? '#00dd77' : '#dd2222';

          const candleTop = Math.min(yOpen, yClose);
          const candleBottom = Math.max(yOpen, yClose);
          const candleHeight = Math.max(candleBottom - candleTop, 4);

          return (
            <g key={`candle-${i}`}>
              <line 
                x1={x} 
                y1={yHigh} 
                x2={x} 
                y2={yLow} 
                stroke={wickColor} 
                strokeWidth="2"
                opacity="1"
              />

              <rect 
                x={x - candleWidth / 2}
                y={candleTop}
                width={candleWidth}
                height={candleHeight}
                fill={bodyColor}
                stroke={bodyColor}
                strokeWidth="1"
                opacity="1"
              />

              <rect 
                x={x - candleWidth / 2}
                y={candleTop}
                width={candleWidth}
                height={candleHeight}
                fill="none"
                stroke={isGreen ? '#00ffbb' : '#ff5555'}
                strokeWidth="1.5"
                opacity="0.5"
              />
            </g>
          );
        })}

        {data.map((candle, i) => {
          if (i % 3 === 0 || i === data.length - 1) {
            return (
              <text 
                key={`date-${i}`}
                x={getX(i)} 
                y={chartHeight - padding + 35} 
                fontSize="13" 
                fill="#aaa" 
                textAnchor="middle"
                fontWeight="600"
              >
                {candle.date}
              </text>
            );
          }
          return null;
        })}

        <g>
          <rect x={padding + 20} y="20" width="15" height="15" fill="#00ff88"/>
          <text x={padding + 45} y="33" fontSize="14" fill="#00ff88" fontWeight="bold">Close &gt; Open (↑)</text>
          
          <rect x={chartWidth - 350} y="20" width="15" height="15" fill="#ff3333"/>
          <text x={chartWidth - 325} y="33" fontSize="14" fill="#ff3333" fontWeight="bold">Close &lt; Open (↓)</text>
        </g>
      </svg>

      <div className="chart-info">
        <p>📅 <strong>{data.length} dni</strong> | Każda świeca = 1 dzień | Wicki = High/Low | Body = Open/Close</p>
      </div>
    </div>
  );
}

export default AiAnalyzer;