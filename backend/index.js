// index.js
import 'dotenv/config';
import express from 'express';
import Groq from 'groq-sdk';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function getStockData(ticker) {
  try {
    const response = await axios.get(`https://api.massive.com/v1/stocks/${ticker.toUpperCase()}`, {
      headers: {
        'Authorization': `Bearer ${process.env.MASSIVE_API_KEY}`,
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Nie udało się pobrać danych dla ${ticker}`);
    return null;
  }
}

app.post('/api/analyze', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Brak promptu" });
  }

  try {
    const tickerMatch = prompt.match(/\b([A-Z]{1,5})\b/);
    const ticker = tickerMatch ? tickerMatch[1].toUpperCase() : null;

    let marketData = null;
    let dataSection = "";

    if (ticker) {
      marketData = await getStockData(ticker);

      if (marketData) {
        const price = marketData.price ? marketData.price.toFixed(2) : "N/A";
        const change = marketData.changePercent ? marketData.changePercent.toFixed(2) : "N/A";
        const changeSign = change > 0 ? "+" : "";

        dataSection = `
Aktualne dane rynkowe (${ticker}):
- Aktualna cena: ${price} USD
- Zmiana dzisiaj: ${changeSign}${change}%
- Wolumen: ${marketData.volume || "N/A"}
- Market Cap: ${marketData.marketCap || "N/A"}
- P/E: ${marketData.pe || "N/A"}
`;
      }
    }

    const systemPrompt = `Jesteś profesjonalnym analitykiem giełdowym. Zawsze odpowiadaj dokładnie w tym formacie (nie dodawaj nic poza tymi sekcjami):

Aktualna cena
Cena wynosi obecnie X.XX USD

Zmiana dzisiaj
+1.87% (lub -0.45%)

Wzrost i perspektywy
(tutaj analiza wzrostu, dobre strony, szanse na przyszłość)

Na jakich giełdach działa
(główna giełda + ewentualnie inne)

Wyzwania i zagrożenia
(główne ryzyka, problemy, zagrożenia)

Wnioski
(krótkie podsumowanie)

Rekomendacja
(np. Kupuj / Trzymaj / Sprzedaj / Ostrożnie obserwuj) + krótki uzasadnienie

Używaj rzeczywistych danych, które dostałeś. Odpowiadaj po polsku, konkretnie, szczerze i z lekkim humorem.`;

    const userPrompt = dataSection 
      ? `${dataSection}\nZapytanie użytkownika: ${prompt}`
      : prompt;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.65,
      max_tokens: 1300,
    });

    let answer = completion.choices[0]?.message?.content || "Brak odpowiedzi";

    res.json({ 
      answer,
      tickerUsed: ticker,
      hadRealData: !!marketData 
    });

  } catch (error) {
    console.error("Błąd:", error.message);
    res.status(500).json({ error: "Błąd podczas analizy" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend uruchomiony na http://localhost:${PORT}`);
});