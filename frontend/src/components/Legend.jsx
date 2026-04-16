import React from 'react';
import { HelpCircle, X } from 'lucide-react';

const LEGEND_ITEMS = [
  { cat: 'OSCYLATORY MOMENTUM', color: '#a78bfa', items: [
    { name: 'RSI (14)', desc: 'Relative Strength Index — mierzy siłę trendu. >70 = wykupienie (możliwy szczyt), <30 = wyprzedanie (możliwe odbicie). Najlepiej działa w konsolidacji.' },
    { name: 'Stochastic RSI', desc: 'RSI z RSI — bardziej czuły. K i D >80 = silne wykupienie, <20 = silne wyprzedanie. Dobre wejścia przy crossoverach K/D.' },
    { name: 'Momentum 5d', desc: 'Zmiana ceny w ostatnich 5 dniach vs średnia. Pokazuje krótkoterminowe przyspieszenie lub hamowanie trendu.' },
  ]},
  { cat: 'TRENDY — EMA & SMA', color: '#38bdf8', items: [
    { name: 'EMA 9 / 21', desc: 'Krótkoterminowe wykładnicze średnie. Crossover EMA9>EMA21 = sygnał bullish. Używane do wejść w istniejący trend.' },
    { name: 'EMA 50 / 200', desc: 'Golden Cross (EMA50>EMA200) = silny trend wzrostowy długoterminowy. Death Cross (EMA50<EMA200) = trend spadkowy. Kluczowy sygnał instytucjonalny.' },
    { name: 'SMA 20 / 50', desc: 'Proste średnie kroczące. Cena powyżej SMA50 = trend wzrostowy. Nachylenie SMA50 wskazuje czy trend przyspiesza czy zwalnia.' },
  ]},
  { cat: 'MACD (12/26/9)', color: '#34d399', items: [
    { name: 'MACD Line', desc: 'Różnica EMA12 − EMA26. Gdy powyżej zera = momentum wzrostowe.' },
    { name: 'Signal Line', desc: 'EMA(9) z linii MACD. Crossover MACD>Signal = sygnał kupna. MACD<Signal = sygnał sprzedaży.' },
    { name: 'Histogram', desc: 'Różnica MACD − Signal. Rosnący histogram = przyspieszenie momentum. Słupki maleją przed zmianą trendu.' },
  ]},
  { cat: 'BOLLINGER BANDS (20/2σ)', color: '#f59e0b', items: [
    { name: '%B', desc: 'Pozycja ceny w paśmie. >80% = przy górnym paśmie (wykupienie), <20% = przy dolnym (wyprzedanie). 50% = środek.' },
    { name: 'Bandwidth / Squeeze', desc: 'Szerokość pasm. Squeeze (<5%) = kompresja zmienności, oczekuj silnego wybicia. Rozszerzenie = wysoka zmienność.' },
  ]},
  { cat: 'ADX — SIŁA TRENDU', color: '#fb923c', items: [
    { name: 'ADX', desc: 'Average Directional Index. <20 = brak trendu (boczny rynek), 20–25 = słaby trend, 25–40 = silny trend, >40 = bardzo silny. NIE mówi o kierunku!' },
    { name: '+DI / −DI', desc: 'Directional Indicators. +DI>−DI = trend wzrostowy, −DI>+DI = trend spadkowy. Razem z ADX dają pełny obraz siły i kierunku.' },
  ]},
  { cat: 'ATR — ZMIENNOŚĆ', color: '#e879f9', items: [
    { name: 'ATR (14)', desc: 'Average True Range — średni dzienny zasięg ruchu. Wyższy ATR = większa zmienność = szerszy stop loss potrzebny.' },
    { name: 'SL (2×ATR)', desc: 'Dynamiczny stop loss = cena − 2×ATR. Standard w zarządzaniu ryzykiem. Dostosowuje się do aktualnej zmienności.' },
  ]},
  { cat: 'FIBONACCI & PIVOT POINTS', color: '#a78bfa', items: [
    { name: 'Fibonacci', desc: 'Poziomy korekty od 52W High do 52W Low. 38.2%, 50%, 61.8% to najsilniejsze wsparcia/opory gdzie cena często się zatrzymuje.' },
    { name: 'Pivot Points', desc: 'Tygodniowe poziomy oporu (R1/R2) i wsparcia (S1/S2) obliczone z poprzedniego tygodnia. Traderzy instytucjonalni obserwują te poziomy.' },
  ]},
  { cat: 'OBV & WOLUMEN', color: '#34d399', items: [
    { name: 'OBV', desc: 'On-Balance Volume — skumulowany wolumen. Rosnący OBV przy rosnącej cenie = akumulacja (byczy). Spadający OBV = dystrybucja (niedźwiedzi).' },
    { name: 'Dystrybucja', desc: 'Cena spada przy rosnącym wolumenie = "smart money" sprzedaje. Silny sygnał ostrzegawczy nawet w trendzie wzrostowym.' },
  ]},
  { cat: 'FUNDAMENTY', color: '#fbbf24', items: [
    { name: 'P/E Ratio', desc: 'Cena / Zysk. Mówi ile płacisz za $1 zysku firmy. Wysokie P/E = droga lub szybkorosnąca spółka. Niskie P/E = tania lub wolnorosnąca.' },
    { name: 'P/B Ratio', desc: 'Cena / Wartość Księgowa. <1 = spółka tańsza niż jej aktywa (okazja lub pułapka). >3 = inwestorzy płacą premię za wzrost/markę.' },
    { name: 'EPS / Revenue Growth', desc: 'Wzrost zysku i przychodów na akcję w ciągu 3 lat. Fundamenty pod trendem. Rosnące EPS + rosnąca cena = zdrowy trend.' },
  ]},
  { cat: 'WSKAŹNIKI AI', color: '#818cf8', items: [
    { name: 'Sentiment Score', desc: '0–100. Agregat sentymentu wszystkich newsów (Massive API). <40 = rynek się boi, >60 = optymizm, >80 = euforia (ostrożność!).' },
    { name: 'Bull/Bear Case', desc: 'Konkretne argumenty za wzrostem i spadkiem wygenerowane przez AI na podstawie wskaźników. Każdy punkt zawiera liczby z danych.' },
    { name: 'Scenariusze (Radar)', desc: 'Dwa scenariusze: Bear i Bull z triggerami i targetami. AI wskazuje co musi się stać żeby każdy scenariusz się ziścił.' },
    { name: 'Trend Alignment Matrix', desc: 'Tabela wyrównania sygnałów w 4 timeframach (1T/1M/3M/1R). Im więcej zielonych BULL w jednym rzędzie, tym silniejszy confluent signal.' },
  ]},
];

export default function Legend({ onClose }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem', overflowY: 'auto' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem', maxWidth: '860px', width: '100%', position: 'relative' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HelpCircle size={20} color="var(--accent-blue)" /> Legenda wskaźników
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
            <X size={22} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
          {LEGEND_ITEMS.map((cat, ci) => (
            <div key={ci} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '1rem', borderLeft: `3px solid ${cat.color}` }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: cat.color, letterSpacing: '0.1em', marginBottom: '0.7rem' }}>{cat.cat}</div>
              {cat.items.map((item, ii) => (
                <div key={ii} style={{ marginBottom: '0.6rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#fff' }}>{item.name}</span>
                  <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>{item.desc}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p style={{ marginTop: '1.2rem', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Wskaźniki techniczne opisują stan historyczny — nie gwarantują przyszłych wyników. Zawsze stosuj zarządzanie ryzykiem.
        </p>
      </div>
    </div>
  );
}
