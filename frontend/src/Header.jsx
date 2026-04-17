import { useNavigate } from "react-router-dom";

export default function Header() {
    const navigate = useNavigate();
    return (
        <div className="header">
            <div className="icons">
                <i className="fa-regular fa-user" title="User" onClick={()=> navigate("/user")}></i>
                <i className="fa-solid fa-chart-simple" title="Autograph" onClick={()=> navigate("/autograph")}></i>
                <i className="fa-solid fa-chart-line" title="AI Trader" onClick={()=> navigate("/aitrader")}></i>
            </div>
            <h1>Autograph</h1>
        </div>
        
    )
}