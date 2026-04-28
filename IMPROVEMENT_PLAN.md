# Autograph — Plan Poprawek na Podstawie Recenzji AI

Synteza opinii **Grok + ChatGPT + Gemini**. Pogrupowane wg priorytetu.

---

## 🔴 P0 — KRYTYCZNE (sprzeczność AI = brak zaufania)

### A. Spójność rekomendacji AI
- [ ] **A1.** Usunąć regex post-processing w `server.js` który podmienia frazy w summary (Gemini: "POST-PROCESSING" → tworzy potworki językowe typu "z powodu silnego oporu warunki wejścia są solidne")
- [ ] **A2.** Wymusić strukturalne wyjście z Gemini przez `responseSchema` (zamiast parsowania tekstu)
- [ ] **A3.** Zmniejszyć `temperature` do 0.1–0.2 dla decyzji (oddzielnie wyższa tylko dla narracji)
- [ ] **A4.** Dodać sekcję `=== CONSISTENCY RULES ===` na końcu promptu jako ostatnią twardą regułę:
  - Jeśli `recommendation = LONG` → entry < TP, SL < entry, micro_trend nie może być "spadkowy"
  - Jeśli computed_rr < 1.5 → confidence_level = NISKA i `recommendation` zostaje, ale dodaj jasny disclaimer
  - `bull_case.length > bear_case.length` musi zgadzać się z `recommendation`
- [ ] **A5.** Walidacja po stronie serwera (po parsowaniu odpowiedzi AI): odrzuć i wyślij ponownie jeśli:
  - LONG ale SL > entry
  - SHORT ale SL < entry
  - TP w odległości < 1×ATR od entry (śmieciowy target)
- [ ] **A6.** Drugi pass AI (lżejszy model — Gemma/Flash) tylko do **review spójności** głównej odpowiedzi

### B. Logika Quant
- [ ] **B1.** Take Profit oparty o **ATR** zamiast sztywnego 5% (Gemini): `TP = entry + N×ATR` gdzie N=2-3, zamiast `lastC * 1.05`
- [ ] **B2.** Naprawić błąd matematyczny EV — komunikat "R:R 1:1 = ujemna wartość oczekiwana" jest błędny. EV zależy też od Win Rate. Tekst powinien brzmieć: "R:R 1:1 wymaga >50% skuteczności żeby być rentowny"
- [ ] **B3.** Composite Score — kara za sprzeczne sygnały. Score 100/100 nie powinno być standardem. Dodać **penalty** gdy:
  - Mikro trend ≠ Makro trend (–10 pkt)
  - MACD bullish ale RSI > 75 (–8 pkt)
  - Death Cross aktywny — automatycznie cap na 70/100
- [ ] **B4.** Dla ekstremalnych P/E (>50) lub PEG (>5) — obniżyć wagę `Trend` (40% → 25%), podnieść `Volatility` (20% → 35%)

### C. Market Structure (brak — ChatGPT)
- [ ] **C1.** Detekcja **HH/HL/LH/LL** z ostatnich N pivotów → dodać do `quant_stats.market_structure`
- [ ] **C2.** **Multi-timeframe trend** — pokazywać oddzielnie:
  - Short-term (EMA9/21)
  - Mid-term (EMA50)
  - Long-term (EMA200)
- [ ] **C3.** Klasyfikacja kontekstu: **TREND / KOREKTA / REVERSAL / RANGE** — już jest setup_type, ale potrzebuje wsparcia struktury rynku

---

## 🟠 P1 — WYSOKI (UX i język)

### D. Język polski
- [ ] **D1.** Stworzyć `frontend/src/i18n/dictionary.json` ze słownikiem terminów (wykupienie, wyprzedanie, złoty krzyż, krzyż śmierci itd.)
- [ ] **D2.** Audyt **wszystkich** hardkodowanych stringów w `server.js` — uzupełnić polskie znaki:
  - "Podwyzszony ryzyko" → "Podwyższone ryzyko"
  - "wielkosc pozycji" → "wielkość pozycji"
  - cały prompt AI też z poprawną polszczyzną
- [ ] **D3.** Eliminacja "Polglish" — zdecydować PL XOR EN (rekomenduję PL z technicznymi skrótami EN tylko gdzie standard: RSI, MACD, R:R)
- [ ] **D4.** Literówki:
  - "WYGRAŻAJĄCY" → "WYKUPIONY"
  - "słaby momentum" → "słabe momentum"
  - "SŁABY WZROSTOWY" → "Słaby trend wzrostowy"
- [ ] **D5.** Wzmocnienie instrukcji językowej w promcie: "Używaj wyłącznie poprawnego, profesjonalnego języka polskiego giełdowego. Zachowaj polskie znaki diakrytyczne."

