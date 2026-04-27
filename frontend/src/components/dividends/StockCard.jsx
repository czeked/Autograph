export default function StockCard({ stock, onAnalyze }) {
    const yieldClass =
        stock.dividendYield >= 5
            ? "div-yield-high"
            : stock.dividendYield >= 3
            ? "div-yield-mid"
            : "div-yield-low";

    const changeClass = stock.changePercent >= 0 ? "div-change-up" : "div-change-down";

    const formatMCap = (v) => {
        if (!v) return "N/A";
        if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
        if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
        if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
        return `$${v}`;
    };

    const scoreClass =
        stock.score >= 70 ? "div-score-high" :
        stock.score >= 50 ? "div-score-mid" : "div-score-low";

    return (
        <div className="div-stock-card">
            {/* Score badge */}
            {stock.score > 0 && (
                <div className={`div-score-badge ${scoreClass}`}>
                    ⭐ {stock.score}/100
                </div>
            )}
            {/* Nagłówek karty */}
            <div className="div-card-top">
                <div className="div-card-icon">
                    <i className={stock.logo}></i>
                </div>
                <div className="div-card-info">
                    <h3>{stock.ticker}</h3>
                    <span>{stock.name}</span>
                </div>
                <div className={`div-yield-badge ${yieldClass}`}>
                    {stock.dividendYield.toFixed(2)}%
                </div>
            </div>

            {/* Sektor + cena */}
            <div className="div-card-sector">
                <div className="div-sector-tag">
                    <i className="fa-solid fa-tag"></i>
                    <span>{stock.sectorPl}</span>
                </div>
                <div className="div-card-price">
                    <span className="div-price-value">${stock.price.toFixed(2)}</span>
                    <span className={`div-price-change ${changeClass}`}>
                        {stock.changePercent >= 0 ? "▲" : "▼"} {Math.abs(stock.changePercent).toFixed(2)}%
                    </span>
                </div>
            </div>

            {/* Metryki */}
            <div className="div-card-metrics">
                <div className="div-metric">
                    <span className="div-metric-label">Dywidenda / akcję</span>
                    <span className="div-metric-value">${stock.dividendPerShare.toFixed(2)}</span>
                </div>
                <div className="div-metric">
                    <span className="div-metric-label">Payout Ratio</span>
                    <span className="div-metric-value">{stock.payoutRatio.toFixed(1)}%</span>
                </div>
                <div className="div-metric">
                    <span className="div-metric-label">P/E</span>
                    <span className="div-metric-value">{stock.peRatio > 0 ? stock.peRatio.toFixed(1) : "N/A"}</span>
                </div>
                <div className="div-metric">
                    <span className="div-metric-label">Kapitalizacja</span>
                    <span className="div-metric-value">{formatMCap(stock.marketCap)}</span>
                </div>
            </div>

            {/* Stopka karty */}
            <div className="div-card-footer">
                <div className="div-exdiv">
                    <i className="fa-regular fa-calendar"></i>
                    <span>Ex-div: {stock.exDivDate}</span>
                </div>
                <button className="div-analyze-btn" onClick={onAnalyze}>
                    <i className="fa-solid fa-robot"></i> Analizuj AI
                </button>
            </div>
        </div>
    );
}
