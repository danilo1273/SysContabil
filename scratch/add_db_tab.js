import fs from 'fs';

const p = 'c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx';
let content = fs.readFileSync(p, 'utf8');

// 1. Add state for DB Tab
if (!content.includes('const [dbTabRecords, setDbTabRecords]')) {
  content = content.replace(
    /const \[secondaryTab, setSecondaryTab\] = useState\('dash'\);/,
    "const [secondaryTab, setSecondaryTab] = useState('dash');\n  const [dbTabRecords, setDbTabRecords] = useState([]);\n  const [loadingDb, setLoadingDb] = useState(false);"
  );
}

// 2. Add function to load DB records
if (!content.includes('const loadDbRecords = async ()')) {
  const loadDbFn = `
  const loadDbRecords = async () => {
    setLoadingDb(true);
    try {
      const dbMod = await import('../utils/db');
      const dreRecs = await dbMod.db.dre_history.where({ ano: selectedAno, mes: selectedMes }).toArray();
      const balancoRecs = await dbMod.db.balanco_history.where({ ano: selectedAno, mes: selectedMes }).toArray();
      
      const allRecs = [...dreRecs, ...balancoRecs].sort((a, b) => a.conta.localeCompare(b.conta));
      setDbTabRecords(allRecs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDb(false);
    }
  };
  
  useEffect(() => {
    if (activeTab === 'db') {
      loadDbRecords();
    }
  }, [activeTab, selectedAno, selectedMes]);
`;
  content = content.replace(/const handleProcess = async \(\) => \{/, loadDbFn + '\n  const handleProcess = async () => {');
}

// 3. Add Tab button
content = content.replace(
  /<button \n\s*className=\{\`tab-btn \$\{activeTab === 'resultados' \? 'active' : ''\}\`\}/,
  `<button 
          className={\`tab-btn \${activeTab === 'db' ? 'active' : ''}\`} 
          onClick={() => setActiveTab('db')}
        >
          <Database size={20} /> Banco de Dados
        </button>
        <button 
          className={\`tab-btn \${activeTab === 'resultados' ? 'active' : ''}\`}`
);

// 4. Add DB tab UI
const dbTabUI = `
      {activeTab === 'db' && (
        <div className="results-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ color: 'var(--color-primary)' }}>🗄️ Banco de Dados Bruto (Auditoria)</h2>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <select value={selectedMes} onChange={(e) => setSelectedMes(parseInt(e.target.value))} className="select-input" style={{ width: '150px' }}>
                <option value={1}>Janeiro</option><option value={2}>Fevereiro</option><option value={3}>Março</option>
                <option value={4}>Abril</option><option value={5}>Maio</option><option value={6}>Junho</option>
                <option value={7}>Julho</option><option value={8}>Agosto</option><option value={9}>Setembro</option>
                <option value={10}>Outubro</option><option value={11}>Novembro</option><option value={12}>Dezembro</option>
              </select>
              <select value={selectedAno} onChange={(e) => setSelectedAno(parseInt(e.target.value))} className="select-input" style={{ width: '100px' }}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          
          <div className="glass-panel" style={{ padding: '1.5rem', overflowX: 'auto' }}>
            {loadingDb ? (
              <p>Carregando dados...</p>
            ) : dbTabRecords.length === 0 ? (
              <p>Nenhum dado importado para o período selecionado.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Conta</th>
                    <th>Descrição</th>
                    <th>Tipo</th>
                    <th>Valor do Mês (Col J) / Acumulado (Col I)</th>
                  </tr>
                </thead>
                <tbody>
                  {dbTabRecords.map(r => (
                    <tr key={r.id}>
                      <td>{r.empresaId}</td>
                      <td style={{ color: 'var(--color-primary)' }}>{r.conta}</td>
                      <td>{r.descricao}</td>
                      <td>{r.tipo ? 'BALANÇO' : 'RESULTADO'}</td>
                      <td style={{ fontWeight: 'bold', color: (r.valorMensal || r.saldoAcumulado) < 0 ? '#ff5252' : 'var(--color-success)' }}>
                        {(r.valorMensal || r.saldoAcumulado || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
`;

content = content.replace(/\{activeTab === 'resultados' && results && \(/, dbTabUI + "\n      {activeTab === 'resultados' && results && (");

fs.writeFileSync(p, content);
console.log('Added DB Tab!');
