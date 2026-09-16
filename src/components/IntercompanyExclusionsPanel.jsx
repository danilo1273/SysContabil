import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings, fetchAll } from '../utils/db';
import { supabase } from '../supabaseClient';
import { 
  Settings, 
  RefreshCw, 
  Check, 
  Save, 
  Building2, 
  Plus, 
  X,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  TrendingDown
} from 'lucide-react';

export default function IntercompanyExclusionsPanel({ dbAno, dbMes, companies = [], onSaved }) {
  const availableCompanies = companies && companies.length > 0 ? companies : [
    { id: 'equipamentos', name: 'AGF Equipamentos' },
    { id: 'rompedores', name: 'AGF Rompedores' },
    { id: 'casa', name: 'Casa da Escavadeira' }
  ];

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);

  // Mapeamento de contas por empresa: { [empresaId]: { clientesContas: [], fornecedoresContas: [] } }
  const [accountMapping, setAccountMapping] = useState({});
  const [mappingCompany, setMappingCompany] = useState(availableCompanies[0]?.id || 'equipamentos');
  const [detectedAccounts, setDetectedAccounts] = useState({ clientes: [], fornecedores: [] });
  const [newClienteInput, setNewClienteInput] = useState('');
  const [newFornecInput, setNewFornecInput] = useState('');

  // Saldos puxados automaticamente do balancete por empresa
  // { [empresaId]: { clientes: 0, fornecedores: 0, clientesContas: [], fornecedoresContas: [] } }
  const [pulledBalanco, setPulledBalanco] = useState({});

  // Valores manuais de DRE por empresa: { [empresaId]: { faturamento: '', impostos: '', custo: '' } }
  const [companyDRE, setCompanyDRE] = useState({});

  const mesNome = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ][dbMes - 1] || `Mês ${dbMes}`;

  const getCompanyName = (id) => {
    if (id === 'todas') return 'Todas as Empresas';
    const found = availableCompanies.find(c => c.id === id);
    return found ? found.name : id;
  };

  // Carregar dados iniciais e consultar balancetes do mês automaticamente
  const loadMonthData = async () => {
    setLoading(true);
    try {
      // 1. Carregar mapeamento de contas por empresa
      const storedMapping = await getSettings('agf_intercompany_mapping') || {};
      let currentMap = {};
      if (storedMapping && typeof storedMapping === 'object') {
        if (storedMapping.clientesContas || storedMapping.fornecedoresContas) {
          availableCompanies.forEach(c => {
            currentMap[c.id] = {
              clientesContas: [...(storedMapping.clientesContas || ['1.1.1.3.01.000001'])],
              fornecedoresContas: [...(storedMapping.fornecedoresContas || ['2.1.1.1.01.000001'])]
            };
          });
        } else {
          currentMap = storedMapping;
        }
      }
      setAccountMapping(currentMap);

      // 2. Buscar registros do Balanço para o mês/ano selecionado
      const balRecords = await fetchAll(
        supabase.from('balanco_history')
          .select('empresaId, conta, descricao, saldoAcumulado')
          .eq('ano', dbAno)
          .eq('mes', dbMes)
          .neq('empresaId', 'exclusoes')
      );

      // 3. Puxar automaticamente Clientes e Fornecedores por empresa usando o mapeamento
      const pulled = {};
      availableCompanies.forEach(c => {
        const cMap = currentMap[c.id] || { clientesContas: [], fornecedoresContas: [] };
        const cliMatches = (balRecords || []).filter(r => 
          r.empresaId === c.id && (cMap.clientesContas || []).some(acc => r.conta && r.conta.startsWith(acc.trim()))
        );
        const fornMatches = (balRecords || []).filter(r => 
          r.empresaId === c.id && (cMap.fornecedoresContas || []).some(acc => r.conta && r.conta.startsWith(acc.trim()))
        );

        pulled[c.id] = {
          clientes: cliMatches.reduce((sum, r) => sum + Math.abs(r.saldoAcumulado || 0), 0),
          fornecedores: fornMatches.reduce((sum, r) => sum + Math.abs(r.saldoAcumulado || 0), 0),
          clientesContas: cliMatches.map(r => `${r.conta} - ${r.descricao} (R$ ${Math.abs(r.saldoAcumulado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`),
          fornecedoresContas: fornMatches.map(r => `${r.conta} - ${r.descricao} (R$ ${Math.abs(r.saldoAcumulado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`)
        };
      });
      setPulledBalanco(pulled);

      // 4. Carregar valores salvos de DRE (Faturamento, Impostos, Custos)
      const storedDRE = await getSettings(`agf_exclusoes_empresas_${dbAno}_${dbMes}`);
      const legacyData = await getSettings(`agf_exclusoes_${dbAno}_${dbMes}`);
      const dreState = {};

      availableCompanies.forEach(c => {
        if (storedDRE && storedDRE[c.id]) {
          dreState[c.id] = {
            faturamento: storedDRE[c.id].faturamento !== undefined ? String(storedDRE[c.id].faturamento) : '',
            impostos: storedDRE[c.id].impostos !== undefined ? String(storedDRE[c.id].impostos) : '',
            custo: storedDRE[c.id].custo !== undefined ? String(storedDRE[c.id].custo) : ''
          };
        } else {
          dreState[c.id] = { faturamento: '', impostos: '', custo: '' };
        }
      });

      // Se não há por empresa, mas há legado consolidado, colocar na primeira empresa ou ratear
      const hasAnyStored = Object.values(dreState).some(v => v.faturamento || v.impostos || v.custo);
      if (!hasAnyStored && legacyData && (legacyData.faturamento || legacyData.impostos || legacyData.custo)) {
        const firstId = availableCompanies[0]?.id || 'equipamentos';
        dreState[firstId] = {
          faturamento: legacyData.faturamento ? String(legacyData.faturamento) : '',
          impostos: legacyData.impostos ? String(legacyData.impostos) : '',
          custo: legacyData.custo ? String(legacyData.custo) : ''
        };
      }

      setCompanyDRE(dreState);
    } catch (e) {
      console.error('Erro ao carregar dados de exclusão:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonthData();
  }, [dbAno, dbMes]);

  // Sugestões de contas no balanço para o modal de mapeamento
  const scanIntercompanyAccounts = async (targetComp = mappingCompany) => {
    try {
      let query = supabase.from('balanco_history')
        .select('conta, descricao, tipo, saldoAcumulado, empresaId')
        .neq('empresaId', 'exclusoes');
      
      if (targetComp && targetComp !== 'todas') {
        query = query.eq('empresaId', targetComp);
      }

      const records = await fetchAll(query);
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
          descUpper.includes('INTERCOMPANY') ||
          descUpper.includes('MUTUO') ||
          descUpper.includes('CONTROLADA');

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

  const handleSaveMapping = async () => {
    try {
      await saveSettings('agf_intercompany_mapping', accountMapping);
      window.$toast('Mapeamento de contas por empresa salvo com sucesso!', { type: 'success' });
      setShowMappingModal(false);
      // Recalcular saldos com o novo mapeamento
      loadMonthData();
    } catch (e) {
      window.$alert('Erro ao salvar mapeamento: ' + e.message);
    }
  };

  const addClienteConta = (conta) => {
    if (!conta) return;
    const cleanConta = conta.trim();
    const currentList = accountMapping[mappingCompany]?.clientesContas || [];
    if (currentList.includes(cleanConta)) return;

    setAccountMapping(prev => ({
      ...prev,
      [mappingCompany]: {
        ...(prev[mappingCompany] || { fornecedoresContas: [] }),
        clientesContas: [...currentList, cleanConta]
      }
    }));
    setNewClienteInput('');
  };

  const removeClienteConta = (conta) => {
    const currentList = accountMapping[mappingCompany]?.clientesContas || [];
    setAccountMapping(prev => ({
      ...prev,
      [mappingCompany]: {
        ...(prev[mappingCompany] || { fornecedoresContas: [] }),
        clientesContas: currentList.filter(c => c !== conta)
      }
    }));
  };

  const addFornecConta = (conta) => {
    if (!conta) return;
    const cleanConta = conta.trim();
    const currentList = accountMapping[mappingCompany]?.fornecedoresContas || [];
    if (currentList.includes(cleanConta)) return;

    setAccountMapping(prev => ({
      ...prev,
      [mappingCompany]: {
        ...(prev[mappingCompany] || { clientesContas: [] }),
        fornecedoresContas: [...currentList, cleanConta]
      }
    }));
    setNewFornecInput('');
  };

  const removeFornecConta = (conta) => {
    const currentList = accountMapping[mappingCompany]?.fornecedoresContas || [];
    setAccountMapping(prev => ({
      ...prev,
      [mappingCompany]: {
        ...(prev[mappingCompany] || { clientesContas: [] }),
        fornecedoresContas: currentList.filter(c => c !== conta)
      }
    }));
  };

  // Totais Consolidados Calculados
  const totalCliConsol = availableCompanies.reduce((acc, c) => acc + (pulledBalanco[c.id]?.clientes || 0), 0);
  const totalFornConsol = availableCompanies.reduce((acc, c) => acc + (pulledBalanco[c.id]?.fornecedores || 0), 0);
  const totalFatConsol = availableCompanies.reduce((acc, c) => acc + (parseFloat(companyDRE[c.id]?.faturamento) || 0), 0);
  const totalImpConsol = availableCompanies.reduce((acc, c) => acc + (parseFloat(companyDRE[c.id]?.impostos) || 0), 0);
  const totalCustoConsol = availableCompanies.reduce((acc, c) => acc + (parseFloat(companyDRE[c.id]?.custo) || 0), 0);

  const diffBalanco = totalCliConsol - totalFornConsol;

  // Salvar exclusões do mês
  const handleSaveMonthExclusions = async () => {
    setSaving(true);
    try {
      const trimestre = Math.ceil(dbMes / 3);

      // 1. Salvar configuração por empresa
      await saveSettings(`agf_exclusoes_empresas_${dbAno}_${dbMes}`, companyDRE);

      // 2. Salvar formato de lista para compatibilidade com Consolidado Personalizado
      const listEntries = availableCompanies.map(c => ({
        id: `exc_${dbAno}_${dbMes}_${c.id}`,
        empresaOrigem: c.id,
        empresaDestino: c.id,
        motivo: `Exclusão ${c.name}`,
        faturamento: parseFloat(companyDRE[c.id]?.faturamento) || 0,
        impostos: parseFloat(companyDRE[c.id]?.impostos) || 0,
        custo: parseFloat(companyDRE[c.id]?.custo) || 0,
        clientes: pulledBalanco[c.id]?.clientes || 0,
        fornecedores: pulledBalanco[c.id]?.fornecedores || 0
      }));
      await saveSettings(`agf_exclusoes_lista_${dbAno}_${dbMes}`, listEntries);

      // 3. Salvar formato consolidado padrão
      await saveSettings(`agf_exclusoes_${dbAno}_${dbMes}`, {
        faturamento: totalFatConsol,
        impostos: totalImpConsol,
        custo: totalCustoConsol,
        clientes: totalCliConsol,
        fornecedores: totalFornConsol,
        updated_at: new Date().toISOString()
      });

      // 4. Gravar na tabela dre_history para a empresa virtual 'exclusoes'
      await supabase.from('dre_history').delete().match({
        empresaId: 'exclusoes',
        ano: dbAno,
        mes: dbMes
      });

      if (totalFatConsol > 0 || totalImpConsol > 0 || totalCustoConsol > 0) {
        const dreEntries = [
          {
            id: `manual_exclusoes_${dbAno}_${dbMes}_3.1.1.1.01.00001.EXC`,
            empresaId: 'exclusoes',
            ano: dbAno,
            mes: dbMes,
            trimestre,
            conta: '3.1.1.1.01.00001.EXC',
            descricao: 'Exclusão Intercompany - Faturamento',
            valorMensal: -Math.abs(totalFatConsol)
          },
          {
            id: `manual_exclusoes_${dbAno}_${dbMes}_3.1.1.2.01.EXC`,
            empresaId: 'exclusoes',
            ano: dbAno,
            mes: dbMes,
            trimestre,
            conta: '3.1.1.2.01.EXC',
            descricao: 'Exclusão Intercompany - Impostos s/ Vendas',
            valorMensal: Math.abs(totalImpConsol)
          },
          {
            id: `manual_exclusoes_${dbAno}_${dbMes}_4.1.1.1.13.EXC`,
            empresaId: 'exclusoes',
            ano: dbAno,
            mes: dbMes,
            trimestre,
            conta: '4.1.1.1.13.EXC',
            descricao: 'Exclusão Intercompany - Custo (CPV/CMV)',
            valorMensal: Math.abs(totalCustoConsol)
          }
        ];
        for (const entry of dreEntries) {
          await supabase.from('dre_history').upsert(entry);
        }
      }

      // 5. Gravar na tabela balanco_history para a empresa virtual 'exclusoes'
      await supabase.from('balanco_history').delete().match({
        empresaId: 'exclusoes',
        ano: dbAno,
        mes: dbMes
      });

      if (totalCliConsol > 0 || totalFornConsol > 0) {
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
            saldoAcumulado: -Math.abs(totalCliConsol)
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
            saldoAcumulado: Math.abs(totalFornConsol)
          }
        ];
        for (const entry of balEntries) {
          await supabase.from('balanco_history').upsert(entry);
        }
      }

      window.$toast(`Exclusões de ${mesNome}/${dbAno} salvas com sucesso!`, { type: 'success' });
      if (onSaved) onSaved();
    } catch (err) {
      console.error(err);
      window.$alert('Erro ao salvar exclusões: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const activeMappingForCompany = accountMapping[mappingCompany] || { clientesContas: [], fornecedoresContas: [] };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid rgba(255, 152, 0, 0.3)' }}>
      {/* CABEÇALHO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ margin: 0, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingDown size={20} style={{ color: '#FF9800' }} />
              Exclusões e Eliminações Intercompany
            </h3>
            <span style={{ 
              background: 'rgba(255, 152, 0, 0.2)', 
              color: '#FFB74D', 
              padding: '2px 10px', 
              borderRadius: '12px', 
              fontSize: '0.8rem', 
              fontWeight: 'bold',
              border: '1px solid rgba(255, 152, 0, 0.4)'
            }}>
              {mesNome}/{dbAno}
            </span>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: '#aaa' }}>
            Mapeie as contas contábeis de cada empresa uma única vez. Os saldos de <strong>Clientes</strong> e <strong>Fornecedores</strong> são puxados sozinhos do Balanço e consolidados automaticamente.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={loadMonthData}
            disabled={loading}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.55rem 0.9rem', fontSize: '0.82rem' }}
            title="Recarregar saldos do balanço"
          >
            <RefreshCw size={14} className={loading ? 'spin-animation' : ''} />
            {loading ? 'Puxando...' : 'Recalcular Saldos'}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowMappingModal(true);
              scanIntercompanyAccounts(mappingCompany);
            }}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.55rem 0.9rem', fontSize: '0.82rem', borderColor: '#FF9800', color: '#FFB74D' }}
            title="Definir quais contas do plano contábil pertencem a cada empresa"
          >
            <Settings size={14} /> Mapear Contas do Balanço (por Empresa)
          </button>
        </div>
      </div>

      {/* CARDS DE RESUMO DO CONSOLIDADO PUXADO */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* Card Clientes */}
        <div style={{ background: 'rgba(33, 150, 243, 0.08)', border: '1px solid rgba(33, 150, 243, 0.25)', borderRadius: '10px', padding: '0.9rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#90CAF9', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>🏦 Clientes (Balanço)</span>
            <span style={{ fontSize: '0.65rem', background: 'rgba(33, 150, 243, 0.2)', padding: '1px 6px', borderRadius: '4px' }}>Auto</span>
          </div>
          <div style={{ fontSize: '1.15rem', color: '#fff', fontWeight: 'bold', marginTop: '6px', fontFamily: 'monospace' }}>
            R$ {totalCliConsol.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '4px' }}>Abate no Ativo Consolidado</div>
        </div>

        {/* Card Fornecedores */}
        <div style={{ background: 'rgba(255, 152, 0, 0.08)', border: '1px solid rgba(255, 152, 0, 0.25)', borderRadius: '10px', padding: '0.9rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#FFB74D', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>🏢 Fornecedores (Balanço)</span>
            <span style={{ fontSize: '0.65rem', background: 'rgba(255, 152, 0, 0.2)', padding: '1px 6px', borderRadius: '4px' }}>Auto</span>
          </div>
          <div style={{ fontSize: '1.15rem', color: '#fff', fontWeight: 'bold', marginTop: '6px', fontFamily: 'monospace' }}>
            R$ {totalFornConsol.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '4px' }}>Abate no Passivo Consolidado</div>
        </div>

        {/* Conciliação Clientes vs Fornecedores */}
        <div style={{ 
          background: Math.abs(diffBalanco) < 0.01 ? 'rgba(76, 175, 80, 0.08)' : 'rgba(239, 83, 80, 0.08)', 
          border: Math.abs(diffBalanco) < 0.01 ? '1px solid rgba(76, 175, 80, 0.25)' : '1px solid rgba(239, 83, 80, 0.25)', 
          borderRadius: '10px', 
          padding: '0.9rem' 
        }}>
          <div style={{ fontSize: '0.72rem', color: Math.abs(diffBalanco) < 0.01 ? '#81C784' : '#E57373', textTransform: 'uppercase', fontWeight: 'bold' }}>
            ⚖️ Conciliação Intercompany
          </div>
          <div style={{ fontSize: '1.15rem', color: '#fff', fontWeight: 'bold', marginTop: '6px', fontFamily: 'monospace' }}>
            {Math.abs(diffBalanco) < 0.01 ? (
              <span style={{ color: '#4CAF50', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={18} /> R$ 0,00
              </span>
            ) : (
              <span style={{ color: '#FF7043', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={18} /> R$ {diffBalanco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '4px' }}>
            {Math.abs(diffBalanco) < 0.01 ? 'Balanço 100% equilibrado' : 'Diferença entre Clientes e Fornec.'}
          </div>
        </div>

        {/* Card Faturamento DRE */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '0.9rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#ccc', textTransform: 'uppercase', fontWeight: 'bold' }}>
            💰 Faturamento (DRE)
          </div>
          <div style={{ fontSize: '1.15rem', color: '#fff', fontWeight: 'bold', marginTop: '6px', fontFamily: 'monospace' }}>
            R$ {totalFatConsol.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '4px' }}>Abate de Receita Bruta</div>
        </div>

        {/* Card Custo DRE */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '0.9rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#ccc', textTransform: 'uppercase', fontWeight: 'bold' }}>
            📉 Custo CPV/CMV (DRE)
          </div>
          <div style={{ fontSize: '1.15rem', color: '#fff', fontWeight: 'bold', marginTop: '6px', fontFamily: 'monospace' }}>
            R$ {totalCustoConsol.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '4px' }}>Abate de Custo da Mercadoria</div>
        </div>
      </div>

      {/* TABELA CONSOLIDADA POR EMPRESA */}
      <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: '1.5rem' }}>
        <table className="data-table" style={{ margin: 0 }}>
          <thead>
            <tr style={{ background: 'rgba(255, 152, 0, 0.08)' }}>
              <th style={{ width: '22%', color: '#FFB74D' }}>Empresa</th>
              <th style={{ width: '18%', color: '#90CAF9' }} title="Puxado automaticamente das contas contábeis mapeadas para esta empresa">
                Clientes (Balanço - Auto) ℹ️
              </th>
              <th style={{ width: '18%', color: '#FFB74D' }} title="Puxado automaticamente das contas contábeis mapeadas para esta empresa">
                Fornecedores (Balanço - Auto) ℹ️
              </th>
              <th style={{ width: '14%' }}>Faturamento (DRE)</th>
              <th style={{ width: '14%' }}>Impostos (DRE)</th>
              <th style={{ width: '14%' }}>Custo (DRE)</th>
            </tr>
          </thead>
          <tbody>
            {availableCompanies.map(comp => {
              const compPulled = pulledBalanco[comp.id] || { clientes: 0, fornecedores: 0, clientesContas: [], fornecedoresContas: [] };
              const dreVal = companyDRE[comp.id] || { faturamento: '', impostos: '', custo: '' };

              return (
                <tr key={comp.id}>
                  <td style={{ fontWeight: 'bold', color: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building2 size={15} style={{ color: '#FFB74D' }} />
                      <span>{comp.name}</span>
                    </div>
                  </td>

                  {/* Clientes - Auto Puxado */}
                  <td style={{ fontFamily: 'monospace' }}>
                    <div style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      padding: '4px 10px', 
                      borderRadius: '6px', 
                      background: compPulled.clientes > 0 ? 'rgba(33, 150, 243, 0.15)' : 'rgba(255,255,255,0.03)',
                      color: compPulled.clientes > 0 ? '#90CAF9' : '#888',
                      border: compPulled.clientes > 0 ? '1px solid rgba(33, 150, 243, 0.3)' : '1px solid transparent'
                    }} title={compPulled.clientesContas?.length > 0 ? compPulled.clientesContas.join('\n') : 'Nenhuma conta com saldo encontrada'}>
                      <span>R$ {compPulled.clientes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      {compPulled.clientes > 0 && <span style={{ fontSize: '0.65rem', background: '#2196F3', color: '#fff', padding: '1px 5px', borderRadius: '4px' }}>Auto</span>}
                    </div>
                  </td>

                  {/* Fornecedores - Auto Puxado */}
                  <td style={{ fontFamily: 'monospace' }}>
                    <div style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      padding: '4px 10px', 
                      borderRadius: '6px', 
                      background: compPulled.fornecedores > 0 ? 'rgba(255, 152, 0, 0.15)' : 'rgba(255,255,255,0.03)',
                      color: compPulled.fornecedores > 0 ? '#FFB74D' : '#888',
                      border: compPulled.fornecedores > 0 ? '1px solid rgba(255, 152, 0, 0.3)' : '1px solid transparent'
                    }} title={compPulled.fornecedoresContas?.length > 0 ? compPulled.fornecedoresContas.join('\n') : 'Nenhuma conta com saldo encontrada'}>
                      <span>R$ {compPulled.fornecedores.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      {compPulled.fornecedores > 0 && <span style={{ fontSize: '0.65rem', background: '#FF9800', color: '#000', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>Auto</span>}
                    </div>
                  </td>

                  {/* Faturamento DRE - Digitação */}
                  <td>
                    <input
                      type="number"
                      placeholder="0,00"
                      value={dreVal.faturamento}
                      onChange={e => {
                        const val = e.target.value;
                        setCompanyDRE(prev => ({
                          ...prev,
                          [comp.id]: { ...(prev[comp.id] || {}), faturamento: val }
                        }));
                      }}
                      className="text-input"
                      style={{ width: '100%', fontSize: '0.85rem', padding: '4px 8px', fontFamily: 'monospace' }}
                    />
                  </td>

                  {/* Impostos DRE - Digitação */}
                  <td>
                    <input
                      type="number"
                      placeholder="0,00"
                      value={dreVal.impostos}
                      onChange={e => {
                        const val = e.target.value;
                        setCompanyDRE(prev => ({
                          ...prev,
                          [comp.id]: { ...(prev[comp.id] || {}), impostos: val }
                        }));
                      }}
                      className="text-input"
                      style={{ width: '100%', fontSize: '0.85rem', padding: '4px 8px', fontFamily: 'monospace' }}
                    />
                  </td>

                  {/* Custo DRE - Digitação */}
                  <td>
                    <input
                      type="number"
                      placeholder="0,00"
                      value={dreVal.custo}
                      onChange={e => {
                        const val = e.target.value;
                        setCompanyDRE(prev => ({
                          ...prev,
                          [comp.id]: { ...(prev[comp.id] || {}), custo: val }
                        }));
                      }}
                      className="text-input"
                      style={{ width: '100%', fontSize: '0.85rem', padding: '4px 8px', fontFamily: 'monospace' }}
                    />
                  </td>
                </tr>
              );
            })}

            {/* LINHA TOTAL CONSOLIDADO */}
            <tr style={{ background: 'rgba(255, 152, 0, 0.12)', fontWeight: 'bold' }}>
              <td style={{ color: '#FFB74D', textTransform: 'uppercase' }}>
                🌐 Total Consolidado
              </td>
              <td style={{ color: '#90CAF9', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                R$ {totalCliConsol.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={{ color: '#FFB74D', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                R$ {totalFornConsol.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={{ color: '#fff', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                R$ {totalFatConsol.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={{ color: '#fff', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                R$ {totalImpConsol.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={{ color: '#fff', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                R$ {totalCustoConsol.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* BOTÕES DE AÇÃO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <span style={{ fontSize: '0.78rem', color: '#888' }}>
          💡 As exclusões salvas são aplicadas automaticamente no <strong>Consolidado Geral</strong> e nos <strong>Consolidados Personalizados</strong> (DRE, Balanço, DFC e Dashboard).
        </span>

        <button
          type="button"
          onClick={handleSaveMonthExclusions}
          disabled={saving}
          className="btn-primary"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '0.7rem 1.6rem', 
            fontWeight: 'bold', 
            fontSize: '0.9rem',
            background: 'linear-gradient(135deg, #FF9800, #F57C00)',
            border: 'none',
            color: '#000',
            boxShadow: '0 4px 15px rgba(255, 152, 0, 0.4)'
          }}
        >
          <Save size={16} />
          {saving ? 'Gravando no Banco...' : `Salvar Exclusões de ${mesNome}/${dbAno}`}
        </button>
      </div>

      {/* MODAL DE MAPEAMENTO DE CONTAS CONTÁBEIS POR EMPRESA */}
      {showMappingModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)',
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
            maxWidth: '680px',
            maxHeight: '92vh',
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
                  Mapear Contas do Balanço por Empresa
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#aaa' }}>
                  Cada empresa possui planos de contas e códigos contábeis distintos. Configure as contas de Clientes e Fornecedores individualmente por empresa.
                </p>
              </div>
              <button
                onClick={() => setShowMappingModal(false)}
                style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* SELETOR DE EMPRESA (ABAS) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#ccc', marginBottom: '6px', fontWeight: 'bold' }}>
                Selecione a Empresa para Configurar:
              </label>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {availableCompanies.map(c => {
                  const isSelected = mappingCompany === c.id;
                  const compAccountsCount = (accountMapping[c.id]?.clientesContas?.length || 0) + (accountMapping[c.id]?.fornecedoresContas?.length || 0);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setMappingCompany(c.id);
                        scanIntercompanyAccounts(c.id);
                      }}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        background: isSelected ? 'rgba(255, 152, 0, 0.2)' : 'rgba(255,255,255,0.05)',
                        border: isSelected ? '1px solid #FF9800' : '1px solid rgba(255,255,255,0.1)',
                        color: isSelected ? '#FFB74D' : '#ccc',
                        fontWeight: isSelected ? 'bold' : 'normal',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <span>🏢 {c.name}</span>
                      <span style={{ fontSize: '0.68rem', background: isSelected ? '#FF9800' : 'rgba(255,255,255,0.15)', color: isSelected ? '#000' : '#fff', padding: '1px 6px', borderRadius: '10px' }}>
                        {compAccountsCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SEÇÃO 1: CONTAS DE CLIENTES DA EMPRESA SELECIONADA */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#64B5F6' }}>
                  🏦 Clientes / A Receber em {getCompanyName(mappingCompany)} (Ativo):
                </h4>
                <span style={{ fontSize: '0.7rem', color: '#888' }}>
                  Contas onde {getCompanyName(mappingCompany)} tem a receber das outras empresas
                </span>
              </div>
              
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
                  <Plus size={14} /> Adicionar Conta
                </button>
              </div>

              {/* Tags de Contas Adicionadas */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '32px' }}>
                {(activeMappingForCompany.clientesContas || []).length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: '#666', fontStyle: 'italic' }}>Nenhuma conta de cliente mapeada para esta empresa.</span>
                ) : (
                  (activeMappingForCompany.clientesContas || []).map(conta => (
                    <span key={conta} style={{ background: 'rgba(33, 150, 243, 0.15)', color: '#90CAF9', border: '1px solid rgba(33, 150, 243, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {conta}
                      <X size={12} style={{ cursor: 'pointer', color: '#E57373' }} onClick={() => removeClienteConta(conta)} />
                    </span>
                  ))
                )}
              </div>

              {/* Sugestões do balancete desta empresa */}
              {detectedAccounts.clientes.length > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: '0.7rem', color: '#888' }}>Contas intercompany identificadas nos balancetes de {getCompanyName(mappingCompany)}:</span>
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

            {/* SEÇÃO 2: CONTAS DE FORNECEDORES DA EMPRESA SELECIONADA */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#FFB74D' }}>
                  🏢 Fornecedores / A Pagar em {getCompanyName(mappingCompany)} (Passivo):
                </h4>
                <span style={{ fontSize: '0.7rem', color: '#888' }}>
                  Contas onde {getCompanyName(mappingCompany)} deve a partes relacionadas
                </span>
              </div>
              
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
                  <Plus size={14} /> Adicionar Conta
                </button>
              </div>

              {/* Tags de Contas Adicionadas */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '32px' }}>
                {(activeMappingForCompany.fornecedoresContas || []).length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: '#666', fontStyle: 'italic' }}>Nenhuma conta de fornecedor mapeada para esta empresa.</span>
                ) : (
                  (activeMappingForCompany.fornecedoresContas || []).map(conta => (
                    <span key={conta} style={{ background: 'rgba(255, 152, 0, 0.15)', color: '#FFB74D', border: '1px solid rgba(255, 152, 0, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {conta}
                      <X size={12} style={{ cursor: 'pointer', color: '#E57373' }} onClick={() => removeFornecConta(conta)} />
                    </span>
                  ))
                )}
              </div>

              {/* Sugestões do balancete desta empresa */}
              {detectedAccounts.fornecedores.length > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: '0.7rem', color: '#888' }}>Contas intercompany identificadas nos balancetes de {getCompanyName(mappingCompany)}:</span>
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
                Salvar Mapeamento no Banco de Dados
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
