import React, { useState, useEffect } from 'react';
import { getRawRecords, getSettings, saveSettings, updateRecord, addManualEntryToDB } from '../utils/db';

const DEFAULT_MEP_CONFIG = [
  {
    empresaId: 'logistica',
    nome: 'AGF LOGÍSTICA',
    tipo: 'nacional',
    participacao: 99.00,
    contaCustoHistorico: '13210100001',
    descCustoHistorico: 'CUSTO HISTORICO AGF LOGISTICA',
    contaEquivalencia: '13210100002',
    descEquivalencia: 'EQUIVALENCIA PATRIMONIAL AGF LOGISTICA',
    contaReceitaMEP: '3.1.2.1.01.00001',
    contaDespesaMEP: '4.3.1.1.01.00001',
    ativo: true
  },
  {
    empresaId: 'casa',
    nome: 'CASA DA ESCAVADEIRA',
    tipo: 'nacional',
    participacao: 99.00,
    contaCustoHistorico: '13210200001',
    descCustoHistorico: 'CUSTO HISTORICO CASA DA ESCAVADEIRA',
    contaEquivalencia: '13210200002',
    descEquivalencia: 'EQUIVALENCIA PATRIMONIAL CASA DA ESCAVADEIRA',
    contaReceitaMEP: '3.1.2.1.01.00002',
    contaDespesaMEP: '4.3.1.1.01.00002',
    ativo: true
  },
  {
    empresaId: 'equipamentos',
    nome: 'AGF EQUIPAMENTOS',
    tipo: 'nacional',
    participacao: 99.00,
    contaCustoHistorico: '13210300001',
    descCustoHistorico: 'CUSTO HISTORICO AGF EQUIPAMENTOS',
    contaEquivalencia: '13210300002',
    descEquivalencia: 'EQUIVALENCIA PATRIMONIAL AGF EQUIPAMENTOS',
    contaReceitaMEP: '3.1.2.1.01.00003',
    contaDespesaMEP: '4.3.1.1.01.00003',
    ativo: true
  },
  {
    empresaId: 'rompedores',
    nome: 'AGF ROMPEDORES',
    tipo: 'nacional',
    participacao: 99.00,
    contaCustoHistorico: '13210400001',
    descCustoHistorico: 'CUSTO HISTORICO AGF ROMPEDORES',
    contaEquivalencia: '13210400002',
    descEquivalencia: 'EQUIVALENCIA PATRIMONIAL AGF ROMPEDORES',
    contaReceitaMEP: '3.1.2.1.01.00004',
    contaDespesaMEP: '4.3.1.1.01.00004',
    ativo: true
  },
  {
    empresaId: 'europe',
    nome: 'AGF EUROPE, UNIPESSOAL LDA',
    tipo: 'exterior',
    participacao: 100.00,
    contaCustoHistorico: '13220100001',
    descCustoHistorico: 'CUSTO HISTORICO AGF EUROPE',
    contaEquivalencia: '13220100002',
    descEquivalencia: 'EQUIVALENCIA PATRIMONIAL AGF EUROPE',
    contaCapitalIntegralizar: '13220100003',
    descCapitalIntegralizar: 'CAPITAL A INTEGRALIZAR',
    contaReceitaMEP: '3.1.2.2.01.00001',
    contaDespesaMEP: '4.3.1.2.01.00001',
    ativo: true
  },
  {
    empresaId: 'kwezi',
    nome: 'KWEZI S.R.L',
    tipo: 'exterior',
    participacao: 100.00,
    contaCustoHistorico: '13220200001',
    descCustoHistorico: 'CUSTO HISTORICO KWEZI S.R.L',
    contaEquivalencia: '13220200002',
    descEquivalencia: 'EQUIVALENCIA PATRIMONIAL KWEZI S.R.L',
    contaReceitaMEP: '3.1.2.2.01.00002',
    contaDespesaMEP: '4.3.1.2.01.00002',
    ativo: true
  }
];

