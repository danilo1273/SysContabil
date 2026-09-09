import React, { useState, useEffect } from 'react';
import { getHistorySeries, getSettings, saveSettings } from '../utils/db';

const formatNumber = (val) => {
  return (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const monthNames = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];

function InlineMoneyInput({ value, onChange }) {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      const num = Number(value) || 0;
      setText(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  }, [value, isFocused]);

  const handleChange = (e) => {
    let raw = e.target.value.replace(/[^\d,-]/g, '');
    const isNeg = raw.startsWith('-');
    raw = raw.replace(/-/g, '');
    let [intPart = '', decPart] = raw.split(',');
    intPart = intPart.replace(/^0+(?=\d)/, '');
    if (intPart === '' && decPart !== undefined) intPart = '0';
    const fmt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    setText((isNeg ? '-' : '') + fmt + (decPart !== undefined ? ',' + decPart.slice(0, 2) : ''));
  };

  const handleBlur = () => {
    setIsFocused(false);
    let raw = text.replace(/[^\d,-]/g, '');
    const isNeg = raw.startsWith('-');
    raw = raw.replace(/-/g, '');
    let [intPart = '0', decPart = '0'] = raw.split(',');
    intPart = intPart.replace(/^0+(?=\d)/, '');
    const num = (parseInt(intPart || '0', 10)) + (parseFloat('0.' + (decPart || '0')) || 0);
    onChange(isNeg ? -num : num);
  };

  return (
    <input
      type="text"
      value={text}
      onFocus={() => setIsFocused(true)}
      onChange={handleChange}
      onBlur={handleBlur}
      style={{
        width: '130px',
        padding: '3px 6px',
        textAlign: 'right',
        fontSize: '0.9rem',
        fontWeight: 'bold',
        border: '1px solid #00B0FF',
        borderRadius: '4px',
        background: '#fff',
        color: '#000',
        outline: 'none'
      }}
    />
  );
}

