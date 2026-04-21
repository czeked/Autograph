import { useState } from "react";

export default function Notifications({ notifications, setNotifications, setHasChanges, currentPlan }) {

    const isMaximum = currentPlan === "maximum";


    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const [settings, setSettings] = useState({
        systemSound: true,

        cryptoSound: true,
        crypto_price: true,
        crypto_percent: true,
        crypto_espi: false,
        crypto_news: true,

        stocksSound: false,
        stocks_percent: false,
        stocks_espi: false,
        stocks_news: false,
        stocks_reports: false,

        dividendsSound: false,
        dividends_percent: false,
        dividends_espi: false,
        dividends_news: false,
        dividends_reports: false,
        dividends_day: false,
    });

    const toggle = (key) => {
        setSettings(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
        setHasChanges(true);
    };

    const toggleSub = (key) => {
        setSettings(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
        setHasChanges(true);
    };



    return (
        <div className="panel-notifications">
            <h1>Powiadomienia</h1>

            <div className="notify-p">

                <div className="notify-list">

                    {/* SYSTEM */}
                    <div className="notify-row">
                        <span>Powiadomienia systemowe</span>

                        <div className="notify-actions">
                            <i className={`fa-solid ${settings.systemSound ? "fa-volume-high" : "fa-volume-xmark"}`}
                                onClick={() => {
                                    setSettings(p => ({ ...p, systemSound: !p.systemSound }));
                                    setHasChanges(true);
                                }}
                            />

                            <div
                                className={`toggle ${settings.system ? "active" : ""}`}
                                onClick={() => toggle("system")}
                            >
                                <div className="circle"></div>
                            </div>
                        </div>
                    </div>

                    {/* UPDATES */}
                    <div className="notify-row">
                        <span>Powiadomienia o zaplanowanych aktualizacjach</span>

                        <div className="notify-actions">
                            <div
                                className={`toggle ${settings.updates ? "active" : ""}`}
                                onClick={() => toggle("updates")}
                            >
                                <div className="circle"></div>
                            </div>
                        </div>
                    </div>

                    {/* CRYPTO */}
                    <div className="notify-group">
                        <div className="notify-row">
                            <span>Rynek kryptowalut</span>

                            <div className="notify-actions">
                                <i className={`fa-solid ${settings.cryptoSound ? "fa-volume-high" : "fa-volume-xmark"}`}
                                    onClick={() => {
                                        setSettings(p => ({ ...p, cryptoSound: !p.cryptoSound }));
                                        setHasChanges(true);
                                    }}
                                />

                                <div
                                    className={`toggle ${settings.crypto ? "active" : ""}`}
                                    onClick={() => toggle("crypto")}
                                >
                                    <div className="circle"></div>
                                </div>
                            </div>
                        </div>

                        <div className={`notify-sub ${!settings.crypto ? "disabled" : ""}`}>
                            <div className="notify-row">
                                <span>Skoki cenowe (price alerts)</span>
                                <div className={`toggle ${settings.cryptoPrice ? "active" : ""}`}
                                    onClick={() => toggle("cryptoPrice")}>
                                    <div className="circle"></div>
                                </div>
                            </div>

                            <div className="notify-row">
                                <span>Zmiany procentowe</span>
                                <div className={`toggle ${settings.cryptoPercent ? "active" : ""}`}
                                    onClick={() => toggle("cryptoPercent")}>
                                    <div className="circle"></div>
                                </div>
                            </div>

                            <div className="notify-row">
                                <span>Komunikaty ESPI/EBI</span>
                                <div className={`toggle ${settings.cryptoEspi ? "active" : ""}`}
                                    onClick={() => toggle("cryptoEspi")}>
                                    <div className="circle"></div>
                                </div>
                            </div>

                            <div className="notify-row">
                                <span>Breaking news</span>
                                <div className={`toggle ${settings.cryptoNews ? "active" : ""}`}
                                    onClick={() => toggle("cryptoNews")}>
                                    <div className="circle"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* STOCKS */}
                    <div className="notify-group">
                        <div className="notify-row">
                            <span>Rynek tradycyjny</span>

                            <div className="notify-actions">
                                <i className={`fa-solid ${settings.stocksSound ? "fa-volume-high" : "fa-volume-xmark"}`}
                                    onClick={() => {
                                        setSettings(p => ({ ...p, stocksSound: !p.stocksSound }));
                                        setHasChanges(true);
                                    }}
                                />

                                <div
                                    className={`toggle ${settings.stocks ? "active" : ""}`}
                                    onClick={() => toggle("stocks")}
                                >
                                    <div className="circle"></div>
                                </div>
                            </div>
                        </div>

                        <div className={`notify-sub ${!settings.stocks ? "disabled" : ""}`}>
                            <div className="notify-row">
                                <span>Zmiany procentowe</span>
                                <div className={`toggle ${settings.stocksPercent ? "active" : ""}`}
                                    onClick={() => toggle("stocksPercent")}>
                                    <div className="circle"></div>
                                </div>
                            </div>

                            <div className="notify-row">
                                <span>Komunikaty ESPI/EBI</span>
                                <div className={`toggle ${settings.stocksEspi ? "active" : ""}`}
                                    onClick={() => toggle("stocksEspi")}>
                                    <div className="circle"></div>
                                </div>
                            </div>

                            <div className="notify-row">
                                <span>Breaking news</span>
                                <div className={`toggle ${settings.stocksNews ? "active" : ""}`}
                                    onClick={() => toggle("stocksNews")}>
                                    <div className="circle"></div>
                                </div>
                            </div>

                            <div className="notify-row">
                                <span>Raporty sprzedażowe</span>
                                <div className={`toggle ${settings.stocksReports ? "active" : ""}`}
                                    onClick={() => toggle("stocksReports")}>
                                    <div className="circle"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* DIVIDENDS */}
                    <div className={`notify-group ${!isMaximum ? "locked" : ""}`}>
                        <div className="notify-row">
                            <span>Spółki dywidendowe</span>

                            <div className="notify-actions">
                                <i className={`fa-solid ${settings.dividendsSound ? "fa-volume-high" : "fa-volume-xmark"}`}
                                    onClick={() => {
                                        setSettings(p => ({ ...p, dividendsSound: !p.dividendsSound }));
                                        setHasChanges(true);
                                    }}
                                />

                                <div
                                    className={`toggle ${settings.dividends ? "active" : ""}`}
                                    onClick={() => {
                                        if (!isMaximum) return;
                                        toggle("dividends");
                                    }}
                                >
                                    <div className="circle"></div>
                                </div>
                            </div>
                        </div>

                        <div className={`notify-sub ${(!settings.dividends || !isMaximum) ? "disabled" : ""}`}>
                            <div className="notify-row">
                                <span>Zmiany procentowe</span>
                                <div className={`toggle ${settings.dividendsPercent ? "active" : ""}`}
                                    onClick={() => toggle("dividendsPercent")}>
                                    <div className="circle"></div>
                                </div>
                            </div>

                            <div className="notify-row">
                                <span>Komunikaty ESPI/EBI</span>
                                <div className={`toggle ${settings.dividendsEspi ? "active" : ""}`}
                                    onClick={() => toggle("dividendsEspi")}>
                                    <div className="circle"></div>
                                </div>
                            </div>

                            <div className="notify-row">
                                <span>Breaking news</span>
                                <div className={`toggle ${settings.dividendsNews ? "active" : ""}`}
                                    onClick={() => toggle("dividendsNews")}>
                                    <div className="circle"></div>
                                </div>
                            </div>

                            <div className="notify-row">
                                <span>Raporty sprzedażowe</span>
                                <div className={`toggle ${settings.dividendsReports ? "active" : ""}`}
                                    onClick={() => toggle("dividendsReports")}>
                                    <div className="circle"></div>
                                </div>
                            </div>

                            <div className="notify-row">
                                <span>Dzień dywidendy</span>
                                <div className={`toggle ${settings.dividendsDay ? "active" : ""}`}
                                    onClick={() => toggle("dividendsDay")}>
                                    <div className="circle"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>




                <div className="notify-feed">
                    <h3>Najnowsze powiadomienia </h3>

                    {notifications.length === 0 ? (
                        <div className="notify-empty">
                            Brak nowych powiadomień
                        </div>
                    ) : (
                        notifications.map(n => (
                            <div className="notify-row" key={n.id}>

                                <span>{n.text}</span>

                                <button
                                    className="remove-btn"
                                    onClick={() => removeNotification(n.id)}
                                >
                                    ✕
                                </button>

                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}