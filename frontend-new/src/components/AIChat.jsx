import React, { useState } from 'react';
import axios from 'axios';

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [chat, setChat] = useState([]);

  const send = async () => {
    if (!msg.trim()) return;

    const userMessage = { type: 'user', text: msg };
    setChat(prev => [...prev, userMessage]);

    try {
      const res = await axios.get(`http://localhost:8000/ai/ask?query=${msg}`);

      const botMessage = {
        type: 'bot',
        text: res.data.answer
      };

      setChat(prev => [...prev, botMessage]);
    } catch (err) {
      setChat(prev => [...prev, { type: 'bot', text: 'Error connecting to AI' }]);
    }

    setMsg('');
  };

  return (
    <>
      {/* FLOAT BUTTON */}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          background: '#f5b400',
          padding: 14,
          borderRadius: '50%',
          cursor: 'pointer',
          zIndex: 9999,
          fontSize: 18
        }}
        onClick={() => setOpen(!open)}
      >
        💬
      </div>

      {/* CHAT BOX */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: 80,
          right: 20,
          width: 320,
          height: 420,
          background: '#0f1f3d',
          borderRadius: 12,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          zIndex: 9999
        }}>
          
          {/* MESSAGES */}
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: 10 }}>
            {chat.map((c, i) => (
              <div key={i} style={{
                textAlign: c.type === 'user' ? 'right' : 'left',
                margin: '6px 0',
                color: c.type === 'user' ? '#f5b400' : 'white'
              }}>
                {c.text}
              </div>
            ))}
          </div>

          {/* INPUT */}
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Ask something..."
            style={{
              padding: 8,
              borderRadius: 6,
              border: 'none',
              marginBottom: 6
            }}
          />

          <button onClick={send}>Send</button>
        </div>
      )}
    </>
  );
}