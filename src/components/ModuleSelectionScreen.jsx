import React from 'react';
import { BarChart3, Calculator, Lock, ArrowRight } from 'lucide-react';

export default function ModuleSelectionScreen({ user, onSelectModule }) {
  const isSuperadmin = user?.role === 'superadmin' || ['danilo', 'ryan.santos'].includes(user?.username);
  const hasContabil = isSuperadmin || user?.permissions?.includes('contabil') || user?.permissions?.includes('db');
  const hasIndicadores = isSuperadmin || user?.permissions?.includes('dash') || true;

  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '2rem 1rem'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '2.5rem', maxWidth: '500px' }}>
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '8px', 
          background: 'rgba(255, 255, 255, 0.04)', 
          padding: '4px 12px', 
          borderRadius: '20px', 
          fontSize: '0.8rem', 
          color: '#888',
          marginBottom: '1rem',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <span>Logado como</span>
          <strong style={{ color: 'var(--color-primary)' }}>{user?.username}</strong>
          {isSuperadmin && <span style={{ background: 'rgba(33, 150, 243, 0.2)', color: '#64B5F6', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>SUPERADMIN</span>}
        </div>
        <h2 style={{ fontSize: '1.9rem', color: '#fff', margin: '0 0 0.5rem 0', fontWeight: '700' }}>
          Selecione o Ambiente
        </h2>
        <p style={{ color: '#777', fontSize: '0.95rem', margin: 0 }}>
          Escolha o módulo para acessar o sistema
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 380px))',
        gap: '1.5rem',
        width: '100%',
        maxWidth: '800px',
        justifyContent: 'center'
      }}>
        {/* CARD 1: INDICADORES */}
        <div 
          onClick={() => hasIndicadores && onSelectModule('indicadores')}
          style={{
            background: 'rgba(20, 20, 26, 0.75)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(33, 150, 243, 0.25)',
            borderRadius: '16px',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: hasIndicadores ? 'pointer' : 'not-allowed',
            transition: 'all 0.25s ease',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            position: 'relative',
            minHeight: '260px'
          }}
          onMouseEnter={(e) => {
            if (hasIndicadores) {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = '#2196F3';
              e.currentTarget.style.boxShadow = '0 12px 32px rgba(33, 150, 243, 0.2)';
            }
          }}
          onMouseLeave={(e) => {
            if (hasIndicadores) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'rgba(33, 150, 243, 0.25)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)';
            }
          }}
        >
          <div>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              background: 'rgba(33, 150, 243, 0.12)',
              border: '1px solid rgba(33, 150, 243, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.2rem',
              color: '#64B5F6'
            }}>
              <BarChart3 size={26} />
            </div>

            <h3 style={{ fontSize: '1.35rem', color: '#fff', margin: '0 0 0.5rem 0', fontWeight: '600' }}>
              Indicadores
            </h3>

            <p style={{ color: '#888', fontSize: '0.88rem', lineHeight: '1.5', margin: '0 0 1.8rem 0' }}>
              DRE Consolidada, Balanço Patrimonial, Centro de Custo e Movimentação de Estoque.
            </p>
          </div>

          <button 
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '0.8rem 1rem',
              background: '#1976D2',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            Acessar Indicadores <ArrowRight size={16} />
          </button>
        </div>

        {/* CARD 2: SISTEMA CONTÁBIL */}
        <div 
          onClick={() => hasContabil && onSelectModule('contabil')}
          style={{
            background: hasContabil ? 'rgba(20, 20, 26, 0.75)' : 'rgba(18, 18, 22, 0.5)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: hasContabil ? '1px solid rgba(255, 193, 7, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: hasContabil ? 'pointer' : 'not-allowed',
            opacity: hasContabil ? 1 : 0.6,
            transition: 'all 0.25s ease',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            position: 'relative',
            minHeight: '260px'
          }}
          onMouseEnter={(e) => {
            if (hasContabil) {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = '#FFC107';
              e.currentTarget.style.boxShadow = '0 12px 32px rgba(255, 193, 7, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (hasContabil) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'rgba(255, 193, 7, 0.25)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)';
            }
          }}
        >
          <div>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              background: hasContabil ? 'rgba(255, 193, 7, 0.12)' : 'rgba(255, 255, 255, 0.04)',
              border: hasContabil ? '1px solid rgba(255, 193, 7, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.2rem',
              color: hasContabil ? '#FFD54F' : '#666'
            }}>
              <Calculator size={26} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '1.35rem', color: '#fff', margin: 0, fontWeight: '600' }}>
                Sistema Contábil
              </h3>
              {!hasContabil && (
                <span style={{ 
                  color: '#EF5350', 
                  fontSize: '0.72rem', 
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: '500'
                }}>
                  <Lock size={12} /> Restrito
                </span>
              )}
            </div>

            <p style={{ color: '#888', fontSize: '0.88rem', lineHeight: '1.5', margin: '0 0 1.8rem 0' }}>
              Apuração IRPJ/CSLL, Rateios da Holding, Gestão Contábil e Banco de Dados.
            </p>
          </div>

          <button 
            type="button"
            disabled={!hasContabil}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '0.8rem 1rem',
              background: hasContabil ? '#FFA000' : '#2a2a30',
              color: hasContabil ? '#111' : '#666',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: hasContabil ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s'
            }}
          >
            {hasContabil ? (
              <>Acessar Sistema Contábil <ArrowRight size={16} /></>
            ) : (
              <>Acesso Restrito</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
