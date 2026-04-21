import { useState } from "react";
import StockCard from "./StockCard";
import FilterBar from "./FilterBar";
import StatsOverview from "./StatsOverview";

/*
 * ═══════════════════════════════════════════════════════
 *  DIVIDEND STOCKS DATA
 *  Łatwo rozszerzalna tablica — wystarczy dodać nowy obiekt.
 *  Każda spółka zawiera: id, ticker, name, sector, price,
 *  dividendYield, dividendPerShare, payoutRatio, frequency,
 *  exDivDate, streak (lata z rzędu), trend ("up"/"down"/"stable"),
 *  logo (FA icon class)
 * ═══════════════════════════════════════════════════════
 */
const DIVIDEND_STOCKS = [
    {
        id: 1,
        ticker: "JNJ",
        name: "Johnson & Johnson",
        sector: "Ochrona zdrowia",
        price: 162.35,
        dividendYield: 3.02,
        dividendPerShare: 4.90,
        payoutRatio: 44.2,
        frequency: "Kwartalnie",
        exDivDate: "2026-05-18",
        streak: 62,
        trend: "up",
        logo: "fa-solid fa-heart-pulse",
    },
    {
        id: 2,
        ticker: "KO",
        name: "Coca-Cola",
        sector: "Dobra konsumpcyjne",
        price: 63.78,
        dividendYield: 2.88,
        dividendPerShare: 1.84,
        payoutRatio: 71.5,
        frequency: "Kwartalnie",
        exDivDate: "2026-06-12",
        streak: 61,
        trend: "up",
        logo: "fa-solid fa-wine-bottle",
    },
    {
        id: 3,
        ticker: "PG",
        name: "Procter & Gamble",
        sector: "Dobra konsumpcyjne",
        price: 169.12,
        dividendYield: 2.34,
        dividendPerShare: 3.96,
        payoutRatio: 62.1,
        frequency: "Kwartalnie",
        exDivDate: "2026-07-20",
        streak: 68,
        trend: "up",
        logo: "fa-solid fa-spray-can-sparkles",
    },
    {
        id: 4,
        ticker: "XOM",
        name: "Exxon Mobil",
        sector: "Energia",
        price: 108.49,
        dividendYield: 3.44,
        dividendPerShare: 3.73,
        payoutRatio: 38.9,
        frequency: "Kwartalnie",
        exDivDate: "2026-05-10",
        streak: 41,
        trend: "stable",
        logo: "fa-solid fa-gas-pump",
    },
    {
        id: 5,
        ticker: "ABBV",
        name: "AbbVie",
        sector: "Farmaceutyka",
        price: 178.92,
        dividendYield: 3.68,
        dividendPerShare: 6.59,
        payoutRatio: 56.7,
        frequency: "Kwartalnie",
        exDivDate: "2026-07-14",
        streak: 52,
        trend: "up",
        logo: "fa-solid fa-pills",
    },
    {
        id: 6,
        ticker: "O",
        name: "Realty Income",
        sector: "Nieruchomości (REIT)",
        price: 57.23,
        dividendYield: 5.41,
        dividendPerShare: 3.10,
        payoutRatio: 82.3,
        frequency: "Miesięcznie",
        exDivDate: "2026-04-29",
        streak: 30,
        trend: "stable",
        logo: "fa-solid fa-building",
    },
    {
        id: 7,
        ticker: "T",
        name: "AT&T",
        sector: "Telekomunikacja",
        price: 21.65,
        dividendYield: 5.12,
        dividendPerShare: 1.11,
        payoutRatio: 48.9,
        frequency: "Kwartalnie",
        exDivDate: "2026-06-03",
        streak: 8,
        trend: "down",
        logo: "fa-solid fa-tower-cell",
    },
    {
        id: 8,
        ticker: "PEP",
        name: "PepsiCo",
        sector: "Dobra konsumpcyjne",
        price: 174.56,
        dividendYield: 2.97,
        dividendPerShare: 5.18,
        payoutRatio: 67.4,
        frequency: "Kwartalnie",
        exDivDate: "2026-06-28",
        streak: 52,
        trend: "up",
        logo: "fa-solid fa-bottle-water",
    },
    {
        id: 9,
        ticker: "AVGO",
        name: "Broadcom",
        sector: "Technologia",
        price: 192.34,
        dividendYield: 1.12,
        dividendPerShare: 2.16,
        payoutRatio: 31.5,
        frequency: "Kwartalnie",
        exDivDate: "2026-06-20",
        streak: 14,
        trend: "up",
        logo: "fa-solid fa-microchip",
    },
    {
        id: 10,
        ticker: "MO",
        name: "Altria Group",
        sector: "Dobra konsumpcyjne",
        price: 52.10,
        dividendYield: 7.58,
        dividendPerShare: 3.95,
        payoutRatio: 80.1,
        frequency: "Kwartalnie",
        exDivDate: "2026-06-12",
        streak: 54,
        trend: "stable",
        logo: "fa-solid fa-leaf",
    },
    {
        id: 11,
        ticker: "MSFT",
        name: "Microsoft",
        sector: "Technologia",
        price: 420.15,
        dividendYield: 0.72,
        dividendPerShare: 3.00,
        payoutRatio: 25.1,
        frequency: "Kwartalnie",
        exDivDate: "2026-08-14",
        streak: 21,
        trend: "up",
        logo: "fa-brands fa-microsoft",
    },
    {
        id: 12,
        ticker: "CVX",
        name: "Chevron",
        sector: "Energia",
        price: 155.80,
        dividendYield: 3.96,
        dividendPerShare: 6.16,
        payoutRatio: 42.3,
        frequency: "Kwartalnie",
        exDivDate: "2026-05-16",
        streak: 37,
        trend: "stable",
        logo: "fa-solid fa-oil-well",
    },
];

