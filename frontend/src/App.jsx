import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./Home";
import GetStarted from "./GetStarted";
import AiAnalyzer from './AiAnalyzer';
import AiTrader from './AiTrader';
import UserPage from './UserPage';
import AiDividends from './AiDividends';
import Checkout from './Checkout';
import ProtectedRoute from './ProtectedRoute';
import { NotificationProvider } from './NotificationContext';
import NotificationBanner from './NotificationBanner';

function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <NotificationBanner />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/getstarted" element={<GetStarted />} />
          
          {/* Zabezpieczone ścieżki */}
          <Route path="/autograph" element={<ProtectedRoute><AiAnalyzer /></ProtectedRoute>} />
          <Route path="/aitrader" element={<AiTrader />} />
          <Route path="/aidividends" element={<ProtectedRoute requiredPlan="maximum"><AiDividends /></ProtectedRoute>} />
          
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/user" element={<UserPage />} />
        </Routes>
      </NotificationProvider>
    </BrowserRouter>
  );
}

export default App;
