import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { 
  Plus, Trash2, Edit2, Save, X, DollarSign, FileText, 
  TrendingUp, ArrowRight, Percent, Clock, Layers, 
  Search, Download, RefreshCw, Calculator, Copy, Check, Sparkles,
  ChevronDown, ChevronRight, ChevronsUpDown
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

// Constantes para Período de Apuração Padronizado
const MESES_APURACAO = [
  { val: "01", sigla: "jan", label: "Janeiro (01)" },
  { val: "02", sigla: "fev", label: "Fevereiro (02)" },
  { val: "03", sigla: "mar", label: "Março (03)" },
  { val: "04", sigla: "abr", label: "Abril (04)" },
  { val: "05", sigla: "mai", label: "Maio (05)" },
  { val: "06", sigla: "jun", label: "Junho (06)" },
  { val: "07", sigla: "jul", label: "Julho (07)" },
  { val: "08", sigla: "ago", label: "Agosto (08)" },
  { val: "09", sigla: "set", label: "Setembro (09)" },
  { val: "10", sigla: "out", label: "Outubro (10)" },
  { val: "11", sigla: "nov", label: "Novembro (11)" },
  { val: "12", sigla: "dez", label: "Dezembro (12)" }
];

const TRIMESTRES_APURACAO = [
  { val: "1T", label: "1º Trimestre (Jan-Mar)" },
  { val: "2T", label: "2º Trimestre (Abr-Jun)" },
  { val: "3T", label: "3º Trimestre (Jul-Set)" },
  { val: "4T", label: "4º Trimestre (Out-Dez)" }
];

const ANOS_APURACAO = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];

// Componente Seletor Padronizado de Período (Mês / Trimestre / Outro)
const PeriodoSelector = ({ value = "", onChange, label = "Período de Apuração" }) => {
  const parseVal = (valStr) => {
    const s = (valStr || "").trim();
    if (!s) return { tipo: "mes", mes: "07", tri: "2T", ano: 2026, custom: "" };

    // Checar se é Trimestre
    if (/trimestre|1t|2t|3t|4t/i.test(s)) {
      let tri = "1T";
      if (/2.*trimestre|2t/i.test(s)) tri = "2T";
      else if (/3.*trimestre|3t/i.test(s)) tri = "3T";
      else if (/4.*trimestre|4t/i.test(s)) tri = "4T";

      const anoMatch = s.match(/20\d{2}|\b\d{2}\b/);
      let ano = 2026;
      if (anoMatch) {
        ano = anoMatch[0].length === 2 ? Number(`20${anoMatch[0]}`) : Number(anoMatch[0]);
      }
      return { tipo: "tri", mes: "01", tri, ano, custom: s };
    }

    // Checar se é Mês
    for (const m of MESES_APURACAO) {
      if (s.toLowerCase().includes(m.sigla) || s.startsWith(m.val + "/") || s.startsWith(m.val + "-")) {
        const anoMatch = s.match(/20\d{2}|\b\d{2}\b/);
        let ano = 2026;
        if (anoMatch) {
          ano = anoMatch[0].length === 2 ? Number(`20${anoMatch[0]}`) : Number(anoMatch[0]);
        }
        return { tipo: "mes", mes: m.val, tri: "1T", ano, custom: s };
      }
    }

    const mmMatch = s.match(/^(\d{1,2})\/(20\d{2}|\d{2})$/);
    if (mmMatch) {
      const mesNum = mmMatch[1].padStart(2, "0");
      const anoNum = mmMatch[2].length === 2 ? Number(`20${mmMatch[2]}`) : Number(mmMatch[2]);
      return { tipo: "mes", mes: mesNum, tri: "1T", ano: anoNum, custom: s };
    }

    return { tipo: "custom", mes: "07", tri: "2T", ano: 2026, custom: s };
  };

  const parsed = useMemo(() => parseVal(value), [value]);
  const [tipo, setTipo] = useState(parsed.tipo);
  const [mes, setMes] = useState(parsed.mes);
  const [tri, setTri] = useState(parsed.tri);
  const [ano, setAno] = useState(parsed.ano);
  const [customText, setCustomText] = useState(parsed.custom);

  useEffect(() => {
    setTipo(parsed.tipo);
    setMes(parsed.mes);
    setTri(parsed.tri);
    setAno(parsed.ano);
    setCustomText(parsed.custom);
  }, [value]);

  const update = (newTipo, newMes, newTri, newAno, newCustom) => {
    setTipo(newTipo);
    setMes(newMes);
    setTri(newTri);
    setAno(newAno);
    setCustomText(newCustom);

    if (newTipo === "mes") {
      onChange(`${newMes}/${newAno}`);
    } else if (newTipo === "tri") {
      const triLabel = newTri === "1T" ? "1º Trimestre" : newTri === "2T" ? "2º Trimestre" : newTri === "3T" ? "3º Trimestre" : "4º Trimestre";
      onChange(`${triLabel} ${newAno}`);
    } else {
      onChange(newCustom);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
        <label style={{ color: "#94a3b8", fontSize: "0.85rem" }}>{label}</label>
        
        {/* Alternador de Tipo de Período */}
        <div style={{ display: "flex", gap: "2px", background: "#0f172a", padding: "2px", borderRadius: "6px", border: "1px solid #334155" }}>
          <button
            type="button"
            onClick={() => update("mes", mes, tri, ano, customText)}
            style={{
              padding: "2px 8px", fontSize: "0.72rem", borderRadius: "4px", border: "none", cursor: "pointer",
              background: tipo === "mes" ? "#2563eb" : "transparent",
              color: tipo === "mes" ? "#fff" : "#94a3b8",
              fontWeight: tipo === "mes" ? "700" : "500",
              transition: "all 0.15s"
            }}
          >
            Mês
          </button>
          <button
            type="button"
            onClick={() => update("tri", mes, tri, ano, customText)}
            style={{
              padding: "2px 8px", fontSize: "0.72rem", borderRadius: "4px", border: "none", cursor: "pointer",
              background: tipo === "tri" ? "#2563eb" : "transparent",
              color: tipo === "tri" ? "#fff" : "#94a3b8",
              fontWeight: tipo === "tri" ? "700" : "500",
              transition: "all 0.15s"
            }}
          >
            Trimestre
          </button>
          <button
            type="button"
            onClick={() => update("custom", mes, tri, ano, customText || value)}
            style={{
              padding: "2px 8px", fontSize: "0.72rem", borderRadius: "4px", border: "none", cursor: "pointer",
              background: tipo === "custom" ? "#334155" : "transparent",
              color: tipo === "custom" ? "#fff" : "#94a3b8",
              fontWeight: tipo === "custom" ? "700" : "500",
              transition: "all 0.15s"
            }}
          >
            Outro
          </button>
        </div>
      </div>

      {tipo === "mes" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: "8px" }}>
          <select
            className="text-input"
            value={mes}
            onChange={e => update("mes", e.target.value, tri, ano, customText)}
            style={{ padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "6px", fontSize: "0.85rem" }}
          >
            {MESES_APURACAO.map(m => (
              <option key={m.val} value={m.val}>{m.label}</option>
            ))}
          </select>
          <select
            className="text-input"
            value={ano}
            onChange={e => update("mes", mes, tri, Number(e.target.value), customText)}
            style={{ padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "6px", fontSize: "0.85rem" }}
          >
            {ANOS_APURACAO.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      )}

      {tipo === "tri" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: "8px" }}>
          <select
            className="text-input"
            value={tri}
            onChange={e => update("tri", mes, e.target.value, ano, customText)}
            style={{ padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "6px", fontSize: "0.85rem" }}
          >
            {TRIMESTRES_APURACAO.map(t => (
              <option key={t.val} value={t.val}>{t.label}</option>
            ))}
          </select>
          <select
            className="text-input"
            value={ano}
            onChange={e => update("tri", mes, tri, Number(e.target.value), customText)}
            style={{ padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "6px", fontSize: "0.85rem" }}
          >
            {ANOS_APURACAO.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      )}

      {tipo === "custom" && (
        <input
          type="text"
          className="text-input"
          placeholder="Ex: 01/2025 a 12/2025 ou Anual..."
          value={customText}
          onChange={e => update("custom", mes, tri, ano, e.target.value)}
          style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "6px", fontSize: "0.85rem" }}
        />
      )}
    </div>
  );
};

