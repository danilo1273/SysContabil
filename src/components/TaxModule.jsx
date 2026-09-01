import React, { useState, useEffect, useMemo } from 'react';
import { getRawRecords, bulkPutRecords, getSettings, saveSettings } from '../utils/db';
import { applyMapping, protheusMapping } from '../utils/mappingConfig';
import { supabase } from '../supabaseClient';

export default function TaxModule({ companies }) {
  const [activeTab, setActiveTab] = useState('apuracao'); // 'config', 'apuracao'
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
  const [dreAnualTotal, setDreAnualTotal] = useState([]);
  const [balancoAnualTotal, setBalancoAnualTotal] = useState([]);
  
  // Inputs Manuais LALUR
  const [lalurAdicoes, setLalurAdicoes] = useState(0);
  const [lalurExclusoes, setLalurExclusoes] = useState(0);
  const [lalurCompensacaoPrejuizo, setLalurCompensacaoPrejuizo] = useState(0);
  const [lalurRetencoesIR, setLalurRetencoesIR] = useState(0);
  const [lalurRetencoesCS, setLalurRetencoesCS] = useState(0);
  const [lalurRetencoesIR_AppFin, setLalurRetencoesIR_AppFin] = useState(0);
  const [lalurCambioRealizado, setLalurCambioRealizado] = useState(0);

  // Inputs Manuais Presumido
  const [presumidoRetencoesIR, setPresumidoRetencoesIR] = useState(0);
  const [presumidoRetencoesCS, setPresumidoRetencoesCS] = useState(0);
  const [presumidoRetencoesIR_AppFin, setPresumidoRetencoesIR_AppFin] = useState(0);
  
  const [presumidoOutrasReceitas, setPresumidoOutrasReceitas] = useState('');
  const [presumidoImpostosDevolucao, setPresumidoImpostosDevolucao] = useState('');
  const [presumidoCambioRealizado, setPresumidoCambioRealizado] = useState('');
  const [presumidoIpi, setPresumidoIpi] = useState('');
  const [presumidoIcmsSt, setPresumidoIcmsSt] = useState('');
  const [presumidoMajoracao, setPresumidoMajoracao] = useState(true);
  const [darfIrpjReduzido, setDarfIrpjReduzido] = useState('');
  const [darfCsllReduzida, setDarfCsllReduzida] = useState('');

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
        setLalurRetencoesIR_AppFin(data.lalurRetencoesIR_AppFin || 0);
    setLalurRetencoesCS(data.lalurRetencoesCS || 0);
    setLalurCambioRealizado(data.lalurCambioRealizado || 0);
    
    setPresumidoRetencoesIR(data.presumidoRetencoesIR || 0);
        setPresumidoRetencoesIR_AppFin(data.presumidoRetencoesIR_AppFin || 0);
    setPresumidoRetencoesCS(data.presumidoRetencoesCS || 0); setPresumidoImpostosDevolucao(data.presumidoImpostosDevolucao || 0);
    setPresumidoOutrasReceitas(data.presumidoOutrasReceitas || 0);
    setPresumidoCambioRealizado(data.presumidoCambioRealizado || 0);
    setPresumidoIpi(data.presumidoIpi || 0);
    setPresumidoIcmsSt(data.presumidoIcmsSt || 0);
    setPresumidoMajoracao(data.presumidoMajoracao !== undefined ? data.presumidoMajoracao : true);
    setDarfIrpjReduzido(data.darfIrpjReduzido !== undefined ? data.darfIrpjReduzido : '');
    setDarfCsllReduzida(data.darfCsllReduzida !== undefined ? data.darfCsllReduzida : '');
  };

  const loadFinancialData = async () => {
    if (!selectedComp) return;
    setIsProcessing(true);
    try {
      let anual = [];
      for (let m = 1; m <= 12; m++) {
        const d = await getRawRecords(selectedAno, m);
        const comp = d.dre.filter(r => r.empresaId === selectedComp);
        comp.forEach(r => anual.push({ ...r, mes: m }));
      }
      setDreAnualTotal(anual);

      setDreMensal(anual.filter(r => r.mes === selectedMes));

      const regime = taxConfig[selectedComp] || '';
      let startMonth = 1;
      if (regime === 'real_trimestral' || regime === 'presumido') {
        startMonth = Math.floor((selectedMes - 1) / 3) * 3 + 1;
      }
      setDreAcumulada(anual.filter(r => r.mes >= startMonth && r.mes <= selectedMes));

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

  // Lucro Presumido Genérico (pode ser mensal, acumulado ou trimestral)
  const calcPresumidoData = (records, numMeses, inputs) => {
    let recRevenda = 0;
    let recServico = 0;
    let variacaoCambial = 0;
    let ipi = 0;
    let icmsSt = 0;
    let devolucoes = 0;
    let ipiDevolucao = 0;
    let icmsStDevolucao = 0;
    
    let outrasReceitasDre = 0;
    let outrasReceitasDreBreakdown = [];
    let ganhoCapitalNet = 0;
    let ganhoCapitalBreakdown = [];
    let recRevendaBreakdown = [];
    let recServicoBreakdown = [];
    let devolucoesBreakdown = [];
    let ipiIcmsDevolucaoBreakdown = [];
    let ipiVendasBreakdown = [];
    let icmsStVendasBreakdown = [];
    
    // Calcula com base nos registros fornecidos
    records.forEach(r => {
      if (r.conta.startsWith('3.1.1.1.01.00001') || r.conta.startsWith('3.1.1.1.01.00002') || r.conta.startsWith('3.1.1.1.01.00006')) {
          recRevenda += Math.abs(r.valorMensal || 0);
          if (r.valorMensal !== 0) recRevendaBreakdown.push(`${r.conta} (${r.descricao}): R$ ${Math.abs(r.valorMensal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
      }
      if (r.conta.startsWith('3.1.1.1.01.00003') || r.conta.startsWith('3.1.1.1.01.00004')) {
        recServico += Math.abs(r.valorMensal || 0);
        if (r.valorMensal !== 0) recServicoBreakdown.push(`${r.conta} (${r.descricao}): R$ ${Math.abs(r.valorMensal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
      }
      if (r.conta.startsWith('4.3.1.1.03')) variacaoCambial += (r.valorMensal || 0);
      
      if (r.conta.startsWith('3.1.1.2.01.00006')) {
        ipi += Math.abs(r.valorMensal || 0);
        if (r.valorMensal !== 0) ipiVendasBreakdown.push(`${r.conta} (${r.descricao}): R$ ${Math.abs(r.valorMensal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
      }
      if (r.conta.startsWith('3.1.1.2.01.00007')) {
        icmsSt += Math.abs(r.valorMensal || 0);
        if (r.valorMensal !== 0) icmsStVendasBreakdown.push(`${r.conta} (${r.descricao}): R$ ${Math.abs(r.valorMensal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
      }
      
      if (r.conta.startsWith('3.1.1.2.02.00001')) {
        devolucoes += Math.abs(r.valorMensal || 0);
        if (r.valorMensal !== 0) devolucoesBreakdown.push(`${r.conta} (${r.descricao}): R$ ${Math.abs(r.valorMensal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
      }
      if (r.conta.startsWith('3.1.1.2.02.00002')) {
        ipiDevolucao += Math.abs(r.valorMensal || 0);
        if (r.valorMensal !== 0) ipiIcmsDevolucaoBreakdown.push(`${r.conta} (${r.descricao}): R$ ${Math.abs(r.valorMensal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
      }
      if (r.conta.startsWith('3.1.1.2.02.00004')) {
        icmsStDevolucao += Math.abs(r.valorMensal || 0);
        if (r.valorMensal !== 0) ipiIcmsDevolucaoBreakdown.push(`${r.conta} (${r.descricao}): R$ ${Math.abs(r.valorMensal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
      }
       if (r.conta.startsWith('4.9.1.1')) {
        ganhoCapitalNet += (r.valorMensal || 0);
        if (r.valorMensal !== 0) {
          ganhoCapitalBreakdown.push(`${r.conta} (${r.descricao}): R$ ${(r.valorMensal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        }
      } else if (r.conta.startsWith('4.9.1.2') || r.conta.startsWith('4.3.1.1.01')) {
        if ((r.valorMensal || 0) > 0) { 
           outrasReceitasDre += (r.valorMensal || 0);
           outrasReceitasDreBreakdown.push(`${r.conta} (${r.descricao}): R$ ${(r.valorMensal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        }
      }
    });
    if (ganhoCapitalNet > 0) {
      outrasReceitasDre += ganhoCapitalNet;
      outrasReceitasDreBreakdown = outrasReceitasDreBreakdown.concat(ganhoCapitalBreakdown);
    }

    let outrasReceitasAjustadas = parseFloat(inputs.outrasReceitas || 0) + Math.max(0, outrasReceitasDre);
    
    if (cambioConfig[selectedComp] === 'caixa') {
      const realizado = parseFloat(inputs.cambioRealizado || 0);
      if (realizado > 0) {
        outrasReceitasAjustadas += realizado;
      }
    } else {
      if (variacaoCambial > 0) {
        outrasReceitasAjustadas += variacaoCambial;
      }
    }

    // IPI e ICMS calculados automaticamente do DRE
    // const icmsSt = ...
    const impostosDevolucao = parseFloat(inputs.impostosDevolucao || 0) + ipiDevolucao + icmsStDevolucao;
    const recRevendaLiquida = Math.max(0, recRevenda - devolucoes + impostosDevolucao - ipi - icmsSt);

    let baseIrpj = (recRevendaLiquida * 0.08) + (recServico * 0.32);
    let baseCsll = (recRevendaLiquida * 0.12) + (recServico * 0.32);

    let acrescimoIrpj = 0;
    let acrescimoCsll = 0;

    const mesesNoPeriodo = numMeses;
    const limiteMajoracao = (1250000 / 3) * mesesNoPeriodo;

    if (inputs.majoracao) {
        // A planilha rateia o limite com base na receita total (incluindo financeiras)
        // A planilha rateia o limite com base na receita operacional apenas (sem financeiras)
        const totalReceitas = recRevenda + recServico;
        
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

    const irpjTotal = irpjNormal + irpjAdicional - parseFloat(inputs.retencoesIR || 0);
    const csllTotal = csll - parseFloat(inputs.retencoesCS || 0);

    return { recRevenda, recRevendaLiquida, devolucoes, impostosDevolucaoAuto: ipiDevolucao + icmsStDevolucao, ipi, icmsSt, recServico, baseIrpj, baseCsll, irpjNormal, irpjAdicional, irpjTotal, csll, csllTotal, variacaoCambial, outrasReceitasDre: Math.max(0, outrasReceitasDre), outrasReceitasDreBreakdown, devolucoesBreakdown, ipiIcmsDevolucaoBreakdown, ipiVendasBreakdown, icmsStVendasBreakdown, recRevendaBreakdown, recServicoBreakdown };
  };

  const calcPresumido = () => {
    const isEstimativa = taxConfig[selectedComp] === 'real_anual';
    const currentInputs = {
      outrasReceitas: presumidoOutrasReceitas,
      cambioRealizado: presumidoCambioRealizado,
      retencoesIR: parseFloat(presumidoRetencoesIR || 0) + parseFloat(presumidoRetencoesIR_AppFin || 0),
      retencoesCS: presumidoRetencoesCS,
      impostosDevolucao: presumidoImpostosDevolucao,
      majoracao: !isEstimativa && presumidoMajoracao
    };

    if (isEstimativa) {
      // Get accumulated inputs from DB state
      let sumOutras = 0; let sumCambio = 0; let sumRetIR = 0; let sumRetCS = 0; let sumImpDev = 0; let sumIrpjPago = 0; let sumCsllPago = 0;
        for (let m = 1; m <= selectedMes; m++) {
          if (!dreAnualTotal.some(r => r.mes === m)) continue;
          if (m === selectedMes) {
            sumOutras += parseFloat(presumidoOutrasReceitas || 0);
            sumCambio += parseFloat(presumidoCambioRealizado || 0);
            sumRetIR += parseFloat(presumidoRetencoesIR || 0) + parseFloat(presumidoRetencoesIR_AppFin || 0);
            sumRetCS += parseFloat(presumidoRetencoesCS || 0); sumImpDev += parseFloat(presumidoImpostosDevolucao || 0); sumIrpjPago += parseFloat(darfIrpjReduzido || 0); sumCsllPago += parseFloat(darfCsllReduzida || 0);
         } else {
            const key = `${selectedComp}_${selectedAno}_${m}`;
            const data = taxDataStore[key] || {};
            sumOutras += parseFloat(data.presumidoOutrasReceitas || 0);
            sumCambio += parseFloat(data.presumidoCambioRealizado || 0);
            sumRetIR += parseFloat(data.presumidoRetencoesIR || 0) + parseFloat(data.presumidoRetencoesIR_AppFin || 0);
            sumRetCS += parseFloat(data.presumidoRetencoesCS || 0); sumImpDev += parseFloat(data.presumidoImpostosDevolucao || 0); sumIrpjPago += parseFloat(data.darfIrpjReduzido || 0); sumCsllPago += parseFloat(data.darfCsllReduzida || 0);
         }
      }
      const acumuladoInputs = {
        outrasReceitas: sumOutras, cambioRealizado: sumCambio, retencoesIR: sumRetIR, retencoesCS: sumRetCS, impostosDevolucao: sumImpDev, majoracao: !isEstimativa && presumidoMajoracao
      };

      const mensal = calcPresumidoData(dreAcumulada.filter(r => r.mes === selectedMes), 1, currentInputs);
      const acumulado = calcPresumidoData(dreAcumulada, selectedMes, acumuladoInputs);
      acumulado.irpjTotalPago = sumIrpjPago;
      acumulado.csllTotalPago = sumCsllPago;
      return { mensal, acumulado };
    } else {
      const mensal = calcPresumidoData(dreAcumulada.filter(r => r.mes === selectedMes), 1, currentInputs);
      const trimestral = calcPresumidoData(dreAcumulada, (selectedMes % 3 === 0) ? 3 : (selectedMes % 3), currentInputs);
      return { mensal: mensal, acumulado: trimestral };
    }
  };

  // Lucro Real
  const calcReal = () => {
    let lair = 0;
    let variacaoCambial = 0;
    let equivalenciaPatrimonial = 0;
    dreMensal.forEach(r => {
      // Ignorar provisões 6 e 7
      if (!r.conta.startsWith('6') && !r.conta.startsWith('7') && !r.conta.startsWith('5.1.1.1.01')) {
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

    const irpjTotal = irpjNormal + irpjAdicional - parseFloat(lalurRetencoesIR || 0) - parseFloat(lalurRetencoesIR_AppFin || 0);
    const csllTotal = csll - parseFloat(lalurRetencoesCS || 0);

    return { lair, baseCalculo, compensacao, baseAjustada, irpjNormal, irpjAdicional, irpjTotal, csll, csllTotal, variacaoCambial, equivalenciaPatrimonial, adicoesAuto, exclusoesAuto, adicoes, exclusoes };
  };


    const handleSaveInputsOnly = async () => {
        setIsProcessing(true);
        try {
            await persistTaxData(selectedComp, selectedAno, selectedMes, {
                lalurAdicoes, lalurExclusoes, lalurCompensacaoPrejuizo, lalurRetencoesIR, lalurRetencoesIR_AppFin, lalurRetencoesCS, lalurCambioRealizado,
                presumidoRetencoesIR, presumidoRetencoesIR_AppFin, presumidoRetencoesCS, presumidoOutrasReceitas, presumidoCambioRealizado, presumidoIpi, presumidoIcmsSt, presumidoMajoracao, presumidoImpostosDevolucao, darfIrpjReduzido, darfCsllReduzida
            });
            alert('Memória de cálculo salva com sucesso! (Apenas para controle da DARF, sem impacto no Balanço/DRE)');
        } catch (e) {
            console.error(e);
            alert('Erro ao salvar.');
        } finally {
            setIsProcessing(false);
        }
    };

  const handleGravar = async (vIrpj, vCsll, vIrpjGross, vCsllGross) => {
    if (!selectedComp) { alert('Selecione uma empresa.'); return; }
    
    setIsProcessing(true);
    try {
      // Salva os inputs no state/db
      await persistTaxData(selectedComp, selectedAno, selectedMes, {
        lalurAdicoes, lalurExclusoes, lalurCompensacaoPrejuizo, lalurRetencoesIR, lalurRetencoesIR_AppFin, lalurRetencoesCS, lalurCambioRealizado,
        presumidoRetencoesIR, presumidoRetencoesIR_AppFin, presumidoRetencoesCS, presumidoOutrasReceitas, presumidoCambioRealizado, presumidoIpi, presumidoIcmsSt, presumidoMajoracao
      });

      const regime = taxConfig[selectedComp];
      
      let despesaDreIRAnterior = 0;
      let despesaDreCSAnterior = 0;
      
      let startMonth = 1;
      if (regime === 'real_trimestral' || regime === 'presumido') {
          startMonth = Math.floor((selectedMes - 1) / 3) * 3 + 1;
      }

      if (selectedMes > startMonth) {
        const { data: prevDre } = await supabase.from("dre_history")
          .select("id, valorMensal")
          .eq("empresaId", selectedComp)
          .eq("ano", selectedAno)
          .gte("mes", startMonth)
          .lt("mes", selectedMes)
          .like("id", "tax-dre-%");
        (prevDre || []).forEach(r => {
          if (r.id.startsWith("tax-dre-irpj-")) despesaDreIRAnterior += Math.abs(r.valorMensal || 0);
          if (r.id.startsWith("tax-dre-csll-")) despesaDreCSAnterior += Math.abs(r.valorMensal || 0);
        });
      }

      let valorIrpjDreMes = 0;
      let valorCsllDreMes = 0;
      if (regime === 'presumido') {
        valorIrpjDreMes = Math.max(0, vIrpjGross - despesaDreIRAnterior);
        valorCsllDreMes = Math.max(0, vCsllGross - despesaDreCSAnterior);
      } else {
        // Como o Lucro Real agora é calculado apenas com a base do mês isolado (dreMensal),
        // o valor calculado (vIrpj) já é a provisão do mês, não devemos abater o acumulado anterior.
        valorIrpjDreMes = Math.max(0, vIrpjGross);
        valorCsllDreMes = Math.max(0, vCsllGross);
      }

      const idIrpjBal = 'tax-bal-irpj-' + selectedComp + '-' + selectedAno + '-' + selectedMes;
      const idCsllBal = 'tax-bal-csll-' + selectedComp + '-' + selectedAno + '-' + selectedMes;

      let passivoIRAnterior = 0;
      let passivoCSAnterior = 0;
      if (regime === "presumido" || regime === "real_trimestral") {
        if (selectedMes > startMonth) {
          const { data: prevBal } = await supabase.from("balanco_history")
            .select("id, saldoAcumulado")
            .eq("empresaId", selectedComp)
            .eq("ano", selectedAno)
            .gte("mes", startMonth)
            .lt("mes", selectedMes)
            .like("id", "tax-bal-%");
          (prevBal || []).forEach(r => {
            if (r.id.startsWith("tax-bal-irpj-")) passivoIRAnterior += (r.saldoAcumulado || 0);
            if (r.id.startsWith("tax-bal-csll-")) passivoCSAnterior += (r.saldoAcumulado || 0);
          });
        }
      }
      const ajusteBalancoIrpj = Math.max(0, vIrpj - passivoIRAnterior);
      const ajusteBalancoCsll = Math.max(0, vCsll - passivoCSAnterior);

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

      const irrfServicos = parseFloat(regime === 'presumido' ? presumidoRetencoesIR : lalurRetencoesIR) || 0;
      if (irrfServicos > 0) {
        balancoEntries.push({ id: 'tax-bal-ret-ir-serv-' + selectedComp + '-' + selectedAno + '-' + selectedMes, empresaId: selectedComp, ano: selectedAno, mes: selectedMes, trimestre: Math.ceil(selectedMes/3), tipo: 'ativo', conta: '1.1.1.5.01.00003', descricao: 'IRRF S/ PRESTACAO SERVICOS', saldoAcumulado: -irrfServicos });
      }

      const irrfApp = parseFloat(regime === 'presumido' ? presumidoRetencoesIR_AppFin : lalurRetencoesIR_AppFin) || 0;
      if (irrfApp > 0) {
        balancoEntries.push({ id: 'tax-bal-ret-ir-app-' + selectedComp + '-' + selectedAno + '-' + selectedMes, empresaId: selectedComp, ano: selectedAno, mes: selectedMes, trimestre: Math.ceil(selectedMes/3), tipo: 'ativo', conta: '1.1.1.5.01.00001', descricao: 'IRRF S/ APLICACOES FINANCEIRAS', saldoAcumulado: -irrfApp });
      }

      const csllRetida = parseFloat(regime === 'presumido' ? presumidoRetencoesCS : lalurRetencoesCS) || 0;
      if (csllRetida > 0) {
        balancoEntries.push({ id: 'tax-bal-ret-csll-' + selectedComp + '-' + selectedAno + '-' + selectedMes, empresaId: selectedComp, ano: selectedAno, mes: selectedMes, trimestre: Math.ceil(selectedMes/3), tipo: 'ativo', conta: '1.1.1.5.02.00003', descricao: 'CSLL RETIDA NA FONTE', saldoAcumulado: -csllRetida });
      }

      await bulkPutRecords('dre_history', dreEntries);
      await bulkPutRecords('balanco_history', balancoEntries);
      alert('Apuração gravada com sucesso! O Balanço e a DRE já foram atualizados.');
    } catch (err) {
      alert('Erro ao gravar: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

        const renderComparativo = () => {
    const isEstimativa = taxConfig[selectedComp] === 'real_anual';
    if (!isEstimativa) return null;

    const calcPres = calcPresumido();
    const cM = calcPres.mensal;
    const cA = calcPres.acumulado;
    const calcR = calcReal();

    // Acumulados
    const acumuladoRealIrpj = Math.max(0, calcR.irpjTotal);
    const acumuladoRealCsll = Math.max(0, calcR.csllTotal);
    const darfPagoAnteriorIrpj = (cA.irpjTotalPago || 0) - parseFloat(darfIrpjReduzido || 0);
    const darfPagoAnteriorCsll = (cA.csllTotalPago || 0) - parseFloat(darfCsllReduzida || 0);

    const mensalEstimativaIrpj = Math.max(0, (cA.irpjTotal || 0) - darfPagoAnteriorIrpj);
    const mensalEstimativaCsll = Math.max(0, (cA.csllTotal || 0) - darfPagoAnteriorCsll);


    // O que eu pagaria se usasse o balanço do mês (Devido Total - Já Pago)
    const balancoIrpjAPagar = Math.max(0, acumuladoRealIrpj - darfPagoAnteriorIrpj);
    const balancoCsllAPagar = Math.max(0, acumuladoRealCsll - darfPagoAnteriorCsll);

    // A regra é: suspender se o Saldo a Pagar pelo Balanço for menor que a Estimativa do mês.
    const suspenderIrpj = balancoIrpjAPagar < mensalEstimativaIrpj;
    const suspenderCsll = balancoCsllAPagar < mensalEstimativaCsll;

    // Se o balanço for ZERO, é SUSPENSÃO. Se for MAIOR QUE ZERO MAS MENOR QUE ESTIMATIVA, é REDUÇÃO.
    const statusIrpj = balancoIrpjAPagar === 0 ? '✓ SUSPENDER' : (suspenderIrpj ? '✓ REDUZIR' : '⚠️ PAGAR ESTIMATIVA');
    const statusCsll = balancoCsllAPagar === 0 ? '✓ SUSPENDER' : (suspenderCsll ? '✓ REDUZIR' : '⚠️ PAGAR ESTIMATIVA');

    return (
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid #FFC107', background: 'rgba(255, 193, 7, 0.05)' }}>
        <h3 style={{ color: '#FFC107', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="material-icons">balance</span>
          Comparativo para Suspensão / Redução (Acumulado até o Mês {selectedMes}/{selectedAno})
        </h3>
        <p style={{ color: '#ccc', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Para a decisão de Suspensão/Redução, comparamos o Imposto Total Devido no Balancete contra todos os DARFs já pagos nos meses anteriores.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '1rem', textAlign: 'left' }}>
          
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
            <h4 style={{ color: '#fff', marginBottom: '1rem', textAlign: 'center' }}>VISÃO ANUAL (ACUMULADO)</h4>
            
            <strong style={{ color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>IMPOSTO REAL (BALANCETE)</strong>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#ccc' }}>IRPJ Real Devido Anual:</span>
              <strong style={{ color: '#CE93D8' }}>{acumuladoRealIrpj.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#ccc' }}>CSLL Real Devida Anual:</span>
              <strong style={{ color: '#CE93D8' }}>{acumuladoRealCsll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
            </div>

            <strong style={{ color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>(-) DARFs JÁ PAGOS NO ANO</strong>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#ccc' }}>IRPJ Pago (Acumulado):</span>
              <strong style={{ color: '#FF5252' }}>{darfPagoAnteriorIrpj.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#ccc' }}>CSLL Paga (Acumulada):</span>
              <strong style={{ color: '#FF5252' }}>{darfPagoAnteriorCsll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
            <h4 style={{ color: '#888', marginBottom: '1rem' }}>DECISÃO IRPJ (MÊS {selectedMes})</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', color: '#aaa' }}>1. Pagar Estimativa:</span>
              <strong style={{ color: '#64B5F6' }}>{mensalEstimativaIrpj.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', color: '#aaa' }}>2. Balancete de Redução:</span>
              <strong style={{ color: '#CE93D8' }}>{balancoIrpjAPagar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
            </div>
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #333' }}>
              <span style={{ color: suspenderIrpj ? '#81C784' : '#FFCA28', fontWeight: 'bold', fontSize: '1.1rem' }}>{statusIrpj}</span>
              <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.5rem' }}>
                Valor Final: <b>{(suspenderIrpj ? balancoIrpjAPagar : mensalEstimativaIrpj).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
            <h4 style={{ color: '#888', marginBottom: '1rem' }}>DECISÃO CSLL (MÊS {selectedMes})</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', color: '#aaa' }}>1. Pagar Estimativa:</span>
              <strong style={{ color: '#64B5F6' }}>{mensalEstimativaCsll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', color: '#aaa' }}>2. Balancete de Redução:</span>
              <strong style={{ color: '#CE93D8' }}>{balancoCsllAPagar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
            </div>
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #333' }}>
              <span style={{ color: suspenderCsll ? '#81C784' : '#FFCA28', fontWeight: 'bold', fontSize: '1.1rem' }}>{statusCsll}</span>
              <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.5rem' }}>
                Valor Final: <b>{(suspenderCsll ? balancoCsllAPagar : mensalEstimativaCsll).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b>
              </div>
            </div>
          </div>

        </div>

        <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <h4 style={{ color: '#fff', marginBottom: '1rem', textAlign: 'center' }}>📋 CONTROLE RECOLHIMENTO MENSAL (VISÃO ANUAL)</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'center' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.4)', color: '#ccc' }}>
                  <th style={{ padding: '8px', border: '1px solid #444' }}>Mês</th>
                  <th style={{ padding: '8px', border: '1px solid #444' }}>IRPJ Est. (Acum)</th>
                  <th style={{ padding: '8px', border: '1px solid #444' }}>CSLL Est. (Acum)</th>
                  <th style={{ padding: '8px', border: '1px solid #444' }}>IRPJ Real (Acum)</th>
                  <th style={{ padding: '8px', border: '1px solid #444' }}>CSLL Real (Acum)</th>
                  <th style={{ padding: '8px', border: '1px solid #444' }}>IRPJ Dif. Líquida</th>
                  <th style={{ padding: '8px', border: '1px solid #444' }}>CSLL Dif. Líquida</th>
                  <th style={{ padding: '8px', border: '1px solid #444' }}>Suspensão/Redução</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                  const dreAtM = dreAnualTotal.filter(r => r.mes <= m);
                  if (!dreAnualTotal.some(r => r.mes === m)) return null;
                  const isCurrent = m === selectedMes;
                  const key = `${selectedComp}_${selectedAno}_${m}`;
                  const data = isCurrent ? { presumidoOutrasReceitas, presumidoCambioRealizado, presumidoRetencoesIR, presumidoRetencoesIR_AppFin, presumidoRetencoesCS, presumidoImpostosDevolucao, presumidoMajoracao, darfIrpjReduzido, darfCsllReduzida, lalurAdicoes, lalurExclusoes, lalurCompensacaoPrejuizo, lalurRetencoesIR, lalurRetencoesIR_AppFin, lalurRetencoesCS, lalurCambioRealizado } : (taxDataStore[key] || {});
                  
                  const cInputsM = { outrasReceitas: parseFloat(data.presumidoOutrasReceitas || 0), cambioRealizado: parseFloat(data.presumidoCambioRealizado || 0), retencoesIR: parseFloat(data.presumidoRetencoesIR || 0) + parseFloat(data.presumidoRetencoesIR_AppFin || 0), retencoesCS: parseFloat(data.presumidoRetencoesCS || 0), impostosDevolucao: parseFloat(data.presumidoImpostosDevolucao || 0), majoracao: !isEstimativa && (data.presumidoMajoracao !== undefined ? data.presumidoMajoracao : true) };
                  let sumOutras = 0; let sumCambio = 0; let sumRetIR = 0; let sumRetCS = 0; let sumImpDev = 0;
                  let sumIrpjPagoPrev = 0; let sumCsllPagoPrev = 0;
                  for (let prevM = 1; prevM <= m; prevM++) {
                    const isC = prevM === selectedMes;
                    const k = `${selectedComp}_${selectedAno}_${prevM}`;
                    const d = isC ? { presumidoOutrasReceitas, presumidoCambioRealizado, presumidoRetencoesIR, presumidoRetencoesIR_AppFin, presumidoRetencoesCS, presumidoImpostosDevolucao, darfIrpjReduzido, darfCsllReduzida } : (taxDataStore[k] || {});
                    sumOutras += parseFloat(d.presumidoOutrasReceitas || 0);
                    sumCambio += parseFloat(d.presumidoCambioRealizado || 0);
                    sumRetIR += parseFloat(d.presumidoRetencoesIR || 0) + parseFloat(d.presumidoRetencoesIR_AppFin || 0);
                    sumRetCS += parseFloat(d.presumidoRetencoesCS || 0);
                    sumImpDev += parseFloat(d.presumidoImpostosDevolucao || 0);
                    
                    if (prevM < m) {
                      if (d.darfIrpjReduzido !== undefined && d.darfIrpjReduzido !== '') {
                        sumIrpjPagoPrev += parseFloat(d.darfIrpjReduzido);
                      } else {
                        const cInpA = { outrasReceitas: sumOutras, cambioRealizado: sumCambio, retencoesIR: sumRetIR, retencoesCS: sumRetCS, impostosDevolucao: sumImpDev, majoracao: !isEstimativa && (data.presumidoMajoracao !== undefined ? data.presumidoMajoracao : true) };
                        const calcP = calcPresumidoData(dreAnualTotal.filter(r => r.mes <= prevM), prevM, cInpA);
                        sumIrpjPagoPrev += Math.max(0, (calcP.irpjTotal || 0) - sumIrpjPagoPrev);
                      }
                      
                      if (d.darfCsllReduzida !== undefined && d.darfCsllReduzida !== '') {
                        sumCsllPagoPrev += parseFloat(d.darfCsllReduzida);
                      } else {
                        const cInpA = { outrasReceitas: sumOutras, cambioRealizado: sumCambio, retencoesIR: sumRetIR, retencoesCS: sumRetCS, impostosDevolucao: sumImpDev, majoracao: !isEstimativa && (data.presumidoMajoracao !== undefined ? data.presumidoMajoracao : true) };
                        const calcP = calcPresumidoData(dreAnualTotal.filter(r => r.mes <= prevM), prevM, cInpA);
                        sumCsllPagoPrev += Math.max(0, (calcP.csllTotal || 0) - sumCsllPagoPrev);
                      }
                    }
                  }
                  const cInputsA = { outrasReceitas: sumOutras, cambioRealizado: sumCambio, retencoesIR: sumRetIR, retencoesCS: sumRetCS, impostosDevolucao: sumImpDev, majoracao: !isEstimativa && (data.presumidoMajoracao !== undefined ? data.presumidoMajoracao : true) };
                  const calcPresA = calcPresumidoData(dreAtM, m, cInputsA);
                  const estIrpj = Math.max(0, (calcPresA.irpjTotal || 0) - sumIrpjPagoPrev);
                  const estCsll = Math.max(0, (calcPresA.csllTotal || 0) - sumCsllPagoPrev);
                  
                  let lair = 0; let varCamb = 0; let eqPat = 0;
                  dreAtM.forEach(r => { if (!r.conta.startsWith('6') && !r.conta.startsWith('7') && !r.conta.startsWith('5.1.1.1.01')) lair += (r.valorMensal || 0); if (r.conta.startsWith('4.3.1.1.03')) varCamb += (r.valorMensal || 0); if (r.conta.startsWith('4.4')) eqPat += (r.valorMensal || 0); });
                  let adicoesAuto = 0; let exclusoesAuto = 0; let cambioAdicao = 0; let cambioExclusao = 0;
                  if (eqPat > 0) exclusoesAuto += eqPat; else if (eqPat < 0) adicoesAuto += Math.abs(eqPat);
                  if (cambioConfig[selectedComp] === 'caixa') { if (varCamb > 0) exclusoesAuto += varCamb; else if (varCamb < 0) adicoesAuto += Math.abs(varCamb); const realizado = parseFloat(data.lalurCambioRealizado || 0); if (realizado > 0) cambioAdicao = realizado; else if (realizado < 0) cambioExclusao = Math.abs(realizado); }
                  
                  const baseCalculo = lair + parseFloat(data.lalurAdicoes || 0) + adicoesAuto + cambioAdicao - (parseFloat(data.lalurExclusoes || 0) + exclusoesAuto + cambioExclusao);
                  const baseAjustada = baseCalculo - Math.min(parseFloat(data.lalurCompensacaoPrejuizo || 0), baseCalculo > 0 ? baseCalculo * 0.30 : 0);
                  let irpjNormal = 0; let irpjAdicional = 0; let csll = 0;
                  if (baseAjustada > 0) { irpjNormal = baseAjustada * 0.15; irpjAdicional = Math.max(0, baseAjustada - 20000 * m) * 0.10; csll = baseAjustada * 0.09; }
                  const realIrpjAcum = irpjNormal + irpjAdicional - parseFloat(data.lalurRetencoesIR || 0) - parseFloat(data.lalurRetencoesIR_AppFin || 0);
                  const realCsllAcum = csll - parseFloat(data.lalurRetencoesCS || 0);
                  
                  const displayEstIrpj = data.darfIrpjReduzido !== undefined && data.darfIrpjReduzido !== '' ? parseFloat(data.darfIrpjReduzido) : estIrpj;
                  const displayEstCsll = data.darfCsllReduzida !== undefined && data.darfCsllReduzida !== '' ? parseFloat(data.darfCsllReduzida) : estCsll;

                  const sumIrpjPagoTotal = sumIrpjPagoPrev + displayEstIrpj;
                  const sumCsllPagoTotal = sumCsllPagoPrev + displayEstCsll;

                  const balancoIrpj = realIrpjAcum - sumIrpjPagoTotal;
                  const balancoCsll = realCsllAcum - sumCsllPagoTotal;

                  const devRealIrpj = realIrpjAcum - sumIrpjPagoPrev;
                  let stIrpj = '';
                  if (devRealIrpj <= 0) stIrpj = 'SUSPENDER';
                  else if (devRealIrpj < estIrpj) stIrpj = 'REDUZIR P/ ' + devRealIrpj.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
                  else stIrpj = 'NÃO';

                  const devRealCsll = realCsllAcum - sumCsllPagoPrev;
                  let stCsll = '';
                  if (devRealCsll <= 0) stCsll = 'SUSPENDER';
                  else if (devRealCsll < estCsll) stCsll = 'REDUZIR P/ ' + devRealCsll.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
                  else stCsll = 'NÃO';

                  const statusM = (
                    <div style={{ fontSize: '0.8rem', lineHeight: '1.2' }}>
                      <div style={{ color: stIrpj === 'NÃO' ? '#FF5252' : '#81C784' }}>IRPJ: {stIrpj}</div>
                      <div style={{ color: stCsll === 'NÃO' ? '#FF5252' : '#81C784' }}>CSLL: {stCsll}</div>
                    </div>
                  );
                  
                  return (
                    <tr key={m} style={{ background: isCurrent ? 'rgba(255,255,255,0.1)' : 'transparent', fontWeight: isCurrent ? 'bold' : 'normal' }}>
                      <td style={{ padding: '8px', border: '1px solid #444' }}>{String(m).padStart(2, '0')}/{String(selectedAno).slice(2)}</td>
                      <td style={{ padding: '8px', border: '1px solid #444', color: '#64B5F6' }}>{sumIrpjPagoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td style={{ padding: '8px', border: '1px solid #444', color: '#64B5F6' }}>{sumCsllPagoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td style={{ padding: '8px', border: '1px solid #444', color: '#CE93D8' }}>{Math.max(0, realIrpjAcum).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td style={{ padding: '8px', border: '1px solid #444', color: '#CE93D8' }}>{Math.max(0, realCsllAcum).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td style={{ padding: '8px', border: '1px solid #444', color: balancoIrpj < 0 ? '#81C784' : '#FFCA28' }}>{balancoIrpj.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td style={{ padding: '8px', border: '1px solid #444', color: balancoCsll < 0 ? '#81C784' : '#FFCA28' }}>{balancoCsll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td style={{ padding: '8px', border: '1px solid #444', textAlign: 'center' }}>{statusM}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };





  const renderPresumido = () => {
    const isEstimativa = taxConfig[selectedComp] === 'real_anual';
    const calc = calcPresumido();
    const cM = calc.mensal;
    const cA = calc.acumulado;
    
    const Row = ({ label, m, a, color, bold }) => (
      <div style={{ display: 'grid', gridTemplateColumns: isEstimativa ? '2fr 1fr 1fr' : '2fr 1fr', gap: '1rem', marginBottom: '0.5rem', color: color || 'inherit', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
        <span style={{ fontSize: '0.9rem' }}>{label}</span>
        <span style={{ textAlign: 'right', fontWeight: bold ? 'bold' : 'normal' }}>{m.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        {isEstimativa && <span style={{ textAlign: 'right', color: '#888' }}>{a.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
      </div>
    );

    return (
      <div style={{ marginTop: '1.5rem' }}>
        <h3 style={{ color: '#64B5F6', marginBottom: '1rem' }}>{isEstimativa ? 'Cálculo da Estimativa Mensal (DARF - Regra do Presumido)' : 'Cálculo do Lucro Presumido (Trimestre Atual)'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          
          <details open className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(33, 150, 243, 0.05)' }}>
            <summary style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ccc', cursor: 'pointer', marginBottom: '1rem' }}>1. Receitas e Base (Clique para Expandir/Ocultar)</summary>
            
            <div style={{ display: 'grid', gridTemplateColumns: isEstimativa ? '2fr 1fr 1fr' : '2fr 1fr', gap: '1rem', marginBottom: '1rem', color: '#666', fontSize: '0.8rem', borderBottom: '1px solid #444', paddingBottom: '0.5rem' }}>
               <span></span>
               <span style={{ textAlign: 'right' }}>DO MÊS</span>
               {isEstimativa && <span style={{ textAlign: 'right' }}>ACUMULADO DO ANO</span>}
            </div>

            <div title={(cM.recRevendaBreakdown || []).join('\n')}>
<Row label="Receita Venda/Revenda [Passe o mouse p/ ver contas]:" m={cM.recRevenda} a={cA.recRevenda} bold={true} />
</div>
            <div title={(cM.devolucoesBreakdown || []).join('\n')}>
              <Row label="(-) Devoluções de Vendas (Extraído da DRE) [Passe o mouse p/ ver contas]" m={cM.devolucoes} a={cA.devolucoes} color="#FF5252" />
            </div>
            <div title={(cM.ipiIcmsDevolucaoBreakdown || []).join('\n')}>
              <Row label="(+) IPI e ICMS ST sobre Devolução (Extraído da DRE) [Passe o mouse p/ ver contas]:" m={cM.impostosDevolucaoAuto} a={cA.impostosDevolucaoAuto} color="#FFCA28" />
            </div>
            <div style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(+) Ajuste Manual de Impostos s/ Devolução - <b>Valor do Mês</b></label>
              <input type="number" className="text-input" value={presumidoImpostosDevolucao} onChange={e => setPresumidoImpostosDevolucao(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div title={(cM.ipiVendasBreakdown || []).join('\n')}>
              <Row label="(-) IPI sobre Vendas (Extraído da DRE) [Passe o mouse p/ ver contas]" m={cM.ipi} a={cA.ipi} color="#FF5252" />
            </div>
            <div title={(cM.icmsStVendasBreakdown || []).join('\n')}>
              <Row label="(-) ICMS ST sobre Vendas (Extraído da DRE) [Passe o mouse p/ ver contas]" m={cM.icmsSt} a={cA.icmsSt} color="#FF5252" />
            </div>
            
            <div style={{ margin: '1rem 0' }}>
               <Row label="Base Receita Venda Líquida (8% / 12%):" m={cM.recRevendaLiquida} a={cA.recRevendaLiquida} color="#64B5F6" bold={true} />
            </div>

            <div title={(cM.recServicoBreakdown || []).join('\n')}>
<Row label="Receita Serviço (32%) [Passe o mouse p/ ver contas]:" m={cM.recServico} a={cA.recServico} bold={true} />
</div>
            
            <div title={(cM.outrasReceitasDreBreakdown || []).join('\n')}>
              <Row label="(+) Receitas Financeiras e Outras (Extraído da DRE) [Passe o mouse p/ ver contas]:" m={cM.outrasReceitasDre} a={cA.outrasReceitasDre} color="#888" />
            </div>
            <div style={{ marginBottom: '1rem', marginTop: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(+) Ajuste Manual de Outras Receitas - <b>Valor do Mês</b></label>
              <input type="number" className="text-input" value={presumidoOutrasReceitas} onChange={e => setPresumidoOutrasReceitas(e.target.value)} style={{ width: '100%' }} />
            </div>
            
            {cambioConfig[selectedComp] === 'caixa' ? (
              <div style={{ marginBottom: '1rem', marginTop: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#FFCA28', marginBottom: '0.3rem' }}>(+) Variação Cambial Realizada (Regime de Caixa) - <b>Valor do Mês</b></label>
                <input type="number" className="text-input" value={presumidoCambioRealizado} disabled={true} title="Alterar no menu Gestão Contábil" style={{ width: '100%', borderColor: '#FFCA28', opacity: 0.7, cursor: 'not-allowed' }} />
              </div>
            ) : (
              <Row label="(+) Variação Cambial DRE (Competência):" m={cM.variacaoCambial > 0 ? cM.variacaoCambial : 0} a={cA.variacaoCambial > 0 ? cA.variacaoCambial : 0} color="#888" />
            )}

            {!isEstimativa && (
              <div style={{ marginTop: '1.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center' }}>
                <input type="checkbox" id="presumidoMajoracao" checked={presumidoMajoracao} onChange={e => setPresumidoMajoracao(e.target.checked)} style={{ marginRight: '0.5rem', transform: 'scale(1.2)' }} />
                <label htmlFor="presumidoMajoracao" style={{ color: '#ddd', fontSize: '0.9rem', cursor: 'pointer' }}>Aplicar majoração de 10% sobre a presunção (Lei 2026)</label>
              </div>
            )}

            <div style={{ marginTop: '1.5rem' }}>
               <Row label="Base IRPJ:" m={cM.baseIrpj} a={cA.baseIrpj} color="#FFCA28" bold={true} />
               <Row label="Base CSLL:" m={cM.baseCsll} a={cA.baseCsll} color="#FFCA28" bold={true} />
            </div>
          </details>

          <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(76, 175, 80, 0.05)' }}>
            <h4 style={{ color: '#ccc', marginBottom: '1rem' }}>2. Apuração dos Impostos</h4>
            <div style={{ display: 'grid', gridTemplateColumns: isEstimativa ? '2fr 1fr 1fr' : '2fr 1fr', gap: '1rem', marginBottom: '1rem', color: '#666', fontSize: '0.8rem', borderBottom: '1px solid #444', paddingBottom: '0.5rem' }}>
               <span></span>
               <span style={{ textAlign: 'right' }}>DO MÊS</span>
               {isEstimativa && <span style={{ textAlign: 'right' }}>ACUMULADO DO ANO</span>}
            </div>

            <Row label="IRPJ Normal (15%):" m={cM.irpjNormal} a={cA.irpjNormal} />
            <Row label="IRPJ Adicional (10%):" m={cM.irpjAdicional} a={cA.irpjAdicional} />
            
            <div style={{ marginBottom: '1rem', marginTop: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(-) IRRF s/ Serviços - <b>Valor do Mês</b></label>
              <input type="number" className="text-input" value={presumidoRetencoesIR} onChange={e => setPresumidoRetencoesIR(e.target.value)} style={{ width: '100%' }} />
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginTop: '1rem', marginBottom: '0.3rem' }}>(-) IRRF s/ Aplicações - <b>Valor do Mês</b></label>
            <input type="number" className="text-input" value={presumidoRetencoesIR_AppFin} onChange={e => setPresumidoRetencoesIR_AppFin(e.target.value)} style={{ width: '100%' }} />
            </div>

            <Row label="IRPJ DEVIDO CALCULADO:" m={Math.max(0, cM.irpjTotal)} a={Math.max(0, cA.irpjTotal)} color="#81C784" bold={true} />
            
            {isEstimativa && (
              <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '4px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#fff', marginBottom: '0.5rem' }}>✏️ <b>Ajuste de Suspensão/Redução: IRPJ Pago no Mês</b> (Para controle anual)</label>
                <input type="number" className="text-input" value={darfIrpjReduzido} onChange={e => setDarfIrpjReduzido(e.target.value)} style={{ width: '100%', borderColor: '#81C784' }} placeholder={`Valor Padrão: ${Math.max(0, cM.irpjTotal).toFixed(2)}`} />
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#aaa' }}>Acumulado Efetivamente Pago: {(cA.irpjTotalPago || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</div>
              </div>
            )}


            <div style={{ marginTop: '1.5rem' }}>
               <Row label="CSLL Normal (9%):" m={cM.csll} a={cA.csll} />
            </div>

            <div style={{ marginBottom: '1rem', marginTop: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(-) CSLL Retida - <b>Valor do Mês</b></label>
              <input type="number" className="text-input" value={presumidoRetencoesCS} onChange={e => setPresumidoRetencoesCS(e.target.value)} style={{ width: '100%' }} />
            </div>

            <Row label="CSLL DEVIDA CALCULADA:" m={Math.max(0, cM.csllTotal)} a={Math.max(0, cA.csllTotal)} color="#81C784" bold={true} />
            {isEstimativa && (
              <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '4px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#fff', marginBottom: '0.5rem' }}>✏️ <b>Ajuste de Suspensão/Redução: CSLL Paga no Mês</b> (Para controle anual)</label>
                <input type="number" className="text-input" value={darfCsllReduzida} onChange={e => setDarfCsllReduzida(e.target.value)} style={{ width: '100%', borderColor: '#81C784' }} placeholder={`Valor Padrão: ${Math.max(0, cM.csllTotal).toFixed(2)}`} />
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#aaa' }}>Acumulado Efetivamente Pago: {(cA.csllTotalPago || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</div>
              </div>
            )}
            </div>

</div>

        <div style={{ marginTop: '2rem', textAlign: 'right' }}>
            <button className="btn-primary" onClick={() => isEstimativa ? handleSaveInputsOnly() : handleGravar(cA.irpjTotal, cA.csllTotal, cA.irpjNormal + cA.irpjAdicional, cA.csll)} style={{ padding: '1rem 2rem', fontSize: '1.1rem' }} disabled={isProcessing}>
                {isProcessing ? 'Gravando...' : (isEstimativa ? '💾 Salvar Memória de Cálculo (Controle DARF)' : '💾 Lançar Apuração no DRE e Balanço')}
            </button>
        </div>
      </div>
    );
  };

  const renderResumoTrimestre = () => {
    const regime = taxConfig[selectedComp] || "";
    if (regime !== "presumido") return null;

    const startMonth = Math.floor((selectedMes - 1) / 3) * 3 + 1;
    const months = [startMonth, startMonth + 1, startMonth + 2];
    const trimNum = Math.ceil(selectedMes / 3);
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    const calcForMonth = (m) => {
        let inputs = {};
        if (m === selectedMes) {
            inputs = {
                outrasReceitas: presumidoOutrasReceitas,
                cambioRealizado: presumidoCambioRealizado,
                retencoesIR: parseFloat(presumidoRetencoesIR || 0) + parseFloat(presumidoRetencoesIR_AppFin || 0),
                retencoesCS: presumidoRetencoesCS,
                impostosDevolucao: presumidoImpostosDevolucao,
                majoracao: presumidoMajoracao
            };
        } else {
            const key = `${selectedComp}_${selectedAno}_${m}`;
            const data = taxDataStore[key] || {};
            inputs = {
                outrasReceitas: data.presumidoOutrasReceitas,
                cambioRealizado: data.presumidoCambioRealizado,
                retencoesIR: parseFloat(data.presumidoRetencoesIR || 0) + parseFloat(data.presumidoRetencoesIR_AppFin || 0),
                retencoesCS: data.presumidoRetencoesCS,
                impostosDevolucao: data.presumidoImpostosDevolucao,
                majoracao: data.presumidoMajoracao !== undefined ? data.presumidoMajoracao : true
            };
        }
        return calcPresumidoData(dreAnualTotal.filter(r => r.mes === m), 1, inputs);
    };

    const c1 = calcForMonth(months[0]);
    const c2 = calcForMonth(months[1]);
    const c3 = calcForMonth(months[2]);
    const cTotal = calcPresumido().acumulado;

    const fmt = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    return (
      <div style={{ marginTop: "2rem", paddingTop: "2rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <h4 style={{ color: "#fff", marginBottom: "1rem", textAlign: "center" }}>?? RESUMO DO {trimNum}� TRIMESTRE ({monthNames[months[0]-1]} - {monthNames[months[2]-1]})</h4>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "center" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.4)", color: "#ccc" }}>
                <th style={{ padding: "8px", border: "1px solid #444", textAlign: "left" }}>Indicador</th>
                <th style={{ padding: "8px", border: "1px solid #444" }}>{monthNames[months[0]-1]}</th>
                <th style={{ padding: "8px", border: "1px solid #444" }}>{monthNames[months[1]-1]}</th>
                <th style={{ padding: "8px", border: "1px solid #444" }}>{monthNames[months[2]-1]}</th>
                <th style={{ padding: "8px", border: "1px solid #444", color: "#64B5F6" }}>Total Trimestre</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ padding: "8px", border: "1px solid #444", textAlign: "left" }}>Receita Venda/Servi�o</td><td style={{ border: "1px solid #444" }}>{fmt(c1.recRevenda + c1.recServico)}</td><td style={{ border: "1px solid #444" }}>{fmt(c2.recRevenda + c2.recServico)}</td><td style={{ border: "1px solid #444" }}>{fmt(c3.recRevenda + c3.recServico)}</td><td style={{ border: "1px solid #444", fontWeight: "bold" }}>{fmt(cTotal.recRevenda + cTotal.recServico)}</td></tr>
              <tr><td style={{ padding: "8px", border: "1px solid #444", textAlign: "left" }}>Base de C�lculo IRPJ</td><td style={{ border: "1px solid #444" }}>{fmt(c1.baseIrpj)}</td><td style={{ border: "1px solid #444" }}>{fmt(c2.baseIrpj)}</td><td style={{ border: "1px solid #444" }}>{fmt(c3.baseIrpj)}</td><td style={{ border: "1px solid #444", fontWeight: "bold" }}>{fmt(cTotal.baseIrpj)}</td></tr>
              <tr><td style={{ padding: "8px", border: "1px solid #444", textAlign: "left" }}>IRPJ Normal (15%)</td><td style={{ border: "1px solid #444" }}>{fmt(c1.irpjNormal)}</td><td style={{ border: "1px solid #444" }}>{fmt(c2.irpjNormal)}</td><td style={{ border: "1px solid #444" }}>{fmt(c3.irpjNormal)}</td><td style={{ border: "1px solid #444", fontWeight: "bold" }}>{fmt(cTotal.irpjNormal)}</td></tr>
              <tr><td style={{ padding: "8px", border: "1px solid #444", textAlign: "left" }}>IRPJ Adicional (10%)</td><td style={{ border: "1px solid #444" }}>{fmt(c1.irpjAdicional)}</td><td style={{ border: "1px solid #444" }}>{fmt(c2.irpjAdicional)}</td><td style={{ border: "1px solid #444" }}>{fmt(c3.irpjAdicional)}</td><td style={{ border: "1px solid #444", fontWeight: "bold" }}>{fmt(cTotal.irpjAdicional)}</td></tr>
              <tr style={{ background: "rgba(0,255,0,0.05)" }}><td style={{ padding: "8px", border: "1px solid #444", textAlign: "left" }}>IRPJ DEVIDO L�QUIDO</td><td style={{ border: "1px solid #444" }}>{fmt(Math.max(0, c1.irpjTotal))}</td><td style={{ border: "1px solid #444" }}>{fmt(Math.max(0, c2.irpjTotal))}</td><td style={{ border: "1px solid #444" }}>{fmt(Math.max(0, c3.irpjTotal))}</td><td style={{ border: "1px solid #444", fontWeight: "bold", color: "#81C784" }}>{fmt(Math.max(0, cTotal.irpjTotal))}</td></tr>
              <tr><td style={{ padding: "8px", border: "1px solid #444", textAlign: "left" }}>Base de C�lculo CSLL</td><td style={{ border: "1px solid #444" }}>{fmt(c1.baseCsll)}</td><td style={{ border: "1px solid #444" }}>{fmt(c2.baseCsll)}</td><td style={{ border: "1px solid #444" }}>{fmt(c3.baseCsll)}</td><td style={{ border: "1px solid #444", fontWeight: "bold" }}>{fmt(cTotal.baseCsll)}</td></tr>
              <tr><td style={{ padding: "8px", border: "1px solid #444", textAlign: "left" }}>CSLL Normal (9%)</td><td style={{ border: "1px solid #444" }}>{fmt(c1.csll)}</td><td style={{ border: "1px solid #444" }}>{fmt(c2.csll)}</td><td style={{ border: "1px solid #444" }}>{fmt(c3.csll)}</td><td style={{ border: "1px solid #444", fontWeight: "bold" }}>{fmt(cTotal.csll)}</td></tr>
              <tr style={{ background: "rgba(0,255,0,0.05)" }}><td style={{ padding: "8px", border: "1px solid #444", textAlign: "left" }}>CSLL DEVIDA L�QUIDA</td><td style={{ border: "1px solid #444" }}>{fmt(Math.max(0, c1.csllTotal))}</td><td style={{ border: "1px solid #444" }}>{fmt(Math.max(0, c2.csllTotal))}</td><td style={{ border: "1px solid #444" }}>{fmt(Math.max(0, c3.csllTotal))}</td><td style={{ border: "1px solid #444", fontWeight: "bold", color: "#81C784" }}>{fmt(Math.max(0, cTotal.csllTotal))}</td></tr>
            </tbody>
          </table>
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
        <h3 style={{ color: '#FFCA28', marginBottom: '1rem' }}>Cálculo Lucro Real</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(255, 152, 0, 0.05)' }}>
             <h4 style={{ color: '#ccc', marginBottom: '1rem' }}>1. e-LALUR / Base de Cálculo</h4>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '1.1rem' }}>
                <span>Lucro Antes do IR (LAIR da DRE):</span>
                <strong style={{ color: calc.lair >= 0 ? '#81C784' : '#FF5252' }}>{calc.lair.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
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
                 <input type="number" className="text-input" value={lalurCambioRealizado} disabled={true} title="Alterar no menu Gestão Contábil" style={{ width: '100%', borderColor: '#FFCA28', opacity: 0.7, cursor: 'not-allowed' }} />
               </div>
             )}
             
             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '1rem' }}>
                <span>Base de Cálculo (Antes Prejuízo):</span>
                <strong style={{ color: calc.baseCalculo >= 0 ? '#81C784' : '#FF5252' }}>{calc.baseCalculo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
             </div>

             <div style={{ marginBottom: '1rem', marginTop: '1.5rem' }}>
               <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(-) Compensação Prejuízo (Lim. 30%: {Math.max(0, calc.baseCalculo*0.3).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</label>
               <input type="number" className="text-input" value={lalurCompensacaoPrejuizo} onChange={e => setLalurCompensacaoPrejuizo(e.target.value)} style={{ width: '100%' }} />
             </div>

             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '1rem', color: '#FFCA28', fontSize: '1.1rem' }}>
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
               <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(-) IRRF s/ Serviços</label>
               <input type="number" className="text-input" value={lalurRetencoesIR} onChange={e => setLalurRetencoesIR(e.target.value)} style={{ width: '100%' }} />
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginTop: '1rem', marginBottom: '0.3rem' }}>(-) IRRF s/ Aplicações</label>
            <input type="number" className="text-input" value={lalurRetencoesIR_AppFin} onChange={e => setLalurRetencoesIR_AppFin(e.target.value)} style={{ width: '100%' }} />
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '1rem', color: '#81C784', fontSize: '1.1rem', fontWeight: 'bold' }}>
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
             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '1rem', color: '#81C784', fontSize: '1.1rem', fontWeight: 'bold' }}>
                <span>CSLL Devida {isAnual ? 'no Acumulado' : 'no Trimestre'}:</span>
                <span>{Math.max(0, calc.csllTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
             </div>
          </div>
          
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'right' }}>
            <button className="btn-primary" onClick={() => handleGravar(calc.irpjTotal, calc.csllTotal, calc.irpjNormal + calc.irpjAdicional, calc.csll)} style={{ padding: '1rem 2rem', fontSize: '1.1rem' }} disabled={isProcessing}>
              {isProcessing ? 'Gravando...' : (isAnual ? '💾 Lançar Balanço de Suspensão/Redução no DRE e Balanço' : '💾 Lançar Apuração no DRE e Balanço')}
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
        <button className={activeTab === 'apuracao' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('apuracao')}>1. Painel de Apuração</button>
        <button className={activeTab === 'config' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('config')}>2. Configurações de Regime</button>
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
                  <td style={{ color: taxConfig[c.id] ? '#81C784' : '#888' }}>
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
                  {taxConfig[selectedComp] === 'real_anual' && renderComparativo()}
                  {(taxConfig[selectedComp] === 'presumido' || taxConfig[selectedComp] === 'real_anual') && renderPresumido()}
            {renderResumoTrimestre()}
                  {(taxConfig[selectedComp] === 'real_anual' || taxConfig[selectedComp] === 'real_trimestral') && renderReal()}
                  {(!taxConfig[selectedComp]) && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#FFCA28', background: 'rgba(255,152,0,0.1)', borderRadius: '10px' }}>
                      Por favor, vá para a aba "Configurações de Regime" e defina o regime tributário para esta empresa antes de apurar.
                    </div>
                  )}
             </div>
          )}
        </div>
      )}
    </div>
  );
}