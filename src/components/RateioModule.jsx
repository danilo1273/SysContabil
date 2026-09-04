import React, { useState, useEffect } from 'react';
import { getRawRecords, getSettings, saveSettings, updateRecord, addManualEntryToDB } from '../utils/db';
import EquivalenciaPatrimonialModule from './EquivalenciaPatrimonialModule';

export default function RateioModule({ companies }) {
  const [subTab, setSubTab] = useState('mep'); // 'mep' ou 'rateio'
  const [selectedHolding, setSelectedHolding] = useState('');
  const [selectedMes, setSelectedMes] = useState(new Date().getMonth() + 1);
  const [selectedAno, setSelectedAno] = useState(new Date().getFullYear());
  const [aliqISS, setAliqISS] = useState(3.0);
  const [aliqPIS, setAliqPIS] = useState(1.65);
  const [aliqCOFINS, setAliqCOFINS] = useState(7.6);
  
  const [rateioConfig, setRateioConfig] = useState({});
  const [contasEspecificas, setContasEspecificas] = useState({});
  const [selectedAddConta, setSelectedAddConta] = useState('');
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
        if (config.contasEspecificas !== undefined) setContasEspecificas(config.contasEspecificas || {});
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

  const saveConfig = async (
    newRateios = rateioConfig, 
    iss = aliqISS, 
    pis = aliqPIS, 
    cofins = aliqCOFINS, 
    newHolding = selectedHolding, 
    incProv = includeProvisions, 
    expPerc = expensePercents,
    specContas = contasEspecificas
  ) => {
    try {
      await saveSettings('agf_rateio_config', { 
        percentuais: newRateios, 
        contasEspecificas: specContas,
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
      saveConfig(rateioConfig, aliqISS, aliqPIS, aliqCOFINS, selectedHolding, includeProvisions, newPercs, contasEspecificas);
  };

  const handleRateioChange = (empresaId, value) => {
    const val = parseFloat(value) || 0;
    const newRateios = { ...rateioConfig, [empresaId]: val };
    setRateioConfig(newRateios);
    saveConfig(newRateios, aliqISS, aliqPIS, aliqCOFINS, selectedHolding, includeProvisions, expensePercents, contasEspecificas);
  };

  const handleAliqISSChange = (value) => {
    const val = parseFloat(value) || 0;
    setAliqISS(val);
    saveConfig(rateioConfig, val, aliqPIS, aliqCOFINS, selectedHolding, includeProvisions, expensePercents, contasEspecificas);
  };

  const handleAliqPISChange = (value) => {
    const val = parseFloat(value) || 0;
    setAliqPIS(val);
    saveConfig(rateioConfig, aliqISS, val, aliqCOFINS, selectedHolding, includeProvisions, expensePercents, contasEspecificas);
  };

  const handleAliqCOFINSChange = (value) => {
    const val = parseFloat(value) || 0;
    setAliqCOFINS(val);
    saveConfig(rateioConfig, aliqISS, aliqPIS, val, selectedHolding, includeProvisions, expensePercents, contasEspecificas);
  };

  const handleHoldingChange = (value) => {
    setSelectedHolding(value);
    saveConfig(rateioConfig, aliqISS, aliqPIS, aliqCOFINS, value, includeProvisions, expensePercents, contasEspecificas);
    setIsEditingHolding(false);
  };

  const handleAddContaEspecifica = (conta, descricao) => {
    if (!conta) return;
    if (contasEspecificas[conta]) return;
    const initialPercs = {};
    companies.filter(c => c.id !== selectedHolding).forEach(c => {
      initialPercs[c.id] = 0;
    });
    const newSpec = {
      ...contasEspecificas,
      [conta]: {
        descricao: descricao || '',
        percentuais: initialPercs
      }
    };
    setContasEspecificas(newSpec);
    saveConfig(rateioConfig, aliqISS, aliqPIS, aliqCOFINS, selectedHolding, includeProvisions, expensePercents, newSpec);
    setSelectedAddConta('');
    window.$toast(`Conta ${conta} adicionada às regras específicas!`, { type: 'success' });
  };

  const handleRemoveContaEspecifica = (conta) => {
    const newSpec = { ...contasEspecificas };
    delete newSpec[conta];
    setContasEspecificas(newSpec);
    saveConfig(rateioConfig, aliqISS, aliqPIS, aliqCOFINS, selectedHolding, includeProvisions, expensePercents, newSpec);
    window.$toast(`Conta ${conta} removida das regras específicas.`, { type: 'info' });
  };

  const handleSpecAccountPercentChange = (conta, empresaId, value) => {
    const val = parseFloat(value) || 0;
    const current = contasEspecificas[conta] || { percentuais: {} };
    const newSpec = {
      ...contasEspecificas,
      [conta]: {
        ...current,
        percentuais: {
          ...(current.percentuais || {}),
          [empresaId]: val
        }
      }
    };
    setContasEspecificas(newSpec);
    saveConfig(rateioConfig, aliqISS, aliqPIS, aliqCOFINS, selectedHolding, includeProvisions, expensePercents, newSpec);
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

  const operacionais = companies.filter(c => c.id !== selectedHolding);
  const todasDespesas = [...detalhesFolha, ...detalhesOutras];

  // Cálculo das Contas Específicas
  const contasEspecificasAtivas = [];
  let custoEspecificoTotal = 0;

  Object.keys(contasEspecificas).forEach(conta => {
    const item = todasDespesas.find(d => d.conta === conta);
    const valor = item ? item.valor : 0;
    const descricao = item ? item.descricao : (contasEspecificas[conta].descricao || 'Conta Específica');
    const percentuais = contasEspecificas[conta].percentuais || {};
    const somaPerc = Object.values(percentuais).reduce((a, b) => a + (parseFloat(b) || 0), 0);
    
    contasEspecificasAtivas.push({
      conta,
      descricao,
      valor,
      percentuais,
      somaPerc
    });
    custoEspecificoTotal += valor;
  });

  const totalCusto = despesasFolha + outrasDespesas;
  const totalCustoGeral = Math.max(0, totalCusto - custoEspecificoTotal);
  
  const aliquotaTotal = aliqISS + aliqPIS + aliqCOFINS;
  const fatorGrossUp = 1 - (aliquotaTotal / 100);
  
  const totalFaturarGeral = fatorGrossUp > 0 ? totalCustoGeral / fatorGrossUp : 0;
  const totalFaturarEspecifico = fatorGrossUp > 0 ? custoEspecificoTotal / fatorGrossUp : 0;
  const totalFaturar = totalFaturarGeral + totalFaturarEspecifico;
  const impostos = totalFaturar - totalCusto;

  // Distribuição por Empresa
  const totalPercentualGeral = Object.values(rateioConfig).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);

  const distribuicaoPorEmpresa = operacionais.map(c => {
    const percGeral = rateioConfig[c.id] || 0;
    const fatiaGeral = totalFaturarGeral * (percGeral / 100);
    
    let fatiaEspecifica = 0;
    const detalhesEspecificos = [];

    contasEspecificasAtivas.forEach(spec => {
      const p = spec.percentuais[c.id] || 0;
      if (p > 0 && spec.valor > 0) {
        const valFatConta = fatorGrossUp > 0 ? (spec.valor * (p / 100)) / fatorGrossUp : 0;
        fatiaEspecifica += valFatConta;
        detalhesEspecificos.push({
          conta: spec.conta,
          descricao: spec.descricao,
          perc: p,
          valorOriginal: spec.valor * (p / 100),
          valorFaturar: valFatConta
        });
      }
    });

    const totalFaturarEmpresa = fatiaGeral + fatiaEspecifica;
    const percEfetivoTotal = totalFaturar > 0 ? (totalFaturarEmpresa / totalFaturar) * 100 : 0;

    return {
      empresa: c,
      percGeral,
      fatiaGeral,
      fatiaEspecifica,
      detalhesEspecificos,
      totalFaturarEmpresa,
      percEfetivoTotal
    };
  });

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

      window.$toast('Faturamento do Rateio gravado com sucesso!', { type: 'success' });
      
    } catch (e) {
      console.error(e);
      window.$alert('Erro ao gravar faturamento da holding.', { type: 'danger' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      {/* NAVEGAÇÃO DE SUB-ROTINAS DA HOLDING */}
      <div style={{ 
        display: 'flex', 
        gap: '0.8rem', 
        borderBottom: '1px solid rgba(255,255,255,0.1)', 
        paddingBottom: '0.8rem', 
        marginBottom: '1.5rem' 
      }}>
        <button
          onClick={() => setSubTab('mep')}
          style={{
            background: subTab === 'mep' ? '#D4AF37' : 'rgba(255,255,255,0.05)',
            color: subTab === 'mep' ? '#000' : '#aaa',
            border: 'none',
            padding: '0.6rem 1.2rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: subTab === 'mep' ? '0 4px 12px rgba(212,175,55,0.3)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <span>⚖️</span> Equivalência Patrimonial (MEP)
        </button>

        <button
          onClick={() => setSubTab('rateio')}
          style={{
            background: subTab === 'rateio' ? '#2196F3' : 'rgba(255,255,255,0.05)',
            color: subTab === 'rateio' ? '#fff' : '#aaa',
            border: 'none',
            padding: '0.6rem 1.2rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: subTab === 'rateio' ? '0 4px 12px rgba(33,150,243,0.3)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <span>🏢</span> Rateio de Custos & Despesas (Management Fee)
        </button>
      </div>

      {subTab === 'mep' && (
        <EquivalenciaPatrimonialModule companies={companies} />
      )}

      {subTab === 'rateio' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
      
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
                            saveConfig(rateioConfig, aliqISS, aliqPIS, aliqCOFINS, selectedHolding, checked, expensePercents, contasEspecificas);
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
                   <span>Custo Total da Holding:</span>
                   <span>{totalCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>

                {custoEspecificoTotal > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', color: '#FFCA28', fontSize: '0.9rem' }}>
                       <span>(-) Contas em Rateio Específico:</span>
                       <span>- {custoEspecificoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', borderTop: '1px dashed #555', paddingTop: '0.5rem', color: '#64B5F6', fontWeight: 'bold', fontSize: '1rem' }}>
                       <span>(=) Custo Geral a Ratear:</span>
                       <span>{totalCustoGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  </>
                )}
             </div>

             {/* BLOCO: REGRAS ESPECÍFICAS POR CONTA */}
             <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(156, 39, 176, 0.05)', border: '1px solid rgba(156, 39, 176, 0.3)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ color: '#BA68C8', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🎯</span> Rateios Específicos por Conta ({contasEspecificasAtivas.length})
                  </h4>
                </div>
                
                <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 1rem 0' }}>
                  Cadastre contas da Holding que devem ter percentuais de rateio personalizados ou direcionados a empresas específicas.
                </p>

                {/* Adicionar Nova Conta Específica */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
                  <select 
                    value={selectedAddConta} 
                    onChange={e => setSelectedAddConta(e.target.value)} 
                    className="select-input" 
                    style={{ flex: 1, fontSize: '0.85rem' }}
                  >
                    <option value="">Selecione uma conta para personalizar o rateio...</option>
                    {todasDespesas
                      .filter(d => !contasEspecificas[d.conta])
                      .map(d => (
                        <option key={d.conta} value={d.conta}>
                          {d.conta} - {d.descricao} ({d.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                        </option>
                      ))
                    }
                  </select>
                  <button 
                    className="btn-primary" 
                    style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', background: '#9C27B0', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      const item = todasDespesas.find(d => d.conta === selectedAddConta);
                      if (item) {
                        handleAddContaEspecifica(item.conta, item.descricao);
                      }
                    }}
                    disabled={!selectedAddConta}
                  >
                    + Adicionar Regra
                  </button>
                </div>

                {/* Lista de Contas com Rateio Específico */}
                {contasEspecificasAtivas.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1rem', color: '#777', fontSize: '0.85rem', border: '1px dashed #444', borderRadius: '8px' }}>
                    Nenhuma conta com rateio específico cadastrada. Todas as despesas seguem o rateio geral padrão.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {contasEspecificasAtivas.map(spec => {
                      const soma = spec.somaPerc;
                      const isOk = Math.abs(soma - 100) < 0.01;

                      return (
                        <div key={spec.conta} style={{ background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(186, 104, 200, 0.2)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                            <div>
                              <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{spec.conta}</strong>
                              <div style={{ color: '#BA68C8', fontSize: '0.85rem' }}>{spec.descricao}</div>
                              <div style={{ color: '#aaa', fontSize: '0.8rem', marginTop: '2px' }}>
                                Valor no mês: <b style={{ color: '#fff' }}>{spec.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleRemoveContaEspecifica(spec.conta)}
                              style={{ background: 'rgba(244,67,54,0.15)', border: '1px solid #F44336', color: '#FF8A80', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.75rem' }}
                              title="Remover regra e voltar para o rateio geral"
                            >
                              🗑️ Remover
                            </button>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Percentuais por Empresa:</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: isOk ? '#4CAF50' : '#FF9800' }}>
                              {isOk ? '✓ Soma: 100%' : `⚠️ Soma: ${soma.toFixed(2)}% (deve ser 100%)`}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                            {operacionais.map(c => {
                              const pVal = spec.percentuais[c.id] || 0;
                              return (
                                <div key={c.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px', border: '1px solid #333' }}>
                                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#ccc', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.name}>
                                    {c.name}
                                  </label>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <input 
                                      type="number"
                                      step="0.01"
                                      className="text-input"
                                      style={{ padding: '2px 4px', fontSize: '0.8rem', textAlign: 'center', width: '100%' }}
                                      value={pVal}
                                      onChange={e => handleSpecAccountPercentChange(spec.conta, c.id, e.target.value)}
                                    />
                                    <span style={{ fontSize: '0.75rem', color: '#888' }}>%</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                    <span>Custo Líquido da Holding:</span>
                    <span>{totalCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                 </div>
                 {custoEspecificoTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#BA68C8', fontSize: '0.85rem' }}>
                    <span>• Sendo Rateios Específicos:</span>
                    <span>{custoEspecificoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                 )}
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: '#f44336' }}>
                    <span>(+) Impostos Embutidos ({aliquotaTotal.toFixed(2)}%):</span>
                    <span>{impostos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '1rem', fontSize: '1.3rem', fontWeight: 'bold', color: '#4CAF50' }}>
                    <span>Valor Total Faturado:</span>
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
            <h4 style={{ marginBottom: '1rem', color: '#fff' }}>Distribuição Consolidada do Rateio</h4>
            
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: totalPercentualGeral === 100 ? '#4CAF50' : '#f44336' }}>
                Rateio Geral Padrão: <strong>{totalPercentualGeral.toFixed(2)}%</strong>
              </span>
              {totalPercentualGeral !== 100 && (
                <span style={{ fontSize: '0.8rem', color: '#FF9800' }}>⚠️ O rateio geral deve somar exatamente 100%</span>
              )}
            </div>

            <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Empresa Operacional</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>% Geral</th>
                  <th style={{ textAlign: 'right' }}>Fatia Geral</th>
                  <th style={{ textAlign: 'right', color: '#BA68C8' }}>Fatia Específica</th>
                  <th style={{ textAlign: 'right', color: '#81C784' }}>Total a Faturar</th>
                  <th style={{ width: '70px', textAlign: 'right' }}>% Efetivo</th>
                </tr>
              </thead>
              <tbody>
                {distribuicaoPorEmpresa.map(d => {
                  const c = d.empresa;
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                        {d.detalhesEspecificos.length > 0 && (
                          <div style={{ fontSize: '0.75rem', color: '#BA68C8', marginTop: '2px' }}>
                            {d.detalhesEspecificos.map(det => (
                              <div key={det.conta}>
                                • {det.conta}: {det.perc}% ({det.valorFaturar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input 
                          type="number" 
                          className="text-input" 
                          style={{ padding: '0.2rem', width: '65px', textAlign: 'center', fontSize: '0.85rem' }} 
                          value={d.percGeral} 
                          onChange={(e) => handleRateioChange(c.id, e.target.value)}
                          step="0.01"
                        />
                      </td>
                      <td style={{ textAlign: 'right', color: '#ccc' }}>
                        {d.fatiaGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: d.fatiaEspecifica > 0 ? 'bold' : 'normal', color: d.fatiaEspecifica > 0 ? '#BA68C8' : '#777' }}>
                        {d.fatiaEspecifica.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#4CAF50', fontSize: '0.95rem' }}>
                        {d.totalFaturarEmpresa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td style={{ textAlign: 'right', color: '#aaa', fontSize: '0.8rem' }}>
                        {d.percEfetivoTotal.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(255,255,255,0.05)', fontWeight: 'bold', borderTop: '2px solid #555' }}>
                  <td>TOTAL GERAL</td>
                  <td style={{ textAlign: 'center', color: totalPercentualGeral === 100 ? '#4CAF50' : '#f44336' }}>{totalPercentualGeral.toFixed(2)}%</td>
                  <td style={{ textAlign: 'right' }}>{totalFaturarGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td style={{ textAlign: 'right', color: '#BA68C8' }}>{totalFaturarEspecifico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td style={{ textAlign: 'right', color: '#4CAF50' }}>{totalFaturar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td style={{ textAlign: 'right' }}>100.00%</td>
                </tr>
              </tfoot>
            </table>

            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid #333' }}>
              <div style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '0.4rem', fontWeight: 'bold' }}>
                💡 Como funciona o cálculo combinado:
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: '#888', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li><b>Rateio Geral:</b> Aplica o % padrão da empresa sobre o custo líquido das despesas comuns (com gross-up de impostos).</li>
                <li><b>Rateio Específico:</b> Aplica os % individuais configurados para as contas personalizadas diretamente sobre cada empresa.</li>
                <li><b>Total a Faturar:</b> Soma da fatia geral + fatias específicas, garantindo que o faturamento cubra 100% dos custos da Holding com impostos.</li>
              </ul>
            </div>
          </div>

        </div>
      )}
    </div>
      )}
    </div>
  );
}
