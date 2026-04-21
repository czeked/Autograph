import { useState } from "react";

export default function Notifications({ notifications, setNotifications, setHasChanges }) {


    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const [settings, setSettings] = useState({
        system: true,
        updates: false,
        crypto: true,
        stocks: false,
        dividends: false
    });

    const toggle = (key) => {
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

                    <div className="notify-row" onClick={() => toggle("system")} onChange={() => setHasChanges(true)}>
                        <span>Powiadomienia systemowe</span>
                        <div className={`toggle ${settings.system ? "active" : ""}`}>
                            <div className="circle"></div>
                        </div>
                    </div>

                    <div className="notify-row" onClick={() => toggle("updates")} onChange={() => setHasChanges(true)}>
                        <span>Aktualizacje aplikacji</span>
                        <div className={`toggle ${settings.updates ? "active" : ""}`}>
                            <div className="circle"></div>
                        </div>
                    </div>

                    <div className="notify-row" onClick={() => toggle("crypto")} onChange={() => setHasChanges(true)}>
                        <span>Kryptowaluty</span>
                        <div className={`toggle ${settings.crypto ? "active" : ""}`}>
                            <div className="circle"></div>
                        </div>
                    </div>

                    <div className="notify-row" onClick={() => toggle("stocks")} onChange={() => setHasChanges(true)}>
                        <span>Rynek tradycyjny</span>
                        <div className={`toggle ${settings.stocks ? "active" : ""}`}>
                            <div className="circle"></div>
                        </div>
                    </div>

                    <div className="notify-row" onClick={() => toggle("dividends")} onChange={() => setHasChanges(true)}>
                        <span>Dywidendy</span>
                        <div className={`toggle ${settings.dividends ? "active" : ""}`}>
                            <div className="circle"></div>
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