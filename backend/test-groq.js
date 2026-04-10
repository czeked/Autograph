// test-groq.js
import 'dotenv/config';        // ← to wczytuje .env automatycznie
import Groq from 'groq-sdk';

console.log("🔍 Sprawdzenie klucza...");
console.log("GROQ_API_KEY:", process.env.GROQ_API_KEY ? "✅ jest (ukryty)" : "❌ brak!");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function testAI() {
  try {
    console.log("\n🔄 Wysyłam zapytanie do Groq...");

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Jesteś ekspertem od giełdy i inwestowania. Odpowiadaj po polsku, konkretnie i z humorem."
        },
        {
          role: "user",
          content: "Zrób szybką analizę spółki Apple (AAPL). Czy warto teraz kupować? Plusy, minusy i rekomendacja."
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 800,
    });

    console.log("\n✅ Sukces! Odpowiedź AI:\n");
    console.log(completion.choices[0]?.message?.content || "Brak treści");

  } catch (error) {
    console.error("\n❌ Błąd:", error.message);
    
    if (error.message.includes("API key") || error.message.includes("401")) {
      console.log("\nSprawdź te rzeczy:");
      console.log("1. Czy plik .env jest w folderze backend i nazywa się dokładnie .env (nie .env.txt!)");
      console.log("2. Czy linijka wygląda tak: GROQ_API_KEY=sk-XXXXXXXXXXXXXXXXXXXXXXXX");
      console.log("3. Czy na końcu klucza nie ma spacji ani entera");
      console.log("4. Czy klucz jest aktywny na https://console.groq.com/keys");
    }
  }
}

testAI();