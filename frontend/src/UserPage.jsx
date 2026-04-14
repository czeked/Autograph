import { useNavigate } from "react-router-dom";
import { useState } from "react";

import Dashboard from "./components/user/Dashboard";
import Profile from "./components/user/Profile";
import Notifications from "./components/user/Notifications";
import Plans from "./components/user/Plans";
import Settings from "./components/user/Settings";
import Help from "./components/user/Help";

export default function UserPage() {
    const navigate = useNavigate();

    const [hasChanges, setHasChanges] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const [activeSection, setActiveSection] = useState("dashboard"); // 🔥 BRAKOWAŁO

    const handleClose = () => {
        if (hasChanges) {
            setShowWarning(true);
        } else {
            navigate(-1);
        }
    };

    const handleClick = (section) => {
        if (hasChanges) {
            setShowWarning(true);
            return;
        }
        setActiveSection(section);
    };

    return (
        <>
            <div className="layout"> {/* 🔥 NOWY WRAPPER */}

                {/* SIDEBAR */}
                <div className="user-side">

                    <button className="close-btn" onClick={handleClose}>
                        <i className="fa-regular fa-circle-xmark"></i>
                    </button>

                    <div className="user-title">
                        <img src="/imgs/user-icon-default.png" alt="user-icon" />
                        <p>Abdul Ihn</p>
                    </div>

                    <hr />

                    <ul>
                        <li className={activeSection === "dashboard" ? "active" : ""}
                            onClick={() => handleClick("dashboard")}>
                            <i className="fa-solid fa-house"></i> Panel główny
                        </li>

                        <li className={activeSection === "notifications" ? "active" : ""}
                            onClick={() => handleClick("notifications")}>
                            <i className="fa-solid fa-bell"></i> Powiadomienia
                        </li>
                    </ul>

                    <hr />

                    <ul>
                        <li className={activeSection === "profile" ? "active" : ""}
                            onClick={() => handleClick("profile")}>
                            <i className="fa-solid fa-circle-user"></i> Profil
                        </li>

                        <li className={activeSection === "plans" ? "active" : ""}
                            onClick={() => handleClick("plans")}>
                            <i className="fa-regular fa-folder-open"></i> Plany
                        </li>

                        <li className={activeSection === "settings" ? "active" : ""}
                            onClick={() => handleClick("settings")}>
                            <i className="fa-solid fa-sliders"></i> Ustawienia modelu
                        </li>
                    </ul>

                    <hr />

                    <ul>
                        <li className={activeSection === "help" ? "active" : ""}
                            onClick={() => handleClick("help")}>
                            <i className="fa-solid fa-circle-question"></i> Pomoc
                        </li>

                        <li onClick={() => console.log("logout")}>
                            <i className="fa-solid fa-arrow-right-from-bracket"></i> Wyloguj
                        </li>
                    </ul>

                    {/* PRZYCISK */}
                    <button
                        className={`save-btn ${hasChanges ? "active" : ""}`}
                        disabled={!hasChanges}
                        onClick={() => setHasChanges(false)}
                    >
                        Zapisz zmiany
                    </button>
                </div>

                {/* 🔥 PRAWA STRONA */}
                <div className="content">

                    {activeSection === "dashboard" && <Dashboard />}
                    {activeSection === "notifications" && <Notifications />}
                    {activeSection === "profile" && <Profile setHasChanges={setHasChanges} />}
                    {activeSection === "plans" && <Plans />}
                    {activeSection === "settings" && <Settings setHasChanges={setHasChanges} />}
                    {activeSection === "help" && <Help />}

                </div>
            </div>

            {/* WARNING */}
            {showWarning && (
                <div className="warning-bar">
                    <p>Masz niezapisane zmiany. Wyjść bez zapisywania?</p>
                    <div>
                        <button onClick={() => navigate(-1)}>Wyjdź</button>
                        <button onClick={() => setShowWarning(false)}>Anuluj</button>
                    </div>
                </div>
            )}
        </>
    );
}