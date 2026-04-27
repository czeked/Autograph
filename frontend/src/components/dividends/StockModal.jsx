export default function StockModal({ stock, analysis, aiLoading, news, onClose }) {
    if (!stock) return null;

    const fmt = (v) => {
        if (!v) return "N/A";
        if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
        if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
        if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
        return `$${v}`;
    };

    const scoreClass = stock.score >= 70 ? 'div-score-high' : stock.score >= 50 ? 'div-score-mid' : 'div-score-low';

    return (
        <div className="div-modal-overlay" onClick={onClose}>
            <div className="div-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="div-modal-close" onClick={onClose}>
                    <i className="fa-solid fa-xmark"></i>
                </button>

                {/* Nagłówek */}
                <div className="div-modal-header">
                    <div className="div-modal-icon">
                        <i className={stock.logo}></i>
                    </div>
                    <div>
                        <h2>{stock.ticker} <span className="div-modal-price">${stock.price.toFixed(2)}</span></h2>
                        <h3>{stock.name}</h3>
                        <span className="div-modal-sector">{stock.sectorPl} — {stock.industry}</span>
                    </div>
                </div>

                {/* Kafelki kluczowych danych — tej spółki */}
                <div className="div-stats-row div-modal-stats">
                    <div className="div-stat-card">
                        <i className="fa-solid fa-percent"></i>
                        <div>
                            <span className="div-stat-value div-highlight-green">{stock.dividendYield.toFixed(2)}%</span>
                            <span className="div-stat-label">Stopa dywidendy</span>
                        </div>
                    </div>
                    <div className="div-stat-card">
                        <i className="fa-solid fa-star"></i>
                        <div>
                            <span className={`div-stat-value ${scoreClass}`}>{stock.score || 0}/100</span>
                            <span className="div-stat-label">Score</span>
                        </div>
                    </div>
                    <div className="div-stat-card">
                        <i className="fa-solid fa-scale-balanced"></i>
                        <div>
                            <span className="div-stat-value">{stock.payoutRatio.toFixed(1)}%</span>
                            <span className="div-stat-label">Payout ratio</span>
                        </div>
                    </div>
                    <div className="div-stat-card">
                        <i className="fa-solid fa-calculator"></i>
                        <div>
                            <span className="div-stat-value">{stock.peRatio > 0 ? stock.peRatio.toFixed(1) : "N/A"}</span>
                            <span className="div-stat-label">P/E Ratio</span>
                        </div>
                    </div>
                    <div className="div-stat-card">
                        <i className="fa-solid fa-chart-line"></i>
                        <div>
                            <span className="div-stat-value">{stock.roe.toFixed(1)}%</span>
                            <span className="div-stat-label">ROE</span>
                        </div>
                    </div>
                    <div className="div-stat-card">
                        <i className="fa-solid fa-building-columns"></i>
                        <div>
                            <span className="div-stat-value">{fmt(stock.marketCap)}</span>
                            <span className="div-stat-label">Kapitalizacja</span>
                        </div>
                    </div>
                </div>

                <div className="div-modal-body">
                    {/* Kompaktowa tabela danych */}
                    <div className="div-modal-section">
                        <h4><i className="fa-solid fa-table-list"></i> Szczegóły spółki</h4>
                        <div className="div-detail-grid">
                            <div className="div-detail-item">
                                <span className="div-detail-label">Dywidenda / akcję</span>
                                <span className="div-detail-value">${stock.dividendPerShare.toFixed(2)}</span>
                            </div>
                            <div className="div-detail-item">
                                <span className="div-detail-label">5Y Śr. Yield</span>
                                <span className="div-detail-value">{stock.fiveYearAvgYield.toFixed(2)}%</span>
                            </div>
                            <div className="div-detail-item">
                                <span className="div-detail-label">Debt/Equity</span>
                                <span className="div-detail-value">{stock.debtToEquity.toFixed(2)}</span>
                            </div>
                            <div className="div-detail-item">
                                <span className="div-detail-label">Profit Margin</span>
                                <span className="div-detail-value">{stock.profitMargin.toFixed(1)}%</span>
                            </div>
                            <div className="div-detail-item">
                                <span className="div-detail-label">Earnings Growth</span>
                                <span className="div-detail-value">{stock.earningsGrowth.toFixed(1)}%</span>
                            </div>
                            <div className="div-detail-item">
                                <span className="div-detail-label">Beta</span>
                                <span className="div-detail-value">{stock.beta.toFixed(2)}</span>
                            </div>
                            <div className="div-detail-item">
                                <span className="div-detail-label">52W Range</span>
                                <span className="div-detail-value">${stock.fiftyTwoWeekLow} — ${stock.fiftyTwoWeekHigh}</span>
                            </div>
                            <div className="div-detail-item">
                                <span className="div-detail-label">Giełda</span>
                                <span className="div-detail-value">{stock.exchange}</span>
                            </div>
                        </div>
                    </div>

                    {/* Wiadomości */}
                    {news && news.length > 0 && (
                        <div className="div-modal-section div-news-section">
                            <h4><i className="fa-solid fa-newspaper"></i> Wiadomości ({news.length})</h4>
                            <div className="div-news-list">
                                {news.map((n, i) => (
                                    <a
                                        key={i}
                                        className="div-news-item"
                                        href={n.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {n.image && (
                                            <img
                                                src={n.image}
                                                alt=""
                                                className="div-news-img"
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        )}
                                        <div className="div-news-text">
                                            <span className="div-news-headline">{n.headline}</span>
                                            <div className="div-news-meta">
                                                <span className="div-news-source">{n.source}</span>
                                                {n.datetime && (
                                                    <span className="div-news-date">
                                                        {new Date(n.datetime).toLocaleDateString('pl-PL')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* AI Analiza */}
                    <div className="div-modal-section div-ai-section">
                        <h4><i className="fa-solid fa-robot"></i> Analiza AI — Gemma 4</h4>
                        {aiLoading ? (
                            <div className="div-ai-loading">
                                <div className="div-spinner"></div>
                                <p>Gemma 4 analizuje {stock.ticker}...</p>
                            </div>
                        ) : analysis ? (
                            <div className="div-ai-content">
                                {analysis.split("\n").map((line, i) => {
                                    const trimmed = line.trim();
                                    if (!trimmed) return null;
                                    const isScore = /^Score:/i.test(trimmed);
                                    const isConfidence = /^Confidence:/i.test(trimmed);
                                    const isVerdict = /✅ KUPUJ|⚠️ TRZYMAJ|❌ UNIKAJ|^Dywidenda:|^Powód:/i.test(trimmed);
                                    const isNewsImpact = /^News impact:/i.test(trimmed);
                                    const isTrigger = /^Trigger:/i.test(trimmed);
                                    const isAnomaly = /^⚠️/.test(trimmed) || /^Dane:/i.test(trimmed);
                                    const isMetric = /^(Dividend Score|Valuation|Risk:|Trend:|Relative)/i.test(trimmed);
                                    const isBullet = trimmed.startsWith('–') || trimmed.startsWith('-');
                                    const cls = isScore ? "div-ai-score"
                                        : isConfidence ? "div-ai-confidence"
                                        : isVerdict ? "div-ai-verdict"
                                        : isNewsImpact ? "div-ai-news-impact"
                                        : isTrigger ? "div-ai-trigger"
                                        : isAnomaly ? "div-ai-anomaly"
                                        : isMetric ? "div-ai-metric"
                                        : isBullet ? "div-ai-bullet"
                                        : "div-ai-line";
                                    return (
                                        <p key={i} className={cls}>
                                            {trimmed}
                                        </p>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="div-ai-loading">
                                <p>Kliknij aby uruchomić analizę...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
