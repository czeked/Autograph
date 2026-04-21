export default function StatsOverview({ stocks }) {
    const avgYield = (stocks.reduce((s, st) => s + st.dividendYield, 0) / stocks.length).toFixed(2);
    const maxStreak = Math.max(...stocks.map((s) => s.streak));
    const topYield = [...stocks].sort((a, b) => b.dividendYield - a.dividendYield)[0];
    const avgPayout = (stocks.reduce((s, st) => s + st.payoutRatio, 0) / stocks.length).toFixed(1);
    const totalStocks = stocks.length;

    const upCount = stocks.filter((s) => s.trend === "up").length;
    const sectorCount = new Set(stocks.map((s) => s.sector)).size;

    return (
        <div className="div-stats-row">
            <div className="div-stat-card">
                <i className="fa-solid fa-percent"></i>
                <div>
                    <span className="div-stat-value">{avgYield}%</span>
                    <span className="div-stat-label">Śr. stopa dywidendy</span>
                </div>
            </div>

            <div className="div-stat-card">
                <i className="fa-solid fa-fire-flame-curved"></i>
                <div>
                    <span className="div-stat-value">{maxStreak} lat</span>
                    <span className="div-stat-label">Najdłuższy streak</span>
                </div>
            </div>

            <div className="div-stat-card">
                <i className="fa-solid fa-trophy"></i>
                <div>
                    <span className="div-stat-value">{topYield.ticker} ({topYield.dividendYield}%)</span>
                    <span className="div-stat-label">Najwyższa stopa</span>
                </div>
            </div>

            <div className="div-stat-card">
                <i className="fa-solid fa-scale-balanced"></i>
                <div>
                    <span className="div-stat-value">{avgPayout}%</span>
                    <span className="div-stat-label">Śr. payout ratio</span>
                </div>
            </div>

            <div className="div-stat-card">
                <i className="fa-solid fa-arrow-trend-up"></i>
                <div>
                    <span className="div-stat-value">{upCount} / {totalStocks}</span>
                    <span className="div-stat-label">Trend rosnący</span>
                </div>
            </div>

            <div className="div-stat-card">
                <i className="fa-solid fa-layer-group"></i>
                <div>
                    <span className="div-stat-value">{sectorCount}</span>
                    <span className="div-stat-label">Sektory</span>
                </div>
            </div>
        </div>
    );
}
