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

  return (
    <div className="dashboard-view" style={{ paddingBottom: '2rem' }}>
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
