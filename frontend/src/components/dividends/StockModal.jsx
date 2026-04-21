export default function StockModal({ stock, onClose }) {
    if (!stock) return null;

    return (
        <div className="div-modal-overlay" onClick={onClose}>
            <div className="div-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="div-modal-close" onClick={onClose}>
                    <i className="fa-solid fa-xmark"></i>
                </button>

                <div className="div-modal-header">
                    <div className="div-modal-icon">
                        <i className={stock.logo}></i>
                    </div>
                    <div>
                        <h2>{stock.ticker}</h2>
                        <h3>{stock.name}</h3>
                    </div>
                </div>

                <div className="div-modal-body">
                    {/* Główna sekcja danych (te z panelu) */}
                    <div className="div-modal-section">
                        <h4>Obecne dane</h4>
                        <div className="div-card-metrics">
                            <div className="div-metric">
                                <span className="div-metric-label">Cena</span>
                                <span className="div-metric-value">{stock.price.toFixed(2)} PLN</span>
                            </div>
                            <div className="div-metric">
                                <span className="div-metric-label">Dywidenda (Yield)</span>
                                <span className="div-metric-value">{stock.dividendYield.toFixed(2)}%</span>
                            </div>
                            <div className="div-metric">
                                <span className="div-metric-label">Dywidenda / akcję</span>
                                <span className="div-metric-value">{stock.dividendPerShare.toFixed(2)} PLN</span>
                            </div>
                            <div className="div-metric">
                                <span className="div-metric-label">Payout Ratio</span>
                                <span className="div-metric-value">{stock.payoutRatio.toFixed(1)}%</span>
                            </div>
                            <div className="div-metric">
                                <span className="div-metric-label">Streak</span>
                                <span className="div-metric-value">{stock.streak} lat</span>
                            </div>
                            <div className="div-metric">
                                <span className="div-metric-label">Ex-Div Date</span>
                                <span className="div-metric-value">{stock.exDivDate}</span>
                            </div>
                        </div>
                    </div>

                    {/* Miejsce na przyszłościowe integracje API */}
                    <div className="div-modal-api-grid">
                        <div className="div-api-card">
                            <div className="api-card-header">
                                <i className="fa-solid fa-robot" style={{ color: '#a78bfa' }}></i>
                                <span>Analiza AI (Przyszłość API)</span>
                            </div>
                            <div className="api-placeholder">
                                <i className="fa-solid fa-spinner fa-spin"></i>
                                <p>Oczekiwanie na analizę modeli genAI... Zbieranie danych fundamentalnych dla {stock.ticker}.</p>
                            </div>
                        </div>

                        <div className="div-api-card">
                            <div className="api-card-header">
                                <i className="fa-brands fa-x-twitter" style={{ color: '#1da1f2' }}></i>
                                <span>Social Sentiment (X / News)</span>
                            </div>
                            <div className="api-placeholder">
                                <i className="fa-solid fa-waveform"></i>
                                <p>Nasłuchiwanie nastrojów rynku. W przyszłości symulacja sentymentu polskiego rynku (Bankier.pl, Parkiet, Twitter).</p>
                            </div>
                        </div>

                        <div className="div-api-card full-width">
                            <div className="api-card-header">
                                <i className="fa-solid fa-calendar-check" style={{ color: '#34d399' }}></i>
                                <span>Nadchodzące wydarzenia z API</span>
                            </div>
                            <div className="api-placeholder">
                                <p>Tutaj znajdą się daty walnych zgromadzeń akcjonariuszy, publikacje raportów finansowych oraz wypłacenie dywidendy.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