/*
 * ═══════════════════════════════════
 *  SECTORS (do filtrowania)
 * ═══════════════════════════════════
 */
const ALL_SECTORS = [...new Set(DIVIDEND_STOCKS.map((s) => s.sector))];

export default function DividendsPanel() {
    const [search, setSearch] = useState("");
    const [selectedSector, setSelectedSector] = useState("Wszystkie");
    const [sortBy, setSortBy] = useState("yield"); // yield | streak | price | payout

    /* ---- Filtrowanie ---- */
    const filtered = DIVIDEND_STOCKS.filter((s) => {
        const matchSearch =
            s.ticker.toLowerCase().includes(search.toLowerCase()) ||
            s.name.toLowerCase().includes(search.toLowerCase());
        const matchSector =
            selectedSector === "Wszystkie" || s.sector === selectedSector;
        return matchSearch && matchSector;
    });

    /* ---- Sortowanie ---- */
    const sorted = [...filtered].sort((a, b) => {
        if (sortBy === "yield") return b.dividendYield - a.dividendYield;
        if (sortBy === "streak") return b.streak - a.streak;
        if (sortBy === "price") return b.price - a.price;
        if (sortBy === "payout") return a.payoutRatio - b.payoutRatio;
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
                            Analiza spółek dywidendowych — stopy zwrotu, payout ratio, streaki i daty ex-dividend
                        </p>
                    </div>
                </div>
                <div className="div-panel-badge">
                    <i className="fa-solid fa-crown"></i>
                    <span>Maximum Plan</span>
                </div>
            </div>

            {/* ===== STATYSTYKI OGÓLNE ===== */}
            <StatsOverview stocks={DIVIDEND_STOCKS} />

            {/* ===== FILTROWANIE I SORTOWANIE ===== */}
            <FilterBar
                search={search}
                setSearch={setSearch}
                sectors={ALL_SECTORS}
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
                        <StockCard key={stock.id} stock={stock} />
                    ))
                ) : (
                    <div className="div-empty">
                        <i className="fa-solid fa-magnifying-glass"></i>
                        <p>Brak wyników dla podanych filtrów.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
