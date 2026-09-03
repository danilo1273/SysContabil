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

    const handleAddPendencia = async (e) => {
        e.preventDefault();
        const doc = e.target.doc.value;
        const motivo = e.target.motivo.value;
        const resp = e.target.responsavel.value;
        if (!doc || !motivo || !resp) return;

        const payload = {
            id: 'pend-' + Date.now(),
            documento: doc,
            motivo,
            responsavel: resp,
            criador: userName || 'Sistema',
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

    const handleConfirmResolve = async () => {
        if (!resolvingPendencia) return;
        if (!objectiveText.trim()) {
            alert('Por favor, informe a ação corretiva realizada.');
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

            {activeTab === 'pendencias' && (
                <div>
                    <form onSubmit={handleAddPendencia} style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1', minWidth: '150px' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#aaa', fontSize: '0.85rem' }}>Nº Documento / Chave</label>
                            <input name="doc" type="text" className="text-input" style={{ width: '100%' }} placeholder="Ex: NF 12345" required />
                        </div>
                        <div style={{ flex: '2', minWidth: '250px' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#aaa', fontSize: '0.85rem' }}>Motivo do Retorno / Erro</label>
                            <input name="motivo" type="text" className="text-input" style={{ width: '100%' }} placeholder="Ex: CFOP incorreto, refazer lançamento" required />
                        </div>
                        <div style={{ flex: '1', minWidth: '150px' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#aaa', fontSize: '0.85rem' }}>Designar Correção Para:</label>
                            <select name="responsavel" className="select-input" style={{ width: '100%' }} required>
                                <option value="">Selecione...</option>
                                {displayUsers.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                            </select>
                        </div>
                        <button type="submit" className="btn-primary" style={{ height: '40px' }}>+ Abrir Pendência</button>
                    </form>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                
                        {/* PENDENTES */}
                        <div style={{ background: 'rgba(255, 193, 7, 0.05)', padding: '1.5rem', borderRadius: '8px', borderTop: '4px solid #FFC107' }}>
                            <h3 style={{ margin: '0 0 1.5rem 0', color: '#FFC107' }}>Aguardando Correção</h3>
                            {pendencias.filter(p => p.status === 'pendente').map(p => (
                                <div key={p.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '0.5rem', borderLeft: '3px solid #FFC107', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <strong style={{ color: '#fff', minWidth: '120px' }}>Doc: {p.documento}</strong>
                                        <p style={{ margin: 0, color: '#ccc', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }} title={p.motivo}>{p.motivo}</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#aaa' }}>{new Date(p.data_criacao).toLocaleDateString()}</span>
                                        <span style={{ fontSize: '0.8rem', color: '#888', background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', minWidth: '100px', textAlign: 'center' }}>🙋‍♂️ {p.responsavel}</span>
                                        {(p.responsavel === userName || (['danilo', 'ryan.santos'].includes(userName))) ? (
                                            <button onClick={() => setResolvingPendencia(p)} className="btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem', borderColor: '#4CAF50', color: '#4CAF50' }}>Corrigir</button>
                                        ) : <div style={{ width: '82px' }}></div>}
                                    </div>
                                </div>
                            ))}
                            {pendencias.filter(p => p.status === 'pendente').length === 0 && <p style={{ color: '#666', textAlign: 'center' }}>Nenhuma pendência aberta.</p>}
                        </div>

                        {/* RESOLVIDOS */}
                        <div style={{ background: 'rgba(76, 175, 80, 0.05)', padding: '1.5rem', borderRadius: '8px', borderTop: '4px solid #4CAF50' }}>
                            <h3 style={{ margin: '0 0 1.5rem 0', color: '#4CAF50' }}>Corrigidos (Histórico)</h3>
                            {pendencias.filter(p => p.status === 'corrigido').map(p => {
                                let hist = [];
                                try { hist = JSON.parse(p.historico); } catch(e){}
                                const resolvidoHist = hist.find(h => h.action.startsWith('Resolvido'));
                                return (
                                    <div key={p.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '0.5rem', borderLeft: '3px solid #4CAF50', opacity: '0.8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <strong style={{ color: '#ccc', textDecoration: 'line-through', minWidth: '120px' }}>Doc: {p.documento}</strong>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ color: '#888', fontSize: '0.8rem' }}>Erro: {p.motivo}</span>
                                                <i style={{ color: '#aaa', fontSize: '0.85rem' }}>"{resolvidoHist?.action || 'Resolvido'}" - {resolvidoHist?.user}</i>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#81C784', minWidth: '82px', textAlign: 'right' }}>✓ Corrigido</span>
                                        </div>
                                    </div>
                                );
                            })}
                            {pendencias.filter(p => p.status === 'corrigido').length === 0 && <p style={{ color: '#666', textAlign: 'center' }}>Nenhum histórico recente.</p>}
                        </div>
                    </div>
                </div>
            )}

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
