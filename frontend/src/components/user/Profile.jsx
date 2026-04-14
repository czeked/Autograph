export default function Profile({ setHasChanges }) {
    return (
        <div>
            <h1>Profil</h1>

            <div className="card">
                <label>Imię</label>
                <input onChange={() => setHasChanges(true)} placeholder="Jan" />

                <label>Nazwisko</label>
                <input onChange={() => setHasChanges(true)} placeholder="Kowalski" />

                <label>Email</label>
                <input onChange={() => setHasChanges(true)} placeholder="email@example.com" />
            </div>
        </div>
    );
}