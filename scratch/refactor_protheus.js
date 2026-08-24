import fs from 'fs';

let content = fs.readFileSync('c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx', 'utf8');

// 1. Change initial state of activeTab to 'db'
content = content.replace(/useState\('upload'\)/, "useState('db')");

// 2. Add Editing States and Selected Company State
content = content.replace(
  /const \[results, setResults\] = useState\(null\);/,
  `const [results, setResults] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('consolidado');`
);

// 3. Update handleSaveToDB to include password
const newHandleSaveToDB = `
  const handleSaveToDB = async () => {
    const pwd = prompt('Insira a senha de administrador para autorizar a gravação:');
    if (pwd !== 'agf5800') {
      alert('Senha incorreta!');
      return;
    }

    setIsProcessing(true);
    try {
      for (const comp of companies) {
        if (files[comp.id]) {
          const rawAccounts = await parseProtheusExcel(files[comp.id]);
          await saveBalanceteToDB(comp.id, selectedAno, selectedMes, rawAccounts);
        }
      }
      alert('Arquivos salvos no banco de dados com sucesso!');
      setFiles({});
      loadDbRecords();
    } catch (err) {
      console.error(err);
      alert('Erro ao gravar balancetes: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };
`;
content = content.replace(/const handleSaveToDB = async \(\) => \{[\s\S]*?\}\s*};\s*const loadPanelData/, newHandleSaveToDB + '\n\n  const loadPanelData');

// 4. Add Editing Handlers
const editHandlers = `
  const startEditing = (record) => {
    setEditingId(record.id);
    setEditingValue(record.valorMensal !== undefined ? record.valorMensal : record.saldoAcumulado);
  };

  const saveEdit = async (record) => {
    try {
      const dbMod = await import('../utils/db');
      const val = parseFloat(editingValue);
      if (isNaN(val)) throw new Error('Valor inválido');
      
      if (record.tipo) {
        await dbMod.db.balanco_history.update(record.id, { saldoAcumulado: val });
      } else {
        await dbMod.db.dre_history.update(record.id, { valorMensal: val });
      }
      setEditingId(null);
      loadDbRecords();
    } catch (e) {
      alert('Erro ao atualizar: ' + e.message);
    }
  };
`;
content = content.replace(/const loadDbRecords = async \(\) => \{/, editHandlers + '\n  const loadDbRecords = async () => {');

// 5. Remove "Importação" tab button from Nav
content = content.replace(/<button\s*className=\{\`tab-btn \$\{activeTab === 'upload'[\s\S]*?<\/button>/, '');

// 6. Move Upload UI into DB tab and remove upload tab
// Find the {activeTab === 'upload' && ... } block and replace it with nothing (we will merge it into db)
content = content.replace(/\{activeTab === 'upload' && \([\s\S]*?\}\)\s*\}/, '');

// 7. Update DB tab UI to include Upload UI
const newDbUI = `
      {activeTab === 'db' && (
        <div style={{ marginTop: '1rem' }}>
          {/* SECÃO DE IMPORTAÇÃO E FILTROS DO BD */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ color: 'var(--color-primary)' }}>🗄️ Banco de Dados e Importação</h2>
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
          
          <div className="controls-section" style={{ marginBottom: '2rem' }}>
            {companies.map(comp => (
              <div key={comp.id} className="control-card glass-panel">
                <h2>{comp.name}</h2>
                <div className="uploader-group">
                  <div className="file-input-wrapper">
                    <input type="file" id={\`file-\${comp.id}\`} accept=".xlsx" onChange={(e) => handleFileChange(comp.id, e)} />
                    <div className="file-btn">
                      <UploadCloud size={20} /> Selecionar Balancete
                    </div>
                  </div>
                  {files[comp.id] && (
                    <div className="file-list">
                      <div className="file-list-header">
                        <CheckCircle size={16} color="var(--color-success)" /><span>Planilha Carregada</span>
                      </div>
                      <div className="file-item"><FileText size={14} /> {files[comp.id].name}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="action-row" style={{ marginBottom: '3rem', justifyContent: 'flex-end' }}>
            <button className="action-btn" onClick={handleSaveToDB} disabled={!Object.keys(files).length || isProcessing}>
              {isProcessing ? 'Processando DB...' : 'Gravar no Banco'} <Database size={18} />
            </button>
          </div>
          
          {/* TABELA DE AUDITORIA E EDIÇÃO */}
          <div className="glass-panel" style={{ padding: '1.5rem', overflowX: 'auto' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>Registros Gravados no Mês</h3>
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
                    <th>Valor</th>
                    <th>Ações</th>
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
                        {editingId === r.id ? (
                          <input 
                            type="number" 
                            className="select-input" 
                            style={{ width: '120px', padding: '0.2rem' }}
                            value={editingValue} 
                            onChange={(e) => setEditingValue(e.target.value)} 
                          />
                        ) : (
                          (r.valorMensal !== undefined ? r.valorMensal : (r.saldoAcumulado || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        )}
                      </td>
                      <td>
                        {editingId === r.id ? (
                          <button onClick={() => saveEdit(r)} style={{ background: 'var(--color-success)', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}>Salvar</button>
                        ) : (
                          <button onClick={() => startEditing(r)} style={{ background: '#444', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}>✏️ Editar</button>
                        )}
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
content = content.replace(/\{activeTab === 'db' && \([\s\S]*?\}\)\s*\}/, newDbUI);

// 8. Add Filter to Dashboard Tab
const dashFilterUI = `
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ color: 'var(--color-primary)' }}>Painel de Inteligência Consolidado</h2>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="select-input" style={{ width: '220px', borderColor: 'var(--color-primary)' }}>
                <option value="consolidado">VISÃO: CONSOLIDADO</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={selectedMes} onChange={(e) => { setSelectedMes(parseInt(e.target.value)); setTimeout(loadPanelData, 50); }} className="select-input" style={{ width: '150px' }}>
`;
content = content.replace(/<div style=\{\{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' \}\}>\s*<h2 style=\{\{ color: 'var\(--color-primary\)' \}\}>Painel de Inteligência Consolidado<\/h2>\s*<div style=\{\{ display: 'flex', gap: '1rem' \}\}>\s*<select value=\{selectedMes\}/, dashFilterUI);

// 9. Update Dashboard metrics to use selectedCompany
// Replace `.consolidado` with `?.[selectedCompany]`
content = content.replace(/results\.subtotals\.recBruta\?\.consolidado/g, "results.subtotals.recBruta?.[selectedCompany]");
content = content.replace(/results\.subtotals\.recBruta\.consolidado/g, "results.subtotals.recBruta?.[selectedCompany]");

content = content.replace(/results\.subtotals\.lucroBruto\.consolidado/g, "results.subtotals.lucroBruto?.[selectedCompany]");
content = content.replace(/results\.subtotals\.ebitda\.consolidado/g, "results.subtotals.ebitda?.[selectedCompany]");
content = content.replace(/results\.subtotals\.ebitda\?\.consolidado/g, "results.subtotals.ebitda?.[selectedCompany]");
content = content.replace(/results\.subtotals\.lucroLiq\.consolidado/g, "results.subtotals.lucroLiq?.[selectedCompany]");
content = content.replace(/results\.subtotals\.lucroLiq\?\.consolidado/g, "results.subtotals.lucroLiq?.[selectedCompany]");
content = content.replace(/results\.subtotals\.custoVend\?\.consolidado/g, "results.subtotals.custoVend?.[selectedCompany]");

fs.writeFileSync('c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx', content, 'utf8');
console.log('ProtheusModule.jsx refactored successfully.');
