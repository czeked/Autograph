import { createContext, useContext, useState, useEffect, useCallback } from "react";

const NotificationContext = createContext();

const SETTINGS_KEY = "autograph_notification_settings";
const NOTIFICATIONS_KEY = "autograph_notifications";

const DEFAULT_SETTINGS = {
    systemSound: true,
    system: false,
    updates: false,

    cryptoSound: true,
    crypto: true,
    cryptoPrice: true,
    cryptoPercent: true,
    cryptoEspi: false,
    cryptoNews: true,

    stocksSound: false,
    stocks: false,
    stocksPercent: false,
    stocksEspi: false,
    stocksNews: false,
    stocksReports: false,

    dividendsSound: false,
    dividends: false,
    dividendsPercent: false,
    dividendsEspi: false,
    dividendsNews: false,
    dividendsReports: false,
    dividendsDay: false,
};

const SOURCE_LABELS = {
    crypto: "Kryptowaluty",
    stocks: "Rynek tradycyjny",
    dividends: "Spółki dywidendowe",
    system: "System",
};

const SOURCE_ICONS = {
    crypto: "₿",
    stocks: "📈",
    dividends: "💰",
    system: "⚙️",
};

function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { ...DEFAULT_SETTINGS };
}

function loadNotifications() {
    try {
        const raw = localStorage.getItem(NOTIFICATIONS_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
}

export function NotificationProvider({ children }) {
    const [settings, setSettings] = useState(loadSettings);
    const [notifications, setNotifications] = useState(loadNotifications);
    const [bannerNotification, setBannerNotification] = useState(null);
    const [settingsChanged, setSettingsChanged] = useState(false);

    // Persist settings
    useEffect(() => {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }, [settings]);

    // Persist notifications (max 50)
    useEffect(() => {
        const toStore = notifications.slice(0, 50);
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(toStore));
    }, [notifications]);

    // Auto-hide banner after 8s
    useEffect(() => {
        if (!bannerNotification) return;
        const timer = setTimeout(() => setBannerNotification(null), 8000);
        return () => clearTimeout(timer);
    }, [bannerNotification]);

    const updateSetting = useCallback((key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setSettingsChanged(true);
    }, []);

    const toggleSetting = useCallback((key) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
        setSettingsChanged(true);
    }, []);

    const saveSettings = useCallback(() => {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        setSettingsChanged(false);
    }, [settings]);

    const addNotification = useCallback((notif) => {
        const newNotif = {
            ...notif,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            read: false,
        };
        setNotifications(prev => [newNotif, ...prev].slice(0, 50));
        setBannerNotification(newNotif);
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const markAsRead = useCallback((id) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    const dismissBanner = useCallback(() => {
        setBannerNotification(null);
    }, []);

    // Check if a notification type is enabled
    const isTypeEnabled = useCallback((source, type) => {
        if (source === "crypto") {
            if (!settings.crypto) return false;
            const map = {
                price: settings.cryptoPrice,
                percent: settings.cryptoPercent,
                espi: settings.cryptoEspi,
                news: settings.cryptoNews,
            };
            return map[type] ?? false;
        }
        if (source === "stocks") {
            if (!settings.stocks) return false;
            const map = {
                percent: settings.stocksPercent,
                espi: settings.stocksEspi,
                news: settings.stocksNews,
                reports: settings.stocksReports,
            };
            return map[type] ?? false;
        }
        if (source === "dividends") {
            if (!settings.dividends) return false;
            const map = {
                percent: settings.dividendsPercent,
                espi: settings.dividendsEspi,
                news: settings.dividendsNews,
                reports: settings.dividendsReports,
                day: settings.dividendsDay,
            };
            return map[type] ?? false;
        }
        return false;
    }, [settings]);

    // Listen for custom events from AI components
    useEffect(() => {
        const handleAINotification = (e) => {
            const { source, items } = e.detail;
            if (!items || !Array.isArray(items)) return;

            items.forEach(item => {
                if (isTypeEnabled(item.source || source, item.type)) {
                    addNotification({
                        source: item.source || source,
                        type: item.type,
                        text: item.text,
                        ticker: item.ticker || "",
                    });
                }
            });
        };

        window.addEventListener("autograph:notification", handleAINotification);
        return () => window.removeEventListener("autograph:notification", handleAINotification);
    }, [isTypeEnabled, addNotification]);

    const unreadCount = notifications.filter(n => !n.read).length;

    // Filtered notifications based on current settings
    const filteredNotifications = notifications.filter(n => {
        if (n.source === "crypto" && !settings.crypto) return false;
        if (n.source === "stocks" && !settings.stocks) return false;
        if (n.source === "dividends" && !settings.dividends) return false;
        return true;
    });

    return (
        <NotificationContext.Provider value={{
            settings,
            notifications: filteredNotifications,
            allNotifications: notifications,
            bannerNotification,
            unreadCount,
            settingsChanged,
            updateSetting,
            toggleSetting,
            saveSettings,
            addNotification,
            removeNotification,
            markAsRead,
            markAllAsRead,
            clearAll,
            dismissBanner,
            isTypeEnabled,
            SOURCE_LABELS,
            SOURCE_ICONS,
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
    return ctx;
}

export { SOURCE_LABELS, SOURCE_ICONS };
