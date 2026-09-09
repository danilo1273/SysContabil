import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Package, AlertTriangle, TrendingUp, TrendingDown, DollarSign, 
  FileSpreadsheet, Database, Filter, Search, Download, CheckCircle, CheckCircle2, 
  Layers, UserCheck, ShieldAlert, ArrowUpRight, ArrowDownRight, BarChart3, PieChart as PieIcon,
  RefreshCw, Info, Calendar, Building2, HelpCircle, GitBranch, PlusCircle,
  Target, MessageSquare, AlertCircle, FileText, ChevronRight, Activity,
  Trash2, Edit2, Save, X
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  Legend, Cell, PieChart, Pie, AreaChart, Area, CartesianGrid 
} from 'recharts';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';
import { getSettings, saveSettings } from '../utils/db';

const CRITICAL_TMS = {
  '506_006': { label: '506/006 - Inventário (Ajuste Líquido)', color: '#26a69a', bg: 'rgba(38, 166, 154, 0.15)', group: 'inventario', icon: '⚖️', question: 'Houve contagem física no mês? Conciliar as faltas (506 - saída) com as sobras (006 - entrada) para apurar o impacto líquido no estoque.' },
  '506': { label: '506 - Inventário (Saída / Falta)', color: '#ef5350', bg: 'rgba(239, 83, 80, 0.15)', group: 'inventario', icon: '📦', question: 'Houve contagem física no mês? Por que o saldo físico apurou faltas expressivas acima da média?' },
  '006': { label: '006 - Inventário (Entrada / Sobra)', color: '#26a69a', bg: 'rgba(38, 166, 154, 0.15)', group: 'inventario', icon: '📥', question: 'Entradas por sobras físicas no inventário foram conciliadas e justificadas?' },
  '509': { label: '509 - Baixa Justificada Garantia', color: '#ab47bc', bg: 'rgba(171, 71, 188, 0.15)', group: 'garantia', icon: '🛡️', question: 'Quais clientes/equipamentos acionaram garantia? O PCP/Engenharia investigou se foi falha de projeto ou qualidade de componentes?' },
  '507': { label: '507 - Perda de Material / Refugo', color: '#ff7043', bg: 'rgba(255, 112, 67, 0.15)', group: 'perda', icon: '⚠️', question: 'Qual posto de trabalho, máquina ou lote gerou refugo anormal? Houve erro operacional ou lote de matéria-prima avariado?' },
  '504': { label: '504 - Baixa Consumível Fábrica', color: '#42a5f5', bg: 'rgba(66, 165, 245, 0.15)', group: 'consumivel', icon: '🔧', question: 'O volume de insumos/consumíveis retirados do almoxarifado foi proporcional ao volume de ordens de produção abertas no mês?' },
};

const DEFAULT_FILIAIS = [
  // Empresa 01 - AGF Equipamentos
  { code: '0101', name: '0101 - Matriz / Fábrica', empresaId: 'equipamentos' },
  { code: '0102', name: '0102 - Filial 02', empresaId: 'equipamentos' },
  { code: '0103', name: '0103 - Filial 03', empresaId: 'equipamentos' },
  { code: '0104', name: '0104 - Filial 04', empresaId: 'equipamentos' },
  { code: '0105', name: '0105 - Filial 05', empresaId: 'equipamentos' },
  { code: '0106', name: '0106 - Filial 06', empresaId: 'equipamentos' },
  // Empresa 02 - Casa da Escavadeira
  { code: '0201', name: '0201 - Matriz', empresaId: 'casa' },
  { code: '0202', name: '0202 - Filial 02', empresaId: 'casa' },
  { code: '0203', name: '0203 - Filial 03', empresaId: 'casa' },
  // Empresa 03 - AGF Participações
  { code: '0301', name: '0301 - Matriz', empresaId: 'agf_participa_es' },
  // Empresa 04 - AGF Rompedores
  { code: '0401', name: '0401 - Matriz', empresaId: 'rompedores' },
  { code: '0402', name: '0402 - Filial 02', empresaId: 'rompedores' },
  { code: '0403', name: '0403 - Filial 03', empresaId: 'rompedores' },
];

