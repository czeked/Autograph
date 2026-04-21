export default function Settings({ setHasChanges }) {
    return (
        <div className="panel-settings">
            <h1>Ustawienia modułu</h1>

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