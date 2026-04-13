import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./Home";
import GetStarted from "./GetStarted";
import AiAnalyzer from './AiAnalyzer';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/getstarted" element={<GetStarted />} />
        <Route path="/autograph" element={<AiAnalyzer />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
