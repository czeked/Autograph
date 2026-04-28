import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, BarController, Title, Tooltip, Filler, Legend as ChartLegend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  Search, TrendingUp, TrendingDown, Activity, ChevronDown, ChevronUp, Bot, BrainCircuit, Target, AlertTriangle, Calendar, ExternalLink, HelpCircle, Printer
} from 'lucide-react';
import GlassCardComponent from './components/GlassCard.jsx';
import LegendModal from './components/Legend.jsx';
import IndicatorsGrid from './components/IndicatorsGrid.jsx';
import TrendMatrix from './components/TrendMatrix.jsx';
import Watchlist from './components/Watchlist.jsx';
import FundamentalsPanel from './components/FundamentalsPanel.jsx';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import zoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, BarController, Title, Tooltip, Filler, ChartLegend, zoomPlugin);

// --- KOMPONENTY POMOCNICZE UI ---

const GlassCard = ({ children, className = "", style = {} }) => (
  <GlassCardComponent className={className} style={style}>{children}</GlassCardComponent>
);

const SentimentGauge = ({ score }) => {
  const rotation = (score / 100) * 180 - 90;
  let color = 'var(--accent-red)';
  let text = 'NIEDŹWIEDŹ';
  if (score > 40) { color = '#f59e0b'; text = 'NEUTRALNY'; }
  if (score > 60) { color = 'var(--accent-green)'; text = 'BYK'; }

  return (
    <div className="gauge-container">
      <div className="gauge-wrapper">
        <div className="gauge-bg" />
        <div
          className="gauge-fill"
          style={{
            borderTopColor: color,
            borderRightColor: color,
            transform: `rotate(${rotation}deg)`
          }}
        />
        <div className="gauge-score" style={{ color }}>{score}</div>
      </div>
      <span className="gauge-label">{text}</span>
    </div>
  );
};


// --- ERROR BOUNDARY ---
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('[ErrorBoundary]', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--accent-red)' }}>
          <AlertTriangle size={48} style={{ marginBottom: '1rem' }} />
          <h3>Blad renderowania dashboardu</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{this.state.error?.message}</p>
          <button className="tf-btn" style={{ marginTop: '1rem' }} onClick={() => this.setState({ hasError: false, error: null })}>
            Sprobuj ponownie
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- SKELETON LOADERS ---
const SkeletonCard = ({ height = 120, label = '' }) => (
  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '0.75rem', height, animation: 'pulse 1.5s infinite' }}>
    {label && <div style={{ fontSize: '0.65rem', color: 'var(--accent-blue)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.08em' }}>{label}</div>}
    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '12px', width: '60%', marginBottom: '8px' }} />
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '4px', height: '10px', width: '40%', marginBottom: '6px' }} />
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '4px', height: '10px', width: '50%' }} />
  </div>
);

// --- GŁÓWNA APLIKACJA ---

