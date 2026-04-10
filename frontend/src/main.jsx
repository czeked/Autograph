import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AiAnalyzer from './AiAnalyzer.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AiAnalyzer />
    <App />
  </StrictMode>,
)
