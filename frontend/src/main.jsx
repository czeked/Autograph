import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AiAnalyzer from './AiAnalyzer.jsx'
import NewsPage from '../NewsPage.jsx'



createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AiAnalyzer />
    <NewsPage />
  </StrictMode>,
)