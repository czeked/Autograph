import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useNotifications } from "./NotificationContext";

import Dashboard from "./components/user/Dashboard";
import Profile from "./components/user/Profile";
import Notifications from "./components/user/Notifications";
import Plans from "./components/user/Plans";
import Settings from "./components/user/Settings";
import Help from "./components/user/Help";
import Header from "./Header";

const DEFAULT_AVATAR = "/imgs/user-icon-default.png";
const DEFAULT_USERNAME = "Administrator";

export default function UserPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { notifications, unreadCount, saveSettings, settingsChanged } = useNotifications();

    const [hasChanges, setHasChanges] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const [activeSection, setActiveSection] = useState(location.state?.section || "dashboard"); // Pobierz z nawigacji
    const [toast, setToast] = useState(null);
    const [pendingNavigation, setPendingNavigation] = useState(null);
    const [pendingSection, setPendingSection] = useState(null);

    // Update active section when navigating from banner
    useEffect(() => {
        if (location.state?.section) {
            setActiveSection(location.state.section);
        }
    }, [location.state]);

    // Profile state – loaded from localStorage on mount
    const [username, setUsername] = useState(() => {
        return localStorage.getItem("autograph_username") || DEFAULT_USERNAME;
    });
    const [profileImage, setProfileImage] = useState(() => {
        return localStorage.getItem("autograph_avatar") || DEFAULT_AVATAR;
    });

    const showToast = (message, type = "info") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };


    const handleHeaderNavigate = (path) => {
        if (hasChanges) {
            setPendingNavigation(path);
            setShowWarning(true);
        } else {
            navigate(path);
        }
    };

    const handleExit = () => {
        setHasChanges(false);
        setShowWarning(false);
        if (pendingNavigation) {
            navigate(pendingNavigation);
        } else if (pendingSection) {
            setActiveSection(pendingSection);
            setPendingSection(null);
        }
    };

    const handleClick = (section) => {
        if (hasChanges) {
            setPendingSection(section);
            setShowWarning(true);
            return;
        }
        setActiveSection(section);
    };

    const handleSave = () => {
        // Persist profile data
        localStorage.setItem("autograph_username", username);
        localStorage.setItem("autograph_avatar", profileImage);
        // Persist notification settings
        saveSettings();
        setHasChanges(false);
        showToast("Zmiany zostały zapisane!", "success");
    };

    const [plan, setPlan] = useState(null);

    useEffect(() => {
        const updatePlan = () => {
            const saved = localStorage.getItem("autograph_plan");
            setPlan(saved && saved !== "none" ? saved : null);
        };

        window.addEventListener("planChange", updatePlan);

        updatePlan(); // 🔥 żeby działało od razu

        return () => window.removeEventListener("planChange", updatePlan);
    }, []);

    return (
        <>
            <Header onNavigate={handleHeaderNavigate} />
            <div className="layout"> {/* 🔥 NOWY WRAPPER */}
                {/* <button className="close-btn" onClick={handleClose}>
                    <i className="fa-regular fa-circle-xmark"></i>
                </button> */}
                {/* SIDEBAR */}
                <div className="user-side">
                    <div className="user-side-scrollable">
                        <div className="user-title">
                            <img src={profileImage} alt="user-icon" />
                            <p className={`username ${plan || "none"}`}>
                                {username}
                            </p>
                        </div>

                        <hr />

                        <ul>
                            <li className={activeSection === "dashboard" ? "active" : ""}
                                onClick={() => handleClick("dashboard")}>
                                <i className="fa-solid fa-house"></i> Panel główny
                            </li>

                            <li className={activeSection === "notifications" ? "active" : ""}
                                onClick={() => handleClick("notifications")}>
                                {unreadCount > 0 ? (
                                    <span className="sidebar-notif-wrapper">
                                        <i className="fa-solid fa-bell"></i>
                                        <span className="sidebar-notif-badge">{unreadCount}</span>
                                    </span>
                                ) : (
                                    <i className="fa-solid fa-bell-slash"></i>
                                )} Powiadomienia
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
                        onClick={handleSave}
                    >
                        Zapisz zmiany
                    </button>
                    </div>

                    
                </div>

                {/* 🔥 PRAWA STRONA */}
                <div className="content">

                    {activeSection === "dashboard" && <Dashboard />}
                    {activeSection === "notifications" && <Notifications setHasChanges={setHasChanges} currentPlan={localStorage.getItem("autograph_plan")} />}
                    {activeSection === "profile" && (
                        <Profile
                            setHasChanges={setHasChanges}
                            username={username}
                            setUsername={setUsername}
                            profileImage={profileImage}
                            setProfileImage={setProfileImage}
                        />
                    )}
                    {activeSection === "plans" && <Plans showToast={showToast} />}
                    {activeSection === "settings" && <Settings setHasChanges={setHasChanges} />}
                    {activeSection === "help" && <Help />}

                </div>
            </div>

            {/* WARNING */}
            {showWarning && (
                <div className="warning-bar">
                    <p>Masz niezapisane zmiany. Wyjść bez zapisywania?</p>
                    <div>
                        <button onClick={handleExit}>Wyjdź</button>
                        <button onClick={() => {
                            setShowWarning(false);
                            setPendingNavigation(null);
                            setPendingSection(null);
                        }}>Anuluj</button>
                    </div>
                </div>
            )}

            {/* TOAST */}
            {toast && (
                <div className={`toast-notification toast-${toast.type}`}>
                    <i className={toast.type === "success" ? "fa-solid fa-circle-check" : toast.type === "error" ? "fa-solid fa-circle-exclamation" : "fa-solid fa-circle-info"}></i>
                    <span>{toast.message}</span>
                </div>
            )}
        </>
    );
}