const EMPRESA_CODE_MAP = {
  '01': 'equipamentos',
  '02': 'casa',
  '03': 'agf_participa_es',
  '04': 'rompedores'
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

  // Cadastro Dinâmico de Filiais
  const [cadastrosFiliais, setCadastrosFiliais] = useState(DEFAULT_FILIAIS);
  const [isFiliaisModalOpen, setIsFiliaisModalOpen] = useState(false);
  const [filialEmpresaTab, setFilialEmpresaTab] = useState('equipamentos');
  const [newFilialForm, setNewFilialForm] = useState({ code: '', name: '' });
  const [editingFilialCode, setEditingFilialCode] = useState(null);
  const [editingFilialName, setEditingFilialName] = useState('');

  // Import State (Suporte a múltiplos arquivos / filiais)
  const [importFilesList, setImportFilesList] = useState([]);
  const [importFileData, setImportFileData] = useState(null);
  const [importEmpresa, setImportEmpresa] = useState(companies[0]?.id || 'equipamentos');
  const [importAno, setImportAno] = useState(new Date().getFullYear());
  const [importMes, setImportMes] = useState(new Date().getMonth() + 1);
  const [importMode, setImportMode] = useState('replace'); // 'replace' | 'append'
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [previewStats, setPreviewStats] = useState(null);

  // Modal de Detalhes de Item e de Tipo de Movimento (TM / PCP)
  const [selectedItemForModal, setSelectedItemForModal] = useState(null);
  const [selectedTMForModal, setSelectedTMForModal] = useState(null);
  const [subTabDesvios, setSubTabDesvios] = useState('tm'); // 'tm' | 'produto'

  const isInitialMount = useRef(true);

  // Competência mais recente importada no sistema
  const latestCompetencia = useMemo(() => {
    if (!savedCompetencias || savedCompetencias.length === 0) return null;
    const sorted = [...savedCompetencias].sort((a, b) => {
      if (b.ano !== a.ano) return b.ano - a.ano;
      return b.mes - a.mes;
    });
    return sorted[0];
  }, [savedCompetencias]);

  // Carregar lista de competências e filiais salvas ao montar
  useEffect(() => {
    loadSavedCompetencias();
    loadCadastrosFiliais();
  }, []);

  // Recarregar dados sempre que Empresa, Ano ou Mês mudarem pelo usuário
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    loadEstoqueData(selectedEmpresa, selectedAno, selectedMes);
  }, [selectedEmpresa, selectedAno, selectedMes]);

  const loadSavedCompetencias = async () => {
    try {
      const compList = await getSettings('agf_estoque_competencias');
      if (Array.isArray(compList) && compList.length > 0) {
        setSavedCompetencias(compList);
        // Pre-selecionar o mês mais recente com dados importados
        const sorted = [...compList].sort((a, b) => {
          if (b.ano !== a.ano) return b.ano - a.ano;
          return b.mes - a.mes;
        });
        const latest = sorted[0];
        if (latest) {
          setSelectedAno(latest.ano);
          setSelectedMes(latest.mes);
          loadEstoqueData(selectedEmpresa, latest.ano, latest.mes);
          return;
        }
      } else {
        setSavedCompetencias([]);
      }
    } catch (e) {
      console.error('Erro ao carregar competências de estoque:', e);
    }
    // Fallback: se não houver dados, carrega valores atuais
    loadEstoqueData(selectedEmpresa, selectedAno, selectedMes);
  };

  const loadEstoqueData = async (empOverride, anoOverride, mesOverride) => {
    const targetEmp = empOverride !== undefined ? empOverride : selectedEmpresa;
    const targetAno = anoOverride !== undefined ? anoOverride : selectedAno;
    const targetMes = mesOverride !== undefined ? mesOverride : selectedMes;

    setIsLoading(true);
    try {
      const seriesMap = {};
      const empFilter = (targetEmp === 'todas' || targetEmp === 'consolidado') ? '%' : targetEmp;
      const keyPattern = `agf_estoque_${empFilter}_${targetAno}_%`;

      const { data: rawRows, error } = await supabase
        .from('settings')
        .select('key, value')
        .like('key', keyPattern);

      if (error) throw error;

      if (Array.isArray(rawRows)) {
        for (const row of rawRows) {
          const parts = row.key.split('_');
          if (parts.length >= 5) {
            const mesNum = parseInt(parts[parts.length - 1]);
            const anoNum = parseInt(parts[parts.length - 2]);
            const rowEmp = parts.slice(2, parts.length - 2).join('_');

            if (anoNum === targetAno && mesNum >= 1 && mesNum <= 12) {
              if (targetEmp !== 'todas' && targetEmp !== 'consolidado' && rowEmp !== targetEmp) {
                continue;
              }
              try {
                const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
                if (Array.isArray(parsed) && parsed.length > 0) {
                  const recordsWithEmp = parsed.map(d => ({ ...d, empresaId: rowEmp }));
                  seriesMap[mesNum] = (seriesMap[mesNum] || []).concat(recordsWithEmp);
                }
              } catch (parseErr) {
                console.warn('Erro ao parsear dados da chave', row.key, parseErr);
              }
            }
          }
        }
      }

      setHistorySeries(seriesMap);
      setCurrentRecords(seriesMap[targetMes] || []);
    } catch (e) {
      console.error('Erro ao carregar dados de estoque:', e);
      setCurrentRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar e Gerenciar Filiais
  const loadCadastrosFiliais = async () => {
    try {
      const filiaisList = await getSettings('agf_estoque_filiais_cadastro');
      if (Array.isArray(filiaisList) && filiaisList.length > 0) {
        setCadastrosFiliais(filiaisList);
      } else {
        await saveSettings('agf_estoque_filiais_cadastro', DEFAULT_FILIAIS);
        setCadastrosFiliais(DEFAULT_FILIAIS);
      }
    } catch (e) {
      console.error('Erro ao carregar cadastro de filiais:', e);
    }
  };

  const handleSaveNewFilial = async () => {
    const code = newFilialForm.code.trim();
    const name = newFilialForm.name.trim();
    if (!code || !name) {
      window.$alert('Preencha o código (ex: 0107) e o nome/descrição da filial.');
      return;
    }

    if (cadastrosFiliais.some(f => f.code === code && f.empresaId === filialEmpresaTab)) {
      window.$alert(`A filial com código ${code} já está cadastrada para esta empresa.`);
      return;
    }

    const updated = [...cadastrosFiliais, { code, name, empresaId: filialEmpresaTab }];
    setCadastrosFiliais(updated);
    await saveSettings('agf_estoque_filiais_cadastro', updated);
    setNewFilialForm({ code: '', name: '' });
    window.$toast(`Filial ${name} cadastrada com sucesso!`, { type: 'success' });
  };

  const handleSaveEditFilial = async (code) => {
    if (!editingFilialName.trim()) return;
    const updated = cadastrosFiliais.map(f => {
      if (f.code === code && f.empresaId === filialEmpresaTab) {
        return { ...f, name: editingFilialName.trim() };
      }
      return f;
    });
    setCadastrosFiliais(updated);
    await saveSettings('agf_estoque_filiais_cadastro', updated);
    setEditingFilialCode(null);
    setEditingFilialName('');
    window.$toast('Filial atualizada com sucesso!', { type: 'success' });
  };

  const handleDeleteFilial = async (filialItem) => {
    const ok = await window.$confirm(`Tem certeza que deseja excluir a filial "${filialItem.name}"?`);
    if (!ok) return;

    const updated = cadastrosFiliais.filter(f => !(f.code === filialItem.code && f.empresaId === filialItem.empresaId));
    setCadastrosFiliais(updated);
    await saveSettings('agf_estoque_filiais_cadastro', updated);
    window.$toast('Filial excluída com sucesso!', { type: 'success' });
  };

  const handleResetFiliais = async () => {
    const ok = await window.$confirm('Deseja restaurar as filiais padrão iniciais (0101..0106, 0201..0203, 0301, 0401..0403)?');
    if (!ok) return;

    setCadastrosFiliais(DEFAULT_FILIAIS);
    await saveSettings('agf_estoque_filiais_cadastro', DEFAULT_FILIAIS);
    window.$toast('Lista de filiais restaurada para os padrões do Protheus!', { type: 'success' });
  };

  // Reconhecimento Inteligente da Filial e Empresa pelo Nome do Arquivo do Protheus
  const detectFilialFromFilename = (filename, currentEmpresa) => {
    const clean = filename.replace(/\.[^/.]+$/, '').trim();

    // 1. Protheus padrão: 4 dígitos no nome do arquivo (ex: "MOVIMENTAÇÕES INTERNAS 0101.xlsx", "0101", etc.)
    const match4 = clean.match(/\b(\d{4})\b/);
    if (match4) {
      const code = match4[1];
      const empPrefix = code.substring(0, 2);
      const suggestedEmpresa = EMPRESA_CODE_MAP[empPrefix] || null;
      const reg = cadastrosFiliais.find(f => f.code === code);
      return {
        code,
        name: reg ? reg.name : `Filial ${code}`,
        suggestedEmpresa
      };
    }

    // 2. Padrões alternativos: "Filial 01", "F01", "Matriz"
    const matchFilial = clean.match(/filial[\s_-]?(\d+|[a-zA-Z0-9]+)/i);
    if (matchFilial) {
      const num = matchFilial[1];
      const reg = cadastrosFiliais.find(f => f.code.endsWith(num) && (f.empresaId === currentEmpresa || !currentEmpresa));
      return {
        code: reg ? reg.code : num,
        name: reg ? reg.name : `Filial ${num}`.toUpperCase(),
        suggestedEmpresa: null
      };
    }

    const matchF = clean.match(/\bF(\d{1,2})\b/i);
    if (matchF) {
      const num = matchF[1].padStart(2, '0');
      const reg = cadastrosFiliais.find(f => f.code.endsWith(num) && (f.empresaId === currentEmpresa || !currentEmpresa));
      return {
        code: reg ? reg.code : num,
        name: reg ? reg.name : `Filial ${num}`.toUpperCase(),
        suggestedEmpresa: null
      };
    }

    if (clean.toLowerCase().includes('matriz')) {
      const reg = cadastrosFiliais.find(f => f.name.toLowerCase().includes('matriz') && (f.empresaId === currentEmpresa || !currentEmpresa));
      return {
        code: reg ? reg.code : 'MATRIZ',
        name: reg ? reg.name : 'MATRIZ',
        suggestedEmpresa: null
      };
    }

    return { code: clean.toUpperCase(), name: clean.toUpperCase(), suggestedEmpresa: null };
  };

  // Atualizar Filial Associada a um Arquivo no Preview
  const handleUpdateFileFilial = (filename, newFilial) => {
    if (!previewStats || !importFileData) return;
    const updatedArquivos = previewStats.arquivos.map(af => {
      if (af.filename === filename) return { ...af, filial: newFilial };
      return af;
    });
    const updatedRecords = importFileData.map(r => {
      if (r.arquivoOrigem === filename) return { ...r, filial: newFilial };
      return r;
    });
    setImportFileData(updatedRecords);
    setPreviewStats({
      ...previewStats,
      arquivos: updatedArquivos,
      filiaisIdentificadas: Array.from(new Set(updatedRecords.map(r => r.filial).filter(Boolean)))
    });
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
        const detected = detectFilialFromFilename(file.name, importEmpresa);
        const defaultFilial = detected.name;

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
          if (idxFilial === -1 && (n === 'filial' || n === 'fil.' || n === 'cod. filial' || n === 'codigo filial' || n === 'cod filial' || n === 'filial origem')) idxFilial = idx;
          else if (idxProd === -1 && (n === 'produto' || n === 'cod. produto' || n === 'codigo' || n === 'cod produto' || n === 'cod. prod.' || n === 'item')) idxProd = idx;
          else if (idxDesc === -1 && (n.includes('desc') || n.includes('produto desc') || n === 'descricao')) idxDesc = idx;
          else if (idxTipo === -1 && (n === 'tipo' || n === 'tipo prod.' || n === 'tipo prod')) idxTipo = idx;
          else if (idxGrupo === -1 && n === 'grupo') idxGrupo = idx;
          else if (idxUm === -1 && (n === 'unidade' || n === 'um' || n === 'u.m.' || n === 'unid.' || n === 'unid' || n === 'unidade de medida' || n === 'un')) idxUm = idx;
          else if (idxArm === -1 && (n.includes('armaz') || n === 'local' || n === 'almox' || n === 'almoxarifado')) idxArm = idx;
          else if (idxEntrada === -1 && (n.includes('entrada') || n === 'qtd entrada' || n === 'qtde entrada')) idxEntrada = idx;
          else if (idxSaida === -1 && (n.includes('saida') || n === 'qtd saida' || n === 'qtde saida')) idxSaida = idx;
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
            const rawF = row[idxFilial].toString().trim();
            if (rawF && rawF.length <= 6 && /^\d+$/.test(rawF)) {
              const regF = cadastrosFiliais.find(cf => cf.code === rawF || cf.code.endsWith(rawF) || rawF.endsWith(cf.code));
              rowFilial = regF ? regF.name : `Filial ${rawF}`;
            } else if (rawF && rawF.length > 2) {
              const regF = cadastrosFiliais.find(cf => cf.name.toLowerCase().includes(rawF.toLowerCase()));
              if (regF) rowFilial = regF.name;
            }
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
          fileVal += Math.abs(custoTot);
          fileRecordsCount++;
        }

        fileSummaries.push({
          id: `file_${fIdx}_${file.name}`,
          filename: file.name,
          filial: defaultFilial,
          filialCode: detected.code,
          suggestedEmpresa: detected.suggestedEmpresa,
          suggestedEmpresaName: companies.find(c => c.id === detected.suggestedEmpresa)?.name || '',
          linhas: fileRecordsCount,
          valor: fileVal
        });
      }

      // Se todos os arquivos lidos pertencerem a uma empresa específica do Protheus (ex: 01 -> equipamentos)
      const detectedEmpresas = Array.from(new Set(fileSummaries.map(f => f.suggestedEmpresa).filter(Boolean)));
      if (detectedEmpresas.length === 1 && detectedEmpresas[0] !== importEmpresa) {
        setImportEmpresa(detectedEmpresas[0]);
        const empName = companies.find(c => c.id === detectedEmpresas[0])?.name || detectedEmpresas[0];
        window.$toast(`Empresa identificada automaticamente: ${empName}`, { type: 'info' });
      }

      const totalVal = allParsedRecords.reduce((acc, r) => acc + Math.abs(r.custoTotal), 0);
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

      window.$toast(`${files.length} arquivo(s) de filial processado(s) com sucesso! Total: ${allParsedRecords.length} lançamentos.`, { type: 'success' });
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
        // Se estiver subindo filiais em modo append, remove versões anteriores dessas mesmas filiais para não duplicar
        const uploadedFiliais = new Set(importFileData.map(r => r.filial));
        const filteredExisting = existingData.filter(r => !uploadedFiliais.has(r.filial));
        finalRecordsToSave = filteredExisting.concat(importFileData);
      }
    }

    const ok = await window.$confirm(
      `Confirma a gravação dos dados de estoque?\n\n` +
      `Empresa: ${companies.find(c => c.id === importEmpresa)?.name || importEmpresa}\n` +
      `Competência: ${MESES[importMes - 1]} / ${importAno}\n` +
      `Modo: ${importMode === 'append' ? '➕ Acumular com dados existentes' : '🔄 Substituir competência'}\n` +
      `Arquivos de Filial: ${previewStats?.arquivos?.length || 1}\n` +
      `Total de Movimentações: ${finalRecordsToSave.length}\n` +
      `Valor Total: ${finalRecordsToSave.reduce((acc, r) => acc + Math.abs(r.custoTotal), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
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
      loadEstoqueData(importEmpresa, importAno, importMes);
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
      loadEstoqueData(selectedEmpresa, selectedAno, selectedMes);
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
    analysisByTM,
    chartComparativoTM,
    analysisByProduct,
    chartEvolucaoTM,
    chartDistribuicaoTM,
    topDesvios,
    chartCC,
    chartFiliais,
    chartUsuarios
  } = useMemo(() => {
    // 1. Normalização de TM e Filtrar registros do mês atual conforme opções
    const normTM = (val) => String(val || '').trim().padStart(3, '0');
    const isCriticalTM = (tm) => ['506', '006', '509', '507', '504'].includes(normTM(tm));

    const filterRecord = (r) => {
      // Regra da OP: se filtroApenasSemOP ativo, op deve ser vazia
      if (filtroApenasSemOP && r.hasOP) return false;

      // Filtro de Filial
      if (selectedFilial !== 'todas' && r.filial !== selectedFilial) return false;

      // Normalizar TM
      const tm = normTM(r.tm);

      // Filtro TM
      if (filtroTM === 'criticos' && !isCriticalTM(tm)) return false;
      if (filtroTM === '506_006' && !['506', '006'].includes(tm)) return false;
      if (filtroTM === '509' && tm !== '509') return false;
      if (filtroTM === '507' && tm !== '507') return false;
      if (filtroTM === '504' && tm !== '504') return false;

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
    let totalBaixadoMes = 0; // Baixas brutas (saídas)
    let totalInventario506 = 0;
    let totalInventario006 = 0;
    let totalGarantia509 = 0;
    let totalPerda507 = 0;
    let totalConsumivel504 = 0;
    let totalOutrosTM = 0;

    currentFiltered.forEach(r => {
      const tm = normTM(r.tm);
      const absVal = Math.abs(r.custoTotal || 0);
      if (tm === '006') {
        totalInventario006 += absVal;
      } else {
        totalBaixadoMes += absVal;
        if (tm === '506') totalInventario506 += absVal;
        else if (tm === '509') totalGarantia509 += absVal;
        else if (tm === '507') totalPerda507 += absVal;
        else if (tm === '504') totalConsumivel504 += absVal;
        else totalOutrosTM += absVal;
      }
    });

    const totalLiquidoMes = totalBaixadoMes - totalInventario006;

    // 3. Histórico e Médias dos Meses Anteriores
    const previousMonths = Object.keys(historySeries).map(Number).filter(m => m < selectedMes);
    const numPrevMonths = Math.max(1, previousMonths.length);

    // 4. ANÁLISE DE DESVIO POR TIPO DE MOVIMENTO (TM) - Foco Estratégico PCP & DRE
    const mapTMGroup = (rawTm) => {
      const t = normTM(rawTm);
      if (t === '506' || t === '006') return '506_006';
      return t;
    };

    const allTMsSet = new Set();
    currentFiltered.forEach(r => { if (r.tm) allTMsSet.add(mapTMGroup(r.tm)); });
    previousMonths.forEach(m => {
      (historySeries[m] || []).filter(filterRecord).forEach(r => {
        if (r.tm) allTMsSet.add(mapTMGroup(r.tm));
      });
    });
    if (filtroTM === 'criticos') {
      ['506_006', '509', '507', '504'].forEach(tm => allTMsSet.add(tm));
    } else if (filtroTM === '506_006') {
      allTMsSet.add('506_006');
    } else if (filtroTM === '509') {
      allTMsSet.add('509');
    } else if (filtroTM === '507') {
      allTMsSet.add('507');
    } else if (filtroTM === '504') {
      allTMsSet.add('504');
    }

    let totalDesvioLiquido = 0;
    let tmCountCriticos = 0;
    let tmCountAtencao = 0;
    let tmCountReducao = 0;
    let tmCountNovos = 0;

    const analysisByTM = Array.from(allTMsSet).map(tm => {
      const isNetInv = tm === '506_006';
      const tmInfo = CRITICAL_TMS[tm] || {
        label: `TM ${tm} - Movimento Interno`,
        color: '#ffa726',
        bg: 'rgba(255, 167, 38, 0.15)',
        group: 'outros',
        icon: '📋',
        question: 'Verificar justificativa e motivo do lançamento diretamente com a equipe do PCP e Almoxarifado.'
      };

      const currentTMRecords = currentFiltered.filter(r => mapTMGroup(r.tm) === tm);
      let valorMes = 0;
      let totalSaida506 = 0;
      let totalEntrada006 = 0;
      let qtdSaidaMes = 0;
      let qtdEntradaMes = 0;

      if (isNetInv) {
        currentTMRecords.forEach(r => {
          const rawTM = normTM(r.tm);
          const v = Math.abs(r.custoTotal || 0);
          if (rawTM === '006') {
            totalEntrada006 += v;
            qtdEntradaMes += (r.qtdEntrada || 0);
          } else {
            totalSaida506 += v;
            qtdSaidaMes += (r.qtdSaida || 0);
          }
        });
        // Movimento negativo (saída 506) e positivo (entrada 006):
        // Líquido do inventário: Saídas (506) - Entradas (006)
        valorMes = totalSaida506 - totalEntrada006;
      } else {
        valorMes = Math.abs(currentTMRecords.reduce((sum, r) => sum + (r.custoTotal || 0), 0));
        qtdSaidaMes = currentTMRecords.reduce((sum, r) => sum + (r.qtdSaida || 0), 0);
        qtdEntradaMes = currentTMRecords.reduce((sum, r) => sum + (r.qtdEntrada || 0), 0);
      }
      const lancamentosCount = currentTMRecords.length;

      let totalHistVal = 0;
      previousMonths.forEach(m => {
        const mRecords = (historySeries[m] || []).filter(filterRecord).filter(r => mapTMGroup(r.tm) === tm);
        if (isNetInv) {
          let m506 = 0, m006 = 0;
          mRecords.forEach(r => {
            if (normTM(r.tm) === '006') m006 += Math.abs(r.custoTotal || 0);
            else m506 += Math.abs(r.custoTotal || 0);
          });
          totalHistVal += (m506 - m006);
        } else {
          totalHistVal += Math.abs(mRecords.reduce((sum, r) => sum + (r.custoTotal || 0), 0));
        }
      });

      const hasHistory = previousMonths.length > 0 && totalHistVal !== 0;
      const mediaHistorica = hasHistory ? (totalHistVal / numPrevMonths) : 0;
      const desvioValor = hasHistory ? (valorMes - mediaHistorica) : 0;
      const desvioPct = (hasHistory && mediaHistorica !== 0) 
        ? ((valorMes - mediaHistorica) / Math.abs(mediaHistorica)) * 100 
        : 0;

      if (hasHistory) {
        totalDesvioLiquido += desvioValor;
      }

      let status = 'normal';
      let statusLabel = 'Estável (Na Média)';
      let statusColor = '#4caf50';

      if (isNetInv) {
        if (valorMes < 0) {
          status = 'sobra';
          statusLabel = '🟢 Sobra Líquida';
          statusColor = '#26a69a';
        } else if (valorMes > 0) {
          if (desvioPct > 25 || (hasHistory && desvioValor > 5000)) {
            status = 'critico';
            statusLabel = '🚨 Falta Líquida Crítica';
            statusColor = '#ef5350';
            tmCountCriticos++;
          } else {
            status = 'atencao';
            statusLabel = '⚠️ Falta Líquida';
            statusColor = '#ffa726';
            tmCountAtencao++;
          }
        } else {
          status = 'normal';
          statusLabel = 'Inventário Zerado';
          statusColor = '#4caf50';
        }
      } else if (!hasHistory) {
        status = valorMes > 0 ? 'novo' : 'sem_mov';
        statusLabel = valorMes > 0 ? '🆕 TM Novo' : 'Sem Movimento';
        statusColor = valorMes > 0 ? '#29b6f6' : '#666';
        if (valorMes > 0) tmCountNovos++;
      } else if (desvioPct > 25 || (desvioValor > 5000 && desvioPct > 10)) {
        status = 'critico';
        statusLabel = `🚨 Crítico (+${desvioPct.toFixed(0)}%)`;
        statusColor = '#ef5350';
        tmCountCriticos++;
      } else if (desvioPct > 10) {
        status = 'atencao';
        statusLabel = `⚠️ Atenção (+${desvioPct.toFixed(0)}%)`;
        statusColor = '#ffa726';
        tmCountAtencao++;
      } else if (desvioPct < -15) {
        status = 'reducao';
        statusLabel = `📉 Redução (${desvioPct.toFixed(0)}%)`;
        statusColor = '#66bb6a';
        tmCountReducao++;
      }

      // Top 5 produtos vilões deste TM
      const prodMap = {};
      currentTMRecords.forEach(r => {
        const pKey = r.produto || r.descricao;
        if (!prodMap[pKey]) {
          prodMap[pKey] = {
            produto: r.produto,
            descricao: r.descricao,
            tipo: r.tipo,
            grupo: r.grupo,
            filiais: new Set(),
            cc: r.cc,
            qtdSaida: 0,
            qtdEntrada: 0,
            custoTotal: 0,
            lancamentos: []
          };
        }
        if (r.filial) prodMap[pKey].filiais.add(r.filial);
        prodMap[pKey].qtdSaida += (r.qtdSaida || 0);
        prodMap[pKey].qtdEntrada += (r.qtdEntrada || 0);
        const v = Math.abs(r.custoTotal || 0);
        if (isNetInv && normTM(r.tm) === '006') {
          prodMap[pKey].custoTotal -= v;
        } else {
          prodMap[pKey].custoTotal += v;
        }
        prodMap[pKey].lancamentos.push(r);
      });

      const topProdutos = Object.values(prodMap)
        .sort((a, b) => Math.abs(b.custoTotal) - Math.abs(a.custoTotal))
        .slice(0, 5)
        .map(p => ({
          ...p,
          filiaisArr: Array.from(p.filiais),
          pctDoTM: Math.abs(valorMes) > 0 ? (Math.abs(p.custoTotal) / Math.abs(valorMes)) * 100 : 0
        }));

      // Centros de custo deste TM
      const ccMap = {};
      currentTMRecords.forEach(r => {
        const ccName = r.cc || 'Sem CC';
        const v = Math.abs(r.custoTotal || 0);
        if (isNetInv && normTM(r.tm) === '006') {
          ccMap[ccName] = (ccMap[ccName] || 0) - v;
        } else {
          ccMap[ccName] = (ccMap[ccName] || 0) + v;
        }
      });
      const topCCs = Object.entries(ccMap)
        .map(([cc, val]) => ({ cc, val, pct: Math.abs(valorMes) > 0 ? (Math.abs(val) / Math.abs(valorMes)) * 100 : 0 }))
        .sort((a, b) => Math.abs(b.val) - Math.abs(a.val))
        .slice(0, 4);

      // Série Histórica Jan..Dez deste TM
      const historicoMeses = [];
      for (let m = 1; m <= 12; m++) {
        const mRecs = (historySeries[m] || []).filter(filterRecord).filter(r => mapTMGroup(r.tm) === tm);
        let v = 0;
        if (isNetInv) {
          let s506 = 0, e006 = 0;
          mRecs.forEach(r => {
            if (normTM(r.tm) === '006') e006 += Math.abs(r.custoTotal || 0);
            else s506 += Math.abs(r.custoTotal || 0);
          });
          v = s506 - e006;
        } else {
          v = Math.abs(mRecs.reduce((sum, r) => sum + (r.custoTotal || 0), 0));
        }
        historicoMeses.push({
          mesNum: m,
          mesNome: MESES[m - 1].substring(0, 3),
          valor: v
        });
      }

      return {
        tm,
        ...tmInfo,
        valorMes,
        isNetInv,
        totalSaida506,
        totalEntrada006,
        qtdSaidaMes,
        qtdEntradaMes,
        lancamentosCount,
        hasHistory,
        mediaHistorica,
        desvioValor,
        desvioPct,
        status,
        statusLabel,
        statusColor,
        topProdutos,
        topCCs,
        historicoMeses,
        records: currentTMRecords
      };
    })
    .filter(t => t.valorMes !== 0 || t.hasHistory || (t.isNetInv && (t.totalSaida506 > 0 || t.totalEntrada006 > 0)))
    .sort((a, b) => {
      if (a.status === 'critico' && b.status !== 'critico') return -1;
      if (b.status === 'critico' && a.status !== 'critico') return 1;
      return b.desvioValor - a.desvioValor;
    });

    // Gráfico Comparativo Mês Atual vs Média Histórica por TM
    const chartComparativoTM = analysisByTM
      .filter(t => t.valorMes !== 0 || t.mediaHistorica !== 0 || (t.isNetInv && (t.totalSaida506 > 0 || t.totalEntrada006 > 0)))
      .map(t => ({
        tm: t.tm,
        nome: t.isNetInv ? '506/006 Inv. Líq.' : `${t.tm} - ${t.label.split(' - ')[1]?.split('/')[0] || t.label}`.substring(0, 18),
        'Mês Atual': t.valorMes,
        'Média Histórica': t.mediaHistorica,
        desvioValor: t.desvioValor,
        desvioPct: t.desvioPct,
        color: t.isNetInv && t.valorMes < 0 ? '#26a69a' : t.color,
        isNetInv: t.isNetInv,
        totalSaida506: t.totalSaida506,
        totalEntrada006: t.totalEntrada006
      }));

    // 5. Agrupamento por Produto (para detalhamento de itens)
    const productHistoryMap = {};
    previousMonths.forEach(m => {
      const mRecords = (historySeries[m] || []).filter(filterRecord);
      mRecords.forEach(r => {
        const prod = r.produto || r.descricao;
        if (!productHistoryMap[prod]) {
          productHistoryMap[prod] = { totalVal: 0, records: [] };
        }
        productHistoryMap[prod].totalVal += Math.abs(r.custoTotal || 0);
        productHistoryMap[prod].records.push(r);
      });
    });

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
      if (r.tm) currentProductMap[prod].tms.add(normTM(r.tm));
      currentProductMap[prod].qtdEntrada += (r.qtdEntrada || 0);
      currentProductMap[prod].qtdSaida += (r.qtdSaida || 0);
      currentProductMap[prod].custoTotalMes += Math.abs(r.custoTotal || 0);
      currentProductMap[prod].lancamentos.push(r);
    });

    let countProdCriticos = 0;
    let countProdAtencao = 0;
    let countProdNormal = 0;
    let countProdNovos = 0;

    const analysisRows = Object.values(currentProductMap).map(item => {
      const hist = productHistoryMap[item.produto] || productHistoryMap[item.descricao];
      const hasHistory = !!hist && hist.totalVal > 0;
      
      const mediaHistorica = hasHistory ? (hist.totalVal / numPrevMonths) : 0;
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
        countProdNovos++;
      } else if (desvioPct > 100 || (desvioValor > 2000 && desvioPct > toleranciaDesvioPct)) {
        status = 'critico';
        statusLabel = `⚠️ Crítico (+${desvioPct.toFixed(0)}%)`;
        statusBadgeColor = '#ef5350';
        countProdCriticos++;
      } else if (desvioPct > toleranciaDesvioPct) {
        status = 'atencao';
        statusLabel = `Atenção (+${desvioPct.toFixed(0)}%)`;
        statusBadgeColor = '#ffa726';
        countProdAtencao++;
      } else {
        countProdNormal++;
      }

      return {
        ...item,
        tmsArr: Array.from(item.tms),
        filiaisArr: Array.from(item.filiais),
        hasHistory,
        mediaHistorica,
        desvioValor,
        desvioPct,
        status,
        statusLabel,
        statusBadgeColor
      };
    });

    analysisRows.sort((a, b) => {
      if (a.status === 'novo' && b.status !== 'novo') return 1;
      if (b.status === 'novo' && a.status !== 'novo') return -1;
      return b.desvioValor - a.desvioValor;
    });

    const filteredAnalysisRows = analysisRows.filter(r => {
      if (filtroStatusDesvio === 'todos') return true;
      return r.status === filtroStatusDesvio;
    });

    const topDesviosList = analysisRows
      .filter(r => r.hasHistory && r.mediaHistorica > 0 && r.desvioValor > 0)
      .slice(0, 10);

    // 6. Gráfico de Evolução Histórica das Baixas por TM (Mês a Mês do Ano)
    const evolucaoData = [];
    for (let m = 1; m <= 12; m++) {
      const mRecs = (historySeries[m] || []).filter(filterRecord);
      if (mRecs.length > 0 || m <= selectedMes) {
        let inv506 = 0, inv006 = 0, gar = 0, perd = 0, cons = 0, out = 0, total = 0;
        mRecs.forEach(r => {
          const v = Math.abs(r.custoTotal || 0);
          const tm = normTM(r.tm);
          if (tm === '506') {
            inv506 += v;
            total += v;
          } else if (tm === '006') {
            inv006 += v;
            total -= v;
          } else {
            total += v;
            if (tm === '509') gar += v;
            else if (tm === '507') perd += v;
            else if (tm === '504') cons += v;
            else out += v;
          }
        });

        const invLiquido = inv506 - inv006;

        evolucaoData.push({
          mesNum: m,
          mesNome: MESES[m - 1].substring(0, 3),
          'Inventário (506/006)': invLiquido,
          'Garantia (509)': gar,
          'Perda Mat. (507)': perd,
          'Consumível (504)': cons,
          'Outros TMs': out,
          total
        });
      }
    }

    // 7. Gráfico de Distribuição por TM no mês atual
    const totalInventarioLiquido = totalInventario506 - totalInventario006;
    const distTM = [
      { 
        name: totalInventarioLiquido < 0 ? '506/006 Sobra Líq.' : '506/006 Falta Líq.', 
        valor: Math.abs(totalInventarioLiquido), 
        fill: totalInventarioLiquido < 0 ? '#26a69a' : '#ef5350' 
      },
      { name: '509 Garantia', valor: totalGarantia509, fill: CRITICAL_TMS['509'].color },
      { name: '507 Perda Material', valor: totalPerda507, fill: CRITICAL_TMS['507'].color },
      { name: '504 Consumível', valor: totalConsumivel504, fill: CRITICAL_TMS['504'].color },
    ].filter(d => d.valor > 0);

    if (totalOutrosTM > 0) {
      distTM.push({ name: 'Outros TMs', valor: totalOutrosTM, fill: '#78909c' });
    }

    // 8. Distribuição por Filial
    const filialMap = {};
    currentFiltered.forEach(r => {
      const f = r.filial || 'Sem Filial';
      filialMap[f] = (filialMap[f] || 0) + Math.abs(r.custoTotal || 0);
    });
    const distFiliais = Object.entries(filialMap)
      .map(([filial, valor]) => ({ filial, valor }))
      .sort((a, b) => b.valor - a.valor);

    // 9. Distribuição por Centro de Custo
    const ccMap = {};
    currentFiltered.forEach(r => {
      const cc = r.cc || 'Sem CC';
      ccMap[cc] = (ccMap[cc] || 0) + Math.abs(r.custoTotal || 0);
    });
    const distCC = Object.entries(ccMap)
      .map(([cc, valor]) => ({ cc, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    // 10. Distribuição por Usuário
    const userMap = {};
    currentFiltered.forEach(r => {
      const u = r.usuario || 'Outros';
      userMap[u] = (userMap[u] || 0) + Math.abs(r.custoTotal || 0);
    });
    const distUsers = Object.entries(userMap)
      .map(([usuario, valor]) => ({ usuario, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    return {
      filteredRecordsCurrent: currentFiltered,
      kpis: {
        totalBaixadoMes,
        totalLiquidoMes,
        totalDesvioLiquido,
        totalInventario506,
        totalInventario006,
        totalGarantia509,
        totalPerda507,
        totalConsumivel504,
        totalOutrosTM,
        tmCountCriticos,
        tmCountAtencao,
        tmCountReducao,
        tmCountNovos,
        countProdCriticos,
        countProdAtencao,
        countProdNormal,
        countProdNovos,
        totalItens: Object.keys(currentProductMap).length,
        numPrevMonths: previousMonths.length
      },
      analysisByTM,
      chartComparativoTM,
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
              onChange={(e) => { 
                const val = e.target.value;
                setSelectedEmpresa(val); 
                setSelectedFilial('todas');
                loadEstoqueData(val, selectedAno, selectedMes);
              }}
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
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setSelectedMes(val);
                loadEstoqueData(selectedEmpresa, selectedAno, val);
              }}
              className="select-input"
              style={{ width: '145px', padding: '0.45rem 0.7rem', fontSize: '0.85rem' }}
            >
              {MESES.map((m, idx) => {
                const mesNum = idx + 1;
                const hasData = savedCompetencias.some(c => c.ano === selectedAno && c.mes === mesNum);
                return (
                  <option key={mesNum} value={mesNum}>
                    {m} {hasData ? '●' : ''}
                  </option>
                );
              })}
            </select>

            <select
              value={selectedAno}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setSelectedAno(val);
                loadEstoqueData(selectedEmpresa, val, selectedMes);
              }}
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
              <option value="506_006">506 / 006 - Inventário Líquido</option>
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

          {/* Badge / Atalho para o Último Mês Importado */}
          {latestCompetencia && (
            <button
              onClick={() => {
                setSelectedAno(latestCompetencia.ano);
                setSelectedMes(latestCompetencia.mes);
                loadEstoqueData(selectedEmpresa, latestCompetencia.ano, latestCompetencia.mes);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: (selectedAno === latestCompetencia.ano && selectedMes === latestCompetencia.mes) 
                  ? 'rgba(76, 175, 80, 0.15)' 
                  : 'rgba(255, 152, 0, 0.15)',
                border: `1px solid ${(selectedAno === latestCompetencia.ano && selectedMes === latestCompetencia.mes) ? 'rgba(76, 175, 80, 0.4)' : 'rgba(255, 152, 0, 0.4)'}`,
                color: (selectedAno === latestCompetencia.ano && selectedMes === latestCompetencia.mes) ? '#81C784' : '#FFB74D',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
              title="Clique para carregar o último mês importado"
            >
              <CheckCircle size={14} />
              <span>Último Importado: <strong>{MESES[latestCompetencia.mes - 1]} / {latestCompetencia.ano}</strong></span>
              {(selectedAno !== latestCompetencia.ano || selectedMes !== latestCompetencia.mes) && (
                <span style={{ textDecoration: 'underline', fontSize: '0.75rem', marginLeft: '4px' }}>
                  (Ver)
                </span>
              )}
            </button>
          )}

          {/* Tolerância de Desvio */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: latestCompetencia ? '0' : 'auto' }}>
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

      {/* LOADING STATE */}
      {isLoading && activeTab !== 'import' && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(100, 181, 246, 0.2)',
          borderRadius: '12px',
          padding: '3rem 2rem',
          textAlign: 'center',
          marginBottom: '2rem',
          color: '#64B5F6'
        }}>
          <RefreshCw size={36} style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
          <h4 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>Carregando dados de estoque do banco de dados...</h4>
          <p style={{ margin: '6px 0 0 0', color: '#aaa', fontSize: '0.85rem' }}>Buscando movimentações e calculando desvios por TM e Filiais...</p>
        </div>
      )}

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
            {latestCompetencia ? (
              <>O último mês com movimentações importadas no sistema é <strong>{MESES[latestCompetencia.mes - 1]} / {latestCompetencia.ano}</strong>.</>
            ) : (
              <>Importe as planilhas de filiais do Protheus na aba "Banco de Dados / Importar Filiais" (você pode selecionar todos os arquivos de uma vez só!).</>
            )}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {latestCompetencia && (selectedAno !== latestCompetencia.ano || selectedMes !== latestCompetencia.mes) && (
              <button
                onClick={() => {
                  setSelectedAno(latestCompetencia.ano);
                  setSelectedMes(latestCompetencia.mes);
                  loadEstoqueData(selectedEmpresa, latestCompetencia.ano, latestCompetencia.mes);
                }}
                className="btn-primary"
                style={{ padding: '0.6rem 1.2rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <Calendar size={16} /> Ver Último Mês Importado ({MESES[latestCompetencia.mes - 1]} / {latestCompetencia.ano})
              </button>
            )}
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
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* ABA 1: PAINEL EXECUTIVO & GRÁFICOS */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'dash' && (
        <div>
          
          {/* CARDS KPIS EXECUTIVOS COM FOCO EM TMs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            
            {/* Card Total Geral */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.15), rgba(20, 24, 38, 0.95))',
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
              <div style={{ fontSize: '0.74rem', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Líq. c/ Sobras 006:</span>
                  <strong style={{ color: '#fff' }}>{kpis.totalLiquidoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>
                {kpis.numPrevMonths > 0 ? (
                  <span style={{ color: kpis.totalDesvioLiquido > 0 ? '#ef5350' : '#81c784', fontWeight: 'bold' }}>
                    {kpis.totalDesvioLiquido > 0 ? `+${kpis.totalDesvioLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} vs Média` : `${kpis.totalDesvioLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} vs Média`}
                  </span>
                ) : (
                  <span>Mês Base ({filteredRecordsCurrent.length} mov.)</span>
                )}
              </div>
            </div>

            {/* Cards para os 4 TMs Críticos */}
            {[
              { tmKey: '506_006', title: '506 / 006 Inv. Líquido', color: '#26a69a', bgGrad: 'rgba(38, 166, 154, 0.12)' },
              { tmKey: '509', title: '509 Baixa Garantia', color: '#ab47bc', bgGrad: 'rgba(171, 71, 188, 0.12)' },
              { tmKey: '507', title: '507 Perda de Material', color: '#ff7043', bgGrad: 'rgba(255, 112, 67, 0.12)' },
              { tmKey: '504', title: '504 Baixa Consumível', color: '#42a5f5', bgGrad: 'rgba(66, 165, 245, 0.12)' }
            ].map(({ tmKey, title, color: baseColor, bgGrad: baseBgGrad }) => {
              const tmObj = analysisByTM.find(t => t.tm === tmKey) || {
                valorMes: 0, mediaHistorica: 0, desvioValor: 0, desvioPct: 0, status: 'normal', topProdutos: [], records: []
              };
              const isNetInv = tmKey === '506_006';
              // Para inventário líquido: se faltas líquidas > 0, alerta vermelho; se sobras (< 0), verde positivo
              const color = isNetInv 
                ? (tmObj.valorMes > 0 ? '#ef5350' : tmObj.valorMes < 0 ? '#26a69a' : '#81c784')
                : baseColor;
              const bgGrad = isNetInv
                ? (tmObj.valorMes > 0 ? 'rgba(239, 83, 80, 0.12)' : 'rgba(38, 166, 154, 0.12)')
                : baseBgGrad;
              const hasAlert = tmObj.status === 'critico' || tmObj.status === 'atencao';
              return (
                <div 
                  key={tmKey}
                  onClick={() => tmObj.records?.length > 0 && setSelectedTMForModal(tmObj)}
                  style={{
                    background: `linear-gradient(135deg, ${bgGrad}, rgba(20, 24, 38, 0.95))`,
                    border: hasAlert ? `1px solid ${color}` : `1px solid ${color}44`,
                    borderRadius: '12px',
                    padding: '1.2rem',
                    cursor: tmObj.records?.length > 0 ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => tmObj.records?.length > 0 && (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={(e) => tmObj.records?.length > 0 && (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: color, fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {title}
                    </div>
                    {isNetInv ? (
                      <span style={{
                        background: tmObj.valorMes > 0 ? 'rgba(239, 83, 80, 0.2)' : 'rgba(38, 166, 154, 0.2)',
                        color: tmObj.valorMes > 0 ? '#ff8a80' : '#80cbc4',
                        border: `1px solid ${tmObj.valorMes > 0 ? '#ef5350' : '#26a69a'}66`,
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontSize: '0.72rem',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}>
                        {tmObj.valorMes > 0 ? '🔴 Falta Líquida' : tmObj.valorMes < 0 ? '🟢 Sobra Líquida' : '⚖️ Equilibrado'}
                      </span>
                    ) : tmObj.hasHistory && tmObj.desvioPct !== 0 && (
                      <span style={{
                        background: tmObj.desvioPct > 0 ? 'rgba(239, 83, 80, 0.2)' : 'rgba(76, 175, 80, 0.2)',
                        color: tmObj.desvioPct > 0 ? '#ff8a80' : '#81c784',
                        border: `1px solid ${tmObj.desvioPct > 0 ? '#ef5350' : '#4caf50'}66`,
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontSize: '0.72rem',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}>
                        {tmObj.desvioPct > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {tmObj.desvioPct > 0 ? `+${tmObj.desvioPct.toFixed(0)}%` : `${tmObj.desvioPct.toFixed(0)}%`}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff', margin: '0.4rem 0 0.1rem 0' }}>
                    {isNetInv 
                      ? (tmObj.valorMes < 0 ? `- ${Math.abs(tmObj.valorMes).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : tmObj.valorMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
                      : tmObj.valorMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>

                  <div style={{ fontSize: '0.73rem', color: '#aaa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {isNetInv ? (
                      <span title={`Faltas 506: R$ ${(tmObj.totalSaida506 || 0).toLocaleString('pt-BR')} | Sobras 006: R$ ${(tmObj.totalEntrada006 || 0).toLocaleString('pt-BR')}`}>
                        506: <strong style={{ color: '#ff8a80' }}>R$ {((tmObj.totalSaida506 || 0) / 1000).toFixed(1)}k</strong> | 006: <strong style={{ color: '#80cbc4' }}>R$ {((tmObj.totalEntrada006 || 0) / 1000).toFixed(1)}k</strong>
                      </span>
                    ) : (
                      <span>Média: {tmObj.hasHistory ? tmObj.mediaHistorica.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Sem hist.'}</span>
                    )}
                    {tmObj.records?.length > 0 && (
                      <span style={{ color: '#64B5F6', fontSize: '0.72rem', fontWeight: 'bold' }}>
                        🎯 Questionar PCP →
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Card Alertas e Desvios por TM */}
            <div 
              onClick={() => setActiveTab('desvios')}
              style={{
                background: kpis.tmCountCriticos > 0 
                  ? 'linear-gradient(135deg, rgba(239, 83, 80, 0.25), rgba(40, 15, 20, 0.95))' 
                  : 'linear-gradient(135deg, rgba(76, 175, 80, 0.12), rgba(20, 24, 38, 0.95))',
                border: kpis.tmCountCriticos > 0 ? '1px solid #ef5350' : '1px solid rgba(76, 175, 80, 0.3)',
                borderRadius: '12px',
                padding: '1.2rem',
                cursor: 'pointer',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ fontSize: '0.8rem', color: kpis.tmCountCriticos > 0 ? '#ff8a80' : '#81c784', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Alertas por TM</span>
                <ShieldAlert size={16} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#fff', margin: '0.4rem 0 0.1rem 0' }}>
                {kpis.tmCountCriticos} <span style={{ fontSize: '0.85rem', color: '#ef5350', fontWeight: 'normal' }}>TMs Críticos</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#ccc' }}>
                +{kpis.tmCountAtencao} em atenção | {kpis.tmCountReducao} c/ redução
              </div>
            </div>

          </div>

          {/* PAINEL PRINCIPAL: AUDITORIA DE DESVIOS POR TIPO DE MOVIMENTO (TM) & IMPACTO NO RESULTADO */}
          <div style={{
            background: 'rgba(20, 24, 38, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '14px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 8px 30px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Target size={22} style={{ color: '#2196F3' }} />
                  Auditoria de Desvios por Tipo de Movimento (TM) & Impacto no Resultado
                </h3>
                <p style={{ margin: '3px 0 0 0', color: '#888', fontSize: '0.84rem' }}>
                  Identificação das movimentações com maior variação vs média mensal para questionamento ao PCP, Engenharia e Manutenção
                </p>
              </div>

              <button
                onClick={() => setActiveTab('desvios')}
                style={{
                  background: 'rgba(33, 150, 243, 0.15)',
                  border: '1px solid rgba(33, 150, 243, 0.4)',
                  color: '#64B5F6',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ShieldAlert size={15} /> Ver Análise Detalhada
              </button>
            </div>

            {/* Gráfico Comparativo: Mês Atual vs Média Histórica por TM */}
            <div style={{ width: '100%', height: '300px', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '10px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartComparativoTM} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="nome" stroke="#aaa" fontSize={11} />
                  <YAxis stroke="#aaa" fontSize={11} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    formatter={(val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: '8px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '8px' }} />
                  <Bar dataKey="Mês Atual" fill="#2196F3" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Média Histórica" fill="#78909c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* TABELA DE AUDITORIA DE DESVIOS POR TM */}
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '180px' }}>Tipo de Movimento (TM)</th>
                    <th style={{ textAlign: 'right' }}>Total no Mês (R$)</th>
                    <th style={{ textAlign: 'right' }}>Média Histórica (R$)</th>
                    <th style={{ textAlign: 'right' }}>Desvio (R$)</th>
                    <th style={{ textAlign: 'center' }}>Variação %</th>
                    <th style={{ minWidth: '180px' }}>Impacto no Resultado / DRE</th>
                    <th style={{ minWidth: '220px' }}>Principal Item Vilão no Mês</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center' }}>Ação PCP</th>
                  </tr>
                </thead>
                <tbody>
                  {analysisByTM.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                        Nenhum tipo de movimento com dados neste período.
                      </td>
                    </tr>
                  ) : (
                    analysisByTM.map((t, idx) => {
                      const topItem = t.topProdutos[0];
                      const isCritical = t.status === 'critico';
                      return (
                        <tr 
                          key={idx}
                          style={{ background: isCritical ? 'rgba(239, 83, 80, 0.05)' : 'transparent' }}
                        >
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '1.1rem' }}>{t.icon || '📋'}</span>
                              <div>
                                <span style={{ fontWeight: 'bold', color: t.color }}>{t.label}</span>
                                <div style={{ fontSize: '0.72rem', color: '#888' }}>{t.lancamentosCount} lançamento(s)</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.95rem' }}>
                            {t.isNetInv ? (
                              <div>
                                <div style={{ color: t.valorMes < 0 ? '#80cbc4' : t.valorMes > 0 ? '#ff8a80' : '#fff' }}>
                                  {t.valorMes < 0 ? `- ${Math.abs(t.valorMes).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : t.valorMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 'normal' }}>
                                  506: {(t.totalSaida506 || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | 006: {(t.totalEntrada006 || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: '#fff' }}>{t.valorMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', color: '#aaa' }}>
                            {t.hasHistory 
                              ? t.mediaHistorica.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                              : <span style={{ color: '#666', fontStyle: 'italic' }}>-</span>}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: !t.hasHistory ? '#888' : t.desvioValor > 0 ? '#ef5350' : '#81c784' }}>
                            {!t.hasHistory 
                              ? '-' 
                              : `${t.desvioValor > 0 ? '+' : ''}${t.desvioValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', color: !t.hasHistory ? '#29b6f6' : t.desvioPct > 20 ? '#ef5350' : t.desvioPct > 0 ? '#ffa726' : '#81c784' }}>
                            {!t.hasHistory 
                              ? <span style={{ fontSize: '0.75rem', color: '#29b6f6' }}>Novo</span> 
                              : `${t.desvioPct > 0 ? '+' : ''}${t.desvioPct.toFixed(1)}%`}
                          </td>
                          <td>
                            {t.isNetInv ? (
                              t.valorMes < 0 ? (
                                <span style={{ color: '#81c784', fontSize: '0.78rem', fontWeight: 'bold' }}>
                                  🟢 Sobra de {Math.abs(t.valorMes).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (Crédito Líq.)
                                </span>
                              ) : t.valorMes > 0 ? (
                                <span style={{ color: '#ff8a80', fontSize: '0.78rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <AlertTriangle size={13} />
                                  Falta de {t.valorMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (Custo Líq.)
                                </span>
                              ) : (
                                <span style={{ color: '#aaa', fontSize: '0.78rem' }}>Inventário Equilibrado (R$ 0)</span>
                              )
                            ) : !t.hasHistory ? (
                              <span style={{ color: '#aaa', fontSize: '0.75rem' }}>Lançamento novo</span>
                            ) : t.desvioValor > 0 ? (
                              <span style={{ color: '#ff8a80', fontSize: '0.78rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <AlertTriangle size={13} />
                                +{t.desvioValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} custo extra
                              </span>
                            ) : (
                              <span style={{ color: '#81c784', fontSize: '0.78rem', fontWeight: 'bold' }}>
                                Economia de {Math.abs(t.desvioValor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            )}
                          </td>
                          <td>
                            {topItem ? (
                              <div style={{ fontSize: '0.78rem' }}>
                                <div style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>
                                  {topItem.produto} <span style={{ color: '#ccc', fontWeight: 'normal' }}>({topItem.pctDoTM.toFixed(0)}% do TM)</span>
                                </div>
                                <div style={{ color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                                  {topItem.descricao}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: '#666' }}>-</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{
                              background: t.statusColor + '22',
                              color: t.statusColor,
                              border: `1px solid ${t.statusColor}66`,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 'bold',
                              whiteSpace: 'nowrap'
                            }}>
                              {t.statusLabel}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => setSelectedTMForModal(t)}
                              style={{
                                background: isCritical ? 'rgba(239, 83, 80, 0.2)' : 'rgba(33, 150, 243, 0.15)',
                                color: isCritical ? '#ff8a80' : '#64B5F6',
                                border: `1px solid ${isCritical ? '#ef5350' : '#3399ff'}66`,
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '0.76rem',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Target size={13} /> Questionar PCP
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SEÇÃO SECUNDÁRIA: EVOLUÇÃO TEMPORAL & FILIAIS */}
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
              <div style={{ width: '100%', height: '260px' }}>
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
                    <Bar dataKey="Inventário (506/006)" fill={CRITICAL_TMS['506_006']?.color || '#26a69a'} stackId="a" />
                    <Bar dataKey="Garantia (509)" fill={CRITICAL_TMS['509'].color} stackId="a" />
                    <Bar dataKey="Perda Mat. (507)" fill={CRITICAL_TMS['507'].color} stackId="a" />
                    <Bar dataKey="Consumível (504)" fill={CRITICAL_TMS['504'].color} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Visão por Filial */}
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
                <div style={{ width: '100%', height: '260px' }}>
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
      {/* ABA 2: ANÁLISE DETALHADA DE DESVIOS (TM & PRODUTOS) */}
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
                Identificação de distorções por Tipo de Movimento (PCP) e detalhamento por item em relação aos {kpis.numPrevMonths} meses anteriores
              </p>
            </div>

            {/* SUB-ABAS: VISÃO POR TM VS VISÃO POR ITEM */}
            <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.4)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setSubTabDesvios('tm')}
                style={{
                  background: subTabDesvios === 'tm' ? '#2196F3' : 'transparent',
                  color: subTabDesvios === 'tm' ? '#fff' : '#aaa',
                  border: 'none',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Target size={14} /> Por Tipo de Movimento ({analysisByTM.length})
              </button>

              <button
                onClick={() => setSubTabDesvios('produto')}
                style={{
                  background: subTabDesvios === 'produto' ? '#2196F3' : 'transparent',
                  color: subTabDesvios === 'produto' ? '#fff' : '#aaa',
                  border: 'none',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Package size={14} /> Detalhe por Produto ({analysisByProduct.length})
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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

          {/* SUB-ABA 1: AUDITORIA POR TIPO DE MOVIMENTO (TM & PCP) */}
          {subTabDesvios === 'tm' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.2rem', marginTop: '1rem' }}>
              {analysisByTM.map((t, idx) => {
                const isCritical = t.status === 'critico';
                return (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${t.color}55`,
                      borderLeft: `5px solid ${t.color}`,
                      borderRadius: '10px',
                      padding: '1.2rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      {/* Top Header do Card de TM */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '1.2rem' }}>{t.icon || '📋'}</span>
                            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1rem' }}>{t.label}</span>
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#888', marginTop: '2px' }}>
                            {t.lancamentosCount} lançamento(s) | {t.qtdSaidaMes.toLocaleString('pt-BR')} peças movimentadas
                          </div>
                        </div>

                        <span style={{
                          background: t.statusColor + '22',
                          color: t.statusColor,
                          border: `1px solid ${t.statusColor}66`,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.74rem',
                          fontWeight: 'bold',
                          whiteSpace: 'nowrap'
                        }}>
                          {t.statusLabel}
                        </span>
                      </div>

                      {/* Métricas Financeiras */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: t.isNetInv ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
                        gap: '8px',
                        background: 'rgba(0,0,0,0.25)',
                        padding: '0.7rem',
                        borderRadius: '8px',
                        marginBottom: '0.8rem'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#888' }}>{t.isNetInv ? 'Líquido' : 'Mês Atual'}</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: t.isNetInv ? (t.valorMes < 0 ? '#80cbc4' : '#ff8a80') : '#fff' }}>
                            {t.isNetInv && t.valorMes < 0 ? `- ${Math.abs(t.valorMes).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : t.valorMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                        </div>
                        {t.isNetInv && (
                          <div>
                            <div style={{ fontSize: '0.7rem', color: '#888' }}>506 / 006</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#ccc' }}>
                              <span style={{ color: '#ff8a80' }}>{((t.totalSaida506 || 0) / 1000).toFixed(0)}k</span> / <span style={{ color: '#80cbc4' }}>{((t.totalEntrada006 || 0) / 1000).toFixed(0)}k</span>
                            </div>
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#888' }}>Média Hist.</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#aaa' }}>
                            {t.hasHistory ? t.mediaHistorica.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#888' }}>Desvio R$</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: !t.hasHistory ? '#888' : t.desvioValor > 0 ? '#ef5350' : '#81c784' }}>
                            {!t.hasHistory ? '-' : `${t.desvioValor > 0 ? '+' : ''}${t.desvioValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                          </div>
                        </div>
                      </div>

                      {/* Questionamento PCP */}
                      <div style={{
                        background: 'rgba(33, 150, 243, 0.08)',
                        border: '1px dashed rgba(33, 150, 243, 0.3)',
                        borderRadius: '8px',
                        padding: '0.6rem 0.8rem',
                        marginBottom: '0.8rem',
                        fontSize: '0.76rem',
                        color: '#90CAF9',
                        lineHeight: '1.3'
                      }}>
                        <strong>🎯 Questionamento PCP:</strong> {t.question}
                      </div>

                      {/* Top Vilões do TM */}
                      <div>
                        <div style={{ fontSize: '0.74rem', color: '#aaa', fontWeight: 'bold', marginBottom: '4px' }}>
                          Principais Itens com Maior Custo neste TM:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {t.topProdutos.slice(0, 3).map((p, pIdx) => (
                            <div key={pIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', background: 'rgba(255,255,255,0.02)', padding: '3px 6px', borderRadius: '4px' }}>
                              <span style={{ color: 'var(--color-primary)', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '210px' }}>
                                {p.produto} - {p.descricao}
                              </span>
                              <span style={{ color: '#fff', fontWeight: 'bold' }}>
                                {p.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({p.pctDoTM.toFixed(0)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Botão para Abrir Auditoria Completa */}
                    <div style={{ marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <button
                        onClick={() => setSelectedTMForModal(t)}
                        style={{
                          width: '100%',
                          background: isCritical ? 'rgba(239, 83, 80, 0.2)' : 'rgba(33, 150, 243, 0.15)',
                          color: isCritical ? '#ff8a80' : '#64B5F6',
                          border: `1px solid ${isCritical ? '#ef5350' : '#2196F3'}66`,
                          borderRadius: '6px',
                          padding: '0.5rem',
                          fontSize: '0.82rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <Target size={15} /> Abrir Auditoria Completa & Lançamentos do TM
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* SUB-ABA 2: DETALHAMENTO POR ITEM DE ESTOQUE */}
          {subTabDesvios === 'produto' && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                      style={{ paddingLeft: '32px', width: '240px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* TABELA DE DESVIOS POR PRODUTO */}
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
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ margin: 0, color: '#FFB74D', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={22} />
                Importação Multi-Filial & Banco de Dados
              </h3>
              <p style={{ margin: '4px 0 0 0', color: '#aaa', fontSize: '0.85rem' }}>
                Reconhecimento automático dos códigos de filiais do Protheus (0101..0106, 0201..0203, 0301, 0401..0403). Suba em lote ou arquivo por arquivo.
              </p>
            </div>

            <button
              onClick={() => setIsFiliaisModalOpen(true)}
              style={{
                background: 'rgba(255, 152, 0, 0.15)',
                color: '#FFB74D',
                border: '1px solid rgba(255, 152, 0, 0.4)',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 152, 0, 0.25)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 152, 0, 0.15)'}
            >
              <GitBranch size={16} /> ⚙️ Cadastrar & Gerenciar Filiais
            </button>
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
                📁 Selecionar Planilhas das Filiais (Pode selecionar múltiplos arquivos .xlsx de uma vez):
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
                💡 Dica: Você pode segurar <strong>Ctrl</strong> ou <strong>Shift</strong> para selecionar todos os arquivos de filiais (`MOVIMENTAÇÕES INTERNAS 0101.xlsx` a `0106.xlsx`) juntos!
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

                {/* Tabela Interativa de Conferência das Filiais Carregadas */}
                <div style={{ marginTop: '0.8rem' }}>
                  <div style={{ fontSize: '0.8rem', color: '#bbb', marginBottom: '8px', fontWeight: 'bold' }}>
                    📋 Conferência dos Arquivos & Filiais Associadas (Você pode alterar a filial pelo seletor caso desejar):
                  </div>
                  <div className="table-wrapper" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Arquivo da Pasta</th>
                          <th>Filial Associada</th>
                          <th style={{ textAlign: 'right' }}>Lançamentos</th>
                          <th style={{ textAlign: 'right' }}>Valor Total</th>
                          <th>Empresa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewStats.arquivos.map((af, idx) => {
                          const filiaisDaEmpresa = cadastrosFiliais.filter(f => f.empresaId === importEmpresa);
                          return (
                            <tr key={idx}>
                              <td style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FileSpreadsheet size={16} style={{ color: '#81C784' }} />
                                <strong>{af.filename}</strong>
                              </td>
                              <td>
                                <select
                                  value={af.filial}
                                  onChange={(e) => handleUpdateFileFilial(af.filename, e.target.value)}
                                  className="select-input"
                                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem', borderColor: '#81C784', minWidth: '180px' }}
                                >
                                  {filiaisDaEmpresa.map(f => (
                                    <option key={f.code} value={f.name}>{f.name}</option>
                                  ))}
                                  {!filiaisDaEmpresa.some(f => f.name === af.filial || f.code === af.filial) && (
                                    <option value={af.filial}>{af.filial}</option>
                                  )}
                                </select>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                {af.linhas.toLocaleString('pt-BR')}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#81C784' }}>
                                {af.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </td>
                              <td style={{ color: '#aaa', fontSize: '0.8rem' }}>
                                {af.suggestedEmpresaName || companies.find(c => c.id === importEmpresa)?.name || 'Atual'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
                              loadEstoqueData(comp.empresaId, comp.ano, comp.mes);
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

      {/* ----------------------------------------------------------------- */}
      {/* MODAL DE AUDITORIA DO TIPO DE MOVIMENTO (TM & PCP) */}
      {/* ----------------------------------------------------------------- */}
      {selectedTMForModal && (
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
            background: '#161824',
            border: `1px solid ${selectedTMForModal.color || 'rgba(255, 255, 255, 0.2)'}`,
            borderRadius: '14px',
            width: '1150px',
            maxWidth: '96vw',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 60px rgba(0,0,0,0.9)'
          }}>
            
            {/* Modal Header */}
            <div style={{
              padding: '1.2rem 1.5rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(0,0,0,0.35)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: selectedTMForModal.bg || 'rgba(255, 255, 255, 0.1)',
                  padding: '8px',
                  borderRadius: '8px',
                  fontSize: '1.4rem'
                }}>
                  {selectedTMForModal.icon || '📋'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: selectedTMForModal.color || '#fff', fontWeight: 'bold', fontSize: '1.2rem' }}>
                      {selectedTMForModal.label}
                    </span>
                    <span style={{
                      background: selectedTMForModal.statusColor + '22',
                      color: selectedTMForModal.statusColor,
                      border: `1px solid ${selectedTMForModal.statusColor}66`,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold'
                    }}>
                      {selectedTMForModal.statusLabel}
                    </span>
                  </div>
                  <div style={{ color: '#888', fontSize: '0.8rem', marginTop: '3px' }}>
                    Competência: {MESES[selectedMes - 1]} / {selectedAno} | {selectedTMForModal.lancamentosCount} lançamento(s) | {selectedTMForModal.qtdSaidaMes.toLocaleString('pt-BR')} peças movimentadas
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedTMForModal(null)}
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

            {/* Modal Body */}
            <div style={{ padding: '1.2rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              
              {/* KPIS STRIP */}
              <div style={{ display: 'grid', gridTemplateColumns: selectedTMForModal.isNetInv ? 'repeat(auto-fit, minmax(160px, 1fr))' : 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.7rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '0.72rem', color: '#888' }}>{selectedTMForModal.isNetInv ? 'Resultado Líquido' : 'Total no Mês'}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: selectedTMForModal.isNetInv ? (selectedTMForModal.valorMes < 0 ? '#80cbc4' : '#ff8a80') : '#fff' }}>
                    {selectedTMForModal.isNetInv && selectedTMForModal.valorMes < 0 
                      ? `- ${Math.abs(selectedTMForModal.valorMes).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                      : selectedTMForModal.valorMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>

                {selectedTMForModal.isNetInv && (
                  <>
                    <div style={{ background: 'rgba(239, 83, 80, 0.06)', padding: '0.7rem', borderRadius: '8px', border: '1px solid rgba(239, 83, 80, 0.25)' }}>
                      <div style={{ fontSize: '0.72rem', color: '#ff8a80' }}>506 - Faltas (Saídas)</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ef5350' }}>
                        {(selectedTMForModal.totalSaida506 || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(38, 166, 154, 0.06)', padding: '0.7rem', borderRadius: '8px', border: '1px solid rgba(38, 166, 154, 0.25)' }}>
                      <div style={{ fontSize: '0.72rem', color: '#80cbc4' }}>006 - Sobras (Entradas)</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#26a69a' }}>
                        {(selectedTMForModal.totalEntrada006 || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    </div>
                  </>
                )}

                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.7rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '0.72rem', color: '#888' }}>Média Histórica Mensal</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#aaa' }}>
                    {selectedTMForModal.hasHistory ? selectedTMForModal.mediaHistorica.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Sem hist.'}
                  </div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.7rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '0.72rem', color: '#888' }}>Desvio em Valor</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: !selectedTMForModal.hasHistory ? '#888' : selectedTMForModal.desvioValor > 0 ? '#ef5350' : '#81c784' }}>
                    {!selectedTMForModal.hasHistory ? '-' : `${selectedTMForModal.desvioValor > 0 ? '+' : ''}${selectedTMForModal.desvioValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                  </div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.7rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '0.72rem', color: '#888' }}>Variação % vs Média</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: !selectedTMForModal.hasHistory ? '#29b6f6' : selectedTMForModal.desvioPct > 0 ? '#ef5350' : '#81c784' }}>
                    {!selectedTMForModal.hasHistory ? 'Novo TM' : `${selectedTMForModal.desvioPct > 0 ? '+' : ''}${selectedTMForModal.desvioPct.toFixed(1)}%`}
                  </div>
                </div>
              </div>

              {/* ROTEIRO DE QUESTIONAMENTO COM PCP / DIRETORIA */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.12), rgba(20, 24, 38, 0.8))',
                border: '1px solid rgba(33, 150, 243, 0.4)',
                borderRadius: '10px',
                padding: '1rem 1.2rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#90CAF9', fontWeight: 'bold', fontSize: '0.92rem', marginBottom: '6px' }}>
                  <Target size={18} /> Roteiro de Auditoria & Alinhamento com o PCP / Engenharia Fabril:
                </div>
                <p style={{ margin: '0 0 6px 0', color: '#fff', fontSize: '0.86rem', lineHeight: '1.4' }}>
                  👉 <strong>Pergunta-Chave:</strong> {selectedTMForModal.question}
                </p>
                <div style={{ fontSize: '0.78rem', color: '#ccc', display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '6px' }}>
                  <span>📌 <strong>Impacto no Resultado:</strong> {selectedTMForModal.desvioValor > 0 ? `Gerou um custo excedente de ${selectedTMForModal.desvioValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} na DRE fabril.` : 'Operação dentro ou abaixo da média histórica prevista.'}</span>
                  <span>📌 <strong>Ação Recomendada:</strong> Solicitar justificativa formal dos 3 maiores produtos ao responsável da fábrica.</span>
                </div>
              </div>

              {/* TOP PRODUTOS VILÕES DO TM */}
              <div>
                <h4 style={{ color: '#fff', margin: '0 0 0.6rem 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Package size={16} style={{ color: 'var(--color-primary)' }} />
                  Principais Produtos com Maior Custo neste TM (Vilões do Mês):
                </h4>
                <div className="table-wrapper" style={{ overflowX: 'hidden' }}>
                  <table className="data-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '110px' }}>Código</th>
                        <th style={{ width: 'auto' }}>Descrição do Produto</th>
                        <th style={{ width: '140px' }}>Filial(is)</th>
                        <th style={{ width: '85px', textAlign: 'right' }}>Qtd</th>
                        <th style={{ width: '125px', textAlign: 'right' }}>Custo Total</th>
                        <th style={{ width: '75px', textAlign: 'center' }}>% TM</th>
                        <th style={{ width: '90px', textAlign: 'center' }}>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTMForModal.topProdutos.map((p, idx) => (
                        <tr key={idx}>
                          <td style={{ color: 'var(--color-primary)', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.produto}>
                            {p.produto}
                          </td>
                          <td style={{ color: '#fff', fontWeight: '500', fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.descricao}>
                            {p.descricao?.length > 38 ? p.descricao.substring(0, 38) + '...' : p.descricao}
                          </td>
                          <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.filiaisArr?.join(', ') || 'MATRIZ'}>
                            <span style={{ background: 'rgba(255,255,255,0.06)', color: '#81C784', padding: '1px 5px', borderRadius: '4px', fontSize: '0.72rem' }}>
                              {p.filiaisArr?.join(', ') || 'MATRIZ'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.82rem' }}>{p.qtdSaida.toLocaleString('pt-BR')}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#ef5350', fontSize: '0.85rem' }}>
                            {p.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#ffb74d', fontSize: '0.82rem' }}>
                            {p.pctDoTM.toFixed(1)}%
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => setSelectedItemForModal(p)}
                              style={{
                                background: 'rgba(33, 150, 243, 0.15)',
                                color: '#64B5F6',
                                border: '1px solid rgba(33, 150, 243, 0.4)',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '0.72rem',
                                cursor: 'pointer'
                              }}
                            >
                              🔍 Ver {p.lancamentos.length}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TABELA DE TODOS OS LANÇAMENTOS DO TM NO MÊS */}
              <div>
                <h4 style={{ color: '#fff', margin: '0 0 0.6rem 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={16} /> Todos os Lançamentos deste Tipo de Movimento ({selectedTMForModal.records.length})
                </h4>
                <div className="table-wrapper" style={{ maxHeight: '250px', overflowY: 'auto', overflowX: 'hidden' }}>
                  <table className="data-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '110px' }}>Filial</th>
                        <th style={{ width: '80px' }}>Data</th>
                        <th style={{ width: '90px' }}>Documento</th>
                        <th style={{ width: '100px' }}>Código</th>
                        <th style={{ width: 'auto' }}>Descrição</th>
                        <th style={{ width: '75px', textAlign: 'right' }}>Qtd</th>
                        <th style={{ width: '110px', textAlign: 'right' }}>Custo Total</th>
                        <th style={{ width: '100px' }}>Centro Custo</th>
                        <th style={{ width: '85px' }}>Usuário</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTMForModal.records.map((r, idx) => (
                        <tr key={idx}>
                          <td style={{ color: '#81C784', fontWeight: 'bold', fontSize: '0.76rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.filial || '-'}>
                            {r.filial || '-'}
                          </td>
                          <td style={{ fontSize: '0.76rem', color: '#ccc' }}>{r.dtEmissao || '-'}</td>
                          <td style={{ fontSize: '0.76rem', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.documento || '-'}>
                            {r.documento || '-'}
                          </td>
                          <td style={{ color: 'var(--color-primary)', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.produto}>
                            {r.produto}
                          </td>
                          <td style={{ color: '#fff', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descricao}>
                            {r.descricao?.length > 32 ? r.descricao.substring(0, 32) + '...' : r.descricao}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.78rem' }}>{r.qtdSaida?.toLocaleString('pt-BR') || '-'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#fff', fontSize: '0.78rem' }}>
                            {r.custoTotal?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td style={{ fontSize: '0.74rem', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.cc || '-'}>
                            {r.cc || '-'}
                          </td>
                          <td style={{ color: '#aaa', fontSize: '0.74rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.usuario || '-'}>
                            {r.usuario || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

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
                onClick={() => setSelectedTMForModal(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  padding: '0.4rem 1.2rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Fechar Auditoria
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO E GERENCIAMENTO DINÂMICO DE FILIAIS */}
      {isFiliaisModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#1a1f2c',
            border: '1px solid rgba(255, 152, 0, 0.4)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '780px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 60px rgba(0,0,0,0.9)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.2rem 1.5rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(0,0,0,0.35)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: 'rgba(255, 152, 0, 0.2)',
                  color: '#FFB74D',
                  padding: '8px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <GitBranch size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem' }}>
                    Cadastro & Gerenciamento de Filiais (Protheus)
                  </h3>
                  <div style={{ color: '#888', fontSize: '0.78rem', marginTop: '2px' }}>
                    Adicione ou edite filiais para o reconhecimento automático das planilhas de estoque
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsFiliaisModalOpen(false);
                  setEditingFilialCode(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#aaa',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.2rem 1.5rem', overflowY: 'auto', flex: 1 }}>
              {/* Tabs por Empresa */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
                {[
                  { id: 'equipamentos', label: '01 - AGF Equipamentos', prefix: '01' },
                  { id: 'casa', label: '02 - Casa da Escavadeira', prefix: '02' },
                  { id: 'agf_participa_es', label: '03 - AGF Participações', prefix: '03' },
                  { id: 'rompedores', label: '04 - AGF Rompedores', prefix: '04' }
                ].map(emp => {
                  const isActive = filialEmpresaTab === emp.id;
                  const count = cadastrosFiliais.filter(f => f.empresaId === emp.id).length;
                  return (
                    <button
                      key={emp.id}
                      onClick={() => {
                        setFilialEmpresaTab(emp.id);
                        setEditingFilialCode(null);
                      }}
                      style={{
                        padding: '0.5rem 0.9rem',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        background: isActive ? '#FF9800' : 'rgba(255, 255, 255, 0.05)',
                        color: isActive ? '#000' : '#ccc',
                        border: isActive ? '1px solid #FF9800' : '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Building2 size={14} />
                      {emp.label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Formulário de Adicionar Nova Filial */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '1rem',
                marginBottom: '1.2rem'
              }}>
                <div style={{ fontSize: '0.82rem', color: '#FFB74D', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PlusCircle size={15} /> Cadastrar Nova Filial para {
                    filialEmpresaTab === 'equipamentos' ? 'AGF Equipamentos (01)' :
                    filialEmpresaTab === 'casa' ? 'Casa da Escavadeira (02)' :
                    filialEmpresaTab === 'agf_participa_es' ? 'AGF Participações (03)' : 'AGF Rompedores (04)'
                  }
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr auto', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Código (ex: 0107)"
                    value={newFilialForm.code}
                    onChange={(e) => setNewFilialForm({ ...newFilialForm, code: e.target.value })}
                    className="select-input"
                    style={{ padding: '0.5rem 0.7rem', fontSize: '0.82rem', fontFamily: 'monospace' }}
                  />
                  <input
                    type="text"
                    placeholder="Nome amigável (ex: 0107 - Filial Nova)"
                    value={newFilialForm.name}
                    onChange={(e) => setNewFilialForm({ ...newFilialForm, name: e.target.value })}
                    className="select-input"
                    style={{ padding: '0.5rem 0.7rem', fontSize: '0.82rem' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveNewFilial();
                    }}
                  />
                  <button
                    onClick={handleSaveNewFilial}
                    style={{
                      background: '#FF9800',
                      color: '#000',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <PlusCircle size={15} /> Adicionar
                  </button>
                </div>
                <small style={{ color: '#888', display: 'block', marginTop: '6px', fontSize: '0.74rem' }}>
                  💡 O código de 4 dígitos deve corresponder ao que vem no nome do arquivo extraído do Protheus (ex: <code>MOVIMENTAÇÕES INTERNAS 0101.xlsx</code>).
                </small>
              </div>

              {/* Tabela de Filiais Cadastradas */}
              <div style={{ fontSize: '0.82rem', color: '#ccc', fontWeight: 'bold', marginBottom: '8px' }}>
                Filiais Registradas ({cadastrosFiliais.filter(f => f.empresaId === filialEmpresaTab).length}):
              </div>
              <div className="table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '100px' }}>Código</th>
                      <th>Nome / Descrição</th>
                      <th style={{ width: '130px', textAlign: 'center' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cadastrosFiliais.filter(f => f.empresaId === filialEmpresaTab).map((filialItem) => {
                      const isEditing = editingFilialCode === filialItem.code;
                      return (
                        <tr key={filialItem.code}>
                          <td style={{ color: '#FFB74D', fontWeight: 'bold', fontFamily: 'monospace' }}>
                            {filialItem.code}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingFilialName}
                                onChange={(e) => setEditingFilialName(e.target.value)}
                                className="select-input"
                                style={{ width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.82rem' }}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditFilial(filialItem.code);
                                  if (e.key === 'Escape') setEditingFilialCode(null);
                                }}
                              />
                            ) : (
                              <span style={{ color: '#fff', fontWeight: '500' }}>{filialItem.name}</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                                <button
                                  onClick={() => handleSaveEditFilial(filialItem.code)}
                                  title="Salvar alteração"
                                  style={{
                                    background: 'rgba(76, 175, 80, 0.2)',
                                    color: '#81C784',
                                    border: '1px solid rgba(76, 175, 80, 0.4)',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                >
                                  <Save size={13} /> Salvar
                                </button>
                                <button
                                  onClick={() => setEditingFilialCode(null)}
                                  title="Cancelar"
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    color: '#aaa',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                <button
                                  onClick={() => {
                                    setEditingFilialCode(filialItem.code);
                                    setEditingFilialName(filialItem.name);
                                  }}
                                  title="Editar nome"
                                  style={{
                                    background: 'rgba(33, 150, 243, 0.15)',
                                    color: '#64B5F6',
                                    border: '1px solid rgba(33, 150, 243, 0.4)',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                >
                                  <Edit2 size={13} /> Editar
                                </button>
                                <button
                                  onClick={() => handleDeleteFilial(filialItem)}
                                  title="Excluir filial"
                                  style={{
                                    background: 'rgba(239, 83, 80, 0.15)',
                                    color: '#E57373',
                                    border: '1px solid rgba(239, 83, 80, 0.4)',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '0.8rem 1.5rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(0,0,0,0.3)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <button
                onClick={handleResetFiliais}
                style={{
                  background: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#888',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <RefreshCw size={13} /> Restaurar Padrões Protheus
              </button>

              <button
                onClick={() => {
                  setIsFiliaisModalOpen(false);
                  setEditingFilialCode(null);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  padding: '0.45rem 1.2rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.85rem'
                }}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
