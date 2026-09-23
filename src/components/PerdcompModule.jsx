import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { 
  Plus, Trash2, Edit2, Save, X, DollarSign, FileText, 
  TrendingUp, ArrowRight, Percent, Clock, Layers, 
  Search, Download, RefreshCw, Calculator, Copy, Check 
} from "lucide-react";
import * as XLSX from "xlsx";

// Funções utilitárias de formatação
const formatCurrency = (val) => {
  if (val === undefined || val === null || isNaN(val)) return "R$ 0,00";
  return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatPercent = (val) => {
  if (val === undefined || val === null || isNaN(val)) return "0,00%";
  return Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
};

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  if (dateStr.includes("/")) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

// Componente de input monetário
const CurrencyInput = ({ value, onChange, placeholder, style }) => {
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    const num = Number(value || 0);
    setDisplayValue(num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }, [value]);

  const handleBlur = (e) => {
    let val = e.target.value.replace(/[^\d,-]/g, "").replace(",", ".");
    const num = parseFloat(val) || 0;
    setDisplayValue(num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    onChange(num);
  };

  const handleChange = (e) => {
    setDisplayValue(e.target.value);
  };

  return (
    <input
      type="text"
      className="text-input"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder || "0,00"}
      style={{ width: "100%", textAlign: "right", ...(style || {}) }}
    />
  );
};

// Base inicial padrão baseada fielmente na planilha real do usuário
const INITIAL_CREDITOS = [
  {
    id: 1,
    empresaId: "equipamentos",
    tipoCredito: "IPI",
    numeroPerdcomp: "11035.29459.240526.1.1.01-4084",
    dataTransmissao: "2026-05-24",
    valorCredito: 240375.99,
    periodoApuracao: "1º TRIMESTRE 2026",
    descricaoOrigem: "Entradas",
    observacao: "PGD- ACABOU CRÉDITO",
    dataAtualizacao: "2026-08-26",
    incideJuros: false,
    taxaJurosCustom: 0
  },
  {
    id: 2,
    empresaId: "equipamentos",
    tipoCredito: "IPI",
    numeroPerdcomp: "10672.79186.240826.1.1.01-8205",
    dataTransmissao: "2026-08-24",
    valorCredito: 180462.67,
    periodoApuracao: "2º TRIMESTRE 2026",
    descricaoOrigem: "Entradas",
    observacao: "PGD- 51,14% DISPONÍVEL",
    dataAtualizacao: "2026-08-26",
    incideJuros: false,
    taxaJurosCustom: 0
  },
  {
    id: 3,
    empresaId: "equipamentos",
    tipoCredito: "IRPJ",
    numeroPerdcomp: "23077.15552.310726.1.2.02-9739",
    dataTransmissao: "2026-07-31",
    valorCredito: 594463.69,
    periodoApuracao: "01/2025 A 12/2025",
    descricaoOrigem: "Saldo Negativo de IRPJ",
    observacao: "ECAC- 100% DISPONÍVEL",
    dataAtualizacao: "2026-08-26",
    incideJuros: true,
    dataBaseJuros: "2026-01-01",
    taxaJurosCustom: 8.5
  },
  {
    id: 4,
    empresaId: "equipamentos",
    tipoCredito: "CSLL",
    numeroPerdcomp: "17403.57297.310726.1.2.03-8032",
    dataTransmissao: "2026-07-31",
    valorCredito: 396267.31,
    periodoApuracao: "01/2025 A 12/2025",
    descricaoOrigem: "Saldo Negativo de CSLL",
    observacao: "ECAC- 100% DISPONÍVEL",
    dataAtualizacao: "2026-08-26",
    incideJuros: true,
    dataBaseJuros: "2026-01-01",
    taxaJurosCustom: 8.5
  },
  {
    id: 5,
    empresaId: "equipamentos",
    tipoCredito: "IPI",
    numeroPerdcomp: "14265.37279.230226.1.1.01-6607",
    dataTransmissao: "2026-02-25",
    valorCredito: 102010.30,
    periodoApuracao: "4º TRIMESTRE 2025",
    descricaoOrigem: "Entradas",
    observacao: "PGD- ACABOU CRÉDITO",
    dataAtualizacao: "2026-08-26",
    incideJuros: false,
    taxaJurosCustom: 0
  },
  {
    id: 6,
    empresaId: "equipamentos",
    tipoCredito: "IRRF",
    numeroPerdcomp: "23843.73863.020926.1.2.04-1399",
    dataTransmissao: "2026-09-02",
    valorCredito: 1811.40,
    periodoApuracao: "17/08/2026",
    descricaoOrigem: "IRRF APLICAÇÃO FINANCEIRA",
    observacao: "BANCO ITAÚ ERROU- ERA CDE",
    dataAtualizacao: "2026-09-02",
    incideJuros: true,
    dataBaseJuros: "2026-09-01",
    taxaJurosCustom: 2.0
  }
];

const INITIAL_COMPENSACOES = [
  {
    id: 1,
    creditoId: 2,
    tipoCredito: "IPI",
    numeroPerdcompOrigem: "10672.79186.240826.1.1.01-8205",
    dataCompensacao: "2026-08-25",
    numeroPerdcompCompensacao: "25886.65282.250826.1.3.01-4600",
    tributoCompensado: "COFINS",
    valorCompensado: 73425.42,
    periodoApuracao: "jul/26",
    status: "Homologado",
    observacao: ""
  },
  {
    id: 2,
    creditoId: 2,
    tipoCredito: "IPI",
    numeroPerdcompOrigem: "10672.79186.240826.1.1.01-8205",
    dataCompensacao: "2026-08-25",
    numeroPerdcompCompensacao: "25886.65282.250826.1.3.01-4600",
    tributoCompensado: "PIS",
    valorCompensado: 14756.52,
    periodoApuracao: "jul/26",
    status: "Homologado",
    observacao: ""
  },
  {
    id: 3,
    creditoId: 1,
    tipoCredito: "IPI",
    numeroPerdcompOrigem: "11035.29459.240526.1.1.01-4084",
    dataCompensacao: "2026-07-24",
    numeroPerdcompCompensacao: "23462.57163.240726.1.3.01-4988",
    tributoCompensado: "COFINS",
    valorCompensado: 161186.20,
    periodoApuracao: "jun/26",
    status: "Homologado",
    observacao: ""
  },
  {
    id: 4,
    creditoId: 1,
    tipoCredito: "IPI",
    numeroPerdcompOrigem: "11035.29459.240526.1.1.01-4084",
    dataCompensacao: "2026-07-24",
    numeroPerdcompCompensacao: "23462.57163.240726.1.3.01-4988",
    tributoCompensado: "PIS",
    valorCompensado: 79189.79,
    periodoApuracao: "jun/26",
    status: "Homologado",
    observacao: ""
  },
  {
    id: 5,
    creditoId: 5,
    tipoCredito: "IPI",
    numeroPerdcompOrigem: "14265.37279.230226.1.1.01-6607",
    dataCompensacao: "2026-02-25",
    numeroPerdcompCompensacao: "29405.64762.250226.1.3.01-6180",
    tributoCompensado: "COFINS",
    valorCompensado: 102010.30,
    periodoApuracao: "jan/26",
    status: "Homologado",
    observacao: ""
  }
];

const TIPOS_TRIBUTOS = ["IPI", "IRPJ", "CSLL", "PIS", "COFINS", "OUTROS", "IRRF"];
const TRIBUTOS_DEBITO = ["COFINS", "PIS", "IRPJ", "CSLL", "IPI", "IRRF", "INSS", "OUTROS"];
const STATUS_COMPENSACAO = ["Homologado", "Em Análise", "Homologado Parcial", "Indeferido", "OK"];

