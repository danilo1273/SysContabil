import React, { useState, useEffect, useMemo } from 'react';
import { getRawRecords, bulkPutRecords, getSettings, saveSettings } from '../utils/db';
import { applyMapping, protheusMapping } from '../utils/mappingConfig';

export default function TaxModule({ companies }) {
  const [activeTab, setActiveTab] = useState('config'); // 'config', 'apuracao'
  const [taxConfig, setTaxConfig] = useState({});
  const [cambioConfig, setCambioConfig] = useState({});
  const [taxDataStore, setTaxDataStore] = useState({}); // Stores adicoes, exclusoes, retencoes por empresa/mes
  
  const [selectedComp, setSelectedComp] = useState('');
  const [selectedMes, setSelectedMes] = useState(new Date().getMonth() + 1);
  const [selectedAno, setSelectedAno] = useState(new Date().getFullYear());
  const [isProcessing, setIsProcessing] = useState(false);

  // Dados Extraídos
  const [dreMensal, setDreMensal] = useState([]);
  const [dreAcumulada, setDreAcumulada] = useState([]);
  
  // Inputs Manuais LALUR
  const [lalurAdicoes, setLalurAdicoes] = useState(0);
  const [lalurExclusoes, setLalurExclusoes] = useState(0);
  const [lalurCompensacaoPrejuizo, setLalurCompensacaoPrejuizo] = useState(0);
  const [lalurRetencoesIR, setLalurRetencoesIR] = useState(0);
  const [lalurRetencoesCS, setLalurRetencoesCS] = useState(0);
  const [lalurCambioRealizado, setLalurCambioRealizado] = useState(0);

  // Inputs Manuais Presumido
  const [presumidoRetencoesIR, setPresumidoRetencoesIR] = useState(0);
  const [presumidoRetencoesCS, setPresumidoRetencoesCS] = useState(0);
  const [presumidoOutrasReceitas, setPresumidoOutrasReceitas] = useState(0);
  const [presumidoCambioRealizado, setPresumidoCambioRealizado] = useState(0);
  const [presumidoMajoracao, setPresumidoMajoracao] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const config = await getSettings('agf_tax_config');
      if (config) setTaxConfig(config);
      
      const cConfig = await getSettings('agf_cambio_config');
      if (cConfig) setCambioConfig(cConfig);
      
      const store = await getSettings('agf_tax_store');
      if (store) setTaxDataStore(store);
    } catch(e) { console.error(e); }
  };

  const saveConfig = async (compId, regime) => {
    const updated = { ...taxConfig, [compId]: regime };
    setTaxConfig(updated);
    try { await saveSettings('agf_tax_config', updated); } catch(e) {}
  };

  const saveCambioConfig = async (compId, regime) => {
    const updated = { ...cambioConfig, [compId]: regime };
    setCambioConfig(updated);
    try { await saveSettings('agf_cambio_config', updated); } catch(e) {}
  };

  const persistTaxData = async (compId, ano, mes, data) => {
    const key = `${compId}_${ano}_${mes}`;
    const updated = { ...taxDataStore, [key]: data };
    setTaxDataStore(updated);
    try { await saveSettings('agf_tax_store', updated); } catch(e) {}
  };

  const loadTaxData = (compId, ano, mes) => {
    const key = `${compId}_${ano}_${mes}`;
    const data = taxDataStore[key] || {};
    
    setLalurAdicoes(data.lalurAdicoes || 0);
    setLalurExclusoes(data.lalurExclusoes || 0);
    setLalurCompensacaoPrejuizo(data.lalurCompensacaoPrejuizo || 0);
    setLalurRetencoesIR(data.lalurRetencoesIR || 0);
    setLalurRetencoesCS(data.lalurRetencoesCS || 0);
    setLalurCambioRealizado(data.lalurCambioRealizado || 0);
    
    setPresumidoRetencoesIR(data.presumidoRetencoesIR || 0);
    setPresumidoRetencoesCS(data.presumidoRetencoesCS || 0);
    setPresumidoOutrasReceitas(data.presumidoOutrasReceitas || 0);
    setPresumidoCambioRealizado(data.presumidoCambioRealizado || 0);
    setPresumidoMajoracao(data.presumidoMajoracao !== undefined ? data.presumidoMajoracao : true);
  };

  const loadFinancialData = async () => {
    if (!selectedComp) return;
    setIsProcessing(true);
    try {
      // Pega o DRE do mês
      const rawMensal = await getRawRecords(selectedAno, selectedMes);
      setDreMensal(rawMensal.dre.filter(r => r.empresaId === selectedComp));

      // Pega o DRE Acumulado (para Real Anual ou Trimestral)
      let acumulada = [];
      const regime = taxConfig[selectedComp] || '';
      
      let startMonth = 1;
      if (regime === 'real_trimestral' || regime === 'presumido') {
        // Trimestral acumula só no trimestre
        startMonth = Math.floor((selectedMes - 1) / 3) * 3 + 1; 
      }
      
      for (let m = startMonth; m <= selectedMes; m++) {
        const d = await getRawRecords(selectedAno, m);
        const comp = d.dre.filter(r => r.empresaId === selectedComp);
        comp.forEach(r => {
          const ex = acumulada.find(a => a.conta === r.conta);
          if (ex) ex.valorMensal += r.valorMensal;
          else acumulada.push({ ...r });
        });
      }
      setDreAcumulada(acumulada);
      
      loadTaxData(selectedComp, selectedAno, selectedMes);

    } catch (err) {
      console.error(err);
      alert('Erro ao carregar dados do período: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, [selectedComp, selectedMes, selectedAno, taxConfig]);


  // ---- FUNÇÕES DE CÁLCULO ----

  // Lucro Presumido
  const calcPresumido = () => {
    let recRevenda = 0;
    let recServico = 0;
    let variacaoCambial = 0;
    
    // Calcula com base no acumulado do trimestre
    dreAcumulada.forEach(r => {
      if (r.conta.startsWith('3.1.1.1.01.00001') || r.conta.startsWith('3.1.1.1.01.00002')) recRevenda += Math.abs(r.valorMensal || 0);
      if (r.conta.startsWith('3.1.1.1.01.00003') || r.conta.startsWith('3.1.1.1.01.00004')) recServico += Math.abs(r.valorMensal || 0);
      if (r.conta.startsWith('4.3.1.1.03')) variacaoCambial += (r.valorMensal || 0);
    });

    let outrasReceitasAjustadas = parseFloat(presumidoOutrasReceitas || 0);
    
    if (cambioConfig[selectedComp] === 'caixa') {
        // Estorna Variação Competência (se for receita positiva na DRE)
        if (variacaoCambial > 0) {
           outrasReceitasAjustadas -= variacaoCambial;
        }
        // Adiciona Variação Realizada (só ganho é tributável)
        const realizado = parseFloat(presumidoCambioRealizado || 0);
        if (realizado > 0) {
           outrasReceitasAjustadas += realizado;
            }
    }

    let baseIrpj = (recRevenda * 0.08) + (recServico * 0.32);
    let baseCsll = (recRevenda * 0.12) + (recServico * 0.32);

    let acrescimoIrpj = 0;
    let acrescimoCsll = 0;

    const mesesNoPeriodo = (selectedMes % 3 === 0) ? 3 : (selectedMes % 3);
    const limiteMajoracao = (1250000 / 3) * mesesNoPeriodo;

    if (presumidoMajoracao) {
        // A planilha rateia o limite com base na receita total (incluindo financeiras)
        const totalReceitas = recRevenda + recServico + outrasReceitasAjustadas;
        
        const limiteRevenda = totalReceitas > 0 ? limiteMajoracao * (recRevenda / totalReceitas) : 0;
        const limiteServico = totalReceitas > 0 ? limiteMajoracao * (recServico / totalReceitas) : 0;
        
        const excessoRevenda = Math.max(0, recRevenda - limiteRevenda);
        const excessoServico = Math.max(0, recServico - limiteServico);

        // IRPJ: Vale a partir de 2026
        if (selectedAno >= 2026) {
            acrescimoIrpj = (excessoRevenda * 0.08 * 0.10) + (excessoServico * 0.32 * 0.10);
        }
        
        // CSLL: Vale a partir de abr/2026 (ou 2o trimestre de 2026)
        if (selectedAno > 2026 || (selectedAno === 2026 && selectedMes >= 4)) {
            acrescimoCsll = (excessoRevenda * 0.12 * 0.10) + (excessoServico * 0.32 * 0.10);
        }
    }

    baseIrpj = baseIrpj + acrescimoIrpj + outrasReceitasAjustadas;
    baseCsll = baseCsll + acrescimoCsll + outrasReceitasAjustadas;
    const limiteAdicional = 20000 * mesesNoPeriodo;

    const irpjNormal = baseIrpj * 0.15;
    const irpjAdicional = Math.max(0, baseIrpj - limiteAdicional) * 0.10;
    const csll = baseCsll * 0.09;

    const irpjTotal = irpjNormal + irpjAdicional - parseFloat(presumidoRetencoesIR || 0);
    const csllTotal = csll - parseFloat(presumidoRetencoesCS || 0);

    return { recRevenda, recServico, baseIrpj, baseCsll, irpjNormal, irpjAdicional, irpjTotal, csll, csllTotal, variacaoCambial };
  };

  // Lucro Real
  const calcReal = () => {
    let lair = 0;
    let variacaoCambial = 0;
    let equivalenciaPatrimonial = 0;
    dreAcumulada.forEach(r => {
      // Ignorar provisões 6 e 7
      if (!r.conta.startsWith('6') && !r.conta.startsWith('7')) {
        lair += (r.valorMensal || 0);
      }
      if (r.conta.startsWith('4.3.1.1.03')) {
        variacaoCambial += (r.valorMensal || 0);
      }
      if (r.conta.startsWith('4.4')) {
        equivalenciaPatrimonial += (r.valorMensal || 0);
      }
    });

    let adicoesAuto = 0;
    let exclusoesAuto = 0;
    let cambioAdicao = 0;
    let cambioExclusao = 0;
    
    // Estorno Equivalência Patrimonial (Conta 4.4) - Não tributável
    if (equivalenciaPatrimonial > 0) {
        exclusoesAuto += equivalenciaPatrimonial; // Receita de equivalência não entra na base
    } else if (equivalenciaPatrimonial < 0) {
        adicoesAuto += Math.abs(equivalenciaPatrimonial); // Despesa de equivalência é indedutível
    }

    if (cambioConfig[selectedComp] === 'caixa') {
        // Estorna Variação Competência
        if (variacaoCambial > 0) {
           exclusoesAuto += variacaoCambial; // Neutraliza ganho
        } else if (variacaoCambial < 0) {
           adicoesAuto += Math.abs(variacaoCambial); // Neutraliza perda
        }

        // Lança Variação Realizada
        const realizado = parseFloat(lalurCambioRealizado || 0);
        if (realizado > 0) {
            cambioAdicao = realizado;
        } else if (realizado < 0) {
            cambioExclusao = Math.abs(realizado);
        }
    }

    const adicoes = parseFloat(lalurAdicoes || 0) + adicoesAuto + cambioAdicao;
    const exclusoes = parseFloat(lalurExclusoes || 0) + exclusoesAuto + cambioExclusao;
    const baseCalculo = lair + adicoes - exclusoes;

    // Compensação de prejuízo travada em 30% da base positiva
    let compensacaoMax = baseCalculo > 0 ? baseCalculo * 0.30 : 0;
    let compensacao = Math.min(parseFloat(lalurCompensacaoPrejuizo || 0), compensacaoMax);
    
    const baseAjustada = baseCalculo - compensacao;

    const regime = taxConfig[selectedComp] || '';
    let mesesAcumulados = 1;
    if (regime === 'real_trimestral') {
       mesesAcumulados = (selectedMes % 3 === 0) ? 3 : (selectedMes % 3);
    } else if (regime === 'real_anual') {
       mesesAcumulados = selectedMes;
    }
    
    const limiteAdicional = 20000 * mesesAcumulados;

    let irpjNormal = 0;
    let irpjAdicional = 0;
    let csll = 0;

    if (baseAjustada > 0) {
      irpjNormal = baseAjustada * 0.15;
      irpjAdicional = Math.max(0, baseAjustada - limiteAdicional) * 0.10;
      csll = baseAjustada * 0.09;
    }

    const irpjTotal = irpjNormal + irpjAdicional - parseFloat(lalurRetencoesIR || 0);
    const csllTotal = csll - parseFloat(lalurRetencoesCS || 0);

    return { lair, baseCalculo, compensacao, baseAjustada, irpjNormal, irpjAdicional, irpjTotal, csll, csllTotal, variacaoCambial, equivalenciaPatrimonial, adicoesAuto, exclusoesAuto, adicoes, exclusoes };
  };


  const handleGravar = async (vIrpj, vCsll) => {
    if (!selectedComp) { alert('Selecione uma empresa.'); return; }
    
    setIsProcessing(true);
    try {
      // Salva os inputs no state/db
      await persistTaxData(selectedComp, selectedAno, selectedMes, {
        lalurAdicoes, lalurExclusoes, lalurCompensacaoPrejuizo, lalurRetencoesIR, lalurRetencoesCS, lalurCambioRealizado,
        presumidoRetencoesIR, presumidoRetencoesCS, presumidoOutrasReceitas, presumidoCambioRealizado, presumidoMajoracao
      });

      const regime = taxConfig[selectedComp];
      
      let despesaDreIRAnterior = 0;
      let despesaDreCSAnterior = 0;
      
      let startMonth = 1;
      if (regime === 'real_trimestral' || regime === 'presumido') {
          startMonth = Math.floor((selectedMes - 1) / 3) * 3 + 1;
      }

      if (selectedMes > startMonth) {
          // Soma despesas na DRE (ignorando os lançamentos deste mesmo mês que vamos recriar)
          const idIrpjDreThisMonth = 'tax-dre-irpj-' + selectedComp + '-' + selectedAno + '-' + selectedMes;
          const idCsllDreThisMonth = 'tax-dre-csll-' + selectedComp + '-' + selectedAno + '-' + selectedMes;
          
          const isDespesaIR = (r) => (r.conta === '7' || (r.descricao && r.descricao.toUpperCase().includes('IRPJ'))) && r.id !== idIrpjDreThisMonth && r.mes >= startMonth && r.mes < selectedMes;
          const isDespesaCS = (r) => (r.conta === '6' || (r.descricao && r.descricao.toUpperCase().includes('CSLL'))) && r.id !== idCsllDreThisMonth && r.mes >= startMonth && r.mes < selectedMes;
          
          despesaDreIRAnterior = dreAcumulada.filter(isDespesaIR).reduce((acc, r) => acc + Math.abs(r.valorMensal || 0), 0);
          despesaDreCSAnterior = dreAcumulada.filter(isDespesaCS).reduce((acc, r) => acc + Math.abs(r.valorMensal || 0), 0);
      }

      const valorIrpjDreMes = Math.max(0, vIrpj - despesaDreIRAnterior);
      const valorCsllDreMes = Math.max(0, vCsll - despesaDreCSAnterior);

      // Buscar Passivo atual
      const currBal = await getRawRecords(selectedAno, selectedMes);
      const currComp = currBal.balanco.filter(r => r.empresaId === selectedComp);

      const idIrpjBal = 'tax-bal-irpj-' + selectedComp + '-' + selectedAno + '-' + selectedMes;
      const idCsllBal = 'tax-bal-csll-' + selectedComp + '-' + selectedAno + '-' + selectedMes;

      const ajusteBalancoIrpj = valorIrpjDreMes;
      const ajusteBalancoCsll = valorCsllDreMes;

      const idIrpjDre = 'tax-dre-irpj-' + selectedComp + '-' + selectedAno + '-' + selectedMes;
      const idCsllDre = 'tax-dre-csll-' + selectedComp + '-' + selectedAno + '-' + selectedMes;

      const dreEntries = [
        { id: idIrpjDre, empresaId: selectedComp, ano: selectedAno, mes: selectedMes, trimestre: Math.ceil(selectedMes/3), conta: '7', descricao: 'PROVISÃO IRPJ', valorMensal: -valorIrpjDreMes },
        { id: idCsllDre, empresaId: selectedComp, ano: selectedAno, mes: selectedMes, trimestre: Math.ceil(selectedMes/3), conta: '6', descricao: 'PROVISÃO CSLL', valorMensal: -valorCsllDreMes }
      ];

      const balancoEntries = [
        { id: idIrpjBal, empresaId: selectedComp, ano: selectedAno, mes: selectedMes, trimestre: Math.ceil(selectedMes/3), tipo: 'passivo', conta: '2.1.1.6.01.00001', descricao: 'IRPJ A RECOLHER', saldoAcumulado: ajusteBalancoIrpj },
        { id: idCsllBal, empresaId: selectedComp, ano: selectedAno, mes: selectedMes, trimestre: Math.ceil(selectedMes/3), tipo: 'passivo', conta: '2.1.1.6.02.00001', descricao: 'CSLL A RECOLHER', saldoAcumulado: ajusteBalancoCsll }
      ];

      await bulkPutRecords('dre_history', dreEntries);
      await bulkPutRecords('balanco_history', balancoEntries);
      alert('Apuração gravada com sucesso! O Balanço e a DRE já foram atualizados.');
    } catch (err) {
      alert('Erro ao gravar: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };


  const renderPresumido = () => {
    const calc = calcPresumido();
    return (
      <div style={{ marginTop: '1.5rem' }}>
        <h3 style={{ color: '#2196F3', marginBottom: '1rem' }}>Cálculo do Lucro Presumido (Trimestre Atual)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(33, 150, 243, 0.05)' }}>
             <h4 style={{ color: '#ccc', marginBottom: '1rem' }}>1. Receitas e Base</h4>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Receita Venda/Revenda (8% / 12%):</span>
                <strong>{calc.recRevenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span>Receita Serviço (32%):</span>
                <strong>{calc.recServico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
             </div>

             <div style={{ marginBottom: '1rem' }}>
               <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(+) Outras Receitas (Financ, Ganho Cap, etc - 100%)</label>
               <input type="number" className="text-input" value={presumidoOutrasReceitas} onChange={e => setPresumidoOutrasReceitas(e.target.value)} style={{ width: '100%' }} />
             </div>

             {cambioConfig[selectedComp] === 'caixa' && (
               <>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#888', fontSize: '0.9rem' }}>
                    <span>(-) Variação Cambial DRE (Estorno Auto):</span>
                    <span>{calc.variacaoCambial > 0 ? (calc.variacaoCambial * -1).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}</span>
                 </div>
                 <div style={{ marginBottom: '1rem' }}>
                   <label style={{ display: 'block', fontSize: '0.85rem', color: '#FFCA28', marginBottom: '0.3rem' }}>(+) Variação Cambial Realizada (Regime de Caixa)</label>
                   <input type="number" className="text-input" value={presumidoCambioRealizado} onChange={e => setPresumidoCambioRealizado(e.target.value)} style={{ width: '100%', borderColor: '#FFCA28' }} />
                 </div>
               </>
             )}

             <div style={{ marginTop: '1.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center' }}>
                <input type="checkbox" id="presumidoMajoracao" checked={presumidoMajoracao} onChange={e => setPresumidoMajoracao(e.target.checked)} style={{ marginRight: '0.5rem', transform: 'scale(1.2)' }} />
                <label htmlFor="presumidoMajoracao" style={{ color: '#ddd', fontSize: '0.9rem', cursor: 'pointer' }}>Aplicar majoração de 10% sobre a presunção (Lei 2026)</label>
             </div>

             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '1rem', color: '#FF9800' }}>
                <span>Base IRPJ:</span>
                <strong>{calc.baseIrpj.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', color: '#FF9800' }}>
                <span>Base CSLL:</span>
                <strong>{calc.baseCsll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
             </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(76, 175, 80, 0.05)' }}>
             <h4 style={{ color: '#ccc', marginBottom: '1rem' }}>2. Apuração dos Impostos</h4>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>IRPJ Normal (15%):</span>
                <span>{calc.irpjNormal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>IRPJ Adicional (10% sobre o que exceder R$ {((selectedMes%3===0?3:selectedMes%3)*20000).toLocaleString('pt-BR')}):</span>
                <span>{calc.irpjAdicional.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
             </div>
             <div style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
               <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(-) Imposto de Renda Retido (IRRF)</label>
               <input type="number" className="text-input" value={presumidoRetencoesIR} onChange={e => setPresumidoRetencoesIR(e.target.value)} style={{ width: '100%' }} />
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '1rem', color: '#4CAF50', fontSize: '1.1rem', fontWeight: 'bold' }}>
                <span>IRPJ Devido:</span>
                <span>{Math.max(0, calc.irpjTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
             </div>

             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', marginTop: '1.5rem' }}>
                <span>CSLL Normal (9%):</span>
                <span>{calc.csll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
             </div>
             <div style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
               <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(-) CSLL Retida</label>
               <input type="number" className="text-input" value={presumidoRetencoesCS} onChange={e => setPresumidoRetencoesCS(e.target.value)} style={{ width: '100%' }} />
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '1rem', color: '#4CAF50', fontSize: '1.1rem', fontWeight: 'bold' }}>
                <span>CSLL Devida:</span>
                <span>{Math.max(0, calc.csllTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
             </div>
          </div>
          
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'right' }}>
            <button className="btn-primary" onClick={() => handleGravar(calc.irpjTotal, calc.csllTotal)} style={{ padding: '1rem 2rem', fontSize: '1.1rem' }} disabled={isProcessing}>
                {isProcessing ? 'Gravando...' : '💾 Lançar Apuração no DRE e Balanço'}
            </button>
        </div>
      </div>
    );
  };


  const renderReal = () => {
    const calc = calcReal();
    const regime = taxConfig[selectedComp];
    const isAnual = regime === 'real_anual';
    
    return (
      <div style={{ marginTop: '1.5rem' }}>
        <h3 style={{ color: '#FF9800', marginBottom: '1rem' }}>Cálculo do Lucro Real ({isAnual ? 'Estimativa Mensal Acumulada' : 'Trimestral'})</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(255, 152, 0, 0.05)' }}>
             <h4 style={{ color: '#ccc', marginBottom: '1rem' }}>1. e-LALUR / Base de Cálculo</h4>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '1.1rem' }}>
                <span>Lucro Antes do IR (LAIR da DRE):</span>
                <strong style={{ color: calc.lair >= 0 ? '#4CAF50' : '#f44336' }}>{calc.lair.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
             </div>

             <div style={{ marginBottom: '1rem' }}>
               <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(+) Adições (Ex: Multas, Brindes, Desp. Indedutíveis)</label>
               <input type="number" className="text-input" value={lalurAdicoes} onChange={e => setLalurAdicoes(e.target.value)} style={{ width: '100%' }} />
             </div>

             <div style={{ marginBottom: '1rem' }}>
               <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(-) Exclusões (Ex: Div. Isentos, Provisões Revertidas)</label>
               <input type="number" className="text-input" value={lalurExclusoes} onChange={e => setLalurExclusoes(e.target.value)} style={{ width: '100%' }} />
             </div>

             {calc.equivalenciaPatrimonial !== 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.9rem', color: '#888' }}>
                   <span>Estorno Equivalência Patrimonial (Auto):</span>
                   <span>{calc.equivalenciaPatrimonial > 0 ? '(-) ' : '(+) '}{Math.abs(calc.equivalenciaPatrimonial).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
             )}

             {cambioConfig[selectedComp] === 'caixa' && (
               <div style={{ background: 'rgba(255,202,40,0.1)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #FFCA28' }}>
                 <h5 style={{ color: '#FFCA28', marginBottom: '0.5rem', marginTop: 0 }}>Ajustes de Variação Cambial (Caixa)</h5>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#ccc', marginBottom: '0.5rem' }}>
                    <span>Estorno Automático DRE (Adição):</span>
                    <span>{(calc.variacaoCambial < 0 ? Math.abs(calc.variacaoCambial) : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#ccc', marginBottom: '1rem' }}>
                    <span>Estorno Automático DRE (Exclusão):</span>
                    <span>{(calc.variacaoCambial > 0 ? calc.variacaoCambial : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                 </div>
                 
                 <label style={{ display: 'block', fontSize: '0.85rem', color: '#fff', marginBottom: '0.3rem' }}>Variação Realizada Liquida (+ Ganho / - Perda)</label>
                 <input type="number" className="text-input" value={lalurCambioRealizado} onChange={e => setLalurCambioRealizado(e.target.value)} style={{ width: '100%', borderColor: '#FFCA28' }} />
               </div>
             )}
             
             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '1rem' }}>
                <span>Base de Cálculo (Antes Prejuízo):</span>
                <strong style={{ color: calc.baseCalculo >= 0 ? '#4CAF50' : '#f44336' }}>{calc.baseCalculo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
             </div>

             <div style={{ marginBottom: '1rem', marginTop: '1.5rem' }}>
               <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(-) Compensação Prejuízo (Lim. 30%: {Math.max(0, calc.baseCalculo*0.3).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</label>
               <input type="number" className="text-input" value={lalurCompensacaoPrejuizo} onChange={e => setLalurCompensacaoPrejuizo(e.target.value)} style={{ width: '100%' }} />
             </div>

             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '1rem', color: '#FF9800', fontSize: '1.1rem' }}>
                <span>Base Ajustada IRPJ / CSLL:</span>
                <strong>{calc.baseAjustada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
             </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(76, 175, 80, 0.05)' }}>
             <h4 style={{ color: '#ccc', marginBottom: '1rem' }}>2. Apuração dos Impostos</h4>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>IRPJ Normal (15%):</span>
                <span>{calc.irpjNormal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>IRPJ Adicional (10% s/ excesso):</span>
                <span>{calc.irpjAdicional.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
             </div>
             <div style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
               <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(-) Imposto de Renda Retido (IRRF)</label>
               <input type="number" className="text-input" value={lalurRetencoesIR} onChange={e => setLalurRetencoesIR(e.target.value)} style={{ width: '100%' }} />
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '1rem', color: '#4CAF50', fontSize: '1.1rem', fontWeight: 'bold' }}>
                <span>IRPJ Devido {isAnual ? 'no Acumulado' : 'no Trimestre'}:</span>
                <span>{Math.max(0, calc.irpjTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
             </div>

             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', marginTop: '1.5rem' }}>
                <span>CSLL Normal (9%):</span>
                <span>{calc.csll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
             </div>
             <div style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
               <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(-) CSLL Retida</label>
               <input type="number" className="text-input" value={lalurRetencoesCS} onChange={e => setLalurRetencoesCS(e.target.value)} style={{ width: '100%' }} />
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '1rem', color: '#4CAF50', fontSize: '1.1rem', fontWeight: 'bold' }}>
                <span>CSLL Devida {isAnual ? 'no Acumulado' : 'no Trimestre'}:</span>
                <span>{Math.max(0, calc.csllTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
             </div>
          </div>
          
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'right' }}>
            <button className="btn-primary" onClick={() => handleGravar(calc.irpjTotal, calc.csllTotal)} style={{ padding: '1rem 2rem', fontSize: '1.1rem' }} disabled={isProcessing}>
                {isProcessing ? 'Gravando...' : '💾 Lançar Apuração no DRE e Balanço'}
            </button>
            {isAnual && (
                <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  Nota: O sistema deduzirá automaticamente o valor já provisionado nos meses anteriores no DRE, lançando apenas a variação no mês selecionado.
                </p>
            )}
        </div>
      </div>
    );
  };


  return (
    <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '1rem' }}>
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #333', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <button className={activeTab === 'config' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('config')}>1. Configurações de Regime</button>
        <button className={activeTab === 'apuracao' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('apuracao')}>2. Painel de Apuração</button>
      </div>

      {activeTab === 'config' && (
        <div>
          <h3 style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>Regime Tributário por Empresa</h3>
          <p style={{ color: '#ccc', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Defina o regime tributário de cada empresa para que o sistema carregue as regras corretas de cálculo.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Regime Atual</th>
                <th>Variação Cambial</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>
                    <select 
                      value={taxConfig[c.id] || ''} 
                      onChange={(e) => saveConfig(c.id, e.target.value)}
                      className="select-input"
                    >
                      <option value="">Não Definido</option>
                      <option value="real_anual">Lucro Real Estimativa Mensal / Anual</option>
                      <option value="real_trimestral">Lucro Real Trimestral</option>
                      <option value="presumido">Lucro Presumido Trimestral</option>
                    </select>
                  </td>
                  <td>
                    <select 
                      value={cambioConfig[c.id] || 'competencia'} 
                      onChange={(e) => saveCambioConfig(c.id, e.target.value)}
                      className="select-input"
                    >
                      <option value="competencia">Regime de Competência</option>
                      <option value="caixa">Regime de Caixa</option>
                    </select>
                  </td>
                  <td style={{ color: taxConfig[c.id] ? '#4CAF50' : '#888' }}>
                    {taxConfig[c.id] ? '✓ Configurado' : 'Pendente'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'apuracao' && (
        <div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
             <select value={selectedComp} onChange={e => setSelectedComp(e.target.value)} className="select-input">
                <option value="">Selecione a Empresa...</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
             </select>
             <select value={selectedMes} onChange={(e) => setSelectedMes(parseInt(e.target.value))} className="select-input" style={{ width: '130px' }}>
                <option value={1}>Janeiro</option><option value={2}>Fevereiro</option><option value={3}>Março</option>
                <option value={4}>Abril</option><option value={5}>Maio</option><option value={6}>Junho</option>
                <option value={7}>Julho</option><option value={8}>Agosto</option><option value={9}>Setembro</option>
                <option value={10}>Outubro</option><option value={11}>Novembro</option><option value={12}>Dezembro</option>
              </select>
              <select value={selectedAno} onChange={(e) => setSelectedAno(parseInt(e.target.value))} className="select-input" style={{ width: '90px' }}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              {isProcessing && <span style={{ padding: '0.5rem', color: 'var(--color-primary)' }}>Processando...</span>}
          </div>

          {selectedComp && (
             <div>
                {taxConfig[selectedComp] === 'presumido' ? renderPresumido() : 
                 (taxConfig[selectedComp] === 'real_anual' || taxConfig[selectedComp] === 'real_trimestral') ? renderReal() :
                 <div style={{ padding: '2rem', textAlign: 'center', color: '#FF9800', background: 'rgba(255,152,0,0.1)', borderRadius: '10px' }}>
                    Por favor, vá para a aba "Configurações de Regime" e defina o regime tributário para esta empresa antes de apurar.
                 </div>
                }
             </div>
          )}
        </div>
      )}
    </div>
  );
}