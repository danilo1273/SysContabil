import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings as dbSaveSettings } from '../utils/db';

const UserPanel = ({ onClose }) => {
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ username: '', password: '', role: 'viewer', permissions: ['dash'] });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const stored = await getSettings('agf_users');
        if (stored && Array.isArray(stored)) {
          setUsers(stored);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchUsers();
  }, []);

  const saveUsers = async (newUsers) => {
    setUsers(newUsers);
    await dbSaveSettings('agf_users', newUsers);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.username || !formData.password) {
        window.$alert("Preencha usuário e senha.");
        return;
    }

    if (editingUser) {
      const updated = users.map(u => u.username === editingUser.username ? formData : u);
      saveUsers(updated);
    } else {
      if (users.find(u => u.username === formData.username)) {
        window.$alert('Este nome de usuário já existe!');
        return;
      }
      saveUsers([...users, formData]);
    }
    setEditingUser(null);
    setFormData({ username: '', password: '', role: 'viewer', permissions: ['dash'] });
  };

  const handleEdit = (u) => {
    setEditingUser(u);
    setFormData({ ...u, permissions: u.permissions || ['dash'] });
  };

  const handleDelete = (username) => {
    if ((['danilo', 'ryan.santos'].includes(username))) {
      window.$alert('Usuários mestres (danilo, ryan.santos) não podem ser excluídos.');
      return;
    }
    if (window.confirm(`Tem certeza que deseja excluir o usuário "${username}"?`)) {
      saveUsers(users.filter(u => u.username !== username));
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{ background: '#1e1e1e', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '700px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #333', paddingBottom: '1rem' }}>
          <h2 style={{ margin: 0, color: 'var(--color-primary)' }}>👥 Painel de Usuários</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
        </div>

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <h3 style={{ marginBottom: '1rem', color: '#ccc' }}>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#888', marginBottom: '0.3rem' }}>Usuário</label>
                <input 
                  type="text" 
                  value={formData.username} 
                  onChange={e => setFormData({...formData, username: e.target.value})} 
                  disabled={editingUser && (['danilo', 'ryan.santos'].includes(formData.username))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', background: '#2a2a2a', border: '1px solid #444', color: '#fff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#888', marginBottom: '0.3rem' }}>Senha</label>
                <input 
                  type="text" 
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})} 
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', background: '#2a2a2a', border: '1px solid #444', color: '#fff' }}
                />
              </div>
              <div>
              <label style={{ display: 'block', color: '#888', marginBottom: '0.3rem' }}>Permissões</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#2a2a2a', padding: '1rem', borderRadius: '6px', border: '1px solid #444' }}>
                
                <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.permissions?.includes('db') || (['danilo', 'ryan.santos'].includes(formData.username))} onChange={(e) => {
                    const newPerms = e.target.checked ? [...(formData.permissions || []), 'db'] : (formData.permissions || []).filter(p => p !== 'db');
                    setFormData({...formData, permissions: newPerms});
                  }} disabled={(['danilo', 'ryan.santos'].includes(formData.username))} />
                  Banco de Dados / Importar
                </label>

                <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.permissions?.includes('contabil') || (['danilo', 'ryan.santos'].includes(formData.username))} onChange={(e) => {
                    const newPerms = e.target.checked ? [...(formData.permissions || []), 'contabil'] : (formData.permissions || []).filter(p => p !== 'contabil');
                    setFormData({...formData, permissions: newPerms});
                  }} disabled={(['danilo', 'ryan.santos'].includes(formData.username))} />
                  Contábil (Gestão, Rateios, IRPJ)
                </label>

                <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.permissions?.includes('dash') || (['danilo', 'ryan.santos'].includes(formData.username))} onChange={(e) => {
                    const newPerms = e.target.checked ? [...(formData.permissions || []), 'dash'] : (formData.permissions || []).filter(p => p !== 'dash');
                    setFormData({...formData, permissions: newPerms});
                  }} disabled={(['danilo', 'ryan.santos'].includes(formData.username))} />
                  Visualizar Dados (Dashboards e DRE)
                </label>
                
              </div>
            </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="submit" style={{ flex: 1, padding: '0.5rem', background: 'var(--color-primary)', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  {editingUser ? 'Salvar' : 'Adicionar'}
                </button>
                {editingUser && (
                  <button type="button" onClick={() => { setEditingUser(null); setFormData({ username: '', password: '', role: 'viewer', permissions: ['dash'] }); }} style={{ padding: '0.5rem', background: '#444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div style={{ flex: 1, minWidth: '250px', borderLeft: '1px solid #333', paddingLeft: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: '#ccc' }}>Lista de Usuários</h3>
            <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto', overflowX: 'hidden', paddingRight: '5px' }}>
            {users.map(u => (
              <div key={u.username} style={{ background: '#2a2a2a', padding: '0.75rem', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                  <div style={{ flex: 1, paddingRight: '0.5rem' }}>
                    <strong style={{ color: (['danilo', 'ryan.santos'].includes(u.username)) ? 'var(--color-primary)' : '#fff', wordBreak: 'break-all' }}>{u.username}</strong>
                    <div style={{ marginTop: '0.4rem' }}>
                      {(['danilo', 'ryan.santos'].includes(u.username)) ? (
                        <span style={{ background: 'var(--color-primary)', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>Super Admin</span>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {u.permissions?.includes('db') && <span style={{ background: '#9C27B0', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>DB</span>}
                          {u.permissions?.includes('contabil') && <span style={{ background: '#4CAF50', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>Contábil</span>}
                          {u.permissions?.includes('dash') && <span style={{ background: '#2196F3', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>View</span>}
                          {(!u.permissions || u.permissions.length === 0) && <span style={{ background: '#555', color: '#ccc', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem' }}>Sem acesso</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                    <button onClick={() => handleEdit(u)} style={{ background: '#2196F3', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Editar</button>
                    {!(['danilo', 'ryan.santos'].includes(u.username)) && (
                      <button onClick={() => handleDelete(u.username)} style={{ background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Excluir</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default UserPanel;
