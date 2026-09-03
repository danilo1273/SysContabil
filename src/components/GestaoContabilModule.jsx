import React, { useState, useEffect } from 'react';
import RelatoriosContabeis from './RelatoriosContabeis';
import { getRawRecords, getSettings } from '../utils/db';

function GestaoContabilModule({ userRole, userName, companies }) {
    const [activeTab, setActiveTab] = useState('integracoes');
    const [taxDataStore, setTaxDataStore] = useState({});
    const [dreCambioRealizado, setDreCambioRealizado] = useState({});
    const [selectedMes, setSelectedMes] = useState(new Date().getMonth() + 1);
    const [selectedAno, setSelectedAno] = useState(new Date().getFullYear());
    
    const [integracoes, setIntegracoes] = useState({});
    const [obrigacoes, setObrigacoes] = useState({});
    const [pendencias, setPendencias] = useState([]);
    const [users, setUsers] = useState([]);

    const [isProcessing, setIsProcessing] = useState(false);
    const [resolvingPendencia, setResolvingPendencia] = useState(null);
    const [objectiveText, setObjectiveText] = useState('');
    const [editingPendencia, setEditingPendencia] = useState(null);

    // Filtros da aba de Pendências
    const [pendenciaFiltroStatus, setPendenciaFiltroStatus] = useState('todos');
    const [pendenciaFiltroMes, setPendenciaFiltroMes] = useState('todos');
    const [pendenciaFiltroAno, setPendenciaFiltroAno] = useState(new Date().getFullYear());
    const [pendenciaFiltroResp, setPendenciaFiltroResp] = useState('todos');
    const [pendenciaSearch, setPendenciaSearch] = useState('');

    const [obrigacoesTipos, setObrigacoesTipos] = useState([]);
    const [showManageTipos, setShowManageTipos] = useState(false);
    const [newObrigacaoTipo, setNewObrigacaoTipo] = useState('');
    const [newObrigacaoNome, setNewObrigacaoNome] = useState('');

    // Fetch data
    const loadData = async () => {
        setIsProcessing(true);
        try {
            // Load Users
            try {
                const storedUsers = await getSettings('agf_users');
                if (storedUsers && Array.isArray(storedUsers) && storedUsers.length > 0) {
                    setUsers(storedUsers);
                } else {
                    const uRes = await fetch(`/api/settings/agf_users`);
                    if (uRes.ok) {
                        const uData = await uRes.json();
                        setUsers(uData || []);
                    }
                }
            } catch (err) {
                const uRes = await fetch(`/api/settings/agf_users`);
                if (uRes.ok) {
                    const uData = await uRes.json();
                    setUsers(uData || []);
                }
            }

            // Load Integrações
            const intRes = await fetch(`/api/gestao/integracoes?ano=${selectedAno}&mes=${selectedMes}`);
            const intData = await intRes.json();
            const intMap = {};
            intData.forEach(d => intMap[d.tipo] = d);
            setIntegracoes(intMap);

            // Load Obrigações
            const obRes = await fetch(`/api/gestao/obrigacoes?ano=${selectedAno}&mes=${selectedMes}`);
            const obData = await obRes.json();
            const obMap = {};
            obData.forEach(d => obMap[d.tipo] = d);
            setObrigacoes(obMap);

            // Load Pendências
            const penRes = await fetch(`/api/gestao/pendencias`);
            const penData = await penRes.json();
            setPendencias(penData);
            
            // Load Obrigações Tipos
            const tipRes = await fetch(`/api/settings/agf_obrigacoes_tipos`);
            if (tipRes.ok) {
                const tipData = await tipRes.json();
                if (tipData && Array.isArray(tipData) && tipData.length > 0) {
                    setObrigacoesTipos(tipData);
                } else {
                    // Default fallback
                    setObrigacoesTipos([
                        { tipo: 'sped_ecf', nome: 'SPED Contábil Fiscal (ECF)' },
                        { tipo: 'sped_contribuicoes', nome: 'SPED Contribuições' },
                        { tipo: 'sped_icms', nome: 'SPED ICMS/IPI' },
                        { tipo: 'dctf_web', nome: 'DCTF Web' },
                        { tipo: 'efd_reinf', nome: 'EFD Reinf' }
                    ]);
                }
            }

            // Load Tax Data Store
            const tRes = await fetch(`/api/settings/agf_tax_store`);
            if (tRes.ok) {
                const tData = await tRes.json();
                setTaxDataStore(tData || {});
            }

            try {
                const rawRecs = await getRawRecords(selectedAno, selectedMes);
                if (rawRecs && rawRecs.dre) {
                    const dreCambioMap = {};
                    for (const r of rawRecs.dre) {
                        if (r.conta && r.conta.startsWith('4.3.1.1.03') && r.valorMensal) {
                            dreCambioMap[r.empresaId] = (dreCambioMap[r.empresaId] || 0) + r.valorMensal;
                        }
                    }
                    setDreCambioRealizado(dreCambioMap);
                }
            } catch (e) {
                console.warn("Could not fetch DRE for variacao cambial", e);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedAno, selectedMes]);

    useEffect(() => {
        const handleRoute = (route) => {
            if (route === 'gestao-pendencias') setActiveTab('pendencias');
            else if (route === 'gestao-integracoes') setActiveTab('integracoes');
            else if (route === 'gestao-obrigacoes') setActiveTab('obrigacoes');
        };

        if (window.__agf_pending_route) {
            handleRoute(window.__agf_pending_route);
            window.__agf_pending_route = null;
        }

        const handleNav = (e) => handleRoute(e.detail);
        window.addEventListener('agf_navigate', handleNav);
        return () => window.removeEventListener('agf_navigate', handleNav);
    }, []);

    const handleSaveIntegracao = async (tipo, dia_atual, responsavel) => {
        const payload = {
            id: `${selectedAno}-${selectedMes}-${tipo}`,
            mes: selectedMes,
            ano: selectedAno,
            tipo,
            dia_atual,
            responsavel,
            updated_at: new Date().toISOString()
        };
        await fetch(`/api/gestao/integracoes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        loadData();
    };

    const handleSaveObrigacao = async (tipo, status, data_entrega, responsavel) => {
        const payload = {
            id: `${selectedAno}-${selectedMes}-${tipo}`,
            mes: selectedMes,
            ano: selectedAno,
            tipo,
            status,
            data_entrega,
            responsavel,
            updated_at: new Date().toISOString()
        };
        await fetch(`/api/gestao/obrigacoes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        loadData();
    };

    const canEditOrDeletePendencia = (p) => {
        if (!p) return false;
        const isOwner = p.criador === userName || p.criado_por === userName;
        const isSuper = (['danilo', 'ryan.santos'].includes(userName)) || userRole === 'superadmin' || userRole === 'admin';
        return isOwner || isSuper;
    };

    const canResolvePendencia = (p) => {
        if (!p) return false;
        const isResp = p.responsavel === userName;
        const isSuper = (['danilo', 'ryan.santos'].includes(userName)) || userRole === 'superadmin' || userRole === 'admin';
        return isResp || isSuper;
    };

    const handleAddPendencia = async (e) => {
        e.preventDefault();
        const doc = e.target.doc.value;
        const motivo = e.target.motivo.value;
        const resp = e.target.responsavel.value;
        const mesRef = e.target.mesRef ? parseInt(e.target.mesRef.value) : selectedMes;
        const anoRef = e.target.anoRef ? parseInt(e.target.anoRef.value) : selectedAno;
        if (!doc || !motivo || !resp) return;

        const payload = {
            id: 'pend-' + Date.now(),
            documento: doc,
            motivo,
            responsavel: resp,
            criador: userName || 'Sistema',
            mes: mesRef,
            ano: anoRef,
            status: 'pendente',
            data_criacao: new Date().toISOString(),
            data_correcao: null,
            historico: JSON.stringify([{ action: 'Criado', user: userName || 'Sistema', date: new Date().toISOString() }])
        };

        await fetch(`/api/gestao/pendencias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        e.target.reset();
        loadData();
    };

    const handleSaveEditPendencia = async (e) => {
        e.preventDefault();
        if (!editingPendencia) return;

        const doc = e.target.editDoc.value;
        const motivo = e.target.editMotivo.value;
        const resp = e.target.editResp.value;
        const mesRef = parseInt(e.target.editMes.value);
        const anoRef = parseInt(e.target.editAno.value);

        let hist = [];
        try { hist = JSON.parse(editingPendencia.historico); } catch (err) {}
        hist.push({ action: 'Alterado por ' + (userName || 'Sistema'), user: userName || 'Sistema', date: new Date().toISOString() });

        const updatedPayload = {
            ...editingPendencia,
            documento: doc,
            motivo,
            responsavel: resp,
            mes: mesRef,
            ano: anoRef,
            historico: JSON.stringify(hist)
        };

        await fetch(`/api/gestao/pendencias/${editingPendencia.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedPayload)
        });

        setEditingPendencia(null);
        loadData();
    };

    const handleDeletePendencia = async (p) => {
        if (!canEditOrDeletePendencia(p)) {
            window.$alert('Apenas quem criou a pendência ou o superadmin pode excluí-la.', { type: 'warning' });
            return;
        }

        const ok = await window.$confirm(`Deseja realmente excluir a pendência do documento "${p.documento}"?`, { title: 'Excluir Pendência', type: 'danger' });
        if (ok) {
            await fetch(`/api/gestao/pendencias/${p.id}`, {
                method: 'DELETE'
            });
            window.$toast('Pendência excluída com sucesso!');
            loadData();
        }
    };

    const handleReopenPendencia = async (p) => {
        if (!canEditOrDeletePendencia(p)) {
            window.$alert('Apenas quem criou a pendência ou o superadmin pode reabri-la.');
            return;
        }

        const ok = await window.$confirm(`Reabrir a pendência do documento "${p.documento}" para nova correção?`, { title: 'Reabrir Pendência' });
        if (ok) {
            let hist = [];
            try { hist = JSON.parse(p.historico); } catch (err) {}
            hist.push({ action: 'Reaberto por ' + (userName || 'Sistema'), user: userName || 'Sistema', date: new Date().toISOString() });

            await fetch(`/api/gestao/pendencias/${p.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'pendente',
                    data_correcao: null,
                    historico: JSON.stringify(hist)
                })
            });
            loadData();
        }
    };

    const handleConfirmResolve = async () => {
        if (!resolvingPendencia) return;
        if (!objectiveText.trim()) {
            window.$alert('Por favor, informe a ação corretiva realizada.', { type: 'warning' });
            return;
        }

        let hist = [];
        try { hist = JSON.parse(resolvingPendencia.historico); } catch (e) {}
        hist.push({ action: 'Resolvido: ' + objectiveText, user: userName || 'Sistema', date: new Date().toISOString() });

        await fetch(`/api/gestao/pendencias/${resolvingPendencia.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'corrigido',
                data_correcao: new Date().toISOString(),
                historico: JSON.stringify(hist)
            })
        });
        
        setResolvingPendencia(null);
        setObjectiveText('');
        loadData();
    };

    const handleAddTipo = async () => {
        if (!newObrigacaoTipo || !newObrigacaoNome) return;
        const newTipos = [...obrigacoesTipos, { tipo: newObrigacaoTipo, nome: newObrigacaoNome }];
        
        await fetch(`/api/settings/agf_obrigacoes_tipos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: newTipos })
        });
        setObrigacoesTipos(newTipos);
        setNewObrigacaoTipo('');
        setNewObrigacaoNome('');
    };

    const saveVariacaoCambial = async (compId, val) => {
        const key = `${compId}_${selectedAno}_${selectedMes}`;
        const oldData = taxDataStore[key] || {};
        const newData = { ...oldData, presumidoCambioRealizado: val, lalurCambioRealizado: val };
        const newStore = { ...taxDataStore, [key]: newData };
        setTaxDataStore(newStore);
        try {
            await fetch(`/api/settings/agf_tax_store`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: newStore })
            });
        } catch (e) { console.error(e); }
    };

    const handleRemoveTipo = async (tipoKey) => {
        const newTipos = obrigacoesTipos.filter(t => t.tipo !== tipoKey);
        await fetch(`/api/settings/agf_obrigacoes_tipos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: newTipos })
        });
        setObrigacoesTipos(newTipos);
    };

    const renderIntegracaoCard = (title, tipo) => {
        const data = integracoes[tipo] || { dia_atual: 0, responsavel: '' };
        const isCompleted = data.dia_atual >= 31;
        const progress = Math.min((data.dia_atual / 31) * 100, 100);

        return (
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '8px', borderLeft: isCompleted ? '4px solid #4CAF50' : '4px solid #FFC107', flex: '1', minWidth: '300px' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#fff' }}>{title}</h3>
                
                <div style={{ background: 'rgba(0,0,0,0.3)', height: '10px', borderRadius: '5px', marginBottom: '1rem', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: isCompleted ? '#4CAF50' : '#FFC107', transition: 'width 0.3s' }}></div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <div>
                        <label style={{ fontSize: '0.85rem', color: '#aaa', display: 'block', marginBottom: '0.3rem' }}>Integrado até o dia:</label>
                        <input type="number" min="0" max="31" value={data.dia_atual} 
                            onChange={(e) => handleSaveIntegracao(tipo, parseInt(e.target.value) || 0, data.responsavel)}
                            className="text-input" style={{ width: '80px' }}
                            disabled={!(['danilo', 'ryan.santos'].includes(userName)) && userName !== data.responsavel}
                        />
                        <span style={{ marginLeft: '10px', fontSize: '0.9rem', color: '#888' }}>de 31</span>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.85rem', color: '#aaa', display: 'block', marginBottom: '0.3rem' }}>Responsável:</label>
                        <select value={data.responsavel} onChange={(e) => handleSaveIntegracao(tipo, data.dia_atual, e.target.value)} className="select-input" style={{ width: '100%' }} disabled={!(['danilo', 'ryan.santos'].includes(userName))}>
                            <option value="">Selecione...</option>
                                {contabilUsers.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                        </select>
                    </div>
                </div>
                {data.updated_at && <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '1rem', marginBottom: '0' }}>Última atualização: {new Date(data.updated_at).toLocaleString('pt-BR')}</p>}
            </div>
        );
    };

      const ObrigacaoRow = ({ title, tipo }) => {
        const data = obrigacoes[tipo] || { status: 'nao_iniciado', data_entrega: '', responsavel: '' };
        const [localDate, setLocalDate] = React.useState(data.data_entrega || '');
        
        React.useEffect(() => {
            setLocalDate(data.data_entrega || '');
        }, [data.data_entrega]);

        const handleBlurDate = () => {
            if (localDate !== (data.data_entrega || '')) {
                handleSaveObrigacao(tipo, data.status, localDate, data.responsavel);
            }
        };

        const canEditStatus = (['danilo', 'ryan.santos'].includes(userName)) || userName === data.responsavel;
        const canEditResp = (['danilo', 'ryan.santos'].includes(userName));

        return (
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '1rem 0', fontWeight: 'bold' }}>{title}</td>
                <td style={{ padding: '1rem 0' }}>
                    <select 
                        value={data.status} 
                        onChange={(e) => handleSaveObrigacao(tipo, e.target.value, localDate, data.responsavel)} 
                        className="select-input" 
                        style={{ width: '130px', color: data.status === 'finalizado' ? '#81C784' : data.status === 'iniciado' ? '#FFB74D' : '#ccc' }}
                        disabled={!canEditStatus}
                    >
                        <option value="nao_iniciado">Não Iniciado</option>
                        <option value="iniciado">Iniciado</option>
                        <option value="finalizado">Finalizado</option>
                    </select>
                </td>
                <td style={{ padding: '1rem 0' }}>
                    <input 
                        type="date" 
                        value={localDate} 
                        onChange={(e) => setLocalDate(e.target.value)}
                        onBlur={handleBlurDate}
                        className="text-input" 
                        disabled={!canEditStatus}
                    />
                </td>
                <td style={{ padding: '1rem 0' }}>
                    <select 
                        value={data.responsavel} 
                        onChange={(e) => handleSaveObrigacao(tipo, data.status, localDate, e.target.value)} 
                        className="select-input" 
                        style={{ width: '150px' }}
                        disabled={!canEditResp}
                    >
                        <option value="">Selecione...</option>
                        {displayUsers.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                    </select>
                </td>
            </tr>
        );
    };
    const contabilUsers = (users && users.length > 0)
        ? users
            .filter(u => 
                (['danilo', 'ryan.santos'].includes(u.username)) || 
                u.role === 'superadmin' || 
                u.role === 'admin' || 
                (u.permissions && u.permissions.includes('contabil'))
            )
            .sort((a, b) => (a.username || '').localeCompare(b.username || ''))
        : [];
    const displayUsers = contabilUsers.length > 0 ? contabilUsers : (users || []);

    return (
        <div className="glass-panel" style={{ padding: '2rem', marginTop: '1rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ color: 'var(--color-primary)', margin: 0 }}>Gestão e Integração Contábil</h2>
                    <p style={{ color: '#888', margin: '0.5rem 0 0 0' }}>Acompanhamento de fechamento e obrigações</p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <select value={selectedMes} onChange={e => setSelectedMes(parseInt(e.target.value))} className="select-input">
                        {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][i]}</option>)}
                    </select>
                    <select value={selectedAno} onChange={e => setSelectedAno(parseInt(e.target.value))} className="select-input">
                        {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #333', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <button className={activeTab === 'integracoes' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('integracoes')}>Integrações do Mês</button>
                <button className={activeTab === 'obrigacoes' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('obrigacoes')}>Obrigações Acessórias</button>
                <button className={activeTab === 'pendencias' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('pendencias')}>Documentos Pendentes</button>
                <button className={activeTab === 'relatorios' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('relatorios')}>Relatórios</button>
                <button className={activeTab === 'variacao' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('variacao')}>Variação Cambial</button>
            </div>

            {activeTab === 'relatorios' && (
              <RelatoriosContabeis selectedAno={selectedAno} selectedMes={selectedMes} companies={companies} />
            )}

            {activeTab === 'integracoes' && (
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    {renderIntegracaoCard('Entradas', 'entradas')}
                    {renderIntegracaoCard('Saídas', 'saidas')}
                    {renderIntegracaoCard('Conciliação Financeiro', 'financeiro')}
                </div>
            )}

            {activeTab === 'obrigacoes' && (
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', color: '#ddd' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #444', color: '#888', textAlign: 'left' }}>
                                <th style={{ paddingBottom: '1rem' }}>Obrigação</th>
                                <th style={{ paddingBottom: '1rem' }}>Status</th>
                                <th style={{ paddingBottom: '1rem' }}>Data Entrega</th>
                                <th style={{ paddingBottom: '1rem' }}>Responsável</th>
                            </tr>
                        </thead>
                        <tbody>
                            {obrigacoesTipos.map(t => (
                                <ObrigacaoRow key={t.tipo} title={t.nome} tipo={t.tipo} />
                            ))}
                        </tbody>
                    </table>
                    {(['danilo', 'ryan.santos'].includes(userName)) && (
                        <button onClick={() => setShowManageTipos(true)} className="btn-secondary" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
                            ⚙️ Gerenciar Obrigações
                        </button>
                    )}
                </div>
            )}

            {activeTab === 'pendencias' && (() => {
                // Filtragem das pendências
                const filteredPendencias = pendencias.filter(p => {
                    if (pendenciaFiltroStatus !== 'todos' && p.status !== pendenciaFiltroStatus) return false;
                    
                    if (pendenciaFiltroAno !== 'todos') {
                        const pAno = p.ano || (p.data_criacao ? new Date(p.data_criacao).getFullYear() : null);
                        if (pAno && pAno !== parseInt(pendenciaFiltroAno)) return false;
                    }

                    if (pendenciaFiltroMes !== 'todos') {
                        const pMes = p.mes || (p.data_criacao ? new Date(p.data_criacao).getMonth() + 1 : null);
                        if (pMes && pMes !== parseInt(pendenciaFiltroMes)) return false;
                    }

                    if (pendenciaFiltroResp !== 'todos' && p.responsavel !== pendenciaFiltroResp) return false;

                    if (pendenciaSearch.trim()) {
                        const s = pendenciaSearch.toLowerCase();
                        const matchDoc = (p.documento || '').toLowerCase().includes(s);
                        const matchMot = (p.motivo || '').toLowerCase().includes(s);
                        const matchCri = (p.criador || '').toLowerCase().includes(s);
                        const matchRes = (p.responsavel || '').toLowerCase().includes(s);
                        if (!matchDoc && !matchMot && !matchCri && !matchRes) return false;
                    }

                    return true;
                });

                const pendentesList = filteredPendencias.filter(p => p.status === 'pendente');
                const corrigidosList = filteredPendencias.filter(p => p.status === 'corrigido');

                const totalGeralPendentes = pendencias.filter(p => p.status === 'pendente').length;
                const totalGeralCorrigidos = pendencias.filter(p => p.status === 'corrigido').length;

                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        {/* BANNER DE INDICADORES DE PENDÊNCIAS */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: '1rem'
                        }}>
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.12), rgba(30, 30, 35, 0.8))',
                                border: '1px solid rgba(255, 193, 7, 0.3)',
                                borderRadius: '10px',
                                padding: '1rem 1.2rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: '#FFCA28', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                        Aguardando Correção
                                    </div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>
                                        {totalGeralPendentes}
                                    </div>
                                </div>
                                <span style={{ fontSize: '2.2rem' }}>⚠️</span>
                            </div>

                            <div style={{
                                background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.12), rgba(30, 30, 35, 0.8))',
                                border: '1px solid rgba(76, 175, 80, 0.3)',
                                borderRadius: '10px',
                                padding: '1rem 1.2rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: '#81C784', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                        Documentos Corrigidos
                                    </div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>
                                        {totalGeralCorrigidos}
                                    </div>
                                </div>
                                <span style={{ fontSize: '2.2rem' }}>✅</span>
                            </div>

                            <div style={{
                                background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.12), rgba(30, 30, 35, 0.8))',
                                border: '1px solid rgba(33, 150, 243, 0.3)',
                                borderRadius: '10px',
                                padding: '1rem 1.2rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: '#90CAF9', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                        Total Registrado
                                    </div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>
                                        {pendencias.length}
                                    </div>
                                </div>
                                <span style={{ fontSize: '2.2rem' }}>📋</span>
                            </div>
                        </div>

                        {/* FORMULÁRIO DE ABERTURA / LOTE DE PENDÊNCIA */}
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 193, 7, 0.25)',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                        }}>
                            <h3 style={{ margin: '0 0 1.2rem 0', color: '#FFCA28', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>➕</span> Registrar Novo Documento com Pendência
                            </h3>

                            <form onSubmit={handleAddPendencia} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', color: '#ccc', fontSize: '0.82rem', fontWeight: 'bold' }}>
                                        📄 Nº Documento / Chave NF
                                    </label>
                                    <input 
                                        name="doc" 
                                        type="text" 
                                        className="text-input" 
                                        style={{ width: '100%', background: '#141418', border: '1px solid #444' }} 
                                        placeholder="Ex: NFS 9 / NF 12345" 
                                        required 
                                    />
                                </div>

                                <div style={{ gridColumn: 'span 2', minWidth: '260px' }}>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', color: '#ccc', fontSize: '0.82rem', fontWeight: 'bold' }}>
                                        ⚠️ Motivo do Retorno / Descrição do Erro
                                    </label>
                                    <input 
                                        name="motivo" 
                                        type="text" 
                                        className="text-input" 
                                        style={{ width: '100%', background: '#141418', border: '1px solid #444' }} 
                                        placeholder="Ex: Tomar crédito PIS e COFINS / CFOP incorreto" 
                                        required 
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', color: '#ccc', fontSize: '0.82rem', fontWeight: 'bold' }}>
                                        🙋‍♂️ Designar Correção Para:
                                    </label>
                                    <select 
                                        name="responsavel" 
                                        className="select-input" 
                                        style={{ width: '100%', background: '#141418', border: '1px solid #444' }} 
                                        required
                                    >
                                        <option value="">Selecione o responsável...</option>
                                        {displayUsers.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                                    </select>
                                </div>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: '0.4rem', color: '#aaa', fontSize: '0.8rem' }}>Mês Ref.</label>
                                        <select name="mesRef" defaultValue={selectedMes} className="select-input" style={{ width: '100%', background: '#141418', border: '1px solid #444' }}>
                                            {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][i]}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: '0.4rem', color: '#aaa', fontSize: '0.8rem' }}>Ano</label>
                                        <select name="anoRef" defaultValue={selectedAno} className="select-input" style={{ width: '100%', background: '#141418', border: '1px solid #444' }}>
                                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <button 
                                        type="submit" 
                                        className="btn-primary" 
                                        style={{ 
                                            width: '100%', 
                                            height: '40px', 
                                            background: '#FFB300', 
                                            color: '#000', 
                                            fontWeight: 'bold', 
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <span>+</span> Abrir Pendência
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* BARRA DE FILTROS AVANÇADOS */}
                        <div style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '10px',
                            padding: '1rem 1.2rem',
                            display: 'flex',
                            gap: '1rem',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            {/* Abas Rápidas de Status */}
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => setPendenciaFiltroStatus('todos')}
                                    style={{
                                        padding: '0.4rem 0.9rem',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: pendenciaFiltroStatus === 'todos' ? '#3F51B5' : 'rgba(255,255,255,0.06)',
                                        color: pendenciaFiltroStatus === 'todos' ? '#fff' : '#aaa',
                                        cursor: 'pointer',
                                        fontSize: '0.82rem',
                                        fontWeight: pendenciaFiltroStatus === 'todos' ? 'bold' : 'normal'
                                    }}
                                >
                                    Todas ({filteredPendencias.length})
                                </button>
                                <button
                                    onClick={() => setPendenciaFiltroStatus('pendente')}
                                    style={{
                                        padding: '0.4rem 0.9rem',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: pendenciaFiltroStatus === 'pendente' ? '#FFB300' : 'rgba(255,255,255,0.06)',
                                        color: pendenciaFiltroStatus === 'pendente' ? '#000' : '#aaa',
                                        cursor: 'pointer',
                                        fontSize: '0.82rem',
                                        fontWeight: pendenciaFiltroStatus === 'pendente' ? 'bold' : 'normal'
                                    }}
                                >
                                    🟡 Aguardando ({pendentesList.length})
                                </button>
                                <button
                                    onClick={() => setPendenciaFiltroStatus('corrigido')}
                                    style={{
                                        padding: '0.4rem 0.9rem',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: pendenciaFiltroStatus === 'corrigido' ? '#4CAF50' : 'rgba(255,255,255,0.06)',
                                        color: pendenciaFiltroStatus === 'corrigido' ? '#fff' : '#aaa',
                                        cursor: 'pointer',
                                        fontSize: '0.82rem',
                                        fontWeight: pendenciaFiltroStatus === 'corrigido' ? 'bold' : 'normal'
                                    }}
                                >
                                    🟢 Corrigidas ({corrigidosList.length})
                                </button>
                            </div>

                            {/* Filtros de Mês, Ano e Responsável */}
                            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <div>
                                    <select
                                        value={pendenciaFiltroMes}
                                        onChange={(e) => setPendenciaFiltroMes(e.target.value)}
                                        className="select-input"
                                        style={{ fontSize: '0.82rem', padding: '0.35rem 0.6rem' }}
                                    >
                                        <option value="todos">Todos os Meses</option>
                                        {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][i]}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <select
                                        value={pendenciaFiltroAno}
                                        onChange={(e) => setPendenciaFiltroAno(e.target.value)}
                                        className="select-input"
                                        style={{ fontSize: '0.82rem', padding: '0.35rem 0.6rem' }}
                                    >
                                        <option value="todos">Todos os Anos</option>
                                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <select
                                        value={pendenciaFiltroResp}
                                        onChange={(e) => setPendenciaFiltroResp(e.target.value)}
                                        className="select-input"
                                        style={{ fontSize: '0.82rem', padding: '0.35rem 0.6rem' }}
                                    >
                                        <option value="todos">Todos Responsáveis</option>
                                        {displayUsers.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                                    </select>
                                </div>

                                {/* Campo de Busca */}
                                <div style={{ minWidth: '180px' }}>
                                    <input
                                        type="text"
                                        placeholder="🔍 Pesquisar documento..."
                                        value={pendenciaSearch}
                                        onChange={(e) => setPendenciaSearch(e.target.value)}
                                        style={{
                                            padding: '0.35rem 0.7rem',
                                            borderRadius: '6px',
                                            background: '#121216',
                                            border: '1px solid #444',
                                            color: '#fff',
                                            fontSize: '0.82rem',
                                            width: '100%'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* LISTAGEM DE PENDÊNCIAS */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            
                            {/* PENDENTES */}
                            {(pendenciaFiltroStatus === 'todos' || pendenciaFiltroStatus === 'pendente') && (
                                <div style={{ background: 'rgba(255, 193, 7, 0.04)', padding: '1.5rem', borderRadius: '10px', borderTop: '4px solid #FFC107' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                                        <h3 style={{ margin: 0, color: '#FFC107', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>🟡</span> Aguardando Correção ({pendentesList.length})
                                        </h3>
                                        <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Documentos retornados aguardando ajuste contábil</span>
                                    </div>

                                    {pendentesList.length === 0 ? (
                                        <p style={{ color: '#666', textAlign: 'center', padding: '1.5rem 0' }}>Nenhuma pendência aberta com os filtros selecionados.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                            {pendentesList.map(p => {
                                                const canEditDel = canEditOrDeletePendencia(p);
                                                const canResolve = canResolvePendencia(p);
                                                const dataFormatada = p.data_criacao ? new Date(p.data_criacao).toLocaleDateString('pt-BR') : '-';

                                                return (
                                                    <div 
                                                        key={p.id} 
                                                        style={{ 
                                                            background: 'rgba(0,0,0,0.4)', 
                                                            padding: '1rem 1.2rem', 
                                                            borderRadius: '8px', 
                                                            borderLeft: '4px solid #FFC107', 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            justifyContent: 'space-between', 
                                                            gap: '1rem',
                                                            flexWrap: 'wrap',
                                                            transition: 'background 0.2s'
                                                        }}
                                                    >
                                                        <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                                <strong style={{ color: '#fff', fontSize: '1rem' }}>📄 Doc: {p.documento}</strong>
                                                                {p.mes && (
                                                                    <span style={{ background: 'rgba(255,255,255,0.08)', color: '#bbb', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px' }}>
                                                                        Ref: {p.mes}/{p.ano}
                                                                    </span>
                                                                )}
                                                                <span style={{ color: '#aaa', fontSize: '0.8rem' }}>📅 {dataFormatada}</span>
                                                            </div>
                                                            <div style={{ color: '#FFE082', fontSize: '0.9rem', marginTop: '2px' }}>
                                                                <b>Motivo:</b> {p.motivo}
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: '#888', marginTop: '2px' }}>
                                                                <span>👤 Emitido por: <b style={{ color: '#ccc' }}>{p.criador || 'Sistema'}</b></span>
                                                                <span>🙋‍♂️ Responsável: <b style={{ color: '#64B5F6' }}>{p.responsavel}</b></span>
                                                            </div>
                                                        </div>

                                                        {/* Botões de Ação */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {canResolve && (
                                                                <button 
                                                                    onClick={() => setResolvingPendencia(p)} 
                                                                    className="btn-primary" 
                                                                    style={{ 
                                                                        padding: '0.4rem 0.9rem', 
                                                                        fontSize: '0.85rem', 
                                                                        background: '#4CAF50', 
                                                                        border: 'none', 
                                                                        color: '#fff',
                                                                        cursor: 'pointer',
                                                                        fontWeight: 'bold',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px'
                                                                    }}
                                                                >
                                                                    ✓ Corrigir
                                                                </button>
                                                            )}

                                                            {canEditDel && (
                                                                <>
                                                                    <button 
                                                                        onClick={() => setEditingPendencia(p)} 
                                                                        className="btn-secondary" 
                                                                        style={{ 
                                                                            padding: '0.4rem 0.8rem', 
                                                                            fontSize: '0.82rem', 
                                                                            borderColor: '#2196F3', 
                                                                            color: '#64B5F6',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                        title="Editar pendência"
                                                                    >
                                                                        ✏️ Alterar
                                                                    </button>

                                                                    <button 
                                                                        onClick={() => handleDeletePendencia(p)} 
                                                                        className="btn-secondary" 
                                                                        style={{ 
                                                                            padding: '0.4rem 0.8rem', 
                                                                            fontSize: '0.82rem', 
                                                                            borderColor: '#F44336', 
                                                                            color: '#FF8A80',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                        title="Excluir pendência"
                                                                    >
                                                                        🗑️ Excluir
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* HISTÓRICO DE CORRIGIDOS */}
                            {(pendenciaFiltroStatus === 'todos' || pendenciaFiltroStatus === 'corrigido') && (
                                <div style={{ background: 'rgba(76, 175, 80, 0.04)', padding: '1.5rem', borderRadius: '10px', borderTop: '4px solid #4CAF50' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                                        <h3 style={{ margin: 0, color: '#4CAF50', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>🟢</span> Corrigidos (Histórico de Resolução) ({corrigidosList.length})
                                        </h3>
                                        <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Documentos ajustados e integrados com sucesso</span>
                                    </div>

                                    {corrigidosList.length === 0 ? (
                                        <p style={{ color: '#666', textAlign: 'center', padding: '1.5rem 0' }}>Nenhum histórico corrigido no período filtrado.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                            {corrigidosList.map(p => {
                                                let hist = [];
                                                try { hist = JSON.parse(p.historico); } catch(err){}
                                                const resolvidoHist = hist.find(h => (h.action || '').startsWith('Resolvido'));
                                                const dataCriacao = p.data_criacao ? new Date(p.data_criacao).toLocaleDateString('pt-BR') : '-';
                                                const dataCorrecao = p.data_correcao ? new Date(p.data_correcao).toLocaleDateString('pt-BR') : '-';
                                                const canEditDel = canEditOrDeletePendencia(p);

                                                return (
                                                    <div 
                                                        key={p.id} 
                                                        style={{ 
                                                            background: 'rgba(0,0,0,0.3)', 
                                                            padding: '1rem 1.2rem', 
                                                            borderRadius: '8px', 
                                                            borderLeft: '4px solid #4CAF50', 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            justifyContent: 'space-between', 
                                                            gap: '1rem',
                                                            flexWrap: 'wrap'
                                                        }}
                                                    >
                                                        <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                                <strong style={{ color: '#ccc', textDecoration: 'line-through', fontSize: '0.95rem' }}>📄 Doc: {p.documento}</strong>
                                                                <span style={{ background: 'rgba(76, 175, 80, 0.15)', color: '#81C784', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                                                                    ✓ Corrigido em {dataCorrecao}
                                                                </span>
                                                            </div>
                                                            <div style={{ color: '#aaa', fontSize: '0.85rem' }}>
                                                                <b>Erro original:</b> {p.motivo}
                                                            </div>
                                                            <div style={{ color: '#81C784', fontSize: '0.88rem', fontStyle: 'italic', marginTop: '2px' }}>
                                                                "{resolvidoHist?.action || 'Ajustado'}" — por <b>{resolvidoHist?.user || p.responsavel}</b>
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: '#777', marginTop: '2px' }}>
                                                                Criado por {p.criador || 'Sistema'} em {dataCriacao}
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {canEditDel && (
                                                                <>
                                                                    <button 
                                                                        onClick={() => handleReopenPendencia(p)} 
                                                                        className="btn-secondary" 
                                                                        style={{ 
                                                                            padding: '0.35rem 0.7rem', 
                                                                            fontSize: '0.8rem', 
                                                                            borderColor: '#FFCA28', 
                                                                            color: '#FFCA28',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                        title="Reabrir pendência para nova correção"
                                                                    >
                                                                        🔄 Reabrir
                                                                    </button>

                                                                    <button 
                                                                        onClick={() => handleDeletePendencia(p)} 
                                                                        className="btn-secondary" 
                                                                        style={{ 
                                                                            padding: '0.35rem 0.7rem', 
                                                                            fontSize: '0.8rem', 
                                                                            borderColor: '#F44336', 
                                                                            color: '#FF8A80',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                        title="Excluir pendência"
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>

                        {/* MODAL DE EDIÇÃO DE PENDÊNCIA */}
                        {editingPendencia && (
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
                                    border: '1px solid #2196F3',
                                    borderRadius: '12px',
                                    width: '100%',
                                    maxWidth: '550px',
                                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        padding: '1.2rem 1.5rem',
                                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        background: 'rgba(33, 150, 243, 0.15)'
                                    }}>
                                        <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>✏️</span> Alterar Pendência
                                        </h3>
                                        <button
                                            onClick={() => setEditingPendencia(null)}
                                            style={{
                                                background: 'rgba(255,255,255,0.1)',
                                                border: 'none',
                                                color: '#fff',
                                                borderRadius: '50%',
                                                width: '28px',
                                                height: '28px',
                                                cursor: 'pointer',
                                                fontSize: '1rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <form onSubmit={handleSaveEditPendencia} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.4rem', color: '#ccc', fontSize: '0.85rem' }}>Nº Documento / Chave NF</label>
                                            <input 
                                                name="editDoc" 
                                                defaultValue={editingPendencia.documento} 
                                                type="text" 
                                                className="text-input" 
                                                style={{ width: '100%', background: '#121216', border: '1px solid #444' }} 
                                                required 
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.4rem', color: '#ccc', fontSize: '0.85rem' }}>Motivo do Retorno / Descrição do Erro</label>
                                            <textarea 
                                                name="editMotivo" 
                                                defaultValue={editingPendencia.motivo} 
                                                rows="3" 
                                                className="text-input" 
                                                style={{ width: '100%', background: '#121216', border: '1px solid #444', resize: 'vertical' }} 
                                                required 
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.4rem', color: '#ccc', fontSize: '0.85rem' }}>Responsável Designado</label>
                                            <select 
                                                name="editResp" 
                                                defaultValue={editingPendencia.responsavel} 
                                                className="select-input" 
                                                style={{ width: '100%', background: '#121216', border: '1px solid #444' }} 
                                                required
                                            >
                                                {displayUsers.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                                            </select>
                                        </div>

                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#ccc', fontSize: '0.85rem' }}>Mês de Referência</label>
                                                <select 
                                                    name="editMes" 
                                                    defaultValue={editingPendencia.mes || selectedMes} 
                                                    className="select-input" 
                                                    style={{ width: '100%', background: '#121216', border: '1px solid #444' }}
                                                >
                                                    {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][i]}</option>)}
                                                </select>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#ccc', fontSize: '0.85rem' }}>Ano</label>
                                                <select 
                                                    name="editAno" 
                                                    defaultValue={editingPendencia.ano || selectedAno} 
                                                    className="select-input" 
                                                    style={{ width: '100%', background: '#121216', border: '1px solid #444' }}
                                                >
                                                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                                            <button 
                                                type="button" 
                                                onClick={() => setEditingPendencia(null)} 
                                                className="btn-secondary"
                                            >
                                                Cancelar
                                            </button>
                                            <button 
                                                type="submit" 
                                                className="btn-primary" 
                                                style={{ background: '#2196F3', border: 'none', color: '#fff', fontWeight: 'bold' }}
                                            >
                                                Salvar Alterações
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                    </div>
                );
            })()}

            {activeTab === 'variacao' && (
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px', border: '1px solid #333' }}>
                    <h3 style={{ margin: '0 0 1rem 0', color: '#fff' }}>Lançamento de Variação Cambial Realizada</h3>
                    <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Os valores lançados aqui serão utilizados na DRE para cálculo de Lucro Presumido e Lucro Real.</p>
                    
                    <table style={{ width: '100%', borderCollapse: 'collapse', color: '#ddd' }}>
                        <thead>
                            <tr style={{ background: 'rgba(0,0,0,0.4)', color: '#ccc', textAlign: 'left' }}>
                                <th style={{ padding: '12px', borderBottom: '1px solid #444' }}>Empresa</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #444', width: '250px', textAlign: 'right' }}>Variação Cambial (DRE)</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #444', width: '300px' }}>Variação Cambial Realizada (Efetivo)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {companies.map(c => {
                                const key = `${c.id}_${selectedAno}_${selectedMes}`;
                                const val = taxDataStore[key]?.presumidoCambioRealizado || '';
                                const dreVal = dreCambioRealizado[c.id] || 0;
                                return (
                                    <tr key={c.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                                        <td style={{ padding: '12px' }}>{c.name}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', color: '#aaa' }}>{dreVal.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                                        <td style={{ padding: '12px' }}>
                                            <input 
                                                type="number" 
                                                className="text-input" 
                                                value={val} 
                                                onChange={(e) => saveVariacaoCambial(c.id, e.target.value)} 
                                                placeholder="0.00" 
                                                style={{ width: '100%' }} 
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {resolvingPendencia && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
                    <div style={{ background: '#1e1e1e', padding: '2rem', borderRadius: '8px', width: '90%', maxWidth: '400px', border: '1px solid #333' }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: '#4CAF50' }}>Marcar como Corrigido</h3>
                        <p style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '1rem' }}>
                            Doc: <strong>{resolvingPendencia.documento}</strong>
                        </p>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', color: '#888', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Ação corretiva / Objetivo alcançado:</label>
                            <textarea 
                                value={objectiveText} 
                                onChange={(e) => setObjectiveText(e.target.value)}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#2a2a2a', border: '1px solid #444', color: '#fff', minHeight: '80px', resize: 'vertical' }}
                                placeholder="Descreva o que foi feito para corrigir este problema..."
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={handleConfirmResolve} className="btn-primary" style={{ flex: 1 }}>Confirmar Correção</button>
                            <button onClick={() => { setResolvingPendencia(null); setObjectiveText(''); }} className="btn-secondary" style={{ padding: '0.5rem' }}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
            {showManageTipos && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
                    <div style={{ background: '#1e1e1e', padding: '2rem', borderRadius: '8px', width: '90%', maxWidth: '500px', border: '1px solid #333' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, color: 'var(--color-primary)' }}>Gerenciar Obrigações</h3>
                            <button onClick={() => setShowManageTipos(false)} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                            {obrigacoesTipos.map(t => (
                                <div key={t.tipo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '4px' }}>
                                    <div>
                                        <div style={{ color: '#fff' }}>{t.nome}</div>
                                        <div style={{ color: '#666', fontSize: '0.75rem' }}>{t.tipo}</div>
                                    </div>
                                    <button onClick={() => handleRemoveTipo(t.tipo)} style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer' }} title="Excluir">🗑️</button>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '6px' }}>
                            <h4 style={{ margin: 0, color: '#aaa' }}>Nova Obrigação</h4>
                            <input type="text" value={newObrigacaoNome} onChange={e => setNewObrigacaoNome(e.target.value)} placeholder="Nome da Obrigação (ex: EFD Contribuições)" className="text-input" />
                            <input type="text" value={newObrigacaoTipo} onChange={e => setNewObrigacaoTipo(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="Chave Interna (ex: efd_contribuicoes)" className="text-input" />
                            <button onClick={handleAddTipo} className="btn-primary">Adicionar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default GestaoContabilModule;
