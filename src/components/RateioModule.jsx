import React, { useState, useEffect } from 'react';
import { getRawRecords, getSettings, saveSettings, updateRecord, addManualEntryToDB } from '../utils/db';

export default function RateioModule({ companies }) {
  const [selectedHolding, setSelectedHolding] = useState('');
  const [selectedMes, setSelectedMes] = useState(new Date().getMonth() + 1);
  const [selectedAno, setSelectedAno] = useState(new Date().getFullYear());
  const [aliqISS, setAliqISS] = useState(3.0);
  const [aliqPIS, setAliqPIS] = useState(1.65);
  const [aliqCOFINS, setAliqCOFINS] = useState(7.6);
  
  const [rateioConfig, setRateioConfig] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);

  const [despesasFolha, setDespesasFolha] = useState(0);
  const [outrasDespesas, setOutrasDespesas] = useState(0);
  const [detalhesFolha, setDetalhesFolha] = useState([]);
  const [detalhesOutras, setDetalhesOutras] = useState([]);
  const [showDetalhes, setShowDetalhes] = useState(false);

  const [includeProvisions, setIncludeProvisions] = useState(true);
  const [expensePercents, setExpensePercents] = useState({});

  const [isEditingHolding, setIsEditingHolding] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [companies]);

  useEffect(() => {
    if (selectedHolding && selectedMes && selectedAno) {
      loadDRE();
    }
  }, [selectedHolding, selectedMes, selectedAno, includeProvisions, expensePercents]);

  const loadConfig = async () => {
    try {
      const config = await getSettings('agf_rateio_config');
      if (config) {
        setRateioConfig(config.percentuais || {});
        if (config.aliqISS !== undefined) setAliqISS(config.aliqISS);
        if (config.aliqPIS !== undefined) setAliqPIS(config.aliqPIS);
        if (config.aliqCOFINS !== undefined) setAliqCOFINS(config.aliqCOFINS);
        if (config.includeProvisions !== undefined) setIncludeProvisions(config.includeProvisions);
        if (config.expensePercents !== undefined) setExpensePercents(config.expensePercents);

        if (config.holdingId) {
            setSelectedHolding(config.holdingId);
        } else {
            const hold = companies.find(c => c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").includes('participacoes'));
            if (hold) setSelectedHolding(hold.id);
        }
      } else {
        const hold = companies.find(c => c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").includes('participacoes'));
        if (hold) setSelectedHolding(hold.id);
      }
    } catch (e) { console.error(e); }
  };

  const saveConfig = async (newRateios, iss, pis, cofins, newHolding, incProv = includeProvisions, expPerc = expensePercents) => {
    try {
      await saveSettings('agf_rateio_config', { 
        percentuais: newRateios, 
        aliqISS: iss, 
        aliqPIS: pis, 
        aliqCOFINS: cofins, 
        holdingId: newHolding,
        includeProvisions: incProv,
        expensePercents: expPerc
      });
    } catch (e) { console.error(e); }
  };

  const handleExpensePercentChange = (conta, val) => {
      const num = Math.min(Math.max(parseFloat(val) || 0, 0), 100);
      const newPercs = { ...expensePercents, [conta]: num };
      setExpensePercents(newPercs);
      saveConfig(rateioConfig, aliqISS, aliqPIS, aliqCOFINS, selectedHolding, includeProvisions, newPercs);
  };

  const handleRateioChange = (empresaId, value) => {
    const val = parseFloat(value) || 0;
    const newRateios = { ...rateioConfig, [empresaId]: val };
    setRateioConfig(newRateios);
    saveConfig(newRateios, aliqISS, aliqPIS, aliqCOFINS, selectedHolding);
  };

  const handleAliqISSChange = (value) => {
    const val = parseFloat(value) || 0;
    setAliqISS(val);
    saveConfig(rateioConfig, val, aliqPIS, aliqCOFINS, selectedHolding);
  };

  const handleAliqPISChange = (value) => {
    const val = parseFloat(value) || 0;
    setAliqPIS(val);
    saveConfig(rateioConfig, aliqISS, val, aliqCOFINS, selectedHolding);
  };

  const handleAliqCOFINSChange = (value) => {
    const val = parseFloat(value) || 0;
    setAliqCOFINS(val);
    saveConfig(rateioConfig, aliqISS, aliqPIS, val, selectedHolding);
  };

  const handleHoldingChange = (value) => {
    setSelectedHolding(value);
    saveConfig(rateioConfig, aliqISS, aliqPIS, aliqCOFINS, value);
    setIsEditingHolding(false);
  };

  const loadDRE = async () => {
    setIsProcessing(true);
    try {
      const data = await getRawRecords(selectedAno, selectedMes);
      const dreHolding = data.dre.filter(r => r.empresaId === selectedHolding);
      
      let folha = 0;
      let outras = 0;
      let folhaArr = [];
      let outrasArr = [];

      dreHolding.forEach(r => {
        let valorEfetivo = r.valorMensal * -1;
        
        // Regra de provisões
        if (!includeProvisions && (r.conta === '4.2.1.2.01.00097' || r.conta === '4.2.1.2.01.00098')) {
            valorEfetivo = 0;
        }

        if (valorEfetivo === 0 && Math.abs(r.valorMensal) === 0) return;

        if (r.conta.startsWith('4.2.1.2.01') && r.valorMensal !== 0) {
          folha += valorEfetivo; 
          folhaArr.push({ 
            conta: r.conta, 
            descricao: r.descricao, 
            valor: valorEfetivo
          });
        } else if (
          (r.conta.startsWith('3.2') || r.conta.startsWith('4.') || r.conta.startsWith('5.') || r.conta.startsWith('6.') || r.conta.startsWith('7.')) 
          && !r.conta.startsWith('4.4') 
          && !r.conta.startsWith('4.3') 
          && r.valorMensal !== 0
        ) {
          const customPerc = expensePercents[r.conta];
          const percToApply = customPerc !== undefined ? customPerc : 100;
          const finalValue = valorEfetivo * (percToApply / 100);
          
          outras += finalValue;
          outrasArr.push({ 
            conta: r.conta, 
            descricao: r.descricao, 
            valor: finalValue, 
            original: r.valorMensal * -1, 
            perc: percToApply 
          });
        }
      });

      // Ordenar por valor descrescente
      folhaArr.sort((a, b) => b.valor - a.valor);
      outrasArr.sort((a, b) => b.valor - a.valor);

      // Transformar em valor positivo para o custo
      setDespesasFolha(folha);
      setOutrasDespesas(outras);
      setDetalhesFolha(folhaArr);
      setDetalhesOutras(outrasArr);

    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const totalCusto = despesasFolha + outrasDespesas;
  
  const aliquotaTotal = aliqISS + aliqPIS + aliqCOFINS;
  const fatorGrossUp = 1 - (aliquotaTotal / 100);
  const totalFaturar = fatorGrossUp > 0 ? totalCusto / fatorGrossUp : 0;
  const impostos = totalFaturar - totalCusto;

  const handleGravarFaturamento = async () => {
    if (!selectedHolding || totalFaturar === 0) return;
    setIsProcessing(true);
    try {
      const data = await getRawRecords(selectedAno, selectedMes);
      const dreRecords = data.dre.filter(r => r.empresaId === selectedHolding);

      const updateOrInsert = async (conta, descricao, valor) => {
        const existing = dreRecords.find(r => r.conta === conta);
        if (existing) {
          await updateRecord(existing.id, 'dre', valor);
        } else {
          await addManualEntryToDB(selectedHolding, selectedAno, selectedMes, conta, descricao, valor);
        }
      };

      const valReceita = totalFaturar;
      const valISS = - (totalFaturar * aliqISS / 100);
      const valPIS = - (totalFaturar * aliqPIS / 100);
      const valCOFINS = - (totalFaturar * aliqCOFINS / 100);

      await updateOrInsert('3.1.1.1.01.00003', 'RECEITA DE PRESTACAO DE SERVICOS (RATEIO)', valReceita);
      await updateOrInsert('3.1.1.2.01.00003', 'ISSQN', valISS);
      await updateOrInsert('3.1.1.2.01.00005', 'PIS S/ FATURAMENTO', valPIS);
      await updateOrInsert('3.1.1.2.01.00004', 'COFINS S/ FATURAMENTO', valCOFINS);

      alert('Faturamento do Rateio gravado no balancete da Holding com sucesso!');
      
    } catch (e) {
      console.error(e);
      alert('Erro ao gravar faturamento');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalPercentual = Object.values(rateioConfig).reduce((acc, val) => acc + val, 0);
  const operacionais = companies.filter(c => c.id !== selectedHolding);

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '1rem' }}>
      
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem', alignItems: 'center' }}>
         <div style={{ flex: 1, minWidth: '200px', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {isEditingHolding ? (
               <select value={selectedHolding} onChange={e => handleHoldingChange(e.target.value)} className="select-input" style={{ padding: '0.3rem', fontSize: '1rem' }}>
                  <option value="">Selecione a Empresa Holding...</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
            ) : (
               <>
                 <span>Empresa Holding: {companies.find(c => c.id === selectedHolding)?.name || 'Nenhuma selecionada'}</span>
                 <button onClick={() => setIsEditingHolding(true)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>
                   Trocar
                 </button>
               </>
            )}
         </div>
         <select value={selectedMes} onChange={(e) => setSelectedMes(parseInt(e.target.value))} className="select-input" style={{ width: '130px' }}>
            <option value={1}>Janeiro</option><option value={2}>Fevereiro</option><option value={3}>Março</option>
            <option value={4}>Abril</option><option value={5}>Maio</option><option value={6}>Junho</option>
            <option value={7}>Julho</option><option value={8}>Agosto</option><option value={9}>Setembro</option>
            <option value={10}>Outubro</option><option value={11}>Novembro</option><option value={12}>Dezembro</option>
          </select>
          <select value={selectedAno} onChange={(e) => setSelectedAno(parseInt(e.target.value))} className="select-input" style={{ width: '90px' }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {isProcessing && <span style={{ padding: '0.5rem', color: 'var(--color-primary)' }}>Calculando...</span>}
      </div>

      {!selectedHolding ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
          Selecione a Empresa Holding clicando em "Trocar" ali em cima.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
          
          {/* Lado Esquerdo: Resumo dos Custos da Holding */}
          <div>
             <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(33, 150, 243, 0.05)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                   <h4 style={{ color: '#2196F3', margin: 0 }}>Custos da Holding no Mês</h4>
                   <button 
                     onClick={() => setShowDetalhes(!showDetalhes)} 
                     style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', color: '#ccc', cursor: 'pointer', padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                   >
                     {showDetalhes ? 'Ocultar Detalhes' : 'Ver Detalhes'}
                   </button>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', color: '#ccc', fontWeight: 'bold' }}>
                  <span>Folha Salarial (4.2.1.2.01.*):</span>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', color: '#ff9800' }}>
                        <input type="checkbox" checked={includeProvisions} onChange={(e) => {
                            const checked = e.target.checked;
                            setIncludeProvisions(checked);
                            saveConfig(rateioConfig, aliqISS, aliqPIS, aliqCOFINS, selectedHolding, checked, expensePercents);
                        }} />
                        Incluir Provisões (00097/00098)
                    </label>
                    <span>{despesasFolha.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                </div>
                {showDetalhes && detalhesFolha.map(d => (
                  <div key={d.conta} style={{ display: 'flex', justifyContent: 'space-between', marginLeft: '1rem', fontSize: '0.8rem', color: '#888', marginBottom: '0.3rem' }}>
                    <span>{d.conta} - {d.descricao}</span>
                    <span>{d.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                ))}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', marginTop: '1rem', color: '#ccc', fontWeight: 'bold' }}>
                   <span>Outras Despesas Administrativas:</span>
                   <span>{outrasDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                {showDetalhes && detalhesOutras.map(d => (
                  <div key={d.conta} style={{ display: 'flex', justifyContent: 'space-between', marginLeft: '1rem', fontSize: '0.8rem', color: '#888', marginBottom: '0.3rem' }}>
                    <span>{d.conta} - {d.descricao}</span>
                    <span>{d.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                ))}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '1rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
                   <span>Custo Total a Ratear:</span>
                   <span>{totalCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
             </div>

             <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(255, 152, 0, 0.05)' }}>
                <h4 style={{ color: '#FF9800', marginBottom: '1rem' }}>Gross-up e Faturamento</h4>
                 
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div>
                       <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.5rem' }}>ISSQN (%)</label>
                       <input 
                         type="number" 
                         className="text-input" 
                         value={aliqISS} 
                         onChange={e => handleAliqISSChange(e.target.value)} 
                         step="0.01"
                       />
                    </div>
                    <div>
                       <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.5rem' }}>PIS (%)</label>
                       <input 
                         type="number" 
                         className="text-input" 
                         value={aliqPIS} 
                         onChange={e => handleAliqPISChange(e.target.value)} 
                         step="0.01"
                       />
                    </div>
                    <div>
                       <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.5rem' }}>COFINS (%)</label>
                       <input 
                         type="number" 
                         className="text-input" 
                         value={aliqCOFINS} 
                         onChange={e => handleAliqCOFINSChange(e.target.value)} 
                         step="0.01"
                       />
                    </div>
                 </div>

                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#ccc' }}>
                    <span>Custo Líquido (Base):</span>
                    <span>{totalCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: '#f44336' }}>
                    <span>(+) Impostos Embutidos ({aliquotaTotal.toFixed(2)}%):</span>
                    <span>{impostos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '1rem', fontSize: '1.3rem', fontWeight: 'bold', color: '#4CAF50' }}>
                    <span>Valor Total da Nota:</span>
                    <span>{totalFaturar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                 </div>

                 <div style={{ marginTop: '2rem', textAlign: 'right' }}>
                    <button className="btn-primary" onClick={handleGravarFaturamento} disabled={isProcessing || totalFaturar === 0}>
                       {isProcessing ? 'Gravando...' : 'Gravar Faturamento na Holding'}
                    </button>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.5rem', textAlign: 'right' }}>
                      Isto gravará a Receita e os Impostos (DRE) para a Holding neste mês.
                    </div>
                 </div>
             </div>
          </div>

          {/* Lado Direito: Rateio por Empresa Operacional */}
          <div>
            <h4 style={{ marginBottom: '1rem', color: '#fff' }}>Distribuição do Rateio</h4>
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: totalPercentual === 100 ? '#4CAF50' : '#f44336' }}>
                Total Distribuído: <strong>{totalPercentual.toFixed(2)}%</strong>
              </span>
              {totalPercentual !== 100 && (
                <span style={{ fontSize: '0.8rem', color: '#FF9800' }}>⚠️ O rateio deve somar exatamente 100%</span>
              )}
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Empresa Operacional</th>
                  <th style={{ width: '100px' }}>Rateio (%)</th>
                  <th style={{ textAlign: 'right' }}>Valor a Faturar</th>
                </tr>
              </thead>
              <tbody>
                {operacionais.map(c => {
                  const perc = rateioConfig[c.id] || 0;
                  const fatia = totalFaturar * (perc / 100);
                  return (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>
                        <input 
                          type="number" 
                          className="text-input" 
                          style={{ padding: '0.3rem', width: '80px', textAlign: 'center' }} 
                          value={perc} 
                          onChange={(e) => handleRateioChange(c.id, e.target.value)}
                          step="0.01"
                        />
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#4CAF50' }}>
                        {fatia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  );
}
