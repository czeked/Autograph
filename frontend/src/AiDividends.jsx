import Header from "./Header";
import Footer from "./Footer";
import DividendsPanel from "./components/dividends/DividendsPanel";

export default function AiDividends() {
    return (
        <>
            <Header />
            <div className="dividends-page">
                <DividendsPanel />
            </div>
            <Footer />
        </>
    );
}
