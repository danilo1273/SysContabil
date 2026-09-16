import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings, fetchAll } from '../utils/db';
import { supabase } from '../supabaseClient';
import { 
  Calculator, 
  Settings, 
  RefreshCw, 
  Check, 
  Save, 
  TrendingDown, 
  Building2, 
  Plus, 
  X,
  Edit2,
  Trash2,
  ArrowRight
} from 'lucide-react';

export default function IntercompanyExclusionsPanel({ dbAno, dbMes, companies = [], onSaved }) {
  // Lista de empresas padrão caso não venha via prop
  const availableCompanies = companies && companies.length > 0 ? companies : [
    { id: 'equipamentos', name: 'AGF Equipamentos' },
    { id: 'rompedores', name: 'AGF Rompedores' },
    { id: 'casa', name: 'Casa da Escavadeira' }
  ];

  // Estados do formulário de exclusão ativa/em edição
  const [editingId, setEditingId] = useState(null);
  const [empresaOrigem, setEmpresaOrigem] = useState(availableCompanies[0]?.id || 'equipamentos');
  const [empresaDestino, setEmpresaDestino] = useState(availableCompanies[1]?.id || 'rompedores');
  const [motivo, setMotivo] = useState('');

  const [faturamento, setFaturamento] = useState('');
  const [impostos, setImpostos] = useState('');
  const [custo, setCusto] = useState('');
  const [clientes, setClientes] = useState('');
  const [fornecedores, setFornecedores] = useState('');
  
  // Lista de todas as exclusões cadastradas para este mês/ano
  const [exclusionsList, setExclusionsList] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);

  // Mapeamento de contas salvas
  const [accountMapping, setAccountMapping] = useState({
    clientesContas: ['1.1.1.3.01.000001', '1.1.1.3.01.000014'],
    fornecedoresContas: ['2.1.1.1.01.000001']
  });

  // Sugestões de contas encontradas no balancete
  const [detectedAccounts, setDetectedAccounts] = useState({ clientes: [], fornecedores: [] });
  const [newClienteInput, setNewClienteInput] = useState('');
  const [newFornecInput, setNewFornecInput] = useState('');

  const mesNome = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ][dbMes - 1] || `Mês ${dbMes}`;

  const getCompanyName = (id) => {
    if (id === 'todas') return 'Todas as Empresas';
    const found = availableCompanies.find(c => c.id === id);
    return found ? found.name : id;
  };

  // Carregar dados salvos do mês e mapeamento de contas
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        // 1. Carregar mapeamento geral de contas
        const storedMapping = await getSettings('agf_intercompany_mapping');
        if (storedMapping && typeof storedMapping === 'object') {
          setAccountMapping({
            clientesContas: storedMapping.clientesContas || ['1.1.1.3.01.000001', '1.1.1.3.01.000014'],
            fornecedoresContas: storedMapping.fornecedoresContas || ['2.1.1.1.01.000001']
          });
        }

        // 2. Carregar lista de exclusões salvas para este mês/ano
        const storedList = await getSettings(`agf_exclusoes_lista_${dbAno}_${dbMes}`);
        if (Array.isArray(storedList) && storedList.length > 0) {
          setExclusionsList(storedList);
        } else {
          // Fallback para o formato anterior (única exclusão por mês)
          const legacyExclusoes = await getSettings(`agf_exclusoes_${dbAno}_${dbMes}`);
          if (legacyExclusoes && typeof legacyExclusoes === 'object' && (
            legacyExclusoes.faturamento || legacyExclusoes.impostos || legacyExclusoes.custo || legacyExclusoes.clientes || legacyExclusoes.fornecedores
          )) {
            const migratedItem = {
              id: `legacy_${dbAno}_${dbMes}`,
              empresaOrigem: 'todas',
              empresaDestino: 'todas',
              motivo: 'Exclusão Intercompany Geral',
              faturamento: Number(legacyExclusoes.faturamento) || 0,
              impostos: Number(legacyExclusoes.impostos) || 0,
              custo: Number(legacyExclusoes.custo) || 0,
              clientes: Number(legacyExclusoes.clientes) || 0,
              fornecedores: Number(legacyExclusoes.fornecedores) || 0,
              createdAt: legacyExclusoes.updated_at || new Date().toISOString()
            };
            setExclusionsList([migratedItem]);
          } else {
            setExclusionsList([]);
          }
        }

        // Limpar formulário de inserção
        resetForm();
      } catch (err) {
        console.error('Erro ao carregar exclusões:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [dbAno, dbMes]);

  const resetForm = () => {
    setEditingId(null);
    setMotivo('');
    setFaturamento('');
    setImpostos('');
    setCusto('');
    setClientes('');
    setFornecedores('');
    setEmpresaOrigem(availableCompanies[0]?.id || 'equipamentos');
    setEmpresaDestino(availableCompanies[1]?.id || 'rompedores');
  };

  // Buscar contas do balancete para sugerir no mapeamento
  const scanIntercompanyAccounts = async () => {
    try {
      const records = await fetchAll(
        supabase.from('balanco_history')
          .select('conta, descricao, tipo, saldoAcumulado')
          .neq('empresaId', 'exclusoes')
      );

      const clientesMap = new Map();
      const fornecedoresMap = new Map();

      (records || []).forEach(r => {
        if (!r.conta || !r.descricao) return;
        const descUpper = r.descricao.toUpperCase();
        const isIntercompanyName = 
          descUpper.includes('AGF') || 
          descUpper.includes('CASA DA ESCAVADEIRA') || 
          descUpper.includes('ROMPEDOR') || 
          descUpper.includes('PARTICIPA') || 
          descUpper.includes('LIGADA') || 
          descUpper.includes('INTERCOMPANY');

        if (isIntercompanyName) {
          if (r.conta.startsWith('1.1.1.3') || r.tipo === 'ativo') {
            clientesMap.set(r.conta, r.descricao);
          } else if (r.conta.startsWith('2.1.1.1') || r.tipo === 'passivo') {
            fornecedoresMap.set(r.conta, r.descricao);
          }
        }
      });

      setDetectedAccounts({
        clientes: Array.from(clientesMap.entries()).map(([conta, descricao]) => ({ conta, descricao })),
        fornecedores: Array.from(fornecedoresMap.entries()).map(([conta, descricao]) => ({ conta, descricao }))
      });
    } catch (e) {
      console.warn('Erro ao escanear contas de balanço:', e);
    }
  };

  // Puxar saldos de Clientes e Fornecedores do Balanço com base nas contas mapeadas
  const handleAutoPullBalanco = async () => {
    setLoading(true);
    try {
      const { clientesContas, fornecedoresContas } = accountMapping;
      if (clientesContas.length === 0 && fornecedoresContas.length === 0) {
        window.$alert('Nenhuma conta mapeada! Clique no botão de engrenagem para mapear as contas primeiro.');
        setLoading(false);
        return;
      }

      let query = supabase.from('balanco_history')
        .select('conta, descricao, saldoAcumulado, empresaId')
        .eq('ano', dbAno)
        .eq('mes', dbMes)
        .neq('empresaId', 'exclusoes');

      const records = await fetchAll(query);

      let totalCli = 0;
      let totalForn = 0;
      let matchCliCount = 0;
      let matchFornCount = 0;

      (records || []).forEach(r => {
        if (!r.conta) return;

        // Se uma empresa de origem estiver selecionada, busca contas de clientes nela
        const matchOrigem = !empresaOrigem || empresaOrigem === 'todas' || r.empresaId === empresaOrigem;
        const matchDestino = !empresaDestino || empresaDestino === 'todas' || r.empresaId === empresaDestino;
        
        const isCli = clientesContas.some(c => r.conta.startsWith(c.trim()));
        if (isCli && matchOrigem) {
          totalCli += (r.saldoAcumulado || 0);
          matchCliCount++;
        }

        const isForn = fornecedoresContas.some(c => r.conta.startsWith(c.trim()));
        if (isForn && matchDestino) {
          totalForn += (r.saldoAcumulado || 0);
          matchFornCount++;
        }
      });

      const cliFinal = Math.abs(totalCli);
      const fornFinal = Math.abs(totalForn);

      if (cliFinal > 0) setClientes(String(cliFinal));
      if (fornFinal > 0) setFornecedores(String(fornFinal));

      window.$toast(`Saldos identificados: Clientes R$ ${cliFinal.toLocaleString('pt-BR')} (${matchCliCount} contas), Fornecedores R$ ${fornFinal.toLocaleString('pt-BR')} (${matchFornCount} contas)`, { type: 'success' });
    } catch (err) {
      console.error(err);
      window.$alert('Erro ao puxar saldos do balanço: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Salvar a lista completa de exclusões e sincronizar no Banco de Dados
  const syncWithDatabase = async (updatedList) => {
    setSaving(true);
    try {
      const trimestre = Math.ceil(dbMes / 3);

      // 1. Calcular totais agregados para leitura rápida
      const totalFat = updatedList.reduce((acc, item) => acc + (Number(item.faturamento) || 0), 0);
      const totalImp = updatedList.reduce((acc, item) => acc + (Number(item.impostos) || 0), 0);
      const totalCusto = updatedList.reduce((acc, item) => acc + (Number(item.custo) || 0), 0);
      const totalCli = updatedList.reduce((acc, item) => acc + (Number(item.clientes) || 0), 0);
      const totalForn = updatedList.reduce((acc, item) => acc + (Number(item.fornecedores) || 0), 0);

      // 2. Persistir lista completa e totais nos settings
      await saveSettings(`agf_exclusoes_lista_${dbAno}_${dbMes}`, updatedList);
      await saveSettings(`agf_exclusoes_${dbAno}_${dbMes}`, {
        faturamento: totalFat,
        impostos: totalImp,
        custo: totalCusto,
        clientes: totalCli,
        fornecedores: totalForn,
        updated_at: new Date().toISOString()
      });

      // 3. Atualizar dre_history para a empresa 'exclusoes'
      // Limpa registros anteriores para evitar duplicidades
      await supabase.from('dre_history').delete().match({
        empresaId: 'exclusoes',
        ano: dbAno,
        mes: dbMes
      });

      // Se houver exclusões cadastradas, insere registros agregados/individuais
      if (updatedList.length > 0) {
        const dreEntries = [
          {
            id: `manual_exclusoes_${dbAno}_${dbMes}_3.1.1.1.01.00001.EXC`,
            empresaId: 'exclusoes',
            ano: dbAno,
            mes: dbMes,
            trimestre,
            conta: '3.1.1.1.01.00001.EXC',
            descricao: 'Exclusão Intercompany - Faturamento',
            valorMensal: -Math.abs(totalFat)
          },
          {
            id: `manual_exclusoes_${dbAno}_${dbMes}_3.1.1.2.01.EXC`,
            empresaId: 'exclusoes',
            ano: dbAno,
            mes: dbMes,
            trimestre,
            conta: '3.1.1.2.01.EXC',
            descricao: 'Exclusão Intercompany - Impostos s/ Vendas',
            valorMensal: Math.abs(totalImp)
          },
          {
            id: `manual_exclusoes_${dbAno}_${dbMes}_4.1.1.1.13.EXC`,
            empresaId: 'exclusoes',
            ano: dbAno,
            mes: dbMes,
            trimestre,
            conta: '4.1.1.1.13.EXC',
            descricao: 'Exclusão Intercompany - Custo (CPV/CMV)',
            valorMensal: Math.abs(totalCusto)
          }
        ];

        for (const entry of dreEntries) {
          await supabase.from('dre_history').upsert(entry);
        }

        // 4. Atualizar balanco_history para a empresa 'exclusoes'
        await supabase.from('balanco_history').delete().match({
          empresaId: 'exclusoes',
          ano: dbAno,
          mes: dbMes
        });

        const balEntries = [
          {
            id: `manual_exclusoes_${dbAno}_${dbMes}_1.1.1.3.01.EXC`,
            empresaId: 'exclusoes',
            ano: dbAno,
            mes: dbMes,
            trimestre,
            tipo: 'ativo',
            conta: '1.1.1.3.01.EXC',
            descricao: 'Exclusão Intercompany - Clientes',
            saldoAcumulado: -Math.abs(totalCli)
          },
          {
            id: `manual_exclusoes_${dbAno}_${dbMes}_2.1.1.1.01.EXC`,
            empresaId: 'exclusoes',
            ano: dbAno,
            mes: dbMes,
            trimestre,
            tipo: 'passivo',
            conta: '2.1.1.1.01.EXC',
            descricao: 'Exclusão Intercompany - Fornecedores',
            saldoAcumulado: Math.abs(totalForn)
          }
        ];

        for (const entry of balEntries) {
          await supabase.from('balanco_history').upsert(entry);
        }
      } else {
        // Se limpou todas as exclusões, limpa balanco_history também
        await supabase.from('balanco_history').delete().match({
          empresaId: 'exclusoes',
          ano: dbAno,
          mes: dbMes
        });
      }

      setExclusionsList(updatedList);
      resetForm();
      window.$toast(`Exclusões de ${mesNome}/${dbAno} atualizadas com sucesso!`, { type: 'success' });
      if (onSaved) onSaved();
    } catch (err) {
      console.error('Erro ao sincronizar exclusões:', err);
      window.$alert('Erro ao salvar exclusões: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Submeter formulário (Adicionar ou Editar Exclusão)
  const handleSubmitForm = async (e) => {
    if (e) e.preventDefault();

    const numFaturamento = parseFloat(faturamento) || 0;
    const numImpostos = parseFloat(impostos) || 0;
    const numCusto = parseFloat(custo) || 0;
    const numClientes = parseFloat(clientes) || 0;
    const numFornecedores = parseFloat(fornecedores) || 0;

    if (numFaturamento === 0 && numImpostos === 0 && numCusto === 0 && numClientes === 0 && numFornecedores === 0) {
      window.$alert('Informe ao menos um valor (faturamento, impostos, custo, clientes ou fornecedores) para registrar a exclusão.');
      return;
    }

    if (empresaOrigem === empresaDestino && empresaOrigem !== 'todas') {
      const confirmSame = window.confirm('A empresa de origem e destino selecionadas são as mesmas. Deseja prosseguir assim mesmo?');
      if (!confirmSame) return;
    }

    const itemData = {
      id: editingId || `exc_${Date.now()}`,
      empresaOrigem,
      empresaDestino,
      motivo: motivo.trim() || `Operação ${getCompanyName(empresaOrigem)} -> ${getCompanyName(empresaDestino)}`,
      faturamento: numFaturamento,
      impostos: numImpostos,
      custo: numCusto,
      clientes: numClientes,
      fornecedores: numFornecedores,
      updated_at: new Date().toISOString()
    };

    let updated = [];
    if (editingId) {
      updated = exclusionsList.map(item => item.id === editingId ? itemData : item);
    } else {
      updated = [...exclusionsList, itemData];
    }

    await syncWithDatabase(updated);
  };

  // Excluir um item da lista
  const handleDeleteItem = async (itemId) => {
    const confirmDelete = window.confirm('Tem certeza que deseja remover esta exclusão?');
    if (!confirmDelete) return;

    const updated = exclusionsList.filter(item => item.id !== itemId);
    await syncWithDatabase(updated);
  };

  // Carregar item no formulário para edição
  const handleEditItem = (item) => {
    setEditingId(item.id);
    setEmpresaOrigem(item.empresaOrigem || availableCompanies[0]?.id || 'equipamentos');
    setEmpresaDestino(item.empresaDestino || availableCompanies[1]?.id || 'rompedores');
    setMotivo(item.motivo || '');
    setFaturamento(item.faturamento ? String(item.faturamento) : '');
    setImpostos(item.impostos ? String(item.impostos) : '');
    setCusto(item.custo ? String(item.custo) : '');
    setClientes(item.clientes ? String(item.clientes) : '');
    setFornecedores(item.fornecedores ? String(item.fornecedores) : '');

    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleSaveMapping = async () => {
    try {
      await saveSettings('agf_intercompany_mapping', accountMapping);
      window.$toast('Mapeamento de contas salvo com sucesso!', { type: 'success' });
      setShowMappingModal(false);
    } catch (e) {
      window.$alert('Erro ao salvar mapeamento: ' + e.message);
    }
  };

  const addClienteConta = (conta) => {
    if (!conta || accountMapping.clientesContas.includes(conta.trim())) return;
    setAccountMapping(prev => ({
      ...prev,
      clientesContas: [...prev.clientesContas, conta.trim()]
    }));
    setNewClienteInput('');
  };

  const removeClienteConta = (conta) => {
    setAccountMapping(prev => ({
      ...prev,
      clientesContas: prev.clientesContas.filter(c => c !== conta)
    }));
  };

  const addFornecConta = (conta) => {
    if (!conta || accountMapping.fornecedoresContas.includes(conta.trim())) return;
    setAccountMapping(prev => ({
      ...prev,
      fornecedoresContas: [...prev.fornecedoresContas, conta.trim()]
    }));
    setNewFornecInput('');
  };

  const removeFornecConta = (conta) => {
    setAccountMapping(prev => ({
      ...prev,
      fornecedoresContas: prev.fornecedoresContas.filter(c => c !== conta)
    }));
  };

  // Totais do mês
  const totFat = exclusionsList.reduce((acc, i) => acc + (Number(i.faturamento) || 0), 0);
  const totImp = exclusionsList.reduce((acc, i) => acc + (Number(i.impostos) || 0), 0);
  const totCusto = exclusionsList.reduce((acc, i) => acc + (Number(i.custo) || 0), 0);
  const totCli = exclusionsList.reduce((acc, i) => acc + (Number(i.clientes) || 0), 0);
  const totForn = exclusionsList.reduce((acc, i) => acc + (Number(i.fornecedores) || 0), 0);

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      padding: '1.25rem 1.5rem',
      marginBottom: '2rem',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      position: 'relative'
    }}>
      {/* CABEÇALHO DA SEÇÃO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(255, 152, 0, 0.15)', color: '#FFB74D', padding: '8px', borderRadius: '8px', display: 'flex' }}>
            <Calculator size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Exclusões e Eliminações Intercompany
              <span style={{ fontSize: '0.78rem', background: '#FF9800', color: '#000', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                {mesNome}/{dbAno}
              </span>
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#aaa' }}>
              Eliminação de faturamento, impostos, custos e saldos entre empresas para o Consolidado Geral e Consolidado Personalizado.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => {
              scanIntercompanyAccounts();
              setShowMappingModal(true);
            }}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '0.5rem 0.85rem' }}
            title="Configurar contas contábeis de Clientes e Fornecedores Intercompany"
          >
            <Settings size={14} /> Mapear Contas do Balanço
          </button>
        </div>
      </div>

      {/* FORMULÁRIO DE CADASTRO / EDIÇÃO */}
      <form onSubmit={handleSubmitForm} style={{
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255, 152, 0, 0.25)',
        borderRadius: '10px',
        padding: '1.2rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
          <h4 style={{ margin: 0, color: '#FFB74D', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {editingId ? <Edit2 size={16} /> : <Plus size={16} />}
            {editingId ? 'Editar Exclusão Selecionada' : 'Cadastrar Nova Exclusão Intercompany'}
          </h4>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              style={{ background: 'transparent', border: 'none', color: '#bbb', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Cancelar Edição (Criar Nova)
            </button>
          )}
        </div>

        {/* LINHA 1: ORIGEM, DESTINO E MOTIVO */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
              🏢 Empresa de Origem (Vendedora / Prestadora):
            </label>
            <select
              value={empresaOrigem}
              onChange={e => setEmpresaOrigem(e.target.value)}
              className="select-input"
              style={{ width: '100%', fontSize: '0.85rem' }}
            >
              <option value="todas">Todas as Empresas (Geral)</option>
              {availableCompanies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
              🏢 Empresa de Destino (Compradora / Tomadora):
            </label>
            <select
              value={empresaDestino}
              onChange={e => setEmpresaDestino(e.target.value)}
              className="select-input"
              style={{ width: '100%', fontSize: '0.85rem' }}
            >
              <option value="todas">Todas as Empresas (Geral)</option>
              {availableCompanies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
              📝 Motivo / Descrição da Operação:
            </label>
            <input
              type="text"
              placeholder="Ex: Venda de Peças, Rateio TI, Serviços..."
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              className="text-input"
              style={{ width: '100%', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* LINHA 2: VALORES DRE & BALANÇO */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.2rem' }}>
          {/* Faturamento */}
          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', color: '#FFB74D', marginBottom: '4px' }}>
              💰 Faturamento (DRE):
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '0.78rem' }}>R$</span>
              <input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={faturamento}
                onChange={e => setFaturamento(e.target.value)}
                className="text-input"
                style={{ width: '100%', paddingLeft: '32px', fontSize: '0.85rem' }}
              />
            </div>
            <span style={{ fontSize: '0.68rem', color: '#888', marginTop: '2px', display: 'block' }}>
              Abate de Rec. Bruta
            </span>
          </div>

          {/* Impostos */}
          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', color: '#FFB74D', marginBottom: '4px' }}>
              📑 Impostos s/ Vendas (DRE):
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '0.78rem' }}>R$</span>
              <input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={impostos}
                onChange={e => setImpostos(e.target.value)}
                className="text-input"
                style={{ width: '100%', paddingLeft: '32px', fontSize: '0.85rem' }}
              />
            </div>
            <span style={{ fontSize: '0.68rem', color: '#888', marginTop: '2px', display: 'block' }}>
              Abate de Impostos
            </span>
          </div>

          {/* Custo */}
          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', color: '#FFB74D', marginBottom: '4px' }}>
              📦 Custo Operações (DRE):
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '0.78rem' }}>R$</span>
              <input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={custo}
                onChange={e => setCusto(e.target.value)}
                className="text-input"
                style={{ width: '100%', paddingLeft: '32px', fontSize: '0.85rem' }}
              />
            </div>
            <span style={{ fontSize: '0.68rem', color: '#888', marginTop: '2px', display: 'block' }}>
              Abate de CPV/CMV
            </span>
          </div>

          {/* Clientes */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.76rem', color: '#64B5F6' }}>
                🏦 Clientes (Ativo):
              </label>
              <button
                type="button"
                onClick={handleAutoPullBalanco}
                disabled={loading}
                style={{ background: 'none', border: 'none', color: '#2196F3', fontSize: '0.68rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                title="Puxar saldos das contas mapeadas"
              >
                Auto-Puxar
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '0.78rem' }}>R$</span>
              <input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={clientes}
                onChange={e => setClientes(e.target.value)}
                className="text-input"
                style={{ width: '100%', paddingLeft: '32px', fontSize: '0.85rem' }}
              />
            </div>
            <span style={{ fontSize: '0.68rem', color: '#888', marginTop: '2px', display: 'block' }}>
              Abate a Receber
            </span>
          </div>

          {/* Fornecedores */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.76rem', color: '#64B5F6' }}>
                🏢 Fornecedores (Passivo):
              </label>
              <button
                type="button"
                onClick={handleAutoPullBalanco}
                disabled={loading}
                style={{ background: 'none', border: 'none', color: '#2196F3', fontSize: '0.68rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                title="Puxar saldos das contas mapeadas"
              >
                Auto-Puxar
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '0.78rem' }}>R$</span>
              <input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={fornecedores}
                onChange={e => setFornecedores(e.target.value)}
                className="text-input"
                style={{ width: '100%', paddingLeft: '32px', fontSize: '0.85rem' }}
              />
            </div>
            <span style={{ fontSize: '0.68rem', color: '#888', marginTop: '2px', display: 'block' }}>
              Abate a Pagar
            </span>
          </div>
        </div>

        {/* BOTÃO DE AÇÃO */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="btn-secondary"
              style={{ fontSize: '0.82rem', padding: '0.45rem 1rem' }}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
            style={{
              background: '#FF9800',
              color: '#000',
              border: 'none',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              padding: '0.5rem 1.4rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {saving ? (
              <>Gravando...</>
            ) : editingId ? (
              <><Save size={15} /> Salvar Alterações</>
            ) : (
              <><Plus size={15} /> Inserir Exclusão na Lista</>
            )}
          </button>
        </div>
      </form>

      {/* LISTA / TABELA DE EXCLUSÕES REGISTRADAS NO MÊS */}
      <div style={{ marginBottom: '1.2rem' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.92rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📋 Exclusões Registradas para {mesNome}/{dbAno}</span>
          <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px' }}>
            {exclusionsList.length} {exclusionsList.length === 1 ? 'operação' : 'operações'}
          </span>
        </h4>

        {exclusionsList.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', color: '#888', fontSize: '0.85rem', border: '1px dashed rgba(255,255,255,0.1)' }}>
            Nenhuma exclusão cadastrada para {mesNome}/{dbAno}. Utilize o formulário acima para registrar operações entre as empresas do grupo.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#ccc' }}>
                  <th style={{ padding: '8px 12px' }}>Origem ➡️ Destino</th>
                  <th style={{ padding: '8px 12px' }}>Motivo / Descrição</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Faturamento</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Impostos</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Custo</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Clientes</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Fornecedores</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {exclusionsList.map((item, idx) => (
                  <tr key={item.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: editingId === item.id ? 'rgba(255, 152, 0, 0.1)' : 'transparent' }}>
                    <td style={{ padding: '8px 12px', fontWeight: '500', color: '#fff' }}>
                      <span style={{ color: '#FFB74D' }}>{getCompanyName(item.empresaOrigem)}</span>
                      <ArrowRight size={12} style={{ display: 'inline', margin: '0 6px', color: '#888' }} />
                      <span style={{ color: '#64B5F6' }}>{getCompanyName(item.empresaDestino)}</span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#ccc' }}>
                      {item.motivo || '-'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: item.faturamento ? '#FF8A80' : '#666', fontFamily: 'monospace' }}>
                      {item.faturamento ? `R$ ${Number(item.faturamento).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: item.impostos ? '#81C784' : '#666', fontFamily: 'monospace' }}>
                      {item.impostos ? `R$ ${Number(item.impostos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: item.custo ? '#81C784' : '#666', fontFamily: 'monospace' }}>
                      {item.custo ? `R$ ${Number(item.custo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: item.clientes ? '#FF8A80' : '#666', fontFamily: 'monospace' }}>
                      {item.clientes ? `R$ ${Number(item.clientes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: item.fornecedores ? '#81C784' : '#666', fontFamily: 'monospace' }}>
                      {item.fornecedores ? `R$ ${Number(item.fornecedores).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleEditItem(item)}
                          style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#FFB74D', padding: '4px', borderRadius: '4px', cursor: 'pointer' }}
                          title="Editar esta exclusão"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#E57373', padding: '4px', borderRadius: '4px', cursor: 'pointer' }}
                          title="Excluir esta exclusão"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RESUMO CONSOLIDADO DO MÊS */}
      {exclusionsList.length > 0 && (
        <div style={{
          background: 'rgba(255, 152, 0, 0.08)',
          border: '1px solid rgba(255, 152, 0, 0.25)',
          borderRadius: '8px',
          padding: '0.9rem 1.2rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '1rem',
          textAlign: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#FFB74D', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Faturamento</div>
            <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 'bold', marginTop: '2px', fontFamily: 'monospace' }}>
              R$ {totFat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#FFB74D', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Impostos</div>
            <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 'bold', marginTop: '2px', fontFamily: 'monospace' }}>
              R$ {totImp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#FFB74D', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Custo</div>
            <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 'bold', marginTop: '2px', fontFamily: 'monospace' }}>
              R$ {totCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64B5F6', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Clientes</div>
            <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 'bold', marginTop: '2px', fontFamily: 'monospace' }}>
              R$ {totCli.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64B5F6', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Fornecedores</div>
            <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 'bold', marginTop: '2px', fontFamily: 'monospace' }}>
              R$ {totForn.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE MAPEAMENTO DE CONTAS CONTÁBEIS */}
      {showMappingModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#1a1b26',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.5rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.2rem'
          }}>
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.8rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Settings size={18} style={{ color: '#FFB74D' }} />
                  Mapear Contas Intercompany do Balanço
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#aaa' }}>
                  Informe as contas analíticas ou prefixos contábeis das empresas ligadas. O botão <i>Auto-Puxar</i> somará estas contas automaticamente.
                </p>
              </div>
              <button
                onClick={() => setShowMappingModal(false)}
                style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* SEÇÃO 1: CONTAS DE CLIENTES */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '1rem' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#64B5F6' }}>
                🏦 Contas de Clientes / A Receber Intercompany (Ativo):
              </h4>
              
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <input
                  type="text"
                  placeholder="Ex: 1.1.1.3.01.000001"
                  value={newClienteInput}
                  onChange={e => setNewClienteInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addClienteConta(newClienteInput)}
                  className="text-input"
                  style={{ flex: 1, fontSize: '0.8rem', padding: '5px 8px' }}
                />
                <button
                  type="button"
                  onClick={() => addClienteConta(newClienteInput)}
                  className="btn-primary"
                  style={{ padding: '5px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={14} /> Adicionar
                </button>
              </div>

              {/* Tags de Contas Adicionadas */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {accountMapping.clientesContas.map(conta => (
                  <span key={conta} style={{ background: 'rgba(33, 150, 243, 0.15)', color: '#90CAF9', border: '1px solid rgba(33, 150, 243, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {conta}
                    <X size={12} style={{ cursor: 'pointer', color: '#E57373' }} onClick={() => removeClienteConta(conta)} />
                  </span>
                ))}
              </div>

              {/* Sugestões do banco */}
              {detectedAccounts.clientes.length > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: '0.7rem', color: '#888' }}>Contas detectadas nos balancetes:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {detectedAccounts.clientes.map(d => (
                      <button
                        key={d.conta}
                        type="button"
                        onClick={() => addClienteConta(d.conta)}
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#bbb', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}
                        title={d.descricao}
                      >
                        + {d.conta} ({d.descricao.slice(0, 20)}...)
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* SEÇÃO 2: CONTAS DE FORNECEDORES */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '1rem' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#FFB74D' }}>
                🏢 Contas de Fornecedores / A Pagar Intercompany (Passivo):
              </h4>
              
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <input
                  type="text"
                  placeholder="Ex: 2.1.1.1.01.000001"
                  value={newFornecInput}
                  onChange={e => setNewFornecInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addFornecConta(newFornecInput)}
                  className="text-input"
                  style={{ flex: 1, fontSize: '0.8rem', padding: '5px 8px' }}
                />
                <button
                  type="button"
                  onClick={() => addFornecConta(newFornecInput)}
                  className="btn-primary"
                  style={{ padding: '5px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={14} /> Adicionar
                </button>
              </div>

              {/* Tags de Contas Adicionadas */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {accountMapping.fornecedoresContas.map(conta => (
                  <span key={conta} style={{ background: 'rgba(255, 152, 0, 0.15)', color: '#FFB74D', border: '1px solid rgba(255, 152, 0, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {conta}
                    <X size={12} style={{ cursor: 'pointer', color: '#E57373' }} onClick={() => removeFornecConta(conta)} />
                  </span>
                ))}
              </div>

              {/* Sugestões do banco */}
              {detectedAccounts.fornecedores.length > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: '0.7rem', color: '#888' }}>Contas detectadas nos balancetes:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {detectedAccounts.fornecedores.map(d => (
                      <button
                        key={d.conta}
                        type="button"
                        onClick={() => addFornecConta(d.conta)}
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#bbb', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}
                        title={d.descricao}
                      >
                        + {d.conta} ({d.descricao.slice(0, 20)}...)
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.8rem' }}>
              <button
                type="button"
                onClick={() => setShowMappingModal(false)}
                className="btn-secondary"
                style={{ padding: '0.5rem 1rem' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveMapping}
                className="btn-primary"
                style={{ padding: '0.5rem 1.2rem', fontWeight: 'bold' }}
              >
                Salvar Mapeamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}