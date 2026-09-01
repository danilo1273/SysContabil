import React, { useState } from 'react';
import { getSettings, saveSettings } from '../utils/db';

const LoginScreen = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Inicializar usuários se não existirem no DB central
    let users = [];
    try {
      const stored = await getSettings('agf_users');
      if (stored && Array.isArray(stored)) {
        users = stored;
        if (!users.find(u => u.username === 'danilo')) {
          users.push({ username: 'danilo', password: '82190650', role: 'superadmin' });
          await saveSettings('agf_users', users);
        }
      } else {
        users = [
          { username: 'danilo', password: '82190650', role: 'superadmin' },
          { username: 'admin', password: 'admin', role: 'admin' },
          { username: 'viewer', password: '123', role: 'viewer' }
        ];
        await saveSettings('agf_users', users);
      }
    } catch (err) {
      console.error(err);
      setError('Erro: ' + (err.message || String(err)));
      setIsLoading(false);
      return;
    }

    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      onLogin(user);
    } else {
      setError('Usuário ou senha incorretos.');
    }
    setIsLoading(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#121212', color: '#fff', fontFamily: 'sans-serif' }}>
      <form onSubmit={handleLogin} style={{ background: '#1e1e1e', padding: '3rem', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <h1 style={{ color: 'var(--color-primary, #FF9800)', marginBottom: '0.5rem' }}>AGF GROUP</h1>
        <p style={{ color: '#aaa', marginBottom: '2rem' }}>Módulo de BI e Auditoria</p>
        
        <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#ccc' }}>Usuário</label>
          <input 
            type="text" 
            value={username}
            onChange={e => setUsername(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #333', background: '#2a2a2a', color: '#fff' }}
            required
          />
        </div>

        <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#ccc' }}>Senha</label>
          <input 
            type="password" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #333', background: '#2a2a2a', color: '#fff' }}
            required
          />
        </div>

        {error && <p style={{ color: '#f44336', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}

        <button type="submit" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: 'none', background: 'var(--color-primary, #FF9800)', color: '#000', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
          Entrar no Sistema
        </button>
      </form>
    </div>
  );
};

export default LoginScreen;
