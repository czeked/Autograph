export default function FilterBar({
    search,
    setSearch,
    sectors,
    selectedSector,
    setSelectedSector,
    sortBy,
    setSortBy,
    resultCount,
}) {
    const sortOptions = [
        { value: "yield", label: "Stopa dywidendy" },
        { value: "streak", label: "Streak (lata)" },
        { value: "price", label: "Cena" },
        { value: "payout", label: "Payout Ratio" },
    ];

    return (
        <div className="div-filter-bar">
            {/* Szukaj */}
            <div className="div-search-box">
                <i className="fa-solid fa-search"></i>
                <input
                    type="text"
                    placeholder="Szukaj ticker lub nazwę..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Sektory */}
            <div className="div-filter-sectors">
                <button
                    className={selectedSector === "Wszystkie" ? "active" : ""}
                    onClick={() => setSelectedSector("Wszystkie")}
                >
                    Wszystkie
                </button>
                {sectors.map((sector) => (
                    <button
                        key={sector}
                        className={selectedSector === sector ? "active" : ""}
                        onClick={() => setSelectedSector(sector)}
                    >
                        {sector}
                    </button>
                ))}
            </div>

            {/* Sortowanie */}
            <div className="div-sort-row">
                <span className="div-sort-label">Sortuj:</span>
                {sortOptions.map((opt) => (
                    <button
                        key={opt.value}
                        className={`div-sort-btn ${sortBy === opt.value ? "active" : ""}`}
                        onClick={() => setSortBy(opt.value)}
                    >
                        {opt.label}
                    </button>
                ))}
                <span className="div-result-count">{resultCount} wyników</span>
            </div>
        </div>
    );
}