### E. Hierarchia informacji (UX)
- [ ] **E1.** Refactor banera "KUP" — dodać **drugą linię narracji**: "Krótkoterminowe momentum bycze, ale długoterminowy trend negatywny — wejście tylko z ciasnym SL"
- [ ] **E2.** Zmiana wording: "KUP" → "Rekomendacja: LONG (średnie przekonanie)"
- [ ] **E3.** **Tooltip dysonansu** — gdy w jednej karcie zielony LONG a niżej Death Cross czerwony, pokaż info "?": "Dlaczego LONG mimo Death Cross? → silne momentum krótkoterminowe"
- [ ] **E4.** Dominujący scenariusz Bull/Bear — większa karta dla wybranego, mniejsza dla przeciwnego (już częściowo jest, dopracować)
- [ ] **E5.** Skrócić tekst AI summary do max 3 paragrafów × 3 zdania

### F. Czytelność / kontrast
- [ ] **F1.** Audyt wszystkich `fontSize: '0.55rem'` / `'0.58rem'` / `'0.6rem'` → **minimum 0.72rem (~11.5px)** dla labelek, **0.85rem (~13.5px)** dla wartości, **1rem** dla treści narracji
- [ ] **F2.** Kontrast: `var(--text-muted)` jest często `#64748b` na `#0a0e17` — ratio ~3.2:1 (nie spełnia WCAG AA 4.5:1). Podnieść muted do `#94a3b8` lub `#a3aec0`
- [ ] **F3.** Disclaimer u góry strony i w stopce: "⚠️ Niniejsze treści mają charakter edukacyjny i nie stanowią rekomendacji inwestycyjnej w rozumieniu MAR"

### G. Layout / nawigacja
- [ ] **G1.** Tabs lub Accordion: **Sygnał | Techniczna | Fundamentalna | AI Narrative | Anomalie** — domyślnie otwarty tylko "Sygnał" + "AI Narrative"
- [ ] **G2.** Sticky decision banner przy scrollu — żeby zawsze było widać werdykt
- [ ] **G3.** Wskaźniki techniczne — collapse expandable z "Pokaż wszystkie 9" zamiast wszystkich naraz

---

## 🟡 P2 — ŚREDNI (transparentność, jakość)

### H. Transparentność scoringu
- [ ] **H1.** **Signal Breakdown** w głównym banerze (już jest częściowo w consensus banner, dopracować):
  ```
  Trend: +28/40
  Momentum: +18/30
  Volatility: +12/20
  Sentyment: +5/10
  ────────────
  Total: 63/100 → LONG
  ```
- [ ] **H2.** Klikalne komponenty score — kliknięcie "Trend" rozwija które wskaźniki dały ile punktów

### I. Walidacja danych
- [ ] **I1.** Sprawdzić zegar serwera — daty na zrzutach to 28.04.2026, wykresy kończą się w marcu 2026. Sanity-check `Date.now()` vs ostatni timestamp danych
- [ ] **I2.** Sanity-check targetów AI — odrzuć jeśli `|TP - entry| < 1×ATR` (Gemini: TP $306 vs entry $306.21 = absurd)
- [ ] **I3.** Confidence cap — automatyczne obniżenie do MEDIUM gdy ≥2 wskaźniki sprzeczne; do LOW gdy ≥3

### J. Logging / debugging
- [ ] **J1.** Logowanie pełnej odpowiedzi AI przed post-processingiem (aktualnie po regex można nie zauważyć halucynacji)
- [ ] **J2.** Metryki: ile razy AI dało LONG/SHORT/NEUTRAL na ostatnie 100 zapytań — wykryje optymistyczny bias

---

## 🟢 P3 — NICE TO HAVE

- [ ] **K1.** Eksport PDF z całą analizą (już jest `window.print()`, dopracować print-stylesheet)
- [ ] **K2.** Historia rekomendacji per ticker — pokazać jak system oceniał ten sam ticker tydzień/miesiąc temu
- [ ] **K3.** Backtest: ile setupów wskazanych przez system zadziałało (Win Rate, średni R:R osiągnięty)
- [ ] **K4.** Dark/light theme toggle
- [ ] **K5.** Mobilna wersja — obecny dashboard jest przeładowany na <768px

---

## 📊 Co działa świetnie (zachować!)

- ✅ Architektura backendu: cache, rate-limit, Massive+Finnhub fallback
- ✅ Wskaźniki obliczane na backendzie (deterministyczne, nie zależne od AI)
- ✅ Kalendarium Anomalii + deep-dive z Gemma streaming
- ✅ Trend Alignment Matrix
- ✅ Wykres Chart.js z zoomem, klikalnymi anomaliami i volatile days
- ✅ Glassmorphism + neon accents — design premium poziom Bloomberg/TradingView
- ✅ Watchlist + IndicatorPrefs persystowane w localStorage
- ✅ ErrorBoundary

---

## 🎯 Sugerowana kolejność implementacji

**Sprint 1 (krytyczne — 1-2 tygodnie):**
A1, A2, A4, A5, B1, B2, B3, D1, D2, D4, F1

**Sprint 2 (UX — 1 tydzień):**
E1, E2, E3, F2, F3, G1, H1

**Sprint 3 (głębsze):**
A6, B4, C1, C2, I1, I2, J1
