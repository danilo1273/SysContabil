import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getRawRecords, bulkPutRecords, getSettings, saveSettings } from '../utils/db';
import { applyMapping, protheusMapping } from '../utils/mappingConfig';
import { supabase } from '../supabaseClient';

export const parseCurrencyInput = (val) => {
  if (val === undefined || val === null) return '';
  let str = String(val).trim();
  if (str === '') return '';

  // Remove currency signs (R$, $), letters, whitespace, non-breaking spaces
  str = str.replace(/[R$\s\u00A0a-zA-Z]/g, '');

  // Strip leading minus if for tax calculation
  str = str.replace(/^-/, '');

  const hasDot = str.includes('.');
  const hasComma = str.includes(',');

  if (hasDot && hasComma) {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Formato brasileiro: 60.247,66 -> pontos sao milhares, virgula e decimal
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato americano: 60,247.66 -> virgulas sao milhares, ponto e decimal
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    const commaCount = (str.match(/,/g) || []).length;
    if (commaCount > 1) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  } else if (hasDot) {
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      str = str.replace(/\./g, '');
    } else if (/^\d{1,3}\.\d{3}$/.test(str)) {
      // Ex: 60.247 copiado da calculadora (inteiro com ponto de milhar brasileiro)
      str = str.replace('.', '');
    }
  }

  // Remove any remaining unexpected character except digits and dot
  str = str.replace(/[^0-9.]/g, '');

  // Ensure only one dot exists
  const parts = str.split('.');
  if (parts.length > 2) {
    str = parts[0] + '.' + parts.slice(1).join('');
  }

  return str;
};

const cleanAjuste = (val) => {
  if (val === undefined || val === null || val === '' || val === 0 || val === '0' || val === '0.00' || val === '335.97838') return '';
  return val;
};

