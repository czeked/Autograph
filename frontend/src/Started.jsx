import { useRef } from "react";
import { useNavigate } from "react-router-dom";

export default function Started() {

    const helloRef = useRef(null);
    const offersRef = useRef(null);
    const plansRef = useRef(null);
    const navigate = useNavigate();

    const scrollTo = (ref) => {
        ref.current.scrollIntoView({ behavior: "smooth" });
    };

    const handleSelectPlan = (planId) => {
        navigate('/user', { state: { section: 'plans' } });
    }; ``

    return (
        <>
            <div className="div-hello" ref={helloRef}>
                <div className="hello-tx">
                    <p>
                        Witaj w miejscu, w którym przyszłość analizy zależy od <span className="strong">Ciebie</span>.
                    </p>

                    <div className="tptext">
                        Z Autograph'a korzysta już ponad 700 tys. zalogowanych użytkowników.
                    </div>

                    <p className="tptext-next">Ty też zacznij.</p>
                </div>


                <button className="scroll-btn" onClick={() => scrollTo(offersRef)}>
                    <i className="fa-solid fa-arrow-down"></i>
                </button>
            </div>

            <div className="div-offers" ref={offersRef}>
                <div className="helpers">
                    <h1>Działamy w oparciu o</h1>
                    <hr />
                </div>

                <div className="icons-s">
                    <div className="icons-sep">
                        <i className="fa-solid fa-brain"></i>
                        <p>AI</p>
                    </div>
                    <div className="icons-sep">
                        <i className="fa-solid fa-code-merge"></i>
                        <p>Algorytmy</p>
                    </div>
                    <div className="icons-sep">
                        <i className="fa-solid fa-earth-europe"></i>
                        <p>Dane globalne</p>
                    </div>
                </div>

                <button className="scroll-btn" onClick={() => scrollTo(plansRef)}>
                    <i className="fa-solid fa-arrow-down"></i>
                </button>
            </div>

            <div className="div-plans" ref={plansRef}>
                <h1>Wybierz swój plan</h1>

                <div className="block-plans">
                    <div className="block-plan">
                        <i className="fa-solid fa-suitcase-rolling"></i>
                        <h2>Free Plan</h2>
                        <p>0,00 zł / msc.</p>
                        <button onClick={() => handleSelectPlan('free')}>Wybierz</button>
                    </div>

                    <div className="box-frame">
                        <span>Polecany</span>
                        <div className="block-plan">
                            <i className="fa-solid fa-medal"></i>
                            <h2>Professional Plan</h2>
                            <p>64,99 zł / msc.</p>
                            <button onClick={() => handleSelectPlan('pro')}>Wybierz</button>
                        </div>
                    </div>

                    <div className="block-plan">
                        <i className="fa-solid fa-trophy"></i>
                        <h2>Maximum Plan</h2>
                        <p>179,99 zł / msc.</p>
                        <button onClick={() => handleSelectPlan('maximum')}>Wybierz</button>
                    </div>
                </div>

                <button className="scroll-btn" onClick={() => scrollTo(helloRef)}>
                    <i className="fa-solid fa-arrow-up"></i>
                </button>
            </div>
        </>
    );
}