export default function EquivalenciaPatrimonialModule({ companies = [] }) {
  const [selectedHolding, setSelectedHolding] = useState('');
  const [selectedMes, setSelectedMes] = useState(new Date().getMonth() + 1);
  const [selectedAno, setSelectedAno] = useState(new Date().getFullYear());
  
  const [mepConfigs, setMepConfigs] = useState(DEFAULT_MEP_CONFIG);
  const [rawBalanco, setRawBalanco] = useState([]);
  const [rawDre, setRawDre] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [recordingSuccess, setRecordingSuccess] = useState(false);

  // Estados para edição/novo cadastro de investida no modal
  const [editingIndex, setEditingIndex] = useState(null);
  const [modalForm, setModalForm] = useState(null);

  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  useEffect(() => {
    loadMepSettings();
  }, [companies]);

  useEffect(() => {
    loadData();
  }, [selectedAno, selectedMes, selectedHolding]);

  const loadMepSettings = async () => {
    try {
      const saved = await getSettings('agf_mep_config');
      if (saved && Array.isArray(saved.configs) && saved.configs.length > 0) {
        setMepConfigs(saved.configs);
      }
      if (saved && saved.holdingId) {
        setSelectedHolding(saved.holdingId);
      } else {
        const hold = companies.find(c => 
          c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").includes('participacoes') ||
          c.id.includes('participacoes') ||
          c.name.includes('AGF PARTICIPAÇÕES')
        );
        if (hold) setSelectedHolding(hold.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveMepSettings = async (configs, holdingId = selectedHolding) => {
    try {
      await saveSettings('agf_mep_config', {
        configs,
        holdingId
      });
      setMepConfigs(configs);
    } catch (e) {
      console.error(e);
    }
  };

  const loadData = async () => {
    setIsProcessing(true);
    try {
      const data = await getRawRecords(selectedAno, selectedMes);
      
      // Buscar dados do ano inteiro ou mês anterior
      let prevBalancoData = [];
      if (selectedMes > 1) {
        const prevData = await getRawRecords(selectedAno, selectedMes - 1);
        prevBalancoData = prevData.balanco || [];
      } else {
        const prevYearData = await getRawRecords(selectedAno - 1, 12);
        prevBalancoData = prevYearData.balanco || [];
      }

      setRawBalanco([...(data.balanco || []), ...prevBalancoData]);
      setRawDre(data.dre || []);
    } catch (e) {
      console.error('Erro ao carregar dados de MEP:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Função para calcular o PL de uma investida em determinado mês/ano
  const calculatePL = (empresaId, mes, ano) => {
    const records = (rawBalanco || []).filter(r => r.empresaId === empresaId && r.mes === mes && r.ano === ano);
    if (records.length === 0) return 0;

    // Contas de PL no grupo 2.4 / 2.5 / 2.9
    const plAccounts = records.filter(r => 
      r.conta.startsWith('2.4') || 
      r.conta.startsWith('2.5') || 
      r.conta.startsWith('2.9') ||
      (r.descricao && (
        r.descricao.toLowerCase().includes('capital social') || 
        r.descricao.toLowerCase().includes('lucros acumulados') || 
        r.descricao.toLowerCase().includes('reserva de lucros') ||
        r.descricao.toLowerCase().includes('patrimonio liquido')
      ))
    );

    if (plAccounts.length > 0) {
      return plAccounts.reduce((sum, r) => sum + (r.saldoAcumulado || 0), 0);
    }

    // Fallback: Ativo - Passivo
    const totalAtivo = records.filter(r => r.conta.startsWith('1.')).reduce((sum, r) => sum + (r.saldoAcumulado || 0), 0);
    const passivoExigivel = records.filter(r => r.conta.startsWith('2.1') || r.conta.startsWith('2.2') || r.conta.startsWith('2.3')).reduce((sum, r) => sum + (r.saldoAcumulado || 0), 0);
    return totalAtivo - passivoExigivel;
  };

  // Mês anterior
  const prevMes = selectedMes > 1 ? selectedMes - 1 : 12;
  const prevAno = selectedMes > 1 ? selectedAno : selectedAno - 1;

  // Montagem da apuração de cada investida
  const apuracaoMEP = mepConfigs.map(cfg => {
    const plAtual = calculatePL(cfg.empresaId, selectedMes, selectedAno);
    const plAnterior = calculatePL(cfg.empresaId, prevMes, prevAno);
    const variacaoPL = plAtual - plAnterior;
    const perc = parseFloat(cfg.participacao) || 0;
    const resultadoMEP = variacaoPL * (perc / 100);
    const plEquivalente = plAtual * (perc / 100);

    // Conta Débito e Crédito sugeridas para partida dobrada
    let contaDebito = '';
    let descDebito = '';
    let contaCredito = '';
    let descCredito = '';

    if (resultadoMEP >= 0) {
      // Ganho de MEP
      contaDebito = cfg.contaEquivalencia;
      descDebito = cfg.descEquivalencia || 'Investimento - Equivalência Patrimonial (Ativo)';
      contaCredito = cfg.contaReceitaMEP || '3.1.2.1 (Receita de Equivalência Patrimonial - DRE)';
      descCredito = 'Receita de Equivalência Patrimonial (DRE)';
    } else {
      // Perda de MEP
      contaDebito = cfg.contaDespesaMEP || '4.3.1.1 (Despesa com Equivalência Patrimonial - DRE)';
      descDebito = 'Despesa com Equivalência Patrimonial (DRE)';
      contaCredito = cfg.contaEquivalencia;
      descCredito = cfg.descEquivalencia || 'Investimento - Equivalência Patrimonial (Ativo)';
    }

    return {
      ...cfg,
      plAtual,
      plAnterior,
      variacaoPL,
      resultadoMEP,
      plEquivalente,
      contaDebito,
      descDebito,
      contaCredito,
      descCredito
    };
  });

  // Totais Gerais
  const totalPLInvestidas = apuracaoMEP.reduce((sum, r) => sum + r.plAtual, 0);
  const totalPLEquivalente = apuracaoMEP.reduce((sum, r) => sum + r.plEquivalente, 0);
  const totalResultadoMEP = apuracaoMEP.reduce((sum, r) => sum + r.resultadoMEP, 0);
  const totalNacionalMEP = apuracaoMEP.filter(r => r.tipo === 'nacional').reduce((sum, r) => sum + r.resultadoMEP, 0);
  const totalExteriorMEP = apuracaoMEP.filter(r => r.tipo === 'exterior').reduce((sum, r) => sum + r.resultadoMEP, 0);

  // Formatação de Moeda
  const formatCurrency = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Gravar Lançamentos de MEP no Balancete da Holding
  const handleGravarLancamentos = async () => {
    if (!selectedHolding) {
      alert('Por favor, selecione a empresa Holding para receber os lançamentos de MEP.');
      return;
    }

    if (!window.confirm(`Confirma a gravação dos lançamentos de Equivalência Patrimonial para a Holding no período ${meses[selectedMes - 1]}/${selectedAno}?\n\nTotal de MEP Líquido: ${formatCurrency(totalResultadoMEP)}`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const data = await getRawRecords(selectedAno, selectedMes);
      const balancoHolding = data.balanco.filter(r => r.empresaId === selectedHolding);
      const dreHolding = data.dre.filter(r => r.empresaId === selectedHolding);

      for (const item of apuracaoMEP) {
        if (!item.ativo || Math.abs(item.resultadoMEP) === 0) continue;

        // 1. Atualizar ou Criar conta de Equivalência Patrimonial no Ativo da Holding
        const existingBal = balancoHolding.find(r => r.conta === item.contaEquivalencia);
        if (existingBal) {
          const novoSaldo = (existingBal.saldoAcumulado || 0) + item.resultadoMEP;
          await updateRecord(existingBal.id, 'balanco', novoSaldo);
        } else {
          await addManualEntryToDB(
            selectedHolding,
            selectedAno,
            selectedMes,
            item.contaEquivalencia,
            item.descEquivalencia,
            item.resultadoMEP,
            'balanco'
          );
        }

        // 2. Atualizar ou Criar conta de Resultado de MEP na DRE da Holding
        const contaDRE = item.resultadoMEP >= 0 ? item.contaReceitaMEP : item.contaDespesaMEP;
        const descDRE = item.resultadoMEP >= 0 ? `Receita de MEP - ${item.nome}` : `Despesa de MEP - ${item.nome}`;
        const existingDre = dreHolding.find(r => r.conta === contaDRE);

        if (existingDre) {
          const novoValorDRE = (existingDre.valorMensal || 0) + item.resultadoMEP;
          await updateRecord(existingDre.id, 'dre', novoValorDRE);
        } else {
          await addManualEntryToDB(
            selectedHolding,
            selectedAno,
            selectedMes,
            contaDRE,
            descDRE,
            item.resultadoMEP,
            'dre'
          );
        }
      }

      setRecordingSuccess(true);
      setTimeout(() => setRecordingSuccess(false), 5000);
      loadData();
      alert('Lançamentos de Equivalência Patrimonial gravados com sucesso no balancete da Holding!');
    } catch (e) {
      console.error(e);
      alert('Erro ao gravar lançamentos de MEP: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Manipulação de Configurações
  const handleOpenEdit = (index) => {
    setEditingIndex(index);
    setModalForm({ ...mepConfigs[index] });
    setShowConfigModal(true);
  };

  const handleOpenNew = () => {
    setEditingIndex(null);
    setModalForm({
      empresaId: '',
      nome: '',
      tipo: 'nacional',
      participacao: 100.0,
      contaCustoHistorico: '',
      descCustoHistorico: '',
      contaEquivalencia: '',
      descEquivalencia: '',
      contaReceitaMEP: '',
      contaDespesaMEP: '',
      ativo: true
    });
    setShowConfigModal(true);
  };

  const handleSaveModalForm = (e) => {
    e.preventDefault();
    let updated = [...mepConfigs];
    if (editingIndex !== null) {
      updated[editingIndex] = modalForm;
    } else {
      updated.push(modalForm);
    }
    saveMepSettings(updated);
    setShowConfigModal(false);
  };

  const handleDeleteConfig = (index) => {
    if (window.confirm(`Deseja realmente remover a configuração de "${mepConfigs[index].nome}"?`)) {
      const updated = mepConfigs.filter((_, i) => i !== index);
      saveMepSettings(updated);
    }
  };

  const handleRestoreDefaults = () => {
    if (window.confirm('Restaurar o plano de contas e configurações societárias padrão da AGF Participações?')) {
      saveMepSettings(DEFAULT_MEP_CONFIG);
    }
  };

  const handleQuickPercentChange = (idx, value) => {
    const val = parseFloat(value) || 0;
    const updated = [...mepConfigs];
    updated[idx] = { ...updated[idx], participacao: val };
    saveMepSettings(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.8rem', paddingBottom: '2rem' }}>
      
      {/* BARRA DE CONTROLE E SELEÇÃO */}
      <div className="glass-panel" style={{ 
        padding: '1.2rem 1.5rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '1rem',
        borderLeft: '4px solid #D4AF37'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '1.35rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚖️</span> Apuração de Equivalência Patrimonial (MEP)
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', color: '#aaa', fontSize: '0.85rem' }}>
              Cálculo automático do resultado de MEP baseado na variação do Patrimônio Líquido (PL) das controladas.
            </p>
          </div>
        </div>

        {/* Seletores de Período e Holding */}
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <select 
              value={selectedHolding} 
              onChange={(e) => {
                setSelectedHolding(e.target.value);
                saveMepSettings(mepConfigs, e.target.value);
              }} 
              className="select-input" 
              style={{ width: '220px', borderColor: '#D4AF37', fontWeight: 'bold' }}
            >
              <option value="">Selecione a Holding...</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <select 
              value={selectedMes} 
              onChange={(e) => setSelectedMes(parseInt(e.target.value))} 
              className="select-input" 
              style={{ width: '140px' }}
            >
              {meses.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>

          <div>
            <select 
              value={selectedAno} 
              onChange={(e) => setSelectedAno(parseInt(e.target.value))} 
              className="select-input" 
              style={{ width: '95px' }}
            >
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <button
            onClick={() => setShowConfigModal(true)}
            className="btn-secondary"
            style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>⚙️</span> Configurar Contas
          </button>

          <button
            onClick={handleGravarLancamentos}
            disabled={isProcessing}
            style={{
              background: '#4CAF50',
              color: '#fff',
              border: 'none',
              padding: '0.55rem 1.2rem',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
            }}
          >
            <span>💾</span> {isProcessing ? 'Gravando...' : 'Gravar Lançamento no Balancete'}
          </button>
        </div>
      </div>

      {recordingSuccess && (
        <div style={{ background: 'rgba(76, 175, 80, 0.2)', border: '1px solid #4CAF50', color: '#81C784', padding: '1rem', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold' }}>
          ✓ Lançamento de Equivalência Patrimonial integrado com sucesso ao Balancete da Holding!
        </div>
      )}

      {/* CARDS DE INDICADORES DE MEP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.2rem' }}>
        
        {/* Card 1: Resultado Líquido de MEP */}
        <div style={{ 
          background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.12), rgba(25, 25, 30, 0.8))', 
          border: '1px solid rgba(212, 175, 55, 0.35)', 
          padding: '1.3rem', 
          borderRadius: '12px' 
        }}>
          <div style={{ fontSize: '0.82rem', color: '#FFD54F', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📈</span> Resultado de MEP ({meses[selectedMes - 1]}/{selectedAno})
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: totalResultadoMEP >= 0 ? '#81C784' : '#FF8A80', marginTop: '6px' }}>
            {formatCurrency(totalResultadoMEP)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '4px' }}>
            Nacional: <b style={{ color: '#fff' }}>{formatCurrency(totalNacionalMEP)}</b> | Exterior: <b style={{ color: '#fff' }}>{formatCurrency(totalExteriorMEP)}</b>
          </div>
        </div>

        {/* Card 2: PL Total Equivalente da Holding */}
        <div style={{ 
          background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.12), rgba(25, 25, 30, 0.8))', 
          border: '1px solid rgba(33, 150, 243, 0.35)', 
          padding: '1.3rem', 
          borderRadius: '12px' 
        }}>
          <div style={{ fontSize: '0.82rem', color: '#90CAF9', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>💼</span> PL Proporcional da Holding
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fff', marginTop: '6px' }}>
            {formatCurrency(totalPLEquivalente)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '4px' }}>
            Participação no capital próprio das investidas
          </div>
        </div>

        {/* Card 3: PL Consolidado das Investidas */}
        <div style={{ 
          background: 'linear-gradient(135deg, rgba(156, 39, 176, 0.12), rgba(25, 25, 30, 0.8))', 
          border: '1px solid rgba(156, 39, 176, 0.35)', 
          padding: '1.3rem', 
          borderRadius: '12px' 
        }}>
          <div style={{ fontSize: '0.82rem', color: '#CE93D8', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🏛️</span> PL Total das Investidas (100%)
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fff', marginTop: '6px' }}>
            {formatCurrency(totalPLInvestidas)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '4px' }}>
            Patrimônio Líquido base apurado em {meses[selectedMes - 1]}/{selectedAno}
          </div>
        </div>

      </div>

      {/* TABELA DETALHADA DA APURAÇÃO DE MEP POR INVESTIDA */}
      <div className="glass-panel" style={{ padding: '1.5rem', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem' }}>
              Demonstrativo de Cálculo de Equivalência Patrimonial
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', color: '#aaa', fontSize: '0.82rem' }}>
              Comparativo: <b>{meses[prevMes - 1]}/{prevAno}</b> (PL Anterior) vs. <b>{meses[selectedMes - 1]}/{selectedAno}</b> (PL Atual)
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleRestoreDefaults}
              className="btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
              title="Restaurar padrão do plano de contas da AGF Participações"
            >
              🔄 Restaurar Plano AGF Participações
            </button>
          </div>
        </div>

        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr style={{ background: 'rgba(212, 175, 55, 0.1)', color: '#D4AF37' }}>
              <th style={{ textAlign: 'left', minWidth: '180px' }}>Empresa Investida</th>
              <th style={{ textAlign: 'center', width: '90px' }}>Origem</th>
              <th style={{ textAlign: 'center', width: '110px' }}>% Participação</th>
              <th style={{ textAlign: 'right', minWidth: '130px' }}>PL Anterior ({meses[prevMes - 1].substring(0, 3)})</th>
              <th style={{ textAlign: 'right', minWidth: '130px' }}>PL Atual ({meses[selectedMes - 1].substring(0, 3)})</th>
              <th style={{ textAlign: 'right', minWidth: '130px' }}>Variação PL</th>
              <th style={{ textAlign: 'right', minWidth: '150px' }}>Resultado MEP (R$)</th>
              <th style={{ textAlign: 'left', minWidth: '220px' }}>Conta Débito / Crédito (Lançamento)</th>
            </tr>
          </thead>
          <tbody>
            {apuracaoMEP.map((item, idx) => {
              const isPositive = item.resultadoMEP >= 0;

              return (
                <tr key={item.empresaId || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ textAlign: 'left', fontWeight: 'bold', color: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{item.tipo === 'exterior' ? '🌎' : '🇧🇷'}</span>
                      <div>
                        <div>{item.nome}</div>
                        <span style={{ fontSize: '0.75rem', color: '#888' }}>Conta MEP: {item.contaEquivalencia}</span>
                      </div>
                    </div>
                  </td>

                  <td style={{ textAlign: 'center' }}>
                    <span style={{ 
                      background: item.tipo === 'exterior' ? 'rgba(33, 150, 243, 0.15)' : 'rgba(76, 175, 80, 0.15)',
                      color: item.tipo === 'exterior' ? '#64B5F6' : '#81C784',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}>
                      {item.tipo}
                    </span>
                  </td>

                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={item.participacao} 
                        onChange={(e) => handleQuickPercentChange(idx, e.target.value)}
                        style={{
                          width: '65px',
                          background: '#141418',
                          border: '1px solid #444',
                          color: '#FFD54F',
                          textAlign: 'center',
                          borderRadius: '4px',
                          padding: '2px 4px',
                          fontSize: '0.85rem',
                          fontWeight: 'bold'
                        }}
                      />
                      <span style={{ fontSize: '0.8rem', color: '#888' }}>%</span>
                    </div>
                  </td>

                  <td style={{ textAlign: 'right', color: '#bbb' }}>
                    {formatCurrency(item.plAnterior)}
                  </td>

                  <td style={{ textAlign: 'right', color: '#fff', fontWeight: '500' }}>
                    {formatCurrency(item.plAtual)}
                  </td>

                  <td style={{ textAlign: 'right', color: item.variacaoPL >= 0 ? '#81C784' : '#FF8A80', fontWeight: 'bold' }}>
                    {item.variacaoPL >= 0 ? '+' : ''}{formatCurrency(item.variacaoPL)}
                  </td>

                  <td style={{ textAlign: 'right', background: isPositive ? 'rgba(76, 175, 80, 0.08)' : 'rgba(244, 67, 54, 0.08)' }}>
                    <strong style={{ color: isPositive ? '#81C784' : '#FF8A80', fontSize: '0.95rem' }}>
                      {isPositive ? '+' : ''}{formatCurrency(item.resultadoMEP)}
                    </strong>
                  </td>

                  <td style={{ textAlign: 'left', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ color: '#90CAF9' }}>
                        <b>D:</b> [{item.contaDebito}] {item.descDebito}
                      </div>
                      <div style={{ color: '#CE93D8' }}>
                        <b>C:</b> [{item.contaCredito}] {item.descCredito}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: 'rgba(255, 255, 255, 0.04)', fontWeight: 'bold', borderTop: '2px solid #D4AF37' }}>
              <td style={{ textAlign: 'left', color: '#D4AF37', fontSize: '0.95rem' }}>TOTAL CONSOLIDADO</td>
              <td></td>
              <td></td>
              <td style={{ textAlign: 'right', color: '#aaa' }}>{formatCurrency(apuracaoMEP.reduce((s, r) => s + r.plAnterior, 0))}</td>
              <td style={{ textAlign: 'right', color: '#fff' }}>{formatCurrency(totalPLInvestidas)}</td>
              <td style={{ textAlign: 'right', color: '#fff' }}>{formatCurrency(apuracaoMEP.reduce((s, r) => s + r.variacaoPL, 0))}</td>
              <td style={{ textAlign: 'right', color: totalResultadoMEP >= 0 ? '#81C784' : '#FF8A80', fontSize: '1.1rem' }}>
                {formatCurrency(totalResultadoMEP)}
              </td>
              <td style={{ textAlign: 'left', color: '#aaa', fontSize: '0.8rem' }}>
                Reflete o Ganho/Perda líquido de MEP na DRE da Holding
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ESPELHO DO LOTE DE LANÇAMENTO CONTÁBIL PARA O PROTHEUS */}
      <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #2196F3' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📑</span> Espelho do Lançamento Contábil de MEP ({meses[selectedMes - 1]}/{selectedAno})
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', color: '#aaa', fontSize: '0.82rem' }}>
              Lote contábil de partida dobrada formatado conforme o plano de contas da Holding (03 - AGF PARTICIPAÇÕES).
            </p>
          </div>

          <button
            onClick={() => {
              const csvContent = "data:text/csv;charset=utf-8," + 
                "EMPRESA,TIPO,PARTICIPACAO_PCT,PL_ANTERIOR,PL_ATUAL,VARIACAO_PL,RESULTADO_MEP,CONTA_DEBITO,CONTA_CREDITO\n" +
                apuracaoMEP.map(r => `"${r.nome}","${r.tipo}",${r.participacao},${r.plAnterior},${r.plAtual},${r.variacaoPL},${r.resultadoMEP},"${r.contaDebito}","${r.contaCredito}"`).join("\n");
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", `MEP_${selectedHolding}_${selectedMes}_${selectedAno}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="btn-secondary"
            style={{ fontSize: '0.82rem' }}
          >
            📥 Exportar Demonstrativo (CSV)
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {apuracaoMEP.filter(r => r.ativo && Math.abs(r.resultadoMEP) > 0).map((item, i) => (
            <div 
              key={i} 
              style={{ 
                background: 'rgba(0,0,0,0.3)', 
                padding: '0.8rem 1.2rem', 
                borderRadius: '8px', 
                borderLeft: `3px solid ${item.resultadoMEP >= 0 ? '#4CAF50' : '#F44336'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.8rem'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  Lançamento MEP: {item.nome} ({item.participacao}% s/ variação de {formatCurrency(item.variacaoPL)})
                </span>
                <span style={{ fontSize: '0.78rem', color: '#aaa' }}>
                  Histórico: Vlr. ref. Equivalência Patrimonial {selectedMes.toString().padStart(2, '0')}/{selectedAno} sobre o PL da investida {item.nome}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ fontSize: '0.82rem', textAlign: 'right' }}>
                  <div style={{ color: '#90CAF9' }}><b>(D)</b> {item.contaDebito}</div>
                  <div style={{ color: '#CE93D8' }}><b>(C)</b> {item.contaCredito}</div>
                </div>
                <strong style={{ color: item.resultadoMEP >= 0 ? '#81C784' : '#FF8A80', fontSize: '1.1rem', minWidth: '130px', textAlign: 'right' }}>
                  {formatCurrency(Math.abs(item.resultadoMEP))}
                </strong>
              </div>
            </div>
          ))}

          {apuracaoMEP.filter(r => r.ativo && Math.abs(r.resultadoMEP) > 0).length === 0 && (
            <p style={{ color: '#666', textAlign: 'center', margin: '1rem 0' }}>
              Nenhuma variação de PL apurada nas investidas para o período selecionado.
            </p>
          )}
        </div>
      </div>

      {/* MODAL DE CONFIGURAÇÃO DE CONTAS SOCIETÁRIAS */}
      {showConfigModal && (
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
            border: '1px solid #D4AF37',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '750px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
            padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.8rem' }}>
              <h3 style={{ margin: 0, color: '#D4AF37', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚙️</span> Configuração de Participações & Contas Societárias (Holding)
              </h3>
              <button
                onClick={() => { setShowConfigModal(false); setModalForm(null); }}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {modalForm ? (
              // Formulário de Edição/Inclusão
              <form onSubmit={handleSaveModalForm} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  
                  {/* Seleção Direta da Empresa no Banco de Dados */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.3rem', color: '#90CAF9', fontSize: '0.82rem', fontWeight: 'bold' }}>
                      🏢 Selecionar Empresa do BD
                    </label>
                    <select 
                      value={companies.some(c => c.id === modalForm.empresaId) ? modalForm.empresaId : '__custom__'}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setModalForm({ ...modalForm, isManual: true });
                        } else {
                          const comp = companies.find(c => c.id === val);
                          const isExt = val.includes('europe') || val.includes('kwezi') || (comp && comp.name.toLowerCase().includes('europe'));
                          setModalForm({ 
                            ...modalForm, 
                            empresaId: val, 
                            nome: comp ? comp.name : val.toUpperCase(),
                            tipo: isExt ? 'exterior' : (modalForm.tipo || 'nacional'),
                            isManual: false
                          });
                        }
                      }}
                      className="select-input" 
                      style={{ width: '100%', borderColor: '#2196F3', background: '#14141c', fontWeight: 'bold' }}
                    >
                      <option value="">Selecione uma empresa integrada...</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} [ID: {c.id}]
                        </option>
                      ))}
                      <option value="__custom__">➕ Outra Empresa / Internacional (Digitar ID Manual)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.3rem', color: '#ccc', fontSize: '0.82rem' }}>
                      Identificador / ID no Banco (BD)
                    </label>
                    <input 
                      type="text" 
                      value={modalForm.empresaId} 
                      onChange={(e) => setModalForm({ ...modalForm, empresaId: e.target.value })} 
                      className="text-input" 
                      placeholder="Ex: casa / equipamentos / logistica"
                      required 
                      style={{ width: '100%', background: '#141418' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.3rem', color: '#ccc', fontSize: '0.82rem' }}>
                      Razão Social / Nome da Investida
                    </label>
                    <input 
                      type="text" 
                      value={modalForm.nome} 
                      onChange={(e) => setModalForm({ ...modalForm, nome: e.target.value })} 
                      className="text-input" 
                      placeholder="Ex: CASA DA ESCAVADEIRA"
                      required 
                      style={{ width: '100%', background: '#141418' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.3rem', color: '#ccc', fontSize: '0.82rem' }}>
                      Origem Societária
                    </label>
                    <select 
                      value={modalForm.tipo} 
                      onChange={(e) => setModalForm({ ...modalForm, tipo: e.target.value })} 
                      className="select-input" 
                      style={{ width: '100%', background: '#141418' }}
                    >
                      <option value="nacional">Nacional (1321)</option>
                      <option value="exterior">Exterior (1322)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.3rem', color: '#FFD54F', fontSize: '0.82rem', fontWeight: 'bold' }}>
                      % de Participação no Capital
                    </label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={modalForm.participacao} 
                      onChange={(e) => setModalForm({ ...modalForm, participacao: parseFloat(e.target.value) || 0 })} 
                      className="text-input" 
                      required 
                      style={{ width: '100%', background: '#141418', color: '#FFD54F', fontWeight: 'bold' }}
                    />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <h4 style={{ margin: 0, color: '#90CAF9', fontSize: '0.95rem' }}>Contas no Plano de Contas da Holding (03 - AGF PARTICIPAÇÕES):</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.3rem', color: '#aaa', fontSize: '0.8rem' }}>Conta Custo Histórico (Ativo)</label>
                      <input 
                        type="text" 
                        value={modalForm.contaCustoHistorico} 
                        onChange={(e) => setModalForm({ ...modalForm, contaCustoHistorico: e.target.value })} 
                        className="text-input" 
                        placeholder="Ex: 13210100001"
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.3rem', color: '#aaa', fontSize: '0.8rem' }}>Conta Equivalência Patrimonial (Ativo)</label>
                      <input 
                        type="text" 
                        value={modalForm.contaEquivalencia} 
                        onChange={(e) => setModalForm({ ...modalForm, contaEquivalencia: e.target.value })} 
                        className="text-input" 
                        placeholder="Ex: 13210100002"
                        required
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.3rem', color: '#aaa', fontSize: '0.8rem' }}>Conta Receita de MEP (DRE)</label>
                      <input 
                        type="text" 
                        value={modalForm.contaReceitaMEP} 
                        onChange={(e) => setModalForm({ ...modalForm, contaReceitaMEP: e.target.value })} 
                        className="text-input" 
                        placeholder="Ex: 3.1.2.1.01.00001"
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.3rem', color: '#aaa', fontSize: '0.8rem' }}>Conta Despesa de MEP (DRE)</label>
                      <input 
                        type="text" 
                        value={modalForm.contaDespesaMEP} 
                        onChange={(e) => setModalForm({ ...modalForm, contaDespesaMEP: e.target.value })} 
                        className="text-input" 
                        placeholder="Ex: 4.3.1.1.01.00001"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setModalForm(null)} className="btn-secondary">
                    Voltar
                  </button>
                  <button type="submit" className="btn-primary" style={{ background: '#D4AF37', color: '#000', fontWeight: 'bold' }}>
                    Salvar Investida
                  </button>
                </div>
              </form>
            ) : (
              // Lista de Investidas Cadastradas
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#ccc', fontSize: '0.85rem' }}>Empresas Investidas Configuradas ({mepConfigs.length})</span>
                  <button onClick={handleOpenNew} className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}>
                    + Adicionar Investida
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {mepConfigs.map((cfg, i) => (
                    <div 
                      key={i} 
                      style={{ 
                        background: 'rgba(0,0,0,0.3)', 
                        padding: '0.8rem 1rem', 
                        borderRadius: '8px', 
                        border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.8rem'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ color: '#fff' }}>{cfg.nome}</strong>
                          <span style={{ background: cfg.tipo === 'exterior' ? 'rgba(33, 150, 243, 0.2)' : 'rgba(76, 175, 80, 0.2)', color: cfg.tipo === 'exterior' ? '#64B5F6' : '#81C784', fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px' }}>
                            {cfg.tipo}
                          </span>
                          <span style={{ color: '#FFD54F', fontSize: '0.85rem', fontWeight: 'bold' }}>{cfg.participacao}%</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '2px' }}>
                          Conta MEP: <b style={{ color: '#aaa' }}>{cfg.contaEquivalencia}</b> • Custo Hist: <b style={{ color: '#aaa' }}>{cfg.contaCustoHistorico}</b>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleOpenEdit(i)} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', borderColor: '#2196F3', color: '#64B5F6' }}>
                          ✏️ Editar
                        </button>
                        <button onClick={() => handleDeleteConfig(i)} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', borderColor: '#f44336', color: '#FF8A80' }}>
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
