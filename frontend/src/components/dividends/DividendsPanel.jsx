import { useState, useEffect } from "react";
import StockCard from "./StockCard";
import FilterBar from "./FilterBar";
import StatsOverview from "./StatsOverview";
import StockModal from "./StockModal";

export default function DividendsPanel() {
    const [stocks, setStocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [selectedSector, setSelectedSector] = useState("Wszystkie");
    const [sortBy, setSortBy] = useState("score");
    const [selectedStock, setSelectedStock] = useState(null);
    const [aiAnalysis, setAiAnalysis] = useState("");
    const [aiLoading, setAiLoading] = useState(false);
    const [stockNews, setStockNews] = useState([]);
    const [marketNews, setMarketNews] = useState([]);
    const [lastRefresh, setLastRefresh] = useState("");

    useEffect(() => {
        fetchDividends();
    }, []);

    const fetchDividends = async () => {
        console.log("🔄 DividendsPanel: fetching from API...");
        setLoading(true);
        setError("");
        try {
            const res = await fetch("http://localhost:3001/api/dividends");
            console.log("📡 Response status:", res.status);
            const data = await res.json();
            console.log("📊 Data received:", data.success, "stocks:", data.stocks?.length);
            if (data.success) {
                setStocks(data.stocks);
                if (data.lastRefresh) setLastRefresh(data.lastRefresh);
                // Pobierz zbiorcze newsy
                fetch("http://localhost:3001/api/dividends/news")
                    .then(r => r.json())
                    .then(nd => { if (nd.success) setMarketNews(nd.news); })
                    .catch(() => {});
            } else {
                setError(data.error || "Błąd pobierania danych");
            }
        } catch (err) {
            console.error("❌ Fetch error:", err);
            setError("Nie można połączyć z serwerem: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    /* ---- AI Analiza fundamentalna ---- */
    const analyzeStock = async (stock) => {
        setSelectedStock(stock);
        setAiAnalysis("");
        setStockNews([]);
        setAiLoading(true);
        try {
            const res = await fetch("http://localhost:3001/api/dividends/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticker: stock.ticker }),
            });
            const data = await res.json();
            if (data.success) {
                setAiAnalysis(data.analysis);
                if (data.news) setStockNews(data.news);
            } else {
                setAiAnalysis("❌ " + (data.error || "Błąd analizy AI"));
            }
        } catch (err) {
            setAiAnalysis("❌ Nie można połączyć z AI: " + err.message);
        } finally {
            setAiLoading(false);
        }
    };

    const closeModal = () => {
        setSelectedStock(null);
        setAiAnalysis("");
        setStockNews([]);
    };

    /* ---- Sektory ---- */
    const allSectors = [...new Set(stocks.map((s) => s.sectorPl))];

    /* ---- Filtrowanie ---- */
    const filtered = stocks.filter((s) => {
        const matchSearch =
            s.ticker.toLowerCase().includes(search.toLowerCase()) ||
            s.name.toLowerCase().includes(search.toLowerCase());
        const matchSector =
            selectedSector === "Wszystkie" || s.sectorPl === selectedSector;
        return matchSearch && matchSector;
    });

    /* ---- Sortowanie ---- */
    const sorted = [...filtered].sort((a, b) => {
        if (sortBy === "score") return (b.score || 0) - (a.score || 0);
        if (sortBy === "yield") return b.dividendYield - a.dividendYield;
        if (sortBy === "price") return b.price - a.price;
        if (sortBy === "payout") return a.payoutRatio - b.payoutRatio;
        if (sortBy === "pe") return a.peRatio - b.peRatio;
        return 0;
    });

    return (
        <div className="div-panel">
            {/* ===== NAGŁÓWEK SEKCJI ===== */}
            <div className="div-panel-header">
                <div className="div-panel-title">
                    <i className="fa-solid fa-chart-pie"></i>
                    <div>
                        <h1>Rynki Dywidendowe</h1>
                        <p className="div-panel-subtitle">
                            TOP 15 najbardziej opłacalnych spółek — AI scoring codzienny
                            {lastRefresh && ` | Aktualizacja: ${new Date(lastRefresh).toLocaleString('pl-PL')}`}
                        </p>
                    </div>
                </div>
                <div className="div-panel-badges">
                    <div className="div-panel-badge">
                        <i className="fa-solid fa-crown"></i>
                        <span>Maximum Plan</span>
                    </div>
                    <div className="div-panel-badge div-badge-live">
                        <i className="fa-solid fa-satellite-dish"></i>
                        <span>FMP API Live</span>
                    </div>
                </div>
            </div>

            {/* ===== LOADING / ERROR ===== */}
            {loading && (
                <div className="div-loading">
                    <div className="div-spinner"></div>
                    <p>Analizuję 30 spółek dywidendowych...</p>
                    <p className="div-loading-sub">Obliczam scoring opłacalności — TOP 15</p>
                </div>
            )}

            {error && (
                <div className="div-error">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    <p>{error}</p>
                    <button onClick={fetchDividends}>Spróbuj ponownie</button>
                </div>
            )}

            {!loading && !error && stocks.length > 0 && (
                <>
                    {/* ===== STATYSTYKI OGÓLNE ===== */}
                    <StatsOverview stocks={stocks} />

                    {/* ===== WIADOMOŚCI RYNKOWE ===== */}
                    {marketNews.length > 0 && (
                        <div className="div-market-news">
                            <h3 className="div-news-title">
                                <i className="fa-solid fa-newspaper"></i>
                                Aktualne wiadomości dywidendowe
                            </h3>
                            <div className="div-news-grid">
                                {marketNews.map((n, i) => (
                                    <a
                                        key={i}
                                        className="div-news-card"
                                        href={n.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {n.image && (
                                            <img
                                                src={n.image}
                                                alt=""
                                                className="div-news-card-img"
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        )}
                                        <div className="div-news-card-body">
                                            <span className="div-news-card-ticker">{n.ticker}</span>
                                            <span className="div-news-card-headline">{n.headline}</span>
                                            <div className="div-news-card-meta">
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

                    {/* ===== FILTROWANIE I SORTOWANIE ===== */}
                    <FilterBar
                        search={search}
                        setSearch={setSearch}
                        sectors={allSectors}
                        selectedSector={selectedSector}
                        setSelectedSector={setSelectedSector}
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                        resultCount={sorted.length}
                    />

                    {/* ===== LISTA SPÓŁEK ===== */}
                    <div className="div-stocks-grid">
                        {sorted.length > 0 ? (
                            sorted.map((stock) => (
                                <StockCard
                                    key={stock.ticker}
                                    stock={stock}
                                    onAnalyze={() => analyzeStock(stock)}
                                />
                            ))
                        ) : (
                            <div className="div-empty">
                                <i className="fa-solid fa-magnifying-glass"></i>
                                <p>Brak wyników dla podanych filtrów.</p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ===== MODAL ANALIZY ===== */}
            {selectedStock && (
                <StockModal
                    stock={selectedStock}
                    analysis={aiAnalysis}
                    aiLoading={aiLoading}
                    news={stockNews}
                    onClose={closeModal}
                />
            )}
        </div>
    );
}
