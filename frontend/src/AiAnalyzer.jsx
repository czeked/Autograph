import { useState } from 'react';

function AiAnalyzer() {
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const askAI = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setAnswer('');

    try {
      const res = await fetch('http://localhost:3001/api/analyze', {  
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (res.ok) {
        setAnswer(data.answer);
      } else {
        setAnswer('Błąd: ' + (data.error || 'Nieznany błąd'));
      }
    } catch (err) {
      setAnswer('Nie udało się połączyć z serwerem. Backend włączony?');
    }

    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px' }}>
      <h2>🤖 Trading AI Assistant</h2>
      
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Np. Analizuj Apple. Czy warto kupować teraz?"
        rows={4}
        style={{ width: '100%', padding: '12px', fontSize: '16px' }}
      />

      <br /><br />

      <button 
        onClick={askAI}
        disabled={loading || !prompt.trim()}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          background: loading ? '#666' : '#0066ff',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'AI myśli...' : 'Zapytaj AI'}
      </button>

      {answer && (
        <div style={{
          marginTop: '30px',
          padding: '20px',
          background: '#1e1e1e',
          borderRadius: '8px',
          whiteSpace: 'pre-wrap',
          lineHeight: '1.6'
        }}>
          <strong>Odpowiedź AI:</strong><br /><br />
          {answer}
        </div>
      )}
    </div>
  );
}

export default AiAnalyzer;