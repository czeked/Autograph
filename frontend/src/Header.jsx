import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

export default function Header() {
    const navigate = useNavigate();
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

    return (
        <div className="header">
            <div className="icons">
                <i className="fa-regular fa-user" title="Użytkownik" onClick={() => navigate("/user")}></i>
                <i className="fa-solid fa-chart-column" title="Rynek tradycyjny" onClick={() => navigate("/autograph")}></i>
                <i className="fa-brands fa-bitcoin" title="Kryptowaluty" onClick={() => navigate("/aitrader")}></i>
                {isMaximum && (
                    <i
                        className="fa-solid fa-chart-pie ai-dividends-icon"
                        title="Spółki dywidendowe"
                        onClick={() => navigate("/aidividends")}
                    ></i>
                )}
            </div>
            <h1>Autograph</h1>
        </div>

    )
}