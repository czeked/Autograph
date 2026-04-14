import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler, Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  Search, TrendingUp, TrendingDown, Activity, ChevronDown, ChevronUp, Bot, BrainCircuit, Target, AlertTriangle, Calendar, Radar, ExternalLink, Zap
} from 'lucide-react';


import zoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler, Legend, zoomPlugin);

// --- KOMPONENTY POMOCNICZE UI ---

const GlassCard = ({ children, className = "" }) => (
  <div className={`glass-panel ${className}`}>
    {children}
  </div>
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

// --- GŁÓWNA APLIKACJA ---

export default function AiAnalyzer() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [symbol, setSymbol] = useState('');

  const [timeframe, setTimeframe] = useState('1M');
  const timeframes = ['1W', '1M', '3M', '6M', '1Y'];

  const [userEntry, setUserEntry] = useState('');
  const [userSL, setUserSL] = useState('');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [expandedDay, setExpandedDay] = useState(null);
  const [deepDiveDay, setDeepDiveDay] = useState(null);
  const [dayStreamText, setDayStreamText] = useState('');
  const [dayLoading, setDayLoading] = useState(false);
  const [dayArticles, setDayArticles] = useState([]);
  const [articlesLoading, setArticlesLoading] = useState(false);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      axios.get(`http://localhost:3001/api/search?q=${query}`)
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
      const response = await axios.post('http://localhost:3001/api/analyze', {
        ticker: tickerToFetch,
        timeframe: '1Y',
        entryPrice: userEntry || null,
        stopLoss: userSL || null
      });
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
      const response = await fetch('http://localhost:3001/api/analyze-day', {
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
            } catch (e) { }
          }
        }
      }
    } catch (e) {
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

  const getFilteredHistory = () => {
    if (!data?.history) return [];
    let days = 365;
    if (timeframe === '1W') days = 7;
    if (timeframe === '1M') days = 30;
    if (timeframe === '3M') days = 90;
    if (timeframe === '6M') days = 180;
    if (timeframe === '1Y') days = 365;

    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - days);
    return data.history.filter(h => new Date(h.t).getTime() >= limitDate.getTime());
  };

  const getChartData = () => {
    const historySlice = getFilteredHistory();
    if (!historySlice.length) return null;

    const anomalyDates = new Set(data.analysis?.anomalies?.map(a => a.date) || []);
    // volatile_days = top 40 dni z największym ruchem cenowym (z backendu, pure matematyka)
    const volatileDatesSet = new Set((data.volatile_days || []).map(v => v.date));
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
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    onClick: (event, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const h = getFilteredHistory()[idx];
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
            const h = getFilteredHistory()[idx];
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
    <div className="app-container">

      <header className="header-nav">
        <div className="brand">
          <BrainCircuit color="var(--accent-blue)" size={32} />
          <h1>Autograph <span>4.0</span></h1>
        </div>

        <div className="search-container">
          <div className="search-input-wrapper">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              className="search-input"
              placeholder="Szukaj rynków (np. AAPL, NVDA)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="number"
            placeholder="Twój Entry Price ($)"
            className="search-input"
            style={{ width: '160px', fontSize: '0.8rem' }}
            value={userEntry}
            onChange={(e) => setUserEntry(e.target.value)}
          />
          <input
            type="number"
            placeholder="Twój Stop Loss ($)"
            className="search-input"
            style={{ width: '160px', fontSize: '0.8rem' }}
            value={userSL}
            onChange={(e) => setUserSL(e.target.value)}
          />
        </div>
      </header>

      <main className="main-content">

        {!data && !loading && !error && (
          <div className="empty-state">
            <Target size={64} color="var(--text-muted)" />
            <h2>Wybierz aktywo, aby rozpocząć.</h2>
            <p>System pobierze historię bazową, a algorytm wygeneruje wnioski AI pod Twoje ramy czasowe.</p>
          </div>
        )}

        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p className="loading-text">Trwa praca Quant AI...</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <AlertTriangle size={64} color="var(--accent-red)" style={{ marginBottom: '1rem' }} />
            <h2 style={{ color: 'var(--accent-red)' }}>{error}</h2>
          </div>
        )}

        {data && !loading && (
          <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>

            {/* LEWA STRONA (Wykres, Anomalie) */}
            <div className="main-panel">

              <div className="asset-header">
                <div>
                  <h2 className="asset-title">{data.ticker}</h2>
                  <div className="asset-price-row">
                    {(() => {
                      const filtered = getFilteredHistory();
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

              <GlassCard className="chart-container">
                <Line data={getChartData()} options={chartOptions} />
              </GlassCard>

              {/* SEKCJJA ANALIZY QUANT I GLOBAL DATA */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', marginTop: '2.5rem', marginBottom: '1rem' }}>

                {/* Kolumna Lewa: Quant + Global */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {data.analysis?.quant_analysis && (
                    <GlassCard style={{ borderTop: '4px solid var(--accent-blue)' }}>
                      <h3 className="card-title" style={{ color: '#fff', marginBottom: '1rem' }}>
                        <Target size={20} color="var(--accent-blue)" /> Quant Analysis
                      </h3>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1rem' }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>REKOMENDACJA</span>
                          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: data.analysis.quant_analysis.recommendation === 'LONG' ? 'var(--accent-green)' : (data.analysis.quant_analysis.recommendation === 'SHORT' ? 'var(--accent-red)' : 'var(--text-secondary)'), marginTop: '0.2rem' }}>
                            {data.analysis.quant_analysis.recommendation}
                          </div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PRAWDOPODOBIEŃSTWO</span>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                            <span style={{ color: 'var(--accent-green)' }}>L: {data.analysis.quant_analysis.probability_long}</span> / <span style={{ color: 'var(--accent-red)' }}>S: {data.analysis.quant_analysis.probability_short}</span>
                          </div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>MIKRO TREND</span>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                            {data.analysis.quant_analysis.micro_trend}
                          </div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>MAKRO TREND</span>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                            {data.analysis.quant_analysis.macro_trend}
                          </div>
                        </div>
                      </div>

                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--accent-purple)', marginBottom: '0.8rem' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--accent-purple)', margin: '0 0 0.4rem 0', fontWeight: 'bold' }}>TRADE SETUP</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.3rem 0' }}><strong>Entry:</strong> {data.analysis.quant_analysis.entry_target}</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0' }}><strong>Stop Loss:</strong> {data.analysis.quant_analysis.stop_loss}</p>
                      </div>

                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        <strong style={{ color: '#fff' }}>PnL Analysis:</strong> {data.analysis.quant_analysis.take_profit_analysis}
                      </p>
                    </GlassCard>
                  )}

                  {data.analysis?.global_data && (
                    <GlassCard style={{ borderTop: '4px solid #f59e0b' }}>
                      <h3 className="card-title" style={{ color: '#fff', marginBottom: '1rem' }}>
                        <Activity size={20} color="#f59e0b" /> Global Data & Fundamentals
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        <div>
                          <p style={{ fontSize: '0.7rem', color: '#f59e0b', margin: '0 0 0.2rem 0', fontWeight: 'bold' }}>BIEŻĄCY STATUS</p>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0', lineHeight: '1.4' }}>{data.analysis.global_data.current_status}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '0.7rem', color: '#f59e0b', margin: '0 0 0.2rem 0', fontWeight: 'bold' }}>PROGNOZA (1 MC)</p>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0', lineHeight: '1.4' }}>{data.analysis.global_data.future_outlook}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '0.7rem', color: '#f59e0b', margin: '0 0 0.2rem 0', fontWeight: 'bold' }}>SENTYMENT ELIT & PŁYNNOŚĆ</p>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0', lineHeight: '1.4' }}>{data.analysis.global_data.elite_view}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '0.7rem', color: '#f59e0b', margin: '0 0 0.2rem 0', fontWeight: 'bold' }}>PROFIL DYWIDENDOWY</p>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0', lineHeight: '1.4' }}>{data.analysis.global_data.dividend_trend}</p>
                        </div>
                        <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                          <p style={{ fontSize: '0.7rem', color: '#f59e0b', margin: '0 0 0.2rem 0', fontWeight: 'bold' }}>ZAINTERESOWANIE PUBLICZNE (SEX APPEAL)</p>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0', lineHeight: '1.4' }}>{data.analysis.global_data.sex_appeal}</p>
                        </div>
                        <div style={{ marginTop: '0.5rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                          <p style={{ fontSize: '0.7rem', color: '#fff', margin: '0 0 0.4rem 0', fontWeight: 'bold' }}>TWARDY KIERUNEK</p>
                          <p style={{ fontSize: '0.9rem', color: '#fff', margin: '0', lineHeight: '1.5' }}>{data.analysis.global_data.final_direction}</p>
                        </div>
                      </div>
                    </GlassCard>
                  )}
                </div>

                {/* Kolumna Prawa: Skan Główny (AI) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <GlassCard style={{ borderTop: '4px solid var(--accent-purple)', height: '100%' }}>
                    <h3 className="card-title" style={{ color: '#fff' }}>Skan Główny (AI)</h3>
                    {data.analysis?.summary?.split('\n\n').map((para, i) => (
                      <p key={i} className="summary-text" style={{ marginBottom: i < data.analysis?.summary.split('\n\n').length - 1 ? '0.85rem' : 0 }}>{para}</p>
                    ))}
                  </GlassCard>
                </div>
              </div>

              <h3 className="section-title">
                <Calendar color="var(--accent-purple)" size={24} />
                Kalendarium Anomalii ({timeframe})
              </h3>

              <div className="anomalies-list" style={{ display: 'flex', justifyContent: 'center' }}>
                {!expandedDay ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px', width: '100%' }}>
                    <p>Kliknij na dany dzień na wykresie powyżej, aby wygenerować raport dla tamtego dnia.</p>
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
                      ? `Ruch w tym dniu był znikomy (${pct > 0 ? '+' : ''}${pct.toFixed(2)}%). Cena poruszała się w ramach standardowego giełdowego szumu rynkowego, a modele AI nie wykryły gigantycznych wahań powiązanych z przepływem informacji.`
                      : `Zanotowano zmianę ceny równą ${pct > 0 ? '+' : ''}${pct.toFixed(2)}%. Ponieważ jednak ruch ten nie skorelował się z najważniejszymi nagłówkami newsów w całej osi czasu, AI uznało go za wtórny efekt techniczny lub echo sentymentu całego sektora.`;

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
                                <a
                                  href={anom.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="source-link-btn"
                                >
                                  <ExternalLink size={14} /> Czytaj źródło
                                </a>
                              )}
                              {/* SEKCJA ZGROMADZONYCH ARTYKUŁÓW */}
                              {dayArticles && dayArticles.length > 0 && (
                                <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', borderLeft: '3px solid var(--accent-blue)' }}>
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
        )}
      </main>
    </div>
  );
}