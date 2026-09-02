import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LineChart, Line, PieChart, Pie, Legend } from 'recharts';
import { getHistorySeries } from '../utils/db';

export default function DashboardView({ selectedCompany, selectedAno, selectedMes, period, selectedTrimestre }) {
  const [loading, setLoading] = useState(true);
  const [dataAtual, setDataAtual] = useState({ dre: [], balanco: [] });
  const [dataAnterior, setDataAnterior] = useState({ dre: [], balanco: [] });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const atual = await getHistorySeries(selectedCompany, selectedAno);
        const anterior = await getHistorySeries(selectedCompany, selectedAno - 1);
        setDataAtual(atual);
        setDataAnterior(anterior);
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

  // Histórico Mensal para Linhas
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

    chartData.push({
      mes: meses[m - 1],
      Faturamento: faturamento,
      Custos: Math.abs(custos),
      Estoque: extractMetric(dataAtual.balanco, '1.1.1.6', m),
      EBIT: ebitMargin
    });
  }

  
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
