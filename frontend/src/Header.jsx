import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

export default function Header({ onNavigate }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [isMaximum, setIsMaximum] = useState(false);

    useEffect(() => {
        const plan = localStorage.getItem("autograph_plan");
        setIsMaximum(plan === "maximum");
    }, []);

    // Re-check plan on focus (in case user changed plan in another tab/page)
    useEffect(() => {
        const handleFocus = () => {
            const plan = localStorage.getItem("autograph_plan");
            setIsMaximum(plan === "maximum");
        };
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, []);

    const handleNavigate = (path) => {
        if (onNavigate) {
            onNavigate(path);
        } else {
            navigate(path);
        }
    };




    return (
        <div className="header">
            <div className="icons">
                <i className={`fa-regular fa-user ${location.pathname === "/user" ? "selected" : ""}`} title="Użytkownik" onClick={() => handleNavigate("/user")}></i>
                <i className={`fa-solid fa-chart-column ${location.pathname === "/autograph" ? "selected" : ""}`} title="Rynek tradycyjny" onClick={() => handleNavigate("/autograph")}></i>
                <i className={`fa-brands fa-bitcoin ${location.pathname === "/aitrader" ? "selected" : ""}`} title="Kryptowaluty" onClick={() => handleNavigate("/aitrader")}></i>
                {isMaximum && (
                    <i
                        className={`fa-solid fa-chart-pie ai-dividends-icon ${location.pathname === "/aidividends" ? "selected" : ""}`}
                        title="Spółki dywidendowe"
                        onClick={() => handleNavigate("/aidividends")}
                    ></i>
                )}
            </div>
            <h1>Autograph</h1>
        </div>

    )
}