export default function AiAnalyzer() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [symbol, setSymbol] = useState('');

  const [timeframe, setTimeframe] = useState('1M');
  const timeframes = ['1W', '1M', '3M', '6M', '1Y'];


  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [expandedDay, setExpandedDay] = useState(null);
  const [deepDiveDay, setDeepDiveDay] = useState(null);
  const [dayStreamText, setDayStreamText] = useState('');
  const [dayLoading, setDayLoading] = useState(false);
  const [dayArticles, setDayArticles] = useState([]);
  const [showEMA, setShowEMA] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [showBB, setShowBB] = useState(false);
  const [showMACD, setShowMACD] = useState(true);
  const anomalyRef = React.useRef(null);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      axios.get(`https://autograph-qrt6.onrender.com/api/search?q=${query}`)
        .then(res => setSuggestions(res.data)).catch(() => { });
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      handleSelect(suggestions[0].ticker);
    }
  };

  const fetchAnalysis = async (tickerToFetch) => {
    if (!tickerToFetch) return;
    setLoading(true); setError(''); setExpandedDay(null); setDayStreamText('');
    try {
      const response = await axios.post('https://autograph-qrt6.onrender.com/api/analyze', {
        ticker: tickerToFetch,
        timeframe: '1Y',
      }, { timeout: 120_000 });
      setData(response.data);
      setTimeframe('1Y'); // Resetujemy okno na pełny wgląd
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Błąd pobierania danych z rynku.");
    } finally {
      setLoading(false);
    }
  };

  const expandDay = (dateStr) => {
    if (expandedDay === dateStr) {
      setExpandedDay(null);
      setDayArticles([]);
      return;
    }
    setExpandedDay(dateStr);
    setDeepDiveDay(null);
    setDayStreamText('');
    setTimeout(() => anomalyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);

    // Zamiast strzelać do osobnego zacinającego się API, ładujemy to natychmiast z danych głównych
    const anom = data.analysis?.anomalies?.find(a => a.date === dateStr);
    if (anom && anom.articles) {
      setDayArticles(anom.articles);
    } else {
      setDayArticles([]);
    }
  };

  const generateDeepDive = async (dateStr) => {
    setDeepDiveDay(dateStr);
    setDayStreamText('');
    setDayLoading(true);

    try {
      const response = await fetch('https://autograph-qrt6.onrender.com/api/analyze-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: symbol, date: dateStr })
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '');
            if (dataStr === '[DONE]') { setDayLoading(false); break; }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) setDayStreamText(prev => prev + parsed.text);
            } catch (ignore) { 
              // ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setDayStreamText("Błąd ładowania szczegółów z Quantum Core...");
      setDayLoading(false);
    }
  };

  const handleTimeframeChange = (tf) => {
    setTimeframe(tf);
  };

  const handleSelect = (ticker) => {
    setSymbol(ticker);
    setQuery('');
    setSuggestions([]);
    fetchAnalysis(ticker);
  };

  const filteredHistory = useMemo(() => {
    if (!data?.history) return [];
    let days = 365;
    if (timeframe === '1D') days = 2;
    if (timeframe === '1W') days = 10;
    if (timeframe === '1M') days = 30;
    if (timeframe === '3M') days = 90;
    if (timeframe === '6M') days = 180;
    if (timeframe === '1Y') days = 365;

    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - days);
    return data.history.filter(h => new Date(h.t).getTime() >= limitDate.getTime());
  }, [data, timeframe]);

  const chartData = useMemo(() => {
    if (!filteredHistory.length) return null;
    const historySlice = filteredHistory;

    const anomalyDates = new Set(data.analysis?.anomalies?.map(a => a.date) || []);
    // volatile_days = top 40 dni z największym ruchem cenowym (z backendu, pure matematyka)
    const volatileDatesSet = new Set((data.volatile_days || []).map(v => v.date));
    const startIdx = data.history.findIndex(h => h.t === historySlice[0].t);
    const sliceSeries = (arr) => arr ? arr.slice(startIdx, startIdx + historySlice.length) : [];

    const labels = historySlice.map(h => new Date(h.t).toLocaleDateString());
    const prices = historySlice.map(h => h.c);

    const pointRadii = historySlice.map(h => {
      const d = new Date(h.t).toISOString().split('T')[0];
      if (volatileDatesSet.has(d)) return 7;
      if (anomalyDates.has(d)) return 4;
      return 0;
    });
    const pointColors = historySlice.map(h => {
      const d = new Date(h.t).toISOString().split('T')[0];
      if (volatileDatesSet.has(d)) return 'var(--accent-purple)'; // Największe anomalie na fioletowo
      if (anomalyDates.has(d)) return 'rgba(139,92,246, 0.4)'; // Zwykłe dni z newsami bledsze
      return 'transparent';
    });
    const pointBorders = historySlice.map(h => {
      const d = new Date(h.t).toISOString().split('T')[0];
      if (volatileDatesSet.has(d)) return 'rgba(139,92,246, 0.8)';
      if (anomalyDates.has(d)) return 'rgba(139,92,246, 0.2)';
      return 'transparent';
    });

    return {
      labels,
      datasets: [
        {
          label: 'Cena USD',
          data: prices,
          borderColor: 'var(--accent-blue)',
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(0, 229, 255, 0.4)');
            gradient.addColorStop(1, 'rgba(0, 229, 255, 0.0)');
            return gradient;
          },
          borderWidth: 3,
          pointRadius: pointRadii,
          pointBackgroundColor: pointColors,
          pointBorderColor: pointBorders,
          pointBorderWidth: 2,
          pointHoverRadius: 11,
          fill: true,
          tension: 0.1
        },
        ...(showEMA && data?.chart_series ? [
          { label: 'EMA 50', data: sliceSeries(data.chart_series.ema50), borderColor: 'rgba(255,165,0,0.85)', borderWidth: 1.5, pointRadius: 0, tension: 0.1, fill: false },
          { label: 'EMA 200', data: sliceSeries(data.chart_series.ema200), borderColor: 'rgba(255,80,80,0.85)', borderWidth: 1.5, pointRadius: 0, tension: 0.1, fill: false }
        ] : []),
        ...(showBB && data?.chart_series ? [
          { label: 'BB Upper', data: sliceSeries(data.chart_series.bb_upper), borderColor: 'rgba(139,92,246,0.55)', borderWidth: 1, pointRadius: 0, tension: 0.1, fill: false, borderDash: [5, 3] },
          { label: 'BB Middle', data: sliceSeries(data.chart_series.bb_middle), borderColor: 'rgba(139,92,246,0.3)', borderWidth: 1, pointRadius: 0, tension: 0.1, fill: false, borderDash: [2, 3] },
          { label: 'BB Lower', data: sliceSeries(data.chart_series.bb_lower), borderColor: 'rgba(139,92,246,0.55)', borderWidth: 1, pointRadius: 0, tension: 0.1, fill: false, borderDash: [5, 3] }
        ] : [])
      ]
    };
  }, [filteredHistory, data, showEMA, showBB]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    onClick: (event, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const h = filteredHistory[idx];
        const dStr = new Date(h.t).toISOString().split('T')[0];
        expandDay(dStr); // Zawsze otwieraj dzień, niezależnie czy to anomalia
      }
    },
    plugins: {
      zoom: {
        pan: { enabled: true, mode: 'x' },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x',
        }
      },
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(11, 15, 25, 0.95)',
        titleFont: { family: 'Outfit', size: 16 },
        bodyFont: { family: 'Inter', size: 14 },
        padding: 16,
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        displayColors: false,
        callbacks: {
          afterBody: (context) => {
            const idx = context[0].dataIndex;
            const h = filteredHistory[idx];
            const dStr = new Date(h.t).toISOString().split('T')[0];
            const anom = data.analysis?.anomalies?.find(a => a.date === dStr);
            const vol = (data.volatile_days || []).find(v => v.date === dStr);
            if (anom) return `\n⚡ AI: ${anom.short_desc}\n(Kliknij po szczegółową analizę!)`;
            if (vol) return `\n📈 Ruch: ${vol.pct > 0 ? '+' : ''}${vol.pct.toFixed(2)}%\n(Kliknij po analizę Quantum!)`;
            return '';
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: { maxTicksLimit: 8, color: '#64748b', font: { family: 'Inter' } }
      },
      y: {
        position: 'right',
        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
        ticks: { color: '#94a3b8', font: { family: 'Inter', weight: 600 } }
      }
    }
  };

  return (
    <>
      <Header />

      {showLegend && <LegendModal onClose={() => setShowLegend(false)} />}

      <div className="analyzer-page">
      <main className="main-content">

        {/* SEARCH BAR */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '2rem', justifyContent: 'center'}}>
          <div className="search-container" style={{ flex: 1, maxWidth: '520px' }}>
            <div className="search-input-wrapper">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                className="search-input"
                placeholder="Szukaj rynków (np. AAPL, NVDA)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            {suggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {suggestions.map((s, i) => (
                  <div key={i} className="suggestion-item" onClick={() => handleSelect(s.ticker)}>
                    <span className="suggestion-ticker">{s.ticker}</span>
                    <span className="suggestion-name">{s.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Watchlist currentTicker={data?.ticker} onSelect={handleSelect} />
          <button onClick={() => window.print()} className="header-btn">
            <Printer size={14} /> PDF
          </button>
          <button onClick={() => setShowLegend(true)} className="header-btn">
            <HelpCircle size={14} /> Legenda
          </button>
        </div>

        {!data && !loading && !error && (
          <div className="empty-state">
            <Target size={64} color="var(--text-muted)" />
            <h2>Wybierz aktywo, aby rozpocząć.</h2>
            <p>System pobierze historię bazową, a algorytm wygeneruje wnioski AI pod Twoje ramy czasowe.</p>
          </div>
        )}

        {loading && (
          <div>
            <div className="loading-state" style={{ marginBottom: '1.5rem' }}>
              <div className="spinner"></div>
              <p className="loading-text">Trwa praca Quant AI...</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', maxWidth: '900px', margin: '0 auto' }}>
              <SkeletonCard height={130} label="EMA CROSSOVERS" />
              <SkeletonCard height={130} label="MACD (12/26/9)" />
              <SkeletonCard height={130} label="BOLLINGER BANDS" />
              <SkeletonCard height={130} label="ADX - SILA TRENDU" />
              <SkeletonCard height={130} label="ATR - ZMIENNOSC" />
              <SkeletonCard height={130} label="STOCH RSI" />
            </div>
          </div>
        )}

        {error && (
          <div className="error-state">
            <AlertTriangle size={64} color="var(--accent-red)" style={{ marginBottom: '1rem' }} />
            <h2 style={{ color: 'var(--accent-red)' }}>{error}</h2>
          </div>
        )}

        {data && !loading && (
          <ErrorBoundary>
          <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>

            {/* LEWA STRONA (Wykres, Anomalie) */}
            <div className="main-panel">

              <div className="asset-header">
                <div>
                  <h2 className="asset-title">{data.ticker}</h2>
                  <div className="asset-price-row">
                    {(() => {
                      const filtered = filteredHistory;
                      const first = filtered[0];
                      const last = filtered[filtered.length - 1];
                      if (!first || !last) return null;
                      const pct = ((last.c - first.c) / first.c) * 100;
                      const isUp = pct >= 0;
                      return (
                        <>
                          <span className="asset-price">${last.c.toFixed(2)}</span>
                          <span className={`asset-change ${isUp ? 'color-green' : 'color-red'}`}>
                            {isUp ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                            {isUp ? '+' : ''}{pct.toFixed(2)}%
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="timeframe-selector">
                  {timeframes.map(tf => (
                    <button
                      key={tf}
                      onClick={() => handleTimeframeChange(tf)}
                      className={`tf-btn ${timeframe === tf ? 'active' : ''}`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px', marginTop: '-4px' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>OVERLAY:</span>
                <button onClick={() => setShowEMA(p => !p)} className={`tf-btn ${showEMA ? 'active' : ''}`} style={{ fontSize: '0.7rem', padding: '3px 10px', opacity: showEMA ? 1 : 0.55 }}>EMA 50/200</button>
                <button onClick={() => setShowMACD(p => !p)} className="tf-btn" style={{ fontSize: '0.7rem', padding: '3px 10px', opacity: showMACD ? 1 : 0.5 }}>Volume</button>
                <button onClick={() => setShowBB(p => !p)} className={`tf-btn ${showBB ? 'active' : ''}`} style={{ fontSize: '0.7rem', padding: '3px 10px', opacity: showBB ? 1 : 0.55 }}>Bollinger Bands</button>
              </div>
              <GlassCard className="chart-container">
                {chartData ? <Line data={chartData} options={chartOptions} /> : null}
              </GlassCard>

              {data.quant_stats && (
                <IndicatorsGrid qs={data.quant_stats} />
              )}

              {showMACD && (() => {
                if (!filteredHistory.length) return null;
                const labels = filteredHistory.map(h => new Date(h.t).toLocaleDateString());
                const volumes = filteredHistory.map(h => h.v || 0);
                const volColors = filteredHistory.map((h, i) => {
                  if (i === 0) return 'rgba(100,116,139,0.5)';
                  return h.c >= filteredHistory[i - 1].c ? 'rgba(16,185,129,0.55)' : 'rgba(239,68,68,0.55)';
                });
                const avg20 = volumes.length >= 20
                  ? volumes.map((_, i) => i >= 19 ? volumes.slice(i - 19, i + 1).reduce((s, v) => s + v, 0) / 20 : null)
                  : volumes.map(() => null);
                const lastVol = volumes[volumes.length - 1];
                const lastAvg = avg20.filter(v => v != null).pop();
                const volRatio = lastAvg ? (lastVol / lastAvg).toFixed(2) : null;
                const volData = {
                  labels,
                  datasets: [
                    { type: 'bar', label: 'Volume', data: volumes, backgroundColor: volColors, borderWidth: 0, borderRadius: 1, barPercentage: 0.85 },
                    { type: 'line', label: 'Avg 20d', data: avg20, borderColor: '#f59e0b', borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false }
                  ]
                };
                return (
                  <GlassCard style={{ marginTop: '1rem', marginBottom: '1.5rem', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#fff', letterSpacing: '0.08em' }}>WOLUMEN</span>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        <span>Last: <strong style={{ color: '#fff' }}>{lastVol ? (lastVol / 1e6).toFixed(1) + 'M' : '—'}</strong></span>
                        <span>Avg 20d: <strong style={{ color: '#f59e0b' }}>{lastAvg ? (lastAvg / 1e6).toFixed(1) + 'M' : '—'}</strong></span>
                        {volRatio && <span>Ratio: <strong style={{ color: parseFloat(volRatio) > 1.5 ? 'var(--accent-green)' : parseFloat(volRatio) < 0.7 ? 'var(--accent-red)' : '#fff' }}>{volRatio}x</strong></span>}
                      </div>
                    </div>
                    <div style={{ height: '120px' }}>
                      <Line data={volData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, backgroundColor: 'rgba(11,15,25,0.95)', callbacks: { label: ctx => ctx.dataset.type === 'bar' ? `Vol: ${(ctx.raw / 1e6).toFixed(2)}M` : `Avg: ${(ctx.raw / 1e6).toFixed(2)}M` } } }, scales: { x: { display: false }, y: { position: 'right', grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }, ticks: { color: '#64748b', font: { size: 9 }, callback: v => (v / 1e6).toFixed(0) + 'M' }, border: { display: false } } } }} />
                    </div>
                  </GlassCard>
                );
              })()}

              {/* === CONSENSUS BANNER === */}
              {data.analysis?.quant_analysis?.recommendation && (() => {
                const rec = data.analysis.quant_analysis.recommendation;
                const score = data.composite_score ?? 50;
                const conf = data.analysis.quant_analysis.confidence_level || '';
                const recColor = rec === 'LONG' ? 'var(--accent-green)' : rec === 'SHORT' ? 'var(--accent-red)' : '#f59e0b';
                const recBg = rec === 'LONG' ? 'rgba(16,185,129,0.06)' : rec === 'SHORT' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)';
                const recBorder = rec === 'LONG' ? 'rgba(16,185,129,0.25)' : rec === 'SHORT' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)';
                const recIcon = rec === 'LONG' ? '↑' : rec === 'SHORT' ? '↓' : '→';
                const scoreBarWidth = Math.max(5, Math.min(100, score));
                const bd = data.scoring_breakdown || {};
                const setupColors = { TREND: 'var(--accent-blue)', REVERSAL: 'var(--accent-red)', PULLBACK: '#f59e0b', RANGE: '#94a3b8', BREAKOUT: 'var(--accent-purple)' };
                const setupCol = setupColors[data.setup_type] || 'var(--text-muted)';
                const ScoreBar = ({ label, value }) => {
                  const barCol = value > 60 ? '#00e5a0' : value > 40 ? '#ffb020' : '#ff4d6a';
                  const glowCol = value > 60 ? 'rgba(0,229,160,0.4)' : value > 40 ? 'rgba(255,176,32,0.4)' : 'rgba(255,77,106,0.4)';
                  return (
                    <div style={{ flex: 1, minWidth: '90px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: barCol }}>{value ?? '—'}</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.12)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${value ?? 0}%`, height: '100%', background: barCol, borderRadius: '3px', transition: 'width 0.6s ease', boxShadow: `0 0 8px ${glowCol}` }} />
                      </div>
                    </div>
                  );
                };
                return (
                  <div className="consensus-banner" style={{ background: recBg, border: `1px solid ${recBorder}`, borderRadius: '16px', padding: '1.5rem 2rem', marginTop: '2.5rem', marginBottom: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: recColor }} />
                    {data.generated_at && (
                      <div style={{ position: 'absolute', top: '8px', right: '12px', fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                        {new Date(data.generated_at).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ fontSize: '2rem', lineHeight: 1, color: recColor }}>{recIcon}</span>
                          <div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '2px' }}>CONSENSUS</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: recColor, letterSpacing: '2px', lineHeight: 1 }}>{rec}</div>
                          </div>
                        </div>
                        <div style={{ width: '1px', height: '3rem', background: 'rgba(255,255,255,0.08)' }} />
                        <div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '4px' }}>COMPOSITE SCORE</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: recColor, lineHeight: 1 }}>{score}<span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>/100</span></div>
                          <div style={{ width: '80px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
                            <div style={{ width: `${scoreBarWidth}%`, height: '100%', background: recColor, borderRadius: '2px', transition: 'width 0.8s ease' }} />
                          </div>
                          {data.bull_score != null && data.bear_score != null && (
                            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              <span style={{ color: 'var(--accent-green)' }}>{data.bull_score}</span> vs <span style={{ color: 'var(--accent-red)' }}>{data.bear_score}</span> pkt
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '3px' }}>PEWNOŚĆ</div>
                          <div style={{ fontSize: '0.9rem', color: conf === 'WYSOKA' ? 'var(--accent-green)' : conf === 'NISKA' ? 'var(--accent-red)' : '#f59e0b', fontWeight: 700 }}>{conf || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '3px' }}>TYP SETUPU</div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: setupCol }}>{data.setup_type || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '3px' }}>TREND</div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{data.quant_stats?.trend || '—'}</div>
                        </div>
                      </div>
                    </div>
                    {data.setup_warning && (
                      <div style={{ marginTop: '0.8rem', padding: '6px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontSize: '0.72rem', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} /> {data.setup_warning}
                      </div>
                    )}
                    {Object.keys(bd).length > 0 && (
                      <div style={{ marginTop: '1rem' }}>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          <ScoreBar label="TREND" value={bd.trend} />
                          <ScoreBar label="MOMENTUM" value={bd.momentum} />
                          <ScoreBar label="VOLATILITY" value={bd.volatility} />
                          <ScoreBar label="SENTIMENT" value={bd.sentiment} />
                        </div>
                        {bd.weighted_scores && (
                          <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '6px', fontWeight: 600 }}>SCORE BREAKDOWN — skąd pochodzi {score}/100</div>
                            <div style={{ display: 'flex', gap: '0', height: '14px', borderRadius: '7px', overflow: 'hidden' }}>
                              {[
                                { key: 'trend', label: 'Trend', color: '#3b82f6' },
                                { key: 'momentum', label: 'Momentum', color: '#00e5a0' },
                                { key: 'volatility', label: 'Volatility', color: '#f59e0b' },
                                { key: 'sentiment', label: 'Sentyment', color: '#a78bfa' },
                              ].map(({ key, color }) => {
                                const w = bd.weighted_scores[key] || 0;
                                const pct = bd.weighted_total > 0 ? (w / bd.weighted_total * 100) : 25;
                                return <div key={key} style={{ width: `${pct}%`, background: color, minWidth: pct > 0 ? '4px' : 0, transition: 'width 0.6s ease' }} title={`${key}: ${w}pts`} />;
                              })}
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '5px', flexWrap: 'wrap' }}>
                              {[
                                { key: 'trend', label: 'Trend', color: '#3b82f6', weight: '40%' },
                                { key: 'momentum', label: 'Momentum', color: '#00e5a0', weight: '30%' },
                                { key: 'volatility', label: 'Volatility', color: '#f59e0b', weight: '20%' },
                                { key: 'sentiment', label: 'Sentyment', color: '#a78bfa', weight: '10%' },
                              ].map(({ key, label, color, weight }) => (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
                                  <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                                  <span style={{ fontSize: '0.62rem', fontWeight: 700, color }}>{bd.weighted_scores[key] ?? 0}</span>
                                  <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>({weight})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* SEKCJA ANALIZY QUANT I GLOBAL DATA */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>

                {/* Kolumna Lewa: Quant + Global */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {data.analysis?.quant_analysis && (() => {
                    const rec = data.analysis.quant_analysis.recommendation;
                    const recColor = rec === 'LONG' ? 'var(--accent-green)' : rec === 'SHORT' ? 'var(--accent-red)' : '#f59e0b';
                    const recBg = rec === 'LONG' ? 'rgba(16,185,129,0.12)' : rec === 'SHORT' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)';
                    return (
                    <GlassCard style={{ borderTop: `3px solid ${recColor}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 className="card-title" style={{ color: '#fff', margin: 0 }}>
                          <Target size={18} color={recColor} /> Quant Analysis
                        </h3>
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: recColor, background: recBg, border: `1px solid ${recColor}`, padding: '3px 14px', borderRadius: '6px', letterSpacing: '0.08em' }}>{rec}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.7rem', borderRadius: '8px' }}>
                          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>MIKRO TREND</div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>{data.analysis.quant_analysis.micro_trend}</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.7rem', borderRadius: '8px' }}>
                          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>MAKRO TREND</div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>{data.analysis.quant_analysis.macro_trend}</div>
                        </div>
                      </div>
                      <div style={{ background: 'rgba(139,92,246,0.06)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.18)', marginBottom: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div style={{ fontSize: '0.62rem', color: 'var(--accent-purple)', fontWeight: 700, letterSpacing: '0.08em' }}>TRADE SETUP</div>
                          {data.analysis.computed_rr != null && (
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: data.analysis.computed_rr >= 2 ? 'var(--accent-green)' : data.analysis.computed_rr >= 1 ? '#f59e0b' : 'var(--accent-red)', background: data.analysis.computed_rr >= 2 ? 'rgba(16,185,129,0.12)' : data.analysis.computed_rr >= 1 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)', padding: '2px 8px', borderRadius: '4px' }}>
                              R:R 1:{Number(data.analysis.computed_rr).toFixed(1)}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                          <div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '2px' }}>ENTRY</div>
                            <div style={{ fontSize: '0.88rem', color: 'var(--accent-green)', fontWeight: 700 }}>{data.analysis.quant_analysis.entry_target}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '2px' }}>STOP LOSS</div>
                            <div style={{ fontSize: '0.88rem', color: 'var(--accent-red)', fontWeight: 700 }}>{data.analysis.quant_analysis.stop_loss}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '2px' }}>TAKE PROFIT</div>
                            <div style={{ fontSize: '0.88rem', color: 'var(--accent-blue)', fontWeight: 700 }}>{data.analysis.quant_analysis.take_profit}</div>
                          </div>
                        </div>
                        {(data.analysis.computed_rr != null || data.analysis.quant_analysis.probability_long) && (
                          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.6rem', padding: '0.5rem 0.7rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', alignItems: 'center' }}>
                            {data.analysis.computed_rr != null && (() => {
                              const rr = Number(data.analysis.computed_rr);
                              const rrColor = rr >= 2.0 ? 'var(--accent-green)' : rr >= 1.5 ? '#00e5a0' : rr >= 1.0 ? '#f59e0b' : 'var(--accent-red)';
                              const rrLabel = rr >= 3.0 ? 'WYBITNY' : rr >= 2.0 ? 'ATRAKCYJNY' : rr >= 1.5 ? 'KORZYSTNY' : rr >= 1.0 ? 'AKCEPTOWALNY' : 'NIEKORZYSTNY';
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>R:R</div>
                                  <div style={{ fontSize: '1rem', fontWeight: 800, color: rrColor }}>1:{rr.toFixed(1)}</div>
                                  <div style={{ fontSize: '0.55rem', color: rrColor, fontWeight: 600, background: `${rrColor}15`, padding: '1px 6px', borderRadius: '3px' }}>{rrLabel}</div>
                                </div>
                              );
                            })()}
                            {data.analysis.quant_analysis.probability_long != null && data.analysis.quant_analysis.probability_short != null && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                                <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>PROB</div>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-green)' }}>▲{data.analysis.quant_analysis.probability_long}%</span>
                                  <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>/</span>
                                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-red)' }}>▼{data.analysis.quant_analysis.probability_short}%</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                        {data.analysis.quant_analysis.take_profit_analysis}
                      </p>
                      {data.analysis.rr_warning && (
                        <div style={{ marginTop: '10px', padding: '8px 12px', background: data.analysis.computed_rr < 1.0 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${data.analysis.computed_rr < 1.0 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <AlertTriangle size={16} color={data.analysis.computed_rr < 1.0 ? 'var(--accent-red)' : '#f59e0b'} style={{ flexShrink: 0, marginTop: '1px' }} />
                          <span style={{ fontSize: '0.75rem', color: data.analysis.computed_rr < 1.0 ? 'var(--accent-red)' : '#f59e0b', lineHeight: 1.45, fontWeight: 600 }}>
                            {data.analysis.rr_warning}
                          </span>
                        </div>
                      )}
                    </GlassCard>
                    );
                  })()}

                  {data.analysis?.global_data && (
                    <GlassCard style={{ borderTop: '3px solid #f59e0b' }}>
                      <h3 className="card-title" style={{ color: '#fff', marginBottom: '1rem' }}>
                        <Activity size={18} color="#f59e0b" /> Global Data & Fundamentals
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        {[
                          { label: 'BIEŻĄCY STATUS', val: data.analysis.global_data.current_status },
                          { label: 'PROGNOZA (1 MC)', val: data.analysis.global_data.future_outlook },
                          { label: 'SENTYMENT ELIT & PŁYNNOŚĆ', val: data.analysis.global_data.elite_view },
                          { label: 'PROFIL DYWIDENDOWY', val: data.analysis.global_data.dividend_trend },
                          { label: 'ZAINTERESOWANIE PUBLICZNE', val: data.analysis.global_data.sex_appeal },
                        ].map(({ label, val }) => (
                          <div key={label} style={{ padding: '0.65rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.6rem', color: '#f59e0b', fontWeight: 700, letterSpacing: '0.07em', marginBottom: '0.2rem' }}>{label}</div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{val}</div>
                          </div>
                        ))}
                        <div style={{ paddingTop: '0.8rem', marginTop: '0.2rem' }}>
                          <div style={{ fontSize: '0.62rem', color: '#fff', fontWeight: 700, letterSpacing: '0.07em', marginBottom: '0.3rem' }}>TWARDY KIERUNEK</div>
                          <div style={{ fontSize: '0.88rem', color: '#fff', lineHeight: 1.5 }}>{data.analysis.global_data.final_direction}</div>
                        </div>
                      </div>
                    </GlassCard>
                  )}

                  {data.fundamentals && (
                    <FundamentalsPanel fundamentals={data.fundamentals} relativeStrength={data.relative_strength} />
                  )}
                </div>

                {/* Kolumna Prawa: Skan Główny (AI) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <GlassCard style={{ borderTop: '3px solid var(--accent-purple)', height: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 className="card-title" style={{ color: '#fff', margin: 0 }}>
                        <BrainCircuit size={18} color="var(--accent-purple)" /> Skan Główny (AI)
                      </h3>
                      {data.analysis?.sentiment_score != null && (() => {
                        const s = data.analysis.sentiment_score;
                        const sColor = s > 60 ? 'var(--accent-green)' : s > 40 ? '#f59e0b' : 'var(--accent-red)';
                        const sLabel = s > 60 ? 'BYK' : s > 40 ? 'NEUTRALNY' : 'NIEDŹWIEDŹ';
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '4px 12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: sColor }} />
                            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: sColor }}>{s}</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{sLabel}</span>
                          </div>
                        );
                      })()}
                    </div>
                    {data.analysis?.summary?.split('\n\n').map((para, i, arr) => (
                      <p key={i} className="summary-text" style={{ marginBottom: i < arr.length - 1 ? '0.9rem' : 0, lineHeight: 1.65 }}>{para}</p>
                    ))}
                  </GlassCard>
                </div>
              </div>

              {/* BULL / BEAR CASE */}
              {(data.analysis?.bull_case?.length > 0 || data.analysis?.bear_case?.length > 0) && (() => {
                const rec = data.analysis?.quant_analysis?.recommendation;
                const bullStrong = rec === 'LONG';
                const bearStrong = rec === 'SHORT';
                return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  {data.analysis?.bull_case?.length > 0 && (
                    <GlassCard style={{ borderTop: '3px solid var(--accent-green)', background: bullStrong ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.02)', opacity: bearStrong ? 0.7 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                        <h3 className="card-title" style={{ color: 'var(--accent-green)', margin: 0, fontSize: '1rem' }}>
                          <TrendingUp size={16} style={{ marginRight: '6px' }} /> Bull Case
                        </h3>
                        {bullStrong && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent-green)', background: 'rgba(16,185,129,0.15)', padding: '2px 8px', borderRadius: '4px', letterSpacing: '0.06em' }}>DOMINANT</span>}
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {data.analysis.bull_case.map((pt, i) => (
                          <li key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px', lineHeight: 1.5, padding: '6px 8px', background: 'rgba(16,185,129,0.04)', borderRadius: '6px', borderLeft: '2px solid rgba(16,185,129,0.3)' }}>
                            <span style={{ color: 'var(--accent-green)', flexShrink: 0, marginTop: '1px', fontWeight: 700 }}>+</span>{pt}
                          </li>
                        ))}
                      </ul>
                    </GlassCard>
                  )}
                  {data.analysis?.bear_case?.length > 0 && (
                    <GlassCard style={{ borderTop: '3px solid var(--accent-red)', background: bearStrong ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.02)', opacity: bullStrong ? 0.7 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                        <h3 className="card-title" style={{ color: 'var(--accent-red)', margin: 0, fontSize: '1rem' }}>
                          <TrendingDown size={16} style={{ marginRight: '6px' }} /> Bear Case
                        </h3>
                        {bearStrong && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent-red)', background: 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: '4px', letterSpacing: '0.06em' }}>DOMINANT</span>}
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {data.analysis.bear_case.map((pt, i) => (
                          <li key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px', lineHeight: 1.5, padding: '6px 8px', background: 'rgba(239,68,68,0.04)', borderRadius: '6px', borderLeft: '2px solid rgba(239,68,68,0.3)' }}>
                            <span style={{ color: 'var(--accent-red)', flexShrink: 0, marginTop: '1px', fontWeight: 700 }}>-</span>{pt}
                          </li>
                        ))}
                      </ul>
                    </GlassCard>
                  )}
                </div>
                );
              })()}


              {/* TREND ALIGNMENT MATRIX */}
              <TrendMatrix matrix={data.chart_series?.trend_matrix} />

              <h3 ref={anomalyRef} className="section-title" style={{ scrollMarginTop: '80px' }}>
                <Calendar color="var(--accent-purple)" size={24} />
                Kalendarium Anomalii ({timeframe})
              </h3>

              <div className="anomalies-list" style={{ display: 'flex', justifyContent: 'center' }}>
                {!expandedDay ? (
                  <div style={{ width: '100%' }}>
                    {data.volatile_days?.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Top 5 dni o największej zmienności — kliknij wykres, by zobaczyć szczegóły dowolnego dnia:</div>
                        {data.volatile_days.slice(0, 5).map((v, i) => (
                          <div key={i} onClick={() => expandDay(v.date)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)', transition: 'border-color 0.2s' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{v.date}</span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: v.pct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{v.pct >= 0 ? '+' : ''}{v.pct.toFixed(2)}%</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>
                        <p>Kliknij na dany dzień na wykresie powyżej, aby wygenerować raport dla tamtego dnia.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  (() => {
                    const hIdx = data.history.findIndex(h => new Date(h.t).toISOString().split('T')[0] === expandedDay);
                    if (hIdx === -1) return null;
                    const anom = data.analysis?.anomalies?.find(a => a.date === expandedDay);
                    let pct = 0;
                    if (hIdx > 0) {
                      const prevC = data.history[hIdx - 1].c;
                      const currC = data.history[hIdx].c;
                      pct = ((currC - prevC) / prevC) * 100;
                    }
                    const isMinor = Math.abs(pct) < 1.0;
                    const defaultNote = isMinor
                      ? `Ruch w tym dniu był znikomy (${pct > 0 ? '+' : ''}${pct.toFixed(2)}%). Cena poruszała się w ramach standardowego giełdowego szumu rynkowego.`
                      : `Zanotowano zmianę ceny równą ${pct > 0 ? '+' : ''}${pct.toFixed(2)}%. AI uznało go za wtórny efekt techniczny lub echo sentymentu całego sektora.`;
                    return (
                      <GlassCard className="anomaly-card" style={{ width: '100%' }}>
                        <div className="anomaly-header" style={{ cursor: 'default' }}>
                          <div className="anomaly-info">
                            <div className="anomaly-date">Wybrano: {expandedDay}</div>
                            <span className="anomaly-desc">{anom ? anom.short_desc : (isMinor ? 'Naturalny szum giełdowy' : 'Korekta techniczna / Sektorowa')}</span>
                          </div>
                          <div className="anomaly-action" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: pct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                          </div>
                        </div>
                        <div className="anomaly-expanded">
                          <div className="ai-stream-row">
                            <Bot color="var(--accent-purple)" size={28} style={{ marginTop: '4px', flexShrink: 0 }} />
                            <div className="ai-stream-text">
                              <div style={{ marginBottom: '10px' }}>{anom ? anom.details : defaultNote}</div>
                              {anom?.url && (
                                <a href={anom.url} target="_blank" rel="noreferrer" className="source-link-btn">
                                  <ExternalLink size={14} /> Czytaj źródło
                                </a>
                              )}
                              {dayArticles && dayArticles.length > 0 && (
                                <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', borderLeft: '3px solid var(--accent-blue)' }}>
                                  <h4 style={{ marginTop: 0, marginBottom: '10px', fontSize: '0.9rem', color: 'var(--accent-blue)' }}>Zebrane na celowniku ({dayArticles.length}):</h4>
                                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {dayArticles.map((art, i) => (
                                      <li key={i} style={{ fontSize: '0.85rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                          <span style={{ color: '#94a3b8', marginTop: '2px' }}>•</span>
                                          <div>
                                            <span style={{ fontWeight: '600', color: '#e2e8f0' }}>{art.headline}</span>
                                            {art.url && <a href={art.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-purple)', marginLeft: '6px', textDecoration: 'none' }}><ExternalLink size={12} /></a>}
                                          </div>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {deepDiveDay !== expandedDay && (
                                <button onClick={() => generateDeepDive(expandedDay)} className="tf-btn" style={{ marginTop: '10px', width: '100%' }}>
                                  🤖 Głęboka Analiza Quantum (Gemma 4)
                                </button>
                              )}
                              {deepDiveDay === expandedDay && (
                                <div style={{ marginTop: '15px', padding: '15px', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '8px', borderLeft: '3px solid var(--accent-purple)' }}>
                                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--accent-purple)' }}>SZCZEGÓŁOWY RAPORT QUANTUM:</h4>
                                  {dayLoading && !dayStreamText && <span style={{ color: 'var(--text-muted)' }}>Inicjalizacja śledztwa AI...</span>}
                                  {dayStreamText}
                                  {dayLoading && dayStreamText && <span className="loading-pulse" />}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </GlassCard>
                    );
                  })()
                )}
              </div>

            </div>

          </div>
          </ErrorBoundary>
        )}
      </main>
      </div>
      <Footer />
    </>
  );
}