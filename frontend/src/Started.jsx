
export default function Started() {
    return (
        <>
                <div className="div-hello">
                    <p>Witaj w miejscu, w którym przyszłość analizy zależy od <span className="strong">Ciebie</span>.</p>

                    <div className="tptext">
                        Z Autograph'a korzysta już ponad 700 tys. zalogowanych użytkowników.
                    </div>

                    <p className="tptext-next">Ty też zacznij.</p>
                </div>


                <div className="div-offers">
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
                </div>

                
                <div className="div-plans">
                    <h1>Wybierz swój plan</h1>
                    <div className="block-plans">
                        <div className="block-plan">
                            <i className="fa-solid fa-suitcase-rolling"></i>
                            <h2>Free Plan</h2>
                            <p>0,00 $ / msc.</p>
                            <button>Wybierz</button>
                        </div>

                        <div className="box-frame">
                            <span>Polecany</span>
                            <div className="block-plan">
                                <i className="fa-solid fa-medal"></i>
                                <h2>Professional Plan</h2>
                                <p>29,99 $ / msc.</p>
                                <button>Wybierz</button>
                            </div>
                        </div>

                        <div className="block-plan">
                            <i className="fa-solid fa-trophy"></i>
                            <h2>Maximum Plan</h2>
                            <p>54,99 $ / msc.</p>
                            <button>Wybierz</button>
                        </div>
                    </div>
                    <p className="plans-logo">Autograph</p>
                </div>
        </>
    )
}