export default function TaxModule({ companies }) {
  const [activeTab, setActiveTab] = useState('apuracao'); // 'config', 'apuracao'
  const [taxConfig, setTaxConfig] = useState({});
  const [cambioConfig, setCambioConfig] = useState({});
  const [taxDataStore, setTaxDataStore] = useState({}); // Stores adicoes, exclusoes, retencoes por empresa/mes
  const taxDataStoreRef = useRef({});

  useEffect(() => {
    taxDataStoreRef.current = taxDataStore;
  }, [taxDataStore]);
  
  const [selectedComp, setSelectedComp] = useState('');
  const [selectedMes, setSelectedMes] = useState(new Date().getMonth() + 1);
  const [selectedAno, setSelectedAno] = useState(new Date().getFullYear());
  const [isProcessing, setIsProcessing] = useState(false);
  const handlePasteNumber = (e, setter, persistKey) => {
    e.preventDefault();
    const raw = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    const cleaned = parseCurrencyInput(raw);
    setter(cleaned);
    if (persistKey) {
      persistTaxData(selectedComp, selectedAno, selectedMes, { [persistKey]: cleaned });
    }
  };


  // Dados Extraídos
  const [dreMensal, setDreMensal] = useState([]);
  const [dreAcumulada, setDreAcumulada] = useState([]);
  const [dreAnualTotal, setDreAnualTotal] = useState([]);
  const [balancoAnualTotal, setBalancoAnualTotal] = useState([]);
  const [resumoVisao, setResumoVisao] = useState('trimestre'); // 'trimestre' | 'ano_trimestres' | 'ano_meses'
  
  // Mapa de acesso rápido O(1) de DRE por mês para eliminar filtros lineares repetitivos
  const dreRecordsByMonth = useMemo(() => {
    const map = {};
    for (let m = 1; m <= 12; m++) map[m] = [];
    (dreAnualTotal || []).forEach(r => {
      if (r && r.mes) {
        if (!map[r.mes]) map[r.mes] = [];
        map[r.mes].push(r);
      }
    });
    return map;
  }, [dreAnualTotal]);
  
  // Inputs Manuais LALUR
  const [lalurAdicoes, setLalurAdicoes] = useState(0);
  const [lalurExclusoes, setLalurExclusoes] = useState(0);
  const [lalurCompensacaoPrejuizo, setLalurCompensacaoPrejuizo] = useState(0);
  const [lalurRetencoesIR, setLalurRetencoesIR] = useState(0);
  const [lalurRetencoesCS, setLalurRetencoesCS] = useState(0);
  const [lalurRetencoesIR_AppFin, setLalurRetencoesIR_AppFin] = useState(0);
  const [lalurCambioRealizado, setLalurCambioRealizado] = useState(0);
  const [lalurAjusteIrpj, setLalurAjusteIrpj] = useState('');
  const [lalurAjusteCsll, setLalurAjusteCsll] = useState('');

  // Inputs Manuais Presumido
  const [presumidoRetencoesIR, setPresumidoRetencoesIR] = useState(0);
  const [presumidoRetencoesCS, setPresumidoRetencoesCS] = useState(0);
  const [presumidoAjusteIrpj, setPresumidoAjusteIrpj] = useState('');
  const [presumidoAjusteCsll, setPresumidoAjusteCsll] = useState('');
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
      if (store) {
        setTaxDataStore(store);
        taxDataStoreRef.current = store;
      }
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
    if (!compId || !ano || !mes) return;
    const key = `${compId}_${ano}_${mes}`;
    const baseStore = taxDataStoreRef.current || {};
    const updated = {
      ...baseStore,
      [key]: { ...(baseStore[key] || {}), ...data }
    };
    taxDataStoreRef.current = updated;
    setTaxDataStore(updated);
    try {
      await saveSettings('agf_tax_store', updated);
    } catch(e) {
      console.error('Erro ao salvar agf_tax_store:', e);
    }
    return updated;
  };

  const loadTaxData = (compId, ano, mes, store = taxDataStoreRef.current) => {
    const key = `${compId}_${ano}_${mes}`;
    const currentStore = store || taxDataStoreRef.current || {};
    const data = currentStore[key] || {};
    
    setLalurAdicoes(data.lalurAdicoes !== undefined ? data.lalurAdicoes : 0);
    setLalurExclusoes(data.lalurExclusoes !== undefined ? data.lalurExclusoes : 0);
    setLalurCompensacaoPrejuizo(data.lalurCompensacaoPrejuizo !== undefined ? data.lalurCompensacaoPrejuizo : 0);
    setLalurRetencoesIR(data.lalurRetencoesIR !== undefined ? data.lalurRetencoesIR : 0);
    setLalurRetencoesIR_AppFin(data.lalurRetencoesIR_AppFin !== undefined ? data.lalurRetencoesIR_AppFin : 0);
    setLalurRetencoesCS(data.lalurRetencoesCS !== undefined ? data.lalurRetencoesCS : 0);
    setLalurCambioRealizado(data.lalurCambioRealizado !== undefined ? data.lalurCambioRealizado : 0);
    setLalurAjusteIrpj(data.lalurAjusteIrpj !== undefined ? data.lalurAjusteIrpj : '');
    setLalurAjusteCsll(data.lalurAjusteCsll !== undefined ? data.lalurAjusteCsll : '');
    
    setPresumidoRetencoesIR(data.presumidoRetencoesIR !== undefined ? data.presumidoRetencoesIR : 0);
    setPresumidoRetencoesIR_AppFin(data.presumidoRetencoesIR_AppFin !== undefined ? data.presumidoRetencoesIR_AppFin : 0);
    setPresumidoRetencoesCS(data.presumidoRetencoesCS !== undefined ? data.presumidoRetencoesCS : 0);
    setPresumidoImpostosDevolucao(data.presumidoImpostosDevolucao !== undefined ? data.presumidoImpostosDevolucao : '');
    setPresumidoAjusteIrpj(cleanAjuste(data.presumidoAjusteIrpj));
    setPresumidoAjusteCsll(cleanAjuste(data.presumidoAjusteCsll));
    setPresumidoOutrasReceitas(data.presumidoOutrasReceitas !== undefined ? data.presumidoOutrasReceitas : '');
    setPresumidoCambioRealizado(data.presumidoCambioRealizado !== undefined ? data.presumidoCambioRealizado : 0);
    setPresumidoIpi(data.presumidoIpi !== undefined ? data.presumidoIpi : '');
    setPresumidoIcmsSt(data.presumidoIcmsSt !== undefined ? data.presumidoIcmsSt : '');
    setPresumidoMajoracao(data.presumidoMajoracao !== undefined ? data.presumidoMajoracao : true);
    setDarfIrpjReduzido(data.darfIrpjReduzido !== undefined ? data.darfIrpjReduzido : '');
    setDarfCsllReduzida(data.darfCsllReduzida !== undefined ? data.darfCsllReduzida : '');
  };

  const handleMonthChange = (newMes) => {
    if (selectedComp) {
      persistTaxData(selectedComp, selectedAno, selectedMes, {
        lalurAdicoes, lalurExclusoes, lalurCompensacaoPrejuizo, lalurRetencoesIR, lalurRetencoesIR_AppFin, lalurRetencoesCS, lalurCambioRealizado, lalurAjusteIrpj, lalurAjusteCsll,
        presumidoRetencoesIR, presumidoRetencoesIR_AppFin, presumidoAjusteIrpj, presumidoAjusteCsll, presumidoRetencoesCS, presumidoOutrasReceitas, presumidoCambioRealizado, presumidoIpi, presumidoIcmsSt, presumidoMajoracao, presumidoImpostosDevolucao, darfIrpjReduzido, darfCsllReduzida
      });
    }
    setSelectedMes(newMes);
  };

  const handleCompanyChange = (newComp) => {
    if (selectedComp) {
      persistTaxData(selectedComp, selectedAno, selectedMes, {
        lalurAdicoes, lalurExclusoes, lalurCompensacaoPrejuizo, lalurRetencoesIR, lalurRetencoesIR_AppFin, lalurRetencoesCS, lalurCambioRealizado, lalurAjusteIrpj, lalurAjusteCsll,
        presumidoRetencoesIR, presumidoRetencoesIR_AppFin, presumidoAjusteIrpj, presumidoAjusteCsll, presumidoRetencoesCS, presumidoOutrasReceitas, presumidoCambioRealizado, presumidoIpi, presumidoIcmsSt, presumidoMajoracao, presumidoImpostosDevolucao, darfIrpjReduzido, darfCsllReduzida
      });
    }
    setSelectedComp(newComp);
  };

  const handleYearChange = (newAno) => {
    if (selectedComp) {
      persistTaxData(selectedComp, selectedAno, selectedMes, {
        lalurAdicoes, lalurExclusoes, lalurCompensacaoPrejuizo, lalurRetencoesIR, lalurRetencoesIR_AppFin, lalurRetencoesCS, lalurCambioRealizado, lalurAjusteIrpj, lalurAjusteCsll,
        presumidoRetencoesIR, presumidoRetencoesIR_AppFin, presumidoAjusteIrpj, presumidoAjusteCsll, presumidoRetencoesCS, presumidoOutrasReceitas, presumidoCambioRealizado, presumidoIpi, presumidoIcmsSt, presumidoMajoracao, presumidoImpostosDevolucao, darfIrpjReduzido, darfCsllReduzida
      });
    }
    setSelectedAno(newAno);
  };

  const loadFinancialData = async () => {
    if (!selectedComp) return;
    setIsProcessing(true);
    try {
      let anual = [];
      let balAnual = [];
      for (let m = 1; m <= 12; m++) {
        const d = await getRawRecords(selectedAno, m);
        const comp = (d.dre || []).filter(r => r.empresaId === selectedComp);
        comp.forEach(r => anual.push({ ...r, mes: m }));
        const compBal = (d.balanco || []).filter(r => r.empresaId === selectedComp);
        compBal.forEach(r => balAnual.push({ ...r, mes: m }));
      }
      setDreAnualTotal(anual);
      setBalancoAnualTotal(balAnual);

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
      window.$alert('Erro ao carregar dados do período: ' + err.message);
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
    const isEstimativa = inputs?.isEstimativa !== undefined ? inputs.isEstimativa : (taxConfig[selectedComp] === 'real_anual');
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
      } else if (r.conta.startsWith('4.3.1.1.01.00003') || (r.conta.startsWith('4.3.1.1.01') && (r.descricao || '').toUpperCase().includes('JUROS'))) {
        // Juros Ativos / Recebidos
        if ((r.valorMensal || 0) > 0) {
          outrasReceitasDre += (r.valorMensal || 0);
          outrasReceitasDreBreakdown.push(`${r.conta} (${r.descricao}): R$ ${(r.valorMensal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        }
      } else if (r.conta.startsWith('4.3.1.1.01.00004') || (r.conta.startsWith('4.3.1.1.01') && (r.descricao || '').toUpperCase().includes('DESCONTO')) || (r.descricao || '').toUpperCase().includes('DESCONTOS OBTIDOS')) {
        // Descontos Obtidos
        if ((r.valorMensal || 0) > 0) {
          outrasReceitasDre += (r.valorMensal || 0);
          outrasReceitasDreBreakdown.push(`${r.conta} (${r.descricao}): R$ ${(r.valorMensal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        }
      } else if (isEstimativa && (r.conta.startsWith('4.9.1.2') || r.conta.startsWith('4.3.1.1.01'))) {
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
    
    let cambioBase = 0;
    if (cambioConfig[selectedComp] === 'caixa') {
      const realizado = parseFloat(inputs.cambioRealizado || 0);
      if (realizado > 0) {
        cambioBase = realizado;
      }
    } else {
      if (variacaoCambial > 0) {
        cambioBase = variacaoCambial;
      }
    }
    outrasReceitasAjustadas += cambioBase;

    // IPI e ICMS calculados automaticamente do DRE
    // const icmsSt = ...
    const impostosDevolucao = parseFloat(inputs.impostosDevolucao || 0) + ipiDevolucao + icmsStDevolucao;
    const recRevendaLiquida = Math.max(0, recRevenda - devolucoes + impostosDevolucao - ipi - icmsSt);

    const baseRevendaIrpj = recRevendaLiquida * 0.08;
    const baseServicoIrpj = recServico * 0.32;
    let baseIrpj = baseRevendaIrpj + baseServicoIrpj;

    const baseRevendaCsll = recRevendaLiquida * 0.12;
    const baseServicoCsll = recServico * 0.32;
    let baseCsll = baseRevendaCsll + baseServicoCsll;

    let acrescimoIrpj = 0;
    let acrescimoCsll = 0;

    const mesesNoPeriodo = numMeses;
    const limiteMajoracao = (1250000 / 3) * mesesNoPeriodo;

    if (inputs.majoracao) {
        // LC 224/2025 e IN RFB 2.305/2025 (art. 15):
        // Rateio proporcional do limite de R$ 1.250.000 com base na receita operacional líquida
        const totalReceitas = recRevendaLiquida + recServico;
        
        const limiteRevenda = totalReceitas > 0 ? limiteMajoracao * (recRevendaLiquida / totalReceitas) : 0;
        const limiteServico = totalReceitas > 0 ? limiteMajoracao * (recServico / totalReceitas) : 0;
        
        const excessoRevenda = Math.max(0, recRevendaLiquida - limiteRevenda);
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

    let irpjTotal = irpjNormal + irpjAdicional - parseFloat(inputs.retencoesIR || 0);
    if (inputs.ajusteIrpj !== undefined && inputs.ajusteIrpj !== null && inputs.ajusteIrpj.toString().trim() !== '') {
        irpjTotal = parseFloat(inputs.ajusteIrpj);
    }

    let csllTotal = csll - parseFloat(inputs.retencoesCS || 0);
    if (inputs.ajusteCsll !== undefined && inputs.ajusteCsll !== null && inputs.ajusteCsll.toString().trim() !== '') {
        csllTotal = parseFloat(inputs.ajusteCsll);
    }

    return {
      retencoesIR: parseFloat(inputs.retencoesIR || 0),
      retencoesCS: parseFloat(inputs.retencoesCS || 0),
      impostosDevolucaoManual: parseFloat(inputs.impostosDevolucao || 0),
      outrasReceitasManual: parseFloat(inputs.outrasReceitas || 0),
      ajusteIrpj: parseFloat(inputs.ajusteIrpj || 0),
      ajusteCsll: parseFloat(inputs.ajusteCsll || 0),
      recRevenda,
      recRevendaLiquida,
      devolucoes,
      impostosDevolucaoAuto: ipiDevolucao + icmsStDevolucao,
      ipi,
      icmsSt,
      recServico,
      baseRevendaIrpj,
      baseServicoIrpj,
      acrescimoIrpj,
      baseIrpj,
      baseRevendaCsll,
      baseServicoCsll,
      acrescimoCsll,
      baseCsll,
      irpjNormal,
      irpjAdicional,
      irpjTotal,
      csll,
      csllTotal,
      variacaoCambial,
      cambioBase,
      outrasReceitasDre: Math.max(0, outrasReceitasDre),
      outrasReceitasDreBreakdown,
      devolucoesBreakdown,
      ipiIcmsDevolucaoBreakdown,
      ipiVendasBreakdown,
      icmsStVendasBreakdown,
      recRevendaBreakdown,
      recServicoBreakdown
    };
  };

  const calcPresumido = () => {
    const isEstimativa = taxConfig[selectedComp] === 'real_anual';
    const hasAjusteIrpj = presumidoAjusteIrpj !== '' && presumidoAjusteIrpj !== undefined && presumidoAjusteIrpj !== null && presumidoAjusteIrpj !== 0 && presumidoAjusteIrpj !== '0' && presumidoAjusteIrpj !== '0.00' && presumidoAjusteIrpj !== '335.97838';
    const hasAjusteCsll = presumidoAjusteCsll !== '' && presumidoAjusteCsll !== undefined && presumidoAjusteCsll !== null && presumidoAjusteCsll !== 0 && presumidoAjusteCsll !== '0' && presumidoAjusteCsll !== '0.00';

    const currentInputs = {
      outrasReceitas: presumidoOutrasReceitas,
      cambioRealizado: presumidoCambioRealizado,
      retencoesIR: parseFloat(presumidoRetencoesIR || 0) + parseFloat(presumidoRetencoesIR_AppFin || 0),
      retencoesCS: presumidoRetencoesCS,
      impostosDevolucao: presumidoImpostosDevolucao,
      ajusteIrpj: hasAjusteIrpj ? presumidoAjusteIrpj : null,
      ajusteCsll: hasAjusteCsll ? presumidoAjusteCsll : null,
      majoracao: !isEstimativa && presumidoMajoracao
    };

    let startMonth = isEstimativa ? 1 : Math.floor((selectedMes - 1) / 3) * 3 + 1;
    
    // Get accumulated inputs from DB state
    let sumOutras = 0; let sumCambio = 0; let sumRetIR = 0; let sumRetCS = 0; let sumImpDev = 0; let sumIrpjPago = 0; let sumCsllPago = 0;
    let hasAnyAjusteIrpj = false;
    let hasAnyAjusteCsll = false;
    let sumMonthlyIrpj = 0;
    let sumMonthlyCsll = 0;

    for (let m = startMonth; m <= selectedMes; m++) {
      if (!dreRecordsByMonth[m]?.length) continue;
      const isCur = m === selectedMes;
      const key = `${selectedComp}_${selectedAno}_${m}`;
      const data = isCur ? {
        presumidoOutrasReceitas,
        presumidoCambioRealizado,
        presumidoRetencoesIR,
        presumidoRetencoesIR_AppFin,
        presumidoRetencoesCS,
        presumidoImpostosDevolucao,
        darfIrpjReduzido,
        darfCsllReduzida,
        presumidoAjusteIrpj: hasAjusteIrpj ? presumidoAjusteIrpj : '',
        presumidoAjusteCsll: hasAjusteCsll ? presumidoAjusteCsll : '',
        presumidoMajoracao
      } : (taxDataStore[key] || {});

      sumOutras += parseFloat(data.presumidoOutrasReceitas || 0);
      sumCambio += parseFloat(data.presumidoCambioRealizado || 0);
      sumRetIR += parseFloat(data.presumidoRetencoesIR || 0) + parseFloat(data.presumidoRetencoesIR_AppFin || 0);
      sumRetCS += parseFloat(data.presumidoRetencoesCS || 0);
      sumImpDev += parseFloat(data.presumidoImpostosDevolucao || 0);

      // DARF Efetivamente Pago / Declarado no mês
      if (data.darfIrpjReduzido !== undefined && data.darfIrpjReduzido !== '') {
        sumIrpjPago += parseFloat(data.darfIrpjReduzido || 0);
      }
      if (data.darfCsllReduzida !== undefined && data.darfCsllReduzida !== '') {
        sumCsllPago += parseFloat(data.darfCsllReduzida || 0);
      }

      const mInputs = {
        outrasReceitas: data.presumidoOutrasReceitas,
        cambioRealizado: data.presumidoCambioRealizado,
        retencoesIR: parseFloat(data.presumidoRetencoesIR || 0) + parseFloat(data.presumidoRetencoesIR_AppFin || 0),
        retencoesCS: data.presumidoRetencoesCS,
        impostosDevolucao: data.presumidoImpostosDevolucao,
        ajusteIrpj: isCur ? (hasAjusteIrpj ? presumidoAjusteIrpj : null) : (cleanAjuste(data.presumidoAjusteIrpj) || null),
        ajusteCsll: isCur ? (hasAjusteCsll ? presumidoAjusteCsll : null) : (cleanAjuste(data.presumidoAjusteCsll) || null),
        majoracao: !isEstimativa && (data.presumidoMajoracao !== undefined ? data.presumidoMajoracao : presumidoMajoracao)
      };

      const mRecords = dreRecordsByMonth[m] || [];
      const mCalc = calcPresumidoData(mRecords, 1, mInputs);

      if (mInputs.ajusteIrpj !== null && mInputs.ajusteIrpj !== undefined && mInputs.ajusteIrpj !== '') {
        hasAnyAjusteIrpj = true;
        sumMonthlyIrpj += parseFloat(mInputs.ajusteIrpj);
      } else {
        sumMonthlyIrpj += (mCalc.irpjTotal || 0);
      }

      if (mInputs.ajusteCsll !== null && mInputs.ajusteCsll !== undefined && mInputs.ajusteCsll !== '') {
        hasAnyAjusteCsll = true;
        sumMonthlyCsll += parseFloat(mInputs.ajusteCsll);
      } else {
        sumMonthlyCsll += (mCalc.csllTotal || 0);
      }
    }
    
    const acumuladoInputs = {
      outrasReceitas: sumOutras, cambioRealizado: sumCambio, retencoesIR: sumRetIR, retencoesCS: sumRetCS, impostosDevolucao: sumImpDev, majoracao: !isEstimativa && presumidoMajoracao
    };

    const mensal = calcPresumidoData(dreAcumulada.filter(r => r.mes === selectedMes), 1, currentInputs);
    const acumulado = calcPresumidoData(dreAcumulada, selectedMes - startMonth + 1, acumuladoInputs);
    
    if (hasAnyAjusteIrpj) {
      acumulado.irpjTotal = sumMonthlyIrpj;
    }
    if (hasAnyAjusteCsll) {
      acumulado.csllTotal = sumMonthlyCsll;
    }

    if (isEstimativa) {
      acumulado.irpjTotalPago = sumIrpjPago;
      acumulado.csllTotalPago = sumCsllPago;
    }
    
    return { mensal, acumulado };
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

    // Como o cálculo na tela do Lucro Real é mensal (base do mês dreMensal), o limite do adicional é de R$ 20.000/mês
    const limiteAdicional = 20000;

    let irpjNormal = 0;
    let irpjAdicional = 0;
    let csll = 0;

    if (baseAjustada > 0) {
      irpjNormal = baseAjustada * 0.15;
      irpjAdicional = Math.max(0, baseAjustada - limiteAdicional) * 0.10;
      csll = baseAjustada * 0.09;
    }

    let irpjTotal = irpjNormal + irpjAdicional - parseFloat(lalurRetencoesIR || 0) - parseFloat(lalurRetencoesIR_AppFin || 0);
    let csllTotal = csll - parseFloat(lalurRetencoesCS || 0);

    if (lalurAjusteIrpj !== undefined && lalurAjusteIrpj !== '') {
      irpjTotal = parseFloat(lalurAjusteIrpj);
    }
    if (lalurAjusteCsll !== undefined && lalurAjusteCsll !== '') {
      csllTotal = parseFloat(lalurAjusteCsll);
    }

    return { lair, baseCalculo, compensacao, baseAjustada, irpjNormal, irpjAdicional, irpjTotal, csll, csllTotal, variacaoCambial, equivalenciaPatrimonial, adicoesAuto, exclusoesAuto, adicoes, exclusoes };
  };


  const handleSaveInputsOnly = async () => {
    setIsProcessing(true);
    try {
      const calc = calcPresumido();
      const calcCM = calc.mensal;
      
      const finalDarfIrpj = (darfIrpjReduzido !== '' && darfIrpjReduzido !== undefined && darfIrpjReduzido !== null)
        ? darfIrpjReduzido
        : Math.max(0, calcCM.irpjTotal).toFixed(2);
      const finalDarfCsll = (darfCsllReduzida !== '' && darfCsllReduzida !== undefined && darfCsllReduzida !== null)
        ? darfCsllReduzida
        : Math.max(0, calcCM.csllTotal).toFixed(2);

      setDarfIrpjReduzido(finalDarfIrpj);
      setDarfCsllReduzida(finalDarfCsll);

      await persistTaxData(selectedComp, selectedAno, selectedMes, {
        lalurAdicoes, lalurExclusoes, lalurCompensacaoPrejuizo, lalurRetencoesIR, lalurRetencoesIR_AppFin, lalurRetencoesCS, lalurCambioRealizado, lalurAjusteIrpj, lalurAjusteCsll,
        presumidoRetencoesIR, presumidoRetencoesIR_AppFin, presumidoAjusteIrpj, presumidoAjusteCsll, presumidoRetencoesCS, presumidoOutrasReceitas, presumidoCambioRealizado, presumidoIpi, presumidoIcmsSt, presumidoMajoracao, presumidoImpostosDevolucao,
        darfIrpjReduzido: finalDarfIrpj,
        darfCsllReduzida: finalDarfCsll
      });
      window.$toast('Memória de cálculo salva e controle de DARF atualizado no acumulado!', { type: 'success' });
    } catch (e) {
      console.error(e);
      window.$toast('Erro ao salvar: ' + (e.message || ''), { type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const hasApuracao = useMemo(() => {
    if (!selectedComp) return false;
    return dreAnualTotal.some(r => r.mes === selectedMes && r.id?.startsWith('tax-dre-'));
  }, [selectedComp, selectedMes, dreAnualTotal]);

  const handleDeleteApuracao = async () => {
    if (!selectedComp) return;
    const mesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const mesNome = mesNomes[selectedMes - 1] || `Mês ${selectedMes}`;
    const compObj = companies.find(c => c.id === selectedComp);
    const compName = compObj?.name || selectedComp;

    const confirmed = await window.$confirm(
      `⚠️ Tem certeza que deseja EXCLUIR a apuração de IRPJ/CSLL de ${mesNome}/${selectedAno} para a empresa "${compName}"?\n\nEsta ação removerá as provisões tributárias lançadas na DRE e no Balanço Patrimonial deste mês.`,
      { title: 'Excluir Apuração', type: 'danger' }
    );
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      await Promise.all([
        supabase
          .from('dre_history')
          .delete()
          .eq('empresaId', selectedComp)
          .eq('ano', selectedAno)
          .eq('mes', selectedMes)
          .like('id', 'tax-%'),
        supabase
          .from('balanco_history')
          .delete()
          .eq('empresaId', selectedComp)
          .eq('ano', selectedAno)
          .eq('mes', selectedMes)
          .like('id', 'tax-%')
      ]);

      // Limpar memória de cálculo do mês no state e settings, PRESERVANDO a Variação Cambial
      const key = `${selectedComp}_${selectedAno}_${selectedMes}`;
      const currentEntry = taxDataStore[key] || {};
      const savedPresumidoCambio = currentEntry.presumidoCambioRealizado ?? 0;
      const savedLalurCambio = currentEntry.lalurCambioRealizado ?? 0;

      const newStore = { ...taxDataStore };
      if (savedPresumidoCambio || savedLalurCambio) {
        newStore[key] = {
          presumidoCambioRealizado: savedPresumidoCambio,
          lalurCambioRealizado: savedLalurCambio
        };
      } else {
        delete newStore[key];
      }
      setTaxDataStore(newStore);
      taxDataStoreRef.current = newStore;
      try {
        await saveSettings('agf_tax_store', newStore);
      } catch (e) {
        console.error(e);
      }

      // Resetar states locais de inputs
      setLalurAdicoes(0);
      setLalurExclusoes(0);
      setLalurCompensacaoPrejuizo(0);
      setLalurRetencoesIR(0);
      setLalurRetencoesIR_AppFin(0);
      setLalurRetencoesCS(0);
      setLalurCambioRealizado(savedLalurCambio);
      setLalurAjusteIrpj('');
      setLalurAjusteCsll('');

      setPresumidoRetencoesIR(0);
      setPresumidoRetencoesIR_AppFin(0);
      setPresumidoRetencoesCS(0);
      setPresumidoImpostosDevolucao('');
      setPresumidoAjusteIrpj('');
      setPresumidoAjusteCsll('');
      setPresumidoOutrasReceitas('');
      setPresumidoCambioRealizado(savedPresumidoCambio);
      setPresumidoIpi('');
      setPresumidoIcmsSt('');
      setPresumidoMajoracao(true);
      setDarfIrpjReduzido('');
      setDarfCsllReduzida('');

      await loadFinancialData();
      window.$toast(`Apuração de ${mesNome}/${selectedAno} excluída com sucesso!`, { type: 'success' });
    } catch (err) {
      console.error(err);
      window.$alert('Erro ao excluir apuração: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGravar = async (vIrpj, vCsll, vIrpjGross, vCsllGross) => {
    if (!selectedComp) { window.$alert('Selecione uma empresa.'); return; }
    
    setIsProcessing(true);
    try {
      // Salva os inputs no state/db
      await persistTaxData(selectedComp, selectedAno, selectedMes, {
        lalurAdicoes, lalurExclusoes, lalurCompensacaoPrejuizo, lalurRetencoesIR, lalurRetencoesIR_AppFin, lalurRetencoesCS, lalurCambioRealizado, lalurAjusteIrpj, lalurAjusteCsll,
        presumidoRetencoesIR, presumidoRetencoesIR_AppFin, presumidoAjusteIrpj, presumidoAjusteCsll, presumidoRetencoesCS, presumidoOutrasReceitas, presumidoCambioRealizado, presumidoIpi, presumidoIcmsSt, presumidoMajoracao, presumidoImpostosDevolucao, darfIrpjReduzido, darfCsllReduzida
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

      const irrfServicos = parseFloat(regime === 'presumido' ? presumidoRetencoesIR : lalurRetencoesIR) || 0;
      const irrfApp = parseFloat(regime === 'presumido' ? presumidoRetencoesIR_AppFin : lalurRetencoesIR_AppFin) || 0;
      const irrfTotalMes = irrfServicos + irrfApp;
      const csllRetida = parseFloat(regime === 'presumido' ? presumidoRetencoesCS : lalurRetencoesCS) || 0;

      const hasAjusteIrpjPresumido = regime === 'presumido' && cleanAjuste(presumidoAjusteIrpj) !== '';
      const hasAjusteCsllPresumido = regime === 'presumido' && cleanAjuste(presumidoAjusteCsll) !== '';
      const hasAjusteIrpjReal = regime !== 'presumido' && cleanAjuste(lalurAjusteIrpj) !== '';
      const hasAjusteCsllReal = regime !== 'presumido' && cleanAjuste(lalurAjusteCsll) !== '';

      let valorIrpjDreMes = 0;
      let valorCsllDreMes = 0;

      // DRE deve refletir a despesa BRUTA de IRPJ e CSLL devida no mês (sem deduzir as retenções na fonte)
      if (regime === 'presumido') {
        valorIrpjDreMes = hasAjusteIrpjPresumido 
          ? Math.max(0, parseFloat(cleanAjuste(presumidoAjusteIrpj)) + irrfTotalMes) 
          : Math.max(0, vIrpjGross - despesaDreIRAnterior);

        valorCsllDreMes = hasAjusteCsllPresumido 
          ? Math.max(0, parseFloat(cleanAjuste(presumidoAjusteCsll)) + csllRetida) 
          : Math.max(0, vCsllGross - despesaDreCSAnterior);
      } else {
        // Lucro Real: valor bruto do mês
        valorIrpjDreMes = hasAjusteIrpjReal
          ? Math.max(0, parseFloat(cleanAjuste(lalurAjusteIrpj)) + irrfTotalMes)
          : Math.max(0, vIrpjGross);

        valorCsllDreMes = hasAjusteCsllReal
          ? Math.max(0, parseFloat(cleanAjuste(lalurAjusteCsll)) + csllRetida)
          : Math.max(0, vCsllGross);
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

      // Passivo (2.1.1.6): recebe o valor LÍQUIDO A RECOLHER da DARF (com as retenções já abatidas)
      const ajusteBalancoIrpj = hasAjusteIrpjPresumido
        ? Math.max(0, parseFloat(cleanAjuste(presumidoAjusteIrpj)))
        : hasAjusteIrpjReal
        ? Math.max(0, parseFloat(cleanAjuste(lalurAjusteIrpj)))
        : (regime === 'presumido' || regime === 'real_trimestral')
        ? Math.max(0, vIrpj - passivoIRAnterior)
        : Math.max(0, vIrpj);

      const ajusteBalancoCsll = hasAjusteCsllPresumido
        ? Math.max(0, parseFloat(cleanAjuste(presumidoAjusteCsll)))
        : hasAjusteCsllReal
        ? Math.max(0, parseFloat(cleanAjuste(lalurAjusteCsll)))
        : (regime === 'presumido' || regime === 'real_trimestral')
        ? Math.max(0, vCsll - passivoCSAnterior)
        : Math.max(0, vCsll);

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

      // Ativo (1.1.1.5): desconta o crédito de retenção na fonte utilizado na apuração
      if (irrfServicos > 0) {
        balancoEntries.push({ id: 'tax-bal-ret-ir-serv-' + selectedComp + '-' + selectedAno + '-' + selectedMes, empresaId: selectedComp, ano: selectedAno, mes: selectedMes, trimestre: Math.ceil(selectedMes/3), tipo: 'ativo', conta: '1.1.1.5.01.00003', descricao: 'IRRF S/ PRESTACAO SERVICOS', saldoAcumulado: -irrfServicos });
      }

      if (irrfApp > 0) {
        balancoEntries.push({ id: 'tax-bal-ret-ir-app-' + selectedComp + '-' + selectedAno + '-' + selectedMes, empresaId: selectedComp, ano: selectedAno, mes: selectedMes, trimestre: Math.ceil(selectedMes/3), tipo: 'ativo', conta: '1.1.1.5.01.00001', descricao: 'IRRF S/ APLICACOES FINANCEIRAS', saldoAcumulado: -irrfApp });
      }

      if (csllRetida > 0) {
        balancoEntries.push({ id: 'tax-bal-ret-csll-' + selectedComp + '-' + selectedAno + '-' + selectedMes, empresaId: selectedComp, ano: selectedAno, mes: selectedMes, trimestre: Math.ceil(selectedMes/3), tipo: 'ativo', conta: '1.1.1.5.02.00003', descricao: 'CSLL RETIDA NA FONTE', saldoAcumulado: -csllRetida });
      }

      // Limpar lançamentos fiscais anteriores deste mês antes de gravar os novos (evita resquícios de retenções removidas)
      await Promise.all([
        supabase
          .from('dre_history')
          .delete()
          .eq('empresaId', selectedComp)
          .eq('ano', selectedAno)
          .eq('mes', selectedMes)
          .like('id', 'tax-%'),
        supabase
          .from('balanco_history')
          .delete()
          .eq('empresaId', selectedComp)
          .eq('ano', selectedAno)
          .eq('mes', selectedMes)
          .like('id', 'tax-%')
      ]);

      await bulkPutRecords('dre_history', dreEntries);
      await bulkPutRecords('balanco_history', balancoEntries);
      await loadFinancialData();
      window.$toast('Apuração gravada com sucesso! O Balanço e a DRE já foram atualizados.', { type: 'success' });
    } catch (err) {
      window.$alert('Erro ao gravar: ' + err.message);
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

    // Acumulados da DRE (provisões já lançadas no ano até o mês)
    const irpjDREAcumulado = dreAnualTotal
      .filter(r => r.mes <= selectedMes && (r.id?.startsWith("tax-dre-irpj-") || r.conta === '7' || r.conta === '5.1.1.1.01.00001'))
      .reduce((sum, r) => sum + Math.abs(r.valorMensal || 0), 0);

    const csllDREAcumulado = dreAnualTotal
      .filter(r => r.mes <= selectedMes && (r.id?.startsWith("tax-dre-csll-") || r.conta === '6' || r.conta === '5.1.1.1.01.00002'))
      .reduce((sum, r) => sum + Math.abs(r.valorMensal || 0), 0);

    const acumuladoRealIrpj = irpjDREAcumulado > 0 ? irpjDREAcumulado : Math.max(0, calcR.irpjTotal);
    const acumuladoRealCsll = csllDREAcumulado > 0 ? csllDREAcumulado : Math.max(0, calcR.csllTotal);
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
                  
                  const cInputsM = { 
                    outrasReceitas: parseFloat(data.presumidoOutrasReceitas || 0), 
                    cambioRealizado: parseFloat(data.presumidoCambioRealizado || 0), 
                    retencoesIR: parseFloat(data.presumidoRetencoesIR || 0) + parseFloat(data.presumidoRetencoesIR_AppFin || 0), 
                    retencoesCS: parseFloat(data.presumidoRetencoesCS || 0), 
                    impostosDevolucao: parseFloat(data.presumidoImpostosDevolucao || 0), 
                    ajusteIrpj: cleanAjuste(data.presumidoAjusteIrpj) || null, 
                    ajusteCsll: cleanAjuste(data.presumidoAjusteCsll) || null, 
                    majoracao: !isEstimativa && (data.presumidoMajoracao !== undefined ? data.presumidoMajoracao : true) 
                  };
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
                        const cInpA = { outrasReceitas: sumOutras, cambioRealizado: sumCambio, retencoesIR: sumRetIR, retencoesCS: sumRetCS, impostosDevolucao: sumImpDev, majoracao: !isEstimativa && (d.presumidoMajoracao !== undefined ? d.presumidoMajoracao : true) };
                        const calcP = calcPresumidoData(dreAnualTotal.filter(r => r.mes <= prevM), prevM, cInpA);
                        sumIrpjPagoPrev += Math.max(0, (calcP.irpjTotal || 0) - sumIrpjPagoPrev);
                      }
                      
                      if (d.darfCsllReduzida !== undefined && d.darfCsllReduzida !== '') {
                        sumCsllPagoPrev += parseFloat(d.darfCsllReduzida);
                      } else {
                        const cInpA = { outrasReceitas: sumOutras, cambioRealizado: sumCambio, retencoesIR: sumRetIR, retencoesCS: sumRetCS, impostosDevolucao: sumImpDev, majoracao: !isEstimativa && (d.presumidoMajoracao !== undefined ? d.presumidoMajoracao : true) };
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
                  const dreIrpjM = dreAnualTotal
                    .filter(r => r.mes <= m && (r.id?.startsWith("tax-dre-irpj-") || r.conta === '7' || r.conta === '5.1.1.1.01.00001'))
                    .reduce((sum, r) => sum + Math.abs(r.valorMensal || 0), 0);
                  const dreCsllM = dreAnualTotal
                    .filter(r => r.mes <= m && (r.id?.startsWith("tax-dre-csll-") || r.conta === '6' || r.conta === '5.1.1.1.01.00002'))
                    .reduce((sum, r) => sum + Math.abs(r.valorMensal || 0), 0);

                  const realIrpjAcum = dreIrpjM > 0 ? dreIrpjM : (irpjNormal + irpjAdicional - parseFloat(data.lalurRetencoesIR || 0) - parseFloat(data.lalurRetencoesIR_AppFin || 0));
                  const realCsllAcum = dreCsllM > 0 ? dreCsllM : (csll - parseFloat(data.lalurRetencoesCS || 0));
                  
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
              <input 
                type="text" 
                inputMode="decimal"
                className="text-input" 
                value={presumidoImpostosDevolucao} 
                onChange={e => setPresumidoImpostosDevolucao(e.target.value.replace(',', '.'))} 
                onPaste={e => handlePasteNumber(e, setPresumidoImpostosDevolucao, 'presumidoImpostosDevolucao')}
                onBlur={e => {
                  const cleaned = parseCurrencyInput(e.target.value);
                  setPresumidoImpostosDevolucao(cleaned);
                  persistTaxData(selectedComp, selectedAno, selectedMes, { presumidoImpostosDevolucao: cleaned });
                }}
                style={{ width: '100%' }} 
              />
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
              <Row label={isEstimativa ? "(+) Rendimentos, Juros e Ganhos (Extraído da DRE) [Passe o mouse]:" : "(+) Ganho de Capital, Juros e Descontos Obtidos (Extraído da DRE) [Passe o mouse]:"} m={cM.outrasReceitasDre} a={cA.outrasReceitasDre} color="#888" />
            </div>
            <div style={{ marginBottom: '1rem', marginTop: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(+) Rendimentos de Aplicações Financeiras (Resgates) - <b>Valor do Mês</b></label>
              <input 
                type="text" 
                inputMode="decimal"
                className="text-input" 
                value={presumidoOutrasReceitas} 
                onChange={e => setPresumidoOutrasReceitas(e.target.value.replace(',', '.'))} 
                onPaste={e => handlePasteNumber(e, setPresumidoOutrasReceitas, 'presumidoOutrasReceitas')}
                onBlur={e => {
                  const cleaned = parseCurrencyInput(e.target.value);
                  setPresumidoOutrasReceitas(cleaned);
                  persistTaxData(selectedComp, selectedAno, selectedMes, { presumidoOutrasReceitas: cleaned });
                }}
                placeholder="0.00"
                style={{ width: '100%' }} 
              />
              <span style={{ fontSize: '0.75rem', color: '#777', display: 'block', marginTop: '0.25rem' }}>
                Ganho de Capital, Juros e Descontos Obtidos já são apurados automaticamente da DRE acima.
              </span>
            </div>
            
            {cambioConfig[selectedComp] === 'caixa' ? (
              <div style={{ marginBottom: '1rem', marginTop: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#FFCA28', marginBottom: '0.3rem' }}>(+) Variação Cambial Realizada (Regime de Caixa) - <b>Valor do Mês</b></label>
                <input 
                  type="text" 
                  inputMode="decimal" 
                  className="text-input" 
                  value={presumidoCambioRealizado} 
                  onChange={e => setPresumidoCambioRealizado(e.target.value.replace(',', '.'))} 
                  onPaste={e => handlePasteNumber(e, setPresumidoCambioRealizado, 'presumidoCambioRealizado')}
                  onBlur={e => {
                    const cleaned = parseCurrencyInput(e.target.value);
                    setPresumidoCambioRealizado(cleaned);
                    persistTaxData(selectedComp, selectedAno, selectedMes, { presumidoCambioRealizado: cleaned, lalurCambioRealizado: cleaned });
                  }}
                  placeholder="0.00" 
                  style={{ width: '100%', borderColor: '#FFCA28' }} 
                />
              </div>
            ) : (
              <Row label="(+) Variação Cambial DRE (Competência):" m={cM.variacaoCambial > 0 ? cM.variacaoCambial : 0} a={cA.variacaoCambial > 0 ? cA.variacaoCambial : 0} color="#888" />
            )}

            {!isEstimativa && (
              <div style={{ marginTop: '1.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center' }}>
                <input type="checkbox" id="presumidoMajoracao" checked={presumidoMajoracao} onChange={e => { setPresumidoMajoracao(e.target.checked); persistTaxData(selectedComp, selectedAno, selectedMes, { presumidoMajoracao: e.target.checked }); }} style={{ marginRight: '0.5rem', transform: 'scale(1.2)' }} />
                <label htmlFor="presumidoMajoracao" style={{ color: '#ddd', fontSize: '0.9rem', cursor: 'pointer' }}>Aplicar majoração de 10% sobre a presunção (Lei 2026)</label>
              </div>
            )}

            <div style={{ marginTop: '1.5rem' }}>
               {((cM.acrescimoIrpj || 0) > 0 || (cA.acrescimoIrpj || 0) > 0) && (
                 <Row label="(+) Majoração IRPJ (10% s/ Presunção - LC 224):" m={cM.acrescimoIrpj} a={cA.acrescimoIrpj} color="#FFCA28" />
               )}
               {((cM.acrescimoCsll || 0) > 0 || (cA.acrescimoCsll || 0) > 0) && (
                 <Row label="(+) Majoração CSLL (10% s/ Presunção - LC 224):" m={cM.acrescimoCsll} a={cA.acrescimoCsll} color="#FFCA28" />
               )}
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
              <input 
                type="text" 
                inputMode="decimal"
                className="text-input" 
                value={presumidoRetencoesIR} 
                onChange={e => setPresumidoRetencoesIR(e.target.value.replace(',', '.'))} 
                onPaste={e => handlePasteNumber(e, setPresumidoRetencoesIR, 'presumidoRetencoesIR')}
                onBlur={e => {
                  const cleaned = parseCurrencyInput(e.target.value);
                  setPresumidoRetencoesIR(cleaned);
                  persistTaxData(selectedComp, selectedAno, selectedMes, { presumidoRetencoesIR: cleaned });
                }}
                style={{ width: '100%' }} 
              />
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginTop: '1rem', marginBottom: '0.3rem' }}>(-) IRRF s/ Aplicações - <b>Valor do Mês</b></label>
              <input 
                type="text" 
                inputMode="decimal"
                className="text-input" 
                value={presumidoRetencoesIR_AppFin} 
                onChange={e => setPresumidoRetencoesIR_AppFin(e.target.value.replace(',', '.'))} 
                onPaste={e => handlePasteNumber(e, setPresumidoRetencoesIR_AppFin, 'presumidoRetencoesIR_AppFin')}
                onBlur={e => {
                  const cleaned = parseCurrencyInput(e.target.value);
                  setPresumidoRetencoesIR_AppFin(cleaned);
                  persistTaxData(selectedComp, selectedAno, selectedMes, { presumidoRetencoesIR_AppFin: cleaned });
                }}
                style={{ width: '100%' }} 
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.6rem', marginBottom: '0.6rem', background: 'rgba(255, 193, 7, 0.08)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(255, 193, 7, 0.25)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', color: '#FFD54F', fontWeight: 'bold' }}>
                  ✅ Valor Exato da Apuração IRPJ (R$):
                </label>
                <span style={{ fontSize: '0.74rem', color: '#aaa' }}>Se preenchido, este valor substituirá o cálculo automático</span>
              </div>
              <input 
                type="text" 
                inputMode="decimal"
                className="text-input" 
                value={presumidoAjusteIrpj} 
                onChange={e => setPresumidoAjusteIrpj(e.target.value.replace(',', '.'))} 
                onPaste={e => handlePasteNumber(e, setPresumidoAjusteIrpj, 'presumidoAjusteIrpj')}
                onBlur={e => {
                  const cleaned = parseCurrencyInput(e.target.value);
                  setPresumidoAjusteIrpj(cleaned);
                  persistTaxData(selectedComp, selectedAno, selectedMes, { presumidoAjusteIrpj: cleaned });
                }}
                placeholder="0.00" 
                style={{ width: '130px', textAlign: 'right', borderColor: '#FFD54F', color: '#FFD54F', fontWeight: 'bold', background: '#1c1c24' }} 
              />
            </div>

            <Row label="IRPJ DEVIDO CALCULADO (FINAL):" m={Math.max(0, cM.irpjTotal)} a={Math.max(0, cA.irpjTotal)} color="#81C784" bold={true} />
            
            {isEstimativa && (
              <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#fff' }}>✏️ <b>Ajuste de Suspensão/Redução: IRPJ Pago no Mês</b> (Para controle anual)</label>
                  {darfIrpjReduzido === '' && (
                    <button 
                      type="button" 
                      onClick={() => {
                        const val = Math.max(0, cM.irpjTotal).toFixed(2);
                        setDarfIrpjReduzido(val);
                        persistTaxData(selectedComp, selectedAno, selectedMes, { darfIrpjReduzido: val });
                      }}
                      style={{ fontSize: '0.75rem', background: 'rgba(129, 199, 132, 0.2)', border: '1px solid #81C784', color: '#81C784', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer' }}
                    >
                      Preencher Padrão ({Math.max(0, cM.irpjTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                    </button>
                  )}
                </div>
                <input 
                  type="text" 
                  inputMode="decimal"
                  className="text-input" 
                  value={darfIrpjReduzido} 
                  onChange={e => setDarfIrpjReduzido(e.target.value.replace(',', '.'))} 
                  onPaste={e => handlePasteNumber(e, setDarfIrpjReduzido, 'darfIrpjReduzido')}
                  onBlur={e => {
                    const cleaned = parseCurrencyInput(e.target.value);
                    setDarfIrpjReduzido(cleaned);
                    persistTaxData(selectedComp, selectedAno, selectedMes, { darfIrpjReduzido: cleaned });
                  }}
                  style={{ width: '100%', borderColor: '#81C784' }} 
                  placeholder={`Valor Padrão: ${Math.max(0, cM.irpjTotal).toFixed(2)}`} 
                />
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#aaa' }}>Acumulado Efetivamente Pago: {(cA.irpjTotalPago || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</div>
              </div>
            )}


            <div style={{ marginTop: '1.5rem' }}>
               <Row label="CSLL Normal (9%):" m={cM.csll} a={cA.csll} />
            </div>

            <div style={{ marginBottom: '1rem', marginTop: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(-) CSLL Retida - <b>Valor do Mês</b></label>
              <input 
                type="text" 
                inputMode="decimal"
                className="text-input" 
                value={presumidoRetencoesCS} 
                onChange={e => setPresumidoRetencoesCS(e.target.value.replace(',', '.'))} 
                onPaste={e => handlePasteNumber(e, setPresumidoRetencoesCS, 'presumidoRetencoesCS')}
                onBlur={e => {
                  const cleaned = parseCurrencyInput(e.target.value);
                  setPresumidoRetencoesCS(cleaned);
                  persistTaxData(selectedComp, selectedAno, selectedMes, { presumidoRetencoesCS: cleaned });
                }}
                style={{ width: '100%' }} 
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.6rem', marginBottom: '0.6rem', background: 'rgba(255, 193, 7, 0.08)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(255, 193, 7, 0.25)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', color: '#FFD54F', fontWeight: 'bold' }}>
                  ✅ Valor Exato da Apuração CSLL (R$):
                </label>
                <span style={{ fontSize: '0.74rem', color: '#aaa' }}>Se preenchido, este valor substituirá o cálculo automático</span>
              </div>
              <input 
                type="text" 
                inputMode="decimal"
                className="text-input" 
                value={presumidoAjusteCsll} 
                onChange={e => setPresumidoAjusteCsll(e.target.value.replace(',', '.'))} 
                onPaste={e => handlePasteNumber(e, setPresumidoAjusteCsll, 'presumidoAjusteCsll')}
                onBlur={e => {
                  const cleaned = parseCurrencyInput(e.target.value);
                  setPresumidoAjusteCsll(cleaned);
                  persistTaxData(selectedComp, selectedAno, selectedMes, { presumidoAjusteCsll: cleaned });
                }}
                placeholder="0.00" 
                style={{ width: '130px', textAlign: 'right', borderColor: '#FFD54F', color: '#FFD54F', fontWeight: 'bold', background: '#1c1c24' }} 
              />
            </div>

            <Row label="CSLL DEVIDA CALCULADA (FINAL):" m={Math.max(0, cM.csllTotal)} a={Math.max(0, cA.csllTotal)} color="#81C784" bold={true} />
            {isEstimativa && (
              <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#fff' }}>✏️ <b>Ajuste de Suspensão/Redução: CSLL Paga no Mês</b> (Para controle anual)</label>
                  {darfCsllReduzida === '' && (
                    <button 
                      type="button" 
                      onClick={() => {
                        const val = Math.max(0, cM.csllTotal).toFixed(2);
                        setDarfCsllReduzida(val);
                        persistTaxData(selectedComp, selectedAno, selectedMes, { darfCsllReduzida: val });
                      }}
                      style={{ fontSize: '0.75rem', background: 'rgba(129, 199, 132, 0.2)', border: '1px solid #81C784', color: '#81C784', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer' }}
                    >
                      Preencher Padrão ({Math.max(0, cM.csllTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                    </button>
                  )}
                </div>
                <input 
                  type="text" 
                  inputMode="decimal"
                  className="text-input" 
                  value={darfCsllReduzida} 
                  onChange={e => setDarfCsllReduzida(e.target.value.replace(',', '.'))} 
                  onPaste={e => handlePasteNumber(e, setDarfCsllReduzida, 'darfCsllReduzida')}
                  onBlur={e => {
                    const cleaned = parseCurrencyInput(e.target.value);
                    setDarfCsllReduzida(cleaned);
                    persistTaxData(selectedComp, selectedAno, selectedMes, { darfCsllReduzida: cleaned });
                  }}
                  style={{ width: '100%', borderColor: '#81C784' }} 
                  placeholder={`Valor Padrão: ${Math.max(0, cM.csllTotal).toFixed(2)}`} 
                />
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#aaa' }}>Acumulado Efetivamente Pago: {(cA.csllTotalPago || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</div>
              </div>
            )}
            </div>

</div>

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {hasApuracao && (
              <button 
                type="button"
                className="btn-secondary" 
                onClick={handleDeleteApuracao} 
                style={{ padding: '0.9rem 1.8rem', fontSize: '1rem', borderColor: '#f44336', color: '#ff6b6b', background: 'rgba(244, 67, 54, 0.1)', cursor: 'pointer', fontWeight: 600 }} 
                disabled={isProcessing}
                title="Excluir lançamentos da DRE e Balanço deste mês"
              >
                🗑️ Excluir Apuração deste Mês
              </button>
            )}
            <button 
              type="button"
              className="btn-secondary" 
              onClick={handleSaveInputsOnly} 
              style={{ padding: '1rem 1.8rem', fontSize: '1rem', cursor: 'pointer', fontWeight: 600, border: '1px solid #64B5F6', color: '#64B5F6', background: 'rgba(33, 150, 243, 0.1)' }} 
              disabled={isProcessing}
              title="Salvar apenas a memória de cálculo digitada (retenções, receitas manuais, etc.) sem lançar no Balanço"
            >
              💾 Salvar Memória de Cálculo
            </button>
            {!isEstimativa && (
              <button className="btn-primary" onClick={() => handleGravar(cA.irpjTotal, cA.csllTotal, cA.irpjNormal + cA.irpjAdicional, cA.csll)} style={{ padding: '1rem 2rem', fontSize: '1.1rem' }} disabled={isProcessing}>
                  {isProcessing ? 'Gravando...' : '💾 Lançar Apuração no DRE e Balanço'}
              </button>
            )}
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
    const isCaixa = cambioConfig[selectedComp] === 'caixa';

    const calcForMonth = (m) => {
        let inputs = {};
        if (m === selectedMes) {
            inputs = {
                outrasReceitas: presumidoOutrasReceitas,
                cambioRealizado: presumidoCambioRealizado,
                retencoesIR: parseFloat(presumidoRetencoesIR || 0) + parseFloat(presumidoRetencoesIR_AppFin || 0),
                retencoesCS: presumidoRetencoesCS,
                impostosDevolucao: presumidoImpostosDevolucao,
                ajusteIrpj: cleanAjuste(presumidoAjusteIrpj) || null,
                ajusteCsll: cleanAjuste(presumidoAjusteCsll) || null,
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
                ajusteIrpj: cleanAjuste(data.presumidoAjusteIrpj) || null,
                ajusteCsll: cleanAjuste(data.presumidoAjusteCsll) || null,
                majoracao: data.presumidoMajoracao !== undefined ? data.presumidoMajoracao : true
            };
        }
        return calcPresumidoData(dreRecordsByMonth[m] || [], 1, inputs);
    };

    const calcQuarter = (t) => {
      const qMonths = [(t - 1) * 3 + 1, (t - 1) * 3 + 2, (t - 1) * 3 + 3];
      const monthDataList = qMonths.map(m => calcForMonth(m));
      let qOutras = 0;
      let qCambio = 0;
      let qRetIR = 0;
      let qRetCS = 0;
      let qImpDev = 0;
      let hasAjusteIrpjQ = false;
      let totalAjusteIrpjQ = 0;
      let hasAjusteCsllQ = false;
      let totalAjusteCsllQ = 0;

      qMonths.forEach(m => {
        const inp = (m === selectedMes) ? {
          outrasReceitas: presumidoOutrasReceitas,
          cambioRealizado: presumidoCambioRealizado,
          retencoesIR: parseFloat(presumidoRetencoesIR || 0) + parseFloat(presumidoRetencoesIR_AppFin || 0),
          retencoesCS: presumidoRetencoesCS,
          impostosDevolucao: presumidoImpostosDevolucao,
          ajusteIrpj: cleanAjuste(presumidoAjusteIrpj),
          ajusteCsll: cleanAjuste(presumidoAjusteCsll),
        } : (() => {
          const k = `${selectedComp}_${selectedAno}_${m}`;
          const d = taxDataStore[k] || {};
          return {
            outrasReceitas: d.presumidoOutrasReceitas,
            cambioRealizado: d.presumidoCambioRealizado,
            retencoesIR: parseFloat(d.presumidoRetencoesIR || 0) + parseFloat(d.presumidoRetencoesIR_AppFin || 0),
            retencoesCS: d.presumidoRetencoesCS,
            impostosDevolucao: d.presumidoImpostosDevolucao,
            ajusteIrpj: cleanAjuste(d.presumidoAjusteIrpj),
            ajusteCsll: cleanAjuste(d.presumidoAjusteCsll),
          };
        })();

        qOutras += parseFloat(inp.outrasReceitas || 0);
        qCambio += parseFloat(inp.cambioRealizado || 0);
        qRetIR += parseFloat(inp.retencoesIR || 0);
        qRetCS += parseFloat(inp.retencoesCS || 0);
        qImpDev += parseFloat(inp.impostosDevolucao || 0);
        if (inp.ajusteIrpj !== null && inp.ajusteIrpj !== undefined && inp.ajusteIrpj !== '') {
          hasAjusteIrpjQ = true;
          totalAjusteIrpjQ += parseFloat(inp.ajusteIrpj);
        }
        if (inp.ajusteCsll !== null && inp.ajusteCsll !== undefined && inp.ajusteCsll !== '') {
          hasAjusteCsllQ = true;
          totalAjusteCsllQ += parseFloat(inp.ajusteCsll);
        }
      });

      const monthsWithData = qMonths.filter(m => (dreRecordsByMonth[m]?.length || 0) > 0);
      const numMesesTrim = Math.max(1, monthsWithData.length);

      const trimInputs = {
        outrasReceitas: qOutras,
        cambioRealizado: qCambio,
        retencoesIR: qRetIR,
        retencoesCS: qRetCS,
        impostosDevolucao: qImpDev,
        ajusteIrpj: hasAjusteIrpjQ ? totalAjusteIrpjQ : null,
        ajusteCsll: hasAjusteCsllQ ? totalAjusteCsllQ : null,
        majoracao: presumidoMajoracao
      };

      const qRecords = qMonths.flatMap(m => dreRecordsByMonth[m] || []);
      const cTotal = calcPresumidoData(
        qRecords,
        numMesesTrim,
        trimInputs
      );

      if (hasAjusteIrpjQ) {
        cTotal.irpjTotal = monthDataList.reduce((acc, cm) => acc + (cm.ajusteIrpj || cm.irpjTotal || 0), 0);
        cTotal.ajusteIrpj = totalAjusteIrpjQ;
      }
      if (hasAjusteCsllQ) {
        cTotal.csllTotal = monthDataList.reduce((acc, cm) => acc + (cm.ajusteCsll || cm.csllTotal || 0), 0);
        cTotal.ajusteCsll = totalAjusteCsllQ;
      }

      return cTotal;
    };

    const sumObjects = (objList) => {
      const keys = [
        'recRevenda', 'recServico', 'devolucoes', 'impostosDevolucaoAuto', 'impostosDevolucaoManual',
        'ipi', 'icmsSt', 'recRevendaLiquida', 'outrasReceitasManual', 'outrasReceitasDre', 'cambioBase',
        'variacaoCambial', 'baseRevendaIrpj', 'baseServicoIrpj', 'acrescimoIrpj', 'baseIrpj',
        'irpjNormal', 'irpjAdicional', 'retencoesIR', 'ajusteIrpj', 'irpjTotal',
        'baseRevendaCsll', 'baseServicoCsll', 'acrescimoCsll', 'baseCsll', 'csll',
        'retencoesCS', 'ajusteCsll', 'csllTotal'
      ];
      const tot = {};
      keys.forEach(k => {
        tot[k] = objList.reduce((acc, o) => acc + (o[k] || 0), 0);
      });
      tot.recRevendaBreakdown = [...new Set(objList.flatMap(o => o.recRevendaBreakdown || []))];
      tot.recServicoBreakdown = [...new Set(objList.flatMap(o => o.recServicoBreakdown || []))];
      tot.devolucoesBreakdown = [...new Set(objList.flatMap(o => o.devolucoesBreakdown || []))];
      tot.ipiIcmsDevolucaoBreakdown = [...new Set(objList.flatMap(o => o.ipiIcmsDevolucaoBreakdown || []))];
      tot.ipiVendasBreakdown = [...new Set(objList.flatMap(o => o.ipiVendasBreakdown || []))];
      tot.icmsStVendasBreakdown = [...new Set(objList.flatMap(o => o.icmsStVendasBreakdown || []))];
      tot.outrasReceitasDreBreakdown = [...new Set(objList.flatMap(o => o.outrasReceitasDreBreakdown || []))];
      return tot;
    };

    let columns = [];
    let summaryCol = null;
    let tableTitle = '';

    if (resumoVisao === 'ano_trimestres') {
      const q1 = calcQuarter(1);
      const q2 = calcQuarter(2);
      const q3 = calcQuarter(3);
      const q4 = calcQuarter(4);
      const qAno = sumObjects([q1, q2, q3, q4]);

      columns = [
        { label: '1º Trimestre (Jan-Mar)', data: q1 },
        { label: '2º Trimestre (Abr-Jun)', data: q2 },
        { label: '3º Trimestre (Jul-Set)', data: q3 },
        { label: '4º Trimestre (Out-Dez)', data: q4 },
      ];
      summaryCol = { label: `Total do Ano ${selectedAno}`, data: qAno };
      tableTitle = `📅 RESUMO DA APURAÇÃO ANUAL - POR TRIMESTRE (${selectedAno})`;
    } else if (resumoVisao === 'ano_meses') {
      const allMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const monthCols = allMonths.map(m => ({ label: monthNames[m - 1], data: calcForMonth(m) }));
      const q1 = calcQuarter(1);
      const q2 = calcQuarter(2);
      const q3 = calcQuarter(3);
      const q4 = calcQuarter(4);
      const qAno = sumObjects([q1, q2, q3, q4]);

      columns = monthCols;
      summaryCol = { label: `Total do Ano ${selectedAno}`, data: qAno };
      tableTitle = `🗓️ RESUMO DA APURAÇÃO ANUAL - MÊS A MÊS (${selectedAno})`;
    } else {
      const c1 = calcForMonth(months[0]);
      const c2 = calcForMonth(months[1]);
      const c3 = calcForMonth(months[2]);
      const cTotal = calcQuarter(trimNum);

      columns = [
        { label: monthNames[months[0] - 1], data: c1 },
        { label: monthNames[months[1] - 1], data: c2 },
        { label: monthNames[months[2] - 1], data: c3 },
      ];
      summaryCol = { label: `Total do ${trimNum}º Trimestre`, data: cTotal };
      tableTitle = `📊 RESUMO DO ${trimNum}º TRIMESTRE (${monthNames[months[0]-1]} a ${monthNames[months[2]-1]})`;
    }

    const fmt = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    return (
      <div style={{ marginTop: "2rem", paddingTop: "2rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        {/* Seletor de Visão do Resumo */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
          <button 
            type="button"
            onClick={() => setResumoVisao('trimestre')}
            style={{
              padding: '0.55rem 1.3rem',
              borderRadius: '24px',
              border: '1px solid ' + (resumoVisao === 'trimestre' ? '#64B5F6' : '#444'),
              background: resumoVisao === 'trimestre' ? 'rgba(33, 150, 243, 0.25)' : 'rgba(255, 255, 255, 0.04)',
              color: resumoVisao === 'trimestre' ? '#fff' : '#aaa',
              fontWeight: resumoVisao === 'trimestre' ? 'bold' : 'normal',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: resumoVisao === 'trimestre' ? '0 0 10px rgba(33, 150, 243, 0.3)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            📊 {trimNum}º Trimestre ({monthNames[months[0]-1]} a {monthNames[months[2]-1]})
          </button>
          <button 
            type="button"
            onClick={() => setResumoVisao('ano_trimestres')}
            style={{
              padding: '0.55rem 1.3rem',
              borderRadius: '24px',
              border: '1px solid ' + (resumoVisao === 'ano_trimestres' ? '#64B5F6' : '#444'),
              background: resumoVisao === 'ano_trimestres' ? 'rgba(33, 150, 243, 0.25)' : 'rgba(255, 255, 255, 0.04)',
              color: resumoVisao === 'ano_trimestres' ? '#fff' : '#aaa',
              fontWeight: resumoVisao === 'ano_trimestres' ? 'bold' : 'normal',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: resumoVisao === 'ano_trimestres' ? '0 0 10px rgba(33, 150, 243, 0.3)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            📅 Resumo do Ano {selectedAno} (Por Trimestre)
          </button>
          <button 
            type="button"
            onClick={() => setResumoVisao('ano_meses')}
            style={{
              padding: '0.55rem 1.3rem',
              borderRadius: '24px',
              border: '1px solid ' + (resumoVisao === 'ano_meses' ? '#64B5F6' : '#444'),
              background: resumoVisao === 'ano_meses' ? 'rgba(33, 150, 243, 0.25)' : 'rgba(255, 255, 255, 0.04)',
              color: resumoVisao === 'ano_meses' ? '#fff' : '#aaa',
              fontWeight: resumoVisao === 'ano_meses' ? 'bold' : 'normal',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: resumoVisao === 'ano_meses' ? '0 0 10px rgba(33, 150, 243, 0.3)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            🗓️ Resumo do Ano {selectedAno} (Mês a Mês)
          </button>
        </div>

        <h4 style={{ color: "#fff", marginBottom: "0.5rem", textAlign: "center" }}>{tableTitle}</h4>
        <p style={{ textAlign: "center", color: "#aaa", fontSize: "0.8rem", marginBottom: "1rem" }}>
          💡 Passe o mouse sobre os valores de Vendas, Serviços, Devoluções ou Deduções para ver as contas contábeis correspondentes da DRE.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "center" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.4)", color: "#ccc" }}>
                <th style={{ padding: "8px", border: "1px solid #444", textAlign: "left" }}>Indicador</th>
                {columns.map((col, idx) => (
                  <th key={idx} style={{ padding: "8px", border: "1px solid #444" }}>{col.label}</th>
                ))}
                <th style={{ padding: "8px", border: "1px solid #444", color: "#64B5F6" }}>{summaryCol.label}</th>
              </tr>
            </thead>
            <tbody>
              {/* 1. RECEITAS BRUTAS */}
              <tr style={{ background: "rgba(255, 255, 255, 0.03)" }}>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", fontWeight: "bold", color: "#64B5F6" }} colSpan={columns.length + 2}>
                  1. RECEITAS OPERACIONAIS BRUTAS
                </td>
              </tr>
              <tr>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem" }} title="Vendas de Mercadorias e Produtos (Presunção de 8% IRPJ / 12% CSLL)">
                  (+) Receita de Vendas / Revenda (Comércio)
                </td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444" }} title={(col.data.recRevendaBreakdown || []).join('\n')}>{fmt(col.data.recRevenda)}</td>
                ))}
                <td style={{ border: "1px solid #444", fontWeight: "bold" }} title={(summaryCol.data.recRevendaBreakdown || []).join('\n')}>{fmt(summaryCol.data.recRevenda)}</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem" }} title="Prestação de Serviços (Presunção de 32% IRPJ / 32% CSLL)">
                  (+) Receita de Prestação de Serviços
                </td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444" }} title={(col.data.recServicoBreakdown || []).join('\n')}>{fmt(col.data.recServico)}</td>
                ))}
                <td style={{ border: "1px solid #444", fontWeight: "bold" }} title={(summaryCol.data.recServicoBreakdown || []).join('\n')}>{fmt(summaryCol.data.recServico)}</td>
              </tr>
              <tr style={{ background: "rgba(33, 150, 243, 0.08)", fontWeight: "bold" }}>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left" }}>
                  (=) Total da Receita Operacional Bruta
                </td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444" }}>{fmt(col.data.recRevenda + col.data.recServico)}</td>
                ))}
                <td style={{ border: "1px solid #444", color: "#64B5F6" }}>{fmt(summaryCol.data.recRevenda + summaryCol.data.recServico)}</td>
              </tr>

              {/* 2. DEDUÇÕES DA RECEITA DE VENDAS */}
              <tr style={{ background: "rgba(255, 255, 255, 0.03)" }}>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", fontWeight: "bold", color: "#EF9A9A" }} colSpan={columns.length + 2}>
                  2. DEDUÇÕES E IMPOSTOS S/ VENDAS
                </td>
              </tr>
              <tr>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem", color: "#FF5252" }}>
                  (-) Devoluções de Vendas
                </td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444" }} title={(col.data.devolucoesBreakdown || []).join('\n')}>{fmt(col.data.devolucoes)}</td>
                ))}
                <td style={{ border: "1px solid #444", fontWeight: "bold" }} title={(summaryCol.data.devolucoesBreakdown || []).join('\n')}>{fmt(summaryCol.data.devolucoes)}</td>
              </tr>
              {(summaryCol.data.impostosDevolucaoAuto > 0 || summaryCol.data.impostosDevolucaoManual > 0) && (
                <tr>
                  <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem", color: "#FFCA28" }}>
                    (+) IPI e ICMS ST s/ Devolução (Estorno)
                  </td>
                  {columns.map((col, idx) => (
                    <td key={idx} style={{ border: "1px solid #444" }} title={(col.data.ipiIcmsDevolucaoBreakdown || []).join('\n')}>{fmt(col.data.impostosDevolucaoAuto + (col.data.impostosDevolucaoManual || 0))}</td>
                  ))}
                  <td style={{ border: "1px solid #444", fontWeight: "bold" }}>{fmt(summaryCol.data.impostosDevolucaoAuto + (summaryCol.data.impostosDevolucaoManual || 0))}</td>
                </tr>
              )}
              {summaryCol.data.ipi > 0 && (
                <tr>
                  <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem", color: "#FF5252" }}>
                    (-) IPI sobre Vendas
                  </td>
                  {columns.map((col, idx) => (
                    <td key={idx} style={{ border: "1px solid #444" }} title={(col.data.ipiVendasBreakdown || []).join('\n')}>{fmt(col.data.ipi)}</td>
                  ))}
                  <td style={{ border: "1px solid #444", fontWeight: "bold" }}>{fmt(summaryCol.data.ipi)}</td>
                </tr>
              )}
              {summaryCol.data.icmsSt > 0 && (
                <tr>
                  <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem", color: "#FF5252" }}>
                    (-) ICMS ST sobre Vendas
                  </td>
                  {columns.map((col, idx) => (
                    <td key={idx} style={{ border: "1px solid #444" }} title={(col.data.icmsStVendasBreakdown || []).join('\n')}>{fmt(col.data.icmsSt)}</td>
                  ))}
                  <td style={{ border: "1px solid #444", fontWeight: "bold" }}>{fmt(summaryCol.data.icmsSt)}</td>
                </tr>
              )}
              <tr style={{ background: "rgba(255, 255, 255, 0.02)", fontWeight: "bold" }}>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left" }}>
                  (=) Receita Líquida de Vendas (Base p/ 8% e 12%)
                </td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444" }}>{fmt(col.data.recRevendaLiquida)}</td>
                ))}
                <td style={{ border: "1px solid #444" }}>{fmt(summaryCol.data.recRevendaLiquida)}</td>
              </tr>

              {/* 3. DEMAIS RECEITAS */}
              <tr style={{ background: "rgba(255, 255, 255, 0.03)" }}>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", fontWeight: "bold", color: "#FFE082" }} colSpan={columns.length + 2}>
                  3. DEMAIS RECEITAS (Tributadas a 100%)
                </td>
              </tr>
              <tr>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem" }}>
                  (+) Rendimentos, Ganhos de Capital e Outras Receitas
                </td>
                {columns.map((col, idx) => {
                  const bList = [
                    ...(col.data.outrasReceitasManual > 0 ? [`Rendimentos Aplicações (Manual): ${fmt(col.data.outrasReceitasManual)}`] : []),
                    ...(col.data.outrasReceitasDreBreakdown || [])
                  ];
                  return (
                    <td key={idx} style={{ border: "1px solid #444" }} title={bList.join('\n')}>{fmt((col.data.outrasReceitasManual || 0) + col.data.outrasReceitasDre)}</td>
                  );
                })}
                <td style={{ border: "1px solid #444", fontWeight: "bold" }} title={[
                  ...(summaryCol.data.outrasReceitasManual > 0 ? [`Total Rendimentos Aplicações (Manual): ${fmt(summaryCol.data.outrasReceitasManual)}`] : []),
                  ...(summaryCol.data.outrasReceitasDreBreakdown || [])
                ].join('\n')}>{fmt((summaryCol.data.outrasReceitasManual || 0) + summaryCol.data.outrasReceitasDre)}</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem" }} title="Apenas variações cambiais tributáveis (positivas na competência ou realizadas no caixa) compõem a base">
                  {isCaixa ? '(+) Variação Cambial Realizada (Caixa)' : '(+) Variação Cambial Tributável (Competência)'}
                </td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444" }} title={col.data.variacaoCambial !== 0 ? `Variação Cambial DRE: ${fmt(col.data.variacaoCambial)}` : undefined}>{fmt(col.data.cambioBase)}</td>
                ))}
                <td style={{ border: "1px solid #444", fontWeight: "bold" }} title={summaryCol.data.variacaoCambial !== 0 ? `Variação Cambial DRE Total: ${fmt(summaryCol.data.variacaoCambial)}` : undefined}>{fmt(summaryCol.data.cambioBase)}</td>
              </tr>

              {/* 4. APURAÇÃO DO IRPJ */}
              <tr style={{ background: "rgba(255, 255, 255, 0.03)" }}>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", fontWeight: "bold", color: "#A5D6A7" }} colSpan={columns.length + 2}>
                  4. APURAÇÃO DO IRPJ
                </td>
              </tr>
              <tr>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem", color: "#bbb" }}>
                  ↳ Base Presumida de Vendas (8% s/ Rec. Líquida)
                </td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444", color: "#bbb" }}>{fmt(col.data.baseRevendaIrpj)}</td>
                ))}
                <td style={{ border: "1px solid #444", color: "#bbb" }}>{fmt(summaryCol.data.baseRevendaIrpj)}</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem", color: "#bbb" }}>
                  ↳ Base Presumida de Serviços (32% s/ Serviços)
                </td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444", color: "#bbb" }}>{fmt(col.data.baseServicoIrpj)}</td>
                ))}
                <td style={{ border: "1px solid #444", color: "#bbb" }}>{fmt(summaryCol.data.baseServicoIrpj)}</td>
              </tr>
              {(summaryCol.data.acrescimoIrpj > 0) && (
                <tr>
                  <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem", color: "#FFCA28" }}>
                    ↳ (+) Majoração de 10% (Lei 2026 - Excesso de R$ 1,25M)
                  </td>
                  {columns.map((col, idx) => (
                    <td key={idx} style={{ border: "1px solid #444", color: "#FFCA28" }}>{fmt(col.data.acrescimoIrpj)}</td>
                  ))}
                  <td style={{ border: "1px solid #444", color: "#FFCA28", fontWeight: "bold" }}>{fmt(summaryCol.data.acrescimoIrpj)}</td>
                </tr>
              )}
              <tr style={{ background: "rgba(255, 255, 255, 0.05)", fontWeight: "bold" }}>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left" }}>Base de Cálculo Total IRPJ</td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444" }}>{fmt(col.data.baseIrpj)}</td>
                ))}
                <td style={{ border: "1px solid #444", color: "#FFD54F" }}>{fmt(summaryCol.data.baseIrpj)}</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem" }}>IRPJ Normal (15%)</td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444" }}>{fmt(col.data.irpjNormal)}</td>
                ))}
                <td style={{ border: "1px solid #444", fontWeight: "bold" }}>{fmt(summaryCol.data.irpjNormal)}</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem" }}>IRPJ Adicional (10%)</td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444" }}>{fmt(col.data.irpjAdicional)}</td>
                ))}
                <td style={{ border: "1px solid #444", fontWeight: "bold" }}>{fmt(summaryCol.data.irpjAdicional)}</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem" }}>(-) IRRF Retido na Fonte (Serviços / Aplicações)</td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444" }}>{fmt(col.data.retencoesIR)}</td>
                ))}
                <td style={{ border: "1px solid #444", fontWeight: "bold" }}>{fmt(summaryCol.data.retencoesIR)}</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem", color: "#FFD54F" }}>Ajuste Manual / Declarado IRPJ</td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444" }}>{fmt(col.data.ajusteIrpj)}</td>
                ))}
                <td style={{ border: "1px solid #444", fontWeight: "bold" }}>{fmt(summaryCol.data.ajusteIrpj)}</td>
              </tr>
              <tr style={{ background: "rgba(76, 175, 80, 0.15)", fontWeight: "bold" }}>
                <td style={{ padding: "8px", border: "1px solid #444", textAlign: "left" }}>IRPJ DEVIDO LÍQUIDO</td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444" }}>{fmt(Math.max(0, col.data.irpjTotal))}</td>
                ))}
                <td style={{ border: "1px solid #444", fontWeight: "bold", color: "#81C784", fontSize: "0.95rem" }}>{fmt(Math.max(0, summaryCol.data.irpjTotal))}</td>
              </tr>

              {/* 5. APURAÇÃO DA CSLL */}
              <tr style={{ background: "rgba(255, 255, 255, 0.03)" }}>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", fontWeight: "bold", color: "#80CBC4" }} colSpan={columns.length + 2}>
                  5. APURAÇÃO DA CSLL
                </td>
              </tr>
              <tr>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem", color: "#bbb" }}>
                  ↳ Base Presumida de Vendas (12% s/ Rec. Líquida)
                </td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444", color: "#bbb" }}>{fmt(col.data.baseRevendaCsll)}</td>
                ))}
                <td style={{ border: "1px solid #444", color: "#bbb" }}>{fmt(summaryCol.data.baseRevendaCsll)}</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem", color: "#bbb" }}>
                  ↳ Base Presumida de Serviços (32% s/ Serviços)
                </td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444", color: "#bbb" }}>{fmt(col.data.baseServicoCsll)}</td>
                ))}
                <td style={{ border: "1px solid #444", color: "#bbb" }}>{fmt(summaryCol.data.baseServicoCsll)}</td>
              </tr>
              {(summaryCol.data.acrescimoCsll > 0) && (
                <tr>
                  <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem", color: "#FFCA28" }}>
                    ↳ (+) Majoração de 10% (Lei 2026 - Excesso de R$ 1,25M)
                  </td>
                  {columns.map((col, idx) => (
                    <td key={idx} style={{ border: "1px solid #444", color: "#FFCA28" }}>{fmt(col.data.acrescimoCsll)}</td>
                  ))}
                  <td style={{ border: "1px solid #444", color: "#FFCA28", fontWeight: "bold" }}>{fmt(summaryCol.data.acrescimoCsll)}</td>
                </tr>
              )}
              <tr style={{ background: "rgba(255, 255, 255, 0.05)", fontWeight: "bold" }}>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left" }}>Base de Cálculo Total CSLL</td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444" }}>{fmt(col.data.baseCsll)}</td>
                ))}
                <td style={{ border: "1px solid #444", color: "#FFD54F" }}>{fmt(summaryCol.data.baseCsll)}</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem" }}>CSLL Normal (9%)</td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444" }}>{fmt(col.data.csll)}</td>
                ))}
                <td style={{ border: "1px solid #444", fontWeight: "bold" }}>{fmt(summaryCol.data.csll)}</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem" }}>(-) CSLL Retida na Fonte</td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444" }}>{fmt(col.data.retencoesCS)}</td>
                ))}
                <td style={{ border: "1px solid #444", fontWeight: "bold" }}>{fmt(summaryCol.data.retencoesCS)}</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 8px", border: "1px solid #444", textAlign: "left", paddingLeft: "1.2rem", color: "#FFD54F" }}>Ajuste Manual / Declarado CSLL</td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444" }}>{fmt(col.data.ajusteCsll)}</td>
                ))}
                <td style={{ border: "1px solid #444", fontWeight: "bold" }}>{fmt(summaryCol.data.ajusteCsll)}</td>
              </tr>
              <tr style={{ background: "rgba(76, 175, 80, 0.15)", fontWeight: "bold" }}>
                <td style={{ padding: "8px", border: "1px solid #444", textAlign: "left" }}>CSLL DEVIDA LÍQUIDA</td>
                {columns.map((col, idx) => (
                  <td key={idx} style={{ border: "1px solid #444" }}>{fmt(Math.max(0, col.data.csllTotal))}</td>
                ))}
                <td style={{ border: "1px solid #444", fontWeight: "bold", color: "#81C784", fontSize: "0.95rem" }}>{fmt(Math.max(0, summaryCol.data.csllTotal))}</td>
              </tr>
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
               <input 
                 type="text" 
                 inputMode="decimal"
                 className="text-input" 
                 value={lalurAdicoes} 
                 onChange={e => setLalurAdicoes(e.target.value.replace(',', '.'))} 
                 onPaste={e => handlePasteNumber(e, setLalurAdicoes, 'lalurAdicoes')}
                 onBlur={e => {
                   const cleaned = parseCurrencyInput(e.target.value);
                   setLalurAdicoes(cleaned);
                   persistTaxData(selectedComp, selectedAno, selectedMes, { lalurAdicoes: cleaned });
                 }}
                 style={{ width: '100%' }} 
               />
             </div>

             <div style={{ marginBottom: '1rem' }}>
               <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(-) Exclusões (Ex: Div. Isentos, Provisões Revertidas)</label>
               <input 
                 type="text" 
                 inputMode="decimal"
                 className="text-input" 
                 value={lalurExclusoes} 
                 onChange={e => setLalurExclusoes(e.target.value.replace(',', '.'))} 
                 onPaste={e => handlePasteNumber(e, setLalurExclusoes, 'lalurExclusoes')}
                 onBlur={e => {
                   const cleaned = parseCurrencyInput(e.target.value);
                   setLalurExclusoes(cleaned);
                   persistTaxData(selectedComp, selectedAno, selectedMes, { lalurExclusoes: cleaned });
                 }}
                 style={{ width: '100%' }} 
               />
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
                 <input 
                    type="text" 
                    inputMode="decimal" 
                    className="text-input" 
                    value={lalurCambioRealizado} 
                    onChange={e => setLalurCambioRealizado(e.target.value.replace(',', '.'))} 
                    onPaste={e => handlePasteNumber(e, setLalurCambioRealizado, 'lalurCambioRealizado')}
                    onBlur={e => {
                      const cleaned = parseCurrencyInput(e.target.value);
                      setLalurCambioRealizado(cleaned);
                      persistTaxData(selectedComp, selectedAno, selectedMes, { lalurCambioRealizado: cleaned, presumidoCambioRealizado: cleaned });
                    }}
                    placeholder="0.00" 
                    style={{ width: '100%', borderColor: '#FFCA28' }} 
                  />
               </div>
             )}
             
             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '1rem' }}>
                <span>Base de Cálculo (Antes Prejuízo):</span>
                <strong style={{ color: calc.baseCalculo >= 0 ? '#81C784' : '#FF5252' }}>{calc.baseCalculo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
             </div>
              <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#888', marginTop: '0.2rem' }}>
                Memória: LAIR ({calc.lair.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) {calc.adicoes > 0 ? ` + Adições/Caixa (${calc.adicoes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})` : ''} {calc.exclusoes > 0 ? ` - Exclusões/DRE (${calc.exclusoes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})` : ''}
              </div>

             <div style={{ marginBottom: '1rem', marginTop: '1.5rem' }}>
               <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(-) Compensação Prejuízo (Lim. 30%: {Math.max(0, calc.baseCalculo*0.3).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</label>
               <input 
                 type="text" 
                 inputMode="decimal"
                 className="text-input" 
                 value={lalurCompensacaoPrejuizo} 
                 onChange={e => setLalurCompensacaoPrejuizo(e.target.value.replace(',', '.'))} 
                 onPaste={e => handlePasteNumber(e, setLalurCompensacaoPrejuizo, 'lalurCompensacaoPrejuizo')}
                 onBlur={e => {
                   const cleaned = parseCurrencyInput(e.target.value);
                   setLalurCompensacaoPrejuizo(cleaned);
                   persistTaxData(selectedComp, selectedAno, selectedMes, { lalurCompensacaoPrejuizo: cleaned });
                 }}
                 style={{ width: '100%' }} 
               />
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
                <span>IRPJ Adicional (10% s/ excesso de R$ 20.000):</span>
                <span>{calc.irpjAdicional.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
             </div>
             <div style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
               <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(-) IRRF s/ Serviços</label>
               <input 
                 type="text" 
                 inputMode="decimal"
                 className="text-input" 
                 value={lalurRetencoesIR} 
                 onChange={e => setLalurRetencoesIR(e.target.value.replace(',', '.'))} 
                 onPaste={e => handlePasteNumber(e, setLalurRetencoesIR, 'lalurRetencoesIR')}
                 onBlur={e => {
                   const cleaned = parseCurrencyInput(e.target.value);
                   setLalurRetencoesIR(cleaned);
                   persistTaxData(selectedComp, selectedAno, selectedMes, { lalurRetencoesIR: cleaned });
                 }}
                 style={{ width: '100%' }} 
               />
               <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginTop: '1rem', marginBottom: '0.3rem' }}>(-) IRRF s/ Aplicações</label>
               <input 
                 type="text" 
                 inputMode="decimal"
                 className="text-input" 
                 value={lalurRetencoesIR_AppFin} 
                 onChange={e => setLalurRetencoesIR_AppFin(e.target.value.replace(',', '.'))} 
                 onPaste={e => handlePasteNumber(e, setLalurRetencoesIR_AppFin, 'lalurRetencoesIR_AppFin')}
                 onBlur={e => {
                   const cleaned = parseCurrencyInput(e.target.value);
                   setLalurRetencoesIR_AppFin(cleaned);
                   persistTaxData(selectedComp, selectedAno, selectedMes, { lalurRetencoesIR_AppFin: cleaned });
                 }}
                 style={{ width: '100%' }} 
               />
             </div>

             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.8rem', marginBottom: '0.8rem', background: 'rgba(255, 193, 7, 0.08)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(255, 193, 7, 0.25)' }}>
               <div>
                 <label style={{ display: 'block', fontSize: '0.84rem', color: '#FFD54F', fontWeight: 'bold' }}>
                   ✅ Valor Exato da Apuração IRPJ (R$):
                 </label>
                 <span style={{ fontSize: '0.74rem', color: '#aaa' }}>Se preenchido, este valor substituirá o cálculo automático</span>
               </div>
               <input 
                 type="text" 
                 inputMode="decimal"
                 className="text-input" 
                 value={lalurAjusteIrpj} 
                 onChange={e => setLalurAjusteIrpj(e.target.value.replace(',', '.'))} 
                 onPaste={e => handlePasteNumber(e, setLalurAjusteIrpj, 'lalurAjusteIrpj')}
                 onBlur={e => {
                   const cleaned = parseCurrencyInput(e.target.value);
                   setLalurAjusteIrpj(cleaned);
                   persistTaxData(selectedComp, selectedAno, selectedMes, { lalurAjusteIrpj: cleaned });
                 }}
                 placeholder="0.00" 
                 style={{ width: '130px', textAlign: 'right', borderColor: '#FFD54F', color: '#FFD54F', fontWeight: 'bold', background: '#1c1c24' }} 
               />
             </div>

             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '1rem', color: '#81C784', fontSize: '1.1rem', fontWeight: 'bold' }}>
                <span>IRPJ Devido no Mês:</span>
                <span>{Math.max(0, calc.irpjTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
             </div>
             {isAnual && (
               <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem', color: '#CE93D8', fontSize: '0.95rem' }}>
                  <span>IRPJ Acumulado no Ano (DRE):</span>
                  <strong>{dreAnualTotal.filter(r => r.mes <= selectedMes && (r.id?.startsWith("tax-dre-irpj-") || r.conta === '7' || r.conta === '5.1.1.1.01.00001')).reduce((sum, r) => sum + Math.abs(r.valorMensal || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
               </div>
             )}

             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', marginTop: '1.5rem' }}>
                <span>CSLL Normal (9%):</span>
                <span>{calc.csll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
             </div>
             <div style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
               <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(-) CSLL Retida</label>
               <input 
                 type="text" 
                 inputMode="decimal"
                 className="text-input" 
                 value={lalurRetencoesCS} 
                 onChange={e => setLalurRetencoesCS(e.target.value.replace(',', '.'))} 
                 onPaste={e => handlePasteNumber(e, setLalurRetencoesCS, 'lalurRetencoesCS')}
                 onBlur={e => {
                   const cleaned = parseCurrencyInput(e.target.value);
                   setLalurRetencoesCS(cleaned);
                   persistTaxData(selectedComp, selectedAno, selectedMes, { lalurRetencoesCS: cleaned });
                 }}
                 style={{ width: '100%' }} 
               />
             </div>

             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.8rem', marginBottom: '0.8rem', background: 'rgba(255, 193, 7, 0.08)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(255, 193, 7, 0.25)' }}>
               <div>
                 <label style={{ display: 'block', fontSize: '0.84rem', color: '#FFD54F', fontWeight: 'bold' }}>
                   ✅ Valor Exato da Apuração CSLL (R$):
                 </label>
                 <span style={{ fontSize: '0.74rem', color: '#aaa' }}>Se preenchido, este valor substituirá o cálculo automático</span>
               </div>
               <input 
                 type="text" 
                 inputMode="decimal"
                 className="text-input" 
                 value={lalurAjusteCsll} 
                 onChange={e => setLalurAjusteCsll(e.target.value.replace(',', '.'))} 
                 onPaste={e => handlePasteNumber(e, setLalurAjusteCsll, 'lalurAjusteCsll')}
                 onBlur={e => {
                   const cleaned = parseCurrencyInput(e.target.value);
                   setLalurAjusteCsll(cleaned);
                   persistTaxData(selectedComp, selectedAno, selectedMes, { lalurAjusteCsll: cleaned });
                 }}
                 placeholder="0.00" 
                 style={{ width: '130px', textAlign: 'right', borderColor: '#FFD54F', color: '#FFD54F', fontWeight: 'bold', background: '#1c1c24' }} 
               />
             </div>

             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '1rem', color: '#81C784', fontSize: '1.1rem', fontWeight: 'bold' }}>
                <span>CSLL Devida no Mês:</span>
                <span>{Math.max(0, calc.csllTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
             </div>
             {isAnual && (
               <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem', color: '#CE93D8', fontSize: '0.95rem' }}>
                  <span>CSLL Acumulada no Ano (DRE):</span>
                  <strong>{dreAnualTotal.filter(r => r.mes <= selectedMes && (r.id?.startsWith("tax-dre-csll-") || r.conta === '6' || r.conta === '5.1.1.1.01.00002')).reduce((sum, r) => sum + Math.abs(r.valorMensal || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
               </div>
             )}
          </div>
          
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {hasApuracao && (
              <button 
                type="button"
                className="btn-secondary" 
                onClick={handleDeleteApuracao} 
                style={{ padding: '0.9rem 1.8rem', fontSize: '1rem', borderColor: '#f44336', color: '#ff6b6b', background: 'rgba(244, 67, 54, 0.1)', cursor: 'pointer', fontWeight: 600 }} 
                disabled={isProcessing}
                title="Excluir lançamentos da DRE e Balanço deste mês"
              >
                🗑️ Excluir Apuração deste Mês
              </button>
            )}
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={handleSaveInputsOnly} 
              style={{ padding: '1rem 1.8rem', fontSize: '1rem', cursor: 'pointer', fontWeight: 600, border: '1px solid #64B5F6', color: '#64B5F6', background: 'rgba(33, 150, 243, 0.1)' }} 
              disabled={isProcessing} 
              title="Salvar apenas a memória de cálculo digitada sem lançar no Balanço"
            >
              💾 Salvar Memória de Cálculo
            </button>
            <button className="btn-primary" onClick={() => handleGravar(calc.irpjTotal, calc.csllTotal, calc.irpjNormal + calc.irpjAdicional, calc.csll)} style={{ padding: '1rem 2rem', fontSize: '1.1rem' }} disabled={isProcessing}>
              {isProcessing ? 'Gravando...' : (isAnual ? '💾 Lançar Balanço de Suspensão/Redução no DRE e Balanço' : '💾 Lançar Apuração no DRE e Balanço')}
            </button>
            {isAnual && (
                <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.5rem', width: '100%', textAlign: 'right' }}>
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
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '2rem' }}>
             <select value={selectedComp} onChange={e => handleCompanyChange(e.target.value)} className="select-input" style={{ width: '280px' }}>
                <option value="">Selecione a Empresa...</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
             </select>
             <select value={selectedMes} onChange={(e) => handleMonthChange(parseInt(e.target.value))} className="select-input" style={{ width: '160px' }}>
                <option value={1}>Janeiro</option><option value={2}>Fevereiro</option><option value={3}>Março</option>
                <option value={4}>Abril</option><option value={5}>Maio</option><option value={6}>Junho</option>
                <option value={7}>Julho</option><option value={8}>Agosto</option><option value={9}>Setembro</option>
                <option value={10}>Outubro</option><option value={11}>Novembro</option><option value={12}>Dezembro</option>
              </select>
              <select value={selectedAno} onChange={(e) => handleYearChange(parseInt(e.target.value))} className="select-input" style={{ width: '110px' }}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>

              {selectedComp && (
                hasApuracao ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', background: 'rgba(76, 175, 80, 0.15)', color: '#81C784', border: '1px solid rgba(76, 175, 80, 0.3)', fontSize: '0.85rem', fontWeight: 600 }}>
                      ✓ Apuração Lançada
                    </span>
                    <button 
                      type="button"
                      className="btn-secondary" 
                      onClick={handleDeleteApuracao} 
                      disabled={isProcessing}
                      style={{ padding: '0.4rem 0.8rem', borderColor: '#f44336', color: '#ff6b6b', background: 'rgba(244, 67, 54, 0.1)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
                      title="Excluir lançamentos da DRE e Balanço deste mês"
                    >
                      🗑️ Excluir Apuração
                    </button>
                  </div>
                ) : (
                  <span style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.05)', color: '#888', border: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '0.85rem' }}>
                    ○ Não Apurado
                  </span>
                )
              )}

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