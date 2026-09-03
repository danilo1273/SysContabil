import React, { useState, useEffect } from 'react';
import { setDialogListener, setToastListener } from '../utils/dialog';

export default function GlobalDialog() {
  const [dialog, setDialog] = useState(null);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    setDialogListener((data) => {
      setDialog(data);
    });

    setToastListener((newToast) => {
      setToasts((prev) => [...prev, newToast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, newToast.duration || 3500);
    });

    // Keyboard support (Enter = confirm, Escape = cancel)
    const handleKeyDown = (e) => {
      if (!dialog || !dialog.isOpen) return;
      if (e.key === 'Escape') {
        dialog.onCancel();
        setDialog(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        dialog.onConfirm();
        setDialog(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog]);

  const handleConfirmAction = () => {
    if (dialog && dialog.onConfirm) dialog.onConfirm();
    setDialog(null);
  };

  const handleCancelAction = () => {
    if (dialog && dialog.onCancel) dialog.onCancel();
    setDialog(null);
  };

  const getTheme = (type) => {
    switch (type) {
      case 'danger':
        return {
          icon: '⚠️',
          iconBg: 'rgba(244, 67, 54, 0.15)',
          iconColor: '#FF5252',
          border: '1px solid rgba(244, 67, 54, 0.4)',
          btnBg: 'linear-gradient(135deg, #E53935, #C62828)',
          btnColor: '#fff',
          glow: '0 8px 24px rgba(244, 67, 54, 0.4)'
        };
      case 'success':
        return {
          icon: '✅',
          iconBg: 'rgba(76, 175, 80, 0.15)',
          iconColor: '#81C784',
          border: '1px solid rgba(76, 175, 80, 0.4)',
          btnBg: 'linear-gradient(135deg, #4CAF50, #2E7D32)',
          btnColor: '#fff',
          glow: '0 8px 24px rgba(76, 175, 80, 0.4)'
        };
      case 'info':
        return {
          icon: 'ℹ️',
          iconBg: 'rgba(33, 150, 243, 0.15)',
          iconColor: '#64B5F6',
          border: '1px solid rgba(33, 150, 243, 0.4)',
          btnBg: 'linear-gradient(135deg, #2196F3, #1565C0)',
          btnColor: '#fff',
          glow: '0 8px 24px rgba(33, 150, 243, 0.4)'
        };
      case 'warning':
      default:
        return {
          icon: '⚠️',
          iconBg: 'rgba(255, 193, 7, 0.15)',
          iconColor: '#FFD54F',
          border: '1px solid rgba(255, 193, 7, 0.4)',
          btnBg: 'linear-gradient(135deg, #FFB300, #F57F17)',
          btnColor: '#000',
          glow: '0 8px 24px rgba(255, 193, 7, 0.4)'
        };
    }
  };

  const theme = dialog ? getTheme(dialog.type) : null;

  return (
    <>
      {/* TOASTS FLUTUANTES (CANTO SUPERIOR DIREITO) */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none'
      }}>
        {toasts.map((t) => {
          const isErr = t.type === 'error' || t.type === 'danger';
          const isWarn = t.type === 'warning';
          return (
            <div
              key={t.id}
              style={{
                pointerEvents: 'auto',
                background: 'rgba(20, 20, 26, 0.95)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: isErr ? '1px solid #F44336' : isWarn ? '1px solid #FFC107' : '1px solid #4CAF50',
                borderLeft: isErr ? '5px solid #F44336' : isWarn ? '5px solid #FFC107' : '5px solid #4CAF50',
                color: '#fff',
                padding: '0.85rem 1.2rem',
                borderRadius: '10px',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
                fontSize: '0.9rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                maxWidth: '380px',
                animation: 'slideInRight 0.3s ease-out'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{isErr ? '❌' : isWarn ? '⚠️' : '✅'}</span>
              <span style={{ flex: 1 }}>{t.message}</span>
            </div>
          );
        })}
      </div>

      {/* MODAL DIALOG MODERNO */}
      {dialog && dialog.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.82)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '1.5rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #1e1e28, #14141c)',
            border: theme.border,
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            
            {/* Header com Ícone e Título */}
            <div style={{
              padding: '1.5rem 1.8rem 1rem 1.8rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px'
            }}>
              <div style={{
                background: theme.iconBg,
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                flexShrink: 0
              }}>
                {theme.icon}
              </div>

              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', fontWeight: '600', letterSpacing: '0.3px' }}>
                  {dialog.title}
                </h3>
              </div>

              <button
                onClick={handleCancelAction}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#777',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#777'}
              >
                ✕
              </button>
            </div>

            {/* Conteúdo / Mensagem */}
            <div style={{
              padding: '0.5rem 1.8rem 1.5rem 1.8rem',
              color: '#ddd',
              fontSize: '0.95rem',
              lineHeight: '1.6',
              whiteSpace: 'pre-line',
              wordBreak: 'break-word'
            }}>
              {dialog.message}
            </div>

            {/* Ações / Botões */}
            <div style={{
              padding: '1.2rem 1.8rem',
              background: 'rgba(0, 0, 0, 0.35)',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '12px'
            }}>
              {dialog.mode === 'confirm' && (
                <button
                  type="button"
                  onClick={handleCancelAction}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ccc',
                    padding: '0.65rem 1.3rem',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = '#ccc'; }}
                >
                  {dialog.cancelText || 'Cancelar'}
                </button>
              )}

              <button
                type="button"
                onClick={handleConfirmAction}
                autoFocus
                style={{
                  background: theme.btnBg,
                  color: theme.btnColor,
                  border: 'none',
                  padding: '0.65rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '0.92rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: theme.glow,
                  transition: 'transform 0.15s, box-shadow 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                {dialog.confirmText || (dialog.mode === 'confirm' ? 'Confirmar' : 'Entendido')}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
