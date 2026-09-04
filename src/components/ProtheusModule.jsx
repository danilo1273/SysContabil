import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, UploadCloud, Plus, FileText, CheckCircle, AlertTriangle, Play, Database, FileSpreadsheet, Activity, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell } from 'recharts';
import { parseProtheusExcel } from '../utils/protheusParser';
import { protheusMapping, applyMapping } from '../utils/mappingConfig';
import { supabase } from "../supabaseClient";
import { saveBalanceteToDB, getDREFromDB, getBalancoFromDB, addManualEntryToDB, getSettings, saveSettings } from '../utils/db';
import TaxModule from './TaxModule';
import DashboardView from './DashboardView';
import FaturamentoModule from './FaturamentoModule';
import RateioModule from './RateioModule';
import CentroCustoModule from './CentroCustoModule';
import GestaoContabilModule from './GestaoContabilModule';
import PerdcompModule from './PerdcompModule';

const COLORS = ['#4CAF50', '#2196F3', '#f7c324', '#9C27B0', '#FF9800'];


function PendencyWidget({ companies, ano }) {
  const [statusMap, setStatusMap] = React.useState({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    Promise.all(companies.map(async c => {
      const { data } = await supabase.from("dre_history").select("id, mes").eq("empresaId", c.id).eq("ano", ano).lte("mes", 12);
      let lastImport = 0;
      let lastTax = 0;
      if (Array.isArray(data)) {
        data.forEach(r => {
          if (r.id && r.id.startsWith("tax-dre-irpj")) {
            if (r.mes > lastTax) lastTax = r.mes;
          } else {
            if (r.mes > lastImport) lastImport = r.mes;
          }
        });
      }
      
      let isUnbalanced = false;
      let diffValue = 0;

      if (lastImport > 0) {
         const bData = await getBalancoFromDB(c.id, ano, lastImport);
         const dData = await getDREFromDB(c.id, ano, lastImport, 'acumulado');
         
         let ativo = 0, passivo = 0, pl = 0, lucro = 0;
         Object.keys(bData).forEach(conta => {
            if (conta.startsWith("1")) ativo += (bData[conta].valor || 0);
            else if (conta.startsWith("2.3") || conta.startsWith("2.4")) pl += (bData[conta].valor || 0);
            else if (conta.startsWith("2")) passivo += (bData[conta].valor || 0);
         });
         Object.keys(dData).forEach(conta => {
            lucro += (dData[conta].valor || 0);
         });
         
         diffValue = ativo - (passivo + pl + lucro);
         if (Math.abs(diffValue) > 2) {
             isUnbalanced = true;
         }
      }

      return { id: c.id, lastImport, lastTax, isUnbalanced, diffValue };
    })).then(results => {
      const map = {};
      results.forEach(r => map[r.id] = r);
      setStatusMap(map);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [companies, ano]);

  if (loading) return <div style={{color:"#888", marginBottom: "1rem"}}>Carregando pendências...</div>;

  return (
    <div className="print-hide widget-pendencia" style={{ marginBottom: "2rem", background: "linear-gradient(135deg, #1e1e1e 0%, #1a233a 100%)", padding: "1.5rem", borderRadius: "12px", border: "1px solid #333" }}>
      <h3 style={{ margin: "0 0 1rem 0", color: "#64B5F6", display: "flex", alignItems: "center", gap: "8px" }}>
        <span>📊 Status de Apuração - {ano}</span>
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        {companies.map(c => {
          const st = statusMap[c.id];
          if (!st) return null;
          const pendente = st.lastImport > st.lastTax;
          
          return (
            <div key={c.id} style={{ background: st.lastImport === 0 ? "rgba(255,255,255,0.05)" : pendente ? "rgba(255,202,40,0.1)" : "rgba(76,175,80,0.1)", padding: "1rem", borderRadius: "8px", border: "1px solid " + (st.lastImport === 0 ? "#444" : pendente ? "#FFCA28" : "#4CAF50") }}>
              <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>{c.name}</div>
              <div style={{ fontSize: "0.85rem", color: "#ccc", display: "flex", justifyContent: "space-between" }}>
                <span>Base Integrada:</span> <strong style={{color:"#fff"}}>{st.lastImport === 0 ? "-" : "Mês " + st.lastImport.toString().padStart(2, "0")}</strong>
              </div>
              <div style={{ fontSize: "0.85rem", color: "#ccc", display: "flex", justifyContent: "space-between" }}>
                <span>IRPJ Apurado:</span> <strong style={{color:"#fff"}}>{st.lastTax === 0 ? "-" : "Mês " + st.lastTax.toString().padStart(2, "0")}</strong>
              </div>
              <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", textAlign: "center", fontWeight: "bold", color: st.lastImport === 0 ? "#888" : pendente ? "#FFCA28" : "#4CAF50", padding: "4px", background: st.lastImport === 0 ? "transparent" : pendente ? "rgba(255,202,40,0.1)" : "rgba(76,175,80,0.1)", borderRadius: "4px" }}>
                {st.lastImport === 0 ? "SEM DADOS" : pendente ? "FALTA APURAR!" : "EM DIA"}
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProtheusModule({ userRole, userPermissions, username, moduleMode, onBackToModules }) {
  const [activeTab, setActiveTab] = useState(moduleMode === 'contabil' ? 'apuracao' : 'resultados');

  useEffect(() => {
    if (moduleMode === 'indicadores') {
      if (activeTab !== 'resultados' && activeTab !== 'cc') {
        setActiveTab('resultados');
      }
    } else if (moduleMode === 'contabil') {
      if (activeTab !== 'apuracao' && activeTab !== 'rateio' && activeTab !== 'gestao' && activeTab !== 'db') {
        setActiveTab('apuracao');
      }
    }
  }, [moduleMode]);
  const [secondaryTab, setSecondaryTab] = useState('dash');
  const [dbTabRecords, setDbTabRecords] = useState([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('consolidado');
  const [latestAvailable, setLatestAvailable] = useState(null);
  const [dbFilterCompany, setDbFilterCompany] = useState('');
  const [dbSearchText, setDbSearchText] = useState('');

  const [isDREDetalhada, setIsDREDetalhada] = useState(true);
  const [isBalancoDetalhado, setIsBalancoDetalhado] = useState(false);
  const [hideZeros, setHideZeros] = useState(false);
  const [customMappings, setCustomMappings] = useState({});
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [mappingTarget, setMappingTarget] = useState(null);
  
  const [manualEmpresa, setManualEmpresa] = useState('');
  const [manualConta, setManualConta] = useState('');
  const [manualDescricao, setManualDescricao] = useState('');
  const [manualValor, setManualValor] = useState('');
  const [igReceita, setIgReceita] = useState('');
  const [igCusto, setIgCusto] = useState('');
  const [igClientes, setIgClientes] = useState('');
  const [igFornecedores, setIgFornecedores] = useState('');
  const fileInputRef = useRef(null);

  const [period, setPeriod] = useState('mensal');
  const [selectedMes, setSelectedMes] = useState(new Date().getMonth() + 1);
  const [selectedTrimestre, setSelectedTrimestre] = useState(Math.floor(new Date().getMonth() / 3) + 1);
  const [selectedAno, setSelectedAno] = useState(new Date().getFullYear());

  const mergedMapping = useMemo(() => {
    const merged = JSON.parse(JSON.stringify(protheusMapping));
    if (!customMappings) return merged;
    
    Object.keys(customMappings).forEach(report => {
      if (!merged[report]) merged[report] = {};
      Object.keys(customMappings[report]).forEach(group => {
        if (!merged[report][group]) merged[report][group] = {};
        Object.keys(customMappings[report][group]).forEach(subgroup => {
          if (!merged[report][group][subgroup]) merged[report][group][subgroup] = [];
          merged[report][group][subgroup].push(...customMappings[report][group][subgroup]);
        });
      });
    });
    return merged;
  }, [customMappings]);

  useEffect(() => {
    // Busca no BD qual o último mês disponível no render inicial
    const initPanel = async () => {
      try {
        const dbMod = await import('../utils/db');
        const records = await dbMod.checkAvailableMonths();
        if (records && records.length > 0) {
          // Achar o registro com o maior ano
          const maxAno = Math.max(...records.map(r => r.ano));
          const recordsMaxAno = records.filter(r => r.ano === maxAno);
          const maxMes = Math.max(...recordsMaxAno.map(r => r.mes));
          const maxTrimestre = Math.floor((maxMes - 1) / 3) + 1;
          
          setSelectedAno(maxAno);
          setSelectedMes(maxMes);
          setSelectedTrimestre(maxTrimestre);
          setLatestAvailable(`${maxMes.toString().padStart(2, '0')}/${maxAno}`);
          
          try {
            const { data: _cmData } = await supabase.from("settings").select("value").eq("key", "customMapping").single();
          if (_cmData && _cmData.value) {
              try { setCustomMappings(JSON.parse(_cmData.value)); } catch(e){}
          }
        } catch (e) {
            console.error('Erro ao carregar customMappings', e);
          }
          
          loadPanelData(maxAno, maxMes);
        } else {
          loadPanelData();
        }
      } catch (e) {
        console.error("Erro init panel", e);
      }
    };
    initPanel();
  }, []);

  useEffect(() => {
    if (results) {
      loadPanelData(selectedAno, selectedMes);
    }
  }, [isDREDetalhada, isBalancoDetalhado]);

  const defaultCompanies = [
    { id: 'equipamentos', name: 'AGF Equipamentos' },
    { id: 'rompedores', name: 'AGF Rompedores' },
    { id: 'casa', name: 'Casa da Escavadeira' },
  ];

  const [companies, setCompanies] = useState(defaultCompanies);
  const [newCompanyName, setNewCompanyName] = useState('');
  
  useEffect(() => {
    getSettings('agf_companies').then(res => {
        if (res) setCompanies(res);
    }).catch(e => console.error(e));

    const handleNav = (e) => {
        const route = e.detail;
        window.__agf_pending_route = route;
        if (route && route.startsWith('gestao')) {
            setActiveTab('gestao');
        }
    };
    window.addEventListener('agf_navigate', handleNav);
    return () => window.removeEventListener('agf_navigate', handleNav);
  }, []);
  const [files, setFiles] = useState({});

  // States for manual entry
  const [expandedRows, setExpandedRows] = useState({});
  const fileInputRefs = useRef({});

  const toggleRow = (rowId) => {
    setExpandedRows(prev => ({ ...prev, [rowId]: !prev[rowId] }));
  };

  const handleSaveIntraGrupo = async () => {
    try {
      let count = 0;
      if (igReceita && parseFloat(igReceita) !== 0) {
        await addManualEntryToDB('exclusoes', selectedAno, selectedMes, '3.1.1.1.01.00001.EXC', 'Exclusão Intra-Grupo (Receita)', -Math.abs(parseFloat(igReceita)));
        count++;
      }
      if (igCusto && parseFloat(igCusto) !== 0) {
        await addManualEntryToDB('exclusoes', selectedAno, selectedMes, '4.1.1.1.13.EXC', 'Exclusão Intra-Grupo (Custo)', Math.abs(parseFloat(igCusto)));
        count++;
      }
      if (igClientes && parseFloat(igClientes) !== 0) {
        await addManualEntryToDB('exclusoes', selectedAno, selectedMes, '1.1.1.3.01.EXC', 'Exclusão Intra-Grupo (Clientes)', -Math.abs(parseFloat(igClientes)));
        count++;
      }
      if (igFornecedores && parseFloat(igFornecedores) !== 0) {
        await addManualEntryToDB('exclusoes', selectedAno, selectedMes, '2.1.1.1.01.EXC', 'Exclusão Intra-Grupo (Fornecedores)', -Math.abs(parseFloat(igFornecedores)));
        count++;
      }
      if (count > 0) {
        window.$alert(count + ' operações de exclusão intra-grupo inseridas com sucesso!');
        setIgReceita(''); setIgCusto(''); setIgClientes(''); setIgFornecedores('');
        loadDbRecords();
      } else {
        window.$alert('Preencha ao menos um valor de exclusão.');
      }
    } catch (err) {
      window.$alert('Erro: ' + err.message);
    }
  };

  const handleAddManualEntry = async () => {
    if (!manualEmpresa || !manualConta || !manualValor) return window.$alert('Preencha os campos obrigatórios');
    try {
      await addManualEntryToDB(manualEmpresa, selectedAno, selectedMes, manualConta, manualDescricao || manualConta, parseFloat(manualValor));
      window.$toast('Lançamento inserido com sucesso!', { type: 'success' });
      setManualConta(''); setManualDescricao(''); setManualValor('');
      loadDbRecords();
    } catch (err) {
      window.$alert('Erro: ' + err.message);
    }
  };

  const handleFileChange = (compId, e) => {
    console.log('handleFileChange called for', compId, e.target.files);
    if (e.target.files && e.target.files.length > 0) {
      const f = e.target.files[0];
      console.log('File selected:', f.name, 'for company:', compId);
      setFiles(prev => ({
        ...prev,
        [compId]: f
      }));

    }
  };

  const handleAddCompany = () => {
    const trimmed = newCompanyName.trim();
    if (!trimmed) return;
    const newId = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/__+/g, '_').replace(/^_|_$/g, '');
    if (companies.find(c => c.id === newId)) {
      window.$alert('Já existe uma empresa com esse ID. Use um nome diferente.');
      return;
    }
    const updated = [...companies, { id: newId, name: trimmed }];
    setCompanies(updated);
    saveSettings('agf_companies', updated);
    setNewCompanyName('');
  };

  const handleImportHistory = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const dbSheet = workbook.Sheets['DB'];
        if (dbSheet) {
          const rows = XLSX.utils.sheet_to_json(dbSheet, { header: 1 });
          
          if (rows.length < 5) {
             throw new Error('Aba DB não possui dados suficientes.');
          }

          const headerRow = rows[3];
          const dateCols = [];
          for (let i = 2; i < headerRow.length; i++) {
            const val = headerRow[i];
            if (typeof val === 'number' && val > 40000) {
               const date = new Date((val - 25569) * 86400 * 1000);
               dateCols.push({ colIndex: i, ano: date.getUTCFullYear(), mes: date.getUTCMonth() + 1 });
            }
          }
          
          const allAccounts = [];
          for (let i = 4; i < rows.length; i++) {
            if (rows[i][0]) allAccounts.push(String(rows[i][0]).trim());
          }
          
          // Identify analytical accounts
          const isAnaliticaMap = {};
          for (let i = 0; i < allAccounts.length; i++) {
            const parent = allAccounts[i];
            let isAnalitica = true;
            for (let j = 0; j < allAccounts.length; j++) {
              if (i !== j && allAccounts[j].startsWith(parent + '.')) {
                isAnalitica = false;
                break;
              }
            }
            isAnaliticaMap[parent] = isAnalitica;
          }

          const dreEntries = [];
          const balancoEntries = [];
          
          for (let i = 4; i < rows.length; i++) {
             const row = rows[i];
             const rawConta = row[0];
             if (!rawConta) continue;
             
             const conta = String(rawConta).trim();
             const descricao = String(row[1] || '').trim();
             
             if (!isAnaliticaMap[conta]) continue;
             
             for (const dc of dateCols) {
                let rawVal = row[dc.colIndex];
                if (typeof rawVal === 'string') {
                   // Remove dots for thousands and replace comma with dot for decimals
                   rawVal = parseFloat(rawVal.replace(/\./g, '').replace(',', '.'));
                }
                if (typeof rawVal !== 'number' || isNaN(rawVal)) continue;
                
                const id = `equipamentos-${dc.ano}-${dc.mes}-${conta}-hist`;
                
                if (conta.startsWith('1.') || conta.startsWith('2.')) {
                   balancoEntries.push({
                     id,
                     empresaId: 'equipamentos',
                     ano: dc.ano,
                     mes: dc.mes,
                     trimestre: Math.ceil(dc.mes / 3),
                     tipo: conta.startsWith('1.') ? 'ativo' : 'passivo',
                     conta,
                     descricao,
                     saldoAcumulado: rawVal
                   });
                } else if (conta.startsWith('3.') || conta.startsWith('4.') || conta.startsWith('5.') || conta.startsWith('6.')) {
                   dreEntries.push({
                     id,
                     empresaId: 'equipamentos',
                     ano: dc.ano,
                     mes: dc.mes,
                     trimestre: Math.ceil(dc.mes / 3),
                     conta,
                     descricao,
                     valorMensal: rawVal * -1 // Inverte pq DRE no BD do cliente é positivo e meu padrão é negativo
                   });
                }
             }
          }

          const dbMod = await import('../utils/db');
          await dbMod.deleteRecords('equipamentos', null, null);
          
          if (dreEntries.length > 0) await dbMod.bulkPutRecords('dre_history', dreEntries);
          if (balancoEntries.length > 0) await dbMod.bulkPutRecords('balanco_history', balancoEntries);
          
          const municFound = balancoEntries.some(e => e.conta.includes('MUNIC'));
          
          window.$toast(`Histórico importado com sucesso da aba DB!\n${dreEntries.length} registros de DRE.\n${balancoEntries.length} registros de Balanço.\n\nCONTA MUNIC ENCONTRADA E IMPORTADA? ${municFound ? 'SIM!' : 'NÃO (Ela não estava na aba DB do arquivo ou estava sem valor válido).'}`, { type: 'success' });
        } else {
          window.$alert('Aba DB não encontrada na planilha.');
        }
      } catch (err) {
        console.error(err);
        window.$alert('Erro ao importar histórico: ' + err.message);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const hasAnyFile = Object.keys(files).length > 0;

  
  
  const startEditing = (record) => {
    setEditingId(record.id);
    setEditingValue(record.valorMensal !== undefined ? record.valorMensal : record.saldoAcumulado);
  };

  const saveEdit = async (record) => {
    try {
      const dbMod = await import('../utils/db');
      const val = parseFloat(editingValue);
      if (isNaN(val)) throw new Error('Valor inválido');
      
      await dbMod.updateRecord(record.id, record.tipo ? 'balanco' : 'dre', val);
      setEditingId(null);
      loadDbRecords();
    } catch (e) {
      window.$alert('Erro ao atualizar: ' + e.message);
    }
  };

  const loadDbRecords = async () => {
    setLoadingDb(true);
    try {
      const dbMod = await import('../utils/db');
      const data = await dbMod.getRawRecords(selectedAno, selectedMes);
      
      const dreRecs = data.dre || [];
      const balancoRecs = data.balanco || [];
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

  useEffect(() => {
    if (results) {
      loadPanelData(selectedAno, selectedMes);
    }
  }, [isDREDetalhada]);

  const handleDeleteMonth = async () => {
    const mesNome = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][selectedMes-1];
    const empresa = dbFilterCompany ? companies.find(c => c.id === dbFilterCompany)?.name : 'TODAS AS EMPRESAS';
    if (!await window.$confirm(`⚠️ Confirma exclusão de todos os registros de ${mesNome}/${selectedAno} para ${empresa}?`)) return;
    try {
      const dbMod = await import('../utils/db');
      if (dbFilterCompany !== 'todas') {
        await dbMod.deleteRecords(dbFilterCompany, selectedAno, selectedMes);
      } else {
        await dbMod.deleteRecords(null, selectedAno, selectedMes);
      }
      window.$toast('Registros excluídos com sucesso!', { type: 'success' });
      loadDbRecords();
    } catch (e) {
      window.$alert('Erro ao excluir: ' + e.message);
    }
  };

  const handleSaveToDB = async () => {
    setIsProcessing(true);
    try {
      for (const comp of companies) {
        if (files[comp.id]) {
          console.log(`[SAVE] Parsing file for company: ${comp.id}`, files[comp.id].name);
          const rawAccounts = await parseProtheusExcel(files[comp.id]);
          const keys = Object.keys(rawAccounts);
          console.log(`[SAVE] Parsed ${keys.length} accounts for ${comp.id}. First 5:`, keys.slice(0, 5));
          const analiticas = keys.filter(k => rawAccounts[k].isAnalitica);
          console.log(`[SAVE] Analíticas: ${analiticas.length}. Sample:`, analiticas.slice(0, 3).map(k => ({ conta: k, mensal: rawAccounts[k].mensal })));
          await saveBalanceteToDB(rawAccounts, comp.id, selectedAno, selectedMes);
          console.log(`[SAVE] Saved to DB for ${comp.id} - ano:${selectedAno} mes:${selectedMes}`);
        }
      }
      window.$toast('Arquivos salvos no banco de dados com sucesso!', { type: 'success' });
      setFiles({});
      loadDbRecords();
      setLatestAvailable(`${selectedMes.toString().padStart(2, '0')}/${selectedAno}`);
    } catch (err) {
      console.error(err);
      window.$alert('Erro ao gravar balancetes: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const loadPanelData = async (anoParam, mesParam, periodParam) => {
    const pAno = anoParam !== undefined ? anoParam : selectedAno;
    const pMes = mesParam !== undefined ? mesParam : selectedMes;
    const pPeriod = periodParam !== undefined ? periodParam : period;

    setIsProcessing(true);
    try {
      const consolidated = {
        dre: {}, ativo: {}, passivo: {}, 
        dfcLucroAjuste: {}, dfcAtivo: {}, dfcPassivo: {}, dfcInvestimento: {}, dfcFinanciamento: {}, dfcCaixa: {},
        dfcCaixaInicial: {}, dfcCaixaFinal: {}, balancoVariation: {},
        companies: []
      };

      const unmappedAccounts = [];
      const checkUnmapped = (dbData, groupMapping, tipo, compId) => {
        const prefixes = [];
        for (const group of Object.values(groupMapping)) {
          for (const prefs of Object.values(group)) prefixes.push(...prefs);
        }
        const dbDataArray = Array.isArray(dbData) ? dbData : Object.entries(dbData || {}).map(([conta, data]) => ({ conta, ...data }));
        dbDataArray.forEach(d => {
          if ((tipo === 'ativo' && d.conta.startsWith('1')) || (tipo === 'passivo' && d.conta.startsWith('2'))) {
             if (!prefixes.some(p => d.conta.startsWith(p)) && Math.abs(d.saldoAcumulado || d.valor || 0) > 0.01) {
               if (d.conta !== '2.9.9.1.01.00900' && !d.conta.startsWith('2.1.1.6')) {
                 unmappedAccounts.push({ ...d, tipo, compId });
               }
             }
          }
        });
      };

      for (const comp of companies) {
        const dreDbData = await getDREFromDB(comp.id, pAno, pMes, pPeriod);
        const balancoDbData = await getBalancoFromDB(comp.id, pAno, pMes);
        
        checkUnmapped(balancoDbData, mergedMapping.ativo, 'ativo', comp.id);
        checkUnmapped(balancoDbData, mergedMapping.passivo, 'passivo', comp.id);

        const dreMapped = applyMapping(dreDbData, mergedMapping.dre, 1, 'valor');
        const ativoMapped = applyMapping(balancoDbData, mergedMapping.ativo, 1, 'valor');
        const passivoMapped = applyMapping(balancoDbData, mergedMapping.passivo, 1, 'valor');

        // --- DFC Logic ---
        let prevAno = pAno;
        let prevMes = pMes - 1;
        if (pPeriod === 'acumulado') {
           prevAno = pAno - 1;
           prevMes = 12;
        } else if (pPeriod === 'trimestre') {
           prevMes = pMes - 3;
           if (prevMes <= 0) { prevMes = 12; prevAno = pAno - 1; }
        } else {
           if (prevMes <= 0) { prevMes = 12; prevAno = pAno - 1; }
        }
        
        const prevBalancoDbData = await getBalancoFromDB(comp.id, prevAno, prevMes);
        
        const computeVariation = (curr, prev) => {
           const variation = {};
           const allKeys = new Set([...Object.keys(curr || {}), ...Object.keys(prev || {})]);
           for (const k of allKeys) {
              const cVal = curr[k] ? curr[k].valor : 0;
              const pVal = prev[k] ? prev[k].valor : 0;
              variation[k] = { valor: cVal - pVal, descricao: (curr[k] || prev[k]).descricao };
           }
           return variation;
        };
        const balancoVariation = computeVariation(balancoDbData, prevBalancoDbData);

        // Map DFC Variations
        const dreAjustes = applyMapping(dreDbData, mergedMapping.dfc_lucro_ajuste_dre, -1, 'valor');
        const ativoAjustes = applyMapping(balancoVariation, mergedMapping.dfc_lucro_ajuste_ativo, -1, 'valor');
        const passivoAjustes = applyMapping(balancoVariation, mergedMapping.dfc_lucro_ajuste_passivo, 1, 'valor');
        
        consolidated.dfcLucroAjuste[comp.id] = {
           'Ajustes': {
              ...(dreAjustes['Ajustes DRE'] || {}),
              ...(ativoAjustes['Ajustes Ativo'] || {}),
              ...(passivoAjustes['Ajustes Passivo'] || {})
           }
        };
        // Re-calculate group TOTAL for Ajustes
        let totalAj = 0;
        for (const [k, v] of Object.entries(consolidated.dfcLucroAjuste[comp.id]['Ajustes'])) {
           if (k !== 'TOTAL') totalAj += (v.valor || v.total || 0);
        }
        consolidated.dfcLucroAjuste[comp.id]['Ajustes']['TOTAL'] = { total: totalAj };

        consolidated.dfcAtivo[comp.id] = applyMapping(balancoVariation, mergedMapping.dfc_ativo, -1, 'valor');
        consolidated.dfcInvestimento[comp.id] = applyMapping(balancoVariation, mergedMapping.dfc_investimento, -1, 'valor');
        consolidated.dfcPassivo[comp.id] = applyMapping(balancoVariation, mergedMapping.dfc_passivo, 1, 'valor');
        consolidated.dfcFinanciamento[comp.id] = applyMapping(balancoVariation, mergedMapping.dfc_financiamento, 1, 'valor');
        consolidated.dfcCaixa[comp.id] = applyMapping(balancoVariation, mergedMapping.dfc_caixa, 1, 'valor');
        consolidated.dfcCaixaInicial[comp.id] = applyMapping(prevBalancoDbData, mergedMapping.dfc_caixa, 1, 'valor');
        consolidated.dfcCaixaFinal[comp.id] = applyMapping(balancoDbData, mergedMapping.dfc_caixa, 1, 'valor');
        consolidated.balancoVariation[comp.id] = balancoVariation;

        consolidated.dre[comp.id] = dreMapped;
        consolidated.ativo[comp.id] = ativoMapped;
        consolidated.passivo[comp.id] = passivoMapped;
        consolidated.companies.push(comp);
      }

      // 4.5. Injetar Exclusões
      const excDreDb = await getDREFromDB('exclusoes', pAno, pMes, pPeriod);
      const excBalDb = await getBalancoFromDB('exclusoes', pAno, pMes);
      
      checkUnmapped(excBalDb, mergedMapping.ativo, 'ativo', 'exclusoes');
      checkUnmapped(excBalDb, mergedMapping.passivo, 'passivo', 'exclusoes');
      
      consolidated.dre['exclusoes'] = applyMapping(excDreDb, mergedMapping.dre, 1, 'valor');
      consolidated.ativo['exclusoes'] = applyMapping(excBalDb, mergedMapping.ativo, 1, 'valor');
      consolidated.passivo['exclusoes'] = applyMapping(excBalDb, mergedMapping.passivo, 1, 'valor');
      
      let prevAnoExc = pAno;
      let prevMesExc = pMes - 1;
      if (pPeriod === 'acumulado') { prevAnoExc = pAno - 1; prevMesExc = 12; } 
      else if (pPeriod === 'trimestre') { prevMesExc = pMes - 3; if (prevMesExc <= 0) { prevMesExc = 12; prevAnoExc = pAno - 1; } } 
      else { if (prevMesExc <= 0) { prevMesExc = 12; prevAnoExc = pAno - 1; } }
      const prevBalExcDb = await getBalancoFromDB('exclusoes', prevAnoExc, prevMesExc);
      const varExc = {};
      const allExcKeys = new Set([...Object.keys(excBalDb || {}), ...Object.keys(prevBalExcDb || {})]);
      for (const k of allExcKeys) {
         const cVal = excBalDb[k] ? excBalDb[k].valor : 0;
         const pVal = prevBalExcDb[k] ? prevBalExcDb[k].valor : 0;
         varExc[k] = { valor: cVal - pVal, descricao: (excBalDb[k] || prevBalExcDb[k]).descricao };
      }
      
      const dreAjustesExc = applyMapping(excDreDb, mergedMapping.dfc_lucro_ajuste_dre, -1, 'valor');
      const ativoAjustesExc = applyMapping(varExc, mergedMapping.dfc_lucro_ajuste_ativo, -1, 'valor');
      const passivoAjustesExc = applyMapping(varExc, mergedMapping.dfc_lucro_ajuste_passivo, 1, 'valor');
      
      consolidated.dfcLucroAjuste['exclusoes'] = {
         'Ajustes': {
            ...(dreAjustesExc['Ajustes DRE'] || {}),
            ...(ativoAjustesExc['Ajustes Ativo'] || {}),
            ...(passivoAjustesExc['Ajustes Passivo'] || {})
         }
      };
      let totalAjExc = 0;
      for (const [k, v] of Object.entries(consolidated.dfcLucroAjuste['exclusoes']['Ajustes'])) {
         if (k !== 'TOTAL') totalAjExc += (v.valor || v.total || 0);
      }
      consolidated.dfcLucroAjuste['exclusoes']['Ajustes']['TOTAL'] = { total: totalAjExc };

      consolidated.dfcAtivo['exclusoes'] = applyMapping(varExc, mergedMapping.dfc_ativo, -1, 'valor');
      consolidated.dfcInvestimento['exclusoes'] = applyMapping(varExc, mergedMapping.dfc_investimento, -1, 'valor');
      consolidated.dfcPassivo['exclusoes'] = applyMapping(varExc, mergedMapping.dfc_passivo, 1, 'valor');
      consolidated.dfcFinanciamento['exclusoes'] = applyMapping(varExc, mergedMapping.dfc_financiamento, 1, 'valor');
      consolidated.dfcCaixa['exclusoes'] = applyMapping(varExc, mergedMapping.dfc_caixa, 1, 'valor');
      consolidated.dfcCaixaInicial['exclusoes'] = applyMapping(prevBalExcDb, mergedMapping.dfc_caixa, 1, 'valor');
      consolidated.dfcCaixaFinal['exclusoes'] = applyMapping(excBalDb, mergedMapping.dfc_caixa, 1, 'valor');
      consolidated.balancoVariation['exclusoes'] = varExc;
      consolidated.companies.push({ id: 'exclusoes', name: 'Exclusões' });

      // 4.6 movido para depois do buildDRE para aproveitar o lucroLiq dinamicamente

      // 5. Estruturar os dados para a tabela
      const buildGenericTable = (mappedDataDict, mappingRef, tablePrefix, isDetailed = true, addGrandTotal = false, skipGroupHeader = false) => {
        const lines = [];
        if (!mappingRef) return lines;
        const groups = Object.keys(mappingRef);
        
        let globalIndex = 0;
        for (const group of groups) {
          const hasGroupInAnyComp = consolidated.companies.some(c => mappedDataDict[c.id] && mappedDataDict[c.id][group]);
          if (!hasGroupInAnyComp) continue;
          
          if (isDetailed && !skipGroupHeader) {
            lines.push({ id: `${tablePrefix}-g-${globalIndex++}`, conta: group, isTotal: true, isGroupHeader: true });
          }
          
          const allAccountsSet = new Set();
          for (const c of consolidated.companies) {
            if (mappedDataDict[c.id] && mappedDataDict[c.id][group]) {
              Object.keys(mappedDataDict[c.id][group]).forEach(k => {
                if (k !== 'TOTAL') allAccountsSet.add(k);
              });
            }
          }
          const accountsInGroup = Array.from(allAccountsSet).sort();
          
          let groupConsolidado = 0;
          
          for (const acc of accountsInGroup) {
            const rowId = `${tablePrefix}-a-${globalIndex++}`;
            const row = { id: rowId, conta: acc, isTotal: false, details: [] };
            let accConsolidado = 0;
            let allZeros = true;
            
            const detailMap = {};
            for (const c of consolidated.companies) {
               const cell = (mappedDataDict[c.id] && mappedDataDict[c.id][group]) ? mappedDataDict[c.id][group][acc] : null;
               const val = cell ? cell.total : 0;
               row[c.id] = val;
               accConsolidado += val;
               if (val !== 0) allZeros = false;
               
               if (cell && cell.details) {
                 cell.details.forEach(d => {
                   if (!detailMap[d.conta]) detailMap[d.conta] = { conta: d.conta, descricao: d.descricao };
                   detailMap[d.conta][c.id] = (detailMap[d.conta][c.id] || 0) + d.valor;
                 });
               }
            }
            row.consolidado = accConsolidado;
            
            Object.values(detailMap).forEach(d => {
              let dCons = 0;
              let dAllZeros = true;
              for (const c of consolidated.companies) {
                if (!d[c.id]) d[c.id] = 0;
                dCons += d[c.id];
                if (d[c.id] !== 0) dAllZeros = false;
              }
              d.consolidado = dCons;
              d.isZero = dAllZeros && dCons === 0;
              row.details.push(d);
            });
            
            row.isZero = allZeros && accConsolidado === 0;
            if (isDetailed) lines.push(row);
          }
          
          if (!skipGroupHeader) {
            const totalRow = { id: `${tablePrefix}-t-${globalIndex++}`, conta: isDetailed ? 'TOTAL ' + group : group, isTotal: true };
            for (const c of consolidated.companies) {
               const cell = (mappedDataDict[c.id] && mappedDataDict[c.id][group]) ? mappedDataDict[c.id][group]['TOTAL'] : null;
               const val = cell ? cell.total : 0;
               totalRow[c.id] = val;
               groupConsolidado += val;
            }
            totalRow.consolidado = groupConsolidado;
            lines.push(totalRow);
          }
        }
        
        if (addGrandTotal) {
          const grandTotalRow = { 
            id: `${tablePrefix}-grandtotal`, 
            conta: tablePrefix === 'ativo' ? 'TOTAL DO ATIVO' : 
                   tablePrefix === 'passivo' ? 'TOTAL PASSIVO E PATRIMÔNIO LÍQUIDO' : 
                   `TOTAL GERAL`, 
            isTotal: true, 
            isGrandTotal: true 
          };
          grandTotalRow.consolidado = 0;
          for (const c of consolidated.companies) grandTotalRow[c.id] = 0;

          for (const group of groups) {
            const hasGroupInAnyComp = consolidated.companies.some(c => mappedDataDict[c.id] && mappedDataDict[c.id][group]);
            if (!hasGroupInAnyComp) continue;
            let gConsolidado = 0;
            for (const c of consolidated.companies) {
               const cell = (mappedDataDict[c.id] && mappedDataDict[c.id][group]) ? mappedDataDict[c.id][group]['TOTAL'] : null;
               const val = cell ? cell.total : 0;
               grandTotalRow[c.id] += val;
               gConsolidado += val;
            }
            grandTotalRow.consolidado += gConsolidado;
          }
          lines.push(grandTotalRow);
        }
        
        return lines;
      };

      const buildDRE = () => {
         const lines = [];
         let globalIdx = 0;
         const getId = () => `dre-${globalIdx++}`;

         const initRow = (conta, isTotal = false, isSubtotal = false, isGroupHeader = false) => {
           const row = { id: getId(), conta, isTotal, isSubtotal, isGroupHeader, details: [], consolidado: 0 };
           consolidated.companies.forEach(c => row[c.id] = 0);
           return row;
         };

         // pushMode: 'always' (push children always), 'detailedOnly' (push children only if isDREDetalhada), 'never' (never push children, just sum)
         const addGroup = (groupName, isDeduct = false, subtotalRow = null, pushMode = 'always') => {
           const groupData = mergedMapping.dre[groupName];
           if (!groupData) return;
           
           if (!isDREDetalhada) {
             // Modo Simples
             for (const lineName of Object.keys(groupData)) {
               const row = initRow(lineName);
               let hasValue = false;
               for (const c of consolidated.companies) {
                 const cell = consolidated.dre[c.id]?.[groupName]?.[lineName];
                 const val = cell ? cell.total : 0;
                 row[c.id] = val;
                 row.consolidado += val;
                 if (val !== 0) hasValue = true;
               }
               if (hasValue || subtotalRow) {
                 if (pushMode === 'always') lines.push(row);
                 if (subtotalRow) {
                   consolidated.companies.forEach(c => subtotalRow[c.id] += row[c.id]);
                   subtotalRow.consolidado += row.consolidado;
                 }
               }
             }
           } else {
             // Modo Detalhado
             const gLines = buildGenericTable(consolidated.dre, { [groupName]: groupData }, `dre-${groupName}`);
             if (pushMode === 'always' || pushMode === 'detailedOnly') lines.push(...gLines);
             const gTotal = gLines.find(l => l.conta === 'TOTAL ' + groupName);
             if (gTotal && subtotalRow) {
               consolidated.companies.forEach(c => subtotalRow[c.id] += gTotal[c.id] || 0);
               subtotalRow.consolidado += gTotal.consolidado || 0;
             }
           }
         };

         const sumRows = (dest, rowsToAdd) => {
           consolidated.companies.forEach(c => {
             dest[c.id] = rowsToAdd.reduce((sum, r) => sum + (r[c.id] || 0), 0);
           });
           dest.consolidado = rowsToAdd.reduce((sum, r) => sum + (r.consolidado || 0), 0);
         };

         // 1. Receita Bruta
         let recBruta = initRow('RECEITA OPERACIONAL BRUTA', true, true);
         addGroup('RECEITA OPERACIONAL BRUTA', false, recBruta, 'always');
         lines.push(recBruta);

         // 2. Deduções
         let recLiq = initRow('RECEITA OPERACIONAL LÍQUIDA', true, true);
         let deducoes = initRow('(-) Impostos s/ Vendas e Devoluções', false, false); // Single line in Simple
         addGroup('DEDUÇÕES DA RECEITA', true, deducoes, 'detailedOnly');
         if (!isDREDetalhada) lines.push(deducoes);
         
         sumRows(recLiq, [recBruta, deducoes]);
         lines.push(recLiq);

         // 3. Custos
         let custos = initRow('Custo dos Produtos / Merc. Vendidos', false, false);
         addGroup('CUSTOS', true, custos, 'detailedOnly');
         if (!isDREDetalhada) lines.push(custos);
         
         let lucroBruto = initRow('LUCRO BRUTO', true, true);
         sumRows(lucroBruto, [recLiq, custos]);
         lines.push(lucroBruto);

         // 4. Despesas Operacionais (Em Simples, cada grupo é uma linha. Em Detalhado, mostra a tabela)
         let despVendas = initRow('Despesas com Vendas', false, false);
         addGroup('DESPESAS COM VENDAS', true, despVendas, 'detailedOnly');
         if (!isDREDetalhada) lines.push(despVendas);

         let despAdm = initRow('Despesas Gerais Administrativas', false, false);
         addGroup('DESPESAS ADMINISTRATIVAS', true, despAdm, 'detailedOnly');
         if (!isDREDetalhada) lines.push(despAdm);

         let despTrib = initRow('Despesas Tributárias', false, false);
         addGroup('DESPESAS TRIBUTÁRIAS', true, despTrib, 'detailedOnly');
         if (!isDREDetalhada) lines.push(despTrib);

         let deprOp = initRow('Depreciações / Amortizações', false, false);
         addGroup('DEPRECIAÇÕES / AMORTIZAÇÕES', true, deprOp, 'detailedOnly');
         if (!isDREDetalhada) lines.push(deprOp);

         let doacoes = initRow('Doação/Patrocinio com Incetivos Fiscais', false, false);
         addGroup('DOAÇÕES / INCENTIVOS FISCAIS', true, doacoes, 'detailedOnly');
         if (!isDREDetalhada) lines.push(doacoes);

         let totalDespOp = initRow('Total Despesas Operacionais', true, true);
         sumRows(totalDespOp, [despVendas, despAdm, despTrib, deprOp, doacoes]);
         lines.push(totalDespOp);

         // 5. EBIT
         let ebit = initRow('RESULTADO DAS OPERAÇÕES (E.B.I.T.)', true, true);
         sumRows(ebit, [lucroBruto, totalDespOp]);
         lines.push(ebit);

         // 6. Financeiro
         let recFin = initRow('Receitas Financeiras', false, false);
         addGroup('RECEITAS FINANCEIRAS', false, recFin, 'detailedOnly');
         if (!isDREDetalhada) lines.push(recFin);

         let despFin = initRow('Despesas Financeiras', false, false);
         addGroup('DESPESAS FINANCEIRAS', true, despFin, 'detailedOnly');
         if (!isDREDetalhada) lines.push(despFin);

         let varMon = initRow('Variações Monetárias / Cambiais Líquidas', false, false);
         addGroup('VARIAÇÕES MONETÁRIAS / CAMBIAIS LÍQUIDAS', false, varMon, 'detailedOnly');
         if (!isDREDetalhada) lines.push(varMon);

         let ajFin = initRow('Ajustes Financeiros', false, false);
         addGroup('AJUSTES FINANCEIROS', false, ajFin, 'detailedOnly');
         if (!isDREDetalhada) lines.push(ajFin);

         let totalFin = initRow('Total Efeitos Financeiros Líquidos', true, true);
         sumRows(totalFin, [recFin, despFin, varMon, ajFin]);
         lines.push(totalFin);

         // 7. Participação
         let resultPartic = initRow('RESULTADO COM PARTICIP. SOCIETÁRIA', true, true);
         addGroup('RESULTADO COM PARTICIP. SOCIETÁRIA', false, resultPartic, 'detailedOnly');
         if (!isDREDetalhada) lines.push(resultPartic);

         // 8. Lucro Operacional
         let lucroOp = initRow('LUCRO (PREJUÍZO) OPERACIONAL', true, true);
         sumRows(lucroOp, [ebit, totalFin, resultPartic]);
         lines.push(lucroOp);

         // 9. Outras Receitas
         let outrasRec = initRow('Outras Receitas e Despesas', false, false);
         addGroup('OUTRAS RECEITAS E DESPESAS', false, outrasRec, 'detailedOnly');
         if (!isDREDetalhada) lines.push(outrasRec);
         
         let lucroAntesIrpj = initRow('LUCRO (PREJUÍZO) ANTES IRPJ / CSSL', true, true);
         sumRows(lucroAntesIrpj, [lucroOp, outrasRec]);
         lines.push(lucroAntesIrpj);

         // 10. Provisões
         let provIrpj = initRow('Provisão IRPJ', false, false);
         addGroup('PROVISÃO IRPJ', true, provIrpj, 'detailedOnly');
         if (!isDREDetalhada) lines.push(provIrpj);
         
         let provCsll = initRow('Provisão CSLL', false, false);
         addGroup('PROVISÃO CSLL', true, provCsll, 'detailedOnly');
         if (!isDREDetalhada) lines.push(provCsll);

         let lucroLiq = initRow('Lucro (Prejuizo) Líquido', true, true);
         sumRows(lucroLiq, [lucroAntesIrpj, provIrpj, provCsll]);
         lines.push(lucroLiq);

         // 11. Reversão Juros
         let revJuros = initRow('Reversão Juros s/ Capital Proprio', false, false);
         addGroup('REVERSÃO JUROS S/ CAPITAL PROPRIO', false, revJuros, 'detailedOnly');
         if (!isDREDetalhada) lines.push(revJuros);

         let lucroFinal = initRow('Lucro Antes dos Juros s/ Capital Proprio', true, true);
         sumRows(lucroFinal, [lucroLiq, revJuros]);
         lines.push(lucroFinal);
         
         // Helper de EBITDA (para DFC) - NUNCA PUSHA PARA LINES
         let ebitda = initRow('EBITDA (Calculado)', true, true);
         let deprAcum = initRow('Depreciações para EBITDA', false, false);
         addGroup('DEPRECIAÇÕES / AMORTIZAÇÕES', true, deprAcum, 'never');
         
         consolidated.companies.forEach(c => ebitda[c.id] = ebit[c.id] - deprAcum[c.id]);
         ebitda.consolidado = ebit.consolidado - deprAcum.consolidado;

         return { lines, subtotals: { ebitda, lucroLiq, deprAcum } };
      };

      const dreResult = buildDRE();

      // 4.6. Matemática do Passivo Dinâmica (Lucro calculado YTD)
      for (const comp of consolidated.companies) {
         let lucroYTD = 0;
         if (pPeriod === 'acumulado') {
            lucroYTD = dreResult.subtotals.lucroLiq[comp.id] || 0;
         } else {
            const dreYTD = await getDREFromDB(comp.id, pAno, pMes, 'acumulado');
            const dreMappedYTD = applyMapping(dreYTD, mergedMapping.dre, 1, 'valor');
            const getT = (group) => dreMappedYTD[group] ? dreMappedYTD[group]['TOTAL'].total : 0;
            const lucroBruto = getT('RECEITA OPERACIONAL BRUTA') + getT('DEDUÇÕES DA RECEITA') + getT('CUSTOS');
            const despOp = getT('DESPESAS COM VENDAS') + getT('DESPESAS ADMINISTRATIVAS') + getT('DESPESAS TRIBUTÁRIAS') + getT('DOAÇÕES / INCENTIVOS FISCAIS');
            const ebit = lucroBruto + despOp + getT('DEPRECIAÇÕES / AMORTIZAÇÕES');
            const finLiquido = getT('RECEITAS FINANCEIRAS') + getT('DESPESAS FINANCEIRAS') + getT('VARIAÇÕES MONETÁRIAS / CAMBIAIS LÍQUIDAS') + getT('AJUSTES FINANCEIROS') + getT('REVERSÃO JUROS S/ CAPITAL PROPRIO');
            const resAntesIr = ebit + finLiquido + getT('RESULTADO COM PARTICIP. SOCIETÁRIA') + getT('OUTRAS RECEITAS E DESPESAS');
            lucroYTD = resAntesIr + getT('PROVISÃO IRPJ') + getT('PROVISÃO CSLL');
         }
         
         let hasAnyBalanco = false;
         if (consolidated.ativo[comp.id]) {
            for (const g in consolidated.ativo[comp.id]) {
                if (Math.abs(consolidated.ativo[comp.id][g]?.['TOTAL']?.total || 0) > 0.01) hasAnyBalanco = true;
            }
         }
         if (consolidated.passivo[comp.id]) {
            for (const g in consolidated.passivo[comp.id]) {
                if (Math.abs(consolidated.passivo[comp.id][g]?.['TOTAL']?.total || 0) > 0.01) hasAnyBalanco = true;
            }
         }

         if (hasAnyBalanco && consolidated.passivo[comp.id] && consolidated.passivo[comp.id]['PATRIMONIO LIQUIDO']) {
           const grp = consolidated.passivo[comp.id]['PATRIMONIO LIQUIDO'];
           if (!grp['Lucro do Exercício']) grp['Lucro do Exercício'] = { total: 0, details: [] };
           
           grp['Lucro do Exercício'].total += lucroYTD;
           
           if (grp['TOTAL']) {
              grp['TOTAL'].total += lucroYTD;
           }
         }

              }

      // Construir DFC
      const buildDFC = () => {
         const lines = [];
         let gIdx = 0;
         const getId = () => `dfc-${gIdx++}`;
         
         // A- ATIVIDADES OPERACIONAIS
         lines.push({ id: getId(), conta: 'A- ATIVIDADES OPERACIONAIS', isGroupHeader: true, isTotal: true });
         lines.push({ id: getId(), conta: 'LUCRO LÍQUIDO AJUSTADO:', isTotal: true, isSubtotal: true });
         
         const lucroLine = { ...dreResult.subtotals.lucroLiq, id: getId(), conta: 'Lucro (Prejuízo) Líquido', isSubtotal: false, isTotal: false };
         lines.push(lucroLine);
         
         const lucroAjustesLines = buildGenericTable(consolidated.dfcLucroAjuste, { 'Ajustes': mergedMapping.dfc_lucro_ajuste_dre['Ajustes DRE'] /* dummy mapping ref for structure */ }, 'dfca-ajuste', false, false);
         // Override dummy accounts list by getting all unique keys from dfcLucroAjuste
         const allAjSet = new Set();
         consolidated.companies.forEach(c => {
           if (consolidated.dfcLucroAjuste[c.id] && consolidated.dfcLucroAjuste[c.id]['Ajustes']) {
             Object.keys(consolidated.dfcLucroAjuste[c.id]['Ajustes']).forEach(k => {
               if (k !== 'TOTAL') allAjSet.add(k);
             });
           }
         });
         const ajArray = Array.from(allAjSet).sort();
         const properLucroAjustesLines = [];
         let lIdx = 0;
         for (const aName of ajArray) {
           const l = { id: `aj-${lIdx++}`, conta: aName, isSubtotal: false, isTotal: false, consolidado: 0, details: [] };
           const detailMap = {};
           
           consolidated.companies.forEach(c => {
             const cell = consolidated.dfcLucroAjuste[c.id]?.['Ajustes']?.[aName];
             const val = cell ? cell.total : 0;
             l[c.id] = val;
             l.consolidado += val;
             
             if (cell && cell.details) {
                 cell.details.forEach(d => {
                   if (!detailMap[d.conta]) detailMap[d.conta] = { conta: d.conta, descricao: d.descricao };
                   detailMap[d.conta][c.id] = (detailMap[d.conta][c.id] || 0) + d.valor;
                 });
             }
           });
           
           Object.values(detailMap).forEach(d => {
              let dCons = 0;
              let dAllZeros = true;
              for (const c of consolidated.companies) {
                if (!d[c.id]) d[c.id] = 0;
                dCons += d[c.id];
                if (d[c.id] !== 0) dAllZeros = false;
              }
              d.consolidado = dCons;
              d.isZero = dAllZeros && dCons === 0;
              l.details.push(d);
           });
           
           properLucroAjustesLines.push(l);
         }
         lines.push(...properLucroAjustesLines);
         
         const totalLucroAjustado = { id: getId(), conta: 'Total do Lucro Líquido Ajustado', isTotal: true, isSubtotal: true, consolidado: 0 };
         consolidated.companies.forEach(c => {
           totalLucroAjustado[c.id] = (lucroLine[c.id] || 0) + properLucroAjustesLines.reduce((sum, l) => sum + (l[c.id] || 0), 0);
         });
         totalLucroAjustado.consolidado = (lucroLine.consolidado || 0) + properLucroAjustesLines.reduce((sum, l) => sum + (l.consolidado || 0), 0);
         lines.push(totalLucroAjustado);
         
         lines.push({ id: getId(), conta: '(ACRÉSCIMO) / DECRÉSCIMO DO ATIVO:', isTotal: true, isSubtotal: true });
         const ativoLines = buildGenericTable(consolidated.dfcAtivo, mergedMapping.dfc_ativo, 'dfc-ativo', true, true, true);
         const totalAtivo = ativoLines.pop(); // Remove o total gerado
         ativoLines.forEach(l => lines.push(l));
         totalAtivo.conta = 'Total do (Acréscimo) / Decréscimo do Ativo';
         totalAtivo.isSubtotal = true;
         lines.push(totalAtivo);

         lines.push({ id: getId(), conta: 'ACRÉSCIMO / (DECRÉSCIMO) DO PASSIVO:', isTotal: true, isSubtotal: true });
         const passivoLines = buildGenericTable(consolidated.dfcPassivo, mergedMapping.dfc_passivo, 'dfc-passivo', true, true, true);
         const totalPassivo = passivoLines.pop();
         passivoLines.forEach(l => lines.push(l));
         totalPassivo.conta = 'Total do Acréscimo / (Decréscimo) do Passivo';
         totalPassivo.isSubtotal = true;
         lines.push(totalPassivo);
         
         // Calculate Saldos earlier to compute plug
         const saldoInicialLines = buildGenericTable(consolidated.dfcCaixaInicial, mergedMapping.dfc_caixa, 'dfc-c-i', false, true);
         const saldoFinalLines = buildGenericTable(consolidated.dfcCaixaFinal, mergedMapping.dfc_caixa, 'dfc-c-f', false, true);
         const saldoVarLines = buildGenericTable(consolidated.dfcCaixa, mergedMapping.dfc_caixa, 'dfc-c-v', false, true);
         const lIni = saldoInicialLines.pop(); lIni.conta = 'Saldo inicial do caixa';
         const lFin = saldoFinalLines.pop(); lFin.conta = 'Saldo final do caixa';
         const lVar = saldoVarLines.pop(); lVar.conta = 'Variação no caixa';
         
         // B- ATIVIDADES DE INVESTIMENTO
         const invLines = buildGenericTable(consolidated.dfcInvestimento, mergedMapping.dfc_investimento, 'dfc-inv', true, true, true);
         const totalInv = invLines.pop();
         totalInv.conta = 'Total das atividades de investimento';
         
         // C- ATIVIDADES DE FINANCIAMENTO
         const finLines = buildGenericTable(consolidated.dfcFinanciamento, mergedMapping.dfc_financiamento, 'dfc-fin', true, true, true);
         const totalFin = finLines.pop();
         totalFin.conta = 'Total das atividades de financiamento';
         
         // Compute PLUG (Outras Variações) to ensure DFC matches Cash Variation
         const plugLine = { id: getId(), conta: 'Diferença Contábil (Furo Matemático no DB original)', isTotal: false, isSubtotal: false, consolidado: 0, details: [] };
         
         const mappedPrefixes = [];
         const dfcConfigs = [
             mergedMapping.dfc_ativo, mergedMapping.dfc_passivo, 
             mergedMapping.dfc_investimento, mergedMapping.dfc_financiamento,
             mergedMapping.dfc_lucro_ajuste_ativo, mergedMapping.dfc_lucro_ajuste_passivo,
             mergedMapping.dfc_caixa
         ];
         dfcConfigs.forEach(config => {
             if (!config) return;
             Object.values(config).forEach(group => {
                 Object.values(group).forEach(prefs => {
                     mappedPrefixes.push(...prefs);
                 });
             });
         });
         mappedPrefixes.push('2.9.8', '2.9.9', '2.9.4', '2.9.5', '1.3.3.1.99', '1.3.3.5.99', '1.3.4.1.99'); // Excluir do plug contas não operacionais que fecham via DRE
         
         const detailMapPlug = {};
         
         consolidated.companies.forEach(c => {
             const vCaixa = lVar[c.id] || 0;
             const vOpParcial = (totalLucroAjustado[c.id] || 0) + (totalAtivo[c.id] || 0) + (totalPassivo[c.id] || 0);
             const vInv = totalInv[c.id] || 0;
             const vFin = totalFin[c.id] || 0;
             const diff = vCaixa - (vOpParcial + vInv + vFin);
             
             const bVar = consolidated.balancoVariation[c.id] || {};
             Object.entries(bVar).forEach(([k, v]) => {
                 if (!mappedPrefixes.some(p => k.startsWith(p)) && (k.startsWith('1.') || k.startsWith('2.'))) {
                     if (Math.abs(v.valor) > 0.01) {
                         if (!detailMapPlug[k]) detailMapPlug[k] = { conta: k, descricao: v.descricao };
                         const multiplier = k.startsWith('1.') ? -1 : 1;
                         detailMapPlug[k][c.id] = (detailMapPlug[k][c.id] || 0) + (v.valor * multiplier);
                     }
                 }
             });
             
             // Para evitar mostrar o plug quando é zero ou muito pequeno (centavos)
             plugLine[c.id] = Math.abs(diff) > 0.01 ? diff : 0;
         });
         const vCaixaC = lVar.consolidado || 0;
         const vOpParcialC = (totalLucroAjustado.consolidado || 0) + (totalAtivo.consolidado || 0) + (totalPassivo.consolidado || 0);
         const vInvC = totalInv.consolidado || 0;
         const vFinC = totalFin.consolidado || 0;
         const diffC = vCaixaC - (vOpParcialC + vInvC + vFinC);
         plugLine.consolidado = Math.abs(diffC) > 0.01 ? diffC : 0;
         
         Object.values(detailMapPlug).forEach(d => {
              let dCons = 0;
              let dAllZeros = true;
              for (const c of consolidated.companies) {
                if (!d[c.id]) d[c.id] = 0;
                dCons += d[c.id];
                if (d[c.id] !== 0) dAllZeros = false;
              }
              d.consolidado = dCons;
              d.isZero = dAllZeros && dCons === 0;
              plugLine.details.push(d);
         });
         
         const hasPlug = consolidated.companies.some(c => plugLine[c.id] !== 0) || plugLine.consolidado !== 0;
         
         // Se não há contas não mapeadas, mas existe furo matemático, adiciona detalhe informativo
         if (hasPlug && plugLine.details.length === 0) {
             const fakeDetail = {
                 conta: 'INFO',
                 descricao: 'Todas as contas foram mapeadas. Esse valor reflete o desbalanceamento intrínseco (Ativo - Passivo ≠ DRE) dos dados contábeis.',
                 consolidado: plugLine.consolidado,
                 isZero: false
             };
             consolidated.companies.forEach(c => { fakeDetail[c.id] = plugLine[c.id]; });
             plugLine.details.push(fakeDetail);
         }
         
         if (hasPlug) {
             lines.push(plugLine);
         }
         
         const totalOperacional = { id: getId(), conta: 'Total das atividades operacionais', isTotal: true, consolidado: 0 };
         consolidated.companies.forEach(c => {
            totalOperacional[c.id] = (totalLucroAjustado[c.id] || 0) + (totalAtivo[c.id] || 0) + (totalPassivo[c.id] || 0) + (plugLine[c.id] || 0);
         });
         totalOperacional.consolidado = (totalLucroAjustado.consolidado || 0) + (totalAtivo.consolidado || 0) + (totalPassivo.consolidado || 0) + (plugLine.consolidado || 0);
         lines.push(totalOperacional);
         
         lines.push({ id: getId(), conta: 'B- ATIVIDADES DE INVESTIMENTO', isGroupHeader: true, isTotal: true });
         invLines.forEach(l => lines.push(l));
         lines.push(totalInv);
         
         lines.push({ id: getId(), conta: 'C- ATIVIDADES DE FINANCIAMENTO', isGroupHeader: true, isTotal: true });
         finLines.forEach(l => lines.push(l));
         lines.push(totalFin);
         
         // D- TOTAL DOS EFEITOS NO CAIXA (A+B+C)
         const totalEfeitoCaixa = { id: getId(), conta: 'D- TOTAL DOS EFEITOS NO CAIXA (A+B+C)', isGroupHeader: true, isTotal: true, consolidado: 0 };
         consolidated.companies.forEach(c => {
            totalEfeitoCaixa[c.id] = (totalOperacional[c.id] || 0) + (totalInv[c.id] || 0) + (totalFin[c.id] || 0);
         });
         totalEfeitoCaixa.consolidado = (totalOperacional.consolidado || 0) + (totalInv.consolidado || 0) + (totalFin.consolidado || 0);
         lines.push(totalEfeitoCaixa);
         
         lines.push(lIni);
         lines.push(lFin);
         lines.push(lVar);
         
         return lines;
      };

      const finalResults = {
        dre: dreResult.lines,
        dfc: buildDFC(),
        ativo: buildGenericTable(consolidated.ativo, mergedMapping.ativo, 'ativo', isBalancoDetalhado, true),
        passivo: buildGenericTable(consolidated.passivo, mergedMapping.passivo, 'passivo', isBalancoDetalhado, true),
        subtotals: dreResult.subtotals,
        companies: consolidated.companies,
        raw: consolidated,
        unmapped: unmappedAccounts
      };

      setResults(finalResults);
      setExpandedRows({}); // reset drilldowns
      setActiveTab('resultados');
    } catch (error) {
      console.error('Erro ao processar', error);
      window.$alert('Erro ao processar balancete: ' + error.message);
    } finally { setIsProcessing(false); } };

    const handlePrint = (reportName) => {
        const compData = selectedCompany !== 'consolidado' ? companies.find(c => c.id === selectedCompany) : null;
        const headerNome = selectedCompany === 'consolidado' ? 'GRUPO AGF CONSOLIDADO' : (compData ? compData.name.toUpperCase() : '');
        const mesNome = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][selectedMes-1];
        let periodText = '';
        if (period === 'mensal') periodText = `${mesNome} ${selectedAno}`;
        else if (period === 'trimestre') periodText = `${selectedTrimestre}T ${selectedAno}`;
        else periodText = `Acumulado ${selectedAno}`;
        
        const fileName = `${headerNome} - ${reportName} - ${periodText}`;
        const originalTitle = document.title;
        document.title = fileName;

        const style = document.createElement('style');
        style.innerHTML = `@media print { @page { size: A4 ${selectedCompany === 'consolidado' ? 'landscape' : 'portrait'} !important; } }`;
        document.head.appendChild(style);

        window.print();

        document.title = originalTitle;
        document.head.removeChild(style);
    };

    const PrintHeader = () => {
        const compData = selectedCompany !== 'consolidado' ? companies.find(c => c.id === selectedCompany) : null;
        const headerNome = selectedCompany === 'consolidado' ? 'GRUPO AGF (CONSOLIDADO)' : (compData ? compData.name.toUpperCase() : '');
        const headerCnpj = selectedCompany === 'consolidado' ? 'CNPJ: 11.681.470/0001-84 IE: 530051442114' : (compData && compData.cnpj ? `CNPJ: ${compData.cnpj}` : 'CNPJ: 11.681.470/0001-84 IE: 530051442114');
        
        const mesNome = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][selectedMes-1];
        let periodText = '';
        if (period === 'mensal') periodText = `Mês: ${mesNome} / ${selectedAno}`;
        else if (period === 'trimestre') periodText = `Trimestre: ${selectedTrimestre}º Trimestre / ${selectedAno}`;
        else periodText = `Acumulado YTD: ${selectedAno}`;

        return (
            <div className="print-only" style={{ display: 'none', alignItems: 'center', marginBottom: '1rem', color: '#000' }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                    <h2 style={{ fontSize: '1.2rem', margin: '0 0 0.25rem 0', fontWeight: 'bold' }}>{headerNome}</h2>
                    <p style={{ fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>{headerCnpj}</p>
                    <div style={{ display: 'inline-block', borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '0.3rem 2rem', fontWeight: 'bold', fontSize: '1.1rem' }}>
                        Período da Demonstração: {periodText}
                    </div>
                </div>
            </div>
        );
    };

  const renderTable = (title, lines, avBaseKey = null) => {
    if (!lines || lines.length === 0) return null;
    // Quando uma empresa específica está selecionada, filtrar as colunas
    const compArray = selectedCompany === 'consolidado'
      ? results.companies
      : results.companies.filter(c => c.id === selectedCompany);
    
    // Encontrar a linha base para o cálculo de AV%
    const avBaseRow = avBaseKey ? lines.find(l => l.conta === avBaseKey) : null;

    const getDisplayValue = (line) => {
      if (selectedCompany === 'consolidado') return line.consolidado;
      return line[selectedCompany];
    };
    
    return (
      <div className="table-wrapper" style={{ marginBottom: '3rem' }}>
        <h3 className="print-hide" style={{ padding: '1rem', background: 'rgba(0,0,0,0.4)', color: 'var(--color-primary)', borderBottom: '1px solid #333' }}>
          {title}
        </h3>
        <table className="data-table">
          <thead>
            <tr>
                <th colSpan={100} className="print-title-cell" style={{ background: '#e0e0e0', color: '#000', textAlign: 'center', padding: '0.75rem', fontWeight: 'bold', fontSize: '1.1rem', border: '1px solid #000' }}>
                    {title}
                </th>
            </tr>
            <tr>
              <th>Conta Gerencial / Descrição</th>
              {compArray.map(c => (
                <React.Fragment key={c.id}>
                  <th>{c.name.toUpperCase()}</th>
                  {avBaseRow && <th className="av-col">AV %</th>}
                </React.Fragment>
              ))}
              {selectedCompany === 'consolidado' && (
                <React.Fragment>
                  <th>CONSOLIDADO</th>
                  {avBaseRow && <th className="av-col">AV %</th>}
                </React.Fragment>
              )}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => {
              if (hideZeros && line.isZero && !line.isGrandTotal && !line.isGroupHeader) return null;
              const hasDetails = line.details && line.details.length > 0;
              const isExpanded = expandedRows[line.id];
              
              return (
                <React.Fragment key={line.id || idx}>
                  <tr 
                    className={line.isSubtotal ? 'subtotal-row' : line.isGroupHeader ? 'table-header-yellow' : line.isTotal ? 'total-row' : ''}
                    style={{ cursor: hasDetails ? 'pointer' : 'default' }}
                    onClick={() => hasDetails && toggleRow(line.id)}
                  >
                    <td style={{ 
                      color: (line.isTotal && !line.isSubtotal && !line.isGroupHeader) ? 'var(--color-primary)' : 'inherit', 
                      fontWeight: line.isSubtotal || line.isGroupHeader ? 'bold' : 'normal',
                      paddingLeft: line.isGroupHeader || line.isSubtotal || line.isTotal ? '0.5rem' : '1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      {hasDetails ? (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <span style={{width: 16}}></span>}
                      {line.conta}
                    </td>
                    {compArray.map(c => {
                      const avVal = avBaseRow ? Math.abs(avBaseRow[c.id] || 1) : 1;
                      const avPct = (avBaseRow && (line[c.id] || 0) !== 0) ? (line[c.id] / avVal) * 100 : 0;
                      return (
                        <React.Fragment key={c.id}>
                          <td style={{ color: (line[c.id] || 0) < 0 ? '#ff5252' : 'var(--color-success)', fontWeight: line.isSubtotal || line.isTotal ? 'bold' : 'normal' }}>
                            {line[c.id] !== undefined ? line[c.id].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                          </td>
                          {avBaseRow && (
                            <td className="av-cell">
                              {line.isGroupHeader || line.isZero ? '' : `${avPct.toFixed(1)}%`}
                            </td>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {selectedCompany === 'consolidado' && (() => {
                      const avValConsol = avBaseRow ? Math.abs(avBaseRow.consolidado || 1) : 1;
                      const avPctConsol = (avBaseRow && (line.consolidado || 0) !== 0) ? (line.consolidado / avValConsol) * 100 : 0;
                      return (
                        <React.Fragment>
                          <td style={{ color: (line.consolidado || 0) < 0 ? '#ff5252' : 'var(--color-success)', fontWeight: 'bold' }}>
                            {line.consolidado !== undefined ? line.consolidado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                          </td>
                          {avBaseRow && (
                            <td className="av-cell" style={{ fontWeight: 'bold' }}>
                              {line.isGroupHeader || line.isZero ? '' : `${avPctConsol.toFixed(1)}%`}
                            </td>
                          )}
                        </React.Fragment>
                      );
                    })()}
                  </tr>
                  
                  {isExpanded && line.details && line.details.map((det, dIdx) => {
                    if (hideZeros && det.isZero) return null;
                    return (
                      <tr key={`${line.id}-det-${dIdx}`} style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <td style={{ paddingLeft: '3rem', fontSize: '0.85em', color: '#aaa', display: 'flex', gap: '1rem' }}>
                          <span style={{ color: 'var(--color-primary)' }}>[{det.conta}]</span> 
                          <span>{det.descricao}</span>
                        </td>
                        {compArray.map(c => {
                          const avValDet = avBaseRow ? Math.abs(avBaseRow[c.id] || 1) : 1;
                          const avPctDet = (avBaseRow && (det[c.id] || 0) !== 0) ? (det[c.id] / avValDet) * 100 : 0;
                          return (
                            <React.Fragment key={c.id}>
                              <td style={{ fontSize: '0.85em', color: '#ccc' }}>
                                {det[c.id] !== undefined ? det[c.id].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                              </td>
                              {avBaseRow && (
                                <td className="av-cell" style={{ fontSize: '0.85em' }}>
                                  {`${avPctDet.toFixed(1)}%`}
                                </td>
                              )}
                            </React.Fragment>
                          );
                        })}
                        {selectedCompany === 'consolidado' && (() => {
                          const avValConsolDet = avBaseRow ? Math.abs(avBaseRow.consolidado || 1) : 1;
                          const avPctConsolDet = (avBaseRow && (det.consolidado || 0) !== 0) ? (det.consolidado / avValConsolDet) * 100 : 0;
                          return (
                            <React.Fragment>
                              <td style={{ fontSize: '0.85em', color: (det.consolidado || 0) < 0 ? '#ff5252' : 'var(--color-success)' }}>
                                {det.consolidado !== undefined ? det.consolidado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                              </td>
                              {avBaseRow && (
                                <td className="av-cell" style={{ fontSize: '0.85em' }}>
                                  {`${avPctConsolDet.toFixed(1)}%`}
                                </td>
                              )}
                            </React.Fragment>
                          );
                        })()}
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="protheus-module">
      <nav className="module-tabs glass-panel" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          {(!moduleMode || moduleMode === 'indicadores') && (userPermissions?.includes('dash') || (['danilo', 'ryan.santos'].includes(username))) && (
            <>
              <button
                className={`tab-btn ${activeTab === 'resultados' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('resultados');
                  loadPanelData();
                }}
              >
                <FileText size={20} /> Dashboard Contábil
              </button>

              <button
                className={`tab-btn ${activeTab === 'cc' ? 'active' : ''}`}
                onClick={() => setActiveTab('cc')}
              >
                <Database size={20} /> Dashboard Centro de Custo
              </button>
            </>
          )}

          {(!moduleMode || moduleMode === 'contabil') && (userPermissions?.includes('contabil') || (['danilo', 'ryan.santos'].includes(username))) && (
            <>
              <button
                className={`tab-btn ${activeTab === 'apuracao' ? 'active' : ''}`}
                onClick={() => setActiveTab('apuracao')}
              >
                <Activity size={20} /> Apuração IRPJ/CSLL
              </button>

              <button
                className={`tab-btn ${activeTab === 'rateio' ? 'active' : ''}`}
                onClick={() => setActiveTab('rateio')}
              >
                <Database size={20} /> Holding
              </button>

              <button
                className={`tab-btn ${activeTab === 'gestao' ? 'active' : ''}`}
                onClick={() => setActiveTab('gestao')}
              >
                <FileText size={20} /> Gestão Contábil
              </button>
            </>
          )}

          {(!moduleMode || moduleMode === 'contabil') && (userPermissions?.includes('db') || (['danilo', 'ryan.santos'].includes(username))) && (
            <button
              className={`tab-btn ${activeTab === 'db' ? 'active' : ''}`}
              onClick={() => setActiveTab('db')}
            >
              <Database size={20} /> Banco de Dados
            </button>
          )}

          {onBackToModules && (
            <button
              onClick={onBackToModules}
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#aaa',
                padding: '0.45rem 0.9rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
              title="Voltar para a tela de seleção de módulos"
            >
              <span>⊞</span> Alternar Módulo
            </button>
          )}
        </nav>
      {activeTab === 'db' && (
        <div style={{ marginTop: '1rem' }}>

          {/* BARRA STICKY NO TOPO - data + gravar + excluir */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 10,
            background: 'rgba(15,15,15,0.97)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid #333',
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
            justifyContent: 'space-between'
          }}>
            <span style={{ color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '1rem' }}>🗄️ Banco de Dados</span>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={selectedMes} onChange={(e) => setSelectedMes(parseInt(e.target.value))} className="select-input" style={{ width: '130px' }}>
                <option value={1}>Janeiro</option><option value={2}>Fevereiro</option><option value={3}>Março</option>
                <option value={4}>Abril</option><option value={5}>Maio</option><option value={6}>Junho</option>
                <option value={7}>Julho</option><option value={8}>Agosto</option><option value={9}>Setembro</option>
                <option value={10}>Outubro</option><option value={11}>Novembro</option><option value={12}>Dezembro</option>
              </select>
              <select value={selectedAno} onChange={(e) => setSelectedAno(parseInt(e.target.value))} className="select-input" style={{ width: '90px' }}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button
                onClick={async () => {
                  const mesNome = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][selectedMes-1];
                  const hasFiles = Object.keys(files).length > 0;
                  if (!hasFiles) { window.$alert('Selecione ao menos um arquivo balancete antes de gravar.', { type: 'warning' }); return; }
                  const fileList = Object.entries(files).map(([id, f]) => `  • ${companies.find(c=>c.id===id)?.name || id}: ${f.name}`).join('\n');
                  const ok = await window.$confirm(`Confirma a gravação dos dados no banco?\n\nPeríodo: ${mesNome}/${selectedAno}\n\nArquivos:\n${fileList}`, { title: 'Gravar Balancetes no Banco' });
                  if (!ok) return;
                  handleSaveToDB();
                }}
                className="action-btn"
                disabled={isProcessing}
                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
              >
                {isProcessing ? '...' : '💾 Gravar'} 
              </button>
              <button
                onClick={handleDeleteMonth}
                style={{ background: '#c62828', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}
              >
                🗑️ Excluir Mês
              </button>
            </div>
          </div>

          {/* CARDS COMPACTOS DE UPLOAD */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {companies.map(comp => (
              <div key={comp.id} style={{
                background: 'rgba(255,255,255,0.03)',
                border: files[comp.id] ? '1px solid var(--color-success)' : '1px solid #333',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                display: 'flex', alignItems: 'center', gap: '0.75rem'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: files[comp.id] ? 'var(--color-success)' : '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {comp.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#555', marginTop: '2px' }}>
                    {files[comp.id] ? files[comp.id].name : 'Sem arquivo'}
                  </div>
                </div>
                <input
                  type="file"
                  ref={el => fileInputRefs.current[comp.id] = el}
                  accept=".xlsx"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileChange(comp.id, e)}
                />
                <button
                  onClick={() => fileInputRefs.current[comp.id]?.click()}
                  style={{
                    background: files[comp.id] ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.05)',
                    border: '1px dashed #555', borderRadius: '8px', color: '#ccc',
                    padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap'
                  }}
                >
                  <UploadCloud size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  {files[comp.id] ? 'Trocar' : 'Selecionar'}
                </button>
              </div>
            ))}

            {/* Adicionar nova empresa - compacto */}
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: '1px dashed #444',
              borderRadius: '10px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem'
            }}>
              <input
                type="text"
                placeholder="+ Nova Empresa..."
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                className="select-input"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCompany()}
              />
              <button
                onClick={handleAddCompany}
                disabled={!newCompanyName.trim()}
                style={{ background: 'var(--color-primary)', color: '#111', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', opacity: newCompanyName.trim() ? 1 : 0.4 }}
              >
                <Plus size={14} style={{ display: 'inline', marginRight: '4px' }} /> Adicionar
              </button>
            </div>
          </div>
          {/* INSERÇÃO MANUAL */}
          <div className="glass-panel" style={{ padding: '1rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <h4 style={{ margin: 0, color: 'var(--color-primary)', width: '100%' }}>➕ Inserir Lançamento Avulso (Exclusões, Provisões) no mês {selectedMes}/{selectedAno}</h4>
            
            <select value={manualEmpresa} onChange={(e) => setManualEmpresa(e.target.value)} className="select-input" style={{ width: '150px' }}>
               <option value="">Empresa...</option>
               <option value="exclusoes">Exclusões</option>
               {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            
            <input type="text" placeholder="Conta (ex: 6)" value={manualConta} onChange={(e) => setManualConta(e.target.value)} className="select-input" style={{ width: '120px' }} />
            <input type="text" placeholder="Descrição (Opcional)" value={manualDescricao} onChange={(e) => setManualDescricao(e.target.value)} className="select-input" style={{ flex: 1, minWidth: '150px' }} />
            <input type="number" placeholder="Valor (R$)" value={manualValor} onChange={(e) => setManualValor(e.target.value)} className="select-input" style={{ width: '120px' }} />
            
            <button onClick={handleAddManualEntry} className="btn-primary" style={{ padding: '0.6rem 1rem' }}>Inserir</button>
          </div>

          {/* TABELA DE AUDITORIA E EDIÇÃO */}
          <div className="glass-panel" style={{ padding: '1.5rem', overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ color: 'var(--color-primary)' }}>Registros Gravados no Mês</h3>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Pesquisar conta..."
                  value={dbSearchText}
                  onChange={(e) => setDbSearchText(e.target.value)}
                  className="text-input"
                  style={{ width: '250px' }}
                />
                <select
                  value={dbFilterCompany}
                  onChange={(e) => setDbFilterCompany(e.target.value)}
                  className="select-input"
                  style={{ width: '220px' }}
                >
                  <option value="">Todas as Empresas</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            {loadingDb ? (
              <p>Carregando dados...</p>
            ) : dbTabRecords.filter(r => !dbFilterCompany || r.empresaId === dbFilterCompany).length === 0 ? (
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
                  {dbTabRecords
                    .filter(r => !dbFilterCompany || r.empresaId === dbFilterCompany)
                    .filter(r => !dbSearchText || r.conta.toLowerCase().includes(dbSearchText.toLowerCase()) || (r.descricao && r.descricao.toLowerCase().includes(dbSearchText.toLowerCase())))
                    .map(r => (
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

      {activeTab === "resultados" && results && (
        <div className="results-section">
          <PendencyWidget companies={companies} ano={selectedAno} />

          
          <div className="print-hide" style={{ 
            position: 'sticky',
            top: '10px',
            zIndex: 1000,
            background: 'rgba(18, 18, 24, 0.95)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            padding: '0.8rem 1.2rem',
            borderRadius: '12px',
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '1.5rem', 
            flexWrap: 'wrap', 
            gap: '1rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
            transition: 'all 0.3s ease'
          }}>
            <div>
              <h2 style={{ color: 'var(--color-primary)' }}>Painel de Inteligência Consolidado</h2>
              {latestAvailable && <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.2rem' }}>Último balancete integrado: <strong>{latestAvailable}</strong></p>}
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <select value={selectedCompany} onChange={(e) => { 
                setSelectedCompany(e.target.value);
                loadPanelData(selectedAno, selectedMes, period, e.target.value); 
              }} className="select-input" style={{ width: '220px', borderColor: 'var(--color-primary)' }}>
                <option value="consolidado">VISÃO: CONSOLIDADO</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              {period === 'mensal' && (
                <select value={selectedMes} onChange={(e) => {
                  const m = parseInt(e.target.value);
                  setSelectedMes(m);
                  loadPanelData(selectedAno, m, period);
                }} className="select-input" style={{ width: '150px' }}>
                  <option value={1}>Janeiro</option><option value={2}>Fevereiro</option><option value={3}>Março</option>
                  <option value={4}>Abril</option><option value={5}>Maio</option><option value={6}>Junho</option>
                  <option value={7}>Julho</option><option value={8}>Agosto</option><option value={9}>Setembro</option>
                  <option value={10}>Outubro</option><option value={11}>Novembro</option><option value={12}>Dezembro</option>
                </select>
              )}

              {period === 'trimestre' && (
                <select value={selectedTrimestre} onChange={(e) => {
                  const t = parseInt(e.target.value);
                  setSelectedTrimestre(t);
                  // Sync selectedMes to the end of the quarter
                  const m = t * 3; 
                  setSelectedMes(m);
                  loadPanelData(selectedAno, m, period);
                }} className="select-input" style={{ width: '150px' }}>
                  <option value={1}>1º Trimestre</option>
                  <option value={2}>2º Trimestre</option>
                  <option value={3}>3º Trimestre</option>
                  <option value={4}>4º Trimestre</option>
                </select>
              )}

              <select value={selectedAno} onChange={(e) => {
                const a = parseInt(e.target.value);
                setSelectedAno(a);
                loadPanelData(a, selectedMes);
              }} className="select-input" style={{ width: '100px' }}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={period} onChange={(e) => { 
                const newPeriod = e.target.value;
                setPeriod(newPeriod); 
                loadPanelData(selectedAno, selectedMes, newPeriod); 
              }} className="select-input" style={{ width: '180px' }}>
                <option value="mensal">Visão: Mês</option>
                <option value="trimestre">Visão: Trimestre</option>
                <option value="acumulado">Visão: YTD (Ano)</option>
              </select>
            </div>
          </div>

          <nav className="secondary-nav" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #333', marginBottom: '2rem' }}>
            {['dash', 'dre', 'balanco', 'dfc', 'faturamento', 'perdcomp'].map(tab => (
              <button
                key={tab}
                onClick={() => setSecondaryTab(tab)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: secondaryTab === tab ? 'var(--color-primary)' : '#888',
                  borderBottom: secondaryTab === tab ? '2px solid var(--color-primary)' : 'none',
                  padding: '1rem',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  fontWeight: secondaryTab === tab ? 'bold' : 'normal'
                }}
              >
                {tab === 'dash' ? '📊 Dashboard' : tab === 'dre' ? '📄 DRE' : tab === 'balanco' ? '⚖️ Balanço Patrimonial' : tab === 'dfc' ? '💸 Fluxo de Caixa (DFC)' : tab === 'faturamento' ? '📈 Relação de Faturamento' : '📋 PER/DCOMP'}
              </button>
            ))}
          </nav>

          {secondaryTab === 'dash' && (
            <DashboardView 
              selectedCompany={selectedCompany} 
              selectedAno={selectedAno} 
              selectedMes={selectedMes} 
              selectedTrimestre={selectedTrimestre}
              period={period} 
            />
          )}

          {secondaryTab === 'dre' && (
            <div className="glass-panel" style={{ padding: '1.5rem', position: 'relative' }}>
              <div className="print-hide" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '1rem' }}>
                <button 
                   onClick={() => setIsDREDetalhada(!isDREDetalhada)} 
                   className="btn-secondary"
                   style={{ padding: '0.6rem 1rem' }}
                >
                   {isDREDetalhada ? '🔄 Ver DRE Simples' : '🔄 Ver DRE Detalhada'}
                </button>
                <button 
                   onClick={() => handlePrint('DRE')} 
                   className="btn-primary"
                   style={{ padding: '0.6rem 1rem' }}
                >
                   🖨️ Exportar PDF
                </button>
              </div>
              <div className="printable-area">
                 <PrintHeader />
                 {renderTable(`DRE - ${period.toUpperCase()}`, results.dre, 'RECEITA OPERACIONAL LÍQUIDA')}
              </div>
            </div>
          )}

          {secondaryTab === 'balanco' && (
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', position: 'relative' }}>
              <div className="print-hide" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '-1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ccc', cursor: 'pointer', marginRight: '1rem' }}>
                  <input type="checkbox" checked={hideZeros} onChange={e => setHideZeros(e.target.checked)} />
                  Ocultar valores zerados
                </label>
                <button 
                   onClick={() => setIsBalancoDetalhado(!isBalancoDetalhado)} 
                   className="btn-secondary"
                   style={{ padding: '0.6rem 1rem' }}
                >
                   {isBalancoDetalhado ? '🔄 Ver Balanço Simples' : '🔄 Ver Balanço Detalhado'}
                </button>
                <button 
                   onClick={() => handlePrint('Balanço Patrimonial')} 
                   className="btn-primary"
                   style={{ padding: '0.6rem 1rem' }}
                >
                   🖨️ Exportar PDF
                </button>
              </div>

              <div className="printable-area">
              <PrintHeader />
              {/* Badge de Conferência: Ativo = Passivo + PL */}
              {(() => {
                const getTotal = (tableLines) => {
                  if (!tableLines || tableLines.length === 0) return {};
                  const lastTotal = [...tableLines].reverse().find(l => l.isTotal && !l.isGroupHeader);
                  return lastTotal || {};
                };
                const ativoTot = getTotal(results.ativo);
                const passivoTot = getTotal(results.passivo);
                const comps = selectedCompany === 'consolidado' ? ['consolidado'] : [selectedCompany];
                return (
                  <div className="print-hide" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                    {comps.map(cid => {
                      const ativo = ativoTot[cid] || 0;
                      const passivo = passivoTot[cid] || 0;
                      const diff = ativo - passivo;
                      const ok = Math.abs(diff) < 0.01; // Restaura exibição estrita para apontar qualquer diferença centesimal
                      const label = cid === 'consolidado' ? 'Consolidado' : results.companies.find(c => c.id === cid)?.name || cid;
                      return (
                        <div key={cid} style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          background: ok ? 'rgba(76,175,80,0.1)' : 'rgba(244,67,54,0.1)',
                          border: `1px solid ${ok ? '#4CAF50' : '#f44336'}`,
                          borderRadius: '10px', padding: '0.75rem 1.25rem'
                        }}>
                          <span style={{ fontSize: '1.4rem' }}>{ok ? '✅' : '⚠️'}</span>
                          <div>
                            <div style={{ fontWeight: 'bold', color: ok ? '#4CAF50' : '#f44336', fontSize: '0.9rem' }}>
                              {label} — Ativo {ok ? '=' : '≠'} Passivo + PL
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#aaa', marginTop: '2px' }}>
                              Ativo: {ativo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                              {' | '}
                              Passivo+PL: {passivo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                              {!ok && <span style={{ color: '#f44336', marginLeft: '0.5rem' }}>
                                Dif: {diff.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {results.unmapped && results.unmapped.length > 0 && (
                <div style={{ background: 'rgba(255,152,0,0.1)', border: '1px solid #FF9800', borderRadius: '10px', padding: '1rem', marginTop: '1rem' }}>
                  <h3 style={{ color: '#FF9800', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={18} />
                    Contas Não Mapeadas Encontradas! ({results.unmapped.length})
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#ccc', margin: '0 0 1rem 0' }}>
                    As seguintes contas possuem saldo no banco de dados, mas não estão associadas a nenhum grupo no Balanço Patrimonial (mappingConfig.js). Isso causa diferença entre Ativo e Passivo.
                  </p>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Empresa</th>
                          <th>Tipo</th>
                          <th>Conta</th>
                          <th>Descrição</th>
                          <th style={{ textAlign: 'right' }}>Valor</th>
                          <th style={{ textAlign: 'center' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.unmapped.map((u, i) => (
                          <tr key={i}>
                            <td>{u.compId}</td>
                            <td>{u.tipo.toUpperCase()}</td>
                            <td>{u.conta}</td>
                            <td>{u.descricao || '-'}</td>
                            <td style={{ textAlign: 'right' }}>{Number(u.valor || u.saldoAcumulado || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td style={{ textAlign: 'center' }}>
                                <button 
                                  className="btn-primary" 
                                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem' }}
                                  onClick={() => {
                                      setMappingTarget({ conta: u.conta, tipo: u.tipo, relatorio: '', grupo: '', subgrupo: '' });
                                      setIsMappingModalOpen(true);
                                  }}
                                >
                                    Mapear
                                </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}


              {renderTable('Balanço Patrimonial - ATIVO', results.ativo, 'TOTAL DO ATIVO')}
              <div className="print-only" style={{ pageBreakBefore: 'always', display: 'none' }}></div>
              <PrintHeader />
              {renderTable('Balanço Patrimonial - PASSIVO + PATRIMÔNIO LÍQUIDO', results.passivo, 'TOTAL PASSIVO E PATRIMÔNIO LÍQUIDO')}
              </div>
            </div>
          )}

          {secondaryTab === 'dfc' && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              {renderTable(`Demonstração de Fluxo de Caixa (DFC) - ${period.toUpperCase()}`, results.dfc)}
            </div>
          )}

          {secondaryTab === 'faturamento' && (
            <div style={{ marginTop: '1rem' }}>
              <FaturamentoModule
              companies={companies}
              selectedCompany={selectedCompany}
              selectedAno={selectedAno}
              selectedMes={selectedMes}
            />
          </div>
        )}

        {secondaryTab === 'perdcomp' && (
          <PerdcompModule 
            companies={companies} 
            canEdit={userPermissions?.includes('contabil') || ['danilo', 'ryan.santos'].includes(username)} 
          />
        )}
        </div>
      )}

      {activeTab === 'apuracao' && (
        <TaxModule companies={companies} />
      )}

      {activeTab === 'rateio' && (
        <RateioModule companies={companies} />
      )}

      {activeTab === 'cc' && (
        <CentroCustoModule companies={companies} userRole={userRole} userPermissions={userPermissions} username={username} />
      )}

      {activeTab === 'gestao' && (
        <GestaoContabilModule userRole={userRole} userName={localStorage.getItem('agf_session') ? JSON.parse(localStorage.getItem('agf_session')).username : ''} companies={companies} />
      )}

      {isMappingModalOpen && mappingTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#1a1a2e', padding: '2rem', borderRadius: '15px', width: '500px', maxWidth: '90%', border: '1px solid #333' }}>
            <h3 style={{ marginTop: 0, color: 'var(--color-primary)' }}>Mapear Nova Conta</h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#ccc' }}>Conta Base</label>
              <input 
                type="text" 
                value={mappingTarget.conta} 
                onChange={(e) => setMappingTarget({...mappingTarget, conta: e.target.value})}
                className="select-input"
                style={{ width: '100%', padding: '0.8rem' }}
              />
              <small style={{ color: '#888' }}>Dica: Você pode apagar os últimos dígitos para mapear a raiz da conta (ex: 1.3.2.1) e abranger todas as suas filhas.</small>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#ccc' }}>Relatório / Grupo Macro</label>
              <select 
                className="select-input" 
                style={{ width: '100%', padding: '0.8rem' }}
                value={mappingTarget.relatorio || ''}
                onChange={(e) => setMappingTarget({...mappingTarget, relatorio: e.target.value, grupo: '', subgrupo: ''})}
              >
                <option value="">Selecione...</option>
                {Object.keys(mergedMapping).map(k => (
                  <option key={k} value={k}>{k.toUpperCase()}</option>
                ))}
              </select>
            </div>
            
            {mappingTarget.relatorio && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#ccc' }}>Linha / Grupo</label>
                <select 
                  className="select-input" 
                  style={{ width: '100%', padding: '0.8rem' }}
                  value={mappingTarget.grupo || ''}
                  onChange={(e) => setMappingTarget({...mappingTarget, grupo: e.target.value, subgrupo: ''})}
                >
                  <option value="">Selecione...</option>
                  {Object.keys(mergedMapping[mappingTarget.relatorio] || {}).map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
            )}

            {mappingTarget.relatorio && mappingTarget.grupo && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#ccc' }}>Subgrupo Específico</label>
                <select 
                  className="select-input" 
                  style={{ width: '100%', padding: '0.8rem' }}
                  value={mappingTarget.subgrupo || ''}
                  onChange={(e) => setMappingTarget({...mappingTarget, subgrupo: e.target.value})}
                >
                  <option value="">Selecione...</option>
                  {Object.keys(mergedMapping[mappingTarget.relatorio][mappingTarget.grupo] || {}).map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setIsMappingModalOpen(false)}>Cancelar</button>
              <button 
                className="btn-primary" 
                onClick={async () => {
                  if (!mappingTarget.conta || !mappingTarget.relatorio || !mappingTarget.grupo || !mappingTarget.subgrupo) {
                    window.$alert("Preencha todos os campos!");
                    return;
                  }
                  
                  const newMap = JSON.parse(JSON.stringify(customMappings));
                  if (!newMap[mappingTarget.relatorio]) newMap[mappingTarget.relatorio] = {};
                  if (!newMap[mappingTarget.relatorio][mappingTarget.grupo]) newMap[mappingTarget.relatorio][mappingTarget.grupo] = {};
                  if (!newMap[mappingTarget.relatorio][mappingTarget.grupo][mappingTarget.subgrupo]) newMap[mappingTarget.relatorio][mappingTarget.grupo][mappingTarget.subgrupo] = [];
                  
                  if (!newMap[mappingTarget.relatorio][mappingTarget.grupo][mappingTarget.subgrupo].includes(mappingTarget.conta)) {
                      newMap[mappingTarget.relatorio][mappingTarget.grupo][mappingTarget.subgrupo].push(mappingTarget.conta);
                  }
                  
                  setCustomMappings(newMap);
                  
                  try {
await supabase.from("settings").upsert({ key: "customMapping", value: JSON.stringify(newMap) });
                      
                      // RELOAD DATA AFTER SAVE
                      loadPanelData();
                  } catch(e) {
                      console.error("Erro salvando", e);
                  }
                  
                  setIsMappingModalOpen(false);
                }}
              >
                Salvar Mapeamento
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default ProtheusModule;
