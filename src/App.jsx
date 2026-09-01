import React, { useState, useEffect, useCallback } from 'react';
import ProtheusModule from './components/ProtheusModule';
import LoginScreen from './components/LoginScreen';
import UserPanel from './components/UserPanel';
import UserProfileModal from './components/UserProfileModal';
import './App.css';

import { Bell } from 'lucide-react';

const TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('agf_session');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  useEffect(() => {
    if (user) {
        const fetchNotifs = async () => {
            try {
                const res = await fetch(`/api/notifications?username=${user.username}`);
                const data = await res.json();
                setNotifications(data);
            } catch(e){}
        };
        fetchNotifs();
        const interval = setInterval(fetchNotifs, 60000); // 1 minute polling
        return () => clearInterval(interval);
    }
  }, [user]);

  const handleSetUser = (newUser) => {
    setUser(newUser);
    if (newUser) {
      localStorage.setItem('agf_session', JSON.stringify(newUser));
    } else {
      localStorage.removeItem('agf_session');
    }
  };

  const handleLogout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('agf_session');
  }, []);

  useEffect(() => {
    let timeoutId;
    
    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (user) {
        timeoutId = setTimeout(handleLogout, TIMEOUT_MS);
      }
    };

    if (user) {
      window.addEventListener('mousemove', resetTimer);
      window.addEventListener('keydown', resetTimer);
      window.addEventListener('scroll', resetTimer);
      resetTimer();
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('scroll', resetTimer);
    };
  }, [user, handleLogout]);

  if (!user) {
    return <LoginScreen onLogin={handleSetUser} />;
  }

  return (
    <div className="app-container">
      <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="logo-placeholder">AGF</div>
          <div>
            <h1>AGF GROUP - Contabilidade</h1>
            <p style={{ color: '#aaa', margin: 0 }}>Módulo de BI e Auditoria</p>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {user.role === 'superadmin' && (
              <button onClick={() => setShowUserPanel(true)} style={{ padding: '0.5rem 1rem', background: '#2196F3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>👥 Gerenciar Usuários</button>
            )}
            <div style={{ position: 'relative' }}>
          <button onClick={() => setShowNotifPanel(!showNotifPanel)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Bell size={24} />
            {notifications.length > 0 && (
              <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#f44336', color: '#fff', fontSize: '0.7rem', fontWeight: 'bold', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {notifications.length}
              </span>
            )}
          </button>
          
          {showNotifPanel && (
            <>
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} onClick={() => setShowNotifPanel(false)} />
              <div style={{ position: 'absolute', top: '100%', right: '0', marginTop: '10px', background: '#1e1e1e', border: '1px solid #333', borderRadius: '8px', width: '300px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, color: '#fff' }}>Notificações</h4>
                  <button onClick={() => setShowNotifPanel(false)} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <p style={{ color: '#888', padding: '1rem', textAlign: 'center', margin: 0 }}>Nenhuma pendência hoje.</p>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('agf_navigate', { detail: n.link }));
                          setShowNotifPanel(false);
                        }}
                        style={{ padding: '1rem', borderBottom: '1px solid #333', borderLeft: `3px solid ${n.type === 'danger' ? '#f44336' : n.type === 'warning' ? '#FFC107' : '#2196F3'}`, cursor: 'pointer', transition: 'background 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <strong style={{ color: '#fff', fontSize: '0.85rem', display: 'block' }}>{n.title}</strong>
                        <p style={{ color: '#aaa', fontSize: '0.8rem', margin: '0.3rem 0 0 0' }}>{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowProfile(true)} title="Clique para alterar sua senha">
          <span style={{ color: '#aaa', fontSize: '0.9rem' }}>
            Logado como <strong style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>{user.username}</strong>
          </span>
        </div>
        <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Sair</button>
      </div>
    </header>
    <main className="main-content">
      <ProtheusModule userRole={user.role} userPermissions={user.permissions || []} username={user.username} />
    </main>
    {showUserPanel && <UserPanel onClose={() => setShowUserPanel(false)} />}
    {showProfile && <UserProfileModal user={user} onClose={() => setShowProfile(false)} />}
  </div>
  );
}

export default App;
