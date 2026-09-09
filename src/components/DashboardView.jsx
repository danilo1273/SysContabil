import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LineChart, Line, PieChart, Pie, Legend, ReferenceLine } from 'recharts';
import { getHistorySeries, getSettings, saveSettings } from '../utils/db';

export default function DashboardView({ selectedCompany, selectedAno, selectedMes, period, selectedTrimestre }) {
  const [loading, setLoading] = useState(true);
  const [dataAtual, setDataAtual] = useState({ dre: [], balanco: [] });
  const [dataAnterior, setDataAnterior] = useState({ dre: [], balanco: [] });
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [debtFilter, setDebtFilter] = useState('todos');
  const [debtSearch, setDebtSearch] = useState('');
  const [debtSelectedMes, setDebtSelectedMes] = useState(selectedMes);

  // Projeção de Endividamento, Caixa e Break-Even (3 Anos)
  const [chartHorizon, setChartHorizon] = useState('3anos'); // Padrão: 3 anos (Break-Even)
  const [showProjModal, setShowProjModal] = useState(false);
  const [projModalAnoTab, setProjModalAnoTab] = useState(selectedAno);
  const [projAssumptions, setProjAssumptions] = useState({
    monthlyCashGen: 500000,
    monthlyAmortCP: 400000,
    monthlyAmortLP: 200000
  });
  const [projOverrides, setProjOverrides] = useState({});
  const [saveProjStatus, setSaveProjStatus] = useState('');
  const [futureBalancoData, setFutureBalancoData] = useState({});

  // Sincronizar debtSelectedMes e projModalAnoTab quando mudar
  useEffect(() => {
    setDebtSelectedMes(selectedMes);
  }, [selectedMes]);

  useEffect(() => {
    setProjModalAnoTab(selectedAno);
  }, [selectedAno]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const atual = await getHistorySeries(selectedCompany, selectedAno);
        const anterior = await getHistorySeries(selectedCompany, selectedAno - 1);
        setDataAtual(atual);
        setDataAnterior(anterior);

        // Buscar dados futuros se existirem (para visualização híbrida real + projetada)
        try {
          const [next1, next2] = await Promise.all([
            getHistorySeries(selectedCompany, selectedAno + 1),
            getHistorySeries(selectedCompany, selectedAno + 2)
          ]);
          setFutureBalancoData({
            [selectedAno + 1]: next1?.balanco || [],
            [selectedAno + 2]: next2?.balanco || []
          });
        } catch (errFut) {
          console.warn('Dados de balanço futuros não disponíveis:', errFut);
        }

        // Carregar configurações de projeção persistidas no Supabase
        try {
          const savedProj = await getSettings(`agf_projecao_endividamento_${selectedCompany}`) || await getSettings('agf_projecao_endividamento');
          if (savedProj) {
            if (savedProj.assumptions) setProjAssumptions(savedProj.assumptions);
            if (savedProj.overrides) setProjOverrides(savedProj.overrides);
          }
        } catch (errProj) {
          console.warn('Erro ao carregar projeção salva:', errProj);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchData();
  }, [selectedCompany, selectedAno, selectedMes]);

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-primary)' }}>Carregando Indicadores Avançados...</div>;
  }

  const formatCurrency = (val) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const calcDiff = (curr, prev) => {
    if (!prev || prev === 0) return { pct: 0, isPos: curr >= 0 };
    const pct = ((curr - prev) / Math.abs(prev)) * 100;
    return { pct, isPos: pct >= 0 };
  };

  const renderArrow = (diff) => {
    if (diff.pct > 0) return <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>↑ {diff.pct.toFixed(2)}%</span>;
    if (diff.pct < 0) return <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>↓ {Math.abs(diff.pct).toFixed(2)}%</span>;
    return <span style={{ color: 'var(--color-text-muted)' }}>- 0,00%</span>;
  };

  const inPeriod = (mes) => {
    if (period === 'mensal') return mes === selectedMes;
    if (period === 'trimestre') {
      const qStart = (selectedTrimestre - 1) * 3 + 1;
      const qEnd = qStart + 2;
      return mes >= qStart && mes <= qEnd;
    }
    if (period === 'acumulado') return true;
    return true; // default
  };

  const periodLabel = period === 'mensal' 
    ? `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][selectedMes - 1]} ${selectedAno}` 
    : period === 'trimestre' 
    ? `${selectedTrimestre}º Tri ${selectedAno}` 
    : `Anual de ${selectedAno}`;

  const periodLabelAnt = period === 'mensal' 
    ? `${selectedAno - 1}` 
    : period === 'trimestre' 
    ? `${selectedTrimestre}º Tri ${selectedAno - 1}` 
    : `Anual de ${selectedAno - 1}`;

  const extractMetric = (dataArray, prefix, customMes = null) => {
    return dataArray.reduce((acc, row) => {
      // If a specific month is requested (like for charts), use it. Else use the global period filter
      if (customMes !== null) {
        if (row.mes !== customMes) return acc;
      } else {
        if (!inPeriod(row.mes)) return acc;
      }
      if (row.conta.startsWith(prefix)) return acc + (row.total || row.valorMensal || row.saldoAcumulado || 0);
      return acc;
    }, 0);
  };

  // Receitas (agora respeita o período selecionado por padrão)
  const recVendaAtual = extractMetric(dataAtual.dre, '3.1.1.1.01.00001');
  const recVendaAnt = extractMetric(dataAnterior.dre, '3.1.1.1.01.00001');
  const recRevendaAtual = extractMetric(dataAtual.dre, '3.1.1.1.01.00002');
  const recRevendaAnt = extractMetric(dataAnterior.dre, '3.1.1.1.01.00002');
  const recServicoAtual = extractMetric(dataAtual.dre, '3.1.1.1.01.00003');
  const recServicoAnt = extractMetric(dataAnterior.dre, '3.1.1.1.01.00003');
  const recLocacaoAtual = extractMetric(dataAtual.dre, '3.1.1.1.01.00004');
  const recLocacaoAnt = extractMetric(dataAnterior.dre, '3.1.1.1.01.00004');
  const recExportacaoAtual = extractMetric(dataAtual.dre, '3.1.1.1.01.00006');
  const recExportacaoAnt = extractMetric(dataAnterior.dre, '3.1.1.1.01.00006');

  const totalReceitaAtual = extractMetric(dataAtual.dre, '3.1.1.1');

  // KPIs Totais (respeita o período)
  const recMesAtual = totalReceitaAtual;
  const recMesAnt = extractMetric(dataAnterior.dre, '3.1.1.1');
  
  const despMesAtual = extractMetric(dataAtual.dre, '4.2');
  const despMesAnt = extractMetric(dataAnterior.dre, '4.2');

  const custoMesAtual = extractMetric(dataAtual.dre, '4.1');
  const custoMesAnt = extractMetric(dataAnterior.dre, '4.1');

  // Despesas / Custos (respeita o período)
  const despVendasMes = extractMetric(dataAtual.dre, '4.2.1.1');
  const despVendasMesAnt = extractMetric(dataAnterior.dre, '4.2.1.1');
  const despAdminMes = extractMetric(dataAtual.dre, '4.2.1.2');
  const despAdminMesAnt = extractMetric(dataAnterior.dre, '4.2.1.2');
  const custoVendasMes = extractMetric(dataAtual.dre, '4.1.1.1.13');
  const custoVendasMesAnt = extractMetric(dataAnterior.dre, '4.1.1.1.13');
  const custoRevendasMes = extractMetric(dataAtual.dre, '4.1.1.1.20');
  const custoRevendasMesAnt = extractMetric(dataAnterior.dre, '4.1.1.1.20');
  // Just gathering everything else from Custos for Serviços/Outros
  const custoServicoMes = custoMesAtual - custoVendasMes - custoRevendasMes;
  const custoServicoMesAnt = custoMesAnt - custoVendasMesAnt - custoRevendasMesAnt;

  const totalCustosAtual = custoMesAtual;
  const totalDespesasAtual = despMesAtual;

  // Acumulados Pie Chart Data
  const pieData = [
    { name: 'Custo', value: Math.abs(totalCustosAtual), fill: '#dca840' },
    { name: 'Despesa Operacional', value: Math.abs(totalDespesasAtual), fill: '#607d8b' },
    { name: 'Receita', value: Math.abs(totalReceitaAtual), fill: '#4CAF50' }
  ];

  // Histórico Mensal para Linhas (DRE, Balanço, Endividamento e Caixa)
  const chartData = [];
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  for (let m = 1; m <= 12; m++) {
    const faturamento = extractMetric(dataAtual.dre, '3.1.1.1', m);
    const deducoes = extractMetric(dataAtual.dre, '3.1.1.2', m);
    const receitaLiquida = faturamento + deducoes;
    const custos = extractMetric(dataAtual.dre, '4.1', m);
    const despesas = extractMetric(dataAtual.dre, '4.2', m);
    const ebit = receitaLiquida + custos + despesas;
    const ebitMargin = receitaLiquida !== 0 ? (ebit / receitaLiquida) * 100 : 0;

    // Métricas mensais de dívida e caixa (encargos somam com a dívida)
    let mCP = 0;
    let mLP = 0;
    let mCaixa = 0;
    let mNac = 0;
    let mEst = 0;

    (dataAtual.balanco || []).forEach(r => {
      if (r.mes !== m) return;
      const val = Math.abs(r.saldoAcumulado || 0);
      if (r.conta.startsWith('2.1.1.2') || r.conta.startsWith('2.1.1.3') || r.conta.startsWith('2.1.2')) {
        mCP += val;
        if (r.conta.startsWith('2.1.1.2.03')) mEst += val;
        else mNac += val;
      } else if (r.conta.startsWith('2.3.1.1') || r.conta.startsWith('2.2.1')) {
        mLP += val;
        if (r.conta.startsWith('2.3.1.1.03') || r.conta.startsWith('2.2.1.1.03')) mEst += val;
        else mNac += val;
      } else if (r.conta.startsWith('1.1.1.1') || r.conta.startsWith('1.1.1.2')) {
        mCaixa += (r.saldoAcumulado || 0);
      }
    });

    const mDividaTotal = mCP + mLP;
    const mDividaLiquida = mDividaTotal - mCaixa;

    chartData.push({
      mes: meses[m - 1],
      mesNum: m,
      Faturamento: faturamento,
      Custos: Math.abs(custos),
      Estoque: extractMetric(dataAtual.balanco, '1.1.1.6', m),
      EBIT: ebitMargin,
      DividaTotal: mDividaTotal,
      DividaCP: mCP,
      DividaLP: mLP,
      DividaNac: mNac,
      DividaEst: mEst,
      DisponivelCaixa: mCaixa,
      DividaLiquidaCaixa: mDividaLiquida
    });
  }

  // --- MOTOR DE PROJEÇÃO DINÂMICA DE ENDIVIDAMENTO, CAIXA E BREAK-EVEN (3 ANOS / 36 MESES) ---
  const mesesAbrev = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const mesesNome = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const getMonthRealBalance = (ano, mes) => {
    let bal = [];
    if (ano === selectedAno) bal = dataAtual.balanco || [];
    else if (ano === selectedAno - 1) bal = dataAnterior.balanco || [];
    else if (futureBalancoData[ano]) bal = futureBalancoData[ano];

    let mCP = 0;
    let mLP = 0;
    let mCaixa = 0;
    let hasData = false;

    (bal || []).forEach(r => {
      if (r.mes !== mes) return;
      const val = Math.abs(r.saldoAcumulado || 0);
      if (r.conta.startsWith('2.1.1.2') || r.conta.startsWith('2.1.1.3') || r.conta.startsWith('2.1.2')) {
        mCP += val;
        hasData = true;
      } else if (r.conta.startsWith('2.3.1.1') || r.conta.startsWith('2.2.1')) {
        mLP += val;
        hasData = true;
      } else if (r.conta.startsWith('1.1.1.1') || r.conta.startsWith('1.1.1.2')) {
        mCaixa += (r.saldoAcumulado || 0);
        hasData = true;
      }
    });

    return { hasData, mCP, mLP, mCaixa, mDividaTotal: mCP + mLP, mDividaLiquida: (mCP + mLP) - mCaixa };
  };

  // Identificar o último mês realizado contábil com saldos consistentes
  let lastRealPoint = null;
  for (let m = 12; m >= 1; m--) {
    const res = getMonthRealBalance(selectedAno, m);
    if (res.hasData && (res.mDividaTotal > 0 || res.mCaixa > 0)) {
      lastRealPoint = { ano: selectedAno, mes: m, ...res };
      break;
    }
  }
  if (!lastRealPoint) {
    lastRealPoint = { ano: selectedAno, mes: selectedMes || 1, mCP: 0, mLP: 0, mCaixa: 0, mDividaTotal: 0, mDividaLiquida: 0 };
  }

  const years3 = [selectedAno, selectedAno + 1, selectedAno + 2];
  const full36Months = [];

  let runningCaixa = lastRealPoint.mCaixa;
  let runningCP = lastRealPoint.mCP;
  let runningLP = lastRealPoint.mLP;
  let breakEvenMonth = null;

  for (const yr of years3) {
    for (let m = 1; m <= 12; m++) {
      const isPastOrCurrentReal = (yr < lastRealPoint.ano) || (yr === lastRealPoint.ano && m <= lastRealPoint.mes);
      const realBal = getMonthRealBalance(yr, m);

      const mesAnoAbrev = `${mesesAbrev[m - 1]}/${String(yr).slice(-2)}`;
      const fullLabel = `${mesesNome[m - 1]} / ${yr}`;

      let item = {
        ano: yr,
        mesNum: m,
        mesNome: mesesNome[m - 1],
        mesAno: mesAnoAbrev,
        fullLabel: fullLabel,
        mesKey: chartHorizon === '3anos' ? mesAnoAbrev : mesesAbrev[m - 1]
      };

      if (isPastOrCurrentReal && realBal.hasData) {
        // Real contábil
        item.isProjetado = false;
        item.DividaCP = realBal.mCP;
        item.DividaLP = realBal.mLP;
        item.DividaTotal = realBal.mDividaTotal;
        item.DisponivelCaixa = realBal.mCaixa;
        item.DividaLiquidaCaixa = realBal.mDividaLiquida;

        // Se for o último mês real, sincronizar ponto de partida da projeção
        if (yr === lastRealPoint.ano && m === lastRealPoint.mes) {
          runningCaixa = realBal.mCaixa;
          runningCP = realBal.mCP;
          runningLP = realBal.mLP;
        }
      } else {
        // Projetado dinamicamente
        item.isProjetado = true;
        const overrideKey = `${yr}-${m}`;
        const override = projOverrides[overrideKey];

        if (override) {
          runningCaixa = override.caixa !== undefined ? Number(override.caixa) : runningCaixa + Number(projAssumptions.monthlyCashGen || 0);
          runningCP = override.dividaCP !== undefined ? Number(override.dividaCP) : Math.max(0, runningCP - Number(projAssumptions.monthlyAmortCP || 0));
          runningLP = override.dividaLP !== undefined ? Number(override.dividaLP) : Math.max(0, runningLP - Number(projAssumptions.monthlyAmortLP || 0));
        } else {
          runningCaixa = runningCaixa + Number(projAssumptions.monthlyCashGen || 0);
          runningCP = Math.max(0, runningCP - Number(projAssumptions.monthlyAmortCP || 0));
          runningLP = Math.max(0, runningLP - Number(projAssumptions.monthlyAmortLP || 0));
        }

        item.DividaCP = Math.round(runningCP);
        item.DividaLP = Math.round(runningLP);
        item.DividaTotal = Math.round(runningCP + runningLP);
        item.DisponivelCaixa = Math.round(runningCaixa);
        item.DividaLiquidaCaixa = Math.round(item.DividaTotal - item.DisponivelCaixa);
      }

      // Identificação do Break-Even (Disponibilidades >= Dívida Total ou Dívida Líquida <= 0)
      item.isBreakEven = item.DisponivelCaixa >= item.DividaTotal;
      if (item.isBreakEven && !breakEvenMonth) {
        const diffMonths = (yr - lastRealPoint.ano) * 12 + (m - lastRealPoint.mes);
        breakEvenMonth = {
          mesAno: mesAnoAbrev,
          fullLabel: fullLabel,
          mesKey: item.mesKey,
          ano: yr,
          mes: m,
          mesesRestantes: Math.max(0, diffMonths),
          caixa: item.DisponivelCaixa,
          divida: item.DividaTotal,
          sobraCaixa: item.DisponivelCaixa - item.DividaTotal,
          isProjetado: item.isProjetado
        };
      }

      full36Months.push(item);
    }
  }

  const displayedDebtChartData = chartHorizon === '3anos'
    ? full36Months
    : full36Months.filter(d => d.ano === selectedAno).map(d => ({ ...d, mesKey: mesesAbrev[d.mesNum - 1] }));

  const handleSaveProjection = async () => {
    setSaveProjStatus('saving');
    try {
      const payload = {
        assumptions: projAssumptions,
        overrides: projOverrides,
        updatedAt: new Date().toISOString()
      };
      await saveSettings(`agf_projecao_endividamento_${selectedCompany}`, payload);
      await saveSettings('agf_projecao_endividamento', payload);
      setSaveProjStatus('success');
      setTimeout(() => setSaveProjStatus(''), 3000);
    } catch (err) {
      console.error(err);
      setSaveProjStatus('error');
      setTimeout(() => setSaveProjStatus(''), 3000);
    }
  };

  const handleOverrideChange = (yr, m, field, val) => {
    const key = `${yr}-${m}`;
    setProjOverrides(prev => {
      const current = prev[key] || {};
      const num = val === '' ? undefined : parseFloat(val);
      const updated = { ...current, [field]: num };
      if (updated.caixa === undefined && updated.dividaCP === undefined && updated.dividaLP === undefined) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: updated };
    });
  };

  const handleResetOverrides = () => {
    if (window.confirm('Deseja limpar todos os ajustes manuais e manter a projeção linear padrão?')) {
      setProjOverrides({});
    }
  };

  // --- INSIGHTS & ANÁLISE EXECUTIVA AVANÇADA ---
  let prevPeriodLabel = '';
  let fatAntReal = 0;
  let recLiqAntReal = 0;
  let custoAntReal = 0;
  let despAntReal = 0;
  let lucroBrutoAntReal = 0;
  let ebitAntReal = 0;
  let hasPrevData = false;

  if (period === 'mensal') {
    if (selectedMes > 1) {
      const prevM = selectedMes - 1;
      prevPeriodLabel = `${meses[prevM - 1]}/${selectedAno}`;
      fatAntReal = extractMetric(dataAtual.dre, '3.1.1.1', prevM);
      const dedAnt = extractMetric(dataAtual.dre, '3.1.1.2', prevM);
      recLiqAntReal = fatAntReal + dedAnt;
      custoAntReal = Math.abs(extractMetric(dataAtual.dre, '4.1', prevM));
      despAntReal = Math.abs(extractMetric(dataAtual.dre, '4.2', prevM));
      lucroBrutoAntReal = recLiqAntReal - custoAntReal;
      ebitAntReal = lucroBrutoAntReal - despAntReal;
      hasPrevData = fatAntReal > 0 || custoAntReal > 0;
    } else {
      prevPeriodLabel = `Jan/${selectedAno - 1}`;
      fatAntReal = extractMetric(dataAnterior.dre, '3.1.1.1', 1);
      const dedAnt = extractMetric(dataAnterior.dre, '3.1.1.2', 1);
      recLiqAntReal = fatAntReal + dedAnt;
      custoAntReal = Math.abs(extractMetric(dataAnterior.dre, '4.1', 1));
      despAntReal = Math.abs(extractMetric(dataAnterior.dre, '4.2', 1));
      lucroBrutoAntReal = recLiqAntReal - custoAntReal;
      ebitAntReal = lucroBrutoAntReal - despAntReal;
      hasPrevData = fatAntReal > 0 || custoAntReal > 0;
    }
  } else if (period === 'trimestre') {
    if (selectedTrimestre > 1) {
      const prevT = selectedTrimestre - 1;
      prevPeriodLabel = `${prevT}º Tri/${selectedAno}`;
      const qStart = (prevT - 1) * 3 + 1;
      const qEnd = qStart + 2;
      for (let m = qStart; m <= qEnd; m++) {
        const f = extractMetric(dataAtual.dre, '3.1.1.1', m);
        const d = extractMetric(dataAtual.dre, '3.1.1.2', m);
        fatAntReal += f;
        recLiqAntReal += (f + d);
        custoAntReal += Math.abs(extractMetric(dataAtual.dre, '4.1', m));
        despAntReal += Math.abs(extractMetric(dataAtual.dre, '4.2', m));
      }
      lucroBrutoAntReal = recLiqAntReal - custoAntReal;
      ebitAntReal = lucroBrutoAntReal - despAntReal;
      hasPrevData = fatAntReal > 0 || custoAntReal > 0;
    } else {
      prevPeriodLabel = `4º Tri/${selectedAno - 1}`;
      for (let m = 10; m <= 12; m++) {
        const f = extractMetric(dataAnterior.dre, '3.1.1.1', m);
        const d = extractMetric(dataAnterior.dre, '3.1.1.2', m);
        fatAntReal += f;
        recLiqAntReal += (f + d);
        custoAntReal += Math.abs(extractMetric(dataAnterior.dre, '4.1', m));
        despAntReal += Math.abs(extractMetric(dataAnterior.dre, '4.2', m));
      }
      lucroBrutoAntReal = recLiqAntReal - custoAntReal;
      ebitAntReal = lucroBrutoAntReal - despAntReal;
      hasPrevData = fatAntReal > 0 || custoAntReal > 0;
    }
  } else {
    prevPeriodLabel = `Ano ${selectedAno - 1}`;
    fatAntReal = extractMetric(dataAnterior.dre, '3.1.1.1');
    const dedAnt = extractMetric(dataAnterior.dre, '3.1.1.2');
    recLiqAntReal = fatAntReal + dedAnt;
    custoAntReal = Math.abs(extractMetric(dataAnterior.dre, '4.1'));
    despAntReal = Math.abs(extractMetric(dataAnterior.dre, '4.2'));
    lucroBrutoAntReal = recLiqAntReal - custoAntReal;
    ebitAntReal = lucroBrutoAntReal - despAntReal;
    hasPrevData = fatAntReal > 0 || custoAntReal > 0;
  }

  // Métricas do Período Atual
  const fatAtual = totalReceitaAtual;
  const dedAtual = extractMetric(dataAtual.dre, '3.1.1.2');
  const recLiqAtual = fatAtual + dedAtual;
  const custoAtual = Math.abs(totalCustosAtual);
  const despAtual = Math.abs(totalDespesasAtual);
  const lucroBrutoAtual = recLiqAtual - custoAtual;
  const ebitAtual = lucroBrutoAtual - despAtual;

  const margemBruta = recLiqAtual > 0 ? (lucroBrutoAtual / recLiqAtual) * 100 : 0;
  const margemEbit = recLiqAtual > 0 ? (ebitAtual / recLiqAtual) * 100 : 0;
  const percCustos = recLiqAtual > 0 ? (custoAtual / recLiqAtual) * 100 : 0;
  const percDespesas = recLiqAtual > 0 ? (despAtual / recLiqAtual) * 100 : 0;

  // Variações vs Anterior
  const diffFat = hasPrevData && fatAntReal > 0 ? ((fatAtual - fatAntReal) / fatAntReal) * 100 : null;
  const diffCusto = hasPrevData && custoAntReal > 0 ? ((custoAtual - custoAntReal) / custoAntReal) * 100 : null;
  const diffDesp = hasPrevData && despAntReal > 0 ? ((despAtual - despAntReal) / despAntReal) * 100 : null;
  const diffLucroBruto = hasPrevData && Math.abs(lucroBrutoAntReal) > 0 ? ((lucroBrutoAtual - lucroBrutoAntReal) / Math.abs(lucroBrutoAntReal)) * 100 : null;

  // Destaques e Recordes Anuais
  let maxFat = 0; let melhorMesFat = '';
  let maxEbit = -999; let melhorMesEbit = '';
  let totalFatAno = 0;
  let countMesesComMov = 0;

  chartData.forEach(d => {
    if (d.Faturamento > 0) {
      totalFatAno += d.Faturamento;
      countMesesComMov++;
      if (d.Faturamento > maxFat) {
        maxFat = d.Faturamento;
        melhorMesFat = d.mes;
      }
      if (d.EBIT > maxEbit) {
        maxEbit = d.EBIT;
        melhorMesEbit = d.mes;
      }
    }
  });
  const mediaMensalFat = countMesesComMov > 0 ? totalFatAno / countMesesComMov : 0;

  // Diagnóstico Executivo Automatizado
  let diagnosticoTexto = '';
  if (hasPrevData && diffFat !== null) {
    if (diffFat >= 0) {
      diagnosticoTexto = `O faturamento avançou +${diffFat.toFixed(1)}% em relação a ${prevPeriodLabel} (+${formatCurrency(fatAtual - fatAntReal)}). `;
      if (margemEbit > 10) {
        diagnosticoTexto += `A operação manteve rentabilidade consistente com Margem EBIT de ${margemEbit.toFixed(1)}%.`;
      } else if (margemEbit > 0) {
        diagnosticoTexto += `Apesar do avanço em vendas, os custos absorveram ${percCustos.toFixed(1)}% da receita líquida, deixando a margem EBIT em ${margemEbit.toFixed(1)}%.`;
      } else {
        diagnosticoTexto += `Atenção: o resultado operacional (EBIT) ficou no negativo (${formatCurrency(ebitAtual)}) devido à elevação de custos e despesas.`;
      }
    } else {
      diagnosticoTexto = `O faturamento retraiu ${Math.abs(diffFat).toFixed(1)}% em relação a ${prevPeriodLabel} (-${formatCurrency(fatAntReal - fatAtual)}). `;
      if (diffDesp !== null && diffDesp > 0) {
        diagnosticoTexto += `As despesas operacionais aumentaram +${diffDesp.toFixed(1)}%, pressionando a Margem EBIT para ${margemEbit.toFixed(1)}%.`;
      } else {
        diagnosticoTexto += `A Margem Bruta situou-se em ${margemBruta.toFixed(1)}% e a Margem EBIT em ${margemEbit.toFixed(1)}%.`;
      }
    }
  } else {
    diagnosticoTexto = `No período (${periodLabel}), a receita gerada foi de ${formatCurrency(fatAtual)}, com Margem Bruta de ${margemBruta.toFixed(1)}% e Margem EBIT de ${margemEbit.toFixed(1)}%.`;
  }

  const renderBadgeDiff = (pct, invertColors = false) => {
    if (pct === null || isNaN(pct)) return <span style={{ color: '#888', fontSize: '0.8rem' }}>Sem histórico</span>;
    const isGood = invertColors ? pct <= 0 : pct >= 0;
    const color = isGood ? '#81C784' : '#FF5252';
    const bg = isGood ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)';
    const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : '=';
    return (
      <span style={{ background: bg, color: color, padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
        {arrow} {Math.abs(pct).toFixed(1)}%
      </span>
    );
  };

  // --- CÁLCULO DE ENDIVIDAMENTO (ENCARGOS SOMAM COM A DÍVIDA) ---
  const isDebtEncargo = (desc) => {
    const d = (desc || '').toLowerCase();
    return d.includes('encargo') || d.includes('enc ') || d.includes('transcorrer') || d.includes('apropriar') || d.startsWith('(-)') || d.startsWith('( - )');
  };
  const isDebtCP = (conta) => conta.startsWith('2.1.1.2') || conta.startsWith('2.1.1.3') || conta.startsWith('2.1.2');
  const isDebtLP = (conta) => conta.startsWith('2.3.1.1') || conta.startsWith('2.2.1');
  const isDebtEstrangeiro = (conta) => conta.startsWith('2.1.1.2.03') || conta.startsWith('2.3.1.1.03') || conta.startsWith('2.2.1.1.03');

  const activeDebtMes = debtSelectedMes || selectedMes;
  const debtPeriodLabel = `${meses[activeDebtMes - 1]}/${selectedAno}`;

  let nacCPPrincipal = 0; let nacCPEncargos = 0;
  let nacLPPrincipal = 0; let nacLPEncargos = 0;
  let estCPPrincipal = 0; let estCPEncargos = 0;
  let estLPPrincipal = 0; let estLPEncargos = 0;
  const debtAccounts = [];

  (dataAtual.balanco || []).forEach(r => {
    if (r.mes !== activeDebtMes) return;
    const isCp = isDebtCP(r.conta);
    const isLp = isDebtLP(r.conta);
    if (!isCp && !isLp) return;

    const val = Math.abs(r.saldoAcumulado || 0);
    const enc = isDebtEncargo(r.descricao);
    const est = isDebtEstrangeiro(r.conta);

    if (isCp) {
      if (est) {
        if (enc) estCPEncargos += val; else estCPPrincipal += val;
      } else {
        if (enc) nacCPEncargos += val; else nacCPPrincipal += val;
      }
    } else if (isLp) {
      if (est) {
        if (enc) estLPEncargos += val; else estLPPrincipal += val;
      } else {
        if (enc) nacLPEncargos += val; else nacLPPrincipal += val;
      }
    }

    debtAccounts.push({
      ...r,
      origem: est ? 'Estrangeiro (FINIMP)' : 'Nacional',
      origemKey: est ? 'estrangeiro' : 'nacional',
      prazo: isCp ? 'Curto Prazo' : 'Longo Prazo',
      tipo: enc ? 'Encargos a Transcorrer' : 'Principal',
      categoria: `${est ? 'est' : 'nac'}_${isCp ? 'cp' : 'lp'}_${enc ? 'enc' : 'prin'}`,
      valor: val,
      isEncargo: enc
    });
  });

  // Totais por Origem (Encargos SOMAM com o Principal)
  const nacCPTotal = nacCPPrincipal + nacCPEncargos;
  const nacLPTotal = nacLPPrincipal + nacLPEncargos;
  const nacTotal = nacCPTotal + nacLPTotal;

  const estCPTotal = estCPPrincipal + estCPEncargos;
  const estLPTotal = estLPPrincipal + estLPEncargos;
  const estTotal = estCPTotal + estLPTotal;

  // Totais Gerais
  const debtCPTotal = nacCPTotal + estCPTotal;
  const debtLPTotal = nacLPTotal + estLPTotal;
  const debtTotalGeral = debtCPTotal + debtLPTotal;

  // Disponível (Caixa & Bancos do mês selecionado)
  const caixaTotal = extractMetric(dataAtual.balanco, '1.1.1.1', activeDebtMes) + extractMetric(dataAtual.balanco, '1.1.1.2', activeDebtMes);
  const dividaLiquidaCaixa = debtTotalGeral - caixaTotal;

  const pctDebtNac = debtTotalGeral > 0 ? (nacTotal / debtTotalGeral) * 100 : 0;
  const pctDebtEst = debtTotalGeral > 0 ? (estTotal / debtTotalGeral) * 100 : 0;
  const pctDebtCP = debtTotalGeral > 0 ? (debtCPTotal / debtTotalGeral) * 100 : 0;
  const pctDebtLP = debtTotalGeral > 0 ? (debtLPTotal / debtTotalGeral) * 100 : 0;

  // Comparativo com o Mês Anterior (MoM da Dívida)
  let prevMonthDebt = 0;
  let prevMonthCaixa = 0;
  if (activeDebtMes > 1) {
    const prevM = activeDebtMes - 1;
    (dataAtual.balanco || []).forEach(r => {
      if (r.mes !== prevM) return;
      const val = Math.abs(r.saldoAcumulado || 0);
      if (isDebtCP(r.conta) || isDebtLP(r.conta)) prevMonthDebt += val;
      if (r.conta.startsWith('1.1.1.1') || r.conta.startsWith('1.1.1.2')) prevMonthCaixa += (r.saldoAcumulado || 0);
    });
  }
  const diffDebtMoM = prevMonthDebt > 0 ? ((debtTotalGeral - prevMonthDebt) / prevMonthDebt) * 100 : null;
  const diffDebtVal = prevMonthDebt > 0 ? (debtTotalGeral - prevMonthDebt) : null;
  const diffCaixaMoM = prevMonthCaixa > 0 ? ((caixaTotal - prevMonthCaixa) / prevMonthCaixa) * 100 : null;

  // Filtragem para o Modal de Detalhamento
  const filteredDebtAccounts = debtAccounts.filter(acc => {
    if (debtFilter === 'nacional' && acc.origemKey !== 'nacional') return false;
    if (debtFilter === 'estrangeiro' && acc.origemKey !== 'estrangeiro') return false;
    if (debtFilter === 'nac_cp' && (acc.origemKey !== 'nacional' || acc.prazo !== 'Curto Prazo')) return false;
    if (debtFilter === 'nac_lp' && (acc.origemKey !== 'nacional' || acc.prazo !== 'Longo Prazo')) return false;
    if (debtFilter === 'est_cp' && (acc.origemKey !== 'estrangeiro' || acc.prazo !== 'Curto Prazo')) return false;
    if (debtFilter === 'est_lp' && (acc.origemKey !== 'estrangeiro' || acc.prazo !== 'Longo Prazo')) return false;
    if (debtFilter === 'cp_prin' && (acc.prazo !== 'Curto Prazo' || acc.isEncargo)) return false;
    if (debtFilter === 'cp_enc' && (acc.prazo !== 'Curto Prazo' || !acc.isEncargo)) return false;
    if (debtFilter === 'lp_prin' && (acc.prazo !== 'Longo Prazo' || acc.isEncargo)) return false;
    if (debtFilter === 'lp_enc' && (acc.prazo !== 'Longo Prazo' || !acc.isEncargo)) return false;

    if (debtSearch.trim()) {
      const s = debtSearch.toLowerCase();
      const matchDesc = (acc.descricao || '').toLowerCase().includes(s);
      const matchConta = (acc.conta || '').toLowerCase().includes(s);
      const matchEmp = (acc.empresaId || '').toLowerCase().includes(s);
      if (!matchDesc && !matchConta && !matchEmp) return false;
    }
    return true;
  });

  const filteredDebtTotal = filteredDebtAccounts.reduce((sum, r) => sum + (r.valor || 0), 0);

  return (
    <div className="dashboard-view" style={{ paddingBottom: '2rem' }}>

      {/* PAINEL DE INSIGHTS E DIAGNÓSTICO FINANCEIRO */}
      <div className="glass-panel" style={{ 
        padding: '1.5rem', 
        marginBottom: '2rem', 
        borderLeft: '4px solid #9C27B0',
        background: 'linear-gradient(135deg, rgba(156, 39, 176, 0.08), rgba(20, 20, 25, 0.7))'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.5rem' }}>💡</span> Diagnóstico Executivo & Insights ({periodLabel})
          </h3>
          {hasPrevData && (
            <span style={{ background: 'rgba(255,255,255,0.08)', color: '#aaa', fontSize: '0.8rem', padding: '4px 12px', borderRadius: '20px' }}>
              Base de Comparação: <b>{prevPeriodLabel}</b>
            </span>
          )}
        </div>

        {/* Banner do Diagnóstico Inteligente */}
        <div style={{ 
          background: 'rgba(0, 0, 0, 0.35)', 
          borderLeft: '3px solid #AB47BC', 
          padding: '0.9rem 1.2rem', 
          borderRadius: '6px', 
          marginBottom: '1.5rem',
          color: '#E1BEE7',
          fontSize: '0.95rem',
          lineHeight: '1.5'
        }}>
          <b>Resumo Estratégico:</b> {diagnosticoTexto}
        </div>

        {/* Grid de 4 Cards de Destaque */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          
          {/* Card 1: Comparativo com o Período Anterior */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '1.2rem', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.8rem', color: '#90CAF9', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📈</span> Variação vs. {prevPeriodLabel || 'Anterior'}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span style={{ color: '#ccc', fontSize: '0.85rem' }}>Faturamento:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#fff', fontSize: '0.85rem' }}>{formatCurrency(fatAtual)}</span>
                {renderBadgeDiff(diffFat)}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span style={{ color: '#ccc', fontSize: '0.85rem' }}>Custos (CMV):</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#fff', fontSize: '0.85rem' }}>{formatCurrency(custoAtual)}</span>
                {renderBadgeDiff(diffCusto, true)}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span style={{ color: '#ccc', fontSize: '0.85rem' }}>Despesas Oper.:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#fff', fontSize: '0.85rem' }}>{formatCurrency(despAtual)}</span>
                {renderBadgeDiff(diffDesp, true)}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color: '#aaa', fontSize: '0.85rem' }}>Lucro Bruto:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: lucroBrutoAtual >= 0 ? '#81C784' : '#FF5252', fontWeight: 'bold', fontSize: '0.85rem' }}>{formatCurrency(lucroBrutoAtual)}</span>
                {renderBadgeDiff(diffLucroBruto)}
              </div>
            </div>
          </div>

          {/* Card 2: Margens & Rentabilidade */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '1.2rem', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.8rem', color: '#A5D6A7', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>💎</span> Margens & Lucratividade
            </div>

            <div style={{ marginBottom: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#ccc' }}>Margem Bruta:</span>
                <strong style={{ color: margemBruta >= 20 ? '#81C784' : '#FFCA28' }}>{margemBruta.toFixed(1)}%</strong>
              </div>
              <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, margemBruta))}%`, background: margemBruta >= 20 ? '#4CAF50' : '#FFB300', borderRadius: '3px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#ccc' }}>Margem EBIT (Operacional):</span>
                <strong style={{ color: margemEbit >= 10 ? '#81C784' : margemEbit > 0 ? '#64B5F6' : '#FF5252' }}>{margemEbit.toFixed(1)}%</strong>
              </div>
              <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, margemEbit * 3))}%`, background: margemEbit >= 10 ? '#4CAF50' : margemEbit > 0 ? '#2196F3' : '#F44336', borderRadius: '3px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.85rem' }}>
              <span style={{ color: '#aaa' }}>EBIT em Valor:</span>
              <strong style={{ color: ebitAtual >= 0 ? '#81C784' : '#FF5252' }}>{formatCurrency(ebitAtual)}</strong>
            </div>
          </div>

          {/* Card 3: Eficiência & Estrutura Operacional */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '1.2rem', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.8rem', color: '#FFE082', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⚖️</span> Estrutura de Custos
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.85rem' }}>
              <span style={{ color: '#ccc' }}>Custos s/ Receita:</span>
              <strong style={{ color: '#FFCA28' }}>{percCustos.toFixed(1)}%</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.85rem' }}>
              <span style={{ color: '#ccc' }}>Despesas s/ Receita:</span>
              <strong style={{ color: '#90CAF9' }}>{percDespesas.toFixed(1)}%</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.85rem' }}>
              <span style={{ color: '#ccc' }}>Sobra Operacional:</span>
              <strong style={{ color: margemEbit >= 0 ? '#81C784' : '#FF5252' }}>{margemEbit.toFixed(1)}%</strong>
            </div>

            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              Total de Custos + Despesas consom <b>{(percCustos + percDespesas).toFixed(1)}%</b> do faturamento líquido.
            </div>
          </div>

          {/* Card 4: Recordes do Ano */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '1.2rem', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.8rem', color: '#CE93D8', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🏆</span> Destaques do Ano ({selectedAno})
            </div>

            <div style={{ marginBottom: '0.6rem', fontSize: '0.85rem' }}>
              <span style={{ color: '#aaa', display: 'block', fontSize: '0.75rem' }}>Melhor Mês de Vendas:</span>
              <strong style={{ color: '#4CAF50' }}>{melhorMesFat || '-'}</strong>
              {melhorMesFat && <span style={{ color: '#ccc', fontSize: '0.8rem' }}> ({formatCurrency(maxFat)})</span>}
            </div>

            <div style={{ marginBottom: '0.6rem', fontSize: '0.85rem' }}>
              <span style={{ color: '#aaa', display: 'block', fontSize: '0.75rem' }}>Pico de Eficiência (Margem EBIT):</span>
              <strong style={{ color: '#2196F3' }}>{melhorMesEbit || '-'}</strong>
              {melhorMesEbit && <span style={{ color: '#ccc', fontSize: '0.8rem' }}> ({maxEbit.toFixed(1)}%)</span>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.85rem' }}>
              <span style={{ color: '#aaa' }}>Média Mensal:</span>
              <strong style={{ color: '#fff' }}>{formatCurrency(mediaMensalFat)}</strong>
            </div>
          </div>

        </div>
      </div>

      {/* PAINEL DE ENDIVIDAMENTO & FINANCIAMENTOS (NACIONAL VS ESTRANGEIRO) */}
      <div className="glass-panel" style={{ 
        padding: '1.8rem', 
        marginBottom: '2rem', 
        borderLeft: '4px solid #3F51B5',
        background: 'linear-gradient(135deg, rgba(63, 81, 181, 0.08), rgba(20, 20, 25, 0.7))'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.6rem' }}>🏛️</span> Endividamento & Financiamentos ({debtPeriodLabel})
              </h3>

              {/* Seletor Rápido de Mês de Análise */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.4)', padding: '3px 10px', borderRadius: '8px', border: '1px solid #3F51B5' }}>
                <span style={{ fontSize: '0.8rem', color: '#90CAF9', fontWeight: 'bold' }}>Mês:</span>
                <select
                  value={activeDebtMes}
                  onChange={(e) => setDebtSelectedMes(parseInt(e.target.value))}
                  style={{
                    background: 'transparent',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 'bold',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1} style={{ background: '#222', color: '#fff' }}>
                      {meses[i]}/{selectedAno}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p style={{ margin: '0.4rem 0 0 0', color: '#aaa', fontSize: '0.88rem' }}>
              Estrutura Contábil: <b>Moeda Nacional (2.1.1.2.02 / 2.3.1.1.02)</b> vs. <b>Estrangeira / FINIMP (2.1.1.2.03 / 2.3.1.1.03)</b> • Encargos somam com a dívida.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {diffDebtMoM !== null && diffDebtVal !== null && (
              <span style={{ 
                background: diffDebtMoM > 0 ? 'rgba(244, 67, 54, 0.15)' : 'rgba(76, 175, 80, 0.15)',
                color: diffDebtMoM > 0 ? '#FF8A80' : '#81C784',
                fontSize: '0.85rem',
                padding: '6px 14px',
                borderRadius: '8px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {diffDebtMoM > 0 ? '↑ +' : '↓ '}{Math.abs(diffDebtMoM).toFixed(1)}% 
                ({diffDebtVal >= 0 ? '+' : '-'}{formatCurrency(Math.abs(diffDebtVal))}) vs. Mês Anterior
              </span>
            )}
            <button
              onClick={() => setShowDebtModal(true)}
              style={{
                background: '#3F51B5',
                color: '#fff',
                border: 'none',
                padding: '0.65rem 1.3rem',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(63, 81, 181, 0.3)',
                transition: 'background 0.2s'
              }}
            >
              <span>🔍</span> Detalhar Contas ({debtAccounts.length})
            </button>
          </div>
        </div>

        {/* Grid dos 3 Cards de Endividamento com Design Espaçoso e Elegante */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: '1.5rem' }}>
          
          {/* Card 1: Moeda Nacional */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(76, 175, 80, 0.35)', padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: '#81C784', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🇧🇷</span> Moeda Nacional (2.1.1.2.02 / 2.3.1.1.02)
              </span>
              <span style={{ background: 'rgba(76, 175, 80, 0.15)', color: '#81C784', fontSize: '0.8rem', padding: '3px 10px', borderRadius: '6px', fontWeight: 'bold' }}>
                {pctDebtNac.toFixed(1)}% do Total
              </span>
            </div>

            {/* Curto Prazo */}
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.9rem 1rem', borderRadius: '8px', borderLeft: '3px solid #2196F3' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ color: '#90CAF9', fontWeight: 'bold', fontSize: '0.85rem' }}>Curto Prazo (CP):</span>
                <strong style={{ color: '#90CAF9', fontSize: '1.05rem' }}>{formatCurrency(nacCPTotal)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#aaa' }}>
                <span>Principal: <b style={{ color: '#ddd' }}>{formatCurrency(nacCPPrincipal)}</b></span>
                <span>Encargos: <b style={{ color: '#FFD54F' }}>+{formatCurrency(nacCPEncargos)}</b></span>
              </div>
            </div>

            {/* Longo Prazo */}
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.9rem 1rem', borderRadius: '8px', borderLeft: '3px solid #AB47BC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ color: '#CE93D8', fontWeight: 'bold', fontSize: '0.85rem' }}>Longo Prazo (LP):</span>
                <strong style={{ color: '#CE93D8', fontSize: '1.05rem' }}>{formatCurrency(nacLPTotal)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#aaa' }}>
                <span>Principal: <b style={{ color: '#ddd' }}>{formatCurrency(nacLPPrincipal)}</b></span>
                <span>Encargos: <b style={{ color: '#FFD54F' }}>+{formatCurrency(nacLPEncargos)}</b></span>
              </div>
            </div>

            {/* Total Nacional */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ color: '#ccc', fontSize: '0.9rem', fontWeight: '500' }}>Total Dívida Nacional:</span>
              <strong style={{ color: '#81C784', fontSize: '1.25rem' }}>{formatCurrency(nacTotal)}</strong>
            </div>
          </div>

          {/* Card 2: Moeda Estrangeira (FINIMP) */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(33, 150, 243, 0.35)', padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: '#64B5F6', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🌎</span> Moeda Estrangeira (2.1.1.2.03 / 2.3.1.1.03)
              </span>
              <span style={{ background: 'rgba(33, 150, 243, 0.15)', color: '#64B5F6', fontSize: '0.8rem', padding: '3px 10px', borderRadius: '6px', fontWeight: 'bold' }}>
                {pctDebtEst.toFixed(1)}% do Total
              </span>
            </div>

            {/* Curto Prazo */}
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.9rem 1rem', borderRadius: '8px', borderLeft: '3px solid #2196F3' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ color: '#90CAF9', fontWeight: 'bold', fontSize: '0.85rem' }}>Curto Prazo (CP):</span>
                <strong style={{ color: '#90CAF9', fontSize: '1.05rem' }}>{formatCurrency(estCPTotal)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#aaa' }}>
                <span>Principal: <b style={{ color: '#ddd' }}>{formatCurrency(estCPPrincipal)}</b></span>
                <span>Encargos: <b style={{ color: '#FFD54F' }}>+{formatCurrency(estCPEncargos)}</b></span>
              </div>
            </div>

            {/* Longo Prazo */}
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.9rem 1rem', borderRadius: '8px', borderLeft: '3px solid #AB47BC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ color: '#CE93D8', fontWeight: 'bold', fontSize: '0.85rem' }}>Longo Prazo (LP):</span>
                <strong style={{ color: '#CE93D8', fontSize: '1.05rem' }}>{formatCurrency(estLPTotal)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#aaa' }}>
                <span>Principal: <b style={{ color: '#ddd' }}>{formatCurrency(estLPPrincipal)}</b></span>
                <span>Encargos: <b style={{ color: '#FFD54F' }}>+{formatCurrency(estLPEncargos)}</b></span>
              </div>
            </div>

            {/* Total Estrangeira */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ color: '#ccc', fontSize: '0.9rem', fontWeight: '500' }}>Total Dívida Estrangeira:</span>
              <strong style={{ color: '#64B5F6', fontSize: '1.25rem' }}>{formatCurrency(estTotal)}</strong>
            </div>
          </div>

          {/* Card 3: Posição Total Consolidada & Caixa */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255, 193, 7, 0.35)', padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: '#FFE082', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>💳</span> Posição Total & Caixa ({debtPeriodLabel})
              </span>
              <span style={{ background: 'rgba(255, 193, 7, 0.15)', color: '#FFD54F', fontSize: '0.8rem', padding: '3px 10px', borderRadius: '6px', fontWeight: 'bold' }}>
                CP: {pctDebtCP.toFixed(0)}% | LP: {pctDebtLP.toFixed(0)}%
              </span>
            </div>

            {/* Detalhe Curto e Longo */}
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.9rem 1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#ccc' }}>Curto Prazo (CP Total):</span>
                <strong style={{ color: '#90CAF9', fontSize: '1rem' }}>{formatCurrency(debtCPTotal)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#ccc' }}>Longo Prazo (LP Total):</span>
                <strong style={{ color: '#CE93D8', fontSize: '1rem' }}>{formatCurrency(debtLPTotal)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', paddingTop: '0.4rem', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>= Dívida Total (CP + LP):</span>
                <strong style={{ color: '#FFD54F', fontSize: '1.05rem' }}>{formatCurrency(debtTotalGeral)}</strong>
              </div>
            </div>

            {/* Caixa e Dívida Líquida */}
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.9rem 1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#aaa' }}>(-) Disponível (Caixa & Bancos):</span>
                <strong style={{ color: '#81C784' }}>-{formatCurrency(caixaTotal)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                <span style={{ color: '#ccc', fontSize: '0.85rem', fontWeight: 'bold' }}>Dívida Líquida de Caixa:</span>
                <strong style={{ color: dividaLiquidaCaixa <= 0 ? '#81C784' : '#FFCA28', fontSize: '1.25rem' }}>{formatCurrency(dividaLiquidaCaixa)}</strong>
              </div>
            </div>
          </div>

        </div>
      </div>
      {/* MODAL DE DETALHAMENTO DAS CONTAS DE ENDIVIDAMENTO COM FILTROS NACIONAL / ESTRANGEIRO */}
      {showDebtModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#1e1e24',
            border: '1px solid #3F51B5',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '1100px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.2rem 1.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(63, 81, 181, 0.15)'
            }}>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🔍</span> Detalhamento de Endividamento: Nacional vs. Estrangeiro
                </h3>
                <span style={{ color: '#aaa', fontSize: '0.85rem' }}>
                  {periodLabel} • <b>2.1.1.2.02 / 2.3.1.1.02</b> (Nacional) | <b>2.1.1.2.03 / 2.3.1.1.03</b> (Estrangeiro)
                </span>
              </div>
              <button
                onClick={() => setShowDebtModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Controls (Filtros + Busca) */}
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)' }}>
              {/* Abas de Filtro */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setDebtFilter('todos')}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: debtFilter === 'todos' ? '#3F51B5' : 'rgba(255,255,255,0.06)',
                    color: debtFilter === 'todos' ? '#fff' : '#aaa',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: debtFilter === 'todos' ? 'bold' : 'normal'
                  }}
                >
                  Todas ({debtAccounts.length})
                </button>
                <button
                  onClick={() => setDebtFilter('nacional')}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: debtFilter === 'nacional' ? '#4CAF50' : 'rgba(255,255,255,0.06)',
                    color: debtFilter === 'nacional' ? '#fff' : '#aaa',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: debtFilter === 'nacional' ? 'bold' : 'normal'
                  }}
                >
                  🇧🇷 Nacional ({debtAccounts.filter(a => a.origemKey === 'nacional').length})
                </button>
                <button
                  onClick={() => setDebtFilter('nac_cp')}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: debtFilter === 'nac_cp' ? '#2196F3' : 'rgba(255,255,255,0.06)',
                    color: debtFilter === 'nac_cp' ? '#fff' : '#aaa',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: debtFilter === 'nac_cp' ? 'bold' : 'normal'
                  }}
                >
                  🇧🇷 Nac. Curto Prazo
                </button>
                <button
                  onClick={() => setDebtFilter('nac_lp')}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: debtFilter === 'nac_lp' ? '#9C27B0' : 'rgba(255,255,255,0.06)',
                    color: debtFilter === 'nac_lp' ? '#fff' : '#aaa',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: debtFilter === 'nac_lp' ? 'bold' : 'normal'
                  }}
                >
                  🇧🇷 Nac. Longo Prazo
                </button>
                <button
                  onClick={() => setDebtFilter('estrangeiro')}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: debtFilter === 'estrangeiro' ? '#00ACC1' : 'rgba(255,255,255,0.06)',
                    color: debtFilter === 'estrangeiro' ? '#fff' : '#aaa',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: debtFilter === 'estrangeiro' ? 'bold' : 'normal'
                  }}
                >
                  🌎 Estrangeiro ({debtAccounts.filter(a => a.origemKey === 'estrangeiro').length})
                </button>
                <button
                  onClick={() => setDebtFilter('est_cp')}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: debtFilter === 'est_cp' ? '#0288D1' : 'rgba(255,255,255,0.06)',
                    color: debtFilter === 'est_cp' ? '#fff' : '#aaa',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: debtFilter === 'est_cp' ? 'bold' : 'normal'
                  }}
                >
                  🌎 Est. Curto Prazo
                </button>
                <button
                  onClick={() => setDebtFilter('est_lp')}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: debtFilter === 'est_lp' ? '#7B1FA2' : 'rgba(255,255,255,0.06)',
                    color: debtFilter === 'est_lp' ? '#fff' : '#aaa',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: debtFilter === 'est_lp' ? 'bold' : 'normal'
                  }}
                >
                  🌎 Est. Longo Prazo
                </button>
              </div>

              {/* Busca */}
              <div style={{ minWidth: '220px', flex: '1', maxWidth: '320px' }}>
                <input
                  type="text"
                  placeholder="Pesquisar banco, contrato ou conta..."
                  value={debtSearch}
                  onChange={(e) => setDebtSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.8rem',
                    borderRadius: '6px',
                    background: '#121216',
                    border: '1px solid #444',
                    color: '#fff',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
            </div>

            {/* Tabela de Contas com Rolagem */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#aaa', borderBottom: '1px solid #444' }}>
                    <th style={{ padding: '10px 12px' }}>Conta</th>
                    <th style={{ padding: '10px 12px' }}>Descrição da Operação</th>
                    <th style={{ padding: '10px 12px' }}>Origem</th>
                    <th style={{ padding: '10px 12px' }}>Prazo & Tipo</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Saldo (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDebtAccounts.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                        Nenhuma conta encontrada com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredDebtAccounts.map((acc, idx) => {
                      const isEnc = acc.isEncargo;
                      const isNac = acc.origemKey === 'nacional';
                      return (
                        <tr 
                          key={acc.id || idx} 
                          style={{ 
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'
                          }}
                        >
                          <td style={{ padding: '8px 12px', color: '#90CAF9', fontFamily: 'monospace' }}>
                            {acc.conta}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#fff', fontWeight: '500' }}>
                            {acc.descricao}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{
                              background: isNac ? 'rgba(76, 175, 80, 0.15)' : 'rgba(0, 172, 193, 0.15)',
                              color: isNac ? '#81C784' : '#4DD0E1',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold'
                            }}>
                              {isNac ? '🇧🇷 Nacional' : '🌎 Estrangeiro'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{
                              background: acc.prazo === 'Curto Prazo' ? (isEnc ? 'rgba(244, 67, 54, 0.15)' : 'rgba(33, 150, 243, 0.15)') : (isEnc ? 'rgba(233, 30, 99, 0.15)' : 'rgba(156, 39, 176, 0.15)'),
                              color: acc.prazo === 'Curto Prazo' ? (isEnc ? '#FF8A80' : '#90CAF9') : (isEnc ? '#F48FB1' : '#CE93D8'),
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold'
                            }}>
                              {acc.prazo} • {isEnc ? '(-) Encargo' : 'Principal'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', color: isEnc ? '#FF8A80' : '#fff' }}>
                            {isEnc ? '-' : ''}{formatCurrency(acc.valor)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer com Totais */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.3)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div style={{ fontSize: '0.85rem', color: '#aaa' }}>
                Exibindo <b>{filteredDebtAccounts.length}</b> de <b>{debtAccounts.length}</b> contas de dívida
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: '#ccc' }}>
                  Saldo Líquido Selecionado: <strong style={{ color: filteredDebtTotal >= 0 ? '#64B5F6' : '#FF8A80', fontSize: '1.1rem' }}>{formatCurrency(filteredDebtTotal)}</strong>
                </span>
                <button
                  onClick={() => setShowDebtModal(false)}
                  style={{
                    background: '#444',
                    color: '#fff',
                    border: 'none',
                    padding: '0.5rem 1.2rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.85rem'
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      <div className="kpi-grid" style={{ marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #4CAF50' }}>
          <h3 style={{ marginBottom: '1rem', color: '#fff', fontSize: '1.2rem', textAlign: 'center' }}>Receitas: {periodLabel}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>
              <span style={{ color: '#aaa' }}>Receita Venda</span> 
              <div><span style={{ fontWeight: 'bold', marginRight: '8px' }}>{formatCurrency(recVendaAtual)}</span> <span>{renderArrow(calcDiff(recVendaAtual, recVendaAnt))}</span></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>
              <span style={{ color: '#aaa' }}>Receita Revenda</span> 
              <div><span style={{ fontWeight: 'bold', marginRight: '8px' }}>{formatCurrency(recRevendaAtual)}</span> <span>{renderArrow(calcDiff(recRevendaAtual, recRevendaAnt))}</span></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>
              <span style={{ color: '#aaa' }}>Receita Serviço</span> 
              <div><span style={{ fontWeight: 'bold', marginRight: '8px' }}>{formatCurrency(recServicoAtual)}</span> <span>{renderArrow(calcDiff(recServicoAtual, recServicoAnt))}</span></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>
              <span style={{ color: '#aaa' }}>Receita Locação</span> 
              <div><span style={{ fontWeight: 'bold', marginRight: '8px' }}>{formatCurrency(recLocacaoAtual)}</span> <span>{renderArrow(calcDiff(recLocacaoAtual, recLocacaoAnt))}</span></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#aaa' }}>Receita Exportação</span> 
              <div><span style={{ fontWeight: 'bold', marginRight: '8px' }}>{formatCurrency(recExportacaoAtual)}</span> <span>{renderArrow(calcDiff(recExportacaoAtual, recExportacaoAnt))}</span></div>
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <div className="kpi-compare">
                <span style={{ color: '#aaa' }}>Receita: {periodLabel}</span>
                <span style={{ color: '#aaa', fontSize: '0.9rem' }}>{periodLabelAnt}</span>
              </div>
              <div className="kpi-compare" style={{ marginTop: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>{formatCurrency(recMesAtual)} {renderArrow(calcDiff(recMesAtual, recMesAnt))}</span>
                <span style={{ color: '#aaa' }}>{formatCurrency(recMesAnt)}</span>
              </div>
            </div>
            
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
              <div className="kpi-compare">
                <span style={{ color: '#aaa' }}>Despesas: {periodLabel}</span>
                <span style={{ color: '#aaa', fontSize: '0.9rem' }}>{periodLabelAnt}</span>
              </div>
              <div className="kpi-compare" style={{ marginTop: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#f44336' }}>{formatCurrency(despMesAtual)} {renderArrow(calcDiff(Math.abs(despMesAtual), Math.abs(despMesAnt)))}</span>
                <span style={{ color: '#aaa' }}>{formatCurrency(despMesAnt)}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
              <div className="kpi-compare">
                <span style={{ color: '#aaa' }}>Custos: {periodLabel}</span>
                <span style={{ color: '#aaa', fontSize: '0.9rem' }}>{periodLabelAnt}</span>
              </div>
              <div className="kpi-compare" style={{ marginTop: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#f44336' }}>{formatCurrency(custoMesAtual)} {renderArrow(calcDiff(Math.abs(custoMesAtual), Math.abs(custoMesAnt)))}</span>
                <span style={{ color: '#aaa' }}>{formatCurrency(custoMesAnt)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', borderTop: '4px solid #f44336' }}>
          <h3 style={{ marginBottom: '1rem', color: '#fff', fontSize: '1.2rem', textAlign: 'center' }}>Despesas / Custos: {periodLabel}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>
              <span style={{ color: '#aaa' }}>Despesa com Vendas</span> 
              <div><span style={{ fontWeight: 'bold', marginRight: '8px' }}>{formatCurrency(despVendasMes)}</span> <span>{renderArrow(calcDiff(Math.abs(despVendasMes), Math.abs(despVendasMesAnt)))}</span></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>
              <span style={{ color: '#aaa' }}>Despesas Admin.</span> 
              <div><span style={{ fontWeight: 'bold', marginRight: '8px' }}>{formatCurrency(despAdminMes)}</span> <span>{renderArrow(calcDiff(Math.abs(despAdminMes), Math.abs(despAdminMesAnt)))}</span></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>
              <span style={{ color: '#aaa' }}>Custo Vendas</span> 
              <div><span style={{ fontWeight: 'bold', marginRight: '8px' }}>{formatCurrency(custoVendasMes)}</span> <span>{renderArrow(calcDiff(Math.abs(custoVendasMes), Math.abs(custoVendasMesAnt)))}</span></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>
              <span style={{ color: '#aaa' }}>Custo Revendas</span> 
              <div><span style={{ fontWeight: 'bold', marginRight: '8px' }}>{formatCurrency(custoRevendasMes)}</span> <span>{renderArrow(calcDiff(Math.abs(custoRevendasMes), Math.abs(custoRevendasMesAnt)))}</span></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#aaa' }}>Custo Serviços</span> 
              <div><span style={{ fontWeight: 'bold', marginRight: '8px' }}>{formatCurrency(custoServicoMes)}</span> <span>{renderArrow(calcDiff(Math.abs(custoServicoMes), Math.abs(custoServicoMesAnt)))}</span></div>
            </div>
          </div>
        </div>

        {/* Gráfico Acumulados Pie */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ marginBottom: '0.5rem', color: '#fff', fontSize: '1.2rem', textAlign: 'center' }}>COMPOSIÇÃO: {periodLabel.toUpperCase()}</h3>
          <div style={{ width: '100%', height: '220px' }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => formatCurrency(val)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        {/* Custos x Faturamento */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '1.3rem' }}>CUSTOS X FATURAMENTO</h3>
          <div style={{ width: '100%', height: '350px' }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                <XAxis dataKey="mes" stroke="#aaa" />
                <YAxis stroke="#aaa" tickFormatter={(v) => `R$ ${(v/1000000).toFixed(1)}M`} />
                <Tooltip formatter={(val) => formatCurrency(val)} contentStyle={{ backgroundColor: 'rgba(25,25,25,0.9)', borderColor: 'var(--color-border)' }} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line type="monotone" dataKey="Faturamento" name="Faturamento R$" stroke="#4CAF50" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                <Line type="monotone" dataKey="Custos" name="Valor R$" stroke="#f44336" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Estoque */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '1.3rem' }}>EVOLUÇÃO DO ESTOQUE</h3>
          <div style={{ width: '100%', height: '350px' }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                <XAxis dataKey="mes" stroke="#aaa" />
                <YAxis stroke="#aaa" tickFormatter={(v) => `R$ ${(v/1000000).toFixed(1)}M`} />
                <Tooltip formatter={(val) => formatCurrency(val)} contentStyle={{ backgroundColor: 'rgba(25,25,25,0.9)', borderColor: 'var(--color-border)' }} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line type="monotone" dataKey="Estoque" name="Estoque Total" stroke="#dca840" strokeWidth={4} dot={{fill: '#dca840'}} activeDot={{r: 8}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* GRÁFICO DE EVOLUÇÃO DO ENDIVIDAMENTO X DISPONIBILIDADES COM PROJEÇÃO 3 ANOS & BREAK-EVEN */}
      <div className="glass-panel" style={{ padding: '2rem', marginTop: '2rem', borderLeft: '4px solid #3F51B5' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>📈</span> Evolução do Endividamento vs. Disponibilidades {chartHorizon === '3anos' ? `(Horizonte 3 Anos: ${selectedAno} a ${selectedAno + 2})` : `- ${selectedAno}`}
            </h3>
            <p style={{ margin: '0.3rem 0 0 0', color: '#aaa', fontSize: '0.85rem' }}>
              {chartHorizon === '3anos'
                ? 'Projeção plurianual dinâmica de Dívida Total (CP + LP) vs. Caixa Disponível para determinação do Break-Even.'
                : 'Acompanhamento mensal da Dívida Total (Curto + Longo Prazo), Caixa Disponível e Dívida Líquida.'}
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Toggle de Horizonte */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '3px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                type="button"
                onClick={() => setChartHorizon('ano')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: chartHorizon === 'ano' ? '#3F51B5' : 'transparent',
                  color: chartHorizon === 'ano' ? '#fff' : '#aaa',
                  transition: 'all 0.2s'
                }}
              >
                📅 {selectedAno} (12M)
              </button>
              <button
                type="button"
                onClick={() => setChartHorizon('3anos')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: chartHorizon === '3anos' ? 'linear-gradient(135deg, #3F51B5 0%, #00B0FF 100%)' : 'transparent',
                  color: chartHorizon === '3anos' ? '#fff' : '#aaa',
                  boxShadow: chartHorizon === '3anos' ? '0 2px 8px rgba(63,81,181,0.4)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                🚀 Visão 3 Anos (Break-Even)
              </button>
            </div>

            {/* Botão de Simulação & Premissas */}
            <button
              type="button"
              onClick={() => setShowProjModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(0,230,118,0.4)',
                background: 'rgba(0,230,118,0.12)',
                color: '#00E676',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(0,230,118,0.15)'
              }}
            >
              <span>🎯</span> Simulação & Premissas
            </button>
          </div>
        </div>

        {/* EXECUTIVE BREAK-EVEN BANNER */}
        {breakEvenMonth ? (
          <div style={{
            background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.12) 0%, rgba(33, 150, 243, 0.08) 100%)',
            border: '1px solid rgba(0, 230, 118, 0.35)',
            borderRadius: '12px',
            padding: '1.1rem 1.4rem',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            boxShadow: '0 6px 20px rgba(0, 230, 118, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ 
                fontSize: '2rem', 
                background: 'rgba(0, 230, 118, 0.2)', 
                width: '50px', 
                height: '50px', 
                borderRadius: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                border: '1px solid rgba(0, 230, 118, 0.4)'
              }}>
                🎯
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 800, 
                    letterSpacing: '0.8px', 
                    textTransform: 'uppercase', 
                    color: '#00E676', 
                    background: 'rgba(0, 230, 118, 0.15)', 
                    padding: '2px 8px', 
                    borderRadius: '4px' 
                  }}>
                    {breakEvenMonth.isProjetado ? 'Break-Even Projetado' : 'Break-Even Realizado'}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#bbb' }}>
                    Ponto de inflexão em que as disponibilidades superam o endividamento
                  </span>
                </div>
                <div style={{ color: '#fff', fontSize: '1.3rem', fontWeight: 800, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Previsão: {breakEvenMonth.fullLabel}</span>
                  <span style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: 600, 
                    color: '#00E676', 
                    background: 'rgba(0, 230, 118, 0.1)', 
                    padding: '2px 10px', 
                    borderRadius: '20px' 
                  }}>
                    {breakEvenMonth.mesesRestantes === 0 ? 'Alcançado no mês atual!' : `em ${breakEvenMonth.mesesRestantes} meses`}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Caixa Projetado</div>
                <div style={{ color: '#4CAF50', fontWeight: 700, fontSize: '1.1rem' }}>{formatCurrency(breakEvenMonth.caixa)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dívida Restante</div>
                <div style={{ color: '#FF5252', fontWeight: 700, fontSize: '1.1rem' }}>{formatCurrency(breakEvenMonth.divida)}</div>
              </div>
              <div style={{ textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1.2rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dívida Líquida</div>
                <div style={{ color: '#00E676', fontWeight: 800, fontSize: '1.1rem' }}>{formatCurrency(breakEvenMonth.divida - breakEvenMonth.caixa)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(255, 152, 0, 0.08)',
            border: '1px solid rgba(255, 152, 0, 0.3)',
            borderRadius: '12px',
            padding: '1rem 1.4rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.6rem' }}>⚠️</span>
              <div>
                <div style={{ color: '#FFA726', fontWeight: 700, fontSize: '0.95rem' }}>
                  Break-Even não alcançado no horizonte de 3 anos ({selectedAno} a {selectedAno + 2})
                </div>
                <div style={{ color: '#aaa', fontSize: '0.8rem', marginTop: '2px' }}>
                  Com as premissas atuais de geração de caixa ({formatCurrency(projAssumptions.monthlyCashGen)}/mês) e amortização ({formatCurrency(projAssumptions.monthlyAmortCP + projAssumptions.monthlyAmortLP)}/mês), a dívida ainda não converge a zero.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowProjModal(true)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                background: 'rgba(255, 152, 0, 0.2)',
                border: '1px solid rgba(255, 152, 0, 0.4)',
                color: '#FFA726',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Ajustar Premissas
            </button>
          </div>
        )}

        <div style={{ width: '100%', height: '420px' }}>
          <ResponsiveContainer>
            <LineChart data={displayedDebtChartData} margin={{ top: 25, right: 30, left: 20, bottom: 10 }}>
              <XAxis 
                dataKey="mesKey" 
                stroke="#aaa" 
                interval={chartHorizon === '3anos' ? 2 : 0} 
                tick={{ fontSize: 11 }}
              />
              <YAxis stroke="#aaa" tickFormatter={(v) => `R$ ${(v/1000000).toFixed(1)}M`} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const item = payload[0]?.payload;
                if (!item) return null;

                const isProj = item.isProjetado;
                const isBe = item.isBreakEven;

                return (
                  <div style={{
                    backgroundColor: 'rgba(20, 22, 30, 0.96)',
                    border: isBe ? '2px solid #00E676' : isProj ? '1px solid #AB47BC' : '1px solid #3F51B5',
                    borderRadius: '10px',
                    padding: '14px 18px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
                    minWidth: '250px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
                      <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.95rem' }}>{item.fullLabel || label}</span>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: isProj ? 'rgba(171, 71, 188, 0.25)' : 'rgba(33, 150, 243, 0.25)',
                        color: isProj ? '#CE93D8' : '#64B5F6',
                        border: isProj ? '1px solid rgba(171, 71, 188, 0.4)' : '1px solid rgba(33, 150, 243, 0.4)'
                      }}>
                        {isProj ? 'PROJETADO' : 'REAL CONTÁBIL'}
                      </span>
                    </div>

                    {isBe && (
                      <div style={{ marginBottom: '8px', background: 'rgba(0, 230, 118, 0.15)', border: '1px solid rgba(0, 230, 118, 0.4)', borderRadius: '6px', padding: '4px 8px', color: '#00E676', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🎯</span> Ponto de Equilíbrio / Break-Even!
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#FF5252' }}>
                        <span>Dívida Total:</span>
                        <strong>{formatCurrency(item.DividaTotal)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#90CAF9', paddingLeft: '10px', fontSize: '0.76rem' }}>
                        <span>• Curto Prazo (CP):</span>
                        <span>{formatCurrency(item.DividaCP)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#CE93D8', paddingLeft: '10px', fontSize: '0.76rem' }}>
                        <span>• Longo Prazo (LP):</span>
                        <span>{formatCurrency(item.DividaLP)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4CAF50', marginTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '4px' }}>
                        <span>Disponível / Caixa:</span>
                        <strong>{formatCurrency(item.DisponivelCaixa)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: item.DividaLiquidaCaixa <= 0 ? '#00E676' : '#FFCA28', marginTop: '2px' }}>
                        <span>Dívida Líquida:</span>
                        <strong>{formatCurrency(item.DividaLiquidaCaixa)}</strong>
                      </div>
                    </div>
                  </div>
                );
              }} />
              <Legend wrapperStyle={{ paddingTop: '15px' }} />

              {breakEvenMonth && (
                <ReferenceLine 
                  x={breakEvenMonth.mesKey} 
                  stroke="#00E676" 
                  strokeWidth={2} 
                  strokeDasharray="4 4" 
                  label={{ value: `🎯 Break-Even (${breakEvenMonth.mesAno})`, fill: '#00E676', position: 'top', fontSize: 11, fontWeight: 'bold' }} 
                />
              )}

              {lastRealPoint && (
                <ReferenceLine 
                  x={chartHorizon === '3anos' ? `${mesesAbrev[lastRealPoint.mes - 1]}/${String(lastRealPoint.ano).slice(-2)}` : mesesAbrev[lastRealPoint.mes - 1]} 
                  stroke="rgba(255,255,255,0.25)" 
                  strokeWidth={1} 
                  strokeDasharray="2 2" 
                  label={{ value: 'Real | Projeção →', fill: '#888', position: 'insideTopLeft', fontSize: 10 }} 
                />
              )}

              <Line type="monotone" dataKey="DividaTotal" name="Dívida Total (R$)" stroke="#FF5252" strokeWidth={3} dot={{r: 3}} activeDot={{r: 7}} />
              <Line type="monotone" dataKey="DividaCP" name="Curto Prazo (R$)" stroke="#2196F3" strokeWidth={2} dot={{r: 2}} />
              <Line type="monotone" dataKey="DividaLP" name="Longo Prazo (R$)" stroke="#AB47BC" strokeWidth={2} dot={{r: 2}} />
              <Line type="monotone" dataKey="DisponivelCaixa" name="Disponível / Caixa (R$)" stroke="#4CAF50" strokeWidth={3} dot={{r: 3}} activeDot={{r: 7}} />
              <Line type="monotone" dataKey="DividaLiquidaCaixa" name="Dívida Líq. Caixa (R$)" stroke="#FFCA28" strokeWidth={2} strokeDasharray="5 5" dot={{r: 2}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* MODAL DE SIMULAÇÃO DE PROJEÇÃO & BREAK-EVEN */}
      {showProjModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#1a1b23',
            border: '1px solid #3F51B5',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '1100px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.2rem 1.6rem',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(63, 81, 181, 0.15)'
            }}>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🎯</span> Motor de Projeção & Break-Even de Endividamento (Horizonte 3 Anos)
                </h3>
                <span style={{ color: '#aaa', fontSize: '0.85rem' }}>
                  Configure as premissas financeiras de geração de caixa e amortizações para determinar com precisão a data do Break-Even.
                </span>
              </div>
              <button
                onClick={() => setShowProjModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: 'none',
                  color: '#aaa',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {/* 1. Saldo Real de Partida */}
              <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#90CAF9', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    📌 Ponto de Partida Real Contábil ({mesesNome[lastRealPoint.mes - 1]} / {lastRealPoint.ano})
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#888' }}>
                    Último mês fechado com lançamentos contábeis no sistema
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.8rem 1rem', borderRadius: '8px', borderLeft: '3px solid #4CAF50' }}>
                    <div style={{ fontSize: '0.72rem', color: '#aaa' }}>Disponível / Caixa Base</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#4CAF50', marginTop: '2px' }}>{formatCurrency(lastRealPoint.mCaixa)}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.8rem 1rem', borderRadius: '8px', borderLeft: '3px solid #2196F3' }}>
                    <div style={{ fontSize: '0.72rem', color: '#aaa' }}>Dívida Curto Prazo Base</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#2196F3', marginTop: '2px' }}>{formatCurrency(lastRealPoint.mCP)}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.8rem 1rem', borderRadius: '8px', borderLeft: '3px solid #AB47BC' }}>
                    <div style={{ fontSize: '0.72rem', color: '#aaa' }}>Dívida Longo Prazo Base</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#AB47BC', marginTop: '2px' }}>{formatCurrency(lastRealPoint.mLP)}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.8rem 1rem', borderRadius: '8px', borderLeft: '3px solid #FF5252' }}>
                    <div style={{ fontSize: '0.72rem', color: '#aaa' }}>Dívida Total Base</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FF5252', marginTop: '2px' }}>{formatCurrency(lastRealPoint.mDividaTotal)}</div>
                  </div>
                </div>
              </div>

              {/* 2. Premissas Dinâmicas de Projeção */}
              <div style={{ marginBottom: '1.5rem', background: 'rgba(63, 81, 181, 0.08)', padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(63, 81, 181, 0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#00B0FF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ⚡ Premissas Mensais Dinâmicas (R$ / Mês)
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#aaa' }}>
                    Aplicadas mês a mês a partir do término do realizado
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#ccc', marginBottom: '4px', fontWeight: 600 }}>
                      Geração Mensal de Caixa (+R$/mês):
                    </label>
                    <input
                      type="number"
                      step="10000"
                      value={projAssumptions.monthlyCashGen}
                      onChange={(e) => setProjAssumptions(prev => ({ ...prev, monthlyCashGen: parseFloat(e.target.value) || 0 }))}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '8px',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#4CAF50',
                        fontSize: '1rem',
                        fontWeight: 700,
                        boxSizing: 'border-box'
                      }}
                    />
                    <span style={{ fontSize: '0.72rem', color: '#888', marginTop: '2px', display: 'block' }}>
                      Aporte/crescimento líquido médio do caixa mensal
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#ccc', marginBottom: '4px', fontWeight: 600 }}>
                      Amortização Dívida Curto Prazo (-R$/mês):
                    </label>
                    <input
                      type="number"
                      step="10000"
                      value={projAssumptions.monthlyAmortCP}
                      onChange={(e) => setProjAssumptions(prev => ({ ...prev, monthlyAmortCP: parseFloat(e.target.value) || 0 }))}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '8px',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#2196F3',
                        fontSize: '1rem',
                        fontWeight: 700,
                        boxSizing: 'border-box'
                      }}
                    />
                    <span style={{ fontSize: '0.72rem', color: '#888', marginTop: '2px', display: 'block' }}>
                      Pagamento mensal de principal CP (até zerar)
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#ccc', marginBottom: '4px', fontWeight: 600 }}>
                      Amortização Dívida Longo Prazo (-R$/mês):
                    </label>
                    <input
                      type="number"
                      step="10000"
                      value={projAssumptions.monthlyAmortLP}
                      onChange={(e) => setProjAssumptions(prev => ({ ...prev, monthlyAmortLP: parseFloat(e.target.value) || 0 }))}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '8px',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#AB47BC',
                        fontSize: '1rem',
                        fontWeight: 700,
                        boxSizing: 'border-box'
                      }}
                    />
                    <span style={{ fontSize: '0.72rem', color: '#888', marginTop: '2px', display: 'block' }}>
                      Pagamento mensal de principal LP (até zerar)
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Resumo Executivo do Break-Even Calculado */}
              <div style={{
                background: breakEvenMonth ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 152, 0, 0.1)',
                border: breakEvenMonth ? '1px solid rgba(0, 230, 118, 0.4)' : '1px solid rgba(255, 152, 0, 0.4)',
                borderRadius: '12px',
                padding: '1rem 1.4rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '1.8rem' }}>{breakEvenMonth ? '🎯' : '⚠️'}</span>
                  <div>
                    <div style={{ color: breakEvenMonth ? '#00E676' : '#FFA726', fontWeight: 800, fontSize: '1.05rem' }}>
                      {breakEvenMonth
                        ? `Break-Even Previsto para ${breakEvenMonth.fullLabel} (${breakEvenMonth.mesesRestantes} meses após a base)`
                        : `Break-Even não alcançado no horizonte de 3 anos com o ritmo atual`}
                    </div>
                    <div style={{ color: '#ccc', fontSize: '0.8rem', marginTop: '3px' }}>
                      {breakEvenMonth
                        ? `Neste mês, o Caixa atingirá ${formatCurrency(breakEvenMonth.caixa)}, cobrindo integralmente a dívida remanescente de ${formatCurrency(breakEvenMonth.divida)}.`
                        : `Aumente a geração de caixa ou as amortizações acima para que as curvas se cruzem nos próximos 36 meses.`}
                    </div>
                  </div>
                </div>
                {breakEvenMonth && (
                  <div style={{ background: 'rgba(0, 230, 118, 0.15)', padding: '6px 14px', borderRadius: '20px', color: '#00E676', fontWeight: 700, fontSize: '0.85rem' }}>
                    Superávit: +{formatCurrency(breakEvenMonth.sobraCaixa)}
                  </div>
                )}
              </div>

              {/* 4. Tabela de Detalhamento & Ajustes Finos (3 Anos) */}
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ padding: '0.8rem 1.2rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', background: 'rgba(255,255,255,0.03)' }}>
                  <div>
                    <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>
                      Detalhamento Mês a Mês ({projModalAnoTab})
                    </span>
                    <span style={{ color: '#888', fontSize: '0.78rem', marginLeft: '8px' }}>
                      (Edite pontualmente os valores nos meses projetados para ajustes sob medida)
                    </span>
                  </div>

                  {/* Abas dos 3 Anos */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {years3.map(yr => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setProjModalAnoTab(yr)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          background: projModalAnoTab === yr ? '#3F51B5' : 'rgba(255,255,255,0.06)',
                          color: projModalAnoTab === yr ? '#fff' : '#aaa'
                        }}
                      >
                        {yr} {yr === selectedAno ? '(Ano 1)' : yr === selectedAno + 1 ? '(Ano 2)' : '(Ano 3)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ padding: '8px 12px', color: '#aaa' }}>Mês</th>
                        <th style={{ padding: '8px 12px', color: '#aaa' }}>Status</th>
                        <th style={{ padding: '8px 12px', color: '#4CAF50', textAlign: 'right' }}>Caixa (R$)</th>
                        <th style={{ padding: '8px 12px', color: '#2196F3', textAlign: 'right' }}>Dívida CP (R$)</th>
                        <th style={{ padding: '8px 12px', color: '#AB47BC', textAlign: 'right' }}>Dívida LP (R$)</th>
                        <th style={{ padding: '8px 12px', color: '#FF5252', textAlign: 'right' }}>Dívida Total (R$)</th>
                        <th style={{ padding: '8px 12px', color: '#FFCA28', textAlign: 'right' }}>Dívida Líquida (R$)</th>
                        <th style={{ padding: '8px 12px', color: '#aaa', textAlign: 'center' }}>Break-Even?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                        const row = full36Months.find(d => d.ano === projModalAnoTab && d.mesNum === m);
                        if (!row) return null;
                        const ovKey = `${projModalAnoTab}-${m}`;
                        const ov = projOverrides[ovKey] || {};
                        const isOv = ov.caixa !== undefined || ov.dividaCP !== undefined || ov.dividaLP !== undefined;

                        return (
                          <tr
                            key={m}
                            style={{
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              background: row.isBreakEven ? 'rgba(0, 230, 118, 0.05)' : m % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'
                            }}
                          >
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#fff' }}>
                              {mesesNome[m - 1]} / {projModalAnoTab}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                background: row.isProjetado ? (isOv ? 'rgba(255, 193, 7, 0.2)' : 'rgba(171, 71, 188, 0.2)') : 'rgba(33, 150, 243, 0.2)',
                                color: row.isProjetado ? (isOv ? '#FFD54F' : '#CE93D8') : '#64B5F6',
                                border: row.isProjetado ? (isOv ? '1px solid rgba(255, 193, 7, 0.4)' : '1px solid rgba(171, 71, 188, 0.4)') : '1px solid rgba(33, 150, 243, 0.4)'
                              }}>
                                {row.isProjetado ? (isOv ? 'PROJ. (EDITADO)' : 'PROJETADO') : 'REAL CONTÁBIL'}
                              </span>
                            </td>
                            
                            {/* Caixa */}
                            <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                              {row.isProjetado ? (
                                <input
                                  type="number"
                                  placeholder={String(row.DisponivelCaixa)}
                                  value={ov.caixa !== undefined ? ov.caixa : ''}
                                  onChange={(e) => handleOverrideChange(projModalAnoTab, m, 'caixa', e.target.value)}
                                  style={{
                                    width: '120px',
                                    padding: '4px 6px',
                                    borderRadius: '4px',
                                    background: ov.caixa !== undefined ? 'rgba(76, 175, 80, 0.2)' : 'rgba(0,0,0,0.3)',
                                    border: ov.caixa !== undefined ? '1px solid #4CAF50' : '1px solid rgba(255,255,255,0.15)',
                                    color: '#4CAF50',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    textAlign: 'right'
                                  }}
                                />
                              ) : (
                                <span style={{ color: '#4CAF50', fontWeight: 600 }}>{formatCurrency(row.DisponivelCaixa)}</span>
                              )}
                            </td>

                            {/* Dívida CP */}
                            <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                              {row.isProjetado ? (
                                <input
                                  type="number"
                                  placeholder={String(row.DividaCP)}
                                  value={ov.dividaCP !== undefined ? ov.dividaCP : ''}
                                  onChange={(e) => handleOverrideChange(projModalAnoTab, m, 'dividaCP', e.target.value)}
                                  style={{
                                    width: '120px',
                                    padding: '4px 6px',
                                    borderRadius: '4px',
                                    background: ov.dividaCP !== undefined ? 'rgba(33, 150, 243, 0.2)' : 'rgba(0,0,0,0.3)',
                                    border: ov.dividaCP !== undefined ? '1px solid #2196F3' : '1px solid rgba(255,255,255,0.15)',
                                    color: '#2196F3',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    textAlign: 'right'
                                  }}
                                />
                              ) : (
                                <span style={{ color: '#2196F3', fontWeight: 600 }}>{formatCurrency(row.DividaCP)}</span>
                              )}
                            </td>

                            {/* Dívida LP */}
                            <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                              {row.isProjetado ? (
                                <input
                                  type="number"
                                  placeholder={String(row.DividaLP)}
                                  value={ov.dividaLP !== undefined ? ov.dividaLP : ''}
                                  onChange={(e) => handleOverrideChange(projModalAnoTab, m, 'dividaLP', e.target.value)}
                                  style={{
                                    width: '120px',
                                    padding: '4px 6px',
                                    borderRadius: '4px',
                                    background: ov.dividaLP !== undefined ? 'rgba(171, 71, 188, 0.2)' : 'rgba(0,0,0,0.3)',
                                    border: ov.dividaLP !== undefined ? '1px solid #AB47BC' : '1px solid rgba(255,255,255,0.15)',
                                    color: '#AB47BC',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    textAlign: 'right'
                                  }}
                                />
                              ) : (
                                <span style={{ color: '#AB47BC', fontWeight: 600 }}>{formatCurrency(row.DividaLP)}</span>
                              )}
                            </td>

                            {/* Dívida Total */}
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#FF5252' }}>
                              {formatCurrency(row.DividaTotal)}
                            </td>

                            {/* Dívida Líquida */}
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: row.DividaLiquidaCaixa <= 0 ? '#00E676' : '#FFCA28' }}>
                              {formatCurrency(row.DividaLiquidaCaixa)}
                            </td>

                            {/* Break-Even Status */}
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              {row.isBreakEven ? (
                                <span style={{ color: '#00E676', fontWeight: 800, fontSize: '0.78rem' }}>🎯 Sim</span>
                              ) : (
                                <span style={{ color: '#666', fontSize: '0.78rem' }}>-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1rem 1.6rem',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.3)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {saveProjStatus === 'saving' && (
                  <span style={{ color: '#64B5F6', fontSize: '0.85rem' }}>⏳ Gravando configurações no Supabase...</span>
                )}
                {saveProjStatus === 'success' && (
                  <span style={{ color: '#00E676', fontSize: '0.85rem', fontWeight: 700 }}>✓ Projeção corporativa salva com sucesso!</span>
                )}
                {saveProjStatus === 'error' && (
                  <span style={{ color: '#FF5252', fontSize: '0.85rem' }}>❌ Erro ao salvar projeção.</span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleResetOverrides}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: '#aaa',
                    border: '1px solid rgba(255,255,255,0.15)',
                    padding: '0.55rem 1.1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: 600
                  }}
                >
                  ↺ Limpar Ajustes Manuais
                </button>
                <button
                  type="button"
                  onClick={handleSaveProjection}
                  disabled={saveProjStatus === 'saving'}
                  style={{
                    background: 'linear-gradient(135deg, #2E7D32 0%, #4CAF50 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '0.55rem 1.3rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    boxShadow: '0 2px 10px rgba(46,125,50,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>💾</span> Salvar Projeção Corporativa
                </button>
                <button
                  type="button"
                  onClick={() => setShowProjModal(false)}
                  style={{
                    background: '#444',
                    color: '#fff',
                    border: 'none',
                    padding: '0.55rem 1.1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evolução EBIT */}
      <div className="glass-panel" style={{ padding: '2rem', marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '2rem', textAlign: 'center', color: '#fff' }}>Evolução da Margem EBIT (%) - {selectedAno}</h3>
        <div style={{ width: '100%', height: '350px' }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <XAxis dataKey="mes" stroke="#aaa" />
              <YAxis stroke="#aaa" tickFormatter={(value) => `${value.toFixed(0)}%`} />
              <Tooltip formatter={(value) => `${value.toFixed(2)}%`} contentStyle={{ backgroundColor: '#222', borderColor: '#444' }} />
              <Legend />
              <Line type="monotone" dataKey="EBIT" name="Margem EBIT" stroke="#2196F3" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
