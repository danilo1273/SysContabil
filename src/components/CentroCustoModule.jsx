import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { getRawRecords, saveCCToDB, getSettings, saveSettings } from '../utils/db';
import { applyMapping, protheusMapping } from '../utils/mappingConfig';

export default function CentroCustoModule({ companies, userRole }) {
  const [activeTab, setActiveTab] = useState((userRole === 'admin' || userRole === 'superadmin') ? 'import' : 'dre'); // import, config, dre, rateio
  
  // Settings
  const [projects, setProjects] = useState({}); // { "Multifio": ["20108", "20208"] }
  const [uniqueCCs, setUniqueCCs] = useState([]); // [{codigo: "20108", descricao: "MULTIFIO"}]
  const [isProcessing, setIsProcessing] = useState(false);

  // Import State
  const [selectedComp, setSelectedComp] = useState('');
  const [selectedMes, setSelectedMes] = useState(new Date().getMonth() + 1);
  const [selectedAno, setSelectedAno] = useState(new Date().getFullYear());
  const [fileData, setFileData] = useState(null);

  // Config State
  const [ccSearch, setCcSearch] = useState('');
  const [expandedConfigProject, setExpandedConfigProject] = useState(null);

  // Rateio State
  const [rateioSource, setRateioSource] = useState('');
  const [rateioRule, setRateioRule] = useState('proporcional');
  const [rateioFixedPct, setRateioFixedPct] = useState({});
  const [includeRateio, setIncludeRateio] = useState(false);

  // DRE State
  const [selectedProject, setSelectedProject] = useState('');
  const [periodType, setPeriodType] = useState('mensal');
  const [periodoBaseMes, setPeriodoBaseMes] = useState(new Date().getMonth() + 1);
  const [periodoBaseTri, setPeriodoBaseTri] = useState(1);
  const [periodoBaseAno, setPeriodoBaseAno] = useState(new Date().getFullYear());
  const [periodoCompMes, setPeriodoCompMes] = useState(new Date().getMonth() === 0 ? 12 : new Date().getMonth());
  const [periodoCompTri, setPeriodoCompTri] = useState(1);
  const [periodoCompAno, setPeriodoCompAno] = useState(new Date().getFullYear());
  
  const [dreBase, setDreBase] = useState(null);
  const [dreComp, setDreComp] = useState(null);

  const [dbRecords, setDbRecords] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = (group) => {
      setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  useEffect(() => {
    loadSettings();
    loadUniqueCCs();
  }, []);

  useEffect(() => {
    if (activeTab === 'import' && selectedComp) {
      loadDbRecords();
    }
  }, [activeTab, selectedComp, selectedAno, selectedMes]);

  const loadDbRecords = async () => {
    try {
      const res = await getRawRecords(selectedAno, selectedMes);
      if (res && res.cc) {
          const compCC = res.cc.filter(r => r.empresaId === selectedComp);
          setDbRecords(compCC);
      } else {
          setDbRecords([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadSettings = async () => {
      try {
          const p = await getSettings('agf_cc_projects');
          if (p) setProjects(p);
          const r = await getSettings('agf_cc_rateio_config');
          if (r) {
              if (r.source) setRateioSource(r.source);
              if (r.rule) setRateioRule(r.rule);
              if (r.fixedPct) setRateioFixedPct(r.fixedPct);
          }
      } catch (e) { console.error(e); }
  };

  const handleSaveRateio = async (source, rule, fixedPct) => {
      setRateioSource(source);
      setRateioRule(rule);
      setRateioFixedPct(fixedPct);
      await saveSettings('agf_cc_rateio_config', { source, rule, fixedPct });
  };

  const loadUniqueCCs = async () => {
    try {
      let allCCs = new Map();
      for (let m = 1; m <= 12; m++) {
        const res = await getRawRecords(new Date().getFullYear(), m);
        if (res.cc) {
          res.cc.forEach(r => {
             allCCs.set(r.cc_codigo, r.cc_descricao);
          });
        }
      }
      const arr = Array.from(allCCs).map(([codigo, descricao]) => ({ codigo, descricao }));
      setUniqueCCs(arr.sort((a,b) => a.codigo.localeCompare(b.codigo)));
    } catch (e) { console.error(e); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            
            let data = [];
            let headerIdx = -1;
            let idxConta = -1, idxContaDesc = -1, idxCC = -1, idxCCDesc = -1, idxValor = -1;

            // Procura a aba correta e a linha de cabeçalho
            for (const sheetName of wb.SheetNames) {
                if (sheetName.toLowerCase() === 'parametros') continue;
                
                const ws = wb.Sheets[sheetName];
                const sheetData = XLSX.utils.sheet_to_json(ws, { header: 1 });
                
                for (let r = 0; r < Math.min(sheetData.length, 50); r++) {
                    const row = sheetData[r];
                    if (!row) continue;
                    
                    const tempIdxConta = row.findIndex(h => h && typeof h === 'string' && h.includes('Cod Conta Mascara'));
                    const tempIdxCC = row.findIndex(h => h && typeof h === 'string' && h.includes('Codigo do Centro de Custo'));
                    const tempIdxValor = row.findIndex(h => h && typeof h === 'string' && h.includes('Soma Movimento'));
                    
                    if (tempIdxConta !== -1 && tempIdxCC !== -1 && tempIdxValor !== -1) {
                        data = sheetData;
                        headerIdx = r;
                        idxConta = tempIdxConta;
                        idxCC = tempIdxCC;
                        idxValor = tempIdxValor;
                        idxContaDesc = row.findIndex(h => h && typeof h === 'string' && h.includes('Descricao da Conta'));
                        idxCCDesc = row.findIndex(h => h && typeof h === 'string' && h.includes('Descricao do Centro de Custo'));
                        break;
                    }
                }
                if (headerIdx !== -1) break;
            }

            if (headerIdx === -1 || data.length < 2) {
                throw new Error("Colunas necessárias não encontradas em nenhuma aba. Esperado: 'Cod Conta Mascara', 'Codigo do Centro de Custo', 'Soma Movimento'.");
            }

            const parsedRecords = [];
            for (let i = headerIdx + 1; i < data.length; i++) {
                const row = data[i];
                if (!row || row.length === 0) continue;
                
                const cc = row[idxCC] ? row[idxCC].toString().trim() : '';
                if (!cc) continue;

                const valRaw = row[idxValor];
            let valor = 0;
            if (typeof valRaw === 'number') valor = valRaw;
            else if (typeof valRaw === 'string') valor = parseFloat(valRaw.replace(/\./g, '').replace(',', '.'));

            if (isNaN(valor)) valor = 0;

            parsedRecords.push({
                conta: row[idxConta] ? row[idxConta].toString().trim() : '',
                conta_descricao: row[idxContaDesc] ? row[idxContaDesc].toString().trim() : '',
                cc_codigo: cc,
                cc_descricao: row[idxCCDesc] ? row[idxCCDesc].toString().trim() : '',
                valor: valor
            });
        }
        setFileData(parsedRecords);
      } catch (err) {
        alert("Erro ao processar arquivo: " + err.message);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportSave = async () => {
    if (!selectedComp || !fileData || fileData.length === 0) {
      alert("Selecione a empresa e carregue um arquivo válido com dados antes de gravar.");
      return;
    }
    setIsProcessing(true);
    try {
      await saveCCToDB(fileData, selectedComp, selectedAno, selectedMes);
      alert("Centros de Custo gravados com sucesso!");
      setFileData(null);
      loadUniqueCCs();
      loadDbRecords();
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveProjects = async (newProjObj) => {
    setProjects(newProjObj);
    await saveSettings('agf_cc_projects', newProjObj);
  };

  const handleAddProject = () => {
    const name = prompt("Nome do novo projeto:");
    if (name && !projects[name]) {
        handleSaveProjects({ ...projects, [name]: [] });
    }
  };

  const handleToggleCC = (projName, ccCode) => {
      const projCCs = projects[projName] || [];
      let newCCs;
      if (projCCs.includes(ccCode)) {
          newCCs = projCCs.filter(c => c !== ccCode);
      } else {
          newCCs = [...projCCs, ccCode];
      }
      handleSaveProjects({ ...projects, [projName]: newCCs });
  };

    const handleDeleteProject = (projName) => {
        if (window.confirm("Deseja excluir este projeto?")) {
            const np = { ...projects };
            delete np[projName];
            handleSaveProjects(np);
            if (selectedProject === projName) setSelectedProject('');
        }
    };

    const handleRenameProject = (oldName) => {
        const newName = window.prompt("Novo nome do projeto:", oldName);
        if (newName && newName !== oldName && newName.trim() !== '') {
            if (projects[newName]) {
                alert("Já existe um projeto com este nome.");
                return;
            }
            const np = { ...projects };
            np[newName] = np[oldName];
            delete np[oldName];
            handleSaveProjects(np);
            if (selectedProject === oldName) setSelectedProject(newName);
        }
    };

    const handleBaseAnoChange = (e) => {
        const newAno = parseInt(e.target.value);
        setPeriodoBaseAno(newAno);
        setPeriodoCompAno(newAno - 1);
    };

    const handleBaseMesChange = (e) => {
        const newMes = parseInt(e.target.value);
        setPeriodoBaseMes(newMes);
        setPeriodoCompMes(newMes);
    };

    const handleBaseTriChange = (e) => {
        const newTri = parseInt(e.target.value);
        setPeriodoBaseTri(newTri);
        setPeriodoCompTri(newTri);
    };

  const loadDRE = async () => {
      if (!selectedProject || !projects[selectedProject]) {
          alert("Selecione um projeto válido.");
          return;
      }
      setIsProcessing(true);
      try {
          const targetCCs = projects[selectedProject];
  const getTargetPeriods = (ano, mes, tri, type) => {
      const targetAno = parseInt(ano);
      const targetMes = parseInt(mes);
      const targets = [];
      if (type === 'mensal') targets.push({ ano: targetAno, mes: targetMes });
      if (type === 'trimestral') {
          const t = parseInt(tri);
          targets.push({ ano: targetAno, mes: t*3 - 2 });
          targets.push({ ano: targetAno, mes: t*3 - 1 });
          targets.push({ ano: targetAno, mes: t*3 });
      }
      if (type === 'anual') {
          for (let i = 1; i <= targetMes; i++) targets.push({ ano: targetAno, mes: i });
      }
      if (type === 'ttm') {
          for (let i = 0; i < 12; i++) {
              let m = targetMes - i;
              let a = targetAno;
              if (m <= 0) { m += 12; a -= 1; }
              targets.push({ ano: a, mes: m });
          }
      }
      return targets;
  };

  const fetchAndFilter = async (ano, mes, tri, type, ccsArray) => {
      const targets = getTargetPeriods(ano, mes, tri, type);
      let allRecords = [];
      for (const t of targets) {
          const res = await getRawRecords(t.ano, t.mes);
          const filtered = (res.cc || []).filter(r => ccsArray.includes(r.cc_codigo));
          allRecords = allRecords.concat(filtered);
      }
              
              const grouped = {};
              allRecords.forEach(r => {
                  const key = r.conta;
                  if (!grouped[key]) grouped[key] = { ...r, valor: 0 };
                  grouped[key].valor += r.valor;
              });
              
              return Object.values(grouped);
          };

          const baseRecords = await fetchAndFilter(periodoBaseAno, periodoBaseMes, periodoBaseTri, periodType, targetCCs);
          const compRecords = await fetchAndFilter(periodoCompAno, periodoCompMes, periodoCompTri, periodType, targetCCs);

          if (includeRateio && rateioSource && projects[rateioSource] && rateioSource !== selectedProject) {
              const sourceCCs = projects[rateioSource];
              const baseSourceRecords = await fetchAndFilter(periodoBaseAno, periodoBaseMes, periodoBaseTri, periodType, sourceCCs);
              const compSourceRecords = await fetchAndFilter(periodoCompAno, periodoCompMes, periodoCompTri, periodType, sourceCCs);
              
              let pctBase = 0;
              let pctComp = 0;
              
              if (rateioRule === 'fixa') {
                  pctBase = (rateioFixedPct[selectedProject] || 0) / 100;
                  pctComp = pctBase;
              } else if (rateioRule === 'proporcional') {
            const getAllRevenue = async (ano, mes, tri, type) => {
      const targets = getTargetPeriods(ano, mes, tri, type);
      
      let totalRev = 0;
      let projRev = 0;
      for (const t of targets) {
        const res = await getRawRecords(t.ano, t.mes);
                          (res.cc || []).forEach(r => {
                              if (r.conta.startsWith('3.1.1.1.01') || r.conta.startsWith('3.1.1.1.02')) {
                                  if (targetCCs.includes(r.cc_codigo)) projRev += Math.abs(r.valor);
                                  if (!sourceCCs.includes(r.cc_codigo)) totalRev += Math.abs(r.valor);
                              }
                          });
                      }
                      return { totalRev, projRev };
                  };
                  
                  const revBase = await getAllRevenue(periodoBaseAno, periodoBaseMes, periodoBaseTri, periodType);
                  const revComp = await getAllRevenue(periodoCompAno, periodoCompMes, periodoCompTri, periodType);
                  
                  pctBase = revBase.totalRev > 0 ? (revBase.projRev / revBase.totalRev) : 0;
                  pctComp = revComp.totalRev > 0 ? (revComp.projRev / revComp.totalRev) : 0;
              }
              
              const appendRateio = (records, pct, targetArray) => {
                  if (pct > 0) {
                      records.forEach(r => {
                          targetArray.push({
                              ...r,
                              valor: r.valor * pct,
                              conta: '9.9.9.9.01',
                              conta_descricao: `Rateio de ${rateioSource} (${(pct * 100).toFixed(2)}%)`
                          });
                      });
                  }
              };
              
              appendRateio(baseSourceRecords, pctBase, baseRecords);
              appendRateio(compSourceRecords, pctComp, compRecords);
          }

          const baseDbData = baseRecords.map(r => ({ conta: r.conta, descricao: `${r.cc_codigo ? r.cc_codigo + ' | ' : ''}${r.conta_descricao}`, valorMensal: r.valor }));
          const compDbData = compRecords.map(r => ({ conta: r.conta, descricao: `${r.cc_codigo ? r.cc_codigo + ' | ' : ''}${r.conta_descricao}`, valorMensal: r.valor }));

          const mappedBase = applyMapping(baseDbData, protheusMapping.dre, 1, 'valorMensal');
          const mappedComp = applyMapping(compDbData, protheusMapping.dre, 1, 'valorMensal');

          setDreBase(mappedBase);
          setDreComp(mappedComp);
      } catch (e) {
          alert("Erro ao gerar DRE: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const getT = (mapped, groupName, lineName = null) => {
    if (!mapped || !mapped[groupName]) return 0;
    if (lineName) {
        return mapped[groupName][lineName] ? mapped[groupName][lineName].total : 0;
    }
    return mapped[groupName]['TOTAL'] ? mapped[groupName]['TOTAL'].total : 0;
  };

  const renderDRELine = (label, isGroup = false, groupName = null, isDeduct = false, bRec = 1, cRec = 1) => {
      if (!groupName) return null;
      
      let valBase = Math.abs(getT(dreBase, groupName));
      let valComp = Math.abs(getT(dreComp, groupName));

      const varRs = valBase - valComp;
      const varPct = valComp !== 0 ? (varRs / Math.abs(valComp)) * 100 : 0;
      const avB = bRec ? (valBase / bRec) * 100 : 0;
      const avC = cRec ? (valComp / cRec) * 100 : 0;
      const isExpanded = expandedGroups[groupName];
      const textColor = (label.includes('Custos') || label.includes('Despesas') || label.includes('Deduções') || isDeduct) ? '#E57373' : 'inherit';
      const isExpense = textColor === '#E57373';
      const colorPos = isExpense ? '#f44336' : '#4CAF50';
      const colorNeg = isExpense ? '#4CAF50' : '#f44336';

      return (
          <React.Fragment>
          <tr 
             style={{ background: isGroup ? 'rgba(255,255,255,0.05)' : 'transparent', fontWeight: isGroup ? 'bold' : 'normal', cursor: isGroup ? 'pointer' : 'default', color: textColor }}
             onClick={() => isGroup && toggleGroup(groupName)}
          >
              <td style={{ paddingLeft: isGroup ? '1rem' : '2rem' }}>
                  {isGroup ? (isExpanded ? '▼ ' : '▶ ') : ''}{label}
              </td>
              <td style={{ textAlign: 'right' }}>{valBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
              <td style={{ textAlign: 'right', color: '#999', fontSize: '0.85rem' }}>{avB.toFixed(1)}%</td>
              <td style={{ textAlign: 'right', color: '#888' }}>{valComp.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
              <td style={{ textAlign: 'right', color: '#999', fontSize: '0.85rem' }}>{avC.toFixed(1)}%</td>
              <td style={{ textAlign: 'right', color: varRs > 0 ? colorPos : (varRs < 0 ? colorNeg : '#fff') }}>
                  {varRs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </td>
              <td style={{ textAlign: 'right', color: varPct > 0 ? colorPos : (varPct < 0 ? colorNeg : '#fff') }}>
                  {varPct.toFixed(1)}%
              </td>
          </tr>
          {isExpanded && dreBase && dreBase[groupName] && Object.keys(dreBase[groupName]).map(acc => {
              if (acc === 'TOTAL') return null;
              
              const detailsB = dreBase[groupName][acc].details || [];
              const detailsC = (dreComp && dreComp[groupName] && dreComp[groupName][acc] && dreComp[groupName][acc].details) || [];
              
              const allAccounts = {};
              detailsB.forEach(d => { allAccounts[d.conta] = { descricao: d.descricao, b: Math.abs(d.valor), c: 0 }; });
              detailsC.forEach(d => { 
                  if (!allAccounts[d.conta]) allAccounts[d.conta] = { descricao: d.descricao, b: 0, c: 0 };
                  allAccounts[d.conta].c = Math.abs(d.valor);
              });

              return Object.keys(allAccounts).map(conta => {
                  const b = allAccounts[conta].b;
                  const c = allAccounts[conta].c;
                  const desc = allAccounts[conta].descricao;
                  if (b === 0 && c === 0) return null;
                  
                  const vRs = b - c;
                  const vPct = c !== 0 ? (vRs / Math.abs(c)) * 100 : 0;
                  
                  return (
                      <tr key={acc + conta} style={{ background: 'transparent', fontSize: '0.85rem' }}>
                          <td style={{ paddingLeft: '3rem', color: '#999' }}>{conta} - {desc}</td>
                          <td style={{ textAlign: 'right', color: '#999' }}>{b.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          <td style={{ textAlign: 'right', color: '#666' }}>{bRec ? ((b / bRec)*100).toFixed(1) + '%' : '0.0%'}</td>
                          <td style={{ textAlign: 'right', color: '#777' }}>{c.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          <td style={{ textAlign: 'right', color: '#666' }}>{cRec ? ((c / cRec)*100).toFixed(1) + '%' : '0.0%'}</td>
                          <td style={{ textAlign: 'right', color: vRs > 0 ? '#81C784' : (vRs < 0 ? '#E57373' : '#aaa') }}>
                              {vRs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td style={{ textAlign: 'right', color: vPct > 0 ? '#81C784' : (vPct < 0 ? '#E57373' : '#aaa') }}>
                              {vPct.toFixed(1)}%
                          </td>
                      </tr>
                  );
              });
          })}
          </React.Fragment>
      );
  };

  const renderDRESubtotal = (label, valBase, valComp, bRec = 1, cRec = 1) => {
      const varRs = valBase - valComp;
      const varPct = valComp !== 0 ? (varRs / Math.abs(valComp)) * 100 : 0;
      const avB = bRec ? (valBase / bRec) * 100 : 0;
      const avC = cRec ? (valComp / cRec) * 100 : 0;
      return (
          <tr style={{ background: 'rgba(76, 175, 80, 0.1)', fontWeight: 'bold', color: '#4CAF50' }}>
              <td style={{ paddingLeft: '1rem', borderTop: '1px solid #444', borderBottom: '1px solid #444' }}>{label}</td>
              <td style={{ textAlign: 'right', borderTop: '1px solid #444', borderBottom: '1px solid #444' }}>{valBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
              <td style={{ textAlign: 'right', color: '#81C784', fontSize: '0.85rem', borderTop: '1px solid #444', borderBottom: '1px solid #444' }}>{avB.toFixed(1)}%</td>
              <td style={{ textAlign: 'right', color: '#888', borderTop: '1px solid #444', borderBottom: '1px solid #444' }}>{valComp.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
              <td style={{ textAlign: 'right', color: '#888', fontSize: '0.85rem', borderTop: '1px solid #444', borderBottom: '1px solid #444' }}>{avC.toFixed(1)}%</td>
              <td style={{ textAlign: 'right', color: varRs > 0 ? '#81C784' : (varRs < 0 ? '#E57373' : '#fff'), borderTop: '1px solid #444', borderBottom: '1px solid #444' }}>
                  {varRs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </td>
              <td style={{ textAlign: 'right', color: varPct > 0 ? '#81C784' : (varPct < 0 ? '#E57373' : '#fff'), borderTop: '1px solid #444', borderBottom: '1px solid #444' }}>
                  {varPct.toFixed(1)}%
              </td>
          </tr>
      );
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '1rem' }}>
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #333', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <button className={activeTab === 'dre' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('dre')}>DRE</button>
        {(userRole === 'admin' || userRole === 'superadmin') && (
            <>
                <button className={activeTab === 'config' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('config')}>Configuração Projetos</button>
                <button className={activeTab === 'rateio' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('rateio')}>Regras de Rateio</button>
                <button className={activeTab === 'import' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('import')}>Banco de Dados</button>
            </>
        )}
      </div>

      {activeTab === 'import' && (
        <div>
          <h3 style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>Importar Balancete por Centro de Custo</h3>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <select value={selectedComp} onChange={e => setSelectedComp(e.target.value)} className="select-input">
              <option value="">Selecione a Empresa...</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={selectedMes} onChange={e => setSelectedMes(e.target.value)} className="select-input">
              {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][i]}</option>)}
            </select>
            <select value={selectedAno} onChange={e => setSelectedAno(e.target.value)} className="select-input">
              {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div style={{ border: '2px dashed #444', padding: '2rem', textAlign: 'center', borderRadius: '8px', marginBottom: '1rem' }}>
            <p style={{ color: '#aaa', marginBottom: '1rem' }}>Selecione a planilha de balancete por Centro de Custo (Excel).</p>
                    <label style={{ marginRight: '1rem', fontWeight: 'bold' }}>Importar Novo Balancete:</label>
                    <input 
                        type="file" 
                        accept=".xls,.xlsx" 
                        onChange={handleFileUpload}
                        onClick={(e) => { e.target.value = null; setFileData(null); }}
                    />
          </div>

          {isProcessing && <div className="loading-spinner" style={{ margin: '1rem auto' }}></div>}

          {fileData && !isProcessing && (
            <div style={{ background: 'rgba(76, 175, 80, 0.1)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <span style={{ color: '#4CAF50' }}>✓ {fileData.length} registros prontos para gravação.</span>
              <button className="btn-primary" onClick={handleImportSave}>Gravar no Banco</button>
            </div>
          )}

          {dbRecords.length > 0 && !fileData && (
              <div style={{ marginTop: '2rem' }}>
                  <h4 style={{ color: '#FF9800', marginBottom: '1rem' }}>
                      Dados no Banco ({dbRecords.length} registros)
                  </h4>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      <table className="data-table">
                          <thead>
                              <tr>
                                  <th>Centro de Custo</th>
                                  <th>Conta</th>
                                  <th>Valor (R$)</th>
                              </tr>
                          </thead>
                          <tbody>
                              {dbRecords.map((r, i) => (
                                  <tr key={i}>
                                      <td>{r.cc_codigo} - {r.cc_descricao}</td>
                                      <td>{r.conta} - {r.conta_descricao}</td>
                                      <td style={{ textAlign: 'right' }}>{r.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}
        </div>
      )}

      {activeTab === 'config' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
             <h3 style={{ color: 'var(--color-primary)' }}>Configuração de Projetos</h3>
             <button className="btn-secondary" onClick={handleAddProject}>+ Novo Projeto</button>
          </div>
          
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div style={{ flex: 1 }}>
              {Object.keys(projects).length === 0 ? (
                  <p style={{ color: '#888' }}>Nenhum projeto configurado.</p>
              ) : (
                  Object.keys(projects).map(proj => {
                      const isExpanded = expandedConfigProject === proj;
                      return (
                          <div key={proj} style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', cursor: 'pointer', flex: 1 }} onClick={() => setExpandedConfigProject(isExpanded ? null : proj)}>
                                      <span style={{ fontSize: '1.2rem', color: '#aaa', width: '20px' }}>{isExpanded ? '▼' : '▶'}</span>
                                      <h4 style={{ color: '#FF9800', margin: 0 }}>{proj}</h4>
                                  </div>
                                  {isExpanded && (
                                      <input
                                          type="text"
                                          placeholder="Pesquisar CC..."
                                          value={ccSearch}
                                          onChange={e => setCcSearch(e.target.value)}
                                          className="select-input"
                                          style={{ padding: '0.3rem 0.5rem', width: '200px', marginRight: '1rem' }}
                                          onClick={e => e.stopPropagation()}
                                      />
                                  )}
                                  <div style={{ display: 'flex', gap: '1rem' }}>
                                      <button style={{ background: 'transparent', border: 'none', color: '#2196F3', cursor: 'pointer', fontWeight: 'bold' }} onClick={(e) => { e.stopPropagation(); handleRenameProject(proj); }}>Editar</button>
                                      <button style={{ background: 'transparent', border: 'none', color: '#f44336', cursor: 'pointer', fontWeight: 'bold' }} onClick={(e) => { e.stopPropagation(); handleDeleteProject(proj); }}>Excluir</button>
                                  </div>
                              </div>
                              {isExpanded && (
                                  <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', padding: '0.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: '4px' }}>
                                      {uniqueCCs.filter(cc => cc.codigo.toLowerCase().includes(ccSearch.toLowerCase()) || cc.descricao.toLowerCase().includes(ccSearch.toLowerCase())).map(cc => (
                                          <div key={cc.codigo} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px', border: projects[proj].includes(cc.codigo) ? '1px solid #4CAF50' : '1px solid transparent' }}>
                                              <input
                                                  type="checkbox"
                                                  checked={projects[proj].includes(cc.codigo)}
                                                  onChange={() => handleToggleCC(proj, cc.codigo)}
                                              />
                                              <span style={{ fontSize: '0.85rem' }}>{cc.codigo} - {cc.descricao}</span>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>
                      );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rateio' && (
          <div>
              <h3 style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>Regras de Rateio</h3>
              <p style={{ color: '#aaa', marginBottom: '1.5rem' }}>Configure como as despesas de um projeto "Origem" (Ex: Administrativo) serão absorvidas pelos outros projetos na DRE.</p>

              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                      <div style={{ flex: 1, minWidth: '250px' }}>
                          <label style={{ display: 'block', color: '#888', marginBottom: '0.5rem' }}>Projeto Origem (Despesas a Ratear):</label>
                          <select value={rateioSource} onChange={e => handleSaveRateio(e.target.value, rateioRule, rateioFixedPct)} className="select-input" style={{ width: '100%' }}>
                              <option value="">Selecione o Projeto...</option>
                              {Object.keys(projects).map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                      </div>
                      <div style={{ flex: 1, minWidth: '250px' }}>
                          <label style={{ display: 'block', color: '#888', marginBottom: '0.5rem' }}>Regra de Distribuição:</label>
                          <select value={rateioRule} onChange={e => handleSaveRateio(rateioSource, e.target.value, rateioFixedPct)} className="select-input" style={{ width: '100%' }}>
                              <option value="proporcional">Automática (Proporcional à Receita Bruta/Líquida)</option>
                              <option value="fixa">Manual (Porcentagem Fixa por Projeto)</option>
                          </select>
                      </div>
                  </div>
                  
                  {rateioRule === 'fixa' && rateioSource && (
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px' }}>
                          <h4 style={{ color: '#FF9800', marginBottom: '1rem' }}>Porcentagem Fixa de Absorção</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                              {Object.keys(projects).filter(p => p !== rateioSource).map(p => (
                                  <div key={p} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                      <label style={{ color: '#ccc', fontSize: '0.9rem' }}>{p}</label>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                          <input 
                                              type="number" 
                                              min="0" 
                                              max="100"
                                              value={rateioFixedPct[p] || ''} 
                                              onChange={e => handleSaveRateio(rateioSource, rateioRule, { ...rateioFixedPct, [p]: Number(e.target.value) })}
                                              className="select-input"
                                              style={{ width: '100px', paddingRight: '1rem' }}
                                          />
                                          <span>%</span>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}

      {activeTab === 'dre' && (
        <div>
          <h3 style={{ color: 'var(--color-primary)', marginBottom: '0.5rem' }}>DRE do Projeto{selectedProject ? `: ${selectedProject}` : ''}</h3>
          <div className="print-only" style={{ marginBottom: '1.5rem', color: '#888', fontSize: '0.9rem' }}>
              <strong>Período Base:</strong> {periodoBaseAno} {periodType === 'mensal' ? `- ${['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][periodoBaseMes - 1]}` : (periodType === 'trimestral' ? `- ${periodoBaseTri}º Tri` : '')} |&nbsp;
              <strong>Período Comparativo:</strong> {periodoCompAno} {periodType === 'mensal' ? `- ${['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][periodoCompMes - 1]}` : (periodType === 'trimestral' ? `- ${periodoCompTri}º Tri` : '')}
              {includeRateio && <span> | <strong style={{color: '#4CAF50'}}>Com Rateio Absorvido</strong></span>}
          </div>

          <div className="no-print" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem' }}>
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className="select-input" style={{ flex: 1, minWidth: '200px' }}>
                <option value="">Selecione um Projeto...</option>
                {Object.keys(projects).map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ color: '#aaa', fontSize: '0.85rem' }}>Visualização:</span>
                      <select value={periodType} onChange={e => setPeriodType(e.target.value)} className="select-input" style={{ width: 'auto', minWidth: '130px' }}>
                          <option value="mensal">Mensal</option>
                          <option value="trimestral">Trimestral</option>
                          <option value="anual">Acumulado do Ano (YTD)</option>
                          <option value="ttm">Acumulado 12 Meses</option>
                      </select>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ color: '#aaa', fontSize: '0.85rem' }}>Base:</span>
                <select value={periodoBaseAno} onChange={handleBaseAnoChange} className="select-input" style={{ width: 'auto', minWidth: '100px' }}>
                    {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                {periodType !== 'trimestral' && (
                    <select value={periodoBaseMes} onChange={handleBaseMesChange} className="select-input" style={{ width: 'auto', minWidth: '80px' }}>
                        {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][i]}</option>)}
                    </select>
                )}
                {periodType === 'trimestral' && (
                    <select value={periodoBaseTri} onChange={handleBaseTriChange} className="select-input" style={{ width: 'auto', minWidth: '80px' }}>
                        <option value={1}>1º Tri</option>
                        <option value={2}>2º Tri</option>
                        <option value={3}>3º Tri</option>
                        <option value={4}>4º Tri</option>
                    </select>
                )}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ color: '#aaa', fontSize: '0.85rem' }}>Comp:</span>
                <select value={periodoCompAno} onChange={e => setPeriodoCompAno(e.target.value)} className="select-input" style={{ width: 'auto', minWidth: '100px' }}>
                    {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                {periodType !== 'trimestral' && (
                    <select value={periodoCompMes} onChange={e => setPeriodoCompMes(e.target.value)} className="select-input" style={{ width: 'auto', minWidth: '80px' }}>
                        {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][i]}</option>)}
                    </select>
                )}
                {periodType === 'trimestral' && (
                    <select value={periodoCompTri} onChange={e => setPeriodoCompTri(e.target.value)} className="select-input" style={{ width: 'auto', minWidth: '80px' }}>
                        <option value={1}>1º Tri</option>
                        <option value={2}>2º Tri</option>
                        <option value={3}>3º Tri</option>
                        <option value={4}>4º Tri</option>
                    </select>
                )}
            </div>

            <label className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ccc', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
                <input type="checkbox" checked={includeRateio} onChange={e => setIncludeRateio(e.target.checked)} />
                Incluir Rateio
            </label>

            <button className="btn-primary" onClick={loadDRE} disabled={isProcessing || !selectedProject}>
                {isProcessing ? 'Gerando...' : 'Gerar DRE'}
            </button>
            {dreBase && (
                <button className="btn-secondary" onClick={() => window.print()} style={{ marginLeft: 'auto' }}>
                    Gerar PDF
                </button>
            )}
          </div>

          {dreBase && dreComp && (
              <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                      <thead>
                          <tr>
                              <th>Conta / Descrição</th>
                              <th style={{ textAlign: 'right' }}>Período Base</th>
                              <th style={{ textAlign: 'right' }}>AV (%)</th>
                              <th style={{ textAlign: 'right' }}>Período Comp.</th>
                              <th style={{ textAlign: 'right' }}>AV (%)</th>
                              <th style={{ textAlign: 'right' }}>Variação (R$)</th>
                              <th style={{ textAlign: 'right' }}>Variação (%)</th>
                          </tr>
                      </thead>
                      <tbody>
                          {(() => {
                              const bRec = Math.abs(getT(dreBase, 'RECEITA OPERACIONAL BRUTA')) || 1;
                              const cRec = Math.abs(getT(dreComp, 'RECEITA OPERACIONAL BRUTA')) || 1;

                              const bDed = Math.abs(getT(dreBase, 'DEDUÇÕES DA RECEITA'));
                              const cDed = Math.abs(getT(dreComp, 'DEDUÇÕES DA RECEITA'));

                              const bCustos = Math.abs(getT(dreBase, 'CUSTOS'));
                              const cCustos = Math.abs(getT(dreComp, 'CUSTOS'));

                              const bVen = Math.abs(getT(dreBase, 'DESPESAS COM VENDAS'));
                              const cVen = Math.abs(getT(dreComp, 'DESPESAS COM VENDAS'));

                              const bAdm = Math.abs(getT(dreBase, 'DESPESAS ADMINISTRATIVAS'));
                              const cAdm = Math.abs(getT(dreComp, 'DESPESAS ADMINISTRATIVAS'));

                              const bTrib = Math.abs(getT(dreBase, 'DESPESAS TRIBUTÁRIAS'));
                              const cTrib = Math.abs(getT(dreComp, 'DESPESAS TRIBUTÁRIAS'));

                              const bRateio = Math.abs(getT(dreBase, 'DESPESAS DE RATEIO'));
                              const cRateio = Math.abs(getT(dreComp, 'DESPESAS DE RATEIO'));

                              const bLiq = bRec - bDed;
                              const cLiq = cRec - cDed;

                              const bBruto = bLiq - bCustos;
                              const cBruto = cLiq - cCustos;

                              const bOp = bBruto - bVen - bAdm - bTrib;
                              const cOp = cBruto - cVen - cAdm - cTrib;

                              const bOpPosRateio = bOp - bRateio;
                              const cOpPosRateio = cOp - cRateio;

                              const bFinLiq = Math.abs(getT(dreBase, 'RECEITAS FINANCEIRAS')) - Math.abs(getT(dreBase, 'DESPESAS FINANCEIRAS')) - Math.abs(getT(dreBase, 'AJUSTES FINANCEIROS'));
                              const cFinLiq = Math.abs(getT(dreComp, 'RECEITAS FINANCEIRAS')) - Math.abs(getT(dreComp, 'DESPESAS FINANCEIRAS')) - Math.abs(getT(dreComp, 'AJUSTES FINANCEIROS'));

                              const bOutras = Math.abs(getT(dreBase, 'OUTRAS RECEITAS E DESPESAS'));
                              const cOutras = Math.abs(getT(dreComp, 'OUTRAS RECEITAS E DESPESAS'));

                              const bLucroLiq = (includeRateio ? bOpPosRateio : bOp) + bFinLiq + bOutras;
                              const cLucroLiq = (includeRateio ? cOpPosRateio : cOp) + cFinLiq + cOutras;

                              return (
                                  <React.Fragment>
                                      {renderDRELine('RECEITA OPERACIONAL BRUTA', true, 'RECEITA OPERACIONAL BRUTA', false, bLiq || 1, cLiq || 1)}
                                      {renderDRELine('(-) Deduções da Receita Bruta', true, 'DEDUÇÕES DA RECEITA', true, bLiq || 1, cLiq || 1)}
                                      {renderDRESubtotal('Receita Operacional Líquida', bLiq, cLiq, bLiq || 1, cLiq || 1)}
                                      
                                      {renderDRELine('(-) Custos dos Serviços / Produtos', true, 'CUSTOS', false, bLiq || 1, cLiq || 1)}
                                      {renderDRESubtotal('Lucro Bruto', bBruto, cBruto, bLiq || 1, cLiq || 1)}
                                      
                                      {renderDRELine('(-) Despesas com Vendas', true, 'DESPESAS COM VENDAS', false, bLiq || 1, cLiq || 1)}
                                      {renderDRELine('(-) Despesas Administrativas', true, 'DESPESAS ADMINISTRATIVAS', false, bLiq || 1, cLiq || 1)}
                                      {renderDRELine('(-) Despesas Tributárias', true, 'DESPESAS TRIBUTÁRIAS', false, bLiq || 1, cLiq || 1)}
                                      {renderDRESubtotal('Lucro Operacional', bOp, cOp, bLiq || 1, cLiq || 1)}
                                      
                                      {includeRateio && (
                                          <React.Fragment>
                                              {renderDRELine('(-) Despesas Absorvidas de Rateio', true, 'DESPESAS DE RATEIO', false, bLiq || 1, cLiq || 1)}
                                              {renderDRESubtotal('Lucro Operacional (Pós-Rateio)', bOpPosRateio, cOpPosRateio, bLiq || 1, cLiq || 1)}
                                          </React.Fragment>
                                      )}

                                      {renderDRELine('(+) Receitas Financeiras', true, 'RECEITAS FINANCEIRAS', false, bLiq || 1, cLiq || 1)}
                                      {renderDRELine('(-) Despesas Financeiras', true, 'DESPESAS FINANCEIRAS', false, bLiq || 1, cLiq || 1)}
                                      {renderDRELine('(+/-) Ajustes Financeiros', true, 'AJUSTES FINANCEIROS', false, bLiq || 1, cLiq || 1)}
                                      
                                      {renderDRESubtotal('Resultado Financeiro Líquido', bFinLiq, cFinLiq, bLiq || 1, cLiq || 1)}

                                      {renderDRELine('(+/-) Outras Receitas e Despesas', true, 'OUTRAS RECEITAS E DESPESAS', false, bLiq || 1, cLiq || 1)}

                                      {renderDRESubtotal('LUCRO LÍQUIDO DO EXERCÍCIO', bLucroLiq, cLucroLiq, bLiq || 1, cLiq || 1)}
                                  </React.Fragment>
                              );
                          })()}
                      </tbody>
                  </table>
              </div>
          )}
        </div>
      )}
    </div>
  );
}
