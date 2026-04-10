import { useState, useEffect } from 'react';
import './AiAnalyzer.css';

function AiAnalyzer() {
  const [prompt, setPrompt] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [marketData, setMarketData] = useState(null);
  const [ticker, setTicker] = useState('BTC');
  const [currency, setCurrency] = useState('USD');
  const [chartData, setChartData] = useState([]);
  const [cryptos, setCryptos] = useState([]);
  const [currencies, setCurrencies] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3000/api/currencies')
      .then(res => res.json())
      .then(data => {
        setCryptos(data.cryptos);
        setCurrencies(data.currencies);
      })
      .catch(err => console.error('Error:', err));
  }, []);

  const fetchChart = async () => {
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
          ticker: ticker, 
          currency: currency,
          prompt: prompt || `Analiza ${ticker}/${currency}`
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAnalysis(data.analysis);
        setMarketData(data.marketData);
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
    if (e.key === 'Enter' && e.ctrlKey) fetchChart();
  };

  return (
    <div className="analyzer-container">
      <div className="analyzer-header">
        <h1>📈 Trading AI Assistant</h1>
        <p>LIVE Candlestick Chart z Coinbase • 30 dni, 1 świeca = 1 dzień</p>
      </div>

      <div className="analyzer-card">
        <div className="input-section">
          <div className="controls-row">
            <div className="control-group">
              <label>💰 Kryptowaluta:</label>
              <select 
                value={ticker} 
                onChange={(e) => setTicker(e.target.value)}
                className="select-input"
              >
                {cryptos.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <label>💵 Waluta:</label>
              <select 
                value={currency} 
                onChange={(e) => setCurrency(e.target.value)}
                className="select-input"
              >
                {currencies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Opcjonalnie: Dodaj notatkę do analizy"
            rows={3}
            className="input-textarea"
          />

          <button
            onClick={fetchChart}
            disabled={loading}
            className={`submit-button ${loading ? 'loading' : ''}`}
          >
            {loading ? '⏳ Pobierám z Coinbase...' : '🚀 Pobierz Chart & Analizę'}
          </button>

          {error && <div className="error-message">{error}</div>}
        </div>

        {marketData && (
          <div className="market-data-summary">
            <h3>📊 {ticker}/{currency} 🔴 LIVE (Coinbase)</h3>
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
                <span className="label">RSI:</span>
                <span className="value">{marketData.rsi?.toFixed(0)}</span>
              </div>
              <div className="data-item">
                <span className="label">SMA20:</span>
                <span className="value">${marketData.sma20?.toFixed(2)}</span>
              </div>
              <div className="data-item">
                <span className="label">SMA50:</span>
                <span className="value">${marketData.sma50?.toFixed(2)}</span>
              </div>
              <div className="data-item">
                <span className="label">Wsparcie:</span>
                <span className="value">${marketData.support1?.toFixed(2)}</span>
              </div>
              <div className="data-item">
                <span className="label">Opór:</span>
                <span className="value">${marketData.resistance1?.toFixed(2)}</span>
              </div>
              <div className="data-item">
                <span className="label">Źródło:</span>
                <span className="value">{marketData.source}</span>
              </div>
            </div>

            {chartData.length > 0 && (
              <div className="chart-container">
                <h4>📊 Candlestick Chart - Ostatnie 30 Dni</h4>
                <CandlestickChart data={chartData} currency={currency} ticker={ticker} />
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
                  ) : line.match(/^\d️⃣/) ? (
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
        <p>💡 Tickery: BTC, ETH, ADA, DOGE, SOL, XRP, BNB, LTC, BCH, LINK, AVAX, POLYGON, UNI</p>
        <p>⚡ LIVE Coinbase Exchange API • Aktualizacja co dzień • Groq AI</p>
      </div>
    </div>
  );
}

function CandlestickChart({ data, currency, ticker }) {
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
        <p>🔄 Aktualizuje się automatycznie co 24h | Dane z Coinbase Exchange API</p>
      </div>
    </div>
  );
}

export default AiAnalyzer;