export default function PerdcompModule({ companies = [], canEdit = true }) {
  const [activeTab, setActiveTab] = useState("painel"); // painel | creditos | compensacoes | juros
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  // Estados dos dados principais
  const [creditos, setCreditos] = useState([]);
  const [compensacoes, setCompensacoes] = useState([]);
  const [taxaSelicGlobal, setTaxaSelicGlobal] = useState(8.5);

  // Filtros
  const [filterEmpresa, setFilterEmpresa] = useState("todas");
  const [searchTerm, setSearchTerm] = useState("");

  // Modais
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [creditFormData, setCreditFormData] = useState(null);

  const [isCompModalOpen, setIsCompModalOpen] = useState(false);
  const [compFormData, setCompFormData] = useState(null);

  // Carregar dados do Supabase
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "agf_perdcomp_store_v2")
          .single();

        if (data && data.value) {
          const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
          if (parsed.creditos && Array.isArray(parsed.creditos)) {
            setCreditos(parsed.creditos);
          } else {
            setCreditos(INITIAL_CREDITOS);
          }
          if (parsed.compensacoes && Array.isArray(parsed.compensacoes)) {
            setCompensacoes(parsed.compensacoes);
          } else {
            setCompensacoes(INITIAL_COMPENSACOES);
          }
          if (parsed.taxaSelicGlobal !== undefined) {
            setTaxaSelicGlobal(Number(parsed.taxaSelicGlobal));
          }
        } else {
          // Primeira inicialização com dados oficiais
          setCreditos(INITIAL_CREDITOS);
          setCompensacoes(INITIAL_COMPENSACOES);
          await supabase.from("settings").upsert({
            key: "agf_perdcomp_store_v2",
            value: JSON.stringify({
              creditos: INITIAL_CREDITOS,
              compensacoes: INITIAL_COMPENSACOES,
              taxaSelicGlobal: 8.5
            })
          });
        }
      } catch (err) {
        console.error("Erro ao carregar dados PERDCOMP:", err);
        setCreditos(INITIAL_CREDITOS);
        setCompensacoes(INITIAL_COMPENSACOES);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Salvar no banco
  const saveDataToDb = async (newCreditos, newCompensacoes, newSelic = taxaSelicGlobal) => {
    setSaveStatus("saving");
    try {
      await supabase.from("settings").upsert({
        key: "agf_perdcomp_store_v2",
        value: JSON.stringify({
          creditos: newCreditos,
          compensacoes: newCompensacoes,
          taxaSelicGlobal: newSelic
        })
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 2500);
    } catch (e) {
      console.error("Erro ao salvar PERDCOMP no Supabase:", e);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(""), 3500);
    }
  };

  // Restaura para a base padrão da planilha
  const handleResetToDefault = async () => {
    if (window.confirm("Deseja restaurar todos os créditos e compensações para a base padrão da planilha?")) {
      setCreditos(INITIAL_CREDITOS);
      setCompensacoes(INITIAL_COMPENSACOES);
      setTaxaSelicGlobal(8.5);
      await saveDataToDb(INITIAL_CREDITOS, INITIAL_COMPENSACOES, 8.5);
    }
  };

  // Cálculo relacional dos créditos com compensações abatidas
  const creditosComSaldos = useMemo(() => {
    return creditos.map(cred => {
      const comps = compensacoes.filter(c => String(c.creditoId) === String(cred.id));
      const totalCompensado = comps.reduce((acc, c) => acc + Number(c.valorCompensado || 0), 0);
      const saldoDisponivel = Math.max(0, Number(cred.valorCredito || 0) - totalCompensado);
      const percUtilizado = cred.valorCredito > 0 ? (totalCompensado / cred.valorCredito) * 100 : 0;
      const taxaJuros = cred.incideJuros ? (cred.taxaJurosCustom !== undefined && cred.taxaJurosCustom !== null && cred.taxaJurosCustom !== 0 ? cred.taxaJurosCustom : taxaSelicGlobal) : 0;
      const jurosEstimados = cred.incideJuros ? (saldoDisponivel * (taxaJuros / 100)) : 0;
      const saldoComJuros = saldoDisponivel + jurosEstimados;

      return {
        ...cred,
        totalCompensado,
        saldoDisponivel,
        percUtilizado,
        taxaJuros,
        jurosEstimados,
        saldoComJuros,
        qtdCompensacoes: comps.length
      };
    });
  }, [creditos, compensacoes, taxaSelicGlobal]);

  // Filtro por empresa
  const creditosFiltrados = useMemo(() => {
    return creditosComSaldos.filter(c => {
      if (filterEmpresa !== "todas" && c.empresaId && c.empresaId !== filterEmpresa) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const num = (c.numeroPerdcomp || "").toLowerCase();
        const tipo = (c.tipoCredito || "").toLowerCase();
        const obs = (c.observacao || "").toLowerCase();
        const desc = (c.descricaoOrigem || "").toLowerCase();
        return num.includes(term) || tipo.includes(term) || obs.includes(term) || desc.includes(term);
      }
      return true;
    });
  }, [creditosComSaldos, filterEmpresa, searchTerm]);

  // Compensações enriquecidas com o saldo restante após cada compensação
  const compensacoesEnriquecidas = useMemo(() => {
    const list = [...compensacoes];
    // Calcular saldo cumulativo para cada compensação
    return list.map(comp => {
      const cred = creditos.find(c => String(c.id) === String(comp.creditoId));
      const valorCreditoOriginal = cred ? Number(cred.valorCredito || 0) : 0;
      
      // Soma de todas as compensações deste mesmo crédito até este ID
      const compsDoCredito = list.filter(c => String(c.creditoId) === String(comp.creditoId));
      const idx = compsDoCredito.findIndex(c => String(c.id) === String(comp.id));
      const compensadoAteAqui = compsDoCredito.slice(0, idx + 1).reduce((sum, c) => sum + Number(c.valorCompensado || 0), 0);
      const saldoApos = Math.max(0, valorCreditoOriginal - compensadoAteAqui);

      return {
        ...comp,
        saldoApos,
        nomeCredito: cred ? `${cred.tipoCredito} - ${cred.descricaoOrigem || cred.periodoApuracao}` : "Crédito não localizado"
      };
    });
  }, [compensacoes, creditos]);

  const compensacoesFiltradas = useMemo(() => {
    return compensacoesEnriquecidas.filter(c => {
      if (filterEmpresa !== "todas") {
        const cred = creditos.find(cr => String(cr.id) === String(c.creditoId));
        if (cred && cred.empresaId && cred.empresaId !== filterEmpresa) return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const numOrig = (c.numeroPerdcompOrigem || "").toLowerCase();
        const numComp = (c.numeroPerdcompCompensacao || "").toLowerCase();
        const trib = (c.tributoCompensado || "").toLowerCase();
        return numOrig.includes(term) || numComp.includes(term) || trib.includes(term);
      }
      return true;
    });
  }, [compensacoesEnriquecidas, filterEmpresa, searchTerm, creditos]);

  // Dados consolidados do Painel de Saldos por Tipo de Crédito
  const painelResumo = useMemo(() => {
    const rows = TIPOS_TRIBUTOS.map(tipo => {
      const credsTipo = creditosComSaldos.filter(c => {
        if (filterEmpresa !== "todas" && c.empresaId && c.empresaId !== filterEmpresa) return false;
        return (c.tipoCredito || "").toUpperCase() === tipo.toUpperCase();
      });

      const creditoOriginal = credsTipo.reduce((sum, c) => sum + Number(c.valorCredito || 0), 0);
      const totalCompensado = credsTipo.reduce((sum, c) => sum + Number(c.totalCompensado || 0), 0);
      const saldoDisponivel = Math.max(0, creditoOriginal - totalCompensado);
      const percUtilizado = creditoOriginal > 0 ? (totalCompensado / creditoOriginal) * 100 : 0;
      const jurosEstimados = credsTipo.reduce((sum, c) => sum + Number(c.jurosEstimados || 0), 0);
      const saldoComJuros = saldoDisponivel + jurosEstimados;

      let status = "SEM CRÉDITO";
      let statusColor = "#888";
      let statusBg = "rgba(255,255,255,0.05)";

      if (creditoOriginal > 0) {
        if (saldoDisponivel > 0) {
          status = "DISPONÍVEL";
          statusColor = "#10B981";
          statusBg = "rgba(16, 185, 129, 0.15)";
        } else {
          status = "ESGOTADO";
          statusColor = "#F59E0B";
          statusBg = "rgba(245, 158, 11, 0.15)";
        }
      }

      return {
        tipo,
        creditoOriginal,
        totalCompensado,
        saldoDisponivel,
        percUtilizado,
        status,
        statusColor,
        statusBg,
        jurosEstimados,
        saldoComJuros,
        qtdCreditos: credsTipo.length
      };
    });

    const totalOriginal = rows.reduce((sum, r) => sum + r.creditoOriginal, 0);
    const totalComp = rows.reduce((sum, r) => sum + r.totalCompensado, 0);
    const totalSaldo = rows.reduce((sum, r) => sum + r.saldoDisponivel, 0);
    const totalPerc = totalOriginal > 0 ? (totalComp / totalOriginal) * 100 : 0;
    const totalJuros = rows.reduce((sum, r) => sum + r.jurosEstimados, 0);
    const totalSaldoComJuros = totalSaldo + totalJuros;

    return {
      rows,
      total: {
        tipo: "TOTAL",
        creditoOriginal: totalOriginal,
        totalCompensado: totalComp,
        saldoDisponivel: totalSaldo,
        percUtilizado: totalPerc,
        status: "CONSOLIDADO",
        statusColor: "#3B82F6",
        statusBg: "rgba(59, 130, 246, 0.2)",
        jurosEstimados: totalJuros,
        saldoComJuros: totalSaldoComJuros
      }
    };
  }, [creditosComSaldos, filterEmpresa]);

  // Copiar número do PER/DCOMP
  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Abrir Modal de Crédito
  const handleOpenCreditModal = (credito = null) => {
    if (credito) {
      setCreditFormData({ ...credito });
    } else {
      const nextId = creditos.length > 0 ? Math.max(...creditos.map(c => Number(c.id) || 0)) + 1 : 1;
      setCreditFormData({
        id: nextId,
        empresaId: companies[0]?.id || "equipamentos",
        tipoCredito: "IPI",
        numeroPerdcomp: "",
        dataTransmissao: new Date().toISOString().split("T")[0],
        valorCredito: 0,
        periodoApuracao: "",
        descricaoOrigem: "",
        observacao: "",
        dataAtualizacao: new Date().toISOString().split("T")[0],
        incideJuros: false,
        taxaJurosCustom: 0
      });
    }
    setIsCreditModalOpen(true);
  };

  // Salvar Crédito
  const handleSaveCredit = async () => {
    if (!creditFormData.numeroPerdcomp || !creditFormData.valorCredito) {
      alert("Por favor, preencha o número do PER/DCOMP e o valor do crédito.");
      return;
    }

    let updated;
    const exists = creditos.find(c => String(c.id) === String(creditFormData.id));
    if (exists) {
      updated = creditos.map(c => String(c.id) === String(creditFormData.id) ? creditFormData : c);
    } else {
      updated = [...creditos, creditFormData];
    }

    setCreditos(updated);
    setIsCreditModalOpen(false);
    await saveDataToDb(updated, compensacoes);
  };

  // Excluir Crédito
  const handleDeleteCredit = async (id) => {
    const hasComps = compensacoes.some(c => String(c.creditoId) === String(id));
    let msg = "Tem certeza que deseja excluir este crédito?";
    if (hasComps) {
      msg = "ATENÇÃO: Existem compensações vinculadas a este crédito. Se você excluí-lo, essas compensações também serão removidas. Confirmar exclusão?";
    }
    if (window.confirm(msg)) {
      const updatedCreds = creditos.filter(c => String(c.id) !== String(id));
      const updatedComps = compensacoes.filter(c => String(c.creditoId) !== String(id));
      setCreditos(updatedCreds);
      setCompensacoes(updatedComps);
      await saveDataToDb(updatedCreds, updatedComps);
    }
  };

  // Abrir Modal de Compensação (DCOMP)
  const handleOpenCompModal = (comp = null, preSelectedCreditoId = null) => {
    if (comp) {
      setCompFormData({ ...comp });
    } else {
      const nextId = compensacoes.length > 0 ? Math.max(...compensacoes.map(c => Number(c.id) || 0)) + 1 : 1;
      const initialCredId = preSelectedCreditoId || (creditos[0]?.id || "");
      const selectedCred = creditos.find(c => String(c.id) === String(initialCredId));

      setCompFormData({
        id: nextId,
        creditoId: initialCredId,
        tipoCredito: selectedCred?.tipoCredito || "IPI",
        numeroPerdcompOrigem: selectedCred?.numeroPerdcomp || "",
        dataCompensacao: new Date().toISOString().split("T")[0],
        numeroPerdcompCompensacao: "",
        tributoCompensado: "COFINS",
        valorCompensado: 0,
        periodoApuracao: "",
        status: "Homologado",
        observacao: ""
      });
    }
    setIsCompModalOpen(true);
  };

  // Salvar Compensação
  const handleSaveComp = async () => {
    if (!compFormData.creditoId) {
      alert("Selecione o crédito de origem.");
      return;
    }
    if (!compFormData.valorCompensado || compFormData.valorCompensado <= 0) {
      alert("Informe um valor válido de compensação.");
      return;
    }

    // Validação de saldo disponível
    const cred = creditosComSaldos.find(c => String(c.id) === String(compFormData.creditoId));
    if (cred) {
      // Se for edição, desconsidera o valor antigo da própria compensação
      const valAntigo = compFormData.id ? (compensacoes.find(c => String(c.id) === String(compFormData.id))?.valorCompensado || 0) : 0;
      const saldoMaximo = cred.saldoDisponivel + valAntigo;

      if (compFormData.valorCompensado > saldoMaximo + 0.01) {
        const proceed = window.confirm(
          `AVISO: O valor informado (${formatCurrency(compFormData.valorCompensado)}) é maior que o saldo disponível deste crédito (${formatCurrency(saldoMaximo)}).\nDeseja salvar mesmo assim?`
        );
        if (!proceed) return;
      }
    }

    let updated;
    const exists = compensacoes.find(c => String(c.id) === String(compFormData.id));
    if (exists) {
      updated = compensacoes.map(c => String(c.id) === String(compFormData.id) ? compFormData : c);
    } else {
      updated = [...compensacoes, compFormData];
    }

    setCompensacoes(updated);
    setIsCompModalOpen(false);
    await saveDataToDb(creditos, updated);
  };

  // Excluir Compensação
  const handleDeleteComp = async (id) => {
    if (window.confirm("Deseja realmente excluir este lançamento de compensação?")) {
      const updated = compensacoes.filter(c => String(c.id) !== String(id));
      setCompensacoes(updated);
      await saveDataToDb(creditos, updated);
    }
  };

  // Exportar para Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Aba Painel de Saldos
    const painelData = painelResumo.rows.map(r => ({
      "Tipo de Crédito": r.tipo,
      "Crédito Original (R$)": r.creditoOriginal,
      "Total Compensado (R$)": r.totalCompensado,
      "Saldo Disponível (R$)": r.saldoDisponivel,
      "% Utilizado": (r.percUtilizado / 100),
      "Status": r.status,
      "Saldo com Juros Selic (R$)": r.saldoComJuros
    }));
    painelData.push({
      "Tipo de Crédito": "TOTAL CONSOLIDADO",
      "Crédito Original (R$)": painelResumo.total.creditoOriginal,
      "Total Compensado (R$)": painelResumo.total.totalCompensado,
      "Saldo Disponível (R$)": painelResumo.total.saldoDisponivel,
      "% Utilizado": (painelResumo.total.percUtilizado / 100),
      "Status": "CONSOLIDADO",
      "Saldo com Juros Selic (R$)": painelResumo.total.saldoComJuros
    });
    const wsPainel = XLSX.utils.json_to_sheet(painelData);
    XLSX.utils.book_append_sheet(wb, wsPainel, "Painel de Saldos");

    // 2. Aba Base de Créditos
    const credData = creditosComSaldos.map(c => ({
      "ID": c.id,
      "Tipo de Crédito": c.tipoCredito,
      "Nº PER/DCOMP Origem": c.numeroPerdcomp,
      "Data Transmissão": formatDate(c.dataTransmissao),
      "Valor do Crédito (R$)": c.valorCredito,
      "Total Compensado (R$)": c.totalCompensado,
      "Saldo Disponível (R$)": c.saldoDisponivel,
      "% Disponível": (100 - c.percUtilizado) / 100,
      "Período de Apuração": c.periodoApuracao,
      "Descrição/Origem": c.descricaoOrigem,
      "Observação": c.observacao,
      "Incide Juros Selic": c.incideJuros ? "SIM" : "NÃO",
      "Juros Estimados (R$)": c.jurosEstimados,
      "Saldo c/ Juros (R$)": c.saldoComJuros,
      "Atualizado Em": formatDate(c.dataAtualizacao)
    }));
    const wsCred = XLSX.utils.json_to_sheet(credData);
    XLSX.utils.book_append_sheet(wb, wsCred, "Base de Créditos");

    // 3. Aba Compensações
    const compData = compensacoesEnriquecidas.map(c => ({
      "ID Comp": c.id,
      "Tipo de Crédito": c.tipoCredito,
      "ID Crédito Origem": c.creditoId,
      "Nº PER/DCOMP Origem": c.numeroPerdcompOrigem,
      "Data Compensação": formatDate(c.dataCompensacao),
      "Nº PER/DCOMP Compensação": c.numeroPerdcompCompensacao,
      "Tributo Compensado": c.tributoCompensado,
      "Valor Compensado (R$)": c.valorCompensado,
      "Período de Apuração Débito": c.periodoApuracao,
      "Saldo do Crédito Após Comp. (R$)": c.saldoApos,
      "Status": c.status
    }));
    const wsComp = XLSX.utils.json_to_sheet(compData);
    XLSX.utils.book_append_sheet(wb, wsComp, "Compensações");

    XLSX.writeFile(wb, `Controle_PERDCOMP_AGF_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  if (loading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "#888" }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: "0 auto 1rem auto", color: "#3B82F6" }} />
        Carregando Controle Inteligente de PER/DCOMP...
      </div>
    );
  }

  return (
    <div style={{ padding: "1.2rem", maxWidth: "1600px", margin: "0 auto", color: "#e2e8f0" }}>
      {/* CABEÇALHO DO MÓDULO */}
      <div style={{
        display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center",
        gap: "1rem", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #334155"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "42px", height: "42px", borderRadius: "10px",
              background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)"
            }}>
              <Layers size={22} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.45rem", fontWeight: "700", color: "#f8fafc", letterSpacing: "-0.02em" }}>
                Controle de Créditos e Compensações PER/DCOMP
              </h2>
              <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                Gestão integrada de pedidos de restituição, ressarcimento, saldos negativos e DCOMPs com cálculo de SELIC
              </span>
            </div>
          </div>
        </div>

        {/* Ações e Controles Superiores */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {saveStatus === "saving" && (
            <span style={{ fontSize: "0.82rem", color: "#38bdf8", display: "flex", alignItems: "center", gap: "5px" }}>
              <RefreshCw size={14} className="animate-spin" /> Salvando...
            </span>
          )}
          {saveStatus === "saved" && (
            <span style={{ fontSize: "0.82rem", color: "#4ade80", display: "flex", alignItems: "center", gap: "5px" }}>
              <Check size={14} /> Salvo no banco!
            </span>
          )}

          {/* Filtro de Empresa */}
          <select
            className="text-input"
            value={filterEmpresa}
            onChange={e => setFilterEmpresa(e.target.value)}
            style={{
              padding: "7px 12px", background: "#1e293b", border: "1px solid #334155",
              color: "#f1f5f9", borderRadius: "8px", fontSize: "0.85rem"
            }}
          >
            <option value="todas">🏢 Todas as Empresas (Consolidado)</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Exportar Excel */}
          <button
            onClick={handleExportExcel}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "7px 14px", background: "#065f46", border: "1px solid #059669",
              color: "#ecfdf5", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem",
              fontWeight: "600", transition: "all 0.2s"
            }}
            title="Exportar dados para Excel (.xlsx)"
          >
            <Download size={15} /> Exportar Excel
          </button>

          {/* Botão de Reset/Padrão */}
          {canEdit && (
            <button
              onClick={handleResetToDefault}
              style={{
                display: "flex", alignItems: "center", gap: "5px",
                padding: "7px 10px", background: "transparent", border: "1px solid #475569",
                color: "#94a3b8", borderRadius: "8px", cursor: "pointer", fontSize: "0.8rem"
              }}
              title="Restaurar valores padrão da planilha"
            >
              <RefreshCw size={13} /> Resetar Padrão
            </button>
          )}
        </div>
      </div>

      {/* CARDS DE DESTAQUE / KPIS NO TOPO */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "1rem", marginBottom: "1.5rem"
      }}>
        {/* Card 1: Total Crédito Original */}
        <div style={{
          background: "linear-gradient(145deg, #1e293b 0%, #0f172a 100%)",
          padding: "1.25rem", borderRadius: "12px", border: "1px solid #334155",
          boxShadow: "0 4px 15px rgba(0,0,0,0.2)", position: "relative", overflow: "hidden"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Crédito Original Cadastrado
            </span>
            <div style={{ padding: "6px", background: "rgba(59, 130, 246, 0.15)", borderRadius: "8px" }}>
              <FileText size={18} color="#60a5fa" />
            </div>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: "800", color: "#f8fafc" }}>
            {formatCurrency(painelResumo.total.creditoOriginal)}
          </div>
          <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "0.4rem" }}>
            Total de {creditos.length} créditos transmitidos à RFB
          </div>
        </div>

        {/* Card 2: Total Compensado */}
        <div style={{
          background: "linear-gradient(145deg, #1e293b 0%, #0f172a 100%)",
          padding: "1.25rem", borderRadius: "12px", border: "1px solid #334155",
          boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Total Compensado (DCOMPs)
            </span>
            <div style={{ padding: "6px", background: "rgba(245, 158, 11, 0.15)", borderRadius: "8px" }}>
              <ArrowRight size={18} color="#fbbf24" />
            </div>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: "800", color: "#fbbf24" }}>
            {formatCurrency(painelResumo.total.totalCompensado)}
          </div>
          <div style={{ fontSize: "0.78rem", color: "#f59e0b", marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "4px" }}>
            <Percent size={13} /> {formatPercent(painelResumo.total.percUtilizado)} do crédito já utilizado
          </div>
        </div>

        {/* Card 3: Saldo Disponível */}
        <div style={{
          background: "linear-gradient(145deg, #064e3b 0%, #022c22 100%)",
          padding: "1.25rem", borderRadius: "12px", border: "1px solid #059669",
          boxShadow: "0 4px 15px rgba(16, 185, 129, 0.15)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: "600", color: "#a7f3d0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Saldo Disponível Principal
            </span>
            <div style={{ padding: "6px", background: "rgba(16, 185, 129, 0.25)", borderRadius: "8px" }}>
              <DollarSign size={18} color="#34d399" />
            </div>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: "800", color: "#ecfdf5" }}>
            {formatCurrency(painelResumo.total.saldoDisponivel)}
          </div>
          <div style={{ fontSize: "0.78rem", color: "#6ee7b7", marginTop: "0.4rem" }}>
            Disponível para compensação com novos tributos
          </div>
        </div>

        {/* Card 4: Projeção com Selic */}
        <div style={{
          background: "linear-gradient(145deg, #312e81 0%, #1e1b4b 100%)",
          padding: "1.25rem", borderRadius: "12px", border: "1px solid #4f46e5",
          boxShadow: "0 4px 15px rgba(79, 70, 229, 0.2)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: "600", color: "#c7d2fe", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Saldo c/ Atualização SELIC
            </span>
            <div style={{ padding: "6px", background: "rgba(99, 102, 241, 0.25)", borderRadius: "8px" }}>
              <TrendingUp size={18} color="#a5b4fc" />
            </div>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: "800", color: "#818cf8" }}>
            {formatCurrency(painelResumo.total.saldoComJuros)}
          </div>
          <div style={{ fontSize: "0.78rem", color: "#a5b4fc", marginTop: "0.4rem" }}>
            + {formatCurrency(painelResumo.total.jurosEstimados)} de juros estimados
          </div>
        </div>
      </div>

      {/* ABAS DE NAVEGAÇÃO */}
      <div style={{
        display: "flex", gap: "8px", borderBottom: "1px solid #334155",
        marginBottom: "1.5rem", overflowX: "auto"
      }}>
        <button
          onClick={() => setActiveTab("painel")}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "10px 18px", border: "none", background: "transparent",
            color: activeTab === "painel" ? "#38bdf8" : "#94a3b8",
            borderBottom: activeTab === "painel" ? "3px solid #38bdf8" : "3px solid transparent",
            fontWeight: activeTab === "painel" ? "700" : "500",
            cursor: "pointer", fontSize: "0.95rem", transition: "all 0.2s"
          }}
        >
          <Layers size={18} /> Painel de Saldos
        </button>

        <button
          onClick={() => setActiveTab("creditos")}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "10px 18px", border: "none", background: "transparent",
            color: activeTab === "creditos" ? "#38bdf8" : "#94a3b8",
            borderBottom: activeTab === "creditos" ? "3px solid #38bdf8" : "3px solid transparent",
            fontWeight: activeTab === "creditos" ? "700" : "500",
            cursor: "pointer", fontSize: "0.95rem", transition: "all 0.2s"
          }}
        >
          <FileText size={18} /> Base de Créditos ({creditos.length})
        </button>

        <button
          onClick={() => setActiveTab("compensacoes")}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "10px 18px", border: "none", background: "transparent",
            color: activeTab === "compensacoes" ? "#38bdf8" : "#94a3b8",
            borderBottom: activeTab === "compensacoes" ? "3px solid #38bdf8" : "3px solid transparent",
            fontWeight: activeTab === "compensacoes" ? "700" : "500",
            cursor: "pointer", fontSize: "0.95rem", transition: "all 0.2s"
          }}
        >
          <ArrowRight size={18} /> Compensações Lançadas ({compensacoes.length})
        </button>

        <button
          onClick={() => setActiveTab("juros")}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "10px 18px", border: "none", background: "transparent",
            color: activeTab === "juros" ? "#38bdf8" : "#94a3b8",
            borderBottom: activeTab === "juros" ? "3px solid #38bdf8" : "3px solid transparent",
            fontWeight: activeTab === "juros" ? "700" : "500",
            cursor: "pointer", fontSize: "0.95rem", transition: "all 0.2s"
          }}
        >
          <Calculator size={18} /> Previsão de Juros (SELIC)
        </button>
      </div>

      {/* ABA 1: PAINEL DE SALDOS */}
      {activeTab === "painel" && (
        <div>
          <div style={{
            background: "#1e293b", borderRadius: "12px", border: "1px solid #334155",
            overflow: "hidden", boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
          }}>
            <div style={{
              padding: "1rem 1.25rem", background: "linear-gradient(90deg, #1e3a8a 0%, #1e293b 100%)",
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700", color: "#fff" }}>
                  CONTROLE DE CRÉDITOS PER/DCOMP – PAINEL CONSOLIDADO
                </h3>
                <span style={{ fontSize: "0.8rem", color: "#93c5fd" }}>
                  Cálculo automático em tempo real a partir das abas Base de Créditos e Compensações
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                {canEdit && (
                  <button
                    onClick={() => handleOpenCompModal()}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: "7px 14px", background: "#2563eb", border: "none",
                      color: "#fff", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem",
                      fontWeight: "600", boxShadow: "0 2px 8px rgba(37,99,235,0.4)"
                    }}
                  >
                    <Plus size={16} /> Lançar Compensação
                  </button>
                )}
              </div>
            </div>

            <div className="table-container" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ background: "#0f172a", color: "#94a3b8", borderBottom: "2px solid #334155" }}>
                    <th style={{ padding: "12px 16px", fontWeight: "700" }}>Tipo de crédito</th>
                    <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: "700" }}>Crédito original</th>
                    <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: "700" }}>Total compensado</th>
                    <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: "700" }}>Saldo disponível</th>
                    <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "700", width: "160px" }}>% utilizado</th>
                    <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "700" }}>Status</th>
                    <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: "700", color: "#818cf8" }}>Saldo c/ Selic</th>
                  </tr>
                </thead>
                <tbody>
                  {painelResumo.rows.map((row) => (
                    <tr 
                      key={row.tipo}
                      style={{ 
                        borderBottom: "1px solid #334155", 
                        background: row.creditoOriginal > 0 ? "transparent" : "rgba(15, 23, 42, 0.4)",
                        transition: "background 0.15s"
                      }}
                    >
                      <td style={{ padding: "12px 16px", fontWeight: "700", color: row.creditoOriginal > 0 ? "#f8fafc" : "#64748b" }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: "6px",
                          background: row.tipo === "IPI" ? "rgba(59, 130, 246, 0.2)" : row.tipo === "IRPJ" ? "rgba(16, 185, 129, 0.2)" : row.tipo === "CSLL" ? "rgba(168, 85, 247, 0.2)" : "rgba(148, 163, 184, 0.15)",
                          color: row.tipo === "IPI" ? "#60a5fa" : row.tipo === "IRPJ" ? "#34d399" : row.tipo === "CSLL" ? "#c084fc" : "#94a3b8"
                        }}>
                          {row.tipo}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: row.creditoOriginal > 0 ? "#f1f5f9" : "#64748b" }}>
                        {formatCurrency(row.creditoOriginal)}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: row.totalCompensado > 0 ? "#fbbf24" : "#64748b" }}>
                        {formatCurrency(row.totalCompensado)}
                      </td>
                      <td style={{ 
                        padding: "12px 16px", textAlign: "right", fontWeight: "700",
                        color: row.saldoDisponivel > 0 ? "#34d399" : "#64748b"
                      }}>
                        {formatCurrency(row.saldoDisponivel)}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        {row.creditoOriginal > 0 ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                            <div style={{ flex: 1, height: "7px", background: "#334155", borderRadius: "4px", overflow: "hidden", maxWidth: "80px" }}>
                              <div style={{
                                width: `${Math.min(100, row.percUtilizado)}%`,
                                height: "100%",
                                background: row.percUtilizado >= 100 ? "#f59e0b" : "#3b82f6",
                                borderRadius: "4px"
                              }} />
                            </div>
                            <span style={{ fontSize: "0.8rem", color: "#cbd5e1", minWidth: "45px", textAlign: "right" }}>
                              {formatPercent(row.percUtilizado)}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: "0.8rem" }}>0,00%</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <span style={{
                          padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "700",
                          background: row.statusBg, color: row.statusColor
                        }}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: row.saldoComJuros > 0 ? "#a5b4fc" : "#64748b", fontWeight: "600" }}>
                        {formatCurrency(row.saldoComJuros)}
                      </td>
                    </tr>
                  ))}

                  {/* LINHA TOTAL CONSOLIDADA */}
                  <tr style={{ background: "#0f172a", borderTop: "2px solid #475569", fontWeight: "800" }}>
                    <td style={{ padding: "14px 16px", fontSize: "1rem", color: "#f8fafc" }}>
                      TOTAL
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontSize: "1rem", color: "#f8fafc" }}>
                      {formatCurrency(painelResumo.total.creditoOriginal)}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontSize: "1rem", color: "#fbbf24" }}>
                      {formatCurrency(painelResumo.total.totalCompensado)}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontSize: "1.05rem", color: "#34d399" }}>
                      {formatCurrency(painelResumo.total.saldoDisponivel)}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center", color: "#cbd5e1" }}>
                      {formatPercent(painelResumo.total.percUtilizado)}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      <span style={{
                        padding: "5px 12px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "800",
                        background: painelResumo.total.statusBg, color: painelResumo.total.statusColor
                      }}>
                        {painelResumo.total.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontSize: "1.05rem", color: "#818cf8" }}>
                      {formatCurrency(painelResumo.total.saldoComJuros)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ padding: "1rem 1.25rem", background: "rgba(15, 23, 42, 0.6)", borderTop: "1px solid #334155", fontSize: "0.82rem", color: "#94a3b8" }}>
              💡 <strong>Resumo Operacional:</strong> Os saldos disponíveis são abatidos automaticamente a cada nova compensação lançada na aba "Compensações". Para créditos de IRPJ e CSLL sujeitos a Selic, a projeção monetária já reflete o ganho estimado de juros acumulados até o período atual.
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: BASE DE CRÉDITOS */}
      {activeTab === "creditos" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, maxWidth: "400px" }}>
              <div style={{ position: "relative", width: "100%" }}>
                <Search size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                <input
                  type="text"
                  placeholder="Pesquisar por PER/DCOMP, tributo ou descrição..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                    width: "100%", padding: "8px 10px 8px 34px", background: "#1e293b",
                    border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc", fontSize: "0.85rem"
                  }}
                />
              </div>
            </div>

            {canEdit && (
              <button
                onClick={() => handleOpenCreditModal()}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "8px 16px", background: "#10b981", border: "none",
                  color: "#fff", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem",
                  fontWeight: "600", boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)"
                }}
              >
                <Plus size={16} /> Novo Crédito / Pedido
              </button>
            )}
          </div>

          <div style={{
            background: "#1e293b", borderRadius: "12px", border: "1px solid #334155",
            overflow: "hidden", boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
          }}>
            <div className="table-container" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#0f172a", color: "#94a3b8", borderBottom: "2px solid #334155" }}>
                    <th style={{ padding: "10px 14px", width: "50px" }}>ID</th>
                    <th style={{ padding: "10px 14px" }}>Tipo</th>
                    <th style={{ padding: "10px 14px" }}>Nº PER/DCOMP Origem</th>
                    <th style={{ padding: "10px 14px" }}>Data Transm.</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Valor Crédito</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Compensado</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Saldo Disponível</th>
                    <th style={{ padding: "10px 14px" }}>Período Apuração</th>
                    <th style={{ padding: "10px 14px" }}>Descrição / Origem</th>
                    <th style={{ padding: "10px 14px" }}>Observação</th>
                    <th style={{ padding: "10px 14px", textAlign: "center" }}>Juros Selic</th>
                    {canEdit && <th style={{ padding: "10px 14px", textAlign: "center", width: "120px" }}>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {creditosFiltrados.map((cred) => (
                    <tr 
                      key={cred.id}
                      style={{ 
                        borderBottom: "1px solid #334155",
                        background: cred.saldoDisponivel <= 0 ? "rgba(15, 23, 42, 0.4)" : "transparent"
                      }}
                    >
                      <td style={{ padding: "10px 14px", fontWeight: "700", color: "#94a3b8" }}>
                        #{cred.id}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: "6px", fontWeight: "700", fontSize: "0.78rem",
                          background: cred.tipoCredito === "IPI" ? "rgba(59, 130, 246, 0.2)" : cred.tipoCredito === "IRPJ" ? "rgba(16, 185, 129, 0.2)" : cred.tipoCredito === "CSLL" ? "rgba(168, 85, 247, 0.2)" : "rgba(148, 163, 184, 0.15)",
                          color: cred.tipoCredito === "IPI" ? "#60a5fa" : cred.tipoCredito === "IRPJ" ? "#34d399" : cred.tipoCredito === "CSLL" ? "#c084fc" : "#94a3b8"
                        }}>
                          {cred.tipoCredito}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "#f8fafc" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>{cred.numeroPerdcomp || "-"}</span>
                          {cred.numeroPerdcomp && (
                            <button
                              onClick={() => handleCopy(cred.numeroPerdcomp, `cred-${cred.id}`)}
                              style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: "2px" }}
                              title="Copiar número"
                            >
                              {copiedId === `cred-${cred.id}` ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#cbd5e1" }}>
                        {formatDate(cred.dataTransmissao)}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#f1f5f9", fontWeight: "600" }}>
                        {formatCurrency(cred.valorCredito)}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: cred.totalCompensado > 0 ? "#fbbf24" : "#64748b" }}>
                        {formatCurrency(cred.totalCompensado)}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: "700", color: cred.saldoDisponivel > 0 ? "#34d399" : "#64748b" }}>
                        <div>{formatCurrency(cred.saldoDisponivel)}</div>
                        <div style={{ fontSize: "0.72rem", color: cred.saldoDisponivel > 0 ? "#a7f3d0" : "#64748b" }}>
                          ({formatPercent(cred.valorCredito > 0 ? ((cred.saldoDisponivel / cred.valorCredito) * 100) : 0)} disp.)
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#cbd5e1" }}>
                        {cred.periodoApuracao || "-"}
                      </td>
                      <td style={{ padding: "10px 14px", color: "#94a3b8" }}>
                        {cred.descricaoOrigem || "-"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: "6px", fontSize: "0.75rem",
                          background: cred.observacao?.includes("ACABOU") ? "rgba(239, 68, 68, 0.15)" : cred.observacao?.includes("100%") ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                          color: cred.observacao?.includes("ACABOU") ? "#f87171" : cred.observacao?.includes("100%") ? "#34d399" : "#fbbf24"
                        }}>
                          {cred.observacao || "-"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        {cred.incideJuros ? (
                          <span style={{
                            padding: "2px 6px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: "700",
                            background: "rgba(99, 102, 241, 0.2)", color: "#818cf8"
                          }}>
                            SIM (+{cred.taxaJuros}%)
                          </span>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Não</span>
                        )}
                      </td>
                      {canEdit && (
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "center", alignItems: "center" }}>
                            {cred.saldoDisponivel > 0 && (
                              <button
                                onClick={() => handleOpenCompModal(null, cred.id)}
                                style={{
                                  background: "#2563eb", border: "none", color: "#fff",
                                  padding: "4px 8px", borderRadius: "4px", cursor: "pointer",
                                  fontSize: "0.75rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "3px"
                                }}
                                title="Lançar compensação com este crédito"
                              >
                                <Plus size={12} /> Comp.
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenCreditModal(cred)}
                              style={{ background: "transparent", border: "none", color: "#60a5fa", cursor: "pointer", padding: "4px" }}
                              title="Editar crédito"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteCredit(cred.id)}
                              style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}
                              title="Excluir crédito"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {creditosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={12} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                        Nenhum crédito localizado com os filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: COMPENSAÇÕES */}
      {activeTab === "compensacoes" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, maxWidth: "400px" }}>
              <div style={{ position: "relative", width: "100%" }}>
                <Search size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                <input
                  type="text"
                  placeholder="Pesquisar por PER/DCOMP, débito ou tributo..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                    width: "100%", padding: "8px 10px 8px 34px", background: "#1e293b",
                    border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc", fontSize: "0.85rem"
                  }}
                />
              </div>
            </div>

            {canEdit && (
              <button
                onClick={() => handleOpenCompModal()}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "8px 16px", background: "#2563eb", border: "none",
                  color: "#fff", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem",
                  fontWeight: "600", boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)"
                }}
              >
                <Plus size={16} /> Nova Compensação (DCOMP)
              </button>
            )}
          </div>

          <div style={{
            background: "#1e293b", borderRadius: "12px", border: "1px solid #334155",
            overflow: "hidden", boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
          }}>
            <div className="table-container" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#0f172a", color: "#94a3b8", borderBottom: "2px solid #334155" }}>
                    <th style={{ padding: "10px 14px", width: "60px" }}>ID Comp.</th>
                    <th style={{ padding: "10px 14px" }}>Tipo Crédito</th>
                    <th style={{ padding: "10px 14px", width: "70px" }}>ID Origem</th>
                    <th style={{ padding: "10px 14px" }}>Nº PER/DCOMP Origem</th>
                    <th style={{ padding: "10px 14px" }}>Data Comp.</th>
                    <th style={{ padding: "10px 14px" }}>Nº PER/DCOMP Compensação</th>
                    <th style={{ padding: "10px 14px" }}>Tributo Compensado</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Valor Compensado</th>
                    <th style={{ padding: "10px 14px" }}>Período Débito</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Saldo Restante</th>
                    <th style={{ padding: "10px 14px", textAlign: "center" }}>Status</th>
                    {canEdit && <th style={{ padding: "10px 14px", textAlign: "center", width: "90px" }}>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {compensacoesFiltradas.map((comp) => (
                    <tr key={comp.id} style={{ borderBottom: "1px solid #334155" }}>
                      <td style={{ padding: "10px 14px", fontWeight: "700", color: "#94a3b8" }}>
                        #{comp.id}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: "6px", fontWeight: "700", fontSize: "0.78rem",
                          background: comp.tipoCredito === "IPI" ? "rgba(59, 130, 246, 0.2)" : comp.tipoCredito === "IRPJ" ? "rgba(16, 185, 129, 0.2)" : "rgba(168, 85, 247, 0.2)",
                          color: comp.tipoCredito === "IPI" ? "#60a5fa" : comp.tipoCredito === "IRPJ" ? "#34d399" : "#c084fc"
                        }}>
                          {comp.tipoCredito}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#cbd5e1" }}>
                        Crédito #{comp.creditoId}
                      </td>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "#94a3b8" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>{comp.numeroPerdcompOrigem || "-"}</span>
                          {comp.numeroPerdcompOrigem && (
                            <button
                              onClick={() => handleCopy(comp.numeroPerdcompOrigem, `orig-${comp.id}`)}
                              style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: "2px" }}
                              title="Copiar número de origem"
                            >
                              {copiedId === `orig-${comp.id}` ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#cbd5e1" }}>
                        {formatDate(comp.dataCompensacao)}
                      </td>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "#fbbf24", fontWeight: "600" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>{comp.numeroPerdcompCompensacao || "-"}</span>
                          {comp.numeroPerdcompCompensacao && (
                            <button
                              onClick={() => handleCopy(comp.numeroPerdcompCompensacao, `comp-${comp.id}`)}
                              style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: "2px" }}
                              title="Copiar número da compensação"
                            >
                              {copiedId === `comp-${comp.id}` ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: "700", color: "#f8fafc" }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: "6px", fontSize: "0.78rem",
                          background: comp.tributoCompensado === "COFINS" ? "rgba(14, 165, 233, 0.2)" : comp.tributoCompensado === "PIS" ? "rgba(249, 115, 22, 0.2)" : "rgba(148, 163, 184, 0.15)",
                          color: comp.tributoCompensado === "COFINS" ? "#38bdf8" : comp.tributoCompensado === "PIS" ? "#fb923c" : "#cbd5e1"
                        }}>
                          {comp.tributoCompensado}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#fbbf24", fontWeight: "700" }}>
                        {formatCurrency(comp.valorCompensado)}
                      </td>
                      <td style={{ padding: "10px 14px", color: "#cbd5e1" }}>
                        {comp.periodoApuracao || "-"}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: comp.saldoApos > 0 ? "#34d399" : "#64748b", fontWeight: "600" }}>
                        {formatCurrency(comp.saldoApos)}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "700",
                          background: comp.status === "Homologado" || comp.status === "OK" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                          color: comp.status === "Homologado" || comp.status === "OK" ? "#34d399" : "#fbbf24"
                        }}>
                          {comp.status || "OK"}
                        </span>
                      </td>
                      {canEdit && (
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                            <button
                              onClick={() => handleOpenCompModal(comp)}
                              style={{ background: "transparent", border: "none", color: "#60a5fa", cursor: "pointer", padding: "4px" }}
                              title="Editar compensação"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteComp(comp.id)}
                              style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}
                              title="Excluir compensação"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {compensacoesFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={12} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                        Nenhuma compensação localizada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: PREVISÃO DE JUROS (SELIC) */}
      {activeTab === "juros" && (
        <div>
          {/* Card explicativo das regras fiscais */}
          <div style={{
            background: "linear-gradient(145deg, #1e1b4b 0%, #0f172a 100%)",
            padding: "1.5rem", borderRadius: "12px", border: "1px solid #4338ca",
            marginBottom: "1.5rem", boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
              <div style={{ flex: 1, minWidth: "300px" }}>
                <h3 style={{ margin: "0 0 0.5rem 0", color: "#c7d2fe", fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "8px" }}>
                  <TrendingUp size={20} color="#818cf8" />
                  Regras Legais de Atualização de Créditos Tributários pela Taxa SELIC
                </h3>
                <p style={{ margin: 0, fontSize: "0.86rem", color: "#94a3b8", lineHeight: "1.5" }}>
                  Conforme o Art. 39 da Lei nº 9.250/95 e Art. 73 da Lei nº 9.532/97, os créditos decorrentes de <strong>Saldo Negativo de IRPJ e CSLL</strong>, 
                  bem como <strong>pagamentos indevidos ou a maior</strong>, sofrem atualização monetária pelo índice da taxa <strong>SELIC acumulada</strong> a partir 
                  do mês subsequente ao encerramento do ano-calendário/pagamento até o mês anterior ao da efetiva restituição ou compensação, acrescida de 1% no mês do evento.
                </p>
              </div>

              {/* Controle de Taxa Selic Global */}
              <div style={{
                background: "rgba(15, 23, 42, 0.7)", padding: "1rem 1.25rem", borderRadius: "10px",
                border: "1px solid #4f46e5", display: "flex", flexDirection: "column", gap: "8px", minWidth: "220px"
              }}>
                <span style={{ fontSize: "0.8rem", color: "#a5b4fc", fontWeight: "600" }}>
                  Taxa SELIC Estimada Acumulada (%):
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={taxaSelicGlobal}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      setTaxaSelicGlobal(val);
                      saveDataToDb(creditos, compensacoes, val);
                    }}
                    style={{
                      width: "80px", padding: "6px 8px", background: "#1e293b", border: "1px solid #6366f1",
                      borderRadius: "6px", color: "#fff", fontSize: "1rem", fontWeight: "bold", textAlign: "right"
                    }}
                  />
                  <span style={{ color: "#a5b4fc", fontWeight: "bold" }}>%</span>
                </div>
                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                  Aplica-se aos créditos com previsão de juros
                </span>
              </div>
            </div>
          </div>

          {/* Tabela dos créditos com cálculo de juros */}
          <div style={{
            background: "#1e293b", borderRadius: "12px", border: "1px solid #334155",
            overflow: "hidden", boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
          }}>
            <div style={{ padding: "1rem 1.25rem", background: "#0f172a", borderBottom: "1px solid #334155" }}>
              <h4 style={{ margin: 0, color: "#f8fafc", fontSize: "0.98rem" }}>
                Detalhamento dos Créditos Sujeitos à Restituição / Atualização Monetária
              </h4>
            </div>

            <div className="table-container" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "rgba(15, 23, 42, 0.8)", color: "#94a3b8", borderBottom: "1px solid #334155" }}>
                    <th style={{ padding: "10px 14px" }}>Tributo</th>
                    <th style={{ padding: "10px 14px" }}>Nº PER/DCOMP</th>
                    <th style={{ padding: "10px 14px" }}>Descrição / Apuração</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Saldo Original Disp.</th>
                    <th style={{ padding: "10px 14px", textAlign: "center" }}>Taxa Selic</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", color: "#34d399" }}>Juros Projetados (R$)</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", color: "#818cf8", fontWeight: "700" }}>Saldo Total c/ Juros</th>
                    <th style={{ padding: "10px 14px" }}>Status / Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {creditosComSaldos.filter(c => c.incideJuros).map((cred) => (
                    <tr key={cred.id} style={{ borderBottom: "1px solid #334155" }}>
                      <td style={{ padding: "12px 14px", fontWeight: "700" }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: "6px",
                          background: cred.tipoCredito === "IRPJ" ? "rgba(16, 185, 129, 0.2)" : cred.tipoCredito === "CSLL" ? "rgba(168, 85, 247, 0.2)" : "rgba(59, 130, 246, 0.2)",
                          color: cred.tipoCredito === "IRPJ" ? "#34d399" : cred.tipoCredito === "CSLL" ? "#c084fc" : "#60a5fa"
                        }}>
                          {cred.tipoCredito}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", fontFamily: "monospace", color: "#f8fafc" }}>
                        {cred.numeroPerdcomp}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#cbd5e1" }}>
                        {cred.descricaoOrigem} ({cred.periodoApuracao})
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: "600", color: "#f1f5f9" }}>
                        {formatCurrency(cred.saldoDisponivel)}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center", color: "#a5b4fc", fontWeight: "600" }}>
                        {cred.taxaJuros}%
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: "#34d399", fontWeight: "700" }}>
                        + {formatCurrency(cred.jurosEstimados)}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: "#818cf8", fontWeight: "800", fontSize: "0.95rem" }}>
                        {formatCurrency(cred.saldoComJuros)}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#94a3b8" }}>
                        {cred.observacao || "Aguardando homologação"}
                      </td>
                    </tr>
                  ))}
                  {/* Linha Total da Simulação Selic */}
                  <tr style={{ background: "#0f172a", borderTop: "2px solid #4338ca", fontWeight: "800" }}>
                    <td colSpan={3} style={{ padding: "14px 16px", color: "#c7d2fe", fontSize: "0.95rem" }}>
                      TOTAL DOS CRÉDITOS CORRIGIDOS POR SELIC
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", color: "#f8fafc" }}>
                      {formatCurrency(creditosComSaldos.filter(c => c.incideJuros).reduce((s, c) => s + c.saldoDisponivel, 0))}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center", color: "#a5b4fc" }}>
                      Méd. {taxaSelicGlobal}%
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", color: "#34d399", fontSize: "1rem" }}>
                      + {formatCurrency(creditosComSaldos.filter(c => c.incideJuros).reduce((s, c) => s + c.jurosEstimados, 0))}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", color: "#818cf8", fontSize: "1.05rem" }}>
                      {formatCurrency(creditosComSaldos.filter(c => c.incideJuros).reduce((s, c) => s + c.saldoComJuros, 0))}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#34d399" }}>
                      Ganho Financeiro Real
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CRÉDITO (NOVO / EDITAR) */}
      {isCreditModalOpen && creditFormData && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, backdropFilter: "blur(3px)"
        }}>
          <div style={{
            background: "#1e293b", padding: "1.8rem", borderRadius: "12px", width: "92%", maxWidth: "750px",
            border: "1px solid #475569", boxShadow: "0 20px 40px rgba(0,0,0,0.6)", maxHeight: "90vh", overflowY: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid #334155", paddingBottom: "0.8rem" }}>
              <h3 style={{ margin: 0, color: "#38bdf8", fontSize: "1.25rem", display: "flex", alignItems: "center", gap: "8px" }}>
                <FileText size={20} />
                {creditos.some(c => String(c.id) === String(creditFormData.id)) ? "Editar Crédito PER/DCOMP" : "Cadastrar Novo Crédito / Pedido de Restituição"}
              </h3>
              <button onClick={() => setIsCreditModalOpen(false)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}>
                <X size={22} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.2rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", color: "#94a3b8", fontSize: "0.85rem" }}>Empresa</label>
                <select
                  className="text-input"
                  value={creditFormData.empresaId}
                  onChange={e => setCreditFormData({ ...creditFormData, empresaId: e.target.value })}
                  style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "6px" }}
                >
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", color: "#94a3b8", fontSize: "0.85rem" }}>Tipo de Tributo do Crédito</label>
                <select
                  className="text-input"
                  value={creditFormData.tipoCredito}
                  onChange={e => setCreditFormData({ ...creditFormData, tipoCredito: e.target.value })}
                  style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "6px" }}
                >
                  {TIPOS_TRIBUTOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", color: "#94a3b8", fontSize: "0.85rem" }}>Nº PER/DCOMP de Origem</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="Ex: 11035.29459.240526.1.1.01-4084"
                  value={creditFormData.numeroPerdcomp}
                  onChange={e => setCreditFormData({ ...creditFormData, numeroPerdcomp: e.target.value })}
                  style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "6px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", color: "#94a3b8", fontSize: "0.85rem" }}>Data da Transmissão</label>
                <input
                  type="date"
                  className="text-input"
                  value={creditFormData.dataTransmissao}
                  onChange={e => setCreditFormData({ ...creditFormData, dataTransmissao: e.target.value })}
                  style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "6px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", color: "#94a3b8", fontSize: "0.85rem" }}>Valor Original do Crédito (R$)</label>
                <CurrencyInput
                  value={creditFormData.valorCredito}
                  onChange={val => setCreditFormData({ ...creditFormData, valorCredito: val })}
                  style={{ padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#34d399", borderRadius: "6px", fontWeight: "bold" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", color: "#94a3b8", fontSize: "0.85rem" }}>Período de Apuração</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="Ex: 1º TRIMESTRE 2026 ou 01/2025 A 12/2025"
                  value={creditFormData.periodoApuracao}
                  onChange={e => setCreditFormData({ ...creditFormData, periodoApuracao: e.target.value })}
                  style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "6px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", color: "#94a3b8", fontSize: "0.85rem" }}>Descrição / Origem do Crédito</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="Ex: Entradas, Saldo Negativo de IRPJ, Aplicação Financeira..."
                  value={creditFormData.descricaoOrigem}
                  onChange={e => setCreditFormData({ ...creditFormData, descricaoOrigem: e.target.value })}
                  style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "6px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", color: "#94a3b8", fontSize: "0.85rem" }}>Observação / Status no ECAC / PGD</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="Ex: ECAC - 100% DISPONÍVEL ou PGD - 51,14% DISPONÍVEL"
                  value={creditFormData.observacao}
                  onChange={e => setCreditFormData({ ...creditFormData, observacao: e.target.value })}
                  style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "6px" }}
                />
              </div>
            </div>

            {/* Seção de Juros Selic */}
            <div style={{
              background: "#0f172a", padding: "1rem", borderRadius: "8px", border: "1px solid #334155",
              marginBottom: "1.5rem"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "0.8rem" }}>
                <input
                  type="checkbox"
                  id="chkIncideJuros"
                  checked={creditFormData.incideJuros || false}
                  onChange={e => setCreditFormData({ ...creditFormData, incideJuros: e.target.checked })}
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                />
                <label htmlFor="chkIncideJuros" style={{ color: "#f8fafc", fontSize: "0.9rem", fontWeight: "600", cursor: "pointer" }}>
                  Este crédito tem direito à atualização monetária com Juros (Taxa SELIC)?
                </label>
              </div>

              {creditFormData.incideJuros && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.5rem" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "0.3rem", color: "#94a3b8", fontSize: "0.8rem" }}>
                      Taxa Selic Customizada (%) (opcional, deixe 0 para usar a global de {taxaSelicGlobal}%):
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      className="text-input"
                      value={creditFormData.taxaJurosCustom || 0}
                      onChange={e => setCreditFormData({ ...creditFormData, taxaJurosCustom: parseFloat(e.target.value) || 0 })}
                      style={{ width: "100%", padding: "6px 8px", background: "#1e293b", border: "1px solid #4f46e5", color: "#fff", borderRadius: "6px" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "0.3rem", color: "#94a3b8", fontSize: "0.8rem" }}>
                      Data Base Inicial da Contagem dos Juros:
                    </label>
                    <input
                      type="date"
                      className="text-input"
                      value={creditFormData.dataBaseJuros || ""}
                      onChange={e => setCreditFormData({ ...creditFormData, dataBaseJuros: e.target.value })}
                      style={{ width: "100%", padding: "6px 8px", background: "#1e293b", border: "1px solid #4f46e5", color: "#fff", borderRadius: "6px" }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #334155", paddingTop: "1rem" }}>
              <button
                onClick={() => setIsCreditModalOpen(false)}
                style={{ padding: "8px 16px", background: "#334155", border: "none", color: "#e2e8f0", borderRadius: "6px", cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCredit}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "8px 20px", background: "#10b981", border: "none", color: "#fff",
                  borderRadius: "6px", cursor: "pointer", fontWeight: "600"
                }}
              >
                <Save size={16} /> Salvar Crédito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE COMPENSAÇÃO (DCOMP) */}
      {isCompModalOpen && compFormData && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, backdropFilter: "blur(3px)"
        }}>
          <div style={{
            background: "#1e293b", padding: "1.8rem", borderRadius: "12px", width: "92%", maxWidth: "750px",
            border: "1px solid #475569", boxShadow: "0 20px 40px rgba(0,0,0,0.6)", maxHeight: "90vh", overflowY: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid #334155", paddingBottom: "0.8rem" }}>
              <h3 style={{ margin: 0, color: "#38bdf8", fontSize: "1.25rem", display: "flex", alignItems: "center", gap: "8px" }}>
                <ArrowRight size={20} />
                {compensacoes.some(c => String(c.id) === String(compFormData.id)) ? "Editar Compensação (DCOMP)" : "Lançar Nova Compensação (DCOMP)"}
              </h3>
              <button onClick={() => setIsCompModalOpen(false)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}>
                <X size={22} />
              </button>
            </div>

            {/* SELEÇÃO DO CRÉDITO DE ORIGEM */}
            <div style={{
              background: "#0f172a", padding: "1rem", borderRadius: "8px", border: "1px solid #334155",
              marginBottom: "1.2rem"
            }}>
              <label style={{ display: "block", marginBottom: "0.4rem", color: "#38bdf8", fontWeight: "600", fontSize: "0.9rem" }}>
                Selecione o Crédito de Origem a ser utilizado:
              </label>
              <select
                className="text-input"
                value={compFormData.creditoId}
                onChange={e => {
                  const selId = e.target.value;
                  const selCred = creditosComSaldos.find(c => String(c.id) === String(selId));
                  setCompFormData({
                    ...compFormData,
                    creditoId: selId,
                    tipoCredito: selCred?.tipoCredito || "IPI",
                    numeroPerdcompOrigem: selCred?.numeroPerdcomp || ""
                  });
                }}
                style={{ width: "100%", padding: "10px", background: "#1e293b", border: "1px solid #475569", color: "#f8fafc", borderRadius: "6px", fontSize: "0.9rem" }}
              >
                <option value="">Selecione um crédito disponível...</option>
                {creditosComSaldos.map(c => (
                  <option key={c.id} value={c.id}>
                    #{c.id} - {c.tipoCredito} | Saldo Disponível: {formatCurrency(c.saldoDisponivel)} ({c.descricaoOrigem || c.periodoApuracao} - {c.numeroPerdcomp})
                  </option>
                ))}
              </select>

              {/* Informação do Saldo do Crédito Selecionado */}
              {(() => {
                const sel = creditosComSaldos.find(c => String(c.id) === String(compFormData.creditoId));
                if (!sel) return null;
                return (
                  <div style={{ marginTop: "0.8rem", display: "flex", gap: "1.5rem", fontSize: "0.85rem", color: "#cbd5e1" }}>
                    <div><strong>Valor Original:</strong> {formatCurrency(sel.valorCredito)}</div>
                    <div><strong>Já Compensado:</strong> {formatCurrency(sel.totalCompensado)}</div>
                    <div><strong style={{ color: "#34d399" }}>Saldo Restante:</strong> <span style={{ color: "#34d399", fontWeight: "bold" }}>{formatCurrency(sel.saldoDisponivel)}</span></div>
                  </div>
                );
              })()}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.2rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", color: "#94a3b8", fontSize: "0.85rem" }}>Nº PER/DCOMP da Compensação (DCOMP)</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="Ex: 25886.65282.250826.1.3.01-4600"
                  value={compFormData.numeroPerdcompCompensacao}
                  onChange={e => setCompFormData({ ...compFormData, numeroPerdcompCompensacao: e.target.value })}
                  style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#fbbf24", borderRadius: "6px", fontWeight: "bold" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", color: "#94a3b8", fontSize: "0.85rem" }}>Data da Compensação</label>
                <input
                  type="date"
                  className="text-input"
                  value={compFormData.dataCompensacao}
                  onChange={e => setCompFormData({ ...compFormData, dataCompensacao: e.target.value })}
                  style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "6px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", color: "#94a3b8", fontSize: "0.85rem" }}>Tributo Compensado (Débito a Pagar)</label>
                <select
                  className="text-input"
                  value={compFormData.tributoCompensado}
                  onChange={e => setCompFormData({ ...compFormData, tributoCompensado: e.target.value })}
                  style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "6px" }}
                >
                  {TRIBUTOS_DEBITO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", color: "#94a3b8", fontSize: "0.85rem" }}>Período de Apuração do Débito</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="Ex: jul/26, jun/26, 2º Trimestre 2026..."
                  value={compFormData.periodoApuracao}
                  onChange={e => setCompFormData({ ...compFormData, periodoApuracao: e.target.value })}
                  style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "6px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", color: "#94a3b8", fontSize: "0.85rem" }}>Valor Compensado (R$)</label>
                <CurrencyInput
                  value={compFormData.valorCompensado}
                  onChange={val => setCompFormData({ ...compFormData, valorCompensado: val })}
                  style={{ padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#fbbf24", borderRadius: "6px", fontWeight: "bold", fontSize: "1.05rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", color: "#94a3b8", fontSize: "0.85rem" }}>Status da DCOMP</label>
                <select
                  className="text-input"
                  value={compFormData.status}
                  onChange={e => setCompFormData({ ...compFormData, status: e.target.value })}
                  style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "6px" }}
                >
                  {STATUS_COMPENSACAO.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.4rem", color: "#94a3b8", fontSize: "0.85rem" }}>Observações Adicionais</label>
              <input
                type="text"
                className="text-input"
                placeholder="Ex: Compensado débito de PIS/COFINS folha/faturamento..."
                value={compFormData.observacao || ""}
                onChange={e => setCompFormData({ ...compFormData, observacao: e.target.value })}
                style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "6px" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #334155", paddingTop: "1rem", marginTop: "1.5rem" }}>
              <button
                onClick={() => setIsCompModalOpen(false)}
                style={{ padding: "8px 16px", background: "#334155", border: "none", color: "#e2e8f0", borderRadius: "6px", cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveComp}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "8px 20px", background: "#2563eb", border: "none", color: "#fff",
                  borderRadius: "6px", cursor: "pointer", fontWeight: "600"
                }}
              >
                <Save size={16} /> Salvar Compensação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}