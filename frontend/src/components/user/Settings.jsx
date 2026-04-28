export default function Settings({ setHasChanges }) {
    return (
        <div className="panel-settings">
            <div className="panel-header">
                <h1>Ustawienia modułu</h1>
                <p>Dostosuj działanie algorytmów i sposób generowania analiz AI.</p>
            </div>

            {/* SEKCOJA W BUDOWIE - Łatwe do usunięcia */}
            <div style={{
                background: "rgba(255, 193, 7, 0.1)",
                border: "1px solid #ffc107",
                color: "#ffc107",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "14px"
            }}>
                <i className="fa-solid fa-screwdriver-wrench"></i>
                <span>Ta sekcja jest obecnie w budowie. Niektóre funkcje mogą być niedostępne.</span>
            </div>

            {/* <div className="card">
                <label>Tryb odpowiedzi</label>
                <select onChange={() => setHasChanges(true)}>
                    <option>Standardowy</option>
                    <option>Dokładny</option>
                    <option>Szybki</option>
                </select>

                <label>Długość odpowiedzi</label>
                <input type="range" onChange={() => setHasChanges(true)} />
            </div> */}
        </div>
    );
}