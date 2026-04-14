export default function Dashboard() {
    return (
        <div>
            <h1>Panel główny</h1>

            <div className="card">
                <h3>Witaj 👋</h3>
                <p>To jest Twój panel użytkownika. Możesz tutaj zarządzać swoim profilem i ustawieniami.</p>
            </div>

            <div className="card">
                <h3>Ostatnia aktywność</h3>
                <p>Brak ostatnich działań.</p>
            </div>
        </div>
    );
}