// Base inicial de créditos baseada na planilha real do usuário
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

// Base inicial de compensações com distinção de Principal vs Juros
const INITIAL_COMPENSACOES = [
  {
    id: 1,
    creditoId: 2,
    tipoCredito: "IPI",
    numeroPerdcompOrigem: "10672.79186.240826.1.1.01-8205",
    dataCompensacao: "2026-08-25",
    numeroPerdcompCompensacao: "25886.65282.250826.1.3.01-4600",
    tributoCompensado: "COFINS",
    valorTotalCompensado: 73425.42,
    valorPrincipal: 73425.42,
    valorJuros: 0,
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
    valorTotalCompensado: 14756.52,
    valorPrincipal: 14756.52,
    valorJuros: 0,
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
    valorTotalCompensado: 161186.20,
    valorPrincipal: 161186.20,
    valorJuros: 0,
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
    valorTotalCompensado: 79189.79,
    valorPrincipal: 79189.79,
    valorJuros: 0,
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
    valorTotalCompensado: 102010.30,
    valorPrincipal: 102010.30,
    valorJuros: 0,
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
  const [expandedTributos, setExpandedTributos] = useState({});
  const [expandedCompsTributos, setExpandedCompsTributos] = useState({});

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
        const { data } = await supabase
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
            // Normalizar compensações garantindo campos de principal e juros
            const compsNormalizadas = parsed.compensacoes.map(c => {
              const valTotal = Number(c.valorTotalCompensado !== undefined ? c.valorTotalCompensado : (c.valorCompensado || 0));
              const valJuros = Number(c.valorJuros || 0);
              const valPrincipal = Number(c.valorPrincipal !== undefined ? c.valorPrincipal : (valTotal - valJuros));
              return {
                ...c,
                valorTotalCompensado: valTotal,
                valorPrincipal: valPrincipal,
                valorJuros: valJuros
              };
            });
            setCompensacoes(compsNormalizadas);
          } else {
            setCompensacoes(INITIAL_COMPENSACOES);
          }
          if (parsed.taxaSelicGlobal !== undefined) {
            setTaxaSelicGlobal(Number(parsed.taxaSelicGlobal));
          }
        } else {
          // Inicialização com a base oficial da planilha
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



  // REGRA FUNDAMENTAL: Apenas a parcela de PRINCIPAL baixa o saldo do crédito original!
  const creditosComSaldos = useMemo(() => {
    return creditos.map(cred => {
      const comps = compensacoes.filter(c => String(c.creditoId) === String(cred.id));
      
      // Soma APENAS a parcela de principal que baixa o crédito original
      const totalPrincipalCompensado = comps.reduce((acc, c) => {
        const p = c.valorPrincipal !== undefined ? Number(c.valorPrincipal) : Number(c.valorCompensado || 0);
        return acc + p;
      }, 0);

      // Soma a parcela de juros aproveitada nas DCOMPs deste crédito (Ganho Financeiro Realizado)
      const totalJurosRealizados = comps.reduce((acc, c) => acc + Number(c.valorJuros || 0), 0);

      // Soma o total de débitos quitados (Principal Baixado + Juros Aproveitados)
      const totalDebitosQuitados = comps.reduce((acc, c) => {
        const t = c.valorTotalCompensado !== undefined ? Number(c.valorTotalCompensado) : Number(c.valorCompensado || 0);
        return acc + t;
      }, 0);

      // Saldo Disponível do Principal (Crédito Original - Principal Compensado)
      const saldoDisponivel = Math.max(0, Number(cred.valorCredito || 0) - totalPrincipalCompensado);
      const percUtilizado = cred.valorCredito > 0 ? (totalPrincipalCompensado / cred.valorCredito) * 100 : 0;

      // Juros Selic Projetados sobre o Saldo Disponível Restante (a realizar no futuro)
      const taxaJuros = cred.incideJuros ? (cred.taxaJurosCustom !== undefined && cred.taxaJurosCustom !== null && cred.taxaJurosCustom !== 0 ? cred.taxaJurosCustom : taxaSelicGlobal) : 0;
      const jurosEstimadosFuturos = cred.incideJuros ? (saldoDisponivel * (taxaJuros / 100)) : 0;
      const saldoComJurosFuturos = saldoDisponivel + jurosEstimadosFuturos;

      return {
        ...cred,
        totalPrincipalCompensado,
        totalJurosRealizados,
        totalDebitosQuitados,
        saldoDisponivel,
        percUtilizado,
        taxaJuros,
        jurosEstimadosFuturos,
        saldoComJurosFuturos,
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

  // Agrupamento dos créditos por tipo de tributo para visualização sumarizada e expansível
  const creditosAgrupadosPorTributo = useMemo(() => {
    const map = {};
    creditosFiltrados.forEach(c => {
      const tipo = (c.tipoCredito || "OUTROS").toUpperCase();
      if (!map[tipo]) {
        map[tipo] = {
          tipo,
          creditos: [],
          totalCreditoOriginal: 0,
          totalPrincipalCompensado: 0,
          totalSaldoDisponivel: 0,
          totalJurosRealizados: 0,
          qtdCreditos: 0
        };
      }
      map[tipo].creditos.push(c);
      map[tipo].totalCreditoOriginal += Number(c.valorCredito || 0);
      map[tipo].totalPrincipalCompensado += Number(c.totalPrincipalCompensado || 0);
      map[tipo].totalSaldoDisponivel += Number(c.saldoDisponivel || 0);
      map[tipo].totalJurosRealizados += Number(c.totalJurosRealizados || 0);
      map[tipo].qtdCreditos += 1;
    });

    return Object.values(map).map(g => {
      const percUtilizado = g.totalCreditoOriginal > 0 ? (g.totalPrincipalCompensado / g.totalCreditoOriginal) * 100 : 0;
      const percDisponivel = g.totalCreditoOriginal > 0 ? (g.totalSaldoDisponivel / g.totalCreditoOriginal) * 100 : 0;
      let status = "DISPONÍVEL";
      let statusColor = "#10B981";
      let statusBg = "rgba(16, 185, 129, 0.15)";
      if (g.totalSaldoDisponivel <= 0) {
        status = "ESGOTADO";
        statusColor = "#F59E0B";
        statusBg = "rgba(245, 158, 11, 0.15)";
      }
      return {
        ...g,
        percUtilizado,
        percDisponivel,
        status,
        statusColor,
        statusBg
      };
    });
  }, [creditosFiltrados]);

  const toggleTributo = (tipo) => {
    setExpandedTributos(prev => ({
      ...prev,
      [tipo]: !prev[tipo]
    }));
  };

  const expandAllTributos = () => {
    const next = {};
    creditosAgrupadosPorTributo.forEach(g => {
      next[g.tipo] = true;
    });
    setExpandedTributos(next);
  };

  const collapseAllTributos = () => {
    setExpandedTributos({});
  };

  // Compensações enriquecidas com o saldo do principal restante após cada compensação
  const compensacoesEnriquecidas = useMemo(() => {
    const list = [...compensacoes];
    return list.map(comp => {
      const cred = creditos.find(c => String(c.id) === String(comp.creditoId));
      const valorCreditoOriginal = cred ? Number(cred.valorCredito || 0) : 0;
      
      // Soma de todas as parcelas de principal deste mesmo crédito até este lançamento
      const compsDoCredito = list.filter(c => String(c.creditoId) === String(comp.creditoId));
      const idx = compsDoCredito.findIndex(c => String(c.id) === String(comp.id));
      const principalBaixadoAteAqui = compsDoCredito.slice(0, idx + 1).reduce((sum, c) => {
        const p = c.valorPrincipal !== undefined ? Number(c.valorPrincipal) : Number(c.valorCompensado || 0);
        return sum + p;
      }, 0);
      const saldoPrincipalApos = Math.max(0, valorCreditoOriginal - principalBaixadoAteAqui);

      const valTotal = Number(comp.valorTotalCompensado !== undefined ? comp.valorTotalCompensado : (comp.valorCompensado || 0));
      const valJuros = Number(comp.valorJuros || 0);
      const valPrincipal = Number(comp.valorPrincipal !== undefined ? comp.valorPrincipal : (valTotal - valJuros));

      return {
        ...comp,
        valorTotalCompensado: valTotal,
        valorPrincipal: valPrincipal,
        valorJuros: valJuros,
        saldoPrincipalApos,
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

  // Agrupamento das compensações por tipo de crédito de origem para visualização resumida/expansível
  const compensacoesAgrupadasPorTipo = useMemo(() => {
    const map = {};
    compensacoesFiltradas.forEach(c => {
      const tipo = (c.tipoCredito || "OUTROS").toUpperCase();
      if (!map[tipo]) {
        map[tipo] = {
          tipo,
          compensacoes: [],
          totalQuitado: 0,
          totalPrincipal: 0,
          totalJuros: 0,
          qtdCompensacoes: 0
        };
      }
      map[tipo].compensacoes.push(c);
      map[tipo].totalQuitado += Number(c.valorTotalCompensado || 0);
      map[tipo].totalPrincipal += Number(c.valorPrincipal || 0);
      map[tipo].totalJuros += Number(c.valorJuros || 0);
      map[tipo].qtdCompensacoes += 1;
    });

    const ordemPreferencial = ["IPI", "IRPJ", "CSLL", "IRRF", "PIS", "COFINS"];
    return Object.values(map).sort((a, b) => {
      const idxA = ordemPreferencial.indexOf(a.tipo);
      const idxB = ordemPreferencial.indexOf(b.tipo);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.tipo.localeCompare(b.tipo);
    });
  }, [compensacoesFiltradas]);

  const toggleCompTributo = (tipo) => {
    setExpandedCompsTributos(prev => ({
      ...prev,
      [tipo]: !prev[tipo]
    }));
  };

  const expandAllCompTributos = () => {
    const next = {};
    compensacoesAgrupadasPorTipo.forEach(g => {
      next[g.tipo] = true;
    });
    setExpandedCompsTributos(next);
  };

  const collapseAllCompTributos = () => {
    setExpandedCompsTributos({});
  };

  // Dados consolidados do Painel de Saldos (Apenas tributos com créditos cadastrados)
  const painelResumo = useMemo(() => {
    // Obter apenas os tipos de tributos que possuem créditos cadastrados para a empresa selecionada
    const tiposComCredito = Array.from(new Set(
      creditosComSaldos
        .filter(c => filterEmpresa === "todas" || !c.empresaId || c.empresaId === filterEmpresa)
        .map(c => (c.tipoCredito || "").trim().toUpperCase())
        .filter(Boolean)
    ));

    // Ordem preferencial lógica dos tributos
    const ordemPreferencial = ["IPI", "IRPJ", "CSLL", "IRRF", "PIS", "COFINS"];
    tiposComCredito.sort((a, b) => {
      const idxA = ordemPreferencial.indexOf(a);
      const idxB = ordemPreferencial.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    const rows = tiposComCredito.map(tipo => {
      const credsTipo = creditosComSaldos.filter(c => {
        if (filterEmpresa !== "todas" && c.empresaId && c.empresaId !== filterEmpresa) return false;
        return (c.tipoCredito || "").toUpperCase() === tipo.toUpperCase();
      });

      const creditoOriginal = credsTipo.reduce((sum, c) => sum + Number(c.valorCredito || 0), 0);
      const principalCompensado = credsTipo.reduce((sum, c) => sum + Number(c.totalPrincipalCompensado || 0), 0);
      const ganhoJurosRealizado = credsTipo.reduce((sum, c) => sum + Number(c.totalJurosRealizados || 0), 0);
      const totalDebitosQuitados = credsTipo.reduce((sum, c) => sum + Number(c.totalDebitosQuitados || 0), 0);
      
      // Saldo Disponível do Principal (Crédito Original - Principal Compensado)
      const saldoDisponivel = Math.max(0, creditoOriginal - principalCompensado);
      const percUtilizado = creditoOriginal > 0 ? (principalCompensado / creditoOriginal) * 100 : 0;
      
      const jurosProjetadosFuturos = credsTipo.reduce((sum, c) => sum + Number(c.jurosEstimadosFuturos || 0), 0);
      const saldoComJurosFuturos = saldoDisponivel + jurosProjetadosFuturos;

      let status = "DISPONÍVEL";
      let statusColor = "#10B981";
      let statusBg = "rgba(16, 185, 129, 0.15)";

      if (saldoDisponivel <= 0) {
        status = "ESGOTADO";
        statusColor = "#F59E0B";
        statusBg = "rgba(245, 158, 11, 0.15)";
      }

      return {
        tipo,
        creditoOriginal,
        principalCompensado,
        ganhoJurosRealizado,
        totalDebitosQuitados,
        saldoDisponivel,
        percUtilizado,
        status,
        statusColor,
        statusBg,
        jurosProjetadosFuturos,
        saldoComJurosFuturos,
        qtdCreditos: credsTipo.length
      };
    }).filter(r => r.creditoOriginal > 0);

    const totalOriginal = rows.reduce((sum, r) => sum + r.creditoOriginal, 0);
    const totalPrincipal = rows.reduce((sum, r) => sum + r.principalCompensado, 0);
    const totalJurosRealiz = rows.reduce((sum, r) => sum + r.ganhoJurosRealizado, 0);
    const totalDebitos = rows.reduce((sum, r) => sum + r.totalDebitosQuitados, 0);
    const totalSaldo = rows.reduce((sum, r) => sum + r.saldoDisponivel, 0);
    const totalPerc = totalOriginal > 0 ? (totalPrincipal / totalOriginal) * 100 : 0;
    const totalJurosProj = rows.reduce((sum, r) => sum + r.jurosProjetadosFuturos, 0);
    const totalSaldoComJuros = totalSaldo + totalJurosProj;

    return {
      rows,
      total: {
        tipo: "TOTAL",
        creditoOriginal: totalOriginal,
        principalCompensado: totalPrincipal,
        ganhoJurosRealizado: totalJurosRealiz,
        totalDebitosQuitados: totalDebitos,
        saldoDisponivel: totalSaldo,
        percUtilizado: totalPerc,
        status: "CONSOLIDADO",
        statusColor: "#3B82F6",
        statusBg: "rgba(59, 130, 246, 0.2)",
        jurosProjetadosFuturos: totalJurosProj,
        saldoComJurosFuturos: totalSaldoComJuros
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
      const valTotal = Number(comp.valorTotalCompensado !== undefined ? comp.valorTotalCompensado : (comp.valorCompensado || 0));
      const valJuros = Number(comp.valorJuros || 0);
      const valPrincipal = Number(comp.valorPrincipal !== undefined ? comp.valorPrincipal : (valTotal - valJuros));
      setCompFormData({
        ...comp,
        valorTotalCompensado: valTotal,
        valorPrincipal: valPrincipal,
        valorJuros: valJuros,
        temJuros: valJuros > 0
      });
      const nextId = compensacoes.length > 0 ? Math.max(...compensacoes.map(c => Number(c.id) || 0)) + 1 : 1;
      const primeiroComSaldo = creditosComSaldos.find(c => c.saldoDisponivel > 0);
      const initialCredId = preSelectedCreditoId || (primeiroComSaldo?.id || "");
      const selectedCred = creditosComSaldos.find(c => String(c.id) === String(initialCredId));

      setCompFormData({
        id: nextId,
        creditoId: initialCredId,
        tipoCredito: selectedCred?.tipoCredito || "IPI",
        numeroPerdcompOrigem: selectedCred?.numeroPerdcomp || "",
        dataCompensacao: new Date().toISOString().split("T")[0],
        numeroPerdcompCompensacao: "",
        tributoCompensado: "COFINS",
        valorTotalCompensado: 0,
        valorPrincipal: 0,
        valorJuros: 0,
        temJuros: false,
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
    if (!compFormData.valorTotalCompensado || compFormData.valorTotalCompensado <= 0) {
      alert("Informe um valor total de compensação válido.");
      return;
    }

    // Calcula os valores finais garantindo a coerência Principal + Juros = Total
    const valTotal = Number(compFormData.valorTotalCompensado);
    let valJuros = compFormData.temJuros ? Number(compFormData.valorJuros || 0) : 0;
    if (valJuros > valTotal) {
      alert("A parcela de juros não pode ser maior do que o valor total compensado.");
      return;
    }
    const valPrincipal = Number(compFormData.valorPrincipal !== undefined && compFormData.valorPrincipal !== null && compFormData.temJuros 
      ? compFormData.valorPrincipal 
      : (valTotal - valJuros));

    // Validação de saldo disponível do principal
    const cred = creditosComSaldos.find(c => String(c.id) === String(compFormData.creditoId));
    if (cred) {
      const valPrincipalAntigo = compFormData.id ? (compensacoes.find(c => String(c.id) === String(compFormData.id))?.valorPrincipal || 0) : 0;
      const saldoMaximo = cred.saldoDisponivel + valPrincipalAntigo;

      if (valPrincipal > saldoMaximo + 0.01) {
        const proceed = window.confirm(
          `AVISO: A parcela de principal a baixar (${formatCurrency(valPrincipal)}) é maior que o saldo disponível deste crédito (${formatCurrency(saldoMaximo)}).\nDeseja salvar mesmo assim?`
        );
        if (!proceed) return;
      }
    }

    const payload = {
      ...compFormData,
      valorTotalCompensado: valTotal,
      valorPrincipal: valPrincipal,
      valorJuros: valJuros
    };

    let updated;
    const exists = compensacoes.find(c => String(c.id) === String(compFormData.id));
    if (exists) {
      updated = compensacoes.map(c => String(c.id) === String(compFormData.id) ? payload : c);
    } else {
      updated = [...compensacoes, payload];
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
      "Baixa do Principal (R$)": r.principalCompensado,
      "Saldo Disponível Principal (R$)": r.saldoDisponivel,
      "Ganho Juros SELIC Realizada (R$)": r.ganhoJurosRealizado,
      "Total Débitos Quitados (R$)": r.totalDebitosQuitados,
      "% Utilizado Principal": (r.percUtilizado / 100),
      "Status": r.status,
      "Saldo c/ Previsão Selic (R$)": r.saldoComJurosFuturos
    }));
    painelData.push({
      "Tipo de Crédito": "TOTAL CONSOLIDADO",
      "Crédito Original (R$)": painelResumo.total.creditoOriginal,
      "Baixa do Principal (R$)": painelResumo.total.principalCompensado,
      "Saldo Disponível Principal (R$)": painelResumo.total.saldoDisponivel,
      "Ganho Juros SELIC Realizada (R$)": painelResumo.total.ganhoJurosRealizado,
      "Total Débitos Quitados (R$)": painelResumo.total.totalDebitosQuitados,
      "% Utilizado Principal": (painelResumo.total.percUtilizado / 100),
      "Status": "CONSOLIDADO",
      "Saldo c/ Previsão Selic (R$)": painelResumo.total.saldoComJurosFuturos
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
      "Baixa Principal (R$)": c.totalPrincipalCompensado,
      "Saldo Disponível (R$)": c.saldoDisponivel,
      "Ganho Juros DCOMPs (R$)": c.totalJurosRealizados,
      "% Disponível": (100 - c.percUtilizado) / 100,
      "Período de Apuração": c.periodoApuracao,
      "Descrição/Origem": c.descricaoOrigem,
      "Observação": c.observacao,
      "Incide Juros Selic": c.incideJuros ? "SIM" : "NÃO",
      "Juros Projetados Futuros (R$)": c.jurosEstimadosFuturos,
      "Saldo Total Projetado (R$)": c.saldoComJurosFuturos,
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
      "Total Débito Quitado (R$)": c.valorTotalCompensado,
      "Baixa do Principal (R$)": c.valorPrincipal,
      "Ganho Juros SELIC (R$)": c.valorJuros,
      "Período de Apuração Débito": c.periodoApuracao,
      "Saldo do Principal Após Comp. (R$)": c.saldoPrincipalApos,
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
                Gestão com segregação contábil de <strong>Baixa do Principal</strong> e <strong>Ganho de Juros SELIC</strong>
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
          boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
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

        {/* Card 2: Baixa do Principal */}
        <div style={{
          background: "linear-gradient(145deg, #1e293b 0%, #0f172a 100%)",
          padding: "1.25rem", borderRadius: "12px", border: "1px solid #334155",
          boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Principal Compensado (Baixado)
            </span>
            <div style={{ padding: "6px", background: "rgba(245, 158, 11, 0.15)", borderRadius: "8px" }}>
              <ArrowRight size={18} color="#fbbf24" />
            </div>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: "800", color: "#fbbf24" }}>
            {formatCurrency(painelResumo.total.principalCompensado)}
          </div>
          <div style={{ fontSize: "0.78rem", color: "#f59e0b", marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "4px" }}>
            <Percent size={13} /> {formatPercent(painelResumo.total.percUtilizado)} do principal original baixado
          </div>
        </div>

        {/* Card 3: Saldo Disponível do Principal */}
        <div style={{
          background: "linear-gradient(145deg, #064e3b 0%, #022c22 100%)",
          padding: "1.25rem", borderRadius: "12px", border: "1px solid #059669",
          boxShadow: "0 4px 15px rgba(16, 185, 129, 0.15)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: "600", color: "#a7f3d0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Saldo Disponível do Principal
            </span>
            <div style={{ padding: "6px", background: "rgba(16, 185, 129, 0.25)", borderRadius: "8px" }}>
              <DollarSign size={18} color="#34d399" />
            </div>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: "800", color: "#ecfdf5" }}>
            {formatCurrency(painelResumo.total.saldoDisponivel)}
          </div>
          <div style={{ fontSize: "0.78rem", color: "#6ee7b7", marginTop: "0.4rem" }}>
            Livre para novas compensações de tributos
          </div>
        </div>

        {/* Card 4: Ganho de Juros SELIC Realizado + Previsão */}
        <div style={{
          background: "linear-gradient(145deg, #312e81 0%, #1e1b4b 100%)",
          padding: "1.25rem", borderRadius: "12px", border: "1px solid #4f46e5",
          boxShadow: "0 4px 15px rgba(79, 70, 229, 0.2)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: "600", color: "#c7d2fe", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Ganho SELIC (Realizado + Previsto)
            </span>
            <div style={{ padding: "6px", background: "rgba(99, 102, 241, 0.25)", borderRadius: "8px" }}>
              <Sparkles size={18} color="#a5b4fc" />
            </div>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: "800", color: "#818cf8" }}>
            {formatCurrency(painelResumo.total.ganhoJurosRealizado + painelResumo.total.jurosProjetadosFuturos)}
          </div>
          <div style={{ fontSize: "0.78rem", color: "#a5b4fc", marginTop: "0.4rem" }}>
            Realizado em DCOMPs: {formatCurrency(painelResumo.total.ganhoJurosRealizado)} | A Realizar: {formatCurrency(painelResumo.total.jurosProjetadosFuturos)}
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
          <Calculator size={18} /> Gestão de Juros SELIC
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
              display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px"
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700", color: "#fff" }}>
                  CONTROLE DE CRÉDITOS PER/DCOMP – PAINEL CONSOLIDADO
                </h3>
                <span style={{ fontSize: "0.8rem", color: "#93c5fd" }}>
                  Baixa exclusivamente da parcela de principal do crédito com apuração isolada do ganho de juros
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
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ background: "#0f172a", color: "#94a3b8", borderBottom: "2px solid #334155" }}>
                    <th style={{ padding: "12px 14px", fontWeight: "700" }}>Tipo de crédito</th>
                    <th style={{ padding: "12px 14px", textAlign: "right", fontWeight: "700" }}>Crédito Original</th>
                    <th style={{ padding: "12px 14px", textAlign: "right", fontWeight: "700", color: "#fbbf24" }}>Principal Baixado</th>
                    <th style={{ padding: "12px 14px", textAlign: "right", fontWeight: "700", color: "#34d399" }}>Saldo Disponível</th>
                    <th style={{ padding: "12px 14px", textAlign: "right", fontWeight: "700", color: "#a5b4fc" }}>Ganho de Juros (SELIC)</th>
                    <th style={{ padding: "12px 14px", textAlign: "right", fontWeight: "700" }}>Total Quitado</th>
                    <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: "700", width: "140px" }}>% Utilizado</th>
                    <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: "700" }}>Status</th>
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
                      <td style={{ padding: "12px 14px", fontWeight: "700", color: row.creditoOriginal > 0 ? "#f8fafc" : "#64748b" }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: "6px",
                          background: row.tipo === "IPI" ? "rgba(59, 130, 246, 0.2)" : row.tipo === "IRPJ" ? "rgba(16, 185, 129, 0.2)" : row.tipo === "CSLL" ? "rgba(168, 85, 247, 0.2)" : "rgba(148, 163, 184, 0.15)",
                          color: row.tipo === "IPI" ? "#60a5fa" : row.tipo === "IRPJ" ? "#34d399" : row.tipo === "CSLL" ? "#c084fc" : "#94a3b8"
                        }}>
                          {row.tipo}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: row.creditoOriginal > 0 ? "#f1f5f9" : "#64748b" }}>
                        {formatCurrency(row.creditoOriginal)}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: row.principalCompensado > 0 ? "#fbbf24" : "#64748b" }}>
                        {formatCurrency(row.principalCompensado)}
                      </td>
                      <td style={{ 
                        padding: "12px 14px", textAlign: "right", fontWeight: "700",
                        color: row.saldoDisponivel > 0 ? "#34d399" : "#64748b"
                      }}>
                        {formatCurrency(row.saldoDisponivel)}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: row.ganhoJurosRealizado > 0 ? "#a5b4fc" : "#64748b", fontWeight: "600" }}>
                        {row.ganhoJurosRealizado > 0 ? `+ ${formatCurrency(row.ganhoJurosRealizado)}` : "R$ 0,00"}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: row.totalDebitosQuitados > 0 ? "#f8fafc" : "#64748b" }}>
                        {formatCurrency(row.totalDebitosQuitados)}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        {row.creditoOriginal > 0 ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "center" }}>
                            <div style={{ flex: 1, height: "7px", background: "#334155", borderRadius: "4px", overflow: "hidden", maxWidth: "70px" }}>
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
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <span style={{
                          padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "700",
                          background: row.statusBg, color: row.statusColor
                        }}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {painelResumo.rows.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                        Nenhum crédito cadastrado para a empresa selecionada.
                      </td>
                    </tr>
                  )}

                  {/* LINHA TOTAL CONSOLIDADA */}
                  <tr style={{ background: "#0f172a", borderTop: "2px solid #475569", fontWeight: "800" }}>
                    <td style={{ padding: "14px 16px", fontSize: "1rem", color: "#f8fafc" }}>
                      TOTAL
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontSize: "1rem", color: "#f8fafc" }}>
                      {formatCurrency(painelResumo.total.creditoOriginal)}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontSize: "1rem", color: "#fbbf24" }}>
                      {formatCurrency(painelResumo.total.principalCompensado)}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontSize: "1.05rem", color: "#34d399" }}>
                      {formatCurrency(painelResumo.total.saldoDisponivel)}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontSize: "1rem", color: "#a5b4fc" }}>
                      + {formatCurrency(painelResumo.total.ganhoJurosRealizado)}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontSize: "1rem", color: "#f8fafc" }}>
                      {formatCurrency(painelResumo.total.totalDebitosQuitados)}
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
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ padding: "1rem 1.25rem", background: "rgba(15, 23, 42, 0.6)", borderTop: "1px solid #334155", fontSize: "0.82rem", color: "#94a3b8" }}>
              💡 <strong>Regra Fiscal Aplicada:</strong> O <em>Saldo Disponível</em> é deduzido exclusivamente pela <strong>Parcela de Principal</strong> das compensações. Qualquer parcela de juros SELIC aproveitada é computada separadamente na coluna <strong>Ganho de Juros (SELIC)</strong>, garantindo que o direito creditório nominal não seja reduzido indevidamente.
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: BASE DE CRÉDITOS */}
      {activeTab === "creditos" && (
        <div>
          {/* Barra de Busca e Ações Rápidas */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, maxWidth: "450px" }}>
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

            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              {/* Botões Expandir / Recolher Todos */}
              <button
                onClick={expandAllTributos}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "7px 12px", background: "#1e293b", border: "1px solid #334155",
                  color: "#cbd5e1", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem",
                  transition: "all 0.15s"
                }}
                title="Expandir todos os grupos de tributos para ver detalhamento"
              >
                <ChevronDown size={14} /> Expandir Todos
              </button>
              <button
                onClick={collapseAllTributos}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "7px 12px", background: "#1e293b", border: "1px solid #334155",
                  color: "#cbd5e1", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem",
                  transition: "all 0.15s"
                }}
                title="Recolher todos os grupos e ver apenas o resumo dos tributos"
              >
                <ChevronRight size={14} /> Recolher Todos
              </button>

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
          </div>

          {/* Dica / Info de navegação */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", padding: "0 4px", fontSize: "0.8rem", color: "#94a3b8" }}>
            <span>
              Mostrando <strong>{creditosAgrupadosPorTributo.length}</strong> tributos cadastrados ({creditosFiltrados.length} créditos no total). Clique em um tributo para abrir ou recolher os detalhes.
            </span>
          </div>

          {/* LISTAGEM DOS GRUPOS POR TRIBUTO (ACCORDION) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {creditosAgrupadosPorTributo.map((grupo) => {
              const isExpanded = Boolean(expandedTributos[grupo.tipo] || searchTerm);
              const badgeBg = grupo.tipo === "IPI" ? "rgba(59, 130, 246, 0.2)" : grupo.tipo === "IRPJ" ? "rgba(16, 185, 129, 0.2)" : grupo.tipo === "CSLL" ? "rgba(168, 85, 247, 0.2)" : grupo.tipo === "PIS" ? "rgba(6, 182, 212, 0.2)" : grupo.tipo === "COFINS" ? "rgba(249, 115, 22, 0.2)" : "rgba(148, 163, 184, 0.15)";
              const badgeColor = grupo.tipo === "IPI" ? "#60a5fa" : grupo.tipo === "IRPJ" ? "#34d399" : grupo.tipo === "CSLL" ? "#c084fc" : grupo.tipo === "PIS" ? "#38bdf8" : grupo.tipo === "COFINS" ? "#fb923c" : "#94a3b8";

              return (
                <div
                  key={grupo.tipo}
                  style={{
                    background: "#1e293b",
                    borderRadius: "12px",
                    border: isExpanded ? "1px solid #475569" : "1px solid #334155",
                    overflow: "hidden",
                    boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                    transition: "border 0.2s"
                  }}
                >
                  {/* BARRA DE CABEÇALHO / RESUMO DO TRIBUTO (CLICÁVEL) */}
                  <div
                    onClick={() => toggleTributo(grupo.tipo)}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "1rem 1.25rem",
                      cursor: "pointer",
                      background: isExpanded ? "rgba(30, 41, 59, 0.95)" : "#1e293b",
                      borderBottom: isExpanded ? "1px solid #334155" : "none",
                      gap: "1rem",
                      userSelect: "none",
                      transition: "background 0.15s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = isExpanded ? "rgba(30, 41, 59, 0.95)" : "rgba(30, 41, 59, 0.7)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = isExpanded ? "rgba(30, 41, 59, 0.95)" : "#1e293b"}
                  >
                    {/* Identificação do Tributo */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "220px" }}>
                      <div style={{
                        color: isExpanded ? "#60a5fa" : "#94a3b8",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "transform 0.2s"
                      }}>
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{
                          padding: "5px 12px",
                          borderRadius: "8px",
                          fontWeight: "800",
                          fontSize: "0.95rem",
                          letterSpacing: "0.02em",
                          background: badgeBg,
                          color: badgeColor,
                          border: `1px solid ${badgeColor}33`
                        }}>
                          {grupo.tipo}
                        </span>
                        <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                          ({grupo.qtdCreditos} {grupo.qtdCreditos === 1 ? "crédito" : "créditos"})
                        </span>
                      </div>
                    </div>

                    {/* Resumo Consolidado do Tributo */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1.5rem",
                      flexWrap: "wrap",
                      fontSize: "0.86rem"
                    }}>
                      {/* Crédito Original */}
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Crédito Original</div>
                        <div style={{ fontWeight: "700", color: "#f8fafc" }}>
                          {formatCurrency(grupo.totalCreditoOriginal)}
                        </div>
                      </div>

                      {/* Principal Baixado */}
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Principal Baixado</div>
                        <div style={{ fontWeight: "700", color: grupo.totalPrincipalCompensado > 0 ? "#fbbf24" : "#64748b" }}>
                          {formatCurrency(grupo.totalPrincipalCompensado)}
                        </div>
                      </div>

                      {/* Saldo Disponível */}
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Saldo Disponível</div>
                        <div style={{ fontWeight: "800", color: grupo.totalSaldoDisponivel > 0 ? "#34d399" : "#64748b" }}>
                          {formatCurrency(grupo.totalSaldoDisponivel)}
                          <span style={{ fontSize: "0.74rem", fontWeight: "600", marginLeft: "5px", color: grupo.totalSaldoDisponivel > 0 ? "#a7f3d0" : "#64748b" }}>
                            ({formatPercent(grupo.percDisponivel)} disp.)
                          </span>
                        </div>
                      </div>

                      {/* Ganho de Juros SELIC Realizado (se houver) */}
                      {grupo.totalJurosRealizados > 0 && (
                        <div>
                          <div style={{ fontSize: "0.72rem", color: "#c7d2fe", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ganho SELIC</div>
                          <div style={{ fontWeight: "700", color: "#a5b4fc" }}>
                            + {formatCurrency(grupo.totalJurosRealizados)}
                          </div>
                        </div>
                      )}

                      {/* Status */}
                      <div>
                        <span style={{
                          padding: "4px 10px", borderRadius: "12px", fontSize: "0.74rem", fontWeight: "800",
                          background: grupo.statusBg, color: grupo.statusColor
                        }}>
                          {grupo.status}
                        </span>
                      </div>

                      {/* Ação textual indicativa */}
                      <span style={{
                        fontSize: "0.78rem", color: "#60a5fa", display: "flex", alignItems: "center", gap: "4px",
                        padding: "3px 8px", background: "rgba(59, 130, 246, 0.1)", borderRadius: "6px"
                      }}>
                        {isExpanded ? "Ocultar detalhes" : "Ver detalhado"}
                      </span>
                    </div>
                  </div>

                  {/* TABELA DETALHADA DO TRIBUTO (QUANDO EXPANDIDO) */}
                  {isExpanded && (
                    <div className="table-container" style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                        <thead>
                          <tr style={{ background: "#0f172a", color: "#94a3b8", borderBottom: "2px solid #334155" }}>
                            <th style={{ padding: "10px 14px", width: "50px" }}>ID</th>
                            <th style={{ padding: "10px 14px" }}>Nº PER/DCOMP Origem</th>
                            <th style={{ padding: "10px 14px" }}>Data Transm.</th>
                            <th style={{ padding: "10px 14px", textAlign: "right" }}>Valor Crédito</th>
                            <th style={{ padding: "10px 14px", textAlign: "right", color: "#fbbf24" }}>Baixa Principal</th>
                            <th style={{ padding: "10px 14px", textAlign: "right", color: "#34d399" }}>Saldo Disponível</th>
                            <th style={{ padding: "10px 14px", textAlign: "right", color: "#a5b4fc" }}>Ganho Juros DCOMPs</th>
                            <th style={{ padding: "10px 14px" }}>Período Apuração</th>
                            <th style={{ padding: "10px 14px" }}>Descrição / Origem</th>
                            <th style={{ padding: "10px 14px" }}>Observação</th>
                            {canEdit && <th style={{ padding: "10px 14px", textAlign: "center", width: "120px" }}>Ações</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {grupo.creditos.map((cred) => (
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
                              <td style={{ padding: "10px 14px", textAlign: "right", color: cred.totalPrincipalCompensado > 0 ? "#fbbf24" : "#64748b" }}>
                                {formatCurrency(cred.totalPrincipalCompensado)}
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: "700", color: cred.saldoDisponivel > 0 ? "#34d399" : "#64748b" }}>
                                <div>{formatCurrency(cred.saldoDisponivel)}</div>
                                <div style={{ fontSize: "0.72rem", color: cred.saldoDisponivel > 0 ? "#a7f3d0" : "#64748b" }}>
                                  ({formatPercent(cred.valorCredito > 0 ? ((cred.saldoDisponivel / cred.valorCredito) * 100) : 0)} disp.)
                                </div>
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "right", color: cred.totalJurosRealizados > 0 ? "#a5b4fc" : "#64748b", fontWeight: "600" }}>
                                {cred.totalJurosRealizados > 0 ? `+ ${formatCurrency(cred.totalJurosRealizados)}` : "-"}
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
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            {creditosAgrupadosPorTributo.length === 0 && (
              <div style={{
                background: "#1e293b", borderRadius: "12px", border: "1px solid #334155",
                padding: "3rem", textAlign: "center", color: "#64748b"
              }}>
                Nenhum crédito localizado com os filtros aplicados.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 3: COMPENSAÇÕES AGRUPADAS POR TIPO DE CRÉDITO */}
      {activeTab === "compensacoes" && (
        <div>
          {/* Barra de Busca e Ações Rápidas */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, maxWidth: "450px" }}>
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

            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              {/* Botões Expandir / Recolher Todos */}
              <button
                onClick={expandAllCompTributos}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "7px 12px", background: "#1e293b", border: "1px solid #334155",
                  color: "#cbd5e1", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem",
                  transition: "all 0.15s"
                }}
                title="Expandir todos os grupos de compensações"
              >
                <ChevronDown size={14} /> Expandir Todos
              </button>
              <button
                onClick={collapseAllCompTributos}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "7px 12px", background: "#1e293b", border: "1px solid #334155",
                  color: "#cbd5e1", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem",
                  transition: "all 0.15s"
                }}
                title="Recolher todos os grupos e ver apenas os totais"
              >
                <ChevronRight size={14} /> Recolher Todos
              </button>

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
          </div>

          {/* Dica / Info de navegação */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", padding: "0 4px", fontSize: "0.8rem", color: "#94a3b8" }}>
            <span>
              Mostrando <strong>{compensacoesAgrupadasPorTipo.length}</strong> tipos de crédito com compensações ({compensacoesFiltradas.length} compensações no total). Clique para abrir ou recolher os detalhes.
            </span>
          </div>

          {/* LISTAGEM DOS GRUPOS DE COMPENSAÇÃO POR TIPO DE CRÉDITO (ACCORDION) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {compensacoesAgrupadasPorTipo.map((grupo) => {
              const isExpanded = Boolean(expandedCompsTributos[grupo.tipo] || searchTerm);
              const badgeBg = grupo.tipo === "IPI" ? "rgba(59, 130, 246, 0.2)" : grupo.tipo === "IRPJ" ? "rgba(16, 185, 129, 0.2)" : grupo.tipo === "CSLL" ? "rgba(168, 85, 247, 0.2)" : grupo.tipo === "PIS" ? "rgba(6, 182, 212, 0.2)" : grupo.tipo === "COFINS" ? "rgba(249, 115, 22, 0.2)" : "rgba(148, 163, 184, 0.15)";
              const badgeColor = grupo.tipo === "IPI" ? "#60a5fa" : grupo.tipo === "IRPJ" ? "#34d399" : grupo.tipo === "CSLL" ? "#c084fc" : grupo.tipo === "PIS" ? "#38bdf8" : grupo.tipo === "COFINS" ? "#fb923c" : "#94a3b8";

              return (
                <div
                  key={grupo.tipo}
                  style={{
                    background: "#1e293b",
                    borderRadius: "12px",
                    border: isExpanded ? "1px solid #475569" : "1px solid #334155",
                    overflow: "hidden",
                    boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                    transition: "border 0.2s"
                  }}
                >
                  {/* BARRA DE CABEÇALHO / RESUMO DA COMPENSAÇÃO POR TRIBUTO (CLICÁVEL) */}
                  <div
                    onClick={() => toggleCompTributo(grupo.tipo)}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "1rem 1.25rem",
                      cursor: "pointer",
                      background: isExpanded ? "rgba(30, 41, 59, 0.95)" : "#1e293b",
                      borderBottom: isExpanded ? "1px solid #334155" : "none",
                      gap: "1rem",
                      userSelect: "none",
                      transition: "background 0.15s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = isExpanded ? "rgba(30, 41, 59, 0.95)" : "rgba(30, 41, 59, 0.7)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = isExpanded ? "rgba(30, 41, 59, 0.95)" : "#1e293b"}
                  >
                    {/* Identificação do Tipo de Crédito */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "240px" }}>
                      <div style={{
                        color: isExpanded ? "#60a5fa" : "#94a3b8",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "transform 0.2s"
                      }}>
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{
                          padding: "5px 12px",
                          borderRadius: "8px",
                          fontWeight: "800",
                          fontSize: "0.95rem",
                          letterSpacing: "0.02em",
                          background: badgeBg,
                          color: badgeColor,
                          border: `1px solid ${badgeColor}33`
                        }}>
                          Créditos {grupo.tipo}
                        </span>
                        <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                          ({grupo.qtdCompensacoes} {grupo.qtdCompensacoes === 1 ? "compensação" : "compensações"})
                        </span>
                      </div>
                    </div>

                    {/* Resumo Consolidado das Compensações deste Tipo */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1.5rem",
                      flexWrap: "wrap",
                      fontSize: "0.86rem"
                    }}>
                      {/* Total Quitado */}
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Quitado</div>
                        <div style={{ fontWeight: "700", color: "#f8fafc" }}>
                          {formatCurrency(grupo.totalQuitado)}
                        </div>
                      </div>

                      {/* Baixa do Principal */}
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Baixa Principal</div>
                        <div style={{ fontWeight: "700", color: "#fbbf24" }}>
                          {formatCurrency(grupo.totalPrincipal)}
                        </div>
                      </div>

                      {/* Ganho SELIC Realizado (se houver) */}
                      {grupo.totalJuros > 0 && (
                        <div>
                          <div style={{ fontSize: "0.72rem", color: "#c7d2fe", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ganho SELIC</div>
                          <div style={{ fontWeight: "700", color: "#a5b4fc" }}>
                            + {formatCurrency(grupo.totalJuros)}
                          </div>
                        </div>
                      )}

                      {/* Ação textual indicativa */}
                      <span style={{
                        fontSize: "0.78rem", color: "#60a5fa", display: "flex", alignItems: "center", gap: "4px",
                        padding: "3px 8px", background: "rgba(59, 130, 246, 0.1)", borderRadius: "6px"
                      }}>
                        {isExpanded ? "Ocultar detalhes" : "Ver detalhado"}
                      </span>
                    </div>
                  </div>

                  {/* TABELA DETALHADA DAS COMPENSAÇÕES (QUANDO EXPANDIDO) */}
                  {isExpanded && (
                    <div className="table-container" style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                        <thead>
                          <tr style={{ background: "#0f172a", color: "#94a3b8", borderBottom: "2px solid #334155" }}>
                            <th style={{ padding: "10px 14px", width: "60px" }}>ID Comp.</th>
                            <th style={{ padding: "10px 14px" }}>Nº PER/DCOMP Origem</th>
                            <th style={{ padding: "10px 14px" }}>Data Comp.</th>
                            <th style={{ padding: "10px 14px" }}>Nº PER/DCOMP Comp.</th>
                            <th style={{ padding: "10px 14px" }}>Tributo Débito</th>
                            <th style={{ padding: "10px 14px", textAlign: "right" }}>Total Quitado</th>
                            <th style={{ padding: "10px 14px", textAlign: "right", color: "#fbbf24" }}>Baixa Principal</th>
                            <th style={{ padding: "10px 14px", textAlign: "right", color: "#a5b4fc" }}>Ganho Juros SELIC</th>
                            <th style={{ padding: "10px 14px" }}>Período Débito</th>
                            <th style={{ padding: "10px 14px", textAlign: "right" }}>Saldo Principal Restante</th>
                            <th style={{ padding: "10px 14px", textAlign: "center" }}>Status</th>
                            {canEdit && <th style={{ padding: "10px 14px", textAlign: "center", width: "90px" }}>Ações</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {grupo.compensacoes.map((comp) => (
                            <tr key={comp.id} style={{ borderBottom: "1px solid #334155" }}>
                              <td style={{ padding: "10px 14px", fontWeight: "700", color: "#94a3b8" }}>
                                #{comp.id}
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
                              <td style={{ padding: "10px 14px", textAlign: "right", color: "#f8fafc", fontWeight: "700" }}>
                                {formatCurrency(comp.valorTotalCompensado)}
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "right", color: "#fbbf24", fontWeight: "700" }}>
                                {formatCurrency(comp.valorPrincipal)}
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "right", color: comp.valorJuros > 0 ? "#a5b4fc" : "#64748b", fontWeight: "600" }}>
                                {comp.valorJuros > 0 ? `+ ${formatCurrency(comp.valorJuros)}` : "-"}
                              </td>
                              <td style={{ padding: "10px 14px", color: "#cbd5e1" }}>
                                {comp.periodoApuracao || "-"}
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "right", color: comp.saldoPrincipalApos > 0 ? "#34d399" : "#64748b", fontWeight: "600" }}>
                                {formatCurrency(comp.saldoPrincipalApos)}
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
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            {compensacoesAgrupadasPorTipo.length === 0 && (
              <div style={{
                background: "#1e293b", borderRadius: "12px", border: "1px solid #334155",
                padding: "3rem", textAlign: "center", color: "#64748b"
              }}>
                Nenhuma compensação localizada com os filtros aplicados.
              </div>
            )}
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
                <div style={{ marginTop: "0.8rem", padding: "8px 12px", background: "rgba(16, 185, 129, 0.1)", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                  <span style={{ fontSize: "0.82rem", color: "#34d399", fontWeight: "600" }}>
                    ⭐ Tratamento Contábil: Nas DCOMPs, apenas a parcela de principal baixa o crédito original. A parcela de juros SELIC constitui Receita Financeira / Ganho de Juros e é contabilizada separadamente!
                  </span>
                </div>
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
                  Aplica-se aos saldos em aberto com juros
                </span>
              </div>
            </div>
          </div>

          {/* Cards de Resumo de Juros: Realizados vs A Realizar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{ background: "#1e293b", padding: "1.2rem", borderRadius: "10px", border: "1px solid #334155" }}>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>
                Ganho de Juros Realizado em DCOMPs
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: "800", color: "#34d399", marginTop: "0.3rem" }}>
                {formatCurrency(painelResumo.total.ganhoJurosRealizado)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.3rem" }}>
                Juros já aproveitados para abater débitos tributários
              </div>
            </div>

            <div style={{ background: "#1e293b", padding: "1.2rem", borderRadius: "10px", border: "1px solid #334155" }}>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>
                Juros Projetados nos Saldos Restantes
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: "800", color: "#818cf8", marginTop: "0.3rem" }}>
                {formatCurrency(painelResumo.total.jurosProjetadosFuturos)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.3rem" }}>
                Previsão de ganho adicional pela Selic sobre o saldo disponível
              </div>
            </div>

            <div style={{ background: "#1e293b", padding: "1.2rem", borderRadius: "10px", border: "1px solid #334155" }}>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>
                Ganho Total com Juros SELIC
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: "800", color: "#f8fafc", marginTop: "0.3rem" }}>
                {formatCurrency(painelResumo.total.ganhoJurosRealizado + painelResumo.total.jurosProjetadosFuturos)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#38bdf8", marginTop: "0.3rem" }}>
                Economia tributária total gerada pela Selic
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
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Saldo Principal Disp.</th>
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
                        + {formatCurrency(cred.jurosEstimadosFuturos)}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: "#818cf8", fontWeight: "800", fontSize: "0.95rem" }}>
                        {formatCurrency(cred.saldoComJurosFuturos)}
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
                      + {formatCurrency(creditosComSaldos.filter(c => c.incideJuros).reduce((s, c) => s + c.jurosEstimadosFuturos, 0))}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", color: "#818cf8", fontSize: "1.05rem" }}>
                      {formatCurrency(creditosComSaldos.filter(c => c.incideJuros).reduce((s, c) => s + c.saldoComJurosFuturos, 0))}
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

              <div style={{ alignSelf: "flex-end" }}>
                <PeriodoSelector
                  label="Período de Apuração"
                  value={creditFormData.periodoApuracao}
                  onChange={val => setCreditFormData({ ...creditFormData, periodoApuracao: val })}
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

      {/* MODAL DE COMPENSAÇÃO (DCOMP) COM SEGREGAÇÃO PRINCIPAL VS JUROS */}
      {isCompModalOpen && compFormData && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, backdropFilter: "blur(3px)"
        }}>
          <div style={{
            background: "#1e293b", padding: "1.8rem", borderRadius: "12px", width: "92%", maxWidth: "800px",
            border: "1px solid #475569", boxShadow: "0 20px 40px rgba(0,0,0,0.6)", maxHeight: "90vh", overflowY: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem", borderBottom: "1px solid #334155", paddingBottom: "0.8rem" }}>
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
                Selecione o Crédito de Origem a ser utilizado (Apenas com Saldo Disponível):
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
                <option value="">Selecione um crédito com saldo disponível...</option>
                {creditosComSaldos
                  .filter(c => c.saldoDisponivel > 0 || (compFormData.creditoId && String(c.id) === String(compFormData.creditoId)))
                  .map(c => (
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
                  <div style={{ marginTop: "0.8rem", display: "flex", gap: "1.5rem", fontSize: "0.85rem", color: "#cbd5e1", flexWrap: "wrap" }}>
                    <div><strong>Crédito Original:</strong> {formatCurrency(sel.valorCredito)}</div>
                    <div><strong>Principal Já Baixado:</strong> {formatCurrency(sel.totalPrincipalCompensado)}</div>
                    <div><strong style={{ color: "#34d399" }}>Saldo Disponível (Principal):</strong> <span style={{ color: "#34d399", fontWeight: "bold" }}>{formatCurrency(sel.saldoDisponivel)}</span></div>
                  </div>
                );
              })()}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
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

              <div style={{ alignSelf: "flex-end" }}>
                <PeriodoSelector
                  label="Período de Apuração do Débito"
                  value={compFormData.periodoApuracao}
                  onChange={val => setCompFormData({ ...compFormData, periodoApuracao: val })}
                />
              </div>
            </div>

            {/* SEÇÃO INTELIGENTE DE VALORES: TOTAL vs PRINCIPAL vs JUROS */}
            <div style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
              padding: "1.2rem", borderRadius: "10px", border: "1px solid #4f46e5",
              marginBottom: "1.2rem"
            }}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.4rem", color: "#f8fafc", fontSize: "0.92rem", fontWeight: "700" }}>
                  Valor Total do Débito Quitado nesta DCOMP (R$):
                </label>
                <CurrencyInput
                  value={compFormData.valorTotalCompensado}
                  onChange={val => {
                    const juros = compFormData.temJuros ? Number(compFormData.valorJuros || 0) : 0;
                    setCompFormData({
                      ...compFormData,
                      valorTotalCompensado: val,
                      valorPrincipal: Math.max(0, val - juros)
                    });
                  }}
                  style={{ padding: "10px", background: "#1e293b", border: "1px solid #6366f1", color: "#f8fafc", borderRadius: "6px", fontWeight: "bold", fontSize: "1.15rem" }}
                />
              </div>

              {/* Checkbox para ativar divisão de Juros SELIC */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "1rem", padding: "8px 12px", background: "rgba(99, 102, 241, 0.15)", borderRadius: "8px" }}>
                <input
                  type="checkbox"
                  id="chkJurosComp"
                  checked={compFormData.temJuros || false}
                  onChange={e => {
                    const isChecked = e.target.checked;
                    const tot = Number(compFormData.valorTotalCompensado || 0);
                    setCompFormData({
                      ...compFormData,
                      temJuros: isChecked,
                      valorJuros: isChecked ? compFormData.valorJuros : 0,
                      valorPrincipal: isChecked ? Math.max(0, tot - (compFormData.valorJuros || 0)) : tot
                    });
                  }}
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                />
                <label htmlFor="chkJurosComp" style={{ color: "#c7d2fe", fontSize: "0.88rem", fontWeight: "600", cursor: "pointer" }}>
                  Uma parte desta compensação é proveniente de Juros SELIC?
                </label>
              </div>

              {/* Campos segregados se houver juros */}
              {compFormData.temJuros && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", background: "rgba(0,0,0,0.25)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "0.3rem", color: "#a5b4fc", fontSize: "0.83rem", fontWeight: "600" }}>
                      Parcela de Juros SELIC (Ganho de Juros) (R$):
                    </label>
                    <CurrencyInput
                      value={compFormData.valorJuros}
                      onChange={valJuros => {
                        const tot = Number(compFormData.valorTotalCompensado || 0);
                        setCompFormData({
                          ...compFormData,
                          valorJuros: valJuros,
                          valorPrincipal: Math.max(0, tot - valJuros)
                        });
                      }}
                      style={{ padding: "8px", background: "#1e293b", border: "1px solid #818cf8", color: "#a5b4fc", borderRadius: "6px", fontWeight: "bold" }}
                    />
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "3px", display: "block" }}>
                      Não baixa o crédito original (Receita de Juros)
                    </span>
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: "0.3rem", color: "#fbbf24", fontSize: "0.83rem", fontWeight: "600" }}>
                      Parcela de Principal (Baixa do Crédito) (R$):
                    </label>
                    <CurrencyInput
                      value={compFormData.valorPrincipal}
                      onChange={valPrinc => {
                        setCompFormData({
                          ...compFormData,
                          valorPrincipal: valPrinc
                        });
                      }}
                      style={{ padding: "8px", background: "#1e293b", border: "1px solid #f59e0b", color: "#fbbf24", borderRadius: "6px", fontWeight: "bold" }}
                    />
                    <span style={{ fontSize: "0.72rem", color: "#34d399", marginTop: "3px", display: "block" }}>
                      Apenas este valor será deduzido do saldo
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
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

              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", color: "#94a3b8", fontSize: "0.85rem" }}>Observações Adicionais</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="Ex: Compensado débito de PIS/COFINS com juros Selic..."
                  value={compFormData.observacao || ""}
                  onChange={e => setCompFormData({ ...compFormData, observacao: e.target.value })}
                  style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "6px" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #334155", paddingTop: "1rem", marginTop: "1rem" }}>
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