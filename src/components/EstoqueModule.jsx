import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, AlertTriangle, TrendingUp, TrendingDown, DollarSign, 
  FileSpreadsheet, Database, Filter, Search, Download, CheckCircle, CheckCircle2, 
  Layers, UserCheck, ShieldAlert, ArrowUpRight, BarChart3, PieChart as PieIcon,
  RefreshCw, Info, Calendar, Building2, HelpCircle, GitBranch, PlusCircle
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  Legend, Cell, PieChart, Pie, AreaChart, Area, CartesianGrid 
} from 'recharts';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';
import { getSettings, saveSettings } from '../utils/db';

const CRITICAL_TMS = {
  '506': { label: '506 - Inventário (Saída)', color: '#ef5350', bg: 'rgba(239, 83, 80, 0.15)', group: 'inventario' },
  '006': { label: '006 - Inventário (Entrada)', color: '#26a69a', bg: 'rgba(38, 166, 154, 0.15)', group: 'inventario' },
  '509': { label: '509 - Baixa Justificada Garantia', color: '#ab47bc', bg: 'rgba(171, 71, 188, 0.15)', group: 'garantia' },
  '507': { label: '507 - Perda de Material', color: '#ff7043', bg: 'rgba(255, 112, 67, 0.15)', group: 'perda' },
  '504': { label: '504 - Baixa Consumível', color: '#42a5f5', bg: 'rgba(66, 165, 245, 0.15)', group: 'consumivel' },
};

