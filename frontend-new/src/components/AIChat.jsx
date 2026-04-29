import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

function formatBotResponse(data) {
  if (typeof data === 'string') return data;
  const parts = [];
  if (data.summary)        parts.push(`Summary\n${data.summary}`);
  if (data.insight)        parts.push(`Insight\n${data.insight}`);
  if (data.risk)           parts.push(`Risk\n${data.risk}`);
  if (data.recommendation) parts.push(`Recommendation\n${data.recommendation}`);
  return parts.join('\n\n') || JSON.stringify(data);
}

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [msg, setMsg]   = useState('');
  const [chat, setChat] = useState([]);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  const send = async () => {
    if (!msg.trim() || busy) return;
    const query = msg.trim();
    setMsg('');
    setChat(prev => [...prev, { role: 'user', text: query }]);
    setBusy(true);
    try {
      const res = await axios.get('http://localhost:8000/ai/ask', { params: { query } });
      setChat(prev => [...prev, { role: 'ai', text: formatBotResponse(res.data) }]);
    } catch {
      setChat(prev => [...prev, { role: 'ai', text: 'Unable to reach the AI service. Please try again.' }]);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 24, right: 24,
          height: 36, padding: '0 14px',
          borderRadius: 18,
          background: open ? 'var(--surface2)' : 'var(--accent)',
          border: '1px solid ' + (open ? 'var(--border2)' : 'rgba(201,151,10,0.6)'),
          color: open ? 'var(--text2)' : 'var(--bg)',
          display: 'flex', alignItems: 'center', gap: 7,
          cursor: 'pointer', zIndex: 9999,
          boxShadow: open ? 'none' : '0 2px 12px rgba(201,151,10,0.25)',
          transition: 'all 0.2s',
        }}
      >
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: open ? 'var(--text3)' : 'rgba(0,0,0,0.4)',
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
          letterSpacing: '0.8px',
        }}>
          {open ? 'CLOSE' : 'AI'}
        </span>
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 78, right: 24,
          width: 340, height: 460,
          background: 'var(--surface)',
          border: '1px solid var(--border2)',
          borderRadius: 10, display: 'flex', flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)', zIndex: 9999,
          animation: 'fadeUp 0.2s ease',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>AI Assistant</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 1 }}>
                Financial analysis · Gemini
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 5, color: 'var(--text3)', padding: '3px 8px',
                cursor: 'pointer', fontSize: 13,
              }}
            >
              &#215;
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 6px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {chat.length === 0 && (
              <div style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'center', marginTop: 30, lineHeight: 1.7 }}>
                Ask about budget utilization,<br />spending trends, or risk areas.
              </div>
            )}
            {chat.map((c, i) => (
              <div key={i} style={{
                alignSelf: c.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                background: c.role === 'user' ? 'var(--accent-dim)' : 'var(--surface2)',
                border: `1px solid ${c.role === 'user' ? 'rgba(201,151,10,0.2)' : 'var(--border)'}`,
                borderRadius: 6, padding: '9px 12px',
                fontSize: 12, color: c.role === 'user' ? 'var(--accent2)' : 'var(--text)',
                whiteSpace: 'pre-wrap', lineHeight: 1.6,
              }}>
                {c.text}
              </div>
            ))}
            {busy && (
              <div style={{
                alignSelf: 'flex-start',
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '9px 12px', fontSize: 12, color: 'var(--text3)',
              }}>
                Analyzing...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
            <input
              value={msg}
              onChange={e => setMsg(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ask a question..."
              disabled={busy}
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 6,
                border: '1px solid var(--border2)', background: 'var(--bg2)',
                color: 'var(--text)', fontSize: 12, outline: 'none',
                fontFamily: 'var(--sans)',
              }}
            />
            <button
              onClick={send}
              disabled={busy || !msg.trim()}
              style={{
                padding: '8px 14px', borderRadius: 6, border: 'none',
                background: busy || !msg.trim() ? 'var(--surface2)' : 'var(--accent)',
                color: busy || !msg.trim() ? 'var(--text3)' : 'var(--bg)',
                fontWeight: 600, fontSize: 12, cursor: busy ? 'default' : 'pointer',
                fontFamily: 'var(--sans)', transition: 'all 0.15s',
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
