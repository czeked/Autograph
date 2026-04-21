import { useRef } from "react";

export default function Profile({ setHasChanges, username, setUsername, profileImage, setProfileImage }) {
    const fileInputRef = useRef(null);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            setProfileImage(event.target.result);
            setHasChanges(true);
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="panel-profile">
            <h1>Profil</h1>

            <div className="profile-tab">
                <div className="profile-card">
                    <input
                        type="text"
                        placeholder="Nazwa użytkownika"
                        value={username}
                        onChange={(e) => {
                            setUsername(e.target.value);
                            setHasChanges(true);
                        }}
                    />
                    <input type="email" placeholder="Email" onChange={() => setHasChanges(true)} />
                </div>
                <div className="profile-img">
                    <img src={profileImage} alt="user" />
                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        style={{ display: "none" }}
                        onChange={handleImageUpload}
                    />
                    <button onClick={() => fileInputRef.current.click()}>Prześlij</button>
                </div>
            </div>

            <div className="profile-tab-sec">
                <h1>Zmień hasło</h1>
                <div className="profile-card">
                    <input type="password" placeholder="Stare hasło" onChange={() => setHasChanges(true)} />
                    <input type="password" placeholder="Nowe hasło" onChange={() => setHasChanges(true)} />
                    <input type="password" placeholder="Potwierdź nowe hasło" onChange={() => setHasChanges(true)} />
                </div>
                <span>Nie pamiętasz obecnego hasła?</span>
            </div>

        </div>
    );
}
