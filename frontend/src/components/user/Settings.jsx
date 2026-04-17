export default function Settings({ setHasChanges }) {
    return (
        <div>
            <h1>Ustawienia modelu</h1>

            <div className="card">
                <label>Tryb odpowiedzi</label>
                <select onChange={() => setHasChanges(true)}>
                    <option>Standardowy</option>
                    <option>Dokładny</option>
                    <option>Szybki</option>
                </select>

                <label>Długość odpowiedzi</label>
                <input type="range" onChange={() => setHasChanges(true)} />
            </div>
        </div>
    );
}