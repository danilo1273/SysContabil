import fs from 'fs';

const content = `import React from 'react';
import ProtheusModule from './components/ProtheusModule';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="logo-placeholder">AGF</div>
          <div>
            <h1>AGF Group - Sistema de Consolidação Financeira</h1>
            <p style={{ color: '#aaa', margin: 0 }}>Módulo de BI e Auditoria</p>
          </div>
        </div>
      </header>
      <main className="main-content">
        <ProtheusModule />
      </main>
    </div>
  );
}

export default App;
`;

fs.writeFileSync('c:/Users/User/Desktop/Consolidado/src/App.jsx', content, 'utf8');
console.log('App.jsx rewritten successfully.');
