import "./Help.css";

export default function Help() {
    return (
        <div className="panel-help">
            <div className="help-header">
                <h1>Centrum Pomocy</h1>
                <p>Znajdź odpowiedzi na swoje pytania lub skontaktuj się z naszym zespołem.</p>
                <div className="help-search">
                    <i className="fa-solid fa-magnifying-glass"></i>
                    <input type="text" placeholder="W czym możemy Ci pomóc?" />
                </div>
            </div>

            <div className="help-grid">
                <div className="help-card">
                    <i className="fa-solid fa-user-gear"></i>
                    <h3>Zarządzanie kontem</h3>
                    <p>Zmiana danych, bezpieczeństwo i subskrypcje.</p>
                </div>
                <div className="help-card">
                    <i className="fa-solid fa-robot"></i>
                    <h3>Analiza AI</h3>
                    <p>Jak interpretować wyniki i optymalizować zapytania.</p>
                </div>
                <div className="help-card">
                    <i className="fa-solid fa-credit-card"></i>
                    <h3>Płatności</h3>
                    <p>Faktury, metody płatności i zwroty.</p>
                </div>
                <div className="help-card">
                    <i className="fa-solid fa-shield-halved"></i>
                    <h3>Prywatność</h3>
                    <p>Twoje dane i sposób ich przetwarzania.</p>
                </div>
            </div>

            <div className="help-contact-section">
                <h2>Skontaktuj się z nami</h2>
                <div className="contact-grid">
                    <div className="contact-item">
                        <i className="fa-solid fa-envelope"></i>
                        <div>
                            <h4>Email</h4>
                            <p>office@autograph.com</p>
                        </div>
                    </div>
                    <div className="contact-item">
                        <i className="fa-solid fa-phone"></i>
                        <div>
                            <h4>Telefon</h4>
                            <p>+48 213 420 967</p>
                        </div>
                    </div>
                    <div className="contact-item">
                        <i className="fa-solid fa-location-dot"></i>
                        <div>
                            <h4>Biuro</h4>
                            <p>ul. Szeroka 17, Kraków</p>
                            <p className="sub-text">Pon - Pt: 08:00 - 15:00</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}