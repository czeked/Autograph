import { useState } from 'react';
import './AiAnalyzer.css';

function AiAnalyzer() {
  const [prompt, setPrompt] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [marketData, setMarketData] = useState(null);
  const [ticker, setTicker] = useState('');

  const askAI = async () => {
    if (!prompt.trim()) {
      setError('⚠️ Wpisz coś (np. "Analizuj BTC" lub "Czy warto kupić AAPL?")');
      return;
    }

    setLoading(true);
    setError('');
    setAnalysis('');
    setMarketData(null);

    try {
      const PORT = import.meta.env.VITE_BACKEND_PORT || 3000;
      console.log(`📡 Łączę się z http://localhost:${PORT}`);
      
      const res = await fetch(`http://localhost:${PORT}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAnalysis(data.analysis);
        setMarketData(data.marketData);
        setTicker(data.ticker);
      } else {
        setError(`❌ ${data.error || 'Nieznany błąd'}`);
      }
    } catch (err) {
      setError('❌ Nie udało się połączyć z backendem. Czy serwer jest włączony na porcie 3000?');
      console.error('Error:', err);
    }

    setLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      askAI();
    }
  };

  return (
    <div className="analyzer-container">
      <div className="analyzer-header">
        <h1>📈 Trading AI Assistant</h1>
        <p>Zaawansowana analiza techniczna z AI - RSI, SMA, EMA, Wsparcie/Opór</p>
      </div>

      <div className="analyzer-card">
        <div className="input-section">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Np. Analizuj BTC&#10;Lub: Czy warto kupić ETH?&#10;Lub: Daj mi analizę AAPL&#10;Lub: Sprawdź DOGE&#10;&#10;Ctrl+Enter aby wysłać"
            rows={5}
            className="input-textarea"
          />

          <button
            onClick={askAI}
            disabled={loading || !prompt.trim()}
            className={`submit-button ${loading ? 'loading' : ''}`}
          >
            {loading ? '⏳ AI analizuje...' : '🚀 Zapytaj AI'}
          </button>

          {error && <div className="error-message">{error}</div>}
        </div>

        {marketData && ticker && (
          <div className="market-data-summary">
            <h3>📊 Dane Rynkowe ({ticker})</h3>
            <div className="data-grid">
              <div className="data-item">
                <span className="label">Cena:</span>
                <span className="value">${marketData.price?.toFixed(2)}</span>
              </div>
              <div className="data-item">
                <span className="label">Zmiana:</span>
                <span className={`value ${marketData.changePercent > 0 ? 'positive' : 'negative'}`}>
                  {marketData.changePercent > 0 ? '📈 +' : '📉 '}{marketData.changePercent?.toFixed(2)}%
                </span>
              </div>
              <div className="data-item">
                <span className="label">RSI(14):</span>
                <span className={`value ${marketData.rsi > 70 ? 'overbought' : marketData.rsi < 30 ? 'oversold' : ''}`}>
                  {marketData.rsi?.toFixed(0)}
                </span>
              </div>
              <div className="data-item">
                <span className="label">SMA(20):</span>
                <span className="value">${marketData.sma20?.toFixed(2)}</span>
              </div>
              <div className="data-item">
                <span className="label">SMA(50):</span>
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
            </div>
          </div>
        )}

        {analysis && (
          <div className="analysis-result">
            <h2>📋 Analiza AI</h2>
            <div className="analysis-content">
              {analysis.split('\n').map((line, idx) => {
                if (!line.trim()) return <br key={idx} />;
                
                return (
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
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="footer">
        <p>💡 Obsługiwane tickery: BTC, ETH, ADA, DOGE, SOL, AAPL, MSFT, GOOGL, TSLA itp.</p>
        <p>⚡ Dane pobierane z Massive API • Analiza z Groq AI</p>
      </div>
    </div>
  );
}

export default AiAnalyzer;