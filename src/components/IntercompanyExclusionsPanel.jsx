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
  X
} from 'lucide-react';

export default function IntercompanyExclusionsPanel({ dbAno, dbMes, onSaved }) {
  const [faturamento, setFaturamento] = useState('');
  const [impostos, setImpostos] = useState('');
  const [custo, setCusto] = useState('');
  const [clientes, setClientes] = useState('');
  const [fornecedores, setFornecedores] = useState('');
  
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

        // 2. Carregar valores salvos especificamente para o mês/ano selecionado
        const storedExclusoes = await getSettings(`agf_exclusoes_${dbAno}_${dbMes}`);
        if (storedExclusoes && typeof storedExclusoes === 'object') {
          setFaturamento(storedExclusoes.faturamento !== undefined ? String(storedExclusoes.faturamento) : '');
          setImpostos(storedExclusoes.impostos !== undefined ? String(storedExclusoes.impostos) : '');
          setCusto(storedExclusoes.custo !== undefined ? String(storedExclusoes.custo) : '');
          setClientes(storedExclusoes.clientes !== undefined ? String(storedExclusoes.clientes) : '');
          setFornecedores(storedExclusoes.fornecedores !== undefined ? String(storedExclusoes.fornecedores) : '');
        } else {
          setFaturamento('');
          setImpostos('');
          setCusto('');
          setClientes('');
          setFornecedores('');
        }
      } catch (err) {
        console.error('Erro ao carregar exclusões:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [dbAno, dbMes]);

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

      const records = await fetchAll(
        supabase.from('balanco_history')
          .select('conta, descricao, saldoAcumulado, empresaId')
          .eq('ano', dbAno)
          .eq('mes', dbMes)
          .neq('empresaId', 'exclusoes')
      );

      let totalCli = 0;
      let totalForn = 0;
      let matchCliCount = 0;
      let matchFornCount = 0;

      (records || []).forEach(r => {
        if (!r.conta) return;
        
        const isCli = clientesContas.some(c => r.conta.startsWith(c.trim()));
        if (isCli) {
          totalCli += (r.saldoAcumulado || 0);
          matchCliCount++;
        }

        const isForn = fornecedoresContas.some(c => r.conta.startsWith(c.trim()));
        if (isForn) {
          totalForn += (r.saldoAcumulado || 0);
          matchFornCount++;
        }
      });

      const cliFinal = Math.abs(totalCli);
      const fornFinal = Math.abs(totalForn);

      setClientes(cliFinal > 0 ? String(cliFinal) : '');
      setFornecedores(fornFinal > 0 ? String(fornFinal) : '');

      window.$toast(`Saldos calculados: Clientes R$ ${cliFinal.toLocaleString('pt-BR')} (${matchCliCount} contas), Fornecedores R$ ${fornFinal.toLocaleString('pt-BR')} (${matchFornCount} contas)`, { type: 'success' });
    } catch (err) {
      console.error(err);
      window.$alert('Erro ao puxar saldos do balanço: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Salvar Exclusões do Mês
  const handleSave = async () => {
    setSaving(true);
    try {
      const numFaturamento = parseFloat(faturamento) || 0;
      const numImpostos = parseFloat(impostos) || 0;
      const numCusto = parseFloat(custo) || 0;
      const numClientes = parseFloat(clientes) || 0;
      const numFornecedores = parseFloat(fornecedores) || 0;

      const trimestre = Math.ceil(dbMes / 3);

      // 1. Salvar objeto nos settings para histórico e consulta
      await saveSettings(`agf_exclusoes_${dbAno}_${dbMes}`, {
        faturamento: numFaturamento,
        impostos: numImpostos,
        custo: numCusto,
        clientes: numClientes,
        fornecedores: numFornecedores,
        updated_at: new Date().toISOString()
      });

      // 2. Gravar registros na DRE (dre_history)
      // Receita Bruta (Estorno = valor negativo para abater da receita)
      await supabase.from('dre_history').upsert({
        id: `manual_exclusoes_${dbAno}_${dbMes}_3.1.1.1.01.00001.EXC`,
        empresaId: 'exclusoes',
        ano: dbAno,
        mes: dbMes,
        trimestre,
        conta: '3.1.1.1.01.00001.EXC',
        descricao: 'Exclusão Intercompany - Faturamento',
        valorMensal: -Math.abs(numFaturamento)
      });

      // Impostos sobre Vendas (Estorno = valor positivo, reduzindo a dedução)
      await supabase.from('dre_history').upsert({
        id: `manual_exclusoes_${dbAno}_${dbMes}_3.1.1.2.01.EXC`,
        empresaId: 'exclusoes',
        ano: dbAno,
        mes: dbMes,
        trimestre,
        conta: '3.1.1.2.01.EXC',
        descricao: 'Exclusão Intercompany - Impostos s/ Vendas',
        valorMensal: Math.abs(numImpostos)
      });

      // Custos (Estorno = valor positivo, reduzindo o custo operacional)
      await supabase.from('dre_history').upsert({
        id: `manual_exclusoes_${dbAno}_${dbMes}_4.1.1.1.13.EXC`,
        empresaId: 'exclusoes',
        ano: dbAno,
        mes: dbMes,
        trimestre,
        conta: '4.1.1.1.13.EXC',
        descricao: 'Exclusão Intercompany - Custo (CPV/CMV)',
        valorMensal: Math.abs(numCusto)
      });

      // 3. Gravar registros no Balanço (balanco_history)
      // Clientes Ativo (Estorno = negativo)
      await supabase.from('balanco_history').upsert({
        id: `manual_exclusoes_${dbAno}_${dbMes}_1.1.1.3.01.EXC`,
        empresaId: 'exclusoes',
        ano: dbAno,
        mes: dbMes,
        trimestre,
        tipo: 'ativo',
        conta: '1.1.1.3.01.EXC',
        descricao: 'Exclusão Intercompany - Clientes',
        saldoAcumulado: -Math.abs(numClientes)
      });

      // Fornecedores Passivo (Estorno = positivo, anulando passivo credor)
      await supabase.from('balanco_history').upsert({
        id: `manual_exclusoes_${dbAno}_${dbMes}_2.1.1.1.01.EXC`,
        empresaId: 'exclusoes',
        ano: dbAno,
        mes: dbMes,
        trimestre,
        tipo: 'passivo',
        conta: '2.1.1.1.01.EXC',
        descricao: 'Exclusão Intercompany - Fornecedores',
        saldoAcumulado: Math.abs(numFornecedores)
      });

      window.$toast(`Exclusões de ${mesNome}/${dbAno} gravadas com sucesso!`, { type: 'success' });
      if (onSaved) onSaved();
    } catch (err) {
      console.error('Erro ao salvar exclusões:', err);
      window.$alert('Erro ao salvar exclusões: ' + err.message);
    } finally {
      setSaving(false);
    }
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
              Eliminação de faturamento, impostos, custos e saldos entre empresas do grupo para a DRE e Balanço Consolidado.
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

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '0.5rem 1.2rem', fontWeight: 'bold' }}
          >
            <Save size={15} /> {saving ? 'Salvando...' : 'Gravar Exclusões'}
          </button>
        </div>
      </div>

      {/* FORMULÁRIO EM GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem', alignItems: 'start' }}>
        
        {/* BLOCO 1: DRE / RESULTADO */}
        <div style={{
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '10px',
          padding: '1.1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FFB74D', fontWeight: 'bold', fontSize: '0.88rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
            <TrendingDown size={16} />
            <span>Resultado / DRE (Digitação Manual Consolidada)</span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#ccc', marginBottom: '4px' }}>
              💰 Faturamento entre Empresas (Receita Bruta):
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '0.82rem' }}>R$</span>
              <input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={faturamento}
                onChange={e => setFaturamento(e.target.value)}
                className="text-input"
                style={{ width: '100%', paddingLeft: '32px', fontSize: '0.88rem' }}
              />
            </div>
            <span style={{ fontSize: '0.7rem', color: '#888', marginTop: '2px', display: 'block' }}>
              Estorna da linha <strong>Receita Operacional Bruta</strong>
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#ccc', marginBottom: '4px' }}>
              📑 Impostos s/ Operações Intercompany:
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '0.82rem' }}>R$</span>
              <input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={impostos}
                onChange={e => setImpostos(e.target.value)}
                className="text-input"
                style={{ width: '100%', paddingLeft: '32px', fontSize: '0.88rem' }}
              />
            </div>
            <span style={{ fontSize: '0.7rem', color: '#888', marginTop: '2px', display: 'block' }}>
              Estorna da linha <strong>(-) Impostos s/ Vendas (Deduções)</strong>
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#ccc', marginBottom: '4px' }}>
              📦 Custo das Operações Intercompany (CPV/CMV):
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '0.82rem' }}>R$</span>
              <input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={custo}
                onChange={e => setCusto(e.target.value)}
                className="text-input"
                style={{ width: '100%', paddingLeft: '32px', fontSize: '0.88rem' }}
              />
            </div>
            <span style={{ fontSize: '0.7rem', color: '#888', marginTop: '2px', display: 'block' }}>
              Estorna da linha <strong>Custos Operacionais (CPV)</strong>
            </span>
          </div>
        </div>

        {/* BLOCO 2: BALANÇO PATRIMONIAL */}
        <div style={{
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '10px',
          padding: '1.1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64B5F6', fontWeight: 'bold', fontSize: '0.88rem' }}>
              <Building2 size={16} />
              <span>Balanço Patrimonial (Ativo & Passivo)</span>
            </div>
            <button
              type="button"
              onClick={handleAutoPullBalanco}
              disabled={loading}
              className="btn-secondary"
              style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px', borderColor: '#2196F3', color: '#64B5F6' }}
              title="Calcula os saldos somando as contas mapeadas em todas as empresas no mês"
            >
              <RefreshCw size={12} className={loading ? 'spin' : ''} /> Puxar do Balanço
            </button>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#ccc', marginBottom: '4px' }}>
              🏦 Clientes Intercompany (Ativo Circulante):
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '0.82rem' }}>R$</span>
              <input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={clientes}
                onChange={e => setClientes(e.target.value)}
                className="text-input"
                style={{ width: '100%', paddingLeft: '32px', fontSize: '0.88rem' }}
              />
            </div>
            <span style={{ fontSize: '0.7rem', color: '#888', marginTop: '2px', display: 'block' }}>
              Estorna dos saldos a receber de partes relacionadas no Ativo
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#ccc', marginBottom: '4px' }}>
              🏢 Fornecedores Intercompany (Passivo Circulante):
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '0.82rem' }}>R$</span>
              <input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={fornecedores}
                onChange={e => setFornecedores(e.target.value)}
                className="text-input"
                style={{ width: '100%', paddingLeft: '32px', fontSize: '0.88rem' }}
              />
            </div>
            <span style={{ fontSize: '0.7rem', color: '#888', marginTop: '2px', display: 'block' }}>
              Estorna das obrigações a pagar a partes relacionadas no Passivo
            </span>
          </div>

          <div style={{ background: 'rgba(33, 150, 243, 0.08)', border: '1px dashed rgba(33, 150, 243, 0.3)', borderRadius: '6px', padding: '8px 10px', fontSize: '0.72rem', color: '#90CAF9' }}>
            💡 Você pode clicar em <strong>Puxar do Balanço</strong> para o sistema somar as contas mapeadas sozinho, ou digitar/ajustar os valores livremente.
          </div>
        </div>

      </div>

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
                  Informe as contas analíticas ou prefixos contábeis das empresas ligadas. O botão <i>Puxar do Balanço</i> somará estas contas automaticamente.
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