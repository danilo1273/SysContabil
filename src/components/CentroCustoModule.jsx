import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { getRawRecords, saveCCToDB, getSettings, saveSettings } from '../utils/db';
import { applyMapping, protheusMapping } from '../utils/mappingConfig';
import { supabase } from '../supabaseClient';

export default function CentroCustoModule({ companies, userRole, userPermissions, username }) {
  const isSuper = (['danilo', 'ryan.santos'].includes(username)) || userRole === 'admin' || userRole === 'superadmin';
  const canAccessDB = isSuper || userPermissions?.includes('db');
  const canConfig = isSuper || userPermissions?.includes('contabil') || userPermissions?.includes('db');

  const [activeTab, setActiveTab] = useState(canAccessDB ? 'import' : 'dre'); // import, config, dre, rateio
  
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

  // Rateio State (Suporte a múltiplos Projetos de Rateio)
  const [rateioList, setRateioList] = useState([]); // [{ id, source, rule, fixedPct: {}, targetProjects: [] }]
  const [selectedNewRateioSource, setSelectedNewRateioSource] = useState('');
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
      let query = supabase.from('cc_history').select('*').eq('ano', selectedAno).eq('mes', selectedMes);
      if (selectedComp) {
        query = query.eq('empresaId', selectedComp);
      }
      const { data, error } = await query;
      if (error) throw error;
      setDbRecords(data || []);
    } catch (e) {
      console.error("Erro ao carregar CC do banco:", e);
      setDbRecords([]);
    }
  };

  const loadSettings = async () => {
      try {
          const p = await getSettings('agf_cc_projects');
          if (p) setProjects(p);
          const r = await getSettings('agf_cc_rateio_config');
          if (r) {
              if (Array.isArray(r.rateioList)) {
                  setRateioList(r.rateioList);
              } else if (r.source) {
                  setRateioList([{
                      id: 'rateio-legacy',
                      source: r.source,
                      rule: r.rule || 'proporcional',
                      fixedPct: r.fixedPct || {},
                      targetProjects: []
                  }]);
              }
          }
      } catch (e) { console.error(e); }
  };

  const saveRateioListToDB = async (newList) => {
      setRateioList(newList);
      await saveSettings('agf_cc_rateio_config', { rateioList: newList });
  };

  const handleAddRateioProject = (sourceProj) => {
      if (!sourceProj) return;
      if (rateioList.some(r => r.source === sourceProj)) {
          window.$alert('Este projeto já possui uma regra de rateio cadastrada.');
          return;
      }
      const initialFixed = {};
      Object.keys(projects).filter(p => p !== sourceProj).forEach(p => {
          initialFixed[p] = 0;
      });
      const newEntry = {
          id: 'rateio-' + Date.now(),
          source: sourceProj,
          rule: 'proporcional', // 'proporcional' | 'fixa'
          fixedPct: initialFixed,
          targetProjects: Object.keys(projects).filter(p => p !== sourceProj)
      };
      const updated = [...rateioList, newEntry];
      saveRateioListToDB(updated);
      setSelectedNewRateioSource('');
      window.$toast(`Projeto "${sourceProj}" adicionado como Origem de Rateio!`, { type: 'success' });
  };

  const handleRemoveRateioProject = (id) => {
      const updated = rateioList.filter(r => r.id !== id);
      saveRateioListToDB(updated);
      window.$toast('Regra de rateio removida.', { type: 'info' });
  };

  const handleUpdateRateioRule = (id, field, value) => {
      const updated = rateioList.map(item => {
          if (item.id === id) {
              return { ...item, [field]: value };
          }
          return item;
      });
      saveRateioListToDB(updated);
  };

  const handleUpdateFixedPct = (id, targetProj, pct) => {
      const updated = rateioList.map(item => {
          if (item.id === id) {
              return {
                  ...item,
                  fixedPct: {
                      ...(item.fixedPct || {}),
                      [targetProj]: parseFloat(pct) || 0
                  }
              };
          }
          return item;
      });
      saveRateioListToDB(updated);
  };

  const handleToggleTargetProject = (id, targetProj) => {
      const updated = rateioList.map(item => {
          if (item.id === id) {
              const currentTargets = item.targetProjects || Object.keys(projects).filter(p => p !== item.source);
              let newTargets;
              if (currentTargets.includes(targetProj)) {
                  newTargets = currentTargets.filter(p => p !== targetProj);
              } else {
                  newTargets = [...currentTargets, targetProj];
              }
              return { ...item, targetProjects: newTargets };
          }
          return item;
      });
      saveRateioListToDB(updated);
  };

  const handleDistributeEvenly = (id) => {
      const item = rateioList.find(r => r.id === id);
      if (!item) return;
      const targets = Object.keys(projects).filter(p => p !== item.source);
      if (targets.length === 0) return;
      const evenPct = parseFloat((100 / targets.length).toFixed(2));
      const newFixed = {};
      targets.forEach((p, idx) => {
          if (idx === targets.length - 1) {
              // Ajuste de arredondamento no último
              const sumPrev = evenPct * (targets.length - 1);
              newFixed[p] = parseFloat((100 - sumPrev).toFixed(2));
          } else {
              newFixed[p] = evenPct;
          }
      });
      const updated = rateioList.map(r => r.id === id ? { ...r, fixedPct: newFixed } : r);
      saveRateioListToDB(updated);
      window.$toast('Percentuais divididos igualmente!', { type: 'success' });
  };

  const loadUniqueCCs = async () => {
    try {
      const { data, error } = await supabase.from('cc_history').select('cc_codigo, cc_descricao');
      if (error) throw error;
      let allCCs = new Map();
      if (data) {
        data.forEach(r => {
          if (r.cc_codigo) allCCs.set(r.cc_codigo.toString().trim(), (r.cc_descricao || '').toString().trim());
        });
      }
      const arr = Array.from(allCCs).map(([codigo, descricao]) => ({ codigo, descricao }));
      setUniqueCCs(arr.sort((a,b) => a.codigo.localeCompare(b.codigo)));
    } catch (e) { console.error("Erro ao carregar CCs únicos:", e); }
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

            const norm = (str) => (str || '').toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

            const isContaCol = (h) => {
                const n = norm(h);
                return n.includes('cod conta') || n.includes('conta mascara') || n.includes('conta contabil') || n === 'conta' || n === 'cod. conta' || n === 'codigo conta' || n === 'cod conta mascara';
            };

            const isContaDescCol = (h) => {
                const n = norm(h);
                return (n.includes('desc') || n.includes('nome') || n.includes('titulo')) && n.includes('conta');
            };

            const isCCCol = (h) => {
                const n = norm(h);
                return (n.includes('centro') && n.includes('custo') && (n.includes('cod') || !n.includes('desc'))) || n === 'cc' || n === 'cod cc' || n === 'cod. cc' || n.includes('codigo do centro de custo') || n === 'centro de custo' || n === 'centro custo';
            };

            const isCCDescCol = (h) => {
                const n = norm(h);
                return (n.includes('desc') || n.includes('nome') || n.includes('titulo')) && (n.includes('centro') || n.includes('cc') || n.includes('custo'));
            };

            const isValorCol = (h) => {
                const n = norm(h);
                return n.includes('soma movimento') || n.includes('movimento') || n.includes('saldo') || n.includes('valor') || n.includes('debito') || n.includes('credito');
            };

            // Procura a aba correta e a linha de cabeçalho
            for (const sheetName of wb.SheetNames) {
                if (sheetName.toLowerCase() === 'parametros') continue;
                
                const ws = wb.Sheets[sheetName];
                const sheetData = XLSX.utils.sheet_to_json(ws, { header: 1 });
                
                for (let r = 0; r < Math.min(sheetData.length, 50); r++) {
                    const row = sheetData[r];
                    if (!row || !Array.isArray(row)) continue;
                    
                    const tempIdxConta = row.findIndex(h => isContaCol(h));
                    const tempIdxCC = row.findIndex(h => isCCCol(h));
                    const tempIdxValor = row.findIndex(h => isValorCol(h));
                    
                    if (tempIdxConta !== -1 && tempIdxCC !== -1 && tempIdxValor !== -1) {
                        data = sheetData;
                        headerIdx = r;
                        idxConta = tempIdxConta;
                        idxCC = tempIdxCC;
                        idxValor = tempIdxValor;
                        idxContaDesc = row.findIndex(h => isContaDescCol(h));
                        idxCCDesc = row.findIndex(h => isCCDescCol(h));
                        break;
                    }
                }
                if (headerIdx !== -1) break;
            }

            if (headerIdx === -1 || data.length < 2) {
                throw new Error("Colunas necessárias não encontradas na planilha. Esperado colunas para Conta Contábil, Centro de Custo e Valor/Movimento.");
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
                else if (typeof valRaw === 'string') {
                    const cleanStr = valRaw.trim().replace(/\s/g, '');
                    if (cleanStr.includes(',') && cleanStr.includes('.')) {
                        valor = parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'));
                    } else if (cleanStr.includes(',')) {
                        valor = parseFloat(cleanStr.replace(',', '.'));
                    } else {
                        valor = parseFloat(cleanStr);
                    }
                }

                if (isNaN(valor)) valor = 0;

                parsedRecords.push({
                    conta: row[idxConta] ? row[idxConta].toString().trim() : '',
                    conta_descricao: (idxContaDesc !== -1 && row[idxContaDesc]) ? row[idxContaDesc].toString().trim() : '',
                    cc_codigo: cc,
                    cc_descricao: (idxCCDesc !== -1 && row[idxCCDesc]) ? row[idxCCDesc].toString().trim() : '',
                    valor: valor
                });
            }

            if (parsedRecords.length === 0) {
                throw new Error("Nenhum registro com Centro de Custo preenchido foi encontrado após a linha de cabeçalho.");
            }

            setFileData(parsedRecords);
            window.$toast(`${parsedRecords.length} lançamentos de Centro de Custo carregados do arquivo! Clique em Gravar para salvar no banco.`, { type: 'info' });
      } catch (err) {
        console.error(err);
        window.$alert("Erro ao processar arquivo: " + err.message, { type: 'danger' });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportSave = async () => {
    if (!selectedComp || !fileData || fileData.length === 0) {
      window.$alert("Selecione a empresa e carregue um arquivo válido com dados antes de gravar.");
      return;
    }
    setIsProcessing(true);
    try {
      await saveCCToDB(fileData, selectedComp, selectedAno, selectedMes);
      window.$toast("Centros de Custo gravados com sucesso no banco de dados!", { type: 'success' });
      setFileData(null);
      await loadUniqueCCs();
      await loadDbRecords();
    } catch (e) {
      window.$alert("Erro ao salvar: " + e.message, { type: 'danger' });
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
                window.$alert("Já existe um projeto com este nome.");
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
          window.$alert("Selecione um projeto válido.");
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

          if (includeRateio && rateioList && rateioList.length > 0) {
              for (const rateioItem of rateioList) {
                  const sourceName = rateioItem.source;
                  if (!sourceName || !projects[sourceName] || sourceName === selectedProject) continue;
                  
                  const sourceCCs = projects[sourceName];
                  if (!sourceCCs || sourceCCs.length === 0) continue;

                  const baseSourceRecords = await fetchAndFilter(periodoBaseAno, periodoBaseMes, periodoBaseTri, periodType, sourceCCs);
                  const compSourceRecords = await fetchAndFilter(periodoCompAno, periodoCompMes, periodoCompTri, periodType, sourceCCs);
                  
                  let pctBase = 0;
                  let pctComp = 0;
                  
                  if (rateioItem.rule === 'fixa') {
                      pctBase = (rateioItem.fixedPct?.[selectedProject] || 0) / 100;
                      pctComp = pctBase;
                  } else if (rateioItem.rule === 'proporcional') {
                      const validTargets = (rateioItem.targetProjects && rateioItem.targetProjects.length > 0) 
                          ? rateioItem.targetProjects 
                          : Object.keys(projects).filter(p => p !== sourceName);
                      
                      if (validTargets.includes(selectedProject)) {
                          const getRevenueShare = async (ano, mes, tri, type) => {
                              const targets = getTargetPeriods(ano, mes, tri, type);
                              let totalPoolRev = 0;
                              let thisProjRev = 0;
                              
                              for (const t of targets) {
                                  const res = await getRawRecords(t.ano, t.mes);
                                  const ccRows = res.cc || [];
                                  
                                  // Calcular receita de cada projeto participante
                                  validTargets.forEach(tName => {
                                      const tCCs = projects[tName] || [];
                                      ccRows.forEach(r => {
                                          if ((r.conta.startsWith('3.1.1.1.01') || r.conta.startsWith('3.1.1.1.02')) && tCCs.includes(r.cc_codigo)) {
                                              const v = Math.abs(r.valor || 0);
                                              totalPoolRev += v;
                                              if (tName === selectedProject) thisProjRev += v;
                                          }
                                      });
                                  });
                              }
                              return totalPoolRev > 0 ? (thisProjRev / totalPoolRev) : 0;
                          };
                          
                          pctBase = await getRevenueShare(periodoBaseAno, periodoBaseMes, periodoBaseTri, periodType);
                          pctComp = await getRevenueShare(periodoCompAno, periodoCompMes, periodoCompTri, periodType);
                      }
                  }
                  
                  const appendRateio = (records, pct, targetArray) => {
                      if (pct > 0 && records && records.length > 0) {
                          // Agrupar por Centro de Custo da Origem para demonstrar o CC claramente e sem divergencia de soma
                          const ccTotals = {};
                          records.forEach(r => {
                              const ccKey = r.cc_codigo || 'GERAL';
                              const ccDesc = r.cc_descricao || '';
                              if (!ccTotals[ccKey]) {
                                  ccTotals[ccKey] = {
                                      cc_codigo: ccKey,
                                      cc_descricao: ccDesc,
                                      valor: 0
                                  };
                              }
                              ccTotals[ccKey].valor += (r.valor || 0);
                          });

                          Object.values(ccTotals).forEach(ccItem => {
                              const valAbsorvido = ccItem.valor * pct;
                              if (Math.abs(valAbsorvido) > 0.001) {
                                  targetArray.push({
                                      conta: '9.9.9.9.01',
                                      conta_descricao: `Rateio: CC ${ccItem.cc_codigo}${ccItem.cc_descricao ? ' - ' + ccItem.cc_descricao : ''} (${sourceName} ${(pct * 100).toFixed(2)}%)`,
                                      cc_codigo: ccItem.cc_codigo,
                                      cc_descricao: ccItem.cc_descricao,
                                      valor: valAbsorvido,
                                      isRateio: true
                                  });
                              }
                          });
                      }
                  };
                  
                  appendRateio(baseSourceRecords, pctBase, baseRecords);
                  appendRateio(compSourceRecords, pctComp, compRecords);
              }
          }

          const baseDbData = baseRecords.map(r => ({ 
              conta: r.conta, 
              descricao: r.isRateio ? r.conta_descricao : `${r.cc_codigo ? r.cc_codigo + ' | ' : ''}${r.conta_descricao}`, 
              valorMensal: r.valor 
          }));
          const compDbData = compRecords.map(r => ({ 
              conta: r.conta, 
              descricao: r.isRateio ? r.conta_descricao : `${r.cc_codigo ? r.cc_codigo + ' | ' : ''}${r.conta_descricao}`, 
              valorMensal: r.valor 
          }));

          const mappedBase = applyMapping(baseDbData, protheusMapping.dre, 1, 'valorMensal');
          const mappedComp = applyMapping(compDbData, protheusMapping.dre, 1, 'valorMensal');

          setDreBase(mappedBase);
          setDreComp(mappedComp);
      } catch (e) {
          window.$alert("Erro ao gerar DRE: " + e.message);
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
              detailsB.forEach(d => { 
                  const key = d.conta + '_' + (d.descricao || '');
                  if (!allAccounts[key]) {
                      allAccounts[key] = { conta: d.conta, descricao: d.descricao, b: 0, c: 0 };
                  }
                  allAccounts[key].b += Math.abs(d.valor);
              });
              detailsC.forEach(d => { 
                  const key = d.conta + '_' + (d.descricao || '');
                  if (!allAccounts[key]) {
                      allAccounts[key] = { conta: d.conta, descricao: d.descricao, b: 0, c: 0 };
                  }
                  allAccounts[key].c += Math.abs(d.valor);
              });

              return Object.keys(allAccounts).map(key => {
                  const item = allAccounts[key];
                  const b = item.b;
                  const c = item.c;
                  const desc = item.descricao;
                  const conta = item.conta;
                  if (b === 0 && c === 0) return null;
                  
                  const vRs = b - c;
                  const vPct = c !== 0 ? (vRs / Math.abs(c)) * 100 : 0;
                  
                  return (
                      <tr key={acc + key} style={{ background: 'transparent', fontSize: '0.85rem' }}>
                          <td style={{ paddingLeft: '3rem', color: '#999' }}>
                              {conta.startsWith('9.9.9.9') ? desc : `${conta} - ${desc}`}
                          </td>
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
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #333', paddingBottom: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button className={activeTab === 'dre' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('dre')}>📊 DRE por Projeto</button>
        {canConfig && (
            <button className={activeTab === 'config' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('config')}>⚙️ Configuração Projetos</button>
        )}
        {canConfig && (
            <button className={activeTab === 'rateio' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('rateio')}>📐 Regras de Rateio</button>
        )}
        {canAccessDB && (
            <button className={activeTab === 'import' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('import')}>💾 Banco de Dados / Importação</button>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                      <h3 style={{ color: 'var(--color-primary)', margin: '0 0 0.5rem 0' }}>📐 Regras de Rateio de Centro de Custo</h3>
                      <p style={{ color: '#aaa', margin: 0, fontSize: '0.9rem' }}>
                          Configure como os <b>Projetos de Apoio / Indiretos</b> (Ex: <i>Rateio ADM, Oficina Geral, Logística</i>) distribuem suas despesas para os <b>Projetos Principais</b> na DRE.
                      </p>
                  </div>
              </div>

              {/* BARRA DE ADIÇÃO DE NOVO PROJETO DE RATEIO */}
              <div style={{ background: 'rgba(33, 150, 243, 0.08)', border: '1px solid rgba(33, 150, 243, 0.3)', padding: '1.2rem', borderRadius: '10px', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                      <label style={{ display: 'block', color: '#64B5F6', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>
                          + Adicionar Projeto como Origem de Rateio:
                      </label>
                      <select 
                          value={selectedNewRateioSource} 
                          onChange={e => setSelectedNewRateioSource(e.target.value)} 
                          className="select-input" 
                          style={{ width: '100%' }}
                      >
                          <option value="">Selecione um projeto de apoio/rateio...</option>
                          {Object.keys(projects)
                              .filter(p => !rateioList.some(r => r.source === p))
                              .map(p => (
                                  <option key={p} value={p}>
                                      {p} ({(projects[p] || []).length} CCs vinculados)
                                  </option>
                              ))
                          }
                      </select>
                  </div>
                  <button 
                      className="btn-primary" 
                      onClick={() => handleAddRateioProject(selectedNewRateioSource)} 
                      disabled={!selectedNewRateioSource}
                      style={{ padding: '0.6rem 1.4rem', fontSize: '0.9rem', marginTop: '1.2rem' }}
                  >
                      + Cadastrar Regra de Rateio
                  </button>
              </div>

              {/* LISTA DE PROJETOS DE RATEIO CADASTRADOS */}
              {rateioList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px dashed #444', color: '#888' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📐</div>
                      <strong>Nenhum projeto de rateio cadastrado ainda.</strong>
                      <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>
                          Selecione um projeto no campo acima para definir como suas despesas serão absorvidas pelos projetos produtivos.
                      </p>
                  </div>
              ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {rateioList.map(item => {
                          const sourceCCs = projects[item.source] || [];
                          const targetProjs = Object.keys(projects).filter(p => p !== item.source);
                          const isFixed = item.rule === 'fixa';
                          
                          // Soma dos percentuais fixos
                          const fixedSum = Object.keys(item.fixedPct || {}).reduce((acc, p) => acc + (parseFloat(item.fixedPct[p]) || 0), 0);
                          const isSumOk = Math.abs(fixedSum - 100) < 0.01;

                          return (
                              <div key={item.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid #333', padding: '1.5rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.8rem', flexWrap: 'wrap', gap: '1rem' }}>
                                      <div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                              <span style={{ fontSize: '1.3rem' }}>🏢</span>
                                              <h4 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.15rem' }}>
                                                  Origem: <strong>{item.source}</strong>
                                              </h4>
                                          </div>
                                          <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                                              Centros de Custo vinculados: <b style={{ color: '#ccc' }}>{sourceCCs.join(', ') || 'Nenhum CC'}</b>
                                          </div>
                                      </div>

                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                          <button 
                                              onClick={() => handleRemoveRateioProject(item.id)}
                                              style={{ background: 'rgba(244,67,54,0.15)', border: '1px solid #F44336', color: '#FF8A80', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                                          >
                                              🗑️ Excluir Regra
                                          </button>
                                      </div>
                                  </div>

                                  {/* SELETOR DA REGRA */}
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                      <div>
                                          <label style={{ display: 'block', color: '#aaa', fontSize: '0.85rem', marginBottom: '6px' }}>
                                              Método de Distribuição:
                                          </label>
                                          <select 
                                              value={item.rule} 
                                              onChange={e => handleUpdateRateioRule(item.id, 'rule', e.target.value)} 
                                              className="select-input" 
                                              style={{ width: '100%', fontWeight: 'bold' }}
                                          >
                                              <option value="proporcional">📈 Automática (Proporcional à Receita dos Projetos de Destino)</option>
                                              <option value="fixa">🎯 Manual (Porcentagem Fixa % Definida por Projeto)</option>
                                          </select>
                                      </div>
                                  </div>

                                  {/* REGRA FIXA */}
                                  {isFixed && (
                                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.2rem', borderRadius: '8px', border: '1px solid #444' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                  <span style={{ fontSize: '0.9rem', color: '#FF9800', fontWeight: 'bold' }}>Percentual Fixo por Projeto de Destino:</span>
                                                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isSumOk ? '#4CAF50' : '#FF9800' }}>
                                                      {isSumOk ? '✓ Soma: 100%' : `⚠️ Soma Atual: ${fixedSum.toFixed(2)}% (deve ser 100%)`}
                                                  </span>
                                              </div>
                                              <button 
                                                  onClick={() => handleDistributeEvenly(item.id)}
                                                  className="btn-secondary" 
                                                  style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', color: '#64B5F6', borderColor: '#2196F3' }}
                                              >
                                                  ⚖️ Dividir Igualmente
                                              </button>
                                          </div>

                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                                              {targetProjs.map(p => (
                                                  <div key={p} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', border: '1px solid #444' }}>
                                                      <label style={{ display: 'block', color: '#fff', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '6px' }}>
                                                          {p}
                                                      </label>
                                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                          <input 
                                                              type="number" 
                                                              step="0.01"
                                                              min="0"
                                                              max="100"
                                                              value={item.fixedPct?.[p] ?? ''} 
                                                              onChange={e => handleUpdateFixedPct(item.id, p, e.target.value)}
                                                              className="text-input" 
                                                              style={{ width: '100px', padding: '0.3rem', textAlign: 'center', fontWeight: 'bold' }}
                                                          />
                                                          <span style={{ color: '#aaa', fontWeight: 'bold' }}>%</span>
                                                      </div>
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                  )}

                                  {/* REGRA PROPORCIONAL */}
                                  {!isFixed && (
                                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.2rem', borderRadius: '8px', border: '1px solid #444' }}>
                                          <label style={{ display: 'block', color: '#64B5F6', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '8px' }}>
                                              Projetos de Destino que Participam do Rateio Proporcional:
                                          </label>
                                          <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '1rem' }}>
                                              A despesa deste projeto será fatiada automaticamente entre os projetos selecionados abaixo de acordo com a receita gerada por cada um no período da DRE.
                                          </p>
                                          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                              {targetProjs.map(p => {
                                                  const isSelected = (item.targetProjects || targetProjs).includes(p);
                                                  return (
                                                      <label 
                                                          key={p} 
                                                          style={{ 
                                                              background: isSelected ? 'rgba(33, 150, 243, 0.15)' : 'rgba(255,255,255,0.03)', 
                                                              border: '1px solid ' + (isSelected ? '#2196F3' : '#444'), 
                                                              padding: '8px 14px', 
                                                              borderRadius: '6px', 
                                                              cursor: 'pointer',
                                                              display: 'flex',
                                                              alignItems: 'center',
                                                              gap: '8px',
                                                              color: isSelected ? '#fff' : '#888',
                                                              fontWeight: isSelected ? 'bold' : 'normal'
                                                          }}
                                                      >
                                                          <input 
                                                              type="checkbox" 
                                                              checked={isSelected} 
                                                              onChange={() => handleToggleTargetProject(item.id, p)} 
                                                          />
                                                          {p}
                                                      </label>
                                                  );
                                              })}
                                          </div>
                                      </div>
                                  )}
                              </div>
                          );
                      })}
                  </div>
              )}
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
