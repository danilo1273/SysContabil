import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../utils/db';
import { Users, RefreshCw, X, Clock, Shield, Search, Activity, Monitor } from 'lucide-react';

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutos para ser considerado Online
const IDLE_THRESHOLD_MS = 15 * 60 * 1000;  // 15 minutos para ser considerado Ausente/Ocioso

export default function OnlineUsersModal({ onClose }) {
  const [users, setUsers] = useState([]);
  const [presenceMap, setPresenceMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [storedUsers, storedPresence] = await Promise.all([
        getSettings('agf_users'),
        getSettings('agf_user_presence')
      ]);

      if (storedUsers && Array.isArray(storedUsers)) {
        setUsers(storedUsers);
      }

      let finalPresence = (storedPresence && typeof storedPresence === 'object') ? { ...storedPresence } : {};

      // Se há um usuário na sessão atual ativa neste navegador, garantir que a presença dele seja renovada agora
      try {
        const saved = localStorage.getItem('agf_session');
        if (saved) {
          const currentSessionUser = JSON.parse(saved);
          if (currentSessionUser && currentSessionUser.username) {
            const nowIso = new Date().toISOString();
            finalPresence[currentSessionUser.username] = {
              ...(finalPresence[currentSessionUser.username] || {}),
              username: currentSessionUser.username,
              role: currentSessionUser.role || 'user',
              last_active: nowIso,
              last_login: finalPresence[currentSessionUser.username]?.last_login || currentSessionUser.last_login || nowIso,
              module: finalPresence[currentSessionUser.username]?.module || 'Painel de Usuários'
            };
            // Salva a presença atualizada em segundo plano
            saveSettings('agf_user_presence', finalPresence).catch(() => {});
          }
        }
      } catch(e){}

      setPresenceMap(finalPresence);
    } catch (e) {
      console.error('Erro ao carregar presença de usuários:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000); // Atualiza a cada 15 segundos
    return () => clearInterval(interval);
  }, []);

  const now = Date.now();

  const getUserStatus = (username, userObj) => {
    const presence = presenceMap[username];
    const lastActiveStr = presence?.last_active || userObj?.last_active;
    const lastLoginStr = presence?.last_login || userObj?.last_login;
    const currentModule = presence?.module || presence?.currentPage || 'Desconectado';

    if (!lastActiveStr) {
      return {
        status: 'never',
        badge: '⚪ Nunca acessou',
        color: '#777',
        bg: 'rgba(255,255,255,0.05)',
        border: 'rgba(255,255,255,0.1)',
        lastActiveStr: null,
        lastLoginStr: lastLoginStr || null,
        currentModule: '-'
      };
    }

    const diff = now - new Date(lastActiveStr).getTime();

    if (diff <= ONLINE_THRESHOLD_MS) {
      return {
        status: 'online',
        badge: '🟢 Online agora',
        color: '#81C784',
        bg: 'rgba(76, 175, 80, 0.15)',
        border: '#4CAF50',
        lastActiveStr,
        lastLoginStr,
        currentModule
      };
    } else if (diff <= IDLE_THRESHOLD_MS) {
      const mins = Math.max(Math.round(diff / 60000), 1);
      return {
        status: 'idle',
        badge: `🟡 Ausente há ${mins}m`,
        color: '#FFB74D',
        bg: 'rgba(255, 152, 0, 0.15)',
        border: '#FF9800',
        lastActiveStr,
        lastLoginStr,
        currentModule
      };
    } else {
      return {
        status: 'offline',
        badge: '⚪ Offline',
        color: '#9E9E9E',
        bg: 'rgba(255, 255, 255, 0.04)',
        border: 'rgba(255, 255, 255, 0.1)',
        lastActiveStr,
        lastLoginStr,
        currentModule: '-'
      };
    }
  };

  const formatRelativeTime = (isoString) => {
    if (!isoString) return 'Nunca';
    try {
      const date = new Date(isoString);
      const diffMs = now - date.getTime();
      const diffMin = Math.round(diffMs / 60000);
      const diffHours = Math.round(diffMs / 3600000);
      const diffDays = Math.round(diffMs / 86400000);

      const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      if (diffMin < 2) return 'Agora mesmo';
      if (diffMin < 60) return `Há ${diffMin} minutos (${timeStr})`;
      if (diffHours < 24) return `Hoje às ${timeStr} (há ${diffHours}h)`;
      if (diffDays === 1) return `Ontem às ${timeStr}`;
      return `${dateStr} às ${timeStr}`;
    } catch (e) {
      return isoString;
    }
  };

  // Contadores
  let onlineCount = 0;
  let activeTodayCount = 0;

  users.forEach(u => {
    const st = getUserStatus(u.username, u);
    if (st.status === 'online') onlineCount++;
    if (st.lastActiveStr) {
      const d = new Date(st.lastActiveStr);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) {
        activeTodayCount++;
      }
    }
  });

  const filteredUsers = users.filter(u => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const st = getUserStatus(u.username, u);
    return (
      (u.username || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term) ||
      (u.role || '').toLowerCase().includes(term) ||
      st.badge.toLowerCase().includes(term) ||
      st.currentModule.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: '1rem'
    }}>
      <div style={{
        background: '#181924', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '14px', width: '100%', maxWidth: '850px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.7)', color: '#fff', overflow: 'hidden'
      }}>
        {/* HEADER */}
        <div style={{
          padding: '1.2rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'rgba(76, 175, 80, 0.15)', border: '1px solid #4CAF50',
              color: '#81C784', padding: '6px', borderRadius: '8px', display: 'flex'
            }}>
              <Activity size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', fontWeight: 'bold' }}>
                Usuários Conectados & Atividade no Site
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#aaa' }}>
                Acompanhamento em tempo real de quem está usando o SysContábil e data do último acesso.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={loadData}
              disabled={loading}
              className="btn-secondary"
              style={{ padding: '0.45rem 0.8rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
              title="Recarregar status de presença"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> {loading ? 'Atualizando...' : 'Atualizar'}
            </button>
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', padding: '4px', fontSize: '1.2rem' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* METRICS CARDS */}
        <div style={{
          padding: '1rem 1.5rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.2)'
        }}>
          <div style={{
            background: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.3)',
            borderRadius: '10px', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '0.74rem', color: '#81C784', fontWeight: 'bold', textTransform: 'uppercase' }}>Online Agora</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#fff', marginTop: '2px' }}>{onlineCount}</div>
            </div>
            <span style={{ fontSize: '1.8rem' }}>🟢</span>
          </div>

          <div style={{
            background: 'rgba(33, 150, 243, 0.1)', border: '1px solid rgba(33, 150, 243, 0.3)',
            borderRadius: '10px', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '0.74rem', color: '#64B5F6', fontWeight: 'bold', textTransform: 'uppercase' }}>Acessaram Hoje</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#fff', marginTop: '2px' }}>{activeTodayCount}</div>
            </div>
            <span style={{ fontSize: '1.8rem' }}>🕒</span>
          </div>

          <div style={{
            background: 'rgba(255, 152, 0, 0.1)', border: '1px solid rgba(255, 152, 0, 0.3)',
            borderRadius: '10px', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '0.74rem', color: '#FFB74D', fontWeight: 'bold', textTransform: 'uppercase' }}>Total de Usuários</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#fff', marginTop: '2px' }}>{users.length}</div>
            </div>
            <span style={{ fontSize: '1.8rem' }}>👥</span>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div style={{ padding: '0.8rem 1.5rem 0.4rem 1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#777' }} />
            <input
              type="text"
              placeholder="Buscar por nome de usuário, e-mail ou módulo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-input"
              style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2rem', fontSize: '0.82rem' }}
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="btn-secondary"
              style={{ padding: '0.45rem 0.7rem', fontSize: '0.78rem' }}
            >
              Limpar
            </button>
          )}
        </div>

        {/* LISTA DE USUÁRIOS */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.8rem 1.5rem 1.2rem 1.5rem' }} className="custom-scrollbar">
          {filteredUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '0.85rem' }}>
              Nenhum usuário encontrado com o filtro "{searchTerm}".
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {filteredUsers.map(u => {
                const st = getUserStatus(u.username, u);
                const isSuper = u.role === 'superadmin' || ['danilo', 'ryan.santos', 'carol.cons', 'talita.alves'].includes(u.username);

                return (
                  <div
                    key={u.username}
                    style={{
                      background: st.status === 'online' ? 'rgba(76, 175, 80, 0.05)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${st.status === 'online' ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: '8px',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.8rem'
                    }}
                  >
                    {/* AVATAR + INFOS BÁSICAS */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        position: 'relative', width: '38px', height: '38px',
                        borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)',
                        border: `2px solid ${st.color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 'bold', fontSize: '0.95rem'
                      }}>
                        {u.username.substring(0, 2).toUpperCase()}
                        <span style={{
                          position: 'absolute', bottom: '-2px', right: '-2px',
                          width: '11px', height: '11px', borderRadius: '50%',
                          background: st.color, border: '2px solid #181924'
                        }} />
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <strong style={{ fontSize: '0.92rem', color: '#fff' }}>{u.username}</strong>
                        </div>
                        {u.email && (
                          <div style={{ fontSize: '0.74rem', color: '#888', marginTop: '2px' }}>
                            ✉️ {u.email}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* STATUS E MÓDULO ATUAL */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
                      <span style={{
                        background: st.bg, color: st.color, border: `1px solid ${st.border}`,
                        padding: '2px 8px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 'bold',
                        display: 'inline-flex', alignItems: 'center', gap: '5px', alignSelf: 'flex-start'
                      }}>
                        {st.badge}
                      </span>
                      {st.currentModule && st.currentModule !== '-' && (
                        <div style={{ fontSize: '0.72rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Monitor size={11} style={{ color: '#81C784' }} /> {st.currentModule}
                        </div>
                      )}
                    </div>

                    {/* DATAS: ÚLTIMA ATIVIDADE E ÚLTIMO LOGIN */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.73rem', textAlign: 'right', minWidth: '180px' }}>
                      <div style={{ color: '#ccc', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} style={{ color: '#777' }} />
                        <span>Última ação: <strong style={{ color: st.status === 'online' ? '#81C784' : '#fff' }}>{formatRelativeTime(st.lastActiveStr)}</strong></span>
                      </div>
                      <div style={{ color: '#888' }}>
                        Último login: <span style={{ color: '#bbb' }}>{st.lastLoginStr ? new Date(st.lastLoginStr).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Não registrado'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{
          padding: '0.8rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', fontSize: '0.74rem', color: '#888'
        }}>
          <span>O sinal de presença é atualizado automaticamente a cada 30 segundos enquanto a aba estiver aberta.</span>
          <button
            onClick={onClose}
            className="btn-primary"
            style={{ padding: '0.45rem 1.2rem', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
