import { useNavigate } from "react-router-dom";

export default function HomePage() {

    const navigate = useNavigate();

    return (
        <div className="homepage">
            <h1>Autograph</h1>
            <p>Analizer rynków</p>

            <button onClick={()=> navigate("/getstarted")}>Zacznij</button>
        </div>
    )
}