function FaturamentoModule({ companies = [], selectedCompany, selectedAno, selectedMes }) {
  const [loading, setLoading] = useState(false);
  const [faturamentoData, setFaturamentoData] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [saveStatus, setSaveStatus] = useState('');

  // Carrega overrides salvos no banco
  useEffect(() => {
    async function loadOverrides() {
      try {
        const saved = await getSettings(`agf_faturamento_overrides_${selectedCompany}`);
        if (saved && typeof saved === 'object') {
          setOverrides(saved);
        } else {
          setOverrides({});
        }
      } catch (e) {
        console.error('Erro ao carregar overrides de faturamento:', e);
      }
    }
    loadOverrides();
  }, [selectedCompany]);

  useEffect(() => {
    async function loadLTMData() {
      if (!selectedAno || !selectedMes) return;
      setLoading(true);
      try {
        // Contas exatas de Receita e Devoluções
        const accReceita = '3.1.1.1.01'; // Receita Bruta de Vendas / Serviços
        const accDevolucao = '3.1.1.2.02'; // Devoluções de Vendas

        let totalCurrentYear = [];
        let totalPreviousYear = [];

        const processRow = (row, targetArray) => {
          let valueToAdd = 0;
          // Lê valorMensal (padrão contábil do banco), fallback para total ou saldoAcumulado
          const val = Number(row.valorMensal !== undefined ? row.valorMensal : (row.total !== undefined ? row.total : (row.saldoAcumulado || 0)));
          if (isNaN(val) || val === 0) return;

          if (row.conta && row.conta.endsWith('.EXC')) {
            valueToAdd = -Math.abs(val);
          } else if (row.conta && row.conta.startsWith(accReceita)) {
            // Receita bruta (valor positivo)
            valueToAdd = Math.abs(val);
          } else if (row.conta && row.conta.startsWith(accDevolucao)) {
            // Devoluções (reduz a receita bruta)
            valueToAdd = -Math.abs(val);
          }

          if (valueToAdd !== 0) {
            const mesIdx = targetArray.findIndex(m => m.mes === row.mes);
            if (mesIdx >= 0) {
              targetArray[mesIdx].total += valueToAdd;
            } else {
              targetArray.push({ mes: row.mes, total: valueToAdd });
            }
          }
        };

        // Se consolidado ou empresa específica
        if (selectedCompany === 'consolidado') {
          const resCurrent = await getHistorySeries('consolidado', selectedAno);
          const resPrevious = await getHistorySeries('consolidado', selectedAno - 1);

          (resCurrent.dre || []).forEach(row => processRow(row, totalCurrentYear));
          (resPrevious.dre || []).forEach(row => processRow(row, totalPreviousYear));
        } else {
          const resCurrent = await getHistorySeries(selectedCompany, selectedAno);
          const resPrevious = await getHistorySeries(selectedCompany, selectedAno - 1);

          (resCurrent.dre || []).forEach(row => processRow(row, totalCurrentYear));
          (resPrevious.dre || []).forEach(row => processRow(row, totalPreviousYear));
        }

        // Construir array com os últimos 12 meses (LTM)
        const ltm = [];
        for (let i = 11; i >= 0; i--) {
          let m = selectedMes - i;
          let y = selectedAno;
          if (m <= 0) {
            m += 12;
            y -= 1;
          }

          let calculatedVal = 0;
          if (y === selectedAno) {
            const row = totalCurrentYear.find(r => r.mes === m);
            if (row) calculatedVal = row.total;
          } else {
            const row = totalPreviousYear.find(r => r.mes === m);
            if (row) calculatedVal = row.total;
          }

          const monthKey = `${y}-${m}`;
          const isManual = overrides[monthKey] !== undefined;
          const finalVal = isManual ? Number(overrides[monthKey]) : calculatedVal;

          ltm.push({
            monthKey,
            mesNum: m,
            ano: y,
            label: `${monthNames[m - 1]} ${y}`,
            calculatedValue: calculatedVal,
            value: finalVal,
            isManual
          });
        }

        setFaturamentoData(ltm);
      } catch (err) {
        console.error('Erro ao carregar Faturamento LTM:', err);
      } finally {
        setLoading(false);
      }
    }

    loadLTMData();
  }, [selectedCompany, selectedAno, selectedMes, companies, overrides]);

  const handleValueChange = (monthKey, newVal) => {
    setOverrides(prev => ({
      ...prev,
      [monthKey]: newVal
    }));
  };

  const handleSaveOverrides = async () => {
    setSaveStatus('saving');
    try {
      await saveSettings(`agf_faturamento_overrides_${selectedCompany}`, overrides);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleResetOverrides = async () => {
    if (window.confirm('Deseja restaurar os valores originais importados dos balancetes contábeis?')) {
      setOverrides({});
      try {
        await saveSettings(`agf_faturamento_overrides_${selectedCompany}`, {});
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Separar em duas colunas de 6 meses
  const col1 = faturamentoData.slice(0, 6);
  const col2 = faturamentoData.slice(6, 12);
  const grandTotal = faturamentoData.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);

  // Empresa Cabeçalho
  const companyHeaders = {
    'equipamentos': { nome: 'AGF IMPORTAÇÃO EXPORTAÇÃO E COMERCIALIZAÇÃO DE MAQUINAS E ACESSORIOS LTDA', cnpj: '11.681.470/0001-84 IE: 530051442114' },
    'rompedores': { nome: 'AGF ROMPEDORES LTDA', cnpj: '' },
    'casa': { nome: 'CASA DA ESCAVADEIRA LTDA', cnpj: '' },
    'agf_participa_es': { nome: 'AGF PARTICIPAÇÕES LTDA', cnpj: '' },
    'consolidado': { nome: 'AGF GROUP - CONSOLIDADO', cnpj: 'Múltiplos CNPJs' }
  };

  const compData = selectedCompany !== 'consolidado' ? companies.find(c => c.id === selectedCompany) : null;
  
  const currentHeader = companyHeaders[selectedCompany] || { 
    nome: compData ? compData.name.toUpperCase() : 'AGF GROUP', 
    cnpj: '' 
  };

  const headerNome = currentHeader.nome;
  const headerCnpj = currentHeader.cnpj ? `CNPJ: ${currentHeader.cnpj}` : '';

  const dataAtual = new Date();
  const dataFormatada = `${dataAtual.getDate()} ${monthNames[dataAtual.getMonth()]} ${dataAtual.getFullYear()}`;

  return (
    <div className="glass-panel" style={{ padding: '2rem', position: 'relative', background: '#fff', color: '#000' }}>
      {/* Barra de Ações Superior */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.8rem' }} className="action-btn">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '6px',
              border: isEditing ? '1px solid #FF9800' : '1px solid #00B0FF',
              background: isEditing ? 'rgba(255, 152, 0, 0.1)' : 'rgba(0, 176, 255, 0.1)',
              color: isEditing ? '#E65100' : '#0277BD',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            {isEditing ? '✓ Concluir Edição' : '✏️ Ajustar / Complementar Valores'}
          </button>

          {isEditing && (
            <>
              <button
                type="button"
                onClick={handleSaveOverrides}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid #4CAF50',
                  background: '#4CAF50',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                💾 Salvar Ajustes
              </button>

              <button
                type="button"
                onClick={handleResetOverrides}
                style={{
                  padding: '0.55rem 0.8rem',
                  borderRadius: '6px',
                  border: '1px solid #999',
                  background: '#f5f5f5',
                  color: '#666',
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                ↺ Restaurar Balancetes
              </button>
            </>
          )}

          {saveStatus === 'saving' && <span style={{ color: '#0288D1', fontSize: '0.82rem' }}>Gravando...</span>}
          {saveStatus === 'success' && <span style={{ color: '#2E7D32', fontWeight: 700, fontSize: '0.82rem' }}>✓ Ajustes salvos!</span>}
          {saveStatus === 'error' && <span style={{ color: '#D32F2F', fontSize: '0.82rem' }}>Erro ao salvar.</span>}
        </div>

        <button 
          onClick={() => window.print()} 
          className="btn-primary" 
          style={{ padding: '0.6rem 1.2rem', fontWeight: 700 }}
        >
          🖨️ Exportar PDF
        </button>
      </div>

      <div id="printable-faturamento" style={{ fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '0 auto', color: '#000' }}>
        
        {/* Header da Empresa */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem 0', fontWeight: 'bold' }}>{headerNome}</h2>
            {headerCnpj && <p style={{ fontSize: '0.9rem', margin: 0 }}>{headerCnpj}</p>}
          </div>
        </div>

        {/* Tabela de Dados */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '0.95rem' }}>
          <thead>
            <tr>
              <th colSpan="4" style={{ background: '#e8e8e8', border: '1px solid #000', padding: '0.5rem', textAlign: 'center', fontWeight: 'bold', fontSize: '1.05rem', color: '#000' }}>
                RELAÇÃO DE FATURAMENTO ATÉ {monthNames[selectedMes - 1]} {selectedAno}
              </th>
            </tr>
            <tr style={{ background: '#a5a5a5' }}>
              <th style={{ border: '1px solid #000', padding: '0.6rem', width: '25%', color: '#fff', fontWeight: 'normal' }}>MÊS/ANO</th>
              <th style={{ border: '1px solid #000', padding: '0.6rem', width: '25%', color: '#fff', fontWeight: 'normal' }}>R$</th>
              <th style={{ border: '1px solid #000', padding: '0.6rem', width: '25%', color: '#fff', fontWeight: 'normal' }}>MÊS/ANO</th>
              <th style={{ border: '1px solid #000', padding: '0.6rem', width: '25%', color: '#fff', fontWeight: 'normal' }}>R$</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>Calculando Faturamento...</td></tr>
            ) : (
              col1.map((item1, idx) => {
                const item2 = col2[idx];
                return (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#ebebeb' : '#f9f9f9', color: '#333' }}>
                    <td style={{ border: '1px solid #777', padding: '0.4rem 0.75rem', textAlign: 'center' }}>
                      {item1?.label}
                    </td>
                    <td style={{ border: '1px solid #777', padding: '0.4rem 0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>R$</span>
                        {isEditing ? (
                          <InlineMoneyInput
                            value={item1?.value}
                            onChange={(newVal) => handleValueChange(item1.monthKey, newVal)}
                          />
                        ) : (
                          <span style={{ fontWeight: item1?.isManual ? 700 : 'normal', color: item1?.isManual ? '#0277BD' : '#000' }}>
                            {formatNumber(item1?.value)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ border: '1px solid #777', padding: '0.4rem 0.75rem', textAlign: 'center' }}>
                      {item2?.label}
                    </td>
                    <td style={{ border: '1px solid #777', padding: '0.4rem 0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>R$</span>
                        {isEditing && item2 ? (
                          <InlineMoneyInput
                            value={item2?.value}
                            onChange={(newVal) => handleValueChange(item2.monthKey, newVal)}
                          />
                        ) : (
                          <span style={{ fontWeight: item2?.isManual ? 700 : 'normal', color: item2?.isManual ? '#0277BD' : '#000' }}>
                            {formatNumber(item2?.value)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            <tr style={{ background: '#a5a5a5', color: '#fff', fontSize: '1.05rem', fontWeight: 'bold' }}>
              <td colSpan="2" style={{ border: '1px solid #777', background: '#a5a5a5' }}></td>
              <td style={{ border: '1px solid #777', padding: '0.5rem 0.75rem', textAlign: 'center' }}>TOTAL PERÍODO</td>
              <td style={{ border: '1px solid #777', padding: '0.5rem 0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>R$</span>
                  <span>{formatNumber(grandTotal)}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Assinatura */}
        <div style={{ marginTop: '5rem', textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '60%', margin: '0 auto 1rem auto' }}></div>
          <p style={{ fontSize: '1rem', fontWeight: 'bold' }}>{dataFormatada}</p>
        </div>
      </div>
    </div>
  );
}

export default FaturamentoModule;
