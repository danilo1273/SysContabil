import React, { Component } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

/**
 * Carrega um componente React.lazy com retry automático caso haja uma nova versão publicada
 * (evita o erro "Failed to fetch dynamically imported module" quando a Vercel gera novos hashes).
 */
export function lazyWithRetry(componentImport) {
  return React.lazy(async () => {
    const key = 'lazy_chunk_reload_' + Math.abs(hashCode(componentImport.toString()));
    const alreadyReloaded = window.sessionStorage.getItem(key) === 'true';

    try {
      const module = await componentImport();
      window.sessionStorage.removeItem(key);
      return module;
    } catch (error) {
      const msg = error?.message || '';
      const isChunkError =
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('error loading dynamically imported module') ||
        error.name === 'ChunkLoadError';

      if (isChunkError && !alreadyReloaded) {
        window.sessionStorage.setItem(key, 'true');
        console.warn('Nova versão do sistema detectada na nuvem. Atualizando tela automaticamente...', msg);
        window.location.reload();
        return new Promise(() => {}); // Pausa para recarregar
      }

      throw error;
    }
  });
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Error Boundary específico para capturar falhas de carregamento de módulos dinâmicos
 */
export class ModuleErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ModuleErrorBoundary capturou erro:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isChunkError =
        this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.message?.includes('Importing a module script failed');

      return (
        <div style={{
          padding: '3rem 2rem',
          textAlign: 'center',
          background: 'rgba(255, 152, 0, 0.08)',
          border: '1px solid rgba(255, 152, 0, 0.3)',
          borderRadius: '12px',
          margin: '2rem auto',
          maxWidth: '550px'
        }}>
          <AlertCircle size={40} style={{ color: '#FF9800', marginBottom: '1rem' }} />
          <h3 style={{ color: '#fff', margin: '0 0 0.5rem 0' }}>
            {isChunkError ? 'Nova Versão do Sistema Disponível' : 'Erro ao Carregar Módulo'}
          </h3>
          <p style={{ color: '#ccc', fontSize: '0.88rem', margin: '0 0 1.5rem 0', lineHeight: '1.5' }}>
            {isChunkError
              ? 'Uma nova atualização foi publicada no servidor enquanto você usava o sistema. Clique abaixo para carregar a versão mais recente.'
              : (this.state.error?.message || 'Ocorreu uma falha ao abrir este componente.')}
          </p>
          <button
            onClick={this.handleReload}
            className="btn-primary"
            style={{
              padding: '0.65rem 1.5rem',
              fontSize: '0.9rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 'bold',
              background: '#FF9800',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} />
            Atualizar Página Agora
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