const COLORS_CHART = ['#ef5350', '#26a69a', '#ab47bc', '#ff7043', '#42a5f5', '#ffa726', '#8d6e63', '#78909c'];

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function EstoqueModule({ companies = [], userRole, userPermissions = [], username }) {
  const isSuper = (['danilo', 'ryan.santos'].includes(username)) || userRole === 'admin' || userRole === 'superadmin';
  const canAccessDB = isSuper || userPermissions.includes('db');

  // Main Tabs: 'dash' (Painel Executivo), 'desvios' (Análise de Desvios), 'lancamentos' (Lista Detalhada), 'import' (Banco de Dados)
  const [activeTab, setActiveTab] = useState('dash');

  // Competência e Filtros
  const [selectedEmpresa, setSelectedEmpresa] = useState('todas');
  const [selectedFilial, setSelectedFilial] = useState('todas');
  const [selectedAno, setSelectedAno] = useState(new Date().getFullYear());
  const [selectedMes, setSelectedMes] = useState(new Date().getMonth() + 1);
  const [filtroTM, setFiltroTM] = useState('criticos'); // 'criticos' (4 grupos), '506_006', '509', '507', '504', 'todos'
  const [filtroApenasSemOP, setFiltroApenasSemOP] = useState(true); // Excluir OPs por padrão
  const [filtroStatusDesvio, setFiltroStatusDesvio] = useState('todos'); // 'todos', 'critico', 'atencao', 'normal'
  const [searchQuery, setSearchQuery] = useState('');
  const [toleranciaDesvioPct, setToleranciaDesvioPct] = useState(30); // 30% acima da média
  
  // Dados Carregados
  const [currentRecords, setCurrentRecords] = useState([]);
  const [historySeries, setHistorySeries] = useState({}); // { mes: records[] }
  const [savedCompetencias, setSavedCompetencias] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Import State (Suporte a múltiplos arquivos / filiais)
  const [importFilesList, setImportFilesList] = useState([]);
  const [importFileData, setImportFileData] = useState(null);
  const [importEmpresa, setImportEmpresa] = useState(companies[0]?.id || 'AGF');
  const [importAno, setImportAno] = useState(new Date().getFullYear());
  const [importMes, setImportMes] = useState(new Date().getMonth() + 1);
  const [importMode, setImportMode] = useState('replace'); // 'replace' | 'append'
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [previewStats, setPreviewStats] = useState(null);

  // Modal de Detalhes de Item
  const [selectedItemForModal, setSelectedItemForModal] = useState(null);

  // Carregar lista de competências salvas ao montar
  useEffect(() => {
    loadSavedCompetencias();
  }, []);

  // Recarregar dados sempre que Empresa, Ano ou Mês mudarem
  useEffect(() => {
    loadEstoqueData();
  }, [selectedEmpresa, selectedAno, selectedMes]);

  const loadSavedCompetencias = async () => {
    try {
      const compList = await getSettings('agf_estoque_competencias');
      if (Array.isArray(compList)) {
        setSavedCompetencias(compList);
      } else {
        setSavedCompetencias([]);
      }
    } catch (e) {
      console.error('Erro ao carregar competências de estoque:', e);
    }
  };

  const loadEstoqueData = async () => {
    setIsLoading(true);
    try {
      const seriesMap = {};
      const empList = (selectedEmpresa === 'todas' || selectedEmpresa === 'consolidado') 
        ? companies.map(c => c.id) 
        : [selectedEmpresa];

      for (let m = 1; m <= 12; m++) {
        let monthRecords = [];
        for (const emp of empList) {
          const key = `agf_estoque_${emp}_${selectedAno}_${m}`;
          const data = await getSettings(key);
          if (Array.isArray(data) && data.length > 0) {
            monthRecords = monthRecords.concat(data.map(d => ({ ...d, empresaId: emp })));
          }
        }
        if (monthRecords.length > 0) {
          seriesMap[m] = monthRecords;
        }
      }

      setHistorySeries(seriesMap);
      setCurrentRecords(seriesMap[selectedMes] || []);
    } catch (e) {
      console.error('Erro ao carregar dados de estoque:', e);
      setCurrentRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Extrair nome da Filial do nome do arquivo ou cabeçalho
  const extractFilialName = (filename) => {
    const clean = filename.replace(/\.[^/.]+$/, '').trim();
    const lower = clean.toLowerCase();
    
    // Tenta encontrar padrões como "Filial 01", "Filial 1", "F01", "Matriz", "SP", "RJ", etc.
    const matchFilial = clean.match(/filial[\s_-]?(\d+|[a-zA-Z0-9]+)/i);
    if (matchFilial) return `Filial ${matchFilial[1]}`.toUpperCase();

    const matchF = clean.match(/\bF(\d{1,2})\b/i);
    if (matchF) return `Filial ${matchF[1].padStart(2, '0')}`.toUpperCase();

    if (lower.includes('matriz')) return 'MATRIZ';
    
    return clean.toUpperCase();
  };

  // Parsing de Múltiplos Arquivos de Filiais do Protheus
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setImportFilesList(files);
    setIsProcessingImport(true);

    try {
      const allParsedRecords = [];
      const fileSummaries = [];

      for (let fIdx = 0; fIdx < files.length; fIdx++) {
        const file = files[fIdx];
        const defaultFilial = extractFilialName(file.name);

        const dataBuffer = await file.arrayBuffer();
        const wb = XLSX.read(dataBuffer, { type: 'array', cellDates: true });

        let sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('moviment') || n.toLowerCase().includes('item')) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (!rawJson || rawJson.length < 2) continue;

        // Localizar linha de cabeçalho
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(10, rawJson.length); i++) {
          const rowStr = rawJson[i].map(c => (c || '').toString().toLowerCase()).join(' ');
          if (rowStr.includes('produto') && (rowStr.includes('custo') || rowStr.includes('movimento') || rowStr.includes('saida') || rowStr.includes('entrada'))) {
            headerRowIdx = i;
            break;
          }
        }

        if (headerRowIdx === -1) {
          headerRowIdx = rawJson[1] && rawJson[1].length > 5 ? 1 : 0;
        }

        const headers = rawJson[headerRowIdx].map(h => (h || '').toString().trim());
        const norm = (s) => (s || '').toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        let idxFilial = -1, idxProd = -1, idxDesc = -1, idxTipo = -1, idxGrupo = -1, idxUm = -1;
        let idxArm = -1, idxEntrada = -1, idxSaida = -1, idxCustoUnit = -1, idxCustoTot = -1;
        let idxTM = -1, idxTipoREDE = -1, idxOP = -1, idxItemDoc = -1, idxSeq = -1;
        let idxCC = -1, idxConta = -1, idxDoc = -1, idxData = -1, idxUser = -1;

        headers.forEach((h, idx) => {
          const n = norm(h);
          if (idxFilial === -1 && (n === 'filial' || n === 'fil.' || n === 'cod. filial' || n === 'unidade')) idxFilial = idx;
          else if (idxProd === -1 && (n === 'produto' || n === 'cod. produto' || n === 'codigo' || n === 'cod produto')) idxProd = idx;
          else if (idxDesc === -1 && (n.includes('desc') || n.includes('produto desc') || n === 'descricao')) idxDesc = idx;
          else if (idxTipo === -1 && n === 'tipo') idxTipo = idx;
          else if (idxGrupo === -1 && n === 'grupo') idxGrupo = idx;
          else if (idxUm === -1 && (n === 'unidade' || n === 'um' || n === 'u.m.')) idxUm = idx;
          else if (idxArm === -1 && (n.includes('armaz') || n === 'local' || n === 'almox')) idxArm = idx;
          else if (idxEntrada === -1 && (n.includes('entrada') || n === 'qtd entrada')) idxEntrada = idx;
          else if (idxSaida === -1 && (n.includes('saida') || n === 'qtd saida')) idxSaida = idx;
          else if (idxCustoUnit === -1 && (n.includes('unit') || n === 'custo unitario' || n === 'custo unit')) idxCustoUnit = idx;
          else if (idxCustoTot === -1 && (n.includes('custo total') || n === 'total' || n === 'vl total' || n === 'custo tot' || n === 'valor total')) idxCustoTot = idx;
          else if (idxTM === -1 && (n.includes('tp movimento') || n.includes('tipo mov') || n === 'tm' || n === 'tp. mov' || n === 'tp.mov.')) idxTM = idx;
          else if (idxTipoREDE === -1 && (n.includes('re/de') || n.includes('tipo re/de'))) idxTipoREDE = idx;
          else if (idxOP === -1 && (n.includes('ordem producao') || n.includes('ordem de producao') || n === 'op' || n === 'ordem produçao')) idxOP = idx;
          else if (idxItemDoc === -1 && (n.includes('item doc') || n.includes('item op'))) idxItemDoc = idx;
          else if (idxSeq === -1 && n.includes('sequencial')) idxSeq = idx;
          else if (idxCC === -1 && (n.includes('c.custo') || n.includes('centro de custo') || n === 'cc')) idxCC = idx;
          else if (idxConta === -1 && (n.includes('c.contabil') || n.includes('conta contabil') || n === 'conta')) idxConta = idx;
          else if (idxDoc === -1 && (n === 'documento' || n === 'doc' || n === 'num doc')) idxDoc = idx;
          else if (idxData === -1 && (n.includes('emissao') || n.includes('data') || n === 'dt emissao')) idxData = idx;
          else if (idxUser === -1 && (n.includes('usuario') || n.includes('user') || n === 'responsavel')) idxUser = idx;
        });

        // Fallbacks por posição caso cabeçalho padrão
        if (idxProd === -1) idxProd = 1;
        if (idxDesc === -1) idxDesc = 2;
        if (idxTipo === -1) idxTipo = 3;
        if (idxGrupo === -1) idxGrupo = 4;
        if (idxUm === -1) idxUm = 5;
        if (idxArm === -1) idxArm = 6;
        if (idxEntrada === -1) idxEntrada = 7;
        if (idxSaida === -1) idxSaida = 8;
        if (idxCustoUnit === -1) idxCustoUnit = 9;
        if (idxCustoTot === -1) idxCustoTot = 10;
        if (idxTM === -1) idxTM = 11;
        if (idxTipoREDE === -1) idxTipoREDE = 12;
        if (idxOP === -1) idxOP = 13;
        if (idxCC === -1) idxCC = 16;
        if (idxConta === -1) idxConta = 17;
        if (idxDoc === -1) idxDoc = 18;
        if (idxData === -1) idxData = 19;
        if (idxUser === -1) idxUser = 20;

        const parseNum = (val) => {
          if (val === null || val === undefined || val === '' || val === '-') return 0;
          if (typeof val === 'number') return val;
          let s = val.toString().trim().replace('R$', '').replace(/\s/g, '');
          if (s.includes(',') && s.includes('.')) {
            s = s.replace(/\./g, '').replace(',', '.');
          } else if (s.includes(',')) {
            s = s.replace(',', '.');
          }
          const num = parseFloat(s);
          return isNaN(num) ? 0 : num;
        };

        let fileVal = 0;
        let fileRecordsCount = 0;

        for (let r = headerRowIdx + 1; r < rawJson.length; r++) {
          const row = rawJson[r];
          if (!row || row.length === 0) continue;

          const prod = (row[idxProd] || '').toString().trim();
          const desc = (row[idxDesc] || '').toString().trim();
          if (!prod && !desc) continue;

          const tmRaw = (row[idxTM] || '').toString().trim().padStart(3, '0');
          const tm = tmRaw === '000' ? '' : tmRaw;
          const opRaw = (row[idxOP] || '').toString().trim();
          const hasOP = !!opRaw && opRaw !== '-' && opRaw !== '0' && opRaw !== '000000';

          const qtdEntrada = parseNum(row[idxEntrada]);
          const qtdSaida = parseNum(row[idxSaida]);
          const custoUnit = parseNum(row[idxCustoUnit]);
          const custoTot = parseNum(row[idxCustoTot]);

          let rowFilial = defaultFilial;
          if (idxFilial !== -1 && row[idxFilial]) {
            rowFilial = row[idxFilial].toString().trim();
          }

          let dtEmissao = row[idxData];
          if (dtEmissao instanceof Date) {
            dtEmissao = dtEmissao.toLocaleDateString('pt-BR');
          } else {
            dtEmissao = (dtEmissao || '').toString().trim();
          }

          const record = {
            id: `mov_${fIdx}_${r}_${prod}_${Date.now()}`,
            filial: rowFilial,
            arquivoOrigem: file.name,
            produto: prod,
            descricao: desc,
            tipo: (row[idxTipo] || '').toString().trim(),
            grupo: (row[idxGrupo] || '').toString().trim(),
            unidade: (row[idxUm] || '').toString().trim(),
            armazem: (row[idxArm] || '').toString().trim(),
            qtdEntrada,
            qtdSaida,
            custoUnitario: custoUnit,
            custoTotal: custoTot,
            tm,
            tipoREDE: (row[idxTipoREDE] || '').toString().trim(),
            op: opRaw,
            hasOP,
            cc: (row[idxCC] || '').toString().trim(),
            contaContabil: (row[idxConta] || '').toString().trim(),
            documento: (row[idxDoc] || '').toString().trim(),
            dtEmissao,
            usuario: (row[idxUser] || '').toString().trim()
          };

          allParsedRecords.push(record);
          fileVal += custoTot;
          fileRecordsCount++;
        }

        fileSummaries.push({
          filename: file.name,
          filial: defaultFilial,
          linhas: fileRecordsCount,
          valor: fileVal
        });
      }

      const totalVal = allParsedRecords.reduce((acc, r) => acc + r.custoTotal, 0);
      const countSemOP = allParsedRecords.filter(r => !r.hasOP).length;
      const countComOP = allParsedRecords.filter(r => r.hasOP).length;

      setImportFileData(allParsedRecords);
      setPreviewStats({
        arquivos: fileSummaries,
        totalLinhas: allParsedRecords.length,
        totalValor: totalVal,
        countSemOP,
        countComOP,
        filiaisIdentificadas: Array.from(new Set(allParsedRecords.map(r => r.filial).filter(Boolean))),
        tmsEncontrados: Array.from(new Set(allParsedRecords.map(r => r.tm).filter(Boolean)))
      });

      window.$toast(`${files.length} arquivo(s) de filial lidos com sucesso! Total: ${allParsedRecords.length} movimentações.`, { type: 'success' });
    } catch (err) {
      console.error('Erro ao ler planilhas:', err);
      window.$alert('Falha ao processar arquivos de filial: ' + err.message);
    } finally {
      setIsProcessingImport(false);
    }
  };

  const handleSaveImportToDB = async () => {
    if (!importFileData || importFileData.length === 0) {
      window.$alert('Nenhum dado importado para salvar.');
      return;
    }

    const storageKey = `agf_estoque_${importEmpresa}_${importAno}_${importMes}`;
    let finalRecordsToSave = importFileData;

    // Se o usuário optar por anexar / acumular com os dados já existentes do mês
    if (importMode === 'append') {
      const existingData = await getSettings(storageKey);
      if (Array.isArray(existingData) && existingData.length > 0) {
        // Remover duplicados pelo hash (produto, documento, data, custoTotal, filial)
        const existingKeys = new Set(existingData.map(r => `${r.filial}_${r.produto}_${r.documento}_${r.dtEmissao}_${r.custoTotal}`));
        const newRecords = importFileData.filter(r => !existingKeys.has(`${r.filial}_${r.produto}_${r.documento}_${r.dtEmissao}_${r.custoTotal}`));
        finalRecordsToSave = existingData.concat(newRecords);
      }
    }

    const ok = await window.$confirm(
      `Confirma a gravação dos dados de estoque?\n\n` +
      `Empresa: ${companies.find(c => c.id === importEmpresa)?.name || importEmpresa}\n` +
      `Competência: ${MESES[importMes - 1]} / ${importAno}\n` +
      `Modo: ${importMode === 'append' ? '➕ Acumular com dados existentes' : '🔄 Substituir competência'}\n` +
      `Arquivos de Filial: ${previewStats?.arquivos?.length || 1}\n` +
      `Total de Movimentações: ${finalRecordsToSave.length}\n` +
      `Valor Total: ${finalRecordsToSave.reduce((acc, r) => acc + r.custoTotal, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      { title: 'Gravar Movimento de Estoque por Filial' }
    );

    if (!ok) return;

    setIsProcessingImport(true);
    try {
      await saveSettings(storageKey, finalRecordsToSave);

      // Atualizar lista de competências salvas
      const compKey = `${importEmpresa}_${importAno}_${importMes}`;
      const existing = savedCompetencias.filter(c => c.id !== compKey);
      const updatedCompList = [
        ...existing,
        {
          id: compKey,
          empresaId: importEmpresa,
          ano: importAno,
          mes: importMes,
          filiais: Array.from(new Set(finalRecordsToSave.map(r => r.filial).filter(Boolean))),
          totalRecords: finalRecordsToSave.length,
          totalValor: finalRecordsToSave.reduce((acc, r) => acc + r.custoTotal, 0),
          updatedAt: new Date().toISOString()
        }
      ];

      await saveSettings('agf_estoque_competencias', updatedCompList);
      setSavedCompetencias(updatedCompList);

      window.$toast('Movimentações de Estoque salvas com sucesso no banco de dados!', { type: 'success' });
      setImportFilesList([]);
      setImportFileData(null);
      setPreviewStats(null);

      // Selecionar o mês salvo e voltar para o dashboard
      setSelectedEmpresa(importEmpresa);
      setSelectedAno(importAno);
      setSelectedMes(importMes);
      setSelectedFilial('todas');
      setActiveTab('dash');
      loadEstoqueData();
    } catch (e) {
      console.error('Erro ao salvar no banco:', e);
      window.$alert('Erro ao gravar no banco: ' + e.message);
    } finally {
      setIsProcessingImport(false);
    }
  };

  const handleDeleteCompetencia = async (compItem) => {
    const ok = await window.$confirm(
      `Tem certeza que deseja excluir as movimentações de estoque desta competência?\n\n` +
      `Empresa: ${companies.find(c => c.id === compItem.empresaId)?.name || compItem.empresaId}\n` +
      `Período: ${MESES[compItem.mes - 1]} / ${compItem.ano}`,
      { title: 'Excluir Competência de Estoque' }
    );
    if (!ok) return;

    try {
      const storageKey = `agf_estoque_${compItem.empresaId}_${compItem.ano}_${compItem.mes}`;
      await saveSettings(storageKey, []);

      const updated = savedCompetencias.filter(c => c.id !== compItem.id);
      await saveSettings('agf_estoque_competencias', updated);
      setSavedCompetencias(updated);

      window.$toast('Competência excluída com sucesso!', { type: 'success' });
      loadEstoqueData();
    } catch (e) {
      console.error('Erro ao excluir:', e);
      window.$alert('Erro ao excluir: ' + e.message);
    }
  };

  // Lista de Filiais presentes nas movimentações do mês atual
  const availableFiliais = useMemo(() => {
    const filiaisSet = new Set();
    currentRecords.forEach(r => {
      if (r.filial) filiaisSet.add(r.filial);
    });
    return Array.from(filiaisSet).sort();
  }, [currentRecords]);

  // -------------------------------------------------------------
  // MOTOR DE CÁLCULO E ANÁLISE DE DESVIOS (MÉDIA POR MOVIMENTO)
  // -------------------------------------------------------------
  const {
    filteredRecordsCurrent,
    kpis,
    analysisByProduct,
    chartEvolucaoTM,
    chartDistribuicaoTM,
    topDesvios,
    chartCC,
    chartFiliais,
    chartUsuarios
  } = useMemo(() => {
    // 1. Filtrar registros do mês atual conforme opções
    const isCriticalTM = (tm) => ['506', '006', '509', '507', '504'].includes(tm);

    const filterRecord = (r) => {
      // Regra da OP: se filtroApenasSemOP ativo, op deve ser vazia
      if (filtroApenasSemOP && r.hasOP) return false;

      // Filtro de Filial
      if (selectedFilial !== 'todas' && r.filial !== selectedFilial) return false;

      // Filtro TM
      if (filtroTM === 'criticos' && !isCriticalTM(r.tm)) return false;
      if (filtroTM === '506_006' && !['506', '006'].includes(r.tm)) return false;
      if (filtroTM === '509' && r.tm !== '509') return false;
      if (filtroTM === '507' && r.tm !== '507') return false;
      if (filtroTM === '504' && r.tm !== '504') return false;

      // Busca textual
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match = (r.produto && r.produto.toLowerCase().includes(q)) ||
                      (r.descricao && r.descricao.toLowerCase().includes(q)) ||
                      (r.documento && r.documento.toLowerCase().includes(q)) ||
                      (r.filial && r.filial.toLowerCase().includes(q)) ||
                      (r.cc && r.cc.toLowerCase().includes(q)) ||
                      (r.usuario && r.usuario.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    };

    const currentFiltered = currentRecords.filter(filterRecord);

    // 2. Calcular Totais e KPIs do mês atual
    let totalBaixadoMes = 0;
    let totalInventario506 = 0;
    let totalInventario006 = 0;
    let totalGarantia509 = 0;
    let totalPerda507 = 0;
    let totalConsumivel504 = 0;
    let totalOutrosTM = 0;

    currentFiltered.forEach(r => {
      const val = r.custoTotal || 0;
      totalBaixadoMes += val;
      if (r.tm === '506') totalInventario506 += val;
      else if (r.tm === '006') totalInventario006 += val;
      else if (r.tm === '509') totalGarantia509 += val;
      else if (r.tm === '507') totalPerda507 += val;
      else if (r.tm === '504') totalConsumivel504 += val;
      else totalOutrosTM += val;
    });

    // 3. Calcular Histórico e Média por Produto / TM nos meses anteriores
    const productHistoryMap = {};
    const previousMonths = Object.keys(historySeries).map(Number).filter(m => m < selectedMes);
    const numPrevMonths = Math.max(1, previousMonths.length);

    previousMonths.forEach(m => {
      const mRecords = (historySeries[m] || []).filter(r => (!filtroApenasSemOP || !r.hasOP) && (selectedFilial === 'todas' || r.filial === selectedFilial));
      mRecords.forEach(r => {
        const prod = r.produto || r.descricao;
        if (!productHistoryMap[prod]) {
          productHistoryMap[prod] = {
            totalVal: 0,
            monthsWithMov: new Set(),
            records: []
          };
        }
        productHistoryMap[prod].totalVal += (r.custoTotal || 0);
        productHistoryMap[prod].monthsWithMov.add(m);
        productHistoryMap[prod].records.push(r);
      });
    });

    // 4. Agrupamento por Produto no mês atual com comparação com a Média
    const currentProductMap = {};
    currentFiltered.forEach(r => {
      const prod = r.produto || r.descricao;
      if (!currentProductMap[prod]) {
        currentProductMap[prod] = {
          produto: r.produto,
          descricao: r.descricao,
          tipo: r.tipo,
          grupo: r.grupo,
          armazem: r.armazem,
          filiais: new Set(),
          tms: new Set(),
          qtdEntrada: 0,
          qtdSaida: 0,
          custoTotalMes: 0,
          lancamentos: []
        };
      }
      if (r.filial) currentProductMap[prod].filiais.add(r.filial);
      if (r.tm) currentProductMap[prod].tms.add(r.tm);
      currentProductMap[prod].qtdEntrada += (r.qtdEntrada || 0);
      currentProductMap[prod].qtdSaida += (r.qtdSaida || 0);
      currentProductMap[prod].custoTotalMes += (r.custoTotal || 0);
      currentProductMap[prod].lancamentos.push(r);
    });

    let countCriticos = 0;
    let countAtencao = 0;
    let countNormal = 0;
    let countNovos = 0;

    const analysisRows = Object.values(currentProductMap).map(item => {
      const hist = productHistoryMap[item.produto] || productHistoryMap[item.descricao];
      const hasHistory = !!hist && hist.totalVal > 0;
      
      const mediaHistorica = hasHistory ? (hist.totalVal / numPrevMonths) : 0;
      
      // Se não há histórico prévio (média zero), não há desvio/variação: é apenas um item novo
      const desvioValor = hasHistory ? (item.custoTotalMes - mediaHistorica) : 0;
      const desvioPct = (hasHistory && mediaHistorica > 0)
        ? ((item.custoTotalMes - mediaHistorica) / mediaHistorica) * 100 
        : 0;

      let status = 'normal';
      let statusLabel = 'Normal';
      let statusBadgeColor = '#4caf50';

      if (!hasHistory) {
        status = 'novo';
        statusLabel = '🆕 Item Novo';
        statusBadgeColor = '#29b6f6';
        countNovos++;
      } else if (desvioPct > 100 || (desvioValor > 2000 && desvioPct > toleranciaDesvioPct)) {
        status = 'critico';
        statusLabel = `⚠️ Crítico (+${desvioPct.toFixed(0)}%)`;
        statusBadgeColor = '#ef5350';
        countCriticos++;
      } else if (desvioPct > toleranciaDesvioPct) {
        status = 'atencao';
        statusLabel = `Atenção (+${desvioPct.toFixed(0)}%)`;
        statusBadgeColor = '#ffa726';
        countAtencao++;
      } else {
        countNormal++;
      }

      const tmsArr = Array.from(item.tms);
      const filiaisArr = Array.from(item.filiais);

      return {
        ...item,
        tmsArr,
        filiaisArr,
        hasHistory,
        mediaHistorica,
        desvioValor,
        desvioPct,
        status,
        statusLabel,
        statusBadgeColor
      };
    });

    // Ordenar produtos: itens com histórico de desvio primeiro (maior desvio em R$), depois os demais
    analysisRows.sort((a, b) => {
      if (a.status === 'novo' && b.status !== 'novo') return 1;
      if (b.status === 'novo' && a.status !== 'novo') return -1;
      return b.desvioValor - a.desvioValor;
    });

    // Filtrar linhas por status de desvio se solicitado
    const filteredAnalysisRows = analysisRows.filter(r => {
      if (filtroStatusDesvio === 'todos') return true;
      return r.status === filtroStatusDesvio;
    });

    // Top 10 maiores desvios em R$ (Apenas itens com histórico prévio que ultrapassaram a média)
    const topDesviosList = analysisRows
      .filter(r => r.hasHistory && r.mediaHistorica > 0 && r.desvioValor > 0)
      .slice(0, 10);

    // 5. Gráfico de Evolução Histórica das Baixas por TM (Mês a Mês do Ano)
    const evolucaoData = [];
    for (let m = 1; m <= 12; m++) {
      const mRecs = (historySeries[m] || []).filter(r => (!filtroApenasSemOP || !r.hasOP) && (selectedFilial === 'todas' || r.filial === selectedFilial));
      if (mRecs.length > 0 || m <= selectedMes) {
        let inv = 0, gar = 0, perd = 0, cons = 0, out = 0, total = 0;
        mRecs.forEach(r => {
          const v = r.custoTotal || 0;
          total += v;
          if (r.tm === '506' || r.tm === '006') inv += v;
          else if (r.tm === '509') gar += v;
          else if (r.tm === '507') perd += v;
          else if (r.tm === '504') cons += v;
          else out += v;
        });

        evolucaoData.push({
          mesNum: m,
          mesNome: MESES[m - 1].substring(0, 3),
          'Inventário (506/006)': inv,
          'Garantia (509)': gar,
          'Perda Mat. (507)': perd,
          'Consumível (504)': cons,
          'Outros TMs': out,
          total
        });
      }
    }

    // 6. Gráfico de Distribuição por TM no mês atual
    const distTM = [
      { name: '506 Inventário', valor: totalInventario506, fill: CRITICAL_TMS['506'].color },
      { name: '006 Entrada Inv.', valor: totalInventario006, fill: CRITICAL_TMS['006'].color },
      { name: '509 Garantia', valor: totalGarantia509, fill: CRITICAL_TMS['509'].color },
      { name: '507 Perda Material', valor: totalPerda507, fill: CRITICAL_TMS['507'].color },
      { name: '504 Consumível', valor: totalConsumivel504, fill: CRITICAL_TMS['504'].color },
    ].filter(d => d.valor > 0);

    if (totalOutrosTM > 0) {
      distTM.push({ name: 'Outros TMs', valor: totalOutrosTM, fill: '#78909c' });
    }

    // 7. Distribuição por Filial
    const filialMap = {};
    currentFiltered.forEach(r => {
      const f = r.filial || 'Sem Filial';
      filialMap[f] = (filialMap[f] || 0) + (r.custoTotal || 0);
    });
    const distFiliais = Object.entries(filialMap)
      .map(([filial, valor]) => ({ filial, valor }))
      .sort((a, b) => b.valor - a.valor);

    // 8. Distribuição por Centro de Custo
    const ccMap = {};
    currentFiltered.forEach(r => {
      const cc = r.cc || 'Sem CC';
      ccMap[cc] = (ccMap[cc] || 0) + (r.custoTotal || 0);
    });
    const distCC = Object.entries(ccMap)
      .map(([cc, valor]) => ({ cc, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    // 9. Distribuição por Usuário
    const userMap = {};
    currentFiltered.forEach(r => {
      const u = r.usuario || 'Outros';
      userMap[u] = (userMap[u] || 0) + (r.custoTotal || 0);
    });
    const distUsers = Object.entries(userMap)
      .map(([usuario, valor]) => ({ usuario, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    return {
      filteredRecordsCurrent: currentFiltered,
      kpis: {
        totalBaixadoMes,
        totalInventario506,
        totalInventario006,
        totalGarantia509,
        totalPerda507,
        totalConsumivel504,
        totalOutrosTM,
        countCriticos,
        countAtencao,
        countNormal,
        countNovos,
        totalItens: Object.keys(currentProductMap).length,
        numPrevMonths: previousMonths.length
      },
      analysisByProduct: filteredAnalysisRows,
      chartEvolucaoTM: evolucaoData,
      chartDistribuicaoTM: distTM,
      topDesvios: topDesviosList,
      chartCC: distCC,
      chartFiliais: distFiliais,
      chartUsuarios: distUsers
    };
  }, [currentRecords, historySeries, selectedMes, selectedFilial, filtroTM, filtroApenasSemOP, filtroStatusDesvio, searchQuery, toleranciaDesvioPct]);

  // Exportar Relatório para Excel
  const handleExportExcel = () => {
    try {
      const exportData = analysisByProduct.map(r => ({
        'Filial(is)': r.filiaisArr.join(', ') || 'MATRIZ',
        'Código Produto': r.produto,
        'Descrição': r.descricao,
        'Tipo': r.tipo,
        'Grupo': r.grupo,
        'Armazém': r.armazem,
        'TMs Movimentados': r.tmsArr.join(', '),
        'Qtd Entrada': r.qtdEntrada,
        'Qtd Saída': r.qtdSaida,
        'Custo Total Mês (R$)': r.custoTotalMes,
        'Média Histórica Mensal (R$)': r.hasHistory ? r.mediaHistorica : 0,
        'Desvio em Valor (R$)': r.hasHistory ? r.desvioValor : 0,
        'Variação % vs Média': r.hasHistory ? `${r.desvioPct.toFixed(1)}%` : 'Item Novo',
        'Status do Desvio': r.statusLabel,
        'Qtd Lançamentos': r.lancamentos.length
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Analise_Estoque_Desvios');
      const filename = `Analise_Estoque_Movimento_${MESES[selectedMes - 1]}_${selectedAno}.xlsx`;
      XLSX.writeFile(wb, filename);
      window.$toast('Relatório exportado para Excel com sucesso!', { type: 'success' });
    } catch (e) {
      console.error(e);
      window.$alert('Erro ao exportar Excel: ' + e.message);
    }
  };

  return (
    <div style={{ padding: '0 0.5rem', minHeight: '80vh' }}>
      
      {/* HEADER PRINCIPAL COM SELEÇÃO DE ABAS & CONTROLES */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(20, 24, 38, 0.95), rgba(15, 17, 26, 0.98))',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '14px',
        padding: '1.2rem 1.5rem',
        marginBottom: '1.5rem',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
      }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #2196F3, #1565C0)',
                padding: '8px',
                borderRadius: '10px',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Package size={24} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Análise de Movimento Interno de Estoque
                  <span style={{ fontSize: '0.75rem', background: 'rgba(33, 150, 243, 0.2)', color: '#64B5F6', border: '1px solid rgba(33, 150, 243, 0.4)', padding: '2px 8px', borderRadius: '12px' }}>
                    Multi-Filial & Auditoria por TM
                  </span>
                </h2>
                <p style={{ margin: '3px 0 0 0', color: '#888', fontSize: '0.82rem' }}>
                  Consolidação de filiais, inventário (506/006), garantias (509), perdas (507), consumíveis (504) e médias
                </p>
              </div>
            </div>
          </div>

          {/* NAVEGAÇÃO DE ABAS */}
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.4)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setActiveTab('dash')}
              style={{
                background: activeTab === 'dash' ? '#2196F3' : 'transparent',
                color: activeTab === 'dash' ? '#fff' : '#aaa',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '7px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <BarChart3 size={16} /> Painel & Alertas
            </button>

            <button
              onClick={() => setActiveTab('desvios')}
              style={{
                background: activeTab === 'desvios' ? '#2196F3' : 'transparent',
                color: activeTab === 'desvios' ? '#fff' : '#aaa',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '7px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <ShieldAlert size={16} /> Análise de Desvios
              {kpis.countCriticos > 0 && (
                <span style={{ background: '#ef5350', color: '#fff', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px' }}>
                  {kpis.countCriticos}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('lancamentos')}
              style={{
                background: activeTab === 'lancamentos' ? '#2196F3' : 'transparent',
                color: activeTab === 'lancamentos' ? '#fff' : '#aaa',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '7px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <Layers size={16} /> Lançamentos ({filteredRecordsCurrent.length})
            </button>

            {canAccessDB && (
              <button
                onClick={() => setActiveTab('import')}
                style={{
                  background: activeTab === 'import' ? '#FF9800' : 'transparent',
                  color: activeTab === 'import' ? '#000' : '#aaa',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '7px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.86rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <Database size={16} /> Banco de Dados / Importar Filiais
              </button>
            )}
          </div>
        </div>

        {/* BARRA DE FILTROS SUPERIORES */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          paddingTop: '0.8rem',
          borderTop: '1px solid rgba(255,255,255,0.08)'
        }}>
          {/* Empresa */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={16} style={{ color: '#64B5F6' }} />
            <select
              value={selectedEmpresa}
              onChange={(e) => { setSelectedEmpresa(e.target.value); setSelectedFilial('todas'); }}
              className="select-input"
              style={{ minWidth: '170px', padding: '0.45rem 0.7rem', fontSize: '0.85rem' }}
            >
              <option value="todas">TODAS AS EMPRESAS</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Filtro de Filial (se houver filiais registradas) */}
          {availableFiliais.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <GitBranch size={16} style={{ color: '#81C784' }} />
              <select
                value={selectedFilial}
                onChange={(e) => setSelectedFilial(e.target.value)}
                className="select-input"
                style={{ minWidth: '150px', padding: '0.45rem 0.7rem', fontSize: '0.85rem', borderColor: '#81C784' }}
              >
                <option value="todas">TODAS AS FILIAIS ({availableFiliais.length})</option>
                {availableFiliais.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          )}

          {/* Mês & Ano */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} style={{ color: '#64B5F6' }} />
            <select
              value={selectedMes}
              onChange={(e) => setSelectedMes(parseInt(e.target.value))}
              className="select-input"
              style={{ width: '135px', padding: '0.45rem 0.7rem', fontSize: '0.85rem' }}
            >
              {MESES.map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>{m}</option>
              ))}
            </select>

            <select
              value={selectedAno}
              onChange={(e) => setSelectedAno(parseInt(e.target.value))}
              className="select-input"
              style={{ width: '90px', padding: '0.45rem 0.7rem', fontSize: '0.85rem' }}
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Filtro TM Rápido */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={16} style={{ color: '#FFD54F' }} />
            <select
              value={filtroTM}
              onChange={(e) => setFiltroTM(e.target.value)}
              className="select-input"
              style={{ width: '210px', padding: '0.45rem 0.7rem', fontSize: '0.85rem' }}
            >
              <option value="criticos">🎯 TMs Foco (506/006, 509, 507, 504)</option>
              <option value="506_006">506 / 006 - Ajustes Inventário</option>
              <option value="509">509 - Baixa Garantia</option>
              <option value="507">507 - Perda de Material</option>
              <option value="504">504 - Baixa Consumível</option>
              <option value="todos">Todos os TMs da Planilha</option>
            </select>
          </div>

          {/* Toggle OP (Sem OP = Default) */}
          <label style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: filtroApenasSemOP ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255,255,255,0.05)',
            border: filtroApenasSemOP ? '1px solid rgba(76, 175, 80, 0.4)' : '1px solid rgba(255,255,255,0.1)',
            padding: '0.4rem 0.8rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.82rem',
            color: filtroApenasSemOP ? '#81C784' : '#aaa',
            userSelect: 'none'
          }}>
            <input
              type="checkbox"
              checked={filtroApenasSemOP}
              onChange={(e) => setFiltroApenasSemOP(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Apenas Sem OP (Baixas Avulsas)</span>
          </label>

          {/* Tolerância de Desvio */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
            <span style={{ fontSize: '0.8rem', color: '#888' }}>Alerta Desvio:</span>
            <select
              value={toleranciaDesvioPct}
              onChange={(e) => setToleranciaDesvioPct(parseInt(e.target.value))}
              className="select-input"
              style={{ width: '95px', padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
            >
              <option value={20}>+20%</option>
              <option value={30}>+30% (Padrão)</option>
              <option value={50}>+50%</option>
              <option value={100}>+100%</option>
            </select>
          </div>

        </div>

      </div>

      {/* ESTADO VAZIO / SEM DADOS */}
      {currentRecords.length === 0 && !isLoading && activeTab !== 'import' && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px dashed rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          padding: '3rem 2rem',
          textAlign: 'center',
          marginBottom: '2rem'
        }}>
          <Package size={48} style={{ color: '#666', marginBottom: '1rem' }} />
          <h3 style={{ color: '#fff', margin: '0 0 0.5rem 0' }}>
            Nenhuma movimentação de estoque encontrada para {MESES[selectedMes - 1]} / {selectedAno}
          </h3>
          <p style={{ color: '#888', maxWidth: '540px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
            Importe as planilhas de filiais do Protheus na aba "Banco de Dados / Importar Filiais" (você pode selecionar todos os arquivos de uma vez só!).
          </p>
          {canAccessDB && (
            <button
              onClick={() => setActiveTab('import')}
              className="action-btn"
              style={{ padding: '0.6rem 1.2rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <FileSpreadsheet size={16} /> Ir para Importação de Filiais
            </button>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* ABA 1: PAINEL EXECUTIVO & GRÁFICOS */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'dash' && (
        <div>
          
          {/* CARDS KPIS EXECUTIVOS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            
            {/* Card Total Geral */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.15), rgba(20, 24, 38, 0.9))',
              border: '1px solid rgba(33, 150, 243, 0.35)',
              borderRadius: '12px',
              padding: '1.2rem',
              boxShadow: '0 6px 20px rgba(0,0,0,0.3)'
            }}>
              <div style={{ fontSize: '0.8rem', color: '#90CAF9', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Total Baixado no Mês</span>
                <DollarSign size={16} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#fff', margin: '0.5rem 0 0.2rem 0' }}>
                {kpis.totalBaixadoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#aaa' }}>
                {filteredRecordsCurrent.length} movimentações no período {selectedFilial !== 'todas' ? `(${selectedFilial})` : ''}
              </div>
            </div>

            {/* Card 506/006 Inventário */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(239, 83, 80, 0.12), rgba(20, 24, 38, 0.9))',
              border: '1px solid rgba(239, 83, 80, 0.3)',
              borderRadius: '12px',
              padding: '1.2rem'
            }}>
              <div style={{ fontSize: '0.8rem', color: '#ef5350', fontWeight: 'bold', textTransform: 'uppercase' }}>
                506 / 006 Inventário
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff', margin: '0.5rem 0 0.2rem 0' }}>
                {kpis.totalInventario506.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#26a69a' }}>
                Entradas (006): +{kpis.totalInventario006.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>

            {/* Card 509 Garantia */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(171, 71, 188, 0.12), rgba(20, 24, 38, 0.9))',
              border: '1px solid rgba(171, 71, 188, 0.3)',
              borderRadius: '12px',
              padding: '1.2rem'
            }}>
              <div style={{ fontSize: '0.8rem', color: '#ce93d8', fontWeight: 'bold', textTransform: 'uppercase' }}>
                509 Baixa Garantia
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff', margin: '0.5rem 0 0.2rem 0' }}>
                {kpis.totalGarantia509.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#aaa' }}>
                Baixas justificadas
              </div>
            </div>

            {/* Card 507 Perda Material */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(255, 112, 67, 0.12), rgba(20, 24, 38, 0.9))',
              border: '1px solid rgba(255, 112, 67, 0.3)',
              borderRadius: '12px',
              padding: '1.2rem'
            }}>
              <div style={{ fontSize: '0.8rem', color: '#ff8a65', fontWeight: 'bold', textTransform: 'uppercase' }}>
                507 Perda de Material
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff', margin: '0.5rem 0 0.2rem 0' }}>
                {kpis.totalPerda507.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#aaa' }}>
                Refugos / Perdas avulsas
              </div>
            </div>

            {/* Card 504 Consumível */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(66, 165, 245, 0.12), rgba(20, 24, 38, 0.9))',
              border: '1px solid rgba(66, 165, 245, 0.3)',
              borderRadius: '12px',
              padding: '1.2rem'
            }}>
              <div style={{ fontSize: '0.8rem', color: '#90caf9', fontWeight: 'bold', textTransform: 'uppercase' }}>
                504 Baixa Consumível
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff', margin: '0.5rem 0 0.2rem 0' }}>
                {kpis.totalConsumivel504.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#aaa' }}>
                Materiais consumíveis
              </div>
            </div>

            {/* Card Alertas Fora da Média */}
            <div 
              onClick={() => setActiveTab('desvios')}
              style={{
                background: kpis.countCriticos > 0 
                  ? 'linear-gradient(135deg, rgba(239, 83, 80, 0.25), rgba(40, 15, 20, 0.9))' 
                  : 'linear-gradient(135deg, rgba(76, 175, 80, 0.12), rgba(20, 24, 38, 0.9))',
                border: kpis.countCriticos > 0 ? '1px solid #ef5350' : '1px solid rgba(76, 175, 80, 0.3)',
                borderRadius: '12px',
                padding: '1.2rem',
                cursor: 'pointer',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ fontSize: '0.8rem', color: kpis.countCriticos > 0 ? '#ff8a80' : '#81c784', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Itens Fora da Média</span>
                <ShieldAlert size={16} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#fff', margin: '0.5rem 0 0.2rem 0' }}>
                {kpis.countCriticos} <span style={{ fontSize: '0.9rem', color: '#ef5350', fontWeight: 'normal' }}>críticos</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#ccc' }}>
                +{kpis.countAtencao} itens em atenção (ver lista →)
              </div>
            </div>

          </div>

          {/* SEÇÃO DE GRÁFICOS: EVOLUÇÃO TEMPORAL & DISTRIBUIÇÃO TM */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            
            {/* Gráfico 1: Evolução Temporal por TM */}
            <div style={{
              background: 'rgba(20, 24, 38, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '1.2rem',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
            }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#fff', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📈 Evolução das Baixas por Tipo de Movimento ({selectedAno})</span>
              </h4>
              <div style={{ width: '100%', height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartEvolucaoTM} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="mesNome" stroke="#888" fontSize={12} />
                    <YAxis stroke="#888" fontSize={12} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: '8px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '10px' }} />
                    <Bar dataKey="Inventário (506/006)" fill={CRITICAL_TMS['506'].color} stackId="a" />
                    <Bar dataKey="Garantia (509)" fill={CRITICAL_TMS['509'].color} stackId="a" />
                    <Bar dataKey="Perda Mat. (507)" fill={CRITICAL_TMS['507'].color} stackId="a" />
                    <Bar dataKey="Consumível (504)" fill={CRITICAL_TMS['504'].color} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico 2: Composição por TM (Donut) */}
            <div style={{
              background: 'rgba(20, 24, 38, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '1.2rem',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
            }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#fff', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🍩 Composição de Baixas em {MESES[selectedMes - 1]}</span>
              </h4>
              {chartDistribuicaoTM.length === 0 ? (
                <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                  Sem movimentações para exibir no gráfico
                </div>
              ) : (
                <div style={{ width: '100%', height: '280px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartDistribuicaoTM}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="valor"
                        nameKey="name"
                        label={({ name, percent }) => `${name.split(' ')[0]} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {chartDistribuicaoTM.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill || COLORS_CHART[index % COLORS_CHART.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: '8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

          </div>

          {/* SEÇÃO: TOP 10 MAIORES DESVIOS EM R$ & FILIAIS / CC */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            
            {/* Top 10 Desvios */}
            <div style={{
              background: 'rgba(20, 24, 38, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '1.2rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, color: '#fff', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚠️ Top 10 Itens com Maior Desvio Acima da Média</span>
                </h4>
                <button
                  onClick={() => { setFiltroStatusDesvio('critico'); setActiveTab('desvios'); }}
                  style={{ background: 'transparent', border: 'none', color: '#64B5F6', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Ver Todos
                </button>
              </div>

              {topDesvios.length === 0 ? (
                <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: '#888', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={32} style={{ color: '#4caf50', marginBottom: '8px' }} />
                  <span style={{ fontWeight: '500', color: '#ccc' }}>Nenhum item com desvio acima da média histórica detectado.</span>
                  <span style={{ fontSize: '0.78rem', color: '#666', marginTop: '6px' }}>
                    {kpis.countNovos > 0 
                      ? `${kpis.countNovos} movimentações identificadas como itens novos (sem histórico anterior de comparação).` 
                      : 'Todos os produtos movimentados estão dentro da média histórica normal.'}
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {topDesvios.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedItemForModal(item)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderLeft: `4px solid ${item.statusBadgeColor}`,
                        borderRadius: '6px',
                        padding: '0.6rem 0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    >
                      <div style={{ flex: 1, minWidth: 0, marginRight: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.produto}</span>
                          <span style={{ color: '#fff', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.descricao}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '2px', display: 'flex', gap: '10px' }}>
                          {item.filiaisArr.length > 0 && <span>Filial: <strong>{item.filiaisArr.join(', ')}</strong></span>}
                          <span>TMs: {item.tmsArr.join(', ') || '-'}</span>
                          <span>Média: {item.mediaHistorica.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#ef5350', fontWeight: 'bold', fontSize: '0.9rem' }}>
                          {item.custoTotalMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#ff8a80', fontWeight: 'bold' }}>
                          +{item.desvioValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (+{item.desvioPct.toFixed(0)}%)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Visão por Filial & Centro de Custo */}
            <div style={{
              background: 'rgba(20, 24, 38, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '1.2rem'
            }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#fff', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🏢 Baixas por Filial ({chartFiliais.length})</span>
              </h4>
              {chartFiliais.length === 0 ? (
                <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                  Sem dados de filiais
                </div>
              ) : (
                <div style={{ width: '100%', height: '250px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartFiliais} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis type="number" stroke="#888" fontSize={11} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="filial" stroke="#888" fontSize={11} />
                      <Tooltip 
                        formatter={(val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: '8px' }}
                      />
                      <Bar dataKey="valor" fill="#81C784" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* ABA 2: ANÁLISE DETALHADA DE DESVIOS POR PRODUTO */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'desvios' && (
        <div style={{
          background: 'rgba(20, 24, 38, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '14px',
          padding: '1.5rem',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
        }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
            <div>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={20} style={{ color: '#ef5350' }} />
                Auditoria de Médias & Detecção de Desvios
              </h3>
              <p style={{ margin: '3px 0 0 0', color: '#888', fontSize: '0.84rem' }}>
                Comparação do custo total movimentado no mês contra a média dos {kpis.numPrevMonths} meses anteriores carregados
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Filtro Status */}
              <select
                value={filtroStatusDesvio}
                onChange={(e) => setFiltroStatusDesvio(e.target.value)}
                className="select-input"
                style={{ width: '190px', padding: '0.45rem 0.7rem', fontSize: '0.85rem' }}
              >
                <option value="todos">Todos os Status ({analysisByProduct.length})</option>
                <option value="critico">⚠️ Apenas Críticos (+100%)</option>
                <option value="atencao">Atenção (+{toleranciaDesvioPct}%)</option>
                <option value="novo">Novos / Sem Histórico</option>
                <option value="normal">Normais (Dentro do padrão)</option>
              </select>

              {/* Busca */}
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                <input
                  type="text"
                  placeholder="Buscar produto, código, filial..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="select-input"
                  style={{ paddingLeft: '32px', width: '220px', fontSize: '0.85rem' }}
                />
              </div>

              {/* Exportar Excel */}
              <button
                onClick={handleExportExcel}
                style={{
                  background: 'rgba(76, 175, 80, 0.15)',
                  border: '1px solid rgba(76, 175, 80, 0.4)',
                  color: '#81C784',
                  padding: '0.45rem 0.9rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Download size={16} /> Exportar Excel
              </button>
            </div>
          </div>

          {/* TABELA DE DESVIOS */}
          <div className="table-wrapper" style={{ maxHeight: '650px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Filial(is)</th>
                  <th style={{ minWidth: '100px' }}>Código</th>
                  <th style={{ minWidth: '220px' }}>Descrição do Produto</th>
                  <th>Arm.</th>
                  <th>TMs</th>
                  <th style={{ textAlign: 'right' }}>Qtd Saída</th>
                  <th style={{ textAlign: 'right' }}>Custo Mês (R$)</th>
                  <th style={{ textAlign: 'right' }}>Média Hist. (R$)</th>
                  <th style={{ textAlign: 'right' }}>Desvio (R$)</th>
                  <th style={{ textAlign: 'center' }}>Variação %</th>
                  <th style={{ textAlign: 'center' }}>Status / Alerta</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {analysisByProduct.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                      Nenhum item encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  analysisByProduct.map((row, idx) => (
                    <tr key={idx} style={{ background: row.status === 'critico' ? 'rgba(239, 83, 80, 0.05)' : 'transparent' }}>
                      <td>
                        <span style={{ background: 'rgba(255,255,255,0.06)', color: '#81C784', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {row.filiaisArr.join(', ') || 'MATRIZ'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{row.produto}</td>
                      <td style={{ color: '#fff', fontWeight: '500' }}>{row.descricao}</td>
                      <td>{row.armazem || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {row.tmsArr.map(tm => (
                            <span 
                              key={tm} 
                              style={{ 
                                background: CRITICAL_TMS[tm]?.bg || 'rgba(255,255,255,0.1)', 
                                color: CRITICAL_TMS[tm]?.color || '#ccc',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 'bold'
                              }}
                            >
                              {tm}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>{row.qtdSaida.toLocaleString('pt-BR')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#fff' }}>
                        {row.custoTotalMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td style={{ textAlign: 'right', color: '#aaa' }}>
                        {row.hasHistory 
                          ? row.mediaHistorica.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                          : <span style={{ color: '#666', fontStyle: 'italic' }}>-</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: row.status === 'novo' ? '#666' : row.desvioValor > 0 ? '#ef5350' : '#4caf50' }}>
                        {row.status === 'novo' ? '-' : `${row.desvioValor > 0 ? '+' : ''}${row.desvioValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: row.status === 'novo' ? '#29b6f6' : row.desvioPct > 50 ? '#ef5350' : row.desvioPct > 0 ? '#ffa726' : '#4caf50' }}>
                        {row.status === 'novo' ? <span style={{ fontSize: '0.75rem' }}>-</span> : `${row.desvioPct > 0 ? '+' : ''}${row.desvioPct.toFixed(1)}%`}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          background: row.statusBadgeColor + '22',
                          color: row.statusBadgeColor,
                          border: `1px solid ${row.statusBadgeColor}66`,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          whiteSpace: 'nowrap'
                        }}>
                          {row.statusLabel}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedItemForModal(row)}
                          style={{
                            background: 'rgba(33, 150, 243, 0.15)',
                            color: '#64B5F6',
                            border: '1px solid rgba(33, 150, 243, 0.4)',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          🔍 Lançamentos ({row.lancamentos.length})
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* ABA 3: LANÇAMENTOS INDIVIDUAIS DO MÊS */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'lancamentos' && (
        <div style={{
          background: 'rgba(20, 24, 38, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '14px',
          padding: '1.5rem',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
        }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
            <div>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={20} style={{ color: '#2196F3' }} />
                Movimentações Individuais do Mês ({filteredRecordsCurrent.length})
              </h3>
              <p style={{ margin: '3px 0 0 0', color: '#888', fontSize: '0.84rem' }}>
                Detalhamento linha a linha ({MESES[selectedMes - 1]} / {selectedAno}) {selectedFilial !== 'todas' ? `- Filial: ${selectedFilial}` : ''}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                <input
                  type="text"
                  placeholder="Filtrar lançamentos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="select-input"
                  style={{ paddingLeft: '32px', width: '220px', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          </div>

          <div className="table-wrapper" style={{ maxHeight: '650px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Filial</th>
                  <th>Data</th>
                  <th>Produto</th>
                  <th>Descrição</th>
                  <th>Arm.</th>
                  <th>TM</th>
                  <th style={{ textAlign: 'right' }}>Entrada</th>
                  <th style={{ textAlign: 'right' }}>Saída</th>
                  <th style={{ textAlign: 'right' }}>Custo Unit.</th>
                  <th style={{ textAlign: 'right' }}>Custo Total</th>
                  <th>OP</th>
                  <th>C. Custo</th>
                  <th>Documento</th>
                  <th>Usuário</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecordsCurrent.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                      Nenhum lançamento encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredRecordsCurrent.map((r, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 'bold', color: '#81C784' }}>{r.filial || '-'}</td>
                      <td>{r.dtEmissao || '-'}</td>
                      <td style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{r.produto}</td>
                      <td style={{ color: '#fff' }}>{r.descricao}</td>
                      <td>{r.armazem || '-'}</td>
                      <td>
                        <span style={{ 
                          background: CRITICAL_TMS[r.tm]?.bg || 'rgba(255,255,255,0.1)', 
                          color: CRITICAL_TMS[r.tm]?.color || '#ccc',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}>
                          {r.tm}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', color: r.qtdEntrada > 0 ? '#26a69a' : '#666' }}>
                        {r.qtdEntrada > 0 ? r.qtdEntrada.toLocaleString('pt-BR') : '-'}
                      </td>
                      <td style={{ textAlign: 'right', color: r.qtdSaida > 0 ? '#ef5350' : '#666' }}>
                        {r.qtdSaida > 0 ? r.qtdSaida.toLocaleString('pt-BR') : '-'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {r.custoUnitario ? r.custoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#fff' }}>
                        {r.custoTotal ? r.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                      </td>
                      <td style={{ color: r.hasOP ? '#ffa726' : '#888', fontStyle: r.hasOP ? 'normal' : 'italic' }}>
                        {r.op || 'Sem OP'}
                      </td>
                      <td>{r.cc || '-'}</td>
                      <td>{r.documento || '-'}</td>
                      <td style={{ color: '#aaa', fontSize: '0.8rem' }}>{r.usuario || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* ABA 4: BANCO DE DADOS & IMPORTAÇÃO DE PLANILHAS (MULTI-FILIAL) */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'import' && canAccessDB && (
        <div style={{
          background: 'rgba(20, 24, 38, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '14px',
          padding: '1.5rem',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
        }}>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, color: '#FFB74D', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={22} />
              Importação Multi-Filial & Banco de Dados
            </h3>
            <p style={{ margin: '4px 0 0 0', color: '#aaa', fontSize: '0.85rem' }}>
              Você pode selecionar <strong>vários arquivos de filiais simultaneamente</strong> (ou subir um por um no modo acumular). O sistema consolida todas as filiais automaticamente.
            </p>
          </div>

          {/* CARD DE UPLOAD */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '2px dashed rgba(255, 152, 0, 0.35)',
            borderRadius: '12px',
            padding: '1.8rem',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.2rem' }}>
              
              {/* Empresa Alvo */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
                  Empresa Destino:
                </label>
                <select
                  value={importEmpresa}
                  onChange={(e) => setImportEmpresa(e.target.value)}
                  className="select-input"
                  style={{ width: '100%', padding: '0.55rem' }}
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Mês de Competência */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
                  Mês de Competência:
                </label>
                <select
                  value={importMes}
                  onChange={(e) => setImportMes(parseInt(e.target.value))}
                  className="select-input"
                  style={{ width: '100%', padding: '0.55rem' }}
                >
                  {MESES.map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Ano de Competência */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
                  Ano:
                </label>
                <select
                  value={importAno}
                  onChange={(e) => setImportAno(parseInt(e.target.value))}
                  className="select-input"
                  style={{ width: '100%', padding: '0.55rem' }}
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Modo de Gravação */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
                  Modo de Gravação:
                </label>
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value)}
                  className="select-input"
                  style={{ width: '100%', padding: '0.55rem' }}
                >
                  <option value="replace">🔄 Substituir dados do mês</option>
                  <option value="append">➕ Acumular / Concatenar filiais</option>
                </select>
              </div>

            </div>

            {/* Input de Arquivo com suporte a MULTIPLE */}
            <div style={{ marginTop: '0.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', color: '#FFD54F', marginBottom: '6px', fontWeight: 'bold' }}>
                📁 Selecionar Planilhas das Filiais (Pode selecionar múltiplos arquivos .xlsx):
              </label>
              <input
                type="file"
                multiple
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid #555',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.85rem'
                }}
              />
              <small style={{ color: '#888', display: 'block', marginTop: '4px' }}>
                Dica: Você pode segurar <strong>Ctrl</strong> ou <strong>Shift</strong> para selecionar todos os arquivos de filiais de uma vez só!
              </small>
            </div>

            {/* PREVIEW DA PLANILHA LIDA COM RESUMO DE FILIAIS */}
            {previewStats && (
              <div style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(76, 175, 80, 0.4)',
                borderRadius: '8px',
                padding: '1.2rem',
                marginTop: '1.2rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ color: '#81C784', fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={20} /> {previewStats.arquivos.length} Arquivo(s) de Filial Processado(s)!
                    </div>
                    <div style={{ color: '#ccc', fontSize: '0.85rem', marginTop: '4px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                      <span><strong>Total Linhas:</strong> {previewStats.totalLinhas.toLocaleString('pt-BR')}</span>
                      <span><strong>Sem OP (Baixas):</strong> {previewStats.countSemOP.toLocaleString('pt-BR')}</span>
                      <span><strong>Com OP:</strong> {previewStats.countComOP.toLocaleString('pt-BR')}</span>
                      <span><strong>Valor Total:</strong> {previewStats.totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveImportToDB}
                    disabled={isProcessingImport}
                    className="action-btn"
                    style={{
                      background: '#4CAF50',
                      padding: '0.7rem 1.5rem',
                      fontSize: '0.95rem',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Database size={18} />
                    {isProcessingImport ? 'Gravando no Banco...' : '💾 Gravar Todas as Filiais'}
                  </button>
                </div>

                {/* Lista dos arquivos lidos com totalizadores individuais */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.6rem 0.8rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#aaa', fontWeight: 'bold', textTransform: 'uppercase' }}>Filiais Carregadas:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                    {previewStats.arquivos.map((af, idx) => (
                      <span key={idx} style={{ background: 'rgba(76, 175, 80, 0.15)', color: '#81C784', border: '1px solid rgba(76, 175, 80, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.78rem' }}>
                        🏢 <strong>{af.filial}</strong>: {af.linhas} linhas ({af.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                      </span>
                    ))}
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* TABELA DE COMPETÊNCIAS SALVAS */}
          <div>
            <h4 style={{ color: '#fff', margin: '0 0 1rem 0', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🗄️ Competências Gravadas no Banco ({savedCompetencias.length})</span>
            </h4>

            {savedCompetencias.length === 0 ? (
              <p style={{ color: '#888', fontSize: '0.9rem' }}>Nenhuma competência salva ainda no banco de dados.</p>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Competência</th>
                      <th>Filiais Incluídas</th>
                      <th style={{ textAlign: 'right' }}>Total Movimentações</th>
                      <th style={{ textAlign: 'right' }}>Valor Total Gravado</th>
                      <th>Data de Gravação</th>
                      <th style={{ textAlign: 'center' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedCompetencias.map((comp, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
                          {companies.find(c => c.id === comp.empresaId)?.name || comp.empresaId}
                        </td>
                        <td>{MESES[comp.mes - 1]} / {comp.ano}</td>
                        <td>
                          {comp.filiais && comp.filiais.length > 0 ? (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {comp.filiais.map(f => (
                                <span key={f} style={{ background: 'rgba(255,255,255,0.06)', color: '#81C784', padding: '1px 5px', borderRadius: '4px', fontSize: '0.72rem' }}>
                                  {f}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: '#888', fontSize: '0.75rem' }}>Consolidado</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>{comp.totalRecords.toLocaleString('pt-BR')}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#fff' }}>
                          {comp.totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td style={{ color: '#888', fontSize: '0.8rem' }}>
                          {comp.updatedAt ? new Date(comp.updatedAt).toLocaleString('pt-BR') : '-'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => {
                              setSelectedEmpresa(comp.empresaId);
                              setSelectedAno(comp.ano);
                              setSelectedMes(comp.mes);
                              setSelectedFilial('todas');
                              setActiveTab('dash');
                            }}
                            style={{
                              background: 'rgba(33, 150, 243, 0.15)',
                              color: '#64B5F6',
                              border: '1px solid rgba(33, 150, 243, 0.4)',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              marginRight: '6px',
                              cursor: 'pointer',
                              fontSize: '0.78rem'
                            }}
                          >
                            Abrir no Painel
                          </button>

                          <button
                            onClick={() => handleDeleteCompetencia(comp)}
                            style={{
                              background: 'rgba(239, 83, 80, 0.15)',
                              color: '#ef5350',
                              border: '1px solid rgba(239, 83, 80, 0.4)',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              fontSize: '0.78rem'
                            }}
                          >
                            🗑️ Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MODAL DE DETALHAMENTO DE LANÇAMENTOS DO PRODUTO */}
      {/* ----------------------------------------------------------------- */}
      {selectedItemForModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#181a26',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '14px',
            width: '920px',
            maxWidth: '95vw',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}>
            
            {/* Modal Header */}
            <div style={{
              padding: '1.2rem 1.5rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(0,0,0,0.3)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {selectedItemForModal.produto}
                  </span>
                  <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    - {selectedItemForModal.descricao}
                  </span>
                </div>
                <div style={{ color: '#888', fontSize: '0.8rem', marginTop: '3px' }}>
                  Competência: {MESES[selectedMes - 1]} / {selectedAno} | Filiais: {selectedItemForModal.filiaisArr?.join(', ') || 'Todas'} | Total Mês: {selectedItemForModal.custoTotalMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </div>

              <button
                onClick={() => setSelectedItemForModal(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#aaa',
                  fontSize: '1.4rem',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Tabela de Lançamentos */}
            <div style={{ padding: '1.2rem', overflowY: 'auto', flex: 1 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Filial</th>
                    <th>Data</th>
                    <th>Documento</th>
                    <th>TM</th>
                    <th>Arm.</th>
                    <th style={{ textAlign: 'right' }}>Qtd Entrada</th>
                    <th style={{ textAlign: 'right' }}>Qtd Saída</th>
                    <th style={{ textAlign: 'right' }}>Custo Unit.</th>
                    <th style={{ textAlign: 'right' }}>Custo Total</th>
                    <th>Centro de Custo</th>
                    <th>Usuário</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItemForModal.lancamentos.map((l, idx) => (
                    <tr key={idx}>
                      <td style={{ color: '#81C784', fontWeight: 'bold' }}>{l.filial || '-'}</td>
                      <td>{l.dtEmissao || '-'}</td>
                      <td style={{ color: '#fff', fontWeight: '500' }}>{l.documento || '-'}</td>
                      <td>
                        <span style={{ 
                          background: CRITICAL_TMS[l.tm]?.bg || 'rgba(255,255,255,0.1)', 
                          color: CRITICAL_TMS[l.tm]?.color || '#ccc',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 'bold'
                        }}>
                          {l.tm}
                        </span>
                      </td>
                      <td>{l.armazem || '-'}</td>
                      <td style={{ textAlign: 'right', color: l.qtdEntrada > 0 ? '#26a69a' : '#666' }}>
                        {l.qtdEntrada > 0 ? l.qtdEntrada.toLocaleString('pt-BR') : '-'}
                      </td>
                      <td style={{ textAlign: 'right', color: l.qtdSaida > 0 ? '#ef5350' : '#666' }}>
                        {l.qtdSaida > 0 ? l.qtdSaida.toLocaleString('pt-BR') : '-'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {l.custoUnitario ? l.custoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#fff' }}>
                        {l.custoTotal ? l.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                      </td>
                      <td>{l.cc || '-'}</td>
                      <td style={{ color: '#aaa', fontSize: '0.8rem' }}>{l.usuario || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '0.8rem 1.5rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(0,0,0,0.3)',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setSelectedItemForModal(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  padding: '0.4rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
