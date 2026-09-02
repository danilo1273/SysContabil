import React from 'react';
import { BarChart3, Calculator, Shield, Eye, Lock, ArrowRight } from 'lucide-react';

export default function ModuleSelectionScreen({ user, onSelectModule }) {
  const isSuperadmin = user?.role === 'superadmin' || ['danilo', 'ryan.santos'].includes(user?.username);
  const hasContabil = isSuperadmin || user?.permissions?.includes('contabil') || user?.permissions?.includes('db');
  const hasIndicadores = isSuperadmin || user?.permissions?.includes('dash') || true;

  return (
    <div style={{
      minHeight: '75vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '2rem 1rem'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '2.5rem', maxWidth: '650px' }}>
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '8px', 
          background: 'rgba(255, 255, 255, 0.05)', 
          padding: '6px 16px', 
          borderRadius: '20px', 
          fontSize: '0.85rem', 
          color: '#aaa',
          marginBottom: '1rem',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <span>Logado como</span>
          <strong style={{ color: 'var(--color-primary)' }}>{user?.username}</strong>
          {isSuperadmin && <span style={{ background: '#2196F3', color: '#fff', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px' }}>SUPERADMIN</span>}
        </div>
        <h2 style={{ fontSize: '2.2rem', color: '#fff', margin: '0 0 0.8rem 0', fontWeight: '700' }}>
          Selecione o Ambiente de Acesso
        </h2>
        <p style={{ color: '#888', fontSize: '1rem', margin: 0, lineHeight: '1.5' }}>
          Escolha abaixo o módulo do sistema que deseja utilizar para iniciar sua sessão de trabalho:
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 420px))',
        gap: '2rem',
        width: '100%',
        maxWidth: '920px',
        justifyContent: 'center'
      }}>
        {/* CARD 1: INDICADORES */}
        <div 
          onClick={() => hasIndicadores && onSelectModule('indicadores')}
          style={{
            background: 'linear-gradient(145deg, rgba(33, 150, 243, 0.08), rgba(20, 20, 25, 0.95))',
            border: '1px solid rgba(33, 150, 243, 0.3)',
            borderRadius: '16px',
            padding: '2.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: hasIndicadores ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            if (hasIndicadores) {
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.borderColor = '#2196F3';
              e.currentTarget.style.boxShadow = '0 16px 40px rgba(33, 150, 243, 0.25)';
            }
          }}
          onMouseLeave={(e) => {
            if (hasIndicadores) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'rgba(33, 150, 243, 0.3)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
            }
          }}
        >
          <div>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '12px',
              background: 'rgba(33, 150, 243, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem',
              color: '#64B5F6'
            }}>
              <BarChart3 size={32} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.8rem' }}>
              <h3 style={{ fontSize: '1.5rem', color: '#fff', margin: 0, fontWeight: '600' }}>
                Indicadores
              </h3>
              <span style={{ 
                background: 'rgba(76, 175, 80, 0.15)', 
                color: '#81C784', 
                fontSize: '0.72rem', 
                padding: '3px 8px', 
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 'bold'
              }}>
                <Eye size={12} /> Acesso View
              </span>
            </div>

            <p style={{ color: '#aaa', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              Painel gerencial de indicadores, relatórios, demonstrativos de resultados (DRE) e análise por centros de custo.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '2rem' }}>
              <span style={{ background: 'rgba(255,255,255,0.05)', color: '#ccc', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem' }}>📊 Dashboard Contábil</span>
              <span style={{ background: 'rgba(255,255,255,0.05)', color: '#ccc', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem' }}>🏢 Centro de Custo</span>
              <span style={{ background: 'rgba(255,255,255,0.05)', color: '#ccc', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem' }}>📈 Gráficos & BI</span>
            </div>
          </div>

          <button 
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '0.9rem',
              background: '#2196F3',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            Acessar Indicadores <ArrowRight size={18} />
          </button>
        </div>

        {/* CARD 2: SISTEMA CONTÁBIL */}
        <div 
          onClick={() => hasContabil && onSelectModule('contabil')}
          style={{
            background: hasContabil 
              ? 'linear-gradient(145deg, rgba(255, 193, 7, 0.08), rgba(20, 20, 25, 0.95))'
              : 'rgba(25, 25, 30, 0.6)',
            border: hasContabil ? '1px solid rgba(255, 193, 7, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            padding: '2.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: hasContabil ? 'pointer' : 'not-allowed',
            opacity: hasContabil ? 1 : 0.65,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            if (hasContabil) {
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.borderColor = '#FFC107';
              e.currentTarget.style.boxShadow = '0 16px 40px rgba(255, 193, 7, 0.2)';
            }
          }}
          onMouseLeave={(e) => {
            if (hasContabil) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'rgba(255, 193, 7, 0.3)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
            }
          }}
        >
          <div>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '12px',
              background: hasContabil ? 'rgba(255, 193, 7, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem',
              color: hasContabil ? '#FFD54F' : '#666'
            }}>
              <Calculator size={32} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.8rem' }}>
              <h3 style={{ fontSize: '1.5rem', color: '#fff', margin: 0, fontWeight: '600' }}>
                Sistema Contábil
              </h3>
              <span style={{ 
                background: hasContabil ? 'rgba(255, 193, 7, 0.15)' : 'rgba(244, 67, 54, 0.15)', 
                color: hasContabil ? '#FFD54F' : '#EF5350', 
                fontSize: '0.72rem', 
                padding: '3px 8px', 
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 'bold'
              }}>
                {hasContabil ? <Shield size={12} /> : <Lock size={12} />}
                {hasContabil ? 'Contábil & Admin' : 'Acesso Restrito'}
              </span>
            </div>

            <p style={{ color: '#aaa', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              Módulo operacional para apuração fiscal (IRPJ/CSLL), rateios da holding, gestão contábil e manutenção do banco de dados.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '2rem' }}>
              <span style={{ background: 'rgba(255,255,255,0.05)', color: '#ccc', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem' }}>⚖️ Apuração IRPJ / CSLL</span>
              <span style={{ background: 'rgba(255,255,255,0.05)', color: '#ccc', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem' }}>📑 Gestão Contábil</span>
              <span style={{ background: 'rgba(255,255,255,0.05)', color: '#ccc', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem' }}>🏛️ Holding</span>
              <span style={{ background: 'rgba(255,255,255,0.05)', color: '#ccc', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem' }}>💾 Banco de Dados</span>
            </div>
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
              padding: '0.9rem',
              background: hasContabil ? '#FFB300' : '#333',
              color: hasContabil ? '#000' : '#777',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: hasContabil ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s'
            }}
          >
            {hasContabil ? (
              <>Acessar Sistema Contábil <ArrowRight size={18} /></>
            ) : (
              <>🔒 Acesso Restrito ao Contábil</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
