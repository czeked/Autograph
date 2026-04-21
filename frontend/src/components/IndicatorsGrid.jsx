import React from 'react';
import { Zap } from 'lucide-react';
import GlassCard from './GlassCard.jsx';

const Row = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
    <span>{label}</span>
    <span style={{ color: color || '#fff' }}>{value}</span>
  </div>
);

const Card = ({ title, titleColor, children }) => (
  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '0.85rem', border: '1px solid rgba(255,255,255,0.04)', transition: 'border-color 0.2s, background 0.2s' }}>
    <div style={{ fontSize: '0.65rem', color: titleColor, fontWeight: 'bold', marginBottom: '0.6rem', letterSpacing: '0.08em', paddingBottom: '0.4rem', borderBottom: `1px solid ${titleColor}22` }}>{title}</div>
    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {children}
    </div>
  </div>
);

const Sep = () => <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.08)' }} />;

export default function IndicatorsGrid({ qs }) {
  if (!qs) return null;
  return (
    <GlassCard style={{ borderTop: '4px solid var(--accent-green)', marginBottom: '2rem', marginTop: '1.5rem' }}>
      <h3 className="card-title" style={{ color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Zap size={18} color="var(--accent-green)" /> Wskaźniki Techniczne
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>

        <Card title="EMA CROSSOVERS" titleColor="var(--accent-blue)">
          <Row label="EMA 9"   value={`$${qs.ema9}`} />
          <Row label="EMA 21"  value={`$${qs.ema21}`} />
          <Row label="EMA 50"  value={`$${qs.ema50}`} />
          <Row label="EMA 200" value={`$${qs.ema200}`} />
          <Sep />
          <div style={{ fontSize: '0.7rem', color: qs.golden_death_cross?.includes('Golden') ? 'var(--accent-green)' : 'var(--accent-red)' }}>{qs.golden_death_cross}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{qs.price_vs_ema200}</div>
        </Card>

        <Card title="MACD (12/26/9)" titleColor="#f59e0b">
          <Row label="MACD"      value={qs.macd}      color={parseFloat(qs.macd) > 0 ? 'var(--accent-green)' : 'var(--accent-red)'} />
          <Row label="Signal"    value={qs.macd_signal} />
          <Row label="Histogram" value={qs.macd_histogram} color={parseFloat(qs.macd_histogram) > 0 ? 'var(--accent-green)' : 'var(--accent-red)'} />
          <Sep />
          <div style={{ fontSize: '0.7rem', color: qs.macd_cross?.includes('BULL') ? 'var(--accent-green)' : 'var(--accent-red)' }}>{qs.macd_cross}</div>
        </Card>

        <Card title="BOLLINGER BANDS (20/2)" titleColor="var(--accent-purple)">
          <Row label="Upper"  value={`$${qs.bb_upper}`} />
          <Row label="Middle" value={`$${qs.bb_middle}`} />
          <Row label="Lower"  value={`$${qs.bb_lower}`} />
          <Row label="%B"     value={qs.bb_percentB} />
          <Sep />
          <div style={{ fontSize: '0.7rem', color: qs.bb_squeeze?.includes('Squeeze') ? '#f59e0b' : 'var(--text-muted)' }}>{qs.bb_squeeze} - {qs.bb_position}</div>
        </Card>

        <Card title="ADX - SILA TRENDU (14)" titleColor="var(--accent-red)">
          <Row label="ADX"  value={qs.adx}           color={parseFloat(qs.adx) > 25 ? 'var(--accent-green)' : '#f59e0b'} />
          <Row label="+DI"  value={qs.adx_plus_di}   color="var(--accent-green)" />
          <Row label="-DI"  value={qs.adx_minus_di}  color="var(--accent-red)" />
          <Sep />
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{qs.adx_trend}</div>
        </Card>

        <Card title="ATR - ZMIENNOSC (14)" titleColor="#94a3b8">
          <Row label="ATR ($)" value={`$${qs.atr}`} />
          <Row label="ATR (%)" value={qs.atr_percent} />
          <Sep />
          <div style={{ fontSize: '0.7rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>SL (2xATR): </span>
            <span style={{ color: 'var(--accent-red)', fontWeight: 'bold' }}>{qs.atr_stop_loss}</span>
          </div>
        </Card>

        <Card title="STOCH RSI (14/3/3)" titleColor="var(--accent-blue)">
          <Row label="K" value={qs.stoch_rsi_k} color={parseFloat(qs.stoch_rsi_k) > 80 ? 'var(--accent-red)' : parseFloat(qs.stoch_rsi_k) < 20 ? 'var(--accent-green)' : '#fff'} />
          <Row label="D" value={qs.stoch_rsi_d} />
          <Sep />
          <div style={{ fontSize: '0.7rem', color: qs.stoch_rsi_signal?.includes('Wykup') ? 'var(--accent-red)' : qs.stoch_rsi_signal?.includes('Wyprz') ? 'var(--accent-green)' : 'var(--text-muted)' }}>{qs.stoch_rsi_signal}</div>
        </Card>

        <Card title="FIBONACCI (52W)" titleColor="#a78bfa">
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px' }}>High: <span style={{ color: 'var(--accent-green)' }}>${qs.high52w}</span> | Low: <span style={{ color: 'var(--accent-red)' }}>${qs.low52w}</span></div>
          <Row label="23.6%" value={`$${qs.fib_236}`} />
          <Row label="38.2%" value={`$${qs.fib_382}`} />
          <Row label="50.0%" value={`$${qs.fib_500}`} />
          <Row label="61.8%" value={`$${qs.fib_618}`} />
          <Row label="78.6%" value={`$${qs.fib_786}`} />
        </Card>

        <Card title="PIVOT POINTS (tydz.)" titleColor="#38bdf8">
          <Row label="R2" value={`$${qs.pivot_r2}`} color="var(--accent-red)" />
          <Row label="R1" value={`$${qs.pivot_r1}`} color="rgba(239,68,68,0.7)" />
          <Row label="P"  value={`$${qs.pivot_p}`}  color="#fff" />
          <Row label="S1" value={`$${qs.pivot_s1}`} color="rgba(16,185,129,0.7)" />
          <Row label="S2" value={`$${qs.pivot_s2}`} color="var(--accent-green)" />
          <Sep />
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>OBV: {qs.obv_trend}</div>
        </Card>

        <Card title="FUNDAMENTY" titleColor="#fbbf24">
          <Row label="P/E" value={qs.pe_ratio} />
          <Row label="P/B" value={qs.pb_ratio} />
          <Row label="EPS Growth 3Y"  value={qs.eps_growth}     color={parseFloat(qs.eps_growth) > 0 ? 'var(--accent-green)' : 'var(--accent-red)'} />
          <Row label="Rev Growth 3Y"  value={qs.revenue_growth} color={parseFloat(qs.revenue_growth) > 0 ? 'var(--accent-green)' : 'var(--accent-red)'} />
          <Sep />
          <div style={{ fontSize: '0.7rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>SMA20: </span><span style={{ color: '#fff' }}>${qs.sma20}</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>SMA50: </span><span style={{ color: '#fff' }}>${qs.sma50}</span>
          </div>
        </Card>

      </div>
    </GlassCard>
  );
}
