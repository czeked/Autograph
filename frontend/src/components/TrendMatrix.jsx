import React from 'react';
import GlassCard from './GlassCard.jsx';


const sigColor = s => s === 'BULL' ? 'var(--accent-green)' : s === 'BEAR' ? 'var(--accent-red)' : s === 'OVERBOUGHT' ? 'var(--accent-red)' : s === 'OVERSOLD' ? 'var(--accent-green)' : '#f59e0b';
const sigBg = s => s === 'BULL' ? 'rgba(16,185,129,0.12)' : s === 'BEAR' ? 'rgba(239,68,68,0.12)' : s === 'OVERBOUGHT' ? 'rgba(239,68,68,0.12)' : s === 'OVERSOLD' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.1)';
const sigLabel = s => s === 'BULL' ? 'BULL' : s === 'BEAR' ? 'BEAR' : s === 'OVERBOUGHT' ? 'OB' : s === 'OVERSOLD' ? 'OS' : s || 'N/A';

export default function TrendMatrix({ matrix }) {
  if (!matrix?.length) return null;
  return (
    <GlassCard style={{ marginBottom: '2rem' }}>
      <h3 className="card-title" style={{ color: '#fff', marginBottom: '1rem' }}>Trend Alignment Matrix</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>INDICATOR</th>
              {matrix.map(m => <th key={m.label} style={{ textAlign: 'center', padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>{m.label}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>Price Change</td>
              {matrix.map(m => <td key={m.label} style={{ textAlign: 'center', padding: '8px 12px', color: m.pct === null ? '#64748b' : m.pct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>{m.pct === null ? 'N/A' : (m.pct >= 0 ? '+' : '') + m.pct.toFixed(1) + '%'}</td>)}
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>EMA Cross (9/21)</td>
              {matrix.map(m => <td key={m.label} style={{ textAlign: 'center', padding: '6px 12px' }}><span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: sigColor(m.emaSignal), background: sigBg(m.emaSignal), padding: '2px 7px', borderRadius: '4px' }}>{sigLabel(m.emaSignal)}</span></td>)}
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>MACD</td>
              {matrix.map(m => <td key={m.label} style={{ textAlign: 'center', padding: '6px 12px' }}><span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: sigColor(m.macdSignal), background: sigBg(m.macdSignal), padding: '2px 7px', borderRadius: '4px' }}>{sigLabel(m.macdSignal)}</span></td>)}
            </tr>
            <tr>
              <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>RSI Zone</td>
              {matrix.map(m => <td key={m.label} style={{ textAlign: 'center', padding: '6px 12px' }}><span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: sigColor(m.rsiSignal), background: sigBg(m.rsiSignal), padding: '2px 7px', borderRadius: '4px' }}>{sigLabel(m.rsiSignal)}</span></td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
