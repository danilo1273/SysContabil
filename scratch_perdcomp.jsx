import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Save, X, DollarSign, FileText } from "lucide-react";

const formatCurrency = (val) => {
  if (!val) return "R$ 0,00";
  return parseFloat(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const parseCurrency = (val) => {
  if (!val) return 0;
  const num = val.replace(/[^\d,-]/g, "").replace(",", ".");
  return parseFloat(num) || 0;
};

// CurrencyInput Component
const CurrencyInput = ({ value, onChange, placeholder }) => {
  const [displayValue, setDisplayValue] = useState("");
  
  useEffect(() => {
    setDisplayValue(parseFloat(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }, [value]);

  const handleBlur = (e) => {
    let val = e.target.value;
    val = val.replace(/[^\d,-]/g, "").replace(",", ".");
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
      placeholder={placeholder}
      style={{ width: "100%", textAlign: "right" }}
    />
  );
};

export default function PerdcompModule({ companies, canEdit }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(null);

  useEffect(() => {
    fetch("/api/settings/perdcomp_store")
      .then(res => res.json())
      .then(data => {
        if (data && data.value) {
          setRecords(JSON.parse(data.value));
        }
      })
      .catch(err => console.error("Erro ao carregar PERDCOMP", err))
      .finally(() => setLoading(false));
  }, []);

  const saveToDb = async (newData) => {
    try {
      await fetch("/api/settings/perdcomp_store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: newData })
      });
      setRecords(newData);
    } catch (e) {
      alert("Erro ao salvar no banco");
    }
  };

  const handleOpenModal = (record = null) => {
    if (record) {
      setFormData({ ...record });
    } else {
      setFormData({
        id: Date.now().toString(),
        empresaId: companies[0]?.id || "",
        processo: "",
        dataOrigem: "",
        tributoOrigem: "IRPJ",
        tipoCredito: "Saldo Negativo",
        valorOriginal: 0,
        valorCompensado: 0,
        status: "Em Análise",
        detalhes: ""
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.processo || !formData.empresaId) {
      alert("Preencha a empresa e o número do processo.");
      return;
    }
    
    let newData;
    const exists = records.find(r => r.id === formData.id);
    if (exists) {
      newData = records.map(r => r.id === formData.id ? formData : r);
    } else {
      newData = [formData, ...records];
    }
    
    saveToDb(newData);
    setIsModalOpen(false);
  };

  const handleDelete = (id) => {
    if (confirm("Tem certeza que deseja excluir este controle?")) {
      const newData = records.filter(r => r.id !== id);
      saveToDb(newData);
    }
  };

  const tributosOrigem = ["IRPJ", "CSLL", "PIS", "COFINS", "IPI", "INSS", "IRRF", "Outros"];
  const tipos = ["Saldo Negativo", "Pagamento Indevido a Maior", "Ressarcimento", "Reintegra", "Outros"];
  const statuses = ["Em Análise", "Homologado Parcial", "Homologado Total", "Indeferido"];

  const totalOriginal = records.reduce((acc, r) => acc + parseFloat(r.valorOriginal || 0), 0);
  const totalCompensado = records.reduce((acc, r) => acc + parseFloat(r.valorCompensado || 0), 0);
  const saldoGeral = totalOriginal - totalCompensado;

  return (
    <div style={{ padding: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          <FileText size={24} style={{ color: "#64B5F6" }} /> 
          Gestão de Pedidos de Restituição, Ressarcimento e Compensação
        </h3>
        {canEdit && (
          <button className="btn-primary" onClick={() => handleOpenModal()} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Plus size={18} /> Novo PER/DCOMP
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <div style={{ background: "linear-gradient(135deg, #1e1e1e 0%, #1a233a 100%)", padding: "1.5rem", borderRadius: "12px", border: "1px solid #333", textAlign: "center" }}>
          <div style={{ fontSize: "0.9rem", color: "#aaa", marginBottom: "0.5rem" }}>Total Original Solicitado</div>
          <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#64B5F6" }}>{formatCurrency(totalOriginal)}</div>
        </div>
        <div style={{ background: "linear-gradient(135deg, #1e1e1e 0%, #1b2e23 100%)", padding: "1.5rem", borderRadius: "12px", border: "1px solid #333", textAlign: "center" }}>
          <div style={{ fontSize: "0.9rem", color: "#aaa", marginBottom: "0.5rem" }}>Total Compensado / Utilizado</div>
          <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#81C784" }}>{formatCurrency(totalCompensado)}</div>
        </div>
        <div style={{ background: "linear-gradient(135deg, #1e1e1e 0%, #3e2723 100%)", padding: "1.5rem", borderRadius: "12px", border: "1px solid #333", textAlign: "center" }}>
          <div style={{ fontSize: "0.9rem", color: "#aaa", marginBottom: "0.5rem" }}>Saldo a Compensar</div>
          <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#FFCA28" }}>{formatCurrency(saldoGeral)}</div>
        </div>
      </div>

      <div className="table-container" style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Nº PER/DCOMP</th>
              <th>Competência</th>
              <th>Tributo</th>
              <th>Tipo</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Valor Original</th>
              <th style={{ textAlign: "right" }}>Compensado</th>
              <th style={{ textAlign: "right" }}>Saldo</th>
              <th>Detalhes / Impostos Abatidos</th>
              {canEdit && <th style={{ width: "80px", textAlign: "center" }}>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {records.map(r => {
              const saldo = parseFloat(r.valorOriginal || 0) - parseFloat(r.valorCompensado || 0);
              return (
                <tr key={r.id}>
                  <td>{companies.find(c => c.id === r.empresaId)?.name || r.empresaId}</td>
                  <td style={{ color: "#FFCA28", fontWeight: "bold" }}>{r.processo || "-"}</td>
                  <td>{r.dataOrigem ? r.dataOrigem.split("-").reverse().join("/") : "-"}</td>
                  <td>{r.tributoOrigem || "-"}</td>
                  <td>{r.tipoCredito}</td>
                  <td>
                    <span style={{
                      padding: "4px 8px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "bold",
                      background: r.status.includes("Homologado") ? "rgba(76, 175, 80, 0.2)" : r.status.includes("Indeferido") ? "rgba(244, 67, 54, 0.2)" : "rgba(255, 152, 0, 0.2)",
                      color: r.status.includes("Homologado") ? "#81C784" : r.status.includes("Indeferido") ? "#FF5252" : "#FFCA28"
                    }}>{r.status}</span>
                  </td>
                  <td style={{ color: "#64B5F6", textAlign: "right" }}>{formatCurrency(r.valorOriginal)}</td>
                  <td style={{ color: "#81C784", textAlign: "right" }}>{formatCurrency(r.valorCompensado)}</td>
                  <td style={{ fontWeight: "bold", color: saldo > 0 ? "#fff" : "#888", textAlign: "right" }}>{formatCurrency(saldo)}</td>
                  <td style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem", color: "#ccc", maxWidth: "300px" }}>{r.detalhes || "-"}</td>
                  {canEdit && (
                    <td>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                        <button onClick={() => handleOpenModal(r)} style={{ background: "transparent", color: "#64B5F6", border: "none", cursor: "pointer", padding: "4px" }}><Edit2 size={18} /></button>
                        <button onClick={() => handleDelete(r.id)} style={{ background: "transparent", color: "#FF5252", border: "none", cursor: "pointer", padding: "4px" }}><Trash2 size={18} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {records.length === 0 && !loading && (
              <tr><td colSpan={canEdit ? 11 : 10} style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Nenhum processo PER/DCOMP registrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && formData && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
        }}>
          <div style={{
            background: "#1e1e1e", padding: "2rem", borderRadius: "12px", width: "90%", maxWidth: "800px",
            border: "1px solid #333", boxShadow: "0 10px 30px rgba(0,0,0,0.5)", maxHeight: "90vh", overflowY: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid #333", paddingBottom: "1rem" }}>
              <h2 style={{ margin: 0, color: "#64B5F6" }}>{records.find(r => r.id === formData.id) ? "Editar PER/DCOMP" : "Novo PER/DCOMP"}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "transparent", border: "none", color: "#aaa", cursor: "pointer" }}><X size={24} /></button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", color: "#ccc", fontSize: "0.9rem" }}>Empresa</label>
                <select className="text-input" value={formData.empresaId} onChange={e => setFormData({...formData, empresaId: e.target.value})} style={{ width: "100%" }}>
                  <option value="">Selecione...</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", color: "#ccc", fontSize: "0.9rem" }}>Nº do Processo / PERDCOMP</label>
                <input type="text" className="text-input" value={formData.processo} onChange={e => setFormData({...formData, processo: e.target.value})} style={{ width: "100%" }} placeholder="Ex: 12345.67890/2026-11" />
              </div>
              
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", color: "#ccc", fontSize: "0.9rem" }}>Competência / Data Origem</label>
                <input type="date" className="text-input" value={formData.dataOrigem} onChange={e => setFormData({...formData, dataOrigem: e.target.value})} style={{ width: "100%" }} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", color: "#ccc", fontSize: "0.9rem" }}>Status</label>
                <select className="text-input" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} style={{ width: "100%" }}>
                  {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", color: "#ccc", fontSize: "0.9rem" }}>Tributo do Crédito</label>
                <select className="text-input" value={formData.tributoOrigem} onChange={e => setFormData({...formData, tributoOrigem: e.target.value})} style={{ width: "100%" }}>
                  <option value="">Selecione...</option>
                  {tributosOrigem.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", color: "#ccc", fontSize: "0.9rem" }}>Tipo de Crédito</label>
                <select className="text-input" value={formData.tipoCredito} onChange={e => setFormData({...formData, tipoCredito: e.target.value})} style={{ width: "100%" }}>
                  <option value="">Selecione...</option>
                  {tipos.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", color: "#ccc", fontSize: "0.9rem" }}>Valor Original (R$)</label>
                <CurrencyInput value={formData.valorOriginal} onChange={(val) => setFormData({...formData, valorOriginal: val})} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", color: "#ccc", fontSize: "0.9rem" }}>Valor Já Compensado (R$)</label>
                <CurrencyInput value={formData.valorCompensado} onChange={(val) => setFormData({...formData, valorCompensado: val})} />
              </div>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", color: "#ccc", fontSize: "0.9rem" }}>Detalhes / Histórico de Compensações (Onde foi usado?)</label>
              <textarea 
                className="text-input" 
                value={formData.detalhes} 
                onChange={e => setFormData({...formData, detalhes: e.target.value})} 
                placeholder="Ex: Abatido 10k de IRPJ no mês 03/2026, 5k de CSLL no mês 04/2026..." 
                style={{ width: "100%", minHeight: "100px", resize: "vertical", fontFamily: "inherit" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "2rem", borderTop: "1px solid #333", paddingTop: "1.5rem" }}>
              <button className="btn-secondary" onClick={() => setIsModalOpen(false)} style={{ padding: "0.8rem 1.5rem" }}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} style={{ padding: "0.8rem 1.5rem", display: "flex", alignItems: "center", gap: "8px" }}>
                <Save size={18} /> Salvar Processo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

