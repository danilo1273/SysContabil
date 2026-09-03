import React, { useState, useEffect, useCallback } from 'react';
import ProtheusModule from './components/ProtheusModule';
import LoginScreen from './components/LoginScreen';
import ModuleSelectionScreen from './components/ModuleSelectionScreen';
import UserPanel from './components/UserPanel';
import UserProfileModal from './components/UserProfileModal';
import GlobalDialog from './components/GlobalDialog';
import './utils/dialog';
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
  const [selectedModule, setSelectedModule] = useState(null); // 'indicadores' | 'contabil' | null
  const [showModuleMenu, setShowModuleMenu] = useState(false);
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
    setSelectedModule(null);
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
      <GlobalDialog />
      <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="logo-placeholder" style={{ cursor: 'pointer' }} onClick={() => setSelectedModule(null)} title="Menu de Módulos">AGF</div>
          <div>
            <h1 style={{ cursor: 'pointer' }} onClick={() => setSelectedModule(null)}>AGF GROUP - Contabilidade</h1>
            <p style={{ color: '#aaa', margin: 0 }}>Módulo de BI e Auditoria</p>
          </div>

          {selectedModule && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.6rem', marginLeft: '1rem', borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '1rem' }}>
              
              {/* TRIGGER DO MENU SUSPENSO */}
              <button
                onClick={() => setShowModuleMenu(!showModuleMenu)}
                style={{
                  background: selectedModule === 'indicadores' ? 'rgba(33, 150, 243, 0.18)' : 'rgba(212, 175, 55, 0.18)',
                  color: selectedModule === 'indicadores' ? '#64B5F6' : '#FFD54F',
                  border: `1px solid ${selectedModule === 'indicadores' ? 'rgba(33, 150, 243, 0.45)' : 'rgba(212, 175, 55, 0.45)'}`,
                  padding: '0.4rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                  transition: 'all 0.2s'
                }}
                title="Clique para alternar o módulo de acesso"
              >
                <span>{selectedModule === 'indicadores' ? '📊 Indicadores Executivos' : '💼 Sistema Contábil'}</span>
                <span style={{ fontSize: '0.68rem', transition: 'transform 0.2s', transform: showModuleMenu ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.8 }}>▼</span>
              </button>

              {/* DROPDOWN MENU SUSPENSO */}
              {showModuleMenu && (
                <>
                  <div 
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }} 
                    onClick={() => setShowModuleMenu(false)} 
                  />
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: '1rem',
                    width: '310px',
                    background: 'rgba(22, 22, 30, 0.97)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8)',
                    zIndex: 9999,
                    overflow: 'hidden',
                    padding: '0.5rem',
                    animation: 'scaleUp 0.15s ease-out'
                  }}>
                    <div style={{ padding: '0.4rem 0.8rem 0.5rem 0.8rem', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '0.73rem', textTransform: 'uppercase', color: '#888', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                      Alternar Módulo / Ambiente
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                      
                      {/* OPÇÃO 1: SISTEMA CONTÁBIL */}
                      <button
                        onClick={() => {
                          setSelectedModule('contabil');
                          setShowModuleMenu(false);
                        }}
                        style={{
                          background: selectedModule === 'contabil' ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
                          border: selectedModule === 'contabil' ? '1px solid rgba(212, 175, 55, 0.35)' : '1px solid transparent',
                          borderRadius: '8px',
                          padding: '0.65rem 0.85rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => { if (selectedModule !== 'contabil') e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                        onMouseLeave={(e) => { if (selectedModule !== 'contabil') e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ fontSize: '1.4rem' }}>💼</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: selectedModule === 'contabil' ? '#FFD54F' : '#fff', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>Sistema Contábil</span>
                            {selectedModule === 'contabil' && <span style={{ fontSize: '0.68rem', color: '#000', background: '#FFD54F', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>ATIVO</span>}
                          </div>
                          <div style={{ color: '#aaa', fontSize: '0.74rem', marginTop: '2px' }}>DRE, Balanço, Holding, Fiscal, etc.</div>
                        </div>
                      </button>

                      {/* OPÇÃO 2: INDICADORES */}
                      <button
                        onClick={() => {
                          setSelectedModule('indicadores');
                          setShowModuleMenu(false);
                        }}
                        style={{
                          background: selectedModule === 'indicadores' ? 'rgba(33, 150, 243, 0.15)' : 'transparent',
                          border: selectedModule === 'indicadores' ? '1px solid rgba(33, 150, 243, 0.35)' : '1px solid transparent',
                          borderRadius: '8px',
                          padding: '0.65rem 0.85rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => { if (selectedModule !== 'indicadores') e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                        onMouseLeave={(e) => { if (selectedModule !== 'indicadores') e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ fontSize: '1.4rem' }}>📊</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: selectedModule === 'indicadores' ? '#64B5F6' : '#fff', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>Indicadores Executivos</span>
                            {selectedModule === 'indicadores' && <span style={{ fontSize: '0.68rem', color: '#fff', background: '#2196F3', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>ATIVO</span>}
                          </div>
                          <div style={{ color: '#aaa', fontSize: '0.74rem', marginTop: '2px' }}>Painel Executivo, Endividamento & KPIs</div>
                        </div>
                      </button>

                    </div>

                    <div style={{ margin: '0.5rem 0', borderTop: '1px solid rgba(255,255,255,0.08)' }} />

                    {/* MENU PRINCIPAL */}
                    <button
                      onClick={() => {
                        setSelectedModule(null);
                        setShowModuleMenu(false);
                      }}
                      style={{
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '0.5rem 0.8rem',
                        textAlign: 'center',
                        color: '#ccc',
                        fontSize: '0.82rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#ccc'; }}
                    >
                      <span>⊞</span> Menu Geral de Módulos
                    </button>

                  </div>
                </>
              )}

            </div>
          )}
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
      {!selectedModule ? (
        <ModuleSelectionScreen user={user} onSelectModule={(mod) => setSelectedModule(mod)} />
      ) : (
        <ProtheusModule 
          userRole={user.role} 
          userPermissions={user.permissions || []} 
          username={user.username} 
          moduleMode={selectedModule} 
          onBackToModules={() => setSelectedModule(null)} 
        />
      )}
    </main>
    {showUserPanel && <UserPanel onClose={() => setShowUserPanel(false)} />}
    {showProfile && <UserProfileModal user={user} onClose={() => setShowProfile(false)} />}
  </div>
  );
}

export default App;
