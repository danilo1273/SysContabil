import React, { useState } from 'react';
import { getSettings, saveSettings as dbSaveSettings } from '../utils/db';

const UserProfileModal = ({ user, onClose }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage('As senhas não coincidem!');
      return;
    }
    if (newPassword.length < 4) {
      setMessage('A senha deve ter pelo menos 4 caracteres.');
      return;
    }

    try {
      const users = await getSettings('agf_users');
      if (users && Array.isArray(users)) {
        const updatedUsers = users.map(u => 
          u.username === user.username ? { ...u, password: newPassword } : u
        );
        await dbSaveSettings('agf_users', updatedUsers);
        setMessage('Senha alterada com sucesso!');
        setTimeout(() => onClose(), 1500);
      }
    } catch (err) {
      setMessage('Erro ao salvar nova senha.');
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
      <div style={{ background: '#1e1e1e', padding: '2rem', borderRadius: '8px', width: '90%', maxWidth: '400px', border: '1px solid #333' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, color: 'var(--color-primary)' }}>Meu Perfil</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
        </div>
        
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', color: '#888', marginBottom: '0.3rem' }}>Usuário</label>
            <input type="text" value={user.username} disabled style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', background: '#2a2a2a', border: '1px solid #444', color: '#888' }} />
          </div>
          <div>
            <label style={{ display: 'block', color: '#888', marginBottom: '0.3rem' }}>Nova Senha</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', background: '#2a2a2a', border: '1px solid #444', color: '#fff' }} required />
          </div>
          <div>
            <label style={{ display: 'block', color: '#888', marginBottom: '0.3rem' }}>Confirmar Nova Senha</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', background: '#2a2a2a', border: '1px solid #444', color: '#fff' }} required />
          </div>
          
          {message && <div style={{ color: message.includes('sucesso') ? '#4CAF50' : '#f44336', fontSize: '0.9rem', textAlign: 'center' }}>{message}</div>}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="submit" style={{ flex: 1, padding: '0.75rem', background: 'var(--color-primary)', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Salvar Senha</button>
            <button type="button" onClick={onClose} style={{ padding: '0.75rem', background: '#444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserProfileModal;
