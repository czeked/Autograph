export default function StockCard({ stock }) {
    const trendIcon =
        stock.trend === "up"
            ? "fa-solid fa-arrow-trend-up"
            : stock.trend === "down"
            ? "fa-solid fa-arrow-trend-down"
            : "fa-solid fa-minus";

    const trendClass =
        stock.trend === "up"
            ? "div-trend-up"
            : stock.trend === "down"
            ? "div-trend-down"
            : "div-trend-stable";

    const yieldClass =
        stock.dividendYield >= 5
            ? "div-yield-high"
            : stock.dividendYield >= 3
            ? "div-yield-mid"
            : "div-yield-low";

    return (
        <div className="div-stock-card">
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

            {/* Sektor */}
            <div className="div-card-sector">
                <i className="fa-solid fa-tag"></i>
                <span>{stock.sector}</span>
            </div>

            {/* Metryki */}
            <div className="div-card-metrics">
                <div className="div-metric">
                    <span className="div-metric-label">Cena</span>
                    <span className="div-metric-value">${stock.price.toFixed(2)}</span>
                </div>
                <div className="div-metric">
                    <span className="div-metric-label">Dywidenda / akcję</span>
                    <span className="div-metric-value">${stock.dividendPerShare.toFixed(2)}</span>
                </div>
                <div className="div-metric">
                    <span className="div-metric-label">Payout Ratio</span>
                    <span className="div-metric-value">{stock.payoutRatio.toFixed(1)}%</span>
                </div>
                <div className="div-metric">
                    <span className="div-metric-label">Częstotliwość</span>
                    <span className="div-metric-value">{stock.frequency}</span>
                </div>
            </div>

            {/* Stopka karty */}
            <div className="div-card-footer">
                <div className="div-streak">
                    <i className="fa-solid fa-fire"></i>
                    <span>{stock.streak} lat</span>
                </div>
                <div className={`div-trend ${trendClass}`}>
                    <i className={trendIcon}></i>
                    <span>
                        {stock.trend === "up"
                            ? "Rosnąca"
                            : stock.trend === "down"
                            ? "Malejąca"
                            : "Stabilna"}
                    </span>
                </div>
                <div className="div-exdiv">
                    <i className="fa-regular fa-calendar"></i>
                    <span>{stock.exDivDate}</span>
                </div>
            </div>
        </div>
    );
}
