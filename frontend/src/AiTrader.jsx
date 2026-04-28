import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AiTrader.css';
import { 
  Search, TrendingUp, TrendingDown, Activity, Bot, BrainCircuit, Target, 
  AlertTriangle, Calendar, ExternalLink, HelpCircle, Printer, SlidersHorizontal,
  Star, Layout, Maximize2, Moon, Sun, Monitor, Zap, ShieldAlert, BadgeInfo
} from 'lucide-react';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import GlassCardComponent from './components/GlassCard.jsx';

const GlassCard = ({ children, className = "", style = {} }) => (
  <GlassCardComponent className={className} style={style}>{children}</GlassCardComponent>
);

const SentimentGauge = ({ score }) => {
  const rotation = (score / 100) * 180 - 90;
  let color = 'var(--accent-red)';
  let text = 'EXTREME FEAR';
  if (score > 40) { color = 'var(--accent-amber)'; text = 'NEUTRAL'; }
  if (score > 60) { color = 'var(--accent-green)'; text = 'GREED'; }

  return (
    <div className="gauge-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="gauge-wrapper" style={{ position: 'relative', width: '160px', height: '80px', overflow: 'hidden' }}>
        <div className="gauge-bg" style={{ position: 'absolute', top: 0, left: 0, width: '160px', height: '160px', borderRadius: '50%', border: '10px solid rgba(255,255,255,0.05)' }} />
        <div
          className="gauge-fill"
          style={{
            position: 'absolute', top: 0, left: 0, width: '160px', height: '160px', borderRadius: '50%',
            border: '10px solid transparent', borderTopColor: color, borderRightColor: color,
            transform: `rotate(${rotation}deg)`, transition: 'transform 1.5s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        />
        <div className="gauge-score" style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', fontSize: '1.8rem', fontWeight: 800, color }}>{score}</div>
      </div>
      <span className="gauge-label" style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', marginTop: '8px', color: 'var(--text-muted)' }}>{text}</span>
    </div>
  );
};

function AiTrader() {
  const navigate = useNavigate();
  const [searchTicker, setSearchTicker] = useState('BTC');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [currency, setCurrency] = useState('USD');
  const [prompt, setPrompt] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [marketData, setMarketData] = useState(null);
  const [ticker, setTicker] = useState('');
  const [chartData, setChartData] = useState([]);
  const [livePrice, setLivePrice] = useState(null);
  const [priceFlash, setPriceFlash] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [focusMode, setFocusMode] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('favorites')) || []; } catch { return []; }
  });
  
  const wsRef = useRef(null);
  const prevPriceRef = useRef(null);

  const cryptoList = [
    'BTC', 'ETH', 'ADA', 'DOGE', 'SOL', 'XRP', 'BNB', 'LTC', 
    'BCH', 'LINK', 'AVAX', 'MATIC', 'UNI', 'SHIB', 'ATOM', 'NEAR',
    'DOT', 'ICP', 'ARB', 'OP', 'PEPE', 'FLOKI', 'MEME',
    'WIF', 'BONK', 'JUP', 'SAGA', 'GMX', 'BLUR'
  ];

  const currencyList = ['USD', 'EUR', 'GBP'];

  // Handle Search Input Change (Local suggestions)
  useEffect(() => {
    if (query.length > 0) {
      const filtered = cryptoList.filter(crypto => 
        crypto.startsWith(query.toUpperCase())
      ).slice(0, 8);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [query]);

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

    return () => { if (ws && ws.readyState === WebSocket.OPEN) ws.close(); };
  }, [ticker]);

  // Alerts logic
  useEffect(() => {
    if (!marketData) return;
    const newAlerts = [];
    if (marketData.rsi < 30) newAlerts.push({ type: 'oversold', text: `⚠️ RSI ${marketData.rsi.toFixed(1)} — Wyprzedanie!`, color: 'var(--accent-green)' });
    if (marketData.rsi > 70) newAlerts.push({ type: 'overbought', text: `⚠️ RSI ${marketData.rsi.toFixed(1)} — Wykupienie!`, color: 'var(--accent-red)' });
    if (marketData.composite?.decision === 'KUPUJ') newAlerts.push({ type: 'bullish', text: '🟢 Silny sygnał byczy wykryty przez algorytm', color: 'var(--accent-green)' });
    if (marketData.composite?.decision === 'SPRZEDAJ') newAlerts.push({ type: 'bearish', text: '🔴 Silny sygnał niedźwiedzi wykryty przez algorytm', color: 'var(--accent-red)' });
    setAlerts(newAlerts);
  }, [marketData]);

  const handleSelect = (crypto) => {
    setTicker(crypto);
    setQuery('');
    setSuggestions([]);
    handleSearch(crypto);
  };

  const handleSearch = async (searchValue) => {
    const value = searchValue || query || searchTicker;
    if (!value) return;
    
    setLoading(true);
    setError('');
    setMarketData(null);

    try {
      const res = await axios.post('https://autograph-qrt6.onrender.com/api/analyze', { 
        ticker: value.toUpperCase(), 
        currency: currency,
        prompt: prompt || `Analiza ${value.toUpperCase()}/${currency}`
      });

      const data = res.data;
      if (data.success) {
        setMarketData(data.marketData);
        setTicker(data.ticker);
        setChartData(data.chartData || []);
        setAnalysis(data.analysis);
        
        // Notification dispatch
        const notifItems = [];
        if (data.marketData.composite?.decision) {
          notifItems.push({ type: "price", text: `🤖 ${data.ticker}: Sygnał Composite — ${data.marketData.composite.decision}`, ticker: data.ticker });
        }
        if (notifItems.length > 0) {
          window.dispatchEvent(new CustomEvent("autograph:notification", {
            detail: { source: "crypto", items: notifItems }
          }));
        }
      } else {
        setError(data.error || "Błąd analizy");
      }
    } catch (err) {
      setError(err.message || "Błąd połączenia z serwerem");
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = (crypto) => {
    setFavorites(prev => {
      const next = prev.includes(crypto) ? prev.filter(f => f !== crypto) : [...prev, crypto];
      localStorage.setItem('favorites', JSON.stringify(next));
      return next;
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && suggestions.length > 0) handleSelect(suggestions[0]);
    else if (e.key === 'Enter') handleSearch();
  };

  const formatPrice = (price) => {
    if (!price) return '0.00';
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: price < 1 ? 6 : 2 });
  };

  return (
    <div className="analyzer-page">
      <Header />
      
      <main className="main-content">
        {/* TOOLBAR - Unified with AiAnalyzer */}
        <div className="toolbar-container" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '2rem', padding: '8px 12px', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '10px' }}>
          <div className="search-container" style={{ flex: 1 }}>
            <div className="search-input-wrapper" style={{ position: 'relative' }}>
              <input
                type="text"
                className="search-input"
                placeholder="Szukaj kryptowaluty (np. BTC, ETH, SOL)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ paddingLeft: '35px' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
            </div>
            {suggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {suggestions.map((s, i) => (
                  <div key={i} className="suggestion-item" onClick={() => handleSelect(s)}>
                    <span className="suggestion-ticker">{s}</span>
                    <span className="suggestion-name">Kryptowaluta</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ width: '1px', height: '22px', background: '#2e2e2e', flexShrink: 0 }} />
          
          <div className="toolbar-actions" style={{ display: 'flex', gap: '8px' }}>
             <select 
               className="header-btn" 
               value={currency} 
               onChange={(e) => { setCurrency(e.target.value); if(ticker) handleSearch(ticker); }}
               style={{ background: '#1e1e1e', cursor: 'pointer' }}
             >
               {currencyList.map(c => <option key={c} value={c}>{c}</option>)}
             </select>

             <button onClick={() => setFocusMode(!focusMode)} className={`header-btn ${focusMode ? 'active' : ''}`}>
               <Maximize2 size={13} /> {focusMode ? 'Normal' : 'Focus'}
             </button>
             
             <button onClick={() => window.print()} className="header-btn">
               <Printer size={13} /> PDF
             </button>
          </div>
        </div>

        {/* Favorites Section */}
        {favorites.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1.5rem' }}>
            {favorites.map(fav => (
              <button 
                key={fav} 
                className={`tf-btn ${ticker === fav ? 'active' : ''}`}
                onClick={() => handleSelect(fav)}
                style={{ fontSize: '0.75rem', padding: '4px 12px' }}
              >
                ⭐ {fav}
              </button>
            ))}
          </div>
        )}

        {/* State Displays */}
        {!marketData && !loading && !error && (
          <div className="empty-state">
            <Target size={64} color="var(--text-muted)" />
            <h2>Analiza rynków krypto AI</h2>
            <p>Wprowadź symbol kryptowaluty, aby wygenerować głęboką analizę techniczną i sentymentu.</p>
          </div>
        )}

        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p className="loading-text">Algorytm Quantum Crypto analizuje rynek...</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <AlertTriangle size={64} color="var(--accent-red)" />
            <h2 style={{ color: 'var(--accent-red)' }}>{error}</h2>
          </div>
        )}

        {/* DASHBOARD CONTENT */}
        {marketData && !loading && (
          <div className={`dashboard-wrapper ${focusMode ? 'focus-layout' : ''}`}>
            
            {/* Header Area */}
            <div className="asset-header" style={{ marginBottom: '2rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                   <h2 className="asset-title">{ticker}</h2>
                   <button 
                     onClick={() => toggleFavorite(ticker)} 
                     style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: favorites.includes(ticker) ? '#facc15' : '#444' }}
                   >
                     <Star fill={favorites.includes(ticker) ? "currentColor" : "none"} size={28} />
                   </button>
                </div>
                <div className="asset-price-row">
                  <span className="asset-price">{formatPrice(marketData.price)} {currency}</span>
                  <span className={`asset-change ${marketData.changePercent >= 0 ? 'color-green' : 'color-red'}`}>
                    {marketData.changePercent >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    {marketData.changePercent > 0 ? '+' : ''}{marketData.changePercent?.toFixed(2)}%
                  </span>
                  {livePrice && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderLeft: '1px solid #333', paddingLeft: '12px', marginLeft: '12px' }}>
                      Binance: <strong style={{ color: priceFlash === 'up' ? 'var(--accent-green)' : priceFlash === 'down' ? 'var(--accent-red)' : '#fff' }}>{formatPrice(livePrice)} USDT</strong>
                    </span>
                  )}
                </div>
              </div>

              {!focusMode && (
                <div className="quick-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Volume 24h</div>
                    <div style={{ fontWeight: 700 }}>${(marketData.volume / 1e6).toFixed(1)}M</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Market Cap</div>
                    <div style={{ fontWeight: 700 }}>${(marketData.marketCap / 1e9).toFixed(2)}B</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fear & Greed</div>
                    <div style={{ fontWeight: 700, color: marketData.fearGreed?.value > 60 ? 'var(--accent-green)' : marketData.fearGreed?.value < 40 ? 'var(--accent-red)' : 'var(--accent-amber)' }}>
                      {marketData.fearGreed?.value || '—'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Main Grid */}
            <div className="dashboard-grid">
              
              <div className="left-column">
                {/* Decision Banner (Consensus) */}
                {marketData.composite && (
                  <div className="consensus-banner" style={{ 
                    background: marketData.composite.score > 0 ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                    border: `1px solid ${marketData.composite.score > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    borderLeft: `4px solid ${marketData.composite.score > 0 ? 'var(--accent-green)' : 'var(--accent-red)'}`,
                    padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                      <div style={{ textAlign: 'center', minWidth: '80px' }}>
                        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: marketData.composite.score > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                          {marketData.composite.score > 0 ? '↑' : '↓'}
                        </div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: marketData.composite.score > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                          {marketData.composite.score > 0 ? 'KUP' : 'SPRZEDAJ'}
                        </div>
                      </div>
                      <div style={{ width: '1px', height: '3rem', background: 'rgba(255,255,255,0.1)' }} />
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '4px' }}>COMPOSITE SCORE</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: marketData.composite.score > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                          {marketData.composite.score > 0 ? '+' : ''}{marketData.composite.score}
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>/100</span>
                        </div>
                      </div>
                    </div>

                    {marketData.composite.breakdown && (
                      <div style={{ flex: 1, maxWidth: '400px', display: 'flex', gap: '15px' }}>
                        {Object.entries(marketData.composite.breakdown).map(([key, val]) => (
                          <div key={key} style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{key}</div>
                            <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ 
                                width: `${Math.abs(val.contribution * 10)}%`, 
                                height: '100%', 
                                background: val.contribution > 0 ? 'var(--accent-green)' : 'var(--accent-red)' 
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ textAlign: 'right' }}>
                       <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>CONFIDENCE</div>
                       <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{marketData.composite.confidence}%</div>
                       <div style={{ fontSize: '0.6rem', color: 'var(--accent-blue)', fontWeight: 700 }}>QUANT CORE</div>
                    </div>
                  </div>
                )}

                {/* Alerts Bar */}
                {alerts.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.5rem' }}>
                    {alerts.map((a, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderLeft: `3px solid ${a.color}`, padding: '10px 15px', borderRadius: '4px', fontSize: '0.8rem' }}>
                        {a.text}
                      </div>
                    ))}
                  </div>
                )}

                {/* Indicators Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '2rem' }}>
                   <GlassCard>
                      <div className="card-title"><Activity size={14} /> RSI (14)</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: marketData.rsi > 70 ? 'var(--accent-red)' : marketData.rsi < 30 ? 'var(--accent-green)' : '#fff' }}>
                        {marketData.rsi?.toFixed(1)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{marketData.rsi > 70 ? 'WYKUPIONY' : marketData.rsi < 30 ? 'WYPRZEDANY' : 'NEUTRALNY'}</div>
                   </GlassCard>
                   
                   <GlassCard>
                      <div className="card-title"><Zap size={14} /> MACD</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: marketData.macd?.signal === 'BYCZY' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {marketData.macd?.signal}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>HIST: {marketData.macd?.histogram}</div>
                   </GlassCard>

                   <GlassCard>
                      <div className="card-title"><Layout size={14} /> PIVOT POINT</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{formatPrice(marketData.pivotPoint)}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                        <span>S1: {formatPrice(marketData.support1)}</span>
                        <span>R1: {formatPrice(marketData.resistance1)}</span>
                      </div>
                   </GlassCard>
                </div>

                {/* Analysis Content */}
                <GlassCard className="analysis-text" style={{ padding: '2rem', lineHeight: '1.8' }}>
                   <div className="card-title" style={{ marginBottom: '1.5rem' }}><Bot size={18} /> Analiza Quantum Crypto Core</div>
                   <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
                     {analysis}
                   </div>
                </GlassCard>
              </div>

              {/* Right Column / Sidebar */}
              {!focusMode && (
                <div className="sidebar">
                  <GlassCard>
                    <div className="card-title"><BadgeInfo size={14} /> Informacje o rynku</div>
                    <div className="quant-row">
                      <span className="quant-label">Trend (ADX)</span>
                      <span className="quant-value" style={{ color: marketData.adx?.adx > 25 ? 'var(--accent-blue)' : 'var(--text-muted)' }}>
                        {marketData.adx?.trend} ({marketData.adx?.adx})
                      </span>
                    </div>
                    <div className="quant-row">
                      <span className="quant-label">Stoch RSI</span>
                      <span className="quant-value">{marketData.stochRsi?.signal}</span>
                    </div>
                    <div className="quant-row">
                      <span className="quant-label">EMA 12/26</span>
                      <span className="quant-value">{marketData.ema12 < marketData.ema26 ? 'SPADEK' : 'WZROST'}</span>
                    </div>
                  </GlassCard>

                  <GlassCard style={{ marginTop: '1rem' }}>
                    <div className="card-title"><ShieldAlert size={14} /> Ryzyko i Sentyment</div>
                    <SentimentGauge score={marketData.fearGreed?.value || 50} />
                  </GlassCard>
                </div>
              )}

            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default AiTrader;