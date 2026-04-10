import { useState, useEffect } from 'react';
import './NewsPage.css';

function NewsPage() {
  const [newsData, setNewsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTicker, setSelectedTicker] = useState('BTC');
  const [filterImportance, setFilterImportance] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [expandedNews, setExpandedNews] = useState(null);

  const cryptoList = [
    'BTC', 'ETH', 'ADA', 'DOGE', 'SOL', 'XRP', 'BNB', 'LTC', 
    'BCH', 'LINK', 'AVAX', 'MATIC', 'UNI', 'SHIB', 'ATOM', 'NEAR',
    'POLKA', 'DOT', 'ICP', 'ARB', 'OP', 'PEPE', 'FLOKI', 'MEME',
    'WIF', 'BONK', 'JUP', 'SAGA', 'GMX', 'BLUR'
  ];

  useEffect(() => {
    fetchNews(selectedTicker);
  }, [selectedTicker]);

  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🔄 Auto-refresh wiadomości...');
      fetchNews(selectedTicker);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [selectedTicker]);

  const fetchNews = async (ticker) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`http://localhost:3000/api/news?ticker=${ticker}`);
      const data = await res.json();

      if (data && data.newsByDay) {
        setNewsData(data.newsByDay);
      } else {
        setError('Brak wiadomości');
      }
    } catch (err) {
      setError(`Błąd: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filterArticles = (articles) => {
    let filtered = articles;

    if (filterImportance !== 'all') {
      if (filterImportance === 'high') {
        filtered = filtered.filter(a => a.importance >= 6);
      } else if (filterImportance === 'important') {
        filtered = filtered.filter(a => a.isImportant);
      }
    }

    if (sortBy === 'importance') {
      filtered = filtered.sort((a, b) => b.importance - a.importance);
    } else if (sortBy === 'sentiment') {
      filtered = filtered.sort((a, b) => {
        const sentimentOrder = { 'POZYTYWNA 📈': 1, 'NEUTRALNA ➡️': 0, 'NEGATYWNA 📉': -1 };
        return (sentimentOrder[b.sentiment] || 0) - (sentimentOrder[a.sentiment] || 0);
      });
    }

    return filtered;
  };

  const allArticles = Object.values(newsData).flatMap(day => day.articles);
  const filteredArticles = filterArticles(allArticles);
  const totalArticles = allArticles.length;

  return (
    <div className="news-page-container">
      <div className="news-page-header">
        <h1>📰 Centrum Wiadomości Crypto</h1>
        <p>Aktualne wiadomości z Coinbase, NewsAPI i CryptoCompare</p>
        <p className="date-info">📅 Data: 10.04.2026</p>
      </div>

      <div className="news-page-card">
        <div className="news-controls">
          <div className="control-group">
            <label>🔍 Kryptowaluta:</label>
            <div className="ticker-buttons">
              {cryptoList.map(ticker => (
                <button
                  key={ticker}
                  onClick={() => setSelectedTicker(ticker)}
                  className={`ticker-btn ${selectedTicker === ticker ? 'active' : ''}`}
                >
                  {ticker}
                </button>
              ))}
            </div>
          </div>

          <div className="control-group">
            <label>⭐ Ważność:</label>
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filterImportance === 'all' ? 'active' : ''}`}
                onClick={() => setFilterImportance('all')}
              >
                Wszystkie ({totalArticles})
              </button>
              <button
                className={`filter-btn ${filterImportance === 'high' ? 'active' : ''}`}
                onClick={() => setFilterImportance('high')}
              >
                🔴 Krytyczne
              </button>
              <button
                className={`filter-btn ${filterImportance === 'important' ? 'active' : ''}`}
                onClick={() => setFilterImportance('important')}
              >
                ⭐ Ważne
              </button>
            </div>
          </div>

          <div className="control-group">
            <label>📊 Sortuj:</label>
            <div className="sort-buttons">
              <button
                className={`sort-btn ${sortBy === 'latest' ? 'active' : ''}`}
                onClick={() => setSortBy('latest')}
              >
                Najnowsze
              </button>
              <button
                className={`sort-btn ${sortBy === 'importance' ? 'active' : ''}`}
                onClick={() => setSortBy('importance')}
              >
                Ważność
              </button>
              <button
                className={`sort-btn ${sortBy === 'sentiment' ? 'active' : ''}`}
                onClick={() => setSortBy('sentiment')}
              >
                Sentyment
              </button>
            </div>
          </div>

          <button 
            className="refresh-btn"
            onClick={() => fetchNews(selectedTicker)}
            disabled={loading}
          >
            {loading ? '⏳ Ładowanie...' : '🔄 Odśwież'}
          </button>
        </div>

        {error && <div className="error-alert">{error}</div>}

        {loading && (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Pobieranie wiadomości...</p>
          </div>
        )}

        {!loading && filteredArticles.length > 0 && (
          <div className="news-container">
            <div className="news-stats">
              <span>📰 {filteredArticles.length} artykułów o {selectedTicker}</span>
              <span>📅 10.04.2026</span>
            </div>

            <div className="news-list">
              {filteredArticles.map((article) => (
                <div
                  key={article.id}
                  className={`news-card ${article.importance >= 6 ? 'high-importance' : ''} ${article.isNew ? 'new' : ''}`}
                >
                  <div className="news-card-header">
                    <div className="badges">
                      {article.isNew && <span className="badge new-badge">🆕 NOWA</span>}
                      <span className={`badge importance-badge importance-${getImportanceClass(article.importance)}`}>
                        {article.importanceLevel}
                      </span>
                      <span className={`badge sentiment-badge sentiment-${article.sentiment.includes('POZYTYWNA') ? 'positive' : article.sentiment.includes('NEGATYWNA') ? 'negative' : 'neutral'}`}>
                        {article.sentiment}
                      </span>
                      <span className="badge source-badge">{article.source}</span>
                    </div>
                  </div>

                  <h3>{article.title}</h3>

                  {article.image && (
                    <img src={article.image} alt={article.title} className="news-image" onError={(e) => e.target.style.display = 'none'} />
                  )}

                  <p className={`news-body ${expandedNews === article.id ? 'expanded' : 'collapsed'}`}>
                    {article.body}
                  </p>

                  {article.body.length > 150 && (
                    <button
                      className="expand-btn"
                      onClick={() => setExpandedNews(expandedNews === article.id ? null : article.id)}
                    >
                      {expandedNews === article.id ? '⬆️ Zwiń' : '⬇️ Czytaj więcej'}
                    </button>
                  )}

                  <div className="news-footer">
                    <small>🕐 {article.publishedString}</small>
                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="source-link">
                      🔗 Przejdź do artykułu
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && filteredArticles.length === 0 && (
          <div className="no-news">
            <p>📭 Brak wiadomości dla {selectedTicker}</p>
            <p className="text-muted">Spróbuj innej kryptowaluty lub odśwież stronę</p>
          </div>
        )}
      </div>

      <div className="news-footer-info">
        <h3>📡 Źródła wiadomości:</h3>
        <div className="sources-list">
          <div className="source-item">
            <strong>🔗 CryptoCompare News</strong>
            <p>https://min-api.cryptocompare.com/data/v2/news/</p>
            <p className="text-muted">Wiadomości z całego świata crypto w real-time</p>
          </div>
          <div className="source-item">
            <strong>🔗 NewsAPI</strong>
            <p>https://newsapi.org/v2/everything</p>
            <p className="text-muted">Artykuły z głównych serwisów informacyjnych</p>
          </div>
          <div className="source-item">
            <strong>🔗 CoinGecko News</strong>
            <p>https://api.coingecko.com/api/v3/coins/{'{id}'}/news</p>
            <p className="text-muted">Wiadomości bezpośrednio dla każdej kryptowaluty</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function getImportanceClass(importance) {
  if (importance >= 9) return 'critical';
  if (importance >= 6) return 'high';
  if (importance >= 3) return 'medium';
  return 'low';
}

export default NewsPage;