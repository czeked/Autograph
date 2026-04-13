import { useNavigate } from "react-router-dom";

export default function Header() {
    const navigate = useNavigate();
    return (
        <div className="header">
            <div className="icons">
                <i className="fa-regular fa-user"></i>
                <i className="fa-solid fa-chart-simple" onClick={()=> navigate("/autograph")}></i>
            </div>
            <h1>Autograph</h1>
        </div>
        
    )
}