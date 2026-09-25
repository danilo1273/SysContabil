import React, { useState, useEffect } from 'react';
import RelatoriosContabeis from './RelatoriosContabeis';
import { getRawRecords, getSettings, saveSettings } from '../utils/db';
import { propagateRoutinesToNewMonth } from '../utils/routinePropagator';
import { 
  Building2, CheckCircle2, AlertCircle, Clock, Lock, Unlock, Mail, 
  Send, RefreshCw, PlusCircle, Trash2, Edit2, ShieldAlert, ArrowRight, 
  Check, FileText, Settings, User, AlertTriangle, Sparkles, Filter,
  ChevronRight, ExternalLink, Play, Layers, X, Info
} from 'lucide-react';

const DEFAULT_FILIAIS = [
  // Empresa 01 - AGF Equipamentos
  { code: '0101', name: '0101 - Matriz / Fábrica', empresaId: 'equipamentos' },
  { code: '0102', name: '0102 - Filial 02', empresaId: 'equipamentos' },
  { code: '0103', name: '0103 - Filial 03', empresaId: 'equipamentos' },
  { code: '0104', name: '0104 - Filial 04', empresaId: 'equipamentos' },
  { code: '0105', name: '0105 - Filial 05', empresaId: 'equipamentos' },
  { code: '0106', name: '0106 - Filial 06', empresaId: 'equipamentos' },
  // Empresa 02 - Casa da Escavadeira
  { code: '0201', name: '0201 - Matriz', empresaId: 'casa' },
  { code: '0202', name: '0202 - Filial 02', empresaId: 'casa' },
  { code: '0203', name: '0203 - Filial 03', empresaId: 'casa' },
  // Empresa 03 - AGF Participações
  { code: '0301', name: '0301 - Matriz', empresaId: 'agf_participa_es' },
  // Empresa 04 - AGF Rompedores
  { code: '0401', name: '0401 - Matriz', empresaId: 'rompedores' },
  { code: '0402', name: '0402 - Filial 02', empresaId: 'rompedores' },
  { code: '0403', name: '0403 - Filial 03', empresaId: 'rompedores' },
];

const EMPRESAS_CONFIG = [
  { id: 'equipamentos', name: '01 - AGF Equipamentos', prefix: '01', color: '#FF9800' },
  { id: 'casa', name: '02 - Casa da Escavadeira', prefix: '02', color: '#2196F3' },
  { id: 'agf_participa_es', name: '03 - AGF Participações', prefix: '03', color: '#9C27B0' },
  { id: 'rompedores', name: '04 - AGF Rompedores', prefix: '04', color: '#E91E63' }
];

function GestaoContabilModule({ userRole, userName, companies }) {
    const isSuperAdmin = userRole === 'superadmin' || ['danilo', 'ryan.santos', 'carol.cons', 'talita.alves'].includes(userName);
    const [activeTab, setActiveTab] = useState('integracoes');
    const [taxDataStore, setTaxDataStore] = useState({});
    const [dreCambioRealizado, setDreCambioRealizado] = useState({});
    const [selectedMes, setSelectedMes] = useState(new Date().getMonth() + 1);
    const [selectedAno, setSelectedAno] = useState(new Date().getFullYear());
    
    const [integracoes, setIntegracoes] = useState({});
    const [obrigacoes, setObrigacoes] = useState({});
    const [pendencias, setPendencias] = useState([]);
    const [users, setUsers] = useState([]);

    // Fluxo de Trabalho & Rotinas Contábeis por Filial
    const [rotinas, setRotinas] = useState([]);
    const [filiaisList, setFiliaisList] = useState(DEFAULT_FILIAIS);
    const [rotinaEmpresaFilter, setRotinaEmpresaFilter] = useState('todas');
    const [rotinaFilialFilter, setRotinaFilialFilter] = useState('todas');
    const [rotinaViewMode, setRotinaViewMode] = useState('pipeline'); // 'pipeline' | 'table'
    const [showNewRotinaModal, setShowNewRotinaModal] = useState(false);
    const [showSmtpModal, setShowSmtpModal] = useState(false);
    const [smtpConfig, setSmtpConfig] = useState({ host: '', port: 587, user: '', pass: '', from: '', secure: false, resendApiKey: '', provider: 'resend' });
    const [isTestingSmtp, setIsTestingSmtp] = useState(false);
    const [editingRotina, setEditingRotina] = useState(null);
    const [newRotinaForm, setNewRotinaForm] = useState({
        titulo: '',
        abrangencia: 'consolidado', // 'filial' | 'consolidado'
        empresaId: 'equipamentos',
        filialCode: '0101',
        categoria: 'fiscal',
        tipo: 'declaracao_consolidada',
        responsavel: '',
        responsavelEmail: '',
        data_limite: '',
        dependencias: [],
        propagarFuturos: true
    });
    const [emailModalData, setEmailModalData] = useState(null);
    const [isSendingEmail, setIsSendingEmail] = useState(false);

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

            // Load Filiais Cadastro
            try {
                const storedFiliais = await getSettings('agf_estoque_filiais_cadastro');
                if (Array.isArray(storedFiliais) && storedFiliais.length > 0) {
                    setFiliaisList(storedFiliais);
                } else {
                    setFiliaisList(DEFAULT_FILIAIS);
                }
            } catch (err) {
                setFiliaisList(DEFAULT_FILIAIS);
            }

            // Load SMTP Config
            try {
                const storedSmtp = await getSettings('agf_smtp_config');
                if (storedSmtp) setSmtpConfig(storedSmtp);
            } catch(e) {}

            // Load Rotinas Contábeis por Filial
            try {
                const rotRes = await fetch(`/api/gestao/rotinas?ano=${selectedAno}&mes=${selectedMes}`);
                if (rotRes.ok) {
                    const rotData = await rotRes.json();
                    setRotinas(Array.isArray(rotData) ? rotData : []);
                }
            } catch (err) {
                console.error("Erro ao carregar rotinas:", err);
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

    // --- GESTÃO DE ROTINAS & FLUXO DE TRABALHO CONTÁBIL POR FILIAL ---

    // Avalia dependências de todas as rotinas e dispara e-mail quando liberadas
    const evaluateDependenciesAndSave = async (updatedList) => {
        const newlyLiberated = [];
        const finalUpdatedList = updatedList.map(item => {
            const hasDeps = item.dependencias && item.dependencias.length > 0;
            if (!hasDeps) {
                if (item.status === 'bloqueada') {
                    return { ...item, status: 'liberada', updated_at: new Date().toISOString() };
                }
                return item;
            }

            // Verificar se todas as tarefas das quais ela depende foram concluídas
            const allDepsCompleted = item.dependencias.every(depId => {
                const dep = updatedList.find(r => r.id === depId);
                return dep && (dep.status === 'concluido' || dep.status === 'concluida' || (dep.dia_atual !== undefined && dep.dia_atual >= 31));
            });

            if (allDepsCompleted) {
                if (item.status === 'bloqueada') {
                    const libItem = { ...item, status: 'liberada', updated_at: new Date().toISOString() };
                    if (!libItem.email_notificado) {
                        newlyLiberated.push(libItem);
                        libItem.email_notificado = true;
                    }
                    return libItem;
                }
            } else {
                if (item.status === 'liberada') {
                    return { ...item, status: 'bloqueada', updated_at: new Date().toISOString() };
                }
            }
            return item;
        });

        setRotinas(finalUpdatedList);

        try {
            await fetch('/api/gestao/rotinas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalUpdatedList)
            });
        } catch (e) {
            console.error('Erro ao salvar rotinas avaliadas:', e);
        }

        // Disparar notificações por e-mail para as tarefas recém liberadas
        for (const r of newlyLiberated) {
            await dispatchLiberationEmail(r, finalUpdatedList);
        }
    };

    // Registrar envio de e-mail / cobrança no histórico da rotina
    const handleRecordEmailSent = async (rotinaId, tipoEnvio = 'manual') => {
        if (!rotinaId) return;
        const nowIso = new Date().toISOString();
        let targetRotina = null;

        setRotinas(prev => {
            return prev.map(r => {
                if (r.id === rotinaId) {
                    targetRotina = {
                        ...r,
                        ultimo_email_enviado_em: nowIso,
                        total_emails_enviados: (r.total_emails_enviados || 0) + 1,
                        email_enviado_por: userName || 'Gestor',
                        email_notificado: true,
                        tipo_ultimo_email: tipoEnvio,
                        updated_at: nowIso
                    };
                    return targetRotina;
                }
                return r;
            });
        });

        try {
            const currentRot = rotinas.find(r => r.id === rotinaId);
            const payload = targetRotina || (currentRot ? {
                ...currentRot,
                ultimo_email_enviado_em: nowIso,
                total_emails_enviados: (currentRot.total_emails_enviados || 0) + 1,
                email_enviado_por: userName || 'Gestor',
                email_notificado: true,
                tipo_ultimo_email: tipoEnvio,
                updated_at: nowIso
            } : null);

            if (payload) {
                await fetch('/api/gestao/rotinas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify([payload])
                });
            }
        } catch (e) {
            console.error('Erro ao registrar histórico de envio de e-mail:', e);
        }
    };

    // Alterar Prazo / Data Limite de uma Rotina ou Integração
    const handleUpdateRoutinePrazo = async (rotinaId, newPrazo) => {
        let targetItem = null;
        setRotinas(prev => {
            return prev.map(r => {
                if (r.id === rotinaId) {
                    targetItem = { ...r, data_limite: newPrazo, updated_at: new Date().toISOString() };
                    return targetItem;
                }
                return r;
            });
        });

        if (targetItem) {
            await fetch('/api/gestao/rotinas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([targetItem])
            });
            window.$toast('Prazo atualizado com sucesso!', { type: 'success' });
        }
    };

    // Abrir Modal de Cobrança para Integração (Entradas, Saídas, Financeiro)
    const handleOpenCobrancaIntegracao = (rot, filial, tipoNome) => {
        if (!isSuperAdmin) {
            if (window.$toast) window.$toast('Apenas Superadmin tem permissão para realizar cobranças.', { type: 'error' });
            else window.$alert('Apenas Superadmin tem permissão para realizar cobranças.');
            return;
        }
        const respUser = users.find(u => u.username === rot.responsavel);
        const to = rot.responsavelEmail || respUser?.email || (rot.responsavel ? `${rot.responsavel}@agfequipamentos.com.br` : '');
        const subject = `[Cobrança] Integração de ${tipoNome} - Filial ${filial.code} (${selectedMes}/${selectedAno})`;
        
        const prazoFormatado = rot.data_limite 
            ? new Date(rot.data_limite + 'T12:00:00').toLocaleDateString('pt-BR') 
            : 'não estipulado';

        const body = `Olá ${rot.responsavel || 'Equipe'},\n\nVerificamos no SysContábil que a integração de ${tipoNome} da Filial ${filial.code} (${filial.name}) está atualmente no dia ${rot.dia_atual || 0}/31.\n\nLembramos que o nosso prazo para conclusão é: ${prazoFormatado}.\n\nPor favor, favor atualizar as movimentações e o andamento no sistema assim que possível.\n\nCompetência: ${selectedMes}/${selectedAno}\n\nAtenciosamente,\nGestão Contábil - SysContábil AGF`;

        setEmailModalData({ rotina: rot, to, subject, body, isCobranca: true, tipoNome });
    };

    // Verificar se prazo de uma rotina ou integração está vencido
    const isPrazoVencido = (dataLimite, diaAtual) => {
        if (!dataLimite || (diaAtual !== undefined && diaAtual >= 31)) return false;
        try {
            const limit = new Date(dataLimite + 'T23:59:59');
            return new Date() > limit;
        } catch(e) {
            return false;
        }
    };

    // Renderizar etiqueta de status de cobrança/notificação
    const renderCobrancaBadge = (r) => {
        if (!r) return null;
        if (r.ultimo_email_enviado_em) {
            const dt = new Date(r.ultimo_email_enviado_em);
            const dateStr = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const count = r.total_emails_enviados || 1;
            return (
                <span
                    style={{
                        background: 'rgba(33, 150, 243, 0.15)',
                        color: '#64B5F6',
                        border: '1px solid rgba(33, 150, 243, 0.35)',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontSize: '0.67rem',
                        fontWeight: '500',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                    }}
                    title={`Última cobrança/notificação enviada em ${dateStr} às ${timeStr} por ${r.email_enviado_por || 'Gestor'} (Total: ${count}x)`}
                >
                    <Mail size={10} /> Cobrado {dateStr} {timeStr} ({count}x)
                </span>
            );
        }
        return (
            <span
                style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: '#888',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    fontSize: '0.67rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px'
                }}
                title="Nenhum e-mail de cobrança registrado para esta tarefa ainda"
            >
                <Mail size={10} /> Não cobrado
            </span>
        );
    };

    // Disparo de e-mail ao liberar uma rotina
    const dispatchLiberationEmail = async (rotinaLiberada, allRoutines) => {
        const respUser = users.find(u => u.username === rotinaLiberada.responsavel);
        const targetEmail = rotinaLiberada.responsavelEmail || respUser?.email || (rotinaLiberada.responsavel ? `${rotinaLiberada.responsavel}@agfequipamentos.com.br` : '');
        
        const depNames = (rotinaLiberada.dependencias || []).map(depId => {
            const depRot = allRoutines.find(r => r.id === depId);
            return depRot ? depRot.titulo : depId;
        }).join(', ');

        const localNome = rotinaLiberada.abrangencia === 'consolidado' || rotinaLiberada.filialCode === 'consolidado'
            ? (rotinaLiberada.filialNome || 'Consolidado da Empresa')
            : (rotinaLiberada.filialNome || `Filial ${rotinaLiberada.filialCode || ''}`);

        const subject = `[SysContábil] Rotina Liberada: ${rotinaLiberada.titulo} (${localNome} - ${selectedMes}/${selectedAno})`;
        const textMsg = `Olá ${rotinaLiberada.responsavel || 'Equipe'},\n\nAs integrações pré-requisito de ${localNome} foram realizadas com sucesso (${depNames}).\n\nVocê já pode seguir com a apuração da rotina: ${rotinaLiberada.titulo}!\n\nCompetência: ${selectedMes}/${selectedAno}\nSistema SysContábil AGF`;

        const htmlMsg = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background: #1a1f2c; padding: 20px; text-align: center; color: #ffffff;">
              <h2 style="margin: 0; color: #FF9800; font-size: 20px;">SysContábil AGF</h2>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #aaaaaa;">Gestão Contábil & Fluxo de Trabalho de Filiais</p>
            </div>
            <div style="padding: 24px; color: #333333; line-height: 1.6;">
              <div style="background: rgba(76, 175, 80, 0.1); border: 1px solid rgba(76, 175, 80, 0.3); border-radius: 6px; padding: 12px; margin-bottom: 16px; color: #2e7d32; font-weight: bold; display: flex; align-items: center; gap: 8px;">
                🟢 Rotina Liberada para Execução!
              </div>
              <p style="margin: 0 0 12px 0;">Olá <strong>${rotinaLiberada.responsavel || 'Responsável'}</strong>,</p>
              <p style="margin: 0 0 16px 0;">As integrações pré-requisito foram <strong>concluídas com sucesso</strong>. Você já pode seguir com a apuração:</p>
              
              <div style="background: #f9f9f9; border-left: 4px solid #FF9800; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
                <div style="font-size: 16px; font-weight: bold; color: #111;">${rotinaLiberada.titulo}</div>
                <div style="font-size: 13px; color: #666; margin-top: 4px;">
                  🏢 Filial: <strong>${rotinaLiberada.filialNome || rotinaLiberada.filialCode}</strong> | Competência: <strong>${selectedMes}/${selectedAno}</strong>
                </div>
              </div>

              <div style="background: #f5f5f5; padding: 10px 14px; border-radius: 4px; font-size: 13px; color: #555; margin-bottom: 20px;">
                <strong>Integrações Realizadas:</strong> ${depNames}
              </div>
              
              <p style="margin: 0; font-size: 14px;">Acesse o sistema SysContábil para dar andamento.</p>
            </div>
            <div style="background: #f1f1f1; padding: 12px 20px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #eeeeee;">
              Notificação automática gerada pelo módulo de Gestão Contábil
            </div>
          </div>
        `;

        try {
            await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: targetEmail || 'contabil@agfequipamentos.com.br',
                    subject,
                    text: textMsg,
                    html: htmlMsg
                })
            });

            await handleRecordEmailSent(rotinaLiberada.id, 'automatico');
            window.$toast(`🔔 ${rotinaLiberada.titulo} liberada! Notificação enviada${targetEmail ? ` para ${targetEmail}` : ''}.`, { type: 'success' });
        } catch (err) {
            console.error('Erro ao enviar e-mail de liberação:', err);
        }
    };

    // Gerador de Rotinas Padrão do Mês por Filial (Entradas, Saídas, Financeiro -> Apuração Fiscal)
    const handleGenerateDefaultRoutines = async () => {
        const empToGen = rotinaEmpresaFilter === 'todas' ? EMPRESAS_CONFIG.map(e => e.id) : [rotinaEmpresaFilter];
        const targetFiliais = filiaisList.filter(f => empToGen.includes(f.empresaId));

        if (targetFiliais.length === 0) {
            window.$alert('Nenhuma filial encontrada para a empresa selecionada.');
            return;
        }

        const ok = await window.$confirm(`Deseja gerar/sincronizar as rotinas padrão (Entradas, Saídas, Financeiro e Apuração Fiscal) para ${targetFiliais.length} filial(is) da competência ${selectedMes}/${selectedAno}?`);
        if (!ok) return;

        const updated = [...rotinas];
        let createdCount = 0;

        for (const f of targetFiliais) {
            const idEnt = `rot-${selectedAno}-${selectedMes}-${f.code}-entradas`;
            const idSai = `rot-${selectedAno}-${selectedMes}-${f.code}-saidas`;
            const idFin = `rot-${selectedAno}-${selectedMes}-${f.code}-financeiro`;
            const idApur = `rot-${selectedAno}-${selectedMes}-${f.code}-apuracao_fiscal`;

            // 1. Entradas
            let ent = updated.find(r => r.id === idEnt);
            if (!ent) {
                ent = {
                    id: idEnt,
                    ano: selectedAno,
                    mes: selectedMes,
                    empresaId: f.empresaId,
                    filialCode: f.code,
                    filialNome: f.name,
                    titulo: `Integração de Entradas - Filial ${f.code}`,
                    categoria: 'integracao',
                    tipo: 'entradas',
                    dia_atual: 0,
                    status: 'em_andamento',
                    responsavel: '',
                    responsavelEmail: '',
                    dependencias: [],
                    data_limite: '',
                    concluido_em: null,
                    concluido_por: null,
                    email_notificado: false
                };
                updated.push(ent);
                createdCount++;
            }

            // 2. Saídas
            let sai = updated.find(r => r.id === idSai);
            if (!sai) {
                sai = {
                    id: idSai,
                    ano: selectedAno,
                    mes: selectedMes,
                    empresaId: f.empresaId,
                    filialCode: f.code,
                    filialNome: f.name,
                    titulo: `Integração de Saídas - Filial ${f.code}`,
                    categoria: 'integracao',
                    tipo: 'saidas',
                    dia_atual: 0,
                    status: 'em_andamento',
                    responsavel: '',
                    responsavelEmail: '',
                    dependencias: [],
                    data_limite: '',
                    concluido_em: null,
                    concluido_por: null,
                    email_notificado: false
                };
                updated.push(sai);
                createdCount++;
            }

            // 3. Financeiro
            let fin = updated.find(r => r.id === idFin);
            if (!fin) {
                fin = {
                    id: idFin,
                    ano: selectedAno,
                    mes: selectedMes,
                    empresaId: f.empresaId,
                    filialCode: f.code,
                    filialNome: f.name,
                    titulo: `Integração Financeiro - Filial ${f.code}`,
                    categoria: 'integracao',
                    tipo: 'financeiro',
                    dia_atual: 0,
                    status: 'em_andamento',
                    responsavel: '',
                    responsavelEmail: '',
                    dependencias: [],
                    data_limite: '',
                    concluido_em: null,
                    concluido_por: null,
                    email_notificado: false
                };
                updated.push(fin);
                createdCount++;
            }

            // 4. Apuração Fiscal (com dependências das 3 integrações)
            let apur = updated.find(r => r.id === idApur);
            if (!apur) {
                apur = {
                    id: idApur,
                    ano: selectedAno,
                    mes: selectedMes,
                    empresaId: f.empresaId,
                    filialCode: f.code,
                    filialNome: f.name,
                    titulo: `Apuração Fiscal - Filial ${f.code}`,
                    categoria: 'fiscal',
                    tipo: 'apuracao_fiscal',
                    dia_atual: 0,
                    status: 'bloqueada',
                    responsavel: '',
                    responsavelEmail: '',
                    dependencias: [idEnt, idSai, idFin],
                    data_limite: '',
                    concluido_em: null,
                    concluido_por: null,
                    email_notificado: false
                };
                updated.push(apur);
                createdCount++;
            }
        }

        await evaluateDependenciesAndSave(updated);
        window.$toast(`Sucesso! ${createdCount} novas rotinas geradas para o mês ${selectedMes}/${selectedAno}.`, { type: 'success' });
    };

    // Sincronizar / Copiar Rotinas e Declarações do Mês Anterior para a Competência Atual
    const handleSyncPreviousMonthRoutines = async () => {
        let prevAno = selectedAno;
        let prevMes = selectedMes - 1;
        if (prevMes < 1) {
            prevMes = 12;
            prevAno = selectedAno - 1;
        }

        setIsProcessing(true);
        try {
            const rotRes = await fetch(`/api/gestao/rotinas?ano=${prevAno}&mes=${prevMes}`);
            if (!rotRes.ok) {
                window.$toast('Não foi possível buscar as rotinas do mês anterior.', { type: 'error' });
                return;
            }
            const prevRoutines = await rotRes.json();
            if (!Array.isArray(prevRoutines) || prevRoutines.length === 0) {
                window.$toast(`Nenhuma rotina encontrada na competência anterior (${prevMes}/${prevAno}).`, { type: 'warning' });
                return;
            }

            const ok = await window.$confirm(`Deseja sincronizar as rotinas e declarações de ${prevMes}/${prevAno} (${prevRoutines.length} rotinas) para a competência atual ${selectedMes}/${selectedAno}?`);
            if (!ok) return;

            const propagated = propagateRoutinesToNewMonth(prevRoutines, selectedAno, selectedMes);

            // Mesclar preservando o progresso de tarefas que já foram iniciadas no mês atual
            const currentRots = [...rotinas];
            let addedCount = 0;
            let updatedCount = 0;

            propagated.forEach(newR => {
                const existingIdx = currentRots.findIndex(r => 
                    r.id === newR.id || 
                    (r.titulo === newR.titulo && r.filialCode === newR.filialCode && r.tipo === newR.tipo)
                );

                if (existingIdx >= 0) {
                    const cur = currentRots[existingIdx];
                    if (!cur.responsavel && newR.responsavel) {
                        currentRots[existingIdx] = { ...cur, responsavel: newR.responsavel, responsavelEmail: newR.responsavelEmail };
                        updatedCount++;
                    }
                } else {
                    currentRots.push(newR);
                    addedCount++;
                }
            });

            await evaluateDependenciesAndSave(currentRots);
            window.$toast(`Sincronização concluída! ${addedCount} rotinas adicionadas e ${updatedCount} atualizadas a partir de ${prevMes}/${prevAno}.`, { type: 'success' });
        } catch (err) {
            console.error('Erro ao sincronizar rotinas do mês anterior:', err);
            window.$toast('Erro ao sincronizar rotinas do mês anterior.', { type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    // Criar Nova Rotina / Declaração (Por Filial ou Consolidada da Empresa)
    const handleSaveNewCustomRotina = async (e) => {
        e.preventDefault();
        if (!newRotinaForm.titulo.trim()) {
            window.$alert('Por favor, informe o título da rotina ou declaração.');
            return;
        }

        const isConsolidado = newRotinaForm.abrangencia === 'consolidado';
        const targetEmpresaConfig = EMPRESAS_CONFIG.find(e => e.id === newRotinaForm.empresaId);
        const selectedFilialObj = isConsolidado
            ? { code: 'consolidado', name: `Consolidado (${targetEmpresaConfig?.name || 'Empresa'})` }
            : (filiaisList.find(f => f.code === newRotinaForm.filialCode) || { code: newRotinaForm.filialCode, name: `Filial ${newRotinaForm.filialCode}` });
        
        const newId = `rot-${selectedAno}-${selectedMes}-${selectedFilialObj.code}-${Date.now().toString(36)}`;
        
        const newRoutine = {
            id: newId,
            ano: selectedAno,
            mes: selectedMes,
            empresaId: newRotinaForm.empresaId,
            filialCode: selectedFilialObj.code,
            filialNome: selectedFilialObj.name,
            titulo: newRotinaForm.titulo.trim(),
            categoria: newRotinaForm.categoria,
            tipo: isConsolidado ? 'declaracao_consolidada' : (newRotinaForm.tipo || 'personalizado'),
            abrangencia: isConsolidado ? 'consolidado' : 'filial',
            dia_atual: 0,
            status: (newRotinaForm.dependencias && newRotinaForm.dependencias.length > 0) ? 'bloqueada' : 'em_andamento',
            responsavel: newRotinaForm.responsavel,
            responsavelEmail: newRotinaForm.responsavelEmail,
            dependencias: newRotinaForm.dependencias || [],
            data_limite: newRotinaForm.data_limite || '',
            concluido_em: null,
            concluido_por: null,
            email_notificado: false,
            propagarFuturos: newRotinaForm.propagarFuturos !== false,
            updated_at: new Date().toISOString()
        };

        const updated = [...rotinas, newRoutine];
        await evaluateDependenciesAndSave(updated);
        setShowNewRotinaModal(false);
        setNewRotinaForm({
            titulo: '',
            abrangencia: 'consolidado',
            empresaId: 'equipamentos',
            filialCode: '0101',
            categoria: 'fiscal',
            tipo: 'declaracao_consolidada',
            responsavel: '',
            responsavelEmail: '',
            data_limite: '',
            dependencias: [],
            propagarFuturos: true
        });
        window.$toast(`${isConsolidado ? 'Declaração Consolidada' : 'Rotina'} "${newRoutine.titulo}" cadastrada com sucesso!`, { type: 'success' });
    };

    // Atualizar Dia da Integração (0 a 31)
    const handleUpdateRoutineProgress = async (rotinaId, newDiaAtual, responsavel) => {
        const dia = Math.min(Math.max(parseInt(newDiaAtual) || 0, 0), 31);
        const isCompleted = dia >= 31;
        
        const updated = rotinas.map(r => {
            if (r.id === rotinaId) {
                return {
                    ...r,
                    dia_atual: dia,
                    responsavel: responsavel !== undefined ? responsavel : r.responsavel,
                    status: isCompleted ? 'concluida' : 'em_andamento',
                    concluido_em: isCompleted ? (r.concluido_em || new Date().toISOString()) : null,
                    concluido_por: isCompleted ? (r.concluido_por || userName || 'Sistema') : null,
                    updated_at: new Date().toISOString()
                };
            }
            return r;
        });

        await evaluateDependenciesAndSave(updated);
    };

    // Alternar Status da Rotina (Concluir / Reabrir)
    const handleToggleRotinaStatus = async (rotina) => {
        const isDone = rotina.status === 'concluida' || rotina.status === 'concluido';
        const updated = rotinas.map(r => {
            if (r.id === rotina.id) {
                if (isDone) {
                    // Reabrir
                    return {
                        ...r,
                        status: (r.dependencias && r.dependencias.length > 0) ? 'liberada' : 'em_andamento',
                        dia_atual: (r.categoria === 'integracao') ? 30 : 0,
                        concluido_em: null,
                        concluido_por: null,
                        updated_at: new Date().toISOString()
                    };
                } else {
                    // Concluir
                    return {
                        ...r,
                        status: 'concluida',
                        dia_atual: 31,
                        concluido_em: new Date().toISOString(),
                        concluido_por: userName || 'Sistema',
                        updated_at: new Date().toISOString()
                    };
                }
            }
            return r;
        });

        await evaluateDependenciesAndSave(updated);
        window.$toast(isDone ? `Rotina reaberta!` : `Rotina "${rotina.titulo}" concluída com sucesso!`, { type: 'success' });
    };

    // Alterar Responsável de uma Rotina
    const handleUpdateRotinaResponsavel = async (rotinaId, newResp) => {
        if (!isSuperAdmin) {
            if (window.$toast) window.$toast('Apenas Superadmin tem permissão para alterar o responsável.', { type: 'error' });
            else window.$alert('Apenas Superadmin tem permissão para alterar o responsável.');
            return;
        }
        const respUser = users.find(u => u.username === newResp);
        const email = respUser?.email || (newResp ? `${newResp}@agfequipamentos.com.br` : '');
        
        const updated = rotinas.map(r => {
            if (r.id === rotinaId) {
                return { ...r, responsavel: newResp, responsavelEmail: email, updated_at: new Date().toISOString() };
            }
            return r;
        });

        setRotinas(updated);
        await fetch('/api/gestao/rotinas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated.filter(r => r.id === rotinaId))
        });
    };

    // Excluir Rotina
    const handleDeleteRotina = async (rotina) => {
        const ok = await window.$confirm(`Tem certeza que deseja excluir a rotina "${rotina.titulo}"?`, { type: 'danger' });
        if (!ok) return;

        await fetch(`/api/gestao/rotinas/${rotina.id}?ano=${selectedAno}&mes=${selectedMes}`, { method: 'DELETE' });
        const remaining = rotinas.filter(r => r.id !== rotina.id);
        await evaluateDependenciesAndSave(remaining);
        window.$toast('Rotina excluída com sucesso!');
    };

    // Salvar Configurações SMTP
    const handleSaveSmtpConfig = async (e) => {
        e.preventDefault();
        await saveSettings('agf_smtp_config', smtpConfig);
        await fetch('/api/settings/agf_smtp_config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: smtpConfig })
        });
        setShowSmtpModal(false);
        window.$toast('Configurações de SMTP salvas com sucesso!', { type: 'success' });
    };

    // Testar Envio de E-mail SMTP
    const handleTestSmtp = async () => {
        if (!smtpConfig.user) {
            window.$alert('Preencha ao menos o usuário/e-mail remetente.');
            return;
        }
        setIsTestingSmtp(true);
        try {
            const res = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: smtpConfig.user,
                    subject: `[SysContábil] Teste de Conexão SMTP - ${new Date().toLocaleTimeString()}`,
                    text: 'Parabéns! Se você recebeu este e-mail, as notificações do SysContábil estão configuradas corretamente.',
                    html: '<p style="color: green; font-weight: bold;">Teste de conexão SMTP realizado com sucesso pelo SysContábil AGF!</p>'
                })
            });
            let data = {};
            try {
                data = await res.json();
            } catch (err) {
                data = { success: false, error: 'O servidor retornou uma resposta não-JSON. Verifique se o backend está ativo.' };
            }
            if (data.success) {
                window.$alert(`✅ Teste concluído com sucesso! (Modo: ${data.mode || 'smtp'})\n${data.message || ''}`);
            } else {
                window.$alert(`❌ Erro no teste: ${data.error || data.warning || 'Falha ao conectar'}`);
            }
        } catch (err) {
            window.$alert(`Erro ao testar envio: ${err.message}`);
        } finally {
            setIsTestingSmtp(false);
        }
    };

    // Abrir Modal de Envio Manual de E-mail
    const handleOpenManualEmail = (rotina) => {
        if (!isSuperAdmin) {
            if (window.$toast) window.$toast('Apenas Superadmin tem permissão para notificar / cobrar por e-mail.', { type: 'error' });
            else window.$alert('Apenas Superadmin tem permissão para notificar / cobrar por e-mail.');
            return;
        }
        const respUser = users.find(u => u.username === rotina.responsavel);
        const to = rotina.responsavelEmail || respUser?.email || (rotina.responsavel ? `${rotina.responsavel}@agfequipamentos.com.br` : '');
        
        const localNome = rotina.abrangencia === 'consolidado' || rotina.filialCode === 'consolidado'
            ? (rotina.filialNome || 'Consolidado da Empresa')
            : (rotina.filialNome || `Filial ${rotina.filialCode || ''}`);

        const rotinaNome = rotina.titulo || 'Apuração Fiscal';
        const prazoStr = rotina.data_limite ? `\nPrazo de Entrega: ${new Date(rotina.data_limite + 'T12:00:00').toLocaleDateString('pt-BR')}` : '';

        const subject = `[SysContábil] Integrações realizadas - Liberado para ${rotinaNome} (${localNome})`;
        const body = `Olá ${rotina.responsavel || 'Equipe'},\n\nAs integrações contábeis (Entrada, Saída e Financeiro) de "${localNome}" foram 100% concluídas!\n\nVocê já pode seguir com a apuração da rotina: ${rotinaNome}.\n\nCompetência: ${selectedMes}/${selectedAno}${prazoStr}\n\nAtenciosamente,\nSysContábil AGF`;
        
        setEmailModalData({ rotina, to, subject, body });
    };

    // Enviar E-mail Manualmente
    const handleSendManualEmail = async () => {
        if (!isSuperAdmin) {
            window.$alert('Apenas Superadmin tem permissão para notificar / cobrar por e-mail.');
            return;
        }
        if (!emailModalData || !emailModalData.to) {
            window.$alert('Informe o e-mail do destinatário.');
            return;
        }
        setIsSendingEmail(true);
        try {
            const res = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: emailModalData.to,
                    subject: emailModalData.subject,
                    text: emailModalData.body,
                    html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;"><h3 style="color: #FF9800;">SysContábil AGF</h3><p style="white-space: pre-line;">${emailModalData.body}</p></div>`
                })
            });
            let data = {};
            try {
                data = await res.json();
            } catch (err) {
                data = { success: true, mode: 'fallback' };
            }
            if (data.success) {
                if (emailModalData.rotina?.id) {
                    await handleRecordEmailSent(emailModalData.rotina.id, 'nuvem');
                }
                window.$toast(`E-mail enviado com sucesso para ${emailModalData.to}! Histórico de cobrança atualizado.`, { type: 'success' });
                setEmailModalData(null);
            } else {
                const errMsg = data.error || data.warning || 'Falha ao enviar';
                const mailtoUrl = `mailto:${emailModalData.to}?subject=${encodeURIComponent(emailModalData.subject)}&body=${encodeURIComponent(emailModalData.body)}`;
                const wantOutlook = window.confirm(`Não foi possível enviar automaticamente pela nuvem:\n\n${errMsg}\n\nDeseja abrir o e-mail preenchido no seu Outlook / Webmail agora para enviar em 1 clique?`);
                if (wantOutlook) {
                    if (emailModalData.rotina?.id) {
                        await handleRecordEmailSent(emailModalData.rotina.id, 'outlook');
                    }
                    window.open(mailtoUrl, '_blank');
                    setEmailModalData(null);
                }
            }
        } catch (e) {
            const mailtoUrl = `mailto:${emailModalData.to}?subject=${encodeURIComponent(emailModalData.subject)}&body=${encodeURIComponent(emailModalData.body)}`;
            const wantOutlook = window.confirm(`Erro ao conectar com o serviço de envio: ${e.message}\n\nDeseja abrir no Outlook / Webmail agora para enviar diretamente em 1 clique?`);
            if (wantOutlook) {
                if (emailModalData.rotina?.id) {
                    await handleRecordEmailSent(emailModalData.rotina.id, 'outlook');
                }
                window.open(mailtoUrl, '_blank');
                setEmailModalData(null);
            }
        } finally {
            setIsSendingEmail(false);
        }
    };

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

        const hist = [{ action: 'Criado', user: userName || 'Sistema', date: new Date().toISOString(), mes: mesRef, ano: anoRef }];
        const payload = {
            id: 'pend-' + Date.now(),
            documento: doc,
            motivo,
            responsavel: resp,
            criador: userName || 'Sistema',
            status: 'pendente',
            data_criacao: new Date().toISOString(),
            data_correcao: null,
            historico: JSON.stringify(hist)
        };

        const res = await fetch(`/api/gestao/pendencias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res && res.ok) {
            window.$toast('Documento pendente gravado com sucesso!', { type: 'success' });
            e.target.reset();
            await loadData();
        } else {
            window.$alert('Erro ao gravar documento pendente.');
        }
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
        hist.push({ action: 'Alterado por ' + (userName || 'Sistema'), user: userName || 'Sistema', date: new Date().toISOString(), mes: mesRef, ano: anoRef });

        const updatedPayload = {
            ...editingPendencia,
            documento: doc,
            motivo,
            responsavel: resp,
            historico: JSON.stringify(hist)
        };

        const res = await fetch(`/api/gestao/pendencias/${editingPendencia.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedPayload)
        });

        if (res && res.ok) {
            window.$toast('Pendência atualizada com sucesso!', { type: 'success' });
            setEditingPendencia(null);
            await loadData();
        }
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
                    ...p,
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
                ...resolvingPendencia,
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
                            disabled={!isSuperAdmin && userName !== data.responsavel}
                        />
                        <span style={{ marginLeft: '10px', fontSize: '0.9rem', color: '#888' }}>de 31</span>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.85rem', color: '#aaa', display: 'block', marginBottom: '0.3rem' }}>Responsável:</label>
                        <select value={data.responsavel} onChange={(e) => handleSaveIntegracao(tipo, data.dia_atual, e.target.value)} className="select-input" style={{ width: '100%', opacity: !isSuperAdmin ? 0.6 : 1, cursor: !isSuperAdmin ? 'not-allowed' : 'pointer' }} disabled={!isSuperAdmin} title={!isSuperAdmin ? 'Apenas Superadmin pode alterar o responsável' : 'Alterar responsável'}>
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

        const canEditStatus = isSuperAdmin || userName === data.responsavel;
        const canEditResp = isSuperAdmin;

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
                    <select value={selectedMes} onChange={e => setSelectedMes(parseInt(e.target.value))} className="select-input" style={{ width: '160px' }}>
                        {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][i]}</option>)}
                    </select>
                    <select value={selectedAno} onChange={e => setSelectedAno(parseInt(e.target.value))} className="select-input" style={{ width: '115px' }}>
                        {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #333', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <button className={activeTab === 'integracoes' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('integracoes')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Building2 size={16} /> Fluxo de Trabalho & Integrações por Filial
                </button>
                <button className={activeTab === 'obrigacoes' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('obrigacoes')}>Obrigações Acessórias</button>
                <button className={activeTab === 'pendencias' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('pendencias')}>Documentos Pendentes</button>
                <button className={activeTab === 'relatorios' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('relatorios')}>Relatórios</button>
                <button className={activeTab === 'variacao' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('variacao')}>Variação Cambial</button>
            </div>

            {activeTab === 'relatorios' && (
              <RelatoriosContabeis selectedAno={selectedAno} selectedMes={selectedMes} companies={companies} />
            )}

            {activeTab === 'integracoes' && (() => {
                const filteredFiliais = filiaisList.filter(f => {
                    if (rotinaEmpresaFilter !== 'todas' && f.empresaId !== rotinaEmpresaFilter) return false;
                    if (rotinaFilialFilter !== 'todas' && f.code !== rotinaFilialFilter) return false;
                    return true;
                });

                const displayUsers = users.length > 0 ? users : [{ username: 'admin' }, { username: 'contabil' }];
                const totalIntegracoes = rotinas.filter(r => r.categoria === 'integracao');
                const totalIntegracoesConcluidas = totalIntegracoes.filter(r => r.status === 'concluida' || (r.dia_atual !== undefined && r.dia_atual >= 31)).length;
                const totalApuracoes = rotinas.filter(r => r.tipo === 'apuracao_fiscal');
                const totalApuracoesLiberadas = totalApuracoes.filter(r => r.status === 'liberada').length;
                const totalApuracoesConcluidas = totalApuracoes.filter(r => r.status === 'concluida').length;
                const pctGeral = totalIntegracoes.length > 0 ? Math.round((totalIntegracoesConcluidas / totalIntegracoes.length) * 100) : 0;

                // Declarações e Obrigações Consolidadas (não restritas a uma única filial)
                const rotinasConsolidadas = rotinas.filter(r => {
                    const isConsol = r.abrangencia === 'consolidado' || r.filialCode === 'consolidado' || r.tipo === 'declaracao_consolidada';
                    if (!isConsol) return false;
                    if (rotinaEmpresaFilter !== 'todas' && r.empresaId !== rotinaEmpresaFilter) return false;
                    return true;
                });

                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                        
                        {/* BARRA SUPERIOR ENXUTA: FILTROS + AÇÕES */}
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '12px',
                            padding: '0.9rem 1.2rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '0.8rem'
                        }}>
                            {/* Filtro por Empresa (Pills Rápidos) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: 'bold', textTransform: 'uppercase', marginRight: '4px' }}>
                                    Empresa:
                                </span>
                                <button
                                    onClick={() => { setRotinaEmpresaFilter('todas'); setRotinaFilialFilter('todas'); }}
                                    style={{
                                        background: rotinaEmpresaFilter === 'todas' ? '#FF9800' : 'rgba(255,255,255,0.06)',
                                        color: rotinaEmpresaFilter === 'todas' ? '#000' : '#ddd',
                                        border: '1px solid ' + (rotinaEmpresaFilter === 'todas' ? '#FF9800' : 'rgba(255,255,255,0.12)'),
                                        borderRadius: '6px',
                                        padding: '5px 10px',
                                        fontSize: '0.78rem',
                                        fontWeight: rotinaEmpresaFilter === 'todas' ? 'bold' : '500',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Todas ({filiaisList.length})
                                </button>
                                {EMPRESAS_CONFIG.map(emp => {
                                    const isSelected = rotinaEmpresaFilter === emp.id;
                                    const count = filiaisList.filter(f => f.empresaId === emp.id).length;
                                    return (
                                        <button
                                            key={emp.id}
                                            onClick={() => { setRotinaEmpresaFilter(emp.id); setRotinaFilialFilter('todas'); }}
                                            style={{
                                                background: isSelected ? emp.color : 'rgba(255,255,255,0.06)',
                                                color: isSelected ? '#fff' : '#ddd',
                                                border: '1px solid ' + (isSelected ? emp.color : 'rgba(255,255,255,0.12)'),
                                                borderRadius: '6px',
                                                padding: '5px 10px',
                                                fontSize: '0.78rem',
                                                fontWeight: isSelected ? 'bold' : '500',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {emp.name} ({count})
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Ações e Progresso Resumido */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                {rotinas.length > 0 && (
                                    <div style={{
                                        background: 'rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '6px',
                                        padding: '4px 10px',
                                        fontSize: '0.78rem',
                                        color: '#aaa',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        <span>Progresso:</span>
                                        <span style={{ color: pctGeral === 100 ? '#81C784' : '#FFB74D', fontWeight: 'bold' }}>
                                            {totalIntegracoesConcluidas}/{totalIntegracoes.length} ({pctGeral}%)
                                        </span>
                                        {totalApuracoesLiberadas > 0 && (
                                            <span style={{ background: '#4CAF5022', color: '#81C784', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.74rem' }}>
                                                {totalApuracoesLiberadas} p/ apurar
                                            </span>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={handleSyncPreviousMonthRoutines}
                                    className="btn-secondary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', padding: '0.45rem 0.8rem' }}
                                    title="Sincronizar rotinas e declarações cadastradas na competência anterior para este mês"
                                >
                                    <RefreshCw size={14} /> Sincronizar Mês Anterior
                                </button>

                                <button
                                    onClick={handleGenerateDefaultRoutines}
                                    className="btn-primary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', padding: '0.45rem 0.8rem' }}
                                    title="Gera ou atualiza as rotinas padrão (Entradas, Saídas, Financeiro e Apuração) para as filiais selecionadas"
                                >
                                    <Sparkles size={14} /> Gerar Mês ({selectedMes}/{selectedAno})
                                </button>

                                <button
                                    onClick={() => setShowNewRotinaModal(true)}
                                    className="btn-secondary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', padding: '0.45rem 0.8rem' }}
                                >
                                    <PlusCircle size={14} /> Nova Tarefa
                                </button>
                            </div>
                        </div>

                        {/* EMPTY STATE */}
                        {rotinas.length === 0 && (
                            <div style={{
                                background: 'rgba(255, 152, 0, 0.06)',
                                border: '1px dashed rgba(255, 152, 0, 0.3)',
                                borderRadius: '12px',
                                padding: '2.5rem 1.5rem',
                                textAlign: 'center',
                                color: '#ccc'
                            }}>
                                <Sparkles size={36} style={{ color: '#FFB74D', marginBottom: '10px' }} />
                                <h4 style={{ margin: '0 0 6px 0', color: '#fff', fontSize: '1.05rem' }}>
                                    Nenhuma rotina gerada para {selectedMes}/{selectedAno}
                                </h4>
                                <p style={{ margin: '0 auto 16px auto', maxWidth: '500px', fontSize: '0.84rem', color: '#aaa' }}>
                                    As rotinas dos meses anteriores seguem automaticamente para os próximos meses. Caso deseje, sincronize ou gere agora:
                                </p>
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={handleSyncPreviousMonthRoutines}
                                        className="btn-secondary"
                                        style={{ padding: '0.55rem 1.2rem', fontSize: '0.85rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <RefreshCw size={15} /> Sincronizar Mês Anterior
                                    </button>
                                    <button
                                        onClick={handleGenerateDefaultRoutines}
                                        className="btn-primary"
                                        style={{ padding: '0.55rem 1.2rem', fontSize: '0.85rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <Sparkles size={15} /> Gerar Rotinas Padrão do Mês
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* OBRIGAÇÕES E DECLARAÇÕES CONSOLIDADAS (EFD, DCTF, SPED, ETC.) */}
                        {rotinasConsolidadas.length > 0 && (
                            <div style={{
                                background: 'rgba(33, 150, 243, 0.04)',
                                border: '1px solid rgba(33, 150, 243, 0.25)',
                                borderRadius: '12px',
                                padding: '1.2rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Layers size={18} style={{ color: '#64B5F6' }} />
                                        <h4 style={{ margin: 0, color: '#fff', fontSize: '1rem', fontWeight: 'bold' }}>
                                            Declarações & Obrigações Consolidadas da Empresa
                                        </h4>
                                        <span style={{ fontSize: '0.74rem', background: 'rgba(33, 150, 243, 0.2)', color: '#90CAF9', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                                            {rotinasConsolidadas.length} {rotinasConsolidadas.length === 1 ? 'declaração' : 'declarações'}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '0.76rem', color: '#aaa' }}>
                                        Obrigações centralizadas que dependem do fechamento das integrações de todas as filiais
                                    </span>
                                </div>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                                    gap: '1rem'
                                }}>
                                    {rotinasConsolidadas.map(decl => {
                                        const empConfig = EMPRESAS_CONFIG.find(e => e.id === decl.empresaId) || { name: decl.empresaId, color: '#2196F3' };
                                        const isDone = decl.status === 'concluida' || decl.status === 'concluido';
                                        const hasDeps = decl.dependencias && decl.dependencias.length > 0;

                                        const totalDeps = (decl.dependencias || []).length;
                                        let doneDeps = 0;
                                        const pendingDeps = [];

                                        if (hasDeps) {
                                            decl.dependencias.forEach(depId => {
                                                const r = rotinas.find(x => x.id === depId);
                                                if (r && (r.status === 'concluida' || r.status === 'concluido' || (r.dia_atual !== undefined && r.dia_atual >= 31))) {
                                                    doneDeps++;
                                                } else if (r) {
                                                    pendingDeps.push(r);
                                                }
                                            });
                                        }

                                        const allDepsCompleted = !hasDeps || doneDeps === totalDeps;
                                        const isLiberada = !isDone && (decl.status === 'liberada' || allDepsCompleted);
                                        const depPct = hasDeps ? (totalDeps > 0 ? Math.round((doneDeps / totalDeps) * 100) : 100) : 100;

                                        return (
                                            <div
                                                key={decl.id}
                                                style={{
                                                    background: isDone 
                                                        ? 'rgba(76, 175, 80, 0.05)' 
                                                        : isLiberada 
                                                        ? 'rgba(76, 175, 80, 0.1)' 
                                                        : 'rgba(0,0,0,0.3)',
                                                    border: `1px solid ${
                                                        isDone 
                                                            ? 'rgba(76, 175, 80, 0.3)' 
                                                            : isLiberada 
                                                            ? '#4CAF50' 
                                                            : 'rgba(255,255,255,0.08)'
                                                    }`,
                                                    borderLeft: `4px solid ${empConfig.color}`,
                                                    borderRadius: '10px',
                                                    padding: '1rem',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '0.8rem'
                                                }}
                                            >
                                                {/* Header da Declaração */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                                    <div>
                                                        <h4 style={{ margin: 0, color: '#fff', fontSize: '1rem', fontWeight: 'bold' }}>
                                                            {decl.titulo}
                                                        </h4>
                                                        <div style={{ fontSize: '0.74rem', color: '#888', marginTop: '2px' }}>
                                                            🏢 {empConfig.name} • Consolidado
                                                        </div>
                                                    </div>

                                                    <div>
                                                        {isDone ? (
                                                            <span style={{ background: 'rgba(76, 175, 80, 0.18)', color: '#81C784', border: '1px solid rgba(76, 175, 80, 0.4)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 'bold' }}>
                                                                ✅ Concluída
                                                            </span>
                                                        ) : isLiberada ? (
                                                            <span style={{ background: 'rgba(76, 175, 80, 0.25)', color: '#4CAF50', border: '1px solid #4CAF50', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 'bold' }}>
                                                                🟢 Pronta p/ Envio
                                                            </span>
                                                        ) : (
                                                            <span style={{ background: 'rgba(255, 152, 0, 0.12)', color: '#FFB74D', border: '1px solid rgba(255, 152, 0, 0.25)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 'bold' }}>
                                                                🔒 Bloqueada
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Barra de Progresso das Integrações Pré-Requisito */}
                                                {hasDeps ? (
                                                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                                                            <span style={{ color: '#aaa' }}>Integrações Pré-Requisito:</span>
                                                            <span style={{ color: depPct === 100 ? '#81C784' : '#FFB74D', fontWeight: 'bold' }}>
                                                                {doneDeps}/{totalDeps} ({depPct}%)
                                                            </span>
                                                        </div>
                                                        <div style={{ background: 'rgba(255,255,255,0.06)', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${depPct}%`, height: '100%', background: depPct === 100 ? '#4CAF50' : '#FF9800', transition: 'width 0.3s' }}></div>
                                                        </div>
                                                        {pendingDeps.length > 0 && !isDone && (
                                                            <div style={{ fontSize: '0.7rem', color: '#E57373', marginTop: '6px', lineHeight: '1.3' }}>
                                                                Pendente: {pendingDeps.slice(0, 3).map(p => `${p.filialCode} (${p.tipo || p.titulo})`).join(', ')}
                                                                {pendingDeps.length > 3 ? ` e mais ${pendingDeps.length - 3}...` : ''}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div style={{ background: 'rgba(76, 175, 80, 0.08)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(76, 175, 80, 0.2)', fontSize: '0.74rem', color: '#81C784', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <CheckCircle2 size={13} /> Sem pré-requisitos pendentes (Pronta para transmissão)
                                                    </div>
                                                )}

                                                {/* Responsável e Prazo */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', fontSize: '0.75rem', color: '#888' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <User size={13} style={{ color: '#777' }} />
                                                            <span>{decl.responsavel || 'Sem responsável'}</span>
                                                        </div>
                                                        {renderCobrancaBadge(decl)}
                                                    </div>
                                                    {decl.data_limite && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#FFB74D' }}>
                                                            <Clock size={12} /> Prazo: {decl.data_limite.split('-').reverse().join('/')}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Ações */}
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                                    {isDone ? (
                                                        <button
                                                            onClick={() => handleToggleRotinaStatus(decl)}
                                                            style={{ background: 'rgba(255,255,255,0.06)', color: '#aaa', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.72rem' }}
                                                        >
                                                            Reabrir
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleToggleRotinaStatus(decl)}
                                                            disabled={!isLiberada}
                                                            style={{
                                                                background: isLiberada ? '#4CAF50' : 'rgba(255,255,255,0.05)',
                                                                color: isLiberada ? '#fff' : '#666',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                padding: '4px 10px',
                                                                cursor: isLiberada ? 'pointer' : 'not-allowed',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 'bold',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px'
                                                            }}
                                                        >
                                                            <Check size={13} /> Concluir Transmissão
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => handleOpenManualEmail(decl)}
                                                        disabled={!isSuperAdmin}
                                                        style={{
                                                            background: !isSuperAdmin ? 'rgba(255,255,255,0.03)' : 'rgba(33, 150, 243, 0.15)',
                                                            color: !isSuperAdmin ? '#555' : '#64B5F6',
                                                            border: `1px solid ${!isSuperAdmin ? 'transparent' : 'rgba(33, 150, 243, 0.3)'}`,
                                                            borderRadius: '4px',
                                                            padding: '3px 8px',
                                                            cursor: !isSuperAdmin ? 'not-allowed' : 'pointer',
                                                            fontSize: '0.72rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            opacity: !isSuperAdmin ? 0.5 : 1
                                                        }}
                                                        title={!isSuperAdmin ? "Apenas Superadmin pode notificar/cobrar por e-mail" : "Notificar por e-mail"}
                                                    >
                                                        <Mail size={12} /> E-mail
                                                    </button>

                                                    <button
                                                        onClick={() => handleDeleteRotina(decl)}
                                                        style={{ background: 'rgba(239, 83, 80, 0.15)', color: '#E57373', border: '1px solid rgba(239, 83, 80, 0.3)', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer' }}
                                                        title="Excluir rotina"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* SEPARAÇÃO POR EMPRESA (CADA EMPRESA TEM SEU BLOCO E SUA PRÓPRIA LINHA DE CARDS) */}
                        {rotinas.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.2rem' }}>
                                {EMPRESAS_CONFIG.map(emp => {
                                    const empFiliais = filteredFiliais.filter(f => f.empresaId === emp.id);
                                    if (empFiliais.length === 0) return null;

                                    return (
                                        <div key={emp.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                                            {/* CABEÇALHO/SEPARADOR DA EMPRESA */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                paddingBottom: '8px',
                                                borderBottom: `2px solid ${emp.color}44`
                                            }}>
                                                <div style={{
                                                    width: '10px',
                                                    height: '10px',
                                                    borderRadius: '50%',
                                                    background: emp.color,
                                                    boxShadow: `0 0 10px ${emp.color}`
                                                }} />
                                                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {emp.name}
                                                </h3>
                                                <span style={{
                                                    fontSize: '0.74rem',
                                                    background: emp.color + '22',
                                                    color: emp.color,
                                                    border: `1px solid ${emp.color}55`,
                                                    padding: '2px 8px',
                                                    borderRadius: '10px',
                                                    fontWeight: '600'
                                                }}>
                                                    {empFiliais.length} {empFiliais.length === 1 ? 'filial' : 'filiais'}
                                                </span>
                                                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)', marginLeft: '6px' }} />
                                            </div>

                                            {/* GRID DE CARDS DA EMPRESA (3 POR LINHA) */}
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                                                gap: '1.2rem',
                                                alignItems: 'start'
                                            }}>
                                                {empFiliais.map(filial => {
                                                    const empConfig = emp;
                                                    const filialRotinas = rotinas.filter(r => r.filialCode === filial.code);
                                    
                                    const fEntradas = filialRotinas.find(r => r.tipo === 'entradas');
                                    const fSaidas = filialRotinas.find(r => r.tipo === 'saidas');
                                    const fFinanceiro = filialRotinas.find(r => r.tipo === 'financeiro');
                                    const fApuracao = filialRotinas.find(r => r.tipo === 'apuracao_fiscal');
                                    const fOutras = filialRotinas.filter(r => !['entradas', 'saidas', 'financeiro', 'apuracao_fiscal'].includes(r.tipo));

                                    const allIntegracoesDone = (fEntradas?.dia_atual >= 31 || fEntradas?.status === 'concluida') &&
                                                               (fSaidas?.dia_atual >= 31 || fSaidas?.status === 'concluida') &&
                                                               (fFinanceiro?.dia_atual >= 31 || fFinanceiro?.status === 'concluida');

                                    const isApuracaoDone = fApuracao?.status === 'concluida';
                                    const isApuracaoLiberada = !isApuracaoDone && allIntegracoesDone;

                                    return (
                                        <div
                                            key={filial.code}
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.02)',
                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                borderTop: `4px solid ${empConfig.color}`,
                                                borderRadius: '12px',
                                                padding: '1.15rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.9rem',
                                                boxShadow: '0 4px 15px rgba(0,0,0,0.25)'
                                            }}
                                        >
                                            {/* CABEÇALHO DO CARD */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{
                                                            background: empConfig.color + '22',
                                                            color: empConfig.color,
                                                            border: `1px solid ${empConfig.color}55`,
                                                            padding: '2px 7px',
                                                            borderRadius: '5px',
                                                            fontWeight: 'bold',
                                                            fontSize: '0.82rem'
                                                        }}>
                                                            {filial.code}
                                                        </span>
                                                        <h4 style={{ margin: 0, color: '#fff', fontSize: '0.96rem', fontWeight: '600' }}>
                                                            {filial.name.replace(`${filial.code} - `, '')}
                                                        </h4>
                                                    </div>
                                                    <div style={{ fontSize: '0.74rem', color: '#888', marginTop: '2px' }}>
                                                        {empConfig.name}
                                                    </div>
                                                </div>

                                                {/* BADGE DE STATUS */}
                                                <div>
                                                    {isApuracaoDone ? (
                                                        <span style={{
                                                            background: 'rgba(76, 175, 80, 0.18)',
                                                            color: '#81C784',
                                                            border: '1px solid rgba(76, 175, 80, 0.4)',
                                                            padding: '3px 8px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 'bold',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}>
                                                            <CheckCircle2 size={12} /> Concluída
                                                        </span>
                                                    ) : isApuracaoLiberada ? (
                                                        <span style={{
                                                            background: 'rgba(76, 175, 80, 0.25)',
                                                            color: '#4CAF50',
                                                            border: '1px solid #4CAF50',
                                                            padding: '3px 8px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 'bold',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}>
                                                            <Unlock size={12} /> Liberada p/ Apurar
                                                        </span>
                                                    ) : (
                                                        <span style={{
                                                            background: 'rgba(255, 152, 0, 0.12)',
                                                            color: '#FFB74D',
                                                            border: '1px solid rgba(255, 152, 0, 0.25)',
                                                            padding: '3px 8px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 'bold',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}>
                                                            <Clock size={12} /> Integrando...
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* LINHAS DAS 3 INTEGRAÇÕES (COMPACTO COM MAIS RESPIRO) */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {[
                                                    { rot: fEntradas, label: 'Entradas', icon: '📥' },
                                                    { rot: fSaidas, label: 'Saídas', icon: '📤' },
                                                    { rot: fFinanceiro, label: 'Financeiro', icon: '💰' }
                                                ].map(({ rot, label, icon }) => {
                                                    if (!rot) return null;
                                                    const isDone = rot.dia_atual >= 31 || rot.status === 'concluida';
                                                    const pct = Math.min(((rot.dia_atual || 0) / 31) * 100, 100);

                                                    return (
                                                        <div
                                                            key={rot.id}
                                                            style={{
                                                                background: isDone ? 'rgba(76, 175, 80, 0.06)' : 'rgba(0,0,0,0.22)',
                                                                border: `1px solid ${isDone ? 'rgba(76, 175, 80, 0.25)' : 'rgba(255, 255, 255, 0.05)'}`,
                                                                borderRadius: '7px',
                                                                padding: '6px 9px',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: '5px'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                                                <span style={{ fontSize: '0.82rem', color: '#eee', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                    <span>{icon}</span> {label}
                                                                </span>

                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                                        <span style={{ fontSize: '0.74rem', color: '#888' }}>Dia:</span>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            max="31"
                                                                            value={rot.dia_atual || 0}
                                                                            onChange={(e) => handleUpdateRoutineProgress(rot.id, parseInt(e.target.value) || 0)}
                                                                            className="text-input"
                                                                            style={{ width: '44px', padding: '2px 4px', fontSize: '0.76rem', textAlign: 'center' }}
                                                                        />
                                                                        <span style={{ fontSize: '0.74rem', color: '#888' }}>/31</span>
                                                                    </div>

                                                                    <button
                                                                        onClick={() => handleUpdateRoutineProgress(rot.id, 31)}
                                                                        style={{
                                                                            background: isDone ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 152, 0, 0.15)',
                                                                            color: isDone ? '#81C784' : '#FFB74D',
                                                                            border: `1px solid ${isDone ? 'rgba(76, 175, 80, 0.4)' : 'rgba(255, 152, 0, 0.3)'}`,
                                                                            borderRadius: '4px',
                                                                            padding: '2px 6px',
                                                                            cursor: 'pointer',
                                                                            fontSize: '0.72rem',
                                                                            fontWeight: 'bold'
                                                                        }}
                                                                        title="Marcar como integrado até dia 31"
                                                                    >
                                                                        {isDone ? '✓ 31' : '31'}
                                                                    </button>

                                                                    <select
                                                                        value={rot.responsavel || ''}
                                                                        onChange={(e) => handleUpdateRotinaResponsavel(rot.id, e.target.value)}
                                                                        disabled={!isSuperAdmin}
                                                                        className="select-input"
                                                                        style={{
                                                                            padding: '2px 5px',
                                                                            fontSize: '0.72rem',
                                                                            maxWidth: '115px',
                                                                            opacity: !isSuperAdmin ? 0.6 : 1,
                                                                            cursor: !isSuperAdmin ? 'not-allowed' : 'pointer'
                                                                        }}
                                                                        title={!isSuperAdmin ? "Apenas Superadmin pode alterar o responsável" : "Responsável pela integração"}
                                                                    >
                                                                        <option value="">Responsável...</option>
                                                                        {displayUsers.map(u => (
                                                                            <option key={u.username} value={u.username}>{u.username}</option>
                                                                        ))}
                                                                    </select>

                                                                    <button
                                                                        onClick={() => handleOpenCobrancaIntegracao(rot, filial, label)}
                                                                        disabled={isDone || !isSuperAdmin}
                                                                        style={{
                                                                            background: (isDone || !isSuperAdmin) ? 'rgba(255,255,255,0.03)' : 'rgba(33, 150, 243, 0.15)',
                                                                            color: (isDone || !isSuperAdmin) ? '#555' : '#64B5F6',
                                                                            border: `1px solid ${(isDone || !isSuperAdmin) ? 'transparent' : 'rgba(33, 150, 243, 0.35)'}`,
                                                                            borderRadius: '4px',
                                                                            padding: '2px 6px',
                                                                            cursor: (isDone || !isSuperAdmin) ? 'not-allowed' : 'pointer',
                                                                            fontSize: '0.7rem',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '3px',
                                                                            fontWeight: '500',
                                                                            opacity: !isSuperAdmin ? 0.5 : 1
                                                                        }}
                                                                        title={!isSuperAdmin ? 'Apenas Superadmin pode cobrar responsáveis' : isDone ? 'Integração já concluída' : 'Cobrar responsável por e-mail'}
                                                                    >
                                                                        <Mail size={11} /> Cobrar
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Barra de progresso fina */}
                                                            <div style={{ background: 'rgba(255,255,255,0.05)', height: '3px', borderRadius: '2px', overflow: 'hidden' }}>
                                                                <div style={{ width: `${pct}%`, height: '100%', background: isDone ? '#4CAF50' : '#FF9800', transition: 'width 0.2s' }}></div>
                                                            </div>

                                                            {/* Linha de Prazo e Status de Cobrança */}
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', paddingTop: '2px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                    {isPrazoVencido(rot.data_limite, rot.dia_atual) && (
                                                                        <span style={{ color: '#EF5350', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                                            <AlertTriangle size={10} /> Atrasado!
                                                                        </span>
                                                                    )}
                                                                    {renderCobrancaBadge(rot)}
                                                                </div>

                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                    <span style={{ color: '#777' }}>Prazo:</span>
                                                                    <input
                                                                        type="date"
                                                                        value={rot.data_limite || ''}
                                                                        onChange={(e) => handleUpdateRoutinePrazo(rot.id, e.target.value)}
                                                                        className="text-input"
                                                                        style={{ fontSize: '0.68rem', padding: '1px 3px', width: '95px', height: '20px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)' }}
                                                                        title="Definir prazo limite para esta integração"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* RODAPÉ: APURAÇÃO FISCAL AMARRADA */}
                                            {fApuracao && (
                                                <div style={{
                                                    background: isApuracaoDone 
                                                        ? 'rgba(76, 175, 80, 0.08)' 
                                                        : isApuracaoLiberada 
                                                        ? 'rgba(76, 175, 80, 0.12)' 
                                                        : 'rgba(0,0,0,0.18)',
                                                    border: `1px solid ${
                                                        isApuracaoDone 
                                                            ? 'rgba(76, 175, 80, 0.3)' 
                                                            : isApuracaoLiberada 
                                                            ? '#4CAF50' 
                                                            : 'rgba(255,255,255,0.06)'
                                                    }`,
                                                    borderRadius: '8px',
                                                    padding: '8px 10px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '6px'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#fff', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <ShieldAlert size={14} style={{ color: isApuracaoDone || isApuracaoLiberada ? '#4CAF50' : '#888' }} />
                                                            Apuração Fiscal
                                                        </div>

                                                        {/* Seletor de responsável da apuração */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <User size={12} style={{ color: '#777' }} />
                                                            <select
                                                                value={fApuracao.responsavel || ''}
                                                                onChange={(e) => handleUpdateRotinaResponsavel(fApuracao.id, e.target.value)}
                                                                disabled={!isSuperAdmin}
                                                                className="select-input"
                                                                style={{
                                                                    padding: '2px 6px',
                                                                    fontSize: '0.74rem',
                                                                    maxWidth: '125px',
                                                                    opacity: !isSuperAdmin ? 0.6 : 1,
                                                                    cursor: !isSuperAdmin ? 'not-allowed' : 'pointer'
                                                                }}
                                                                title={!isSuperAdmin ? "Apenas Superadmin pode alterar o responsável" : "Responsável pela apuração"}
                                                            >
                                                                <option value="">Responsável...</option>
                                                                {displayUsers.map(u => (
                                                                    <option key={u.username} value={u.username}>{u.username}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Mensagem de Estado & Botões de Ação */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <div style={{ fontSize: '0.74rem', color: isApuracaoDone ? '#81C784' : isApuracaoLiberada ? '#4CAF50' : '#888' }}>
                                                                {isApuracaoDone ? (
                                                                    <span>✅ Concluída {fApuracao.concluido_por ? `por ${fApuracao.concluido_por}` : ''}</span>
                                                                ) : isApuracaoLiberada ? (
                                                                    <span style={{ fontWeight: 'bold' }}>🟢 Liberada! Pronto p/ apurar</span>
                                                                ) : (
                                                                    <span>🔒 Bloqueada (aguardando dia 31)</span>
                                                                )}
                                                            </div>
                                                            <div>{renderCobrancaBadge(fApuracao)}</div>
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            {isApuracaoDone ? (
                                                                <button
                                                                    onClick={() => handleToggleRotinaStatus(fApuracao)}
                                                                    style={{
                                                                        background: 'rgba(255,255,255,0.06)',
                                                                        color: '#aaa',
                                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                                        borderRadius: '4px',
                                                                        padding: '2px 6px',
                                                                        cursor: 'pointer',
                                                                        fontSize: '0.7rem'
                                                                    }}
                                                                >
                                                                    Reabrir
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleToggleRotinaStatus(fApuracao)}
                                                                    disabled={!isApuracaoLiberada}
                                                                    style={{
                                                                        background: isApuracaoLiberada ? '#4CAF50' : 'rgba(255,255,255,0.05)',
                                                                        color: isApuracaoLiberada ? '#fff' : '#666',
                                                                        border: 'none',
                                                                        borderRadius: '4px',
                                                                        padding: '3px 8px',
                                                                        cursor: isApuracaoLiberada ? 'pointer' : 'not-allowed',
                                                                        fontSize: '0.72rem',
                                                                        fontWeight: 'bold',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px'
                                                                    }}
                                                                >
                                                                    <Check size={12} /> Concluir
                                                                </button>
                                                            )}

                                                            <button
                                                                onClick={() => handleOpenManualEmail(fApuracao)}
                                                                disabled={!isSuperAdmin}
                                                                style={{
                                                                    background: !isSuperAdmin ? 'rgba(255,255,255,0.03)' : 'rgba(33, 150, 243, 0.12)',
                                                                    color: !isSuperAdmin ? '#555' : '#64B5F6',
                                                                    border: `1px solid ${!isSuperAdmin ? 'transparent' : 'rgba(33, 150, 243, 0.3)'}`,
                                                                    borderRadius: '4px',
                                                                    padding: '3px 6px',
                                                                    cursor: !isSuperAdmin ? 'not-allowed' : 'pointer',
                                                                    fontSize: '0.7rem',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '3px',
                                                                    opacity: !isSuperAdmin ? 0.5 : 1
                                                                }}
                                                                title={!isSuperAdmin ? "Apenas Superadmin pode notificar/cobrar por e-mail" : "Notificar responsável por e-mail"}
                                                            >
                                                                <Mail size={11} /> E-mail
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* OUTRAS TAREFAS VINCULADAS À FILIAL (SE HOUVER) */}
                                            {fOutras.length > 0 && (
                                                <div style={{ borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                    <span style={{ fontSize: '0.7rem', color: '#777', textTransform: 'uppercase' }}>Outras Tarefas:</span>
                                                    {fOutras.map(r => (
                                                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', background: 'rgba(255,255,255,0.02)', padding: '2px 6px', borderRadius: '4px' }}>
                                                            <span style={{ color: r.status === 'concluida' ? '#81C784' : '#ddd' }}>
                                                                {r.status === 'concluida' ? '✓ ' : '• '}{r.titulo}
                                                            </span>
                                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                                <button onClick={() => handleToggleRotinaStatus(r)} style={{ background: 'none', border: 'none', color: '#64B5F6', cursor: 'pointer', fontSize: '0.68rem', textDecoration: 'underline' }}>
                                                                    {r.status === 'concluida' ? 'Reabrir' : 'Concluir'}
                                                                </button>
                                                                <button onClick={() => handleDeleteRotina(r)} style={{ background: 'none', border: 'none', color: '#E57373', cursor: 'pointer' }}>
                                                                    <Trash2 size={11} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                    </div>
                );
            })()}

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
                    
                    let metaMes = null, metaAno = null;
                    try {
                        const hist = typeof p.historico === 'string' ? JSON.parse(p.historico) : p.historico;
                        if (Array.isArray(hist) && hist[0]) {
                            if (hist[0].mes) metaMes = hist[0].mes;
                            if (hist[0].ano) metaAno = hist[0].ano;
                        }
                    } catch(err) {}

                    if (pendenciaFiltroAno !== 'todos') {
                        const pAno = p.ano || metaAno || (p.data_criacao ? new Date(p.data_criacao).getFullYear() : null);
                        if (pAno && pAno !== parseInt(pendenciaFiltroAno)) return false;
                    }

                    if (pendenciaFiltroMes !== 'todos') {
                        const pMes = p.mes || metaMes || (p.data_criacao ? new Date(p.data_criacao).getMonth() + 1 : null);
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

            {/* MODAL DE CADASTRO DE NOVA ROTINA / TAREFA PERSONALIZADA */}
            {showNewRotinaModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
                    <div style={{ background: '#1a1f2c', border: '1px solid rgba(255, 152, 0, 0.4)', borderRadius: '12px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', paddingBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <PlusCircle size={20} style={{ color: '#FF9800' }} />
                                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem' }}>Cadastrar Nova Rotina Contábil</h3>
                            </div>
                            <button onClick={() => setShowNewRotinaModal(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '4px' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveNewCustomRotina} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
                                    Título da Rotina / Declaração: *
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: EFD CONTRIBUIÇÕES, DCTF WEB, SPED ECF, Apuração Fiscal..."
                                    value={newRotinaForm.titulo}
                                    onChange={(e) => setNewRotinaForm({ ...newRotinaForm, titulo: e.target.value })}
                                    className="text-input"
                                    style={{ width: '100%', padding: '0.55rem' }}
                                    required
                                />
                            </div>

                            {/* SELETOR DE ABRANGÊNCIA: POR FILIAL OU CONSOLIDADA */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '6px', fontWeight: 'bold' }}>
                                    Abrangência / Nível:
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setNewRotinaForm({ ...newRotinaForm, abrangencia: 'consolidado' })}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            border: newRotinaForm.abrangencia === 'consolidado' ? '1px solid #2196F3' : '1px solid rgba(255,255,255,0.1)',
                                            background: newRotinaForm.abrangencia === 'consolidado' ? 'rgba(33, 150, 243, 0.2)' : 'rgba(0,0,0,0.2)',
                                            color: newRotinaForm.abrangencia === 'consolidado' ? '#64B5F6' : '#888',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            fontSize: '0.82rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <Layers size={16} /> 🌐 Consolidada da Empresa
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewRotinaForm({ ...newRotinaForm, abrangencia: 'filial' })}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            border: newRotinaForm.abrangencia === 'filial' ? '1px solid #FF9800' : '1px solid rgba(255,255,255,0.1)',
                                            background: newRotinaForm.abrangencia === 'filial' ? 'rgba(255, 152, 0, 0.15)' : 'rgba(0,0,0,0.2)',
                                            color: newRotinaForm.abrangencia === 'filial' ? '#FFB74D' : '#888',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            fontSize: '0.82rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <Building2 size={16} /> 🏢 Por Filial Específica
                                    </button>
                                </div>
                                <div style={{ fontSize: '0.73rem', color: '#888', marginTop: '4px' }}>
                                    {newRotinaForm.abrangencia === 'consolidado' 
                                        ? '💡 Declarações como EFD Contribuições, DCTF e SPED ECF englobam todas as filiais e dependem do fechamento geral.'
                                        : '💡 Rotinas operacionais exclusivas de uma filial específica.'
                                    }
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
                                        Empresa:
                                    </label>
                                    <select
                                        value={newRotinaForm.empresaId}
                                        onChange={(e) => {
                                            const empId = e.target.value;
                                            const firstFilial = filiaisList.find(f => f.empresaId === empId)?.code || '0101';
                                            setNewRotinaForm({ ...newRotinaForm, empresaId: empId, filialCode: firstFilial, dependencias: [] });
                                        }}
                                        className="select-input"
                                        style={{ width: '100%', padding: '0.55rem' }}
                                    >
                                        {EMPRESAS_CONFIG.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
                                        Filial:
                                    </label>
                                    {newRotinaForm.abrangencia === 'consolidado' ? (
                                        <div style={{
                                            background: 'rgba(33, 150, 243, 0.1)',
                                            border: '1px solid rgba(33, 150, 243, 0.3)',
                                            borderRadius: '6px',
                                            padding: '0.55rem',
                                            fontSize: '0.8rem',
                                            color: '#90CAF9',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <Layers size={14} /> Consolidado (Todas as Filiais)
                                        </div>
                                    ) : (
                                        <select
                                            value={newRotinaForm.filialCode}
                                            onChange={(e) => setNewRotinaForm({ ...newRotinaForm, filialCode: e.target.value, dependencias: [] })}
                                            className="select-input"
                                            style={{ width: '100%', padding: '0.55rem' }}
                                        >
                                            {filiaisList
                                                .filter(f => f.empresaId === newRotinaForm.empresaId)
                                                .map(f => (
                                                    <option key={f.code} value={f.code}>{f.name}</option>
                                                ))
                                            }
                                        </select>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
                                        Categoria:
                                    </label>
                                    <select
                                        value={newRotinaForm.categoria}
                                        onChange={(e) => setNewRotinaForm({ ...newRotinaForm, categoria: e.target.value })}
                                        className="select-input"
                                        style={{ width: '100%', padding: '0.55rem' }}
                                    >
                                        <option value="fiscal">Fiscal (Apuração, Fechamento)</option>
                                        <option value="integracao">Integração Contábil</option>
                                        <option value="contabil">Contábil / Balancete</option>
                                        <option value="conciliacao">Conciliação Financeira / Bancária</option>
                                        <option value="outros">Outros</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
                                        Responsável:
                                    </label>
                                    <select
                                        value={newRotinaForm.responsavel}
                                        onChange={(e) => {
                                            const resp = e.target.value;
                                            const uObj = users.find(u => u.username === resp);
                                            setNewRotinaForm({
                                                ...newRotinaForm,
                                                responsavel: resp,
                                                responsavelEmail: uObj?.email || (resp ? `${resp}@agfequipamentos.com.br` : '')
                                            });
                                        }}
                                        className="select-input"
                                        style={{ width: '100%', padding: '0.55rem' }}
                                    >
                                        <option value="">Selecione o responsável...</option>
                                        {displayUsers.map(u => (
                                            <option key={u.username} value={u.username}>{u.username}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
                                        E-mail do Responsável (para notificações):
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="ex: responsavel@agfequipamentos.com.br"
                                        value={newRotinaForm.responsavelEmail}
                                        onChange={(e) => setNewRotinaForm({ ...newRotinaForm, responsavelEmail: e.target.value })}
                                        className="text-input"
                                        style={{ width: '100%', padding: '0.55rem' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
                                        Data Limite / Prazo:
                                    </label>
                                    <input
                                        type="date"
                                        value={newRotinaForm.data_limite}
                                        onChange={(e) => setNewRotinaForm({ ...newRotinaForm, data_limite: e.target.value })}
                                        className="text-input"
                                        style={{ width: '100%', padding: '0.55rem' }}
                                    />
                                </div>
                            </div>

                            {/* AMARRAÇÃO DE DEPENDÊNCIAS */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                                    <label style={{ fontSize: '0.82rem', color: '#FFB74D', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Lock size={15} /> Amarração de Dependências (Predecessoras):
                                    </label>
                                    <span style={{ fontSize: '0.74rem', color: '#888' }}>
                                        {(newRotinaForm.dependencias || []).length} selecionada(s)
                                    </span>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#888', margin: '0 0 10px 0' }}>
                                    {newRotinaForm.abrangencia === 'consolidado' 
                                        ? 'Selecione as integrações de todas as filiais que precisam estar no dia 31 antes de liberar esta declaração:'
                                        : 'Selecione quais rotinas precisam ser finalizadas antes que esta operação seja liberada:'
                                    }
                                </p>

                                {/* BOTÕES DE ATALHO RÁPIDO PARA MARCAÇÃO EM MASSA */}
                                {newRotinaForm.abrangencia === 'consolidado' && (
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const allCompanyIntegracoes = rotinas
                                                    .filter(r => r.empresaId === newRotinaForm.empresaId && r.categoria === 'integracao')
                                                    .map(r => r.id);
                                                setNewRotinaForm({ ...newRotinaForm, dependencias: allCompanyIntegracoes });
                                            }}
                                            style={{
                                                background: 'rgba(33, 150, 243, 0.18)',
                                                color: '#64B5F6',
                                                border: '1px solid rgba(33, 150, 243, 0.4)',
                                                borderRadius: '5px',
                                                padding: '4px 8px',
                                                fontSize: '0.72rem',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            ⚡ Marcar Todas as Integrações da Empresa
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const allCompanyApuracoes = rotinas
                                                    .filter(r => r.empresaId === newRotinaForm.empresaId && r.tipo === 'apuracao_fiscal')
                                                    .map(r => r.id);
                                                setNewRotinaForm({ ...newRotinaForm, dependencias: allCompanyApuracoes });
                                            }}
                                            style={{
                                                background: 'rgba(76, 175, 80, 0.18)',
                                                color: '#81C784',
                                                border: '1px solid rgba(76, 175, 80, 0.4)',
                                                borderRadius: '5px',
                                                padding: '4px 8px',
                                                fontSize: '0.72rem',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            ⚡ Marcar Todas as Apurações Fiscais
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNewRotinaForm({ ...newRotinaForm, dependencias: [] })}
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                color: '#aaa',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '5px',
                                                padding: '4px 8px',
                                                fontSize: '0.72rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Limpar
                                        </button>
                                    </div>
                                )}

                                <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {newRotinaForm.abrangencia === 'consolidado' ? (
                                        // LISTA AGRUPADA POR FILIAL PARA A DECLARAÇÃO CONSOLIDADA
                                        filiaisList
                                            .filter(f => f.empresaId === newRotinaForm.empresaId)
                                            .map(f => {
                                                const fRots = rotinas.filter(r => r.filialCode === f.code);
                                                if (fRots.length === 0) return null;
                                                return (
                                                    <div key={f.code} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '6px', padding: '6px 8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <div style={{ fontSize: '0.74rem', color: '#FFB74D', fontWeight: 'bold', marginBottom: '4px' }}>
                                                            🏢 {f.name}
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            {fRots.map(r => {
                                                                const isChecked = (newRotinaForm.dependencias || []).includes(r.id);
                                                                return (
                                                                    <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#ddd', cursor: 'pointer', background: isChecked ? 'rgba(33, 150, 243, 0.15)' : 'rgba(255,255,255,0.02)', padding: '4px 8px', borderRadius: '4px', border: `1px solid ${isChecked ? 'rgba(33, 150, 243, 0.35)' : 'transparent'}` }}>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isChecked}
                                                                            onChange={(e) => {
                                                                                const newDeps = e.target.checked
                                                                                    ? [...(newRotinaForm.dependencias || []), r.id]
                                                                                    : (newRotinaForm.dependencias || []).filter(id => id !== r.id);
                                                                                setNewRotinaForm({ ...newRotinaForm, dependencias: newDeps });
                                                                            }}
                                                                        />
                                                                        <span style={{ fontWeight: isChecked ? 'bold' : 'normal' }}>{r.titulo}</span>
                                                                        <span style={{ color: '#888', fontSize: '0.7rem', marginLeft: 'auto' }}>
                                                                            {r.status === 'concluida' ? '✅ Concluída' : `Dia ${r.dia_atual || 0}/31`}
                                                                        </span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                    ) : (
                                        // LISTA DA FILIAL ESPECÍFICA
                                        rotinas
                                            .filter(r => r.filialCode === newRotinaForm.filialCode)
                                            .map(r => {
                                                const isChecked = (newRotinaForm.dependencias || []).includes(r.id);
                                                return (
                                                    <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#ddd', cursor: 'pointer', background: isChecked ? 'rgba(255, 152, 0, 0.12)' : 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '6px', border: `1px solid ${isChecked ? 'rgba(255, 152, 0, 0.3)' : 'transparent'}` }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                                const newDeps = e.target.checked
                                                                    ? [...(newRotinaForm.dependencias || []), r.id]
                                                                    : (newRotinaForm.dependencias || []).filter(id => id !== r.id);
                                                                setNewRotinaForm({ ...newRotinaForm, dependencias: newDeps });
                                                            }}
                                                        />
                                                        <span style={{ fontWeight: isChecked ? 'bold' : 'normal' }}>{r.titulo}</span>
                                                        <span style={{ color: '#888', fontSize: '0.72rem', marginLeft: 'auto' }}>
                                                            {r.status === 'concluida' ? '✅ Concluída' : `Dia ${r.dia_atual || 0}/31`}
                                                        </span>
                                                    </label>
                                                );
                                            })
                                    )}

                                    {rotinas.length === 0 && (
                                        <span style={{ color: '#777', fontSize: '0.78rem' }}>
                                            Nenhuma rotina pré-requisito cadastrada no mês ainda. Gere as rotinas padrão primeiro.
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* REPLICAR PARA OS PRÓXIMOS MESES */}
                            <div 
                                style={{ 
                                    background: 'rgba(33, 150, 243, 0.08)', 
                                    border: '1px solid rgba(33, 150, 243, 0.25)', 
                                    borderRadius: '8px', 
                                    padding: '10px 14px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '10px', 
                                    cursor: 'pointer' 
                                }} 
                                onClick={() => setNewRotinaForm(prev => ({ ...prev, propagarFuturos: !prev.propagarFuturos }))}
                            >
                                <input
                                    type="checkbox"
                                    checked={newRotinaForm.propagarFuturos !== false}
                                    onChange={(e) => setNewRotinaForm({ ...newRotinaForm, propagarFuturos: e.target.checked })}
                                    style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div>
                                    <div style={{ fontSize: '0.82rem', color: '#90CAF9', fontWeight: 'bold' }}>
                                        Replicar esta rotina para os próximos meses
                                    </div>
                                    <div style={{ fontSize: '0.73rem', color: '#aaa' }}>
                                        Esta rotina permanecerá ativa e continuará disponível automaticamente nas competências futuras.
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowNewRotinaModal(false)}
                                    className="btn-secondary"
                                    style={{ padding: '0.55rem 1.2rem' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    style={{ padding: '0.55rem 1.4rem', fontWeight: 'bold' }}
                                >
                                    Cadastrar Rotina
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DE CONFIGURAÇÃO SMTP / E-MAIL */}
            {showSmtpModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
                    <div style={{ background: '#1a1f2c', border: '1px solid rgba(255, 152, 0, 0.4)', borderRadius: '12px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', paddingBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Settings size={20} style={{ color: '#FF9800' }} />
                                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem' }}>Configurações de E-mail (SMTP)</h3>
                            </div>
                            <button onClick={() => setShowSmtpModal(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '4px' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveSmtpConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* SELETOR DE MÉTODO DE ENVIO */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setSmtpConfig({ ...smtpConfig, provider: 'resend' })}
                                    style={{
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: (smtpConfig.provider || 'resend') === 'resend' ? '1px solid #4CAF50' : '1px solid rgba(255,255,255,0.1)',
                                        background: (smtpConfig.provider || 'resend') === 'resend' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(0,0,0,0.2)',
                                        color: (smtpConfig.provider || 'resend') === 'resend' ? '#81C784' : '#888',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        fontSize: '0.82rem',
                                        textAlign: 'center'
                                    }}
                                >
                                    ⚡ Resend / Vercel (Sem Senha)
                                    <div style={{ fontSize: '0.7rem', fontWeight: 'normal', marginTop: '2px' }}>Recomendado • Grátis 3.000/mês</div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSmtpConfig({ ...smtpConfig, provider: 'smtp' })}
                                    style={{
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: smtpConfig.provider === 'smtp' ? '1px solid #FF9800' : '1px solid rgba(255,255,255,0.1)',
                                        background: smtpConfig.provider === 'smtp' ? 'rgba(255, 152, 0, 0.15)' : 'rgba(0,0,0,0.2)',
                                        color: smtpConfig.provider === 'smtp' ? '#FFB74D' : '#888',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        fontSize: '0.82rem',
                                        textAlign: 'center'
                                    }}
                                >
                                    🏢 SMTP Próprio (Outlook/Gmail)
                                    <div style={{ fontSize: '0.7rem', fontWeight: 'normal', marginTop: '2px' }}>Servidor tradicional com senha</div>
                                </button>
                            </div>

                            {/* PAINEL RESEND (SEM SENHA) */}
                            {(smtpConfig.provider || 'resend') === 'resend' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', background: 'rgba(76, 175, 80, 0.05)', border: '1px solid rgba(76, 175, 80, 0.25)', borderRadius: '8px', padding: '1rem' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#ccc', lineHeight: '1.4' }}>
                                        🔒 <strong>100% Seguro:</strong> Não precisa colocar sua senha pessoal de e-mail! O <strong>Resend</strong> é o serviço padrão da Vercel. Você só cria uma conta gratuita no site <a href="https://resend.com" target="_blank" rel="noreferrer" style={{ color: '#81C784', textDecoration: 'underline' }}>resend.com</a> e cola a chave aqui:
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#fff', marginBottom: '4px', fontWeight: 'bold' }}>
                                            Chave de API do Resend (API Key):
                                        </label>
                                        <input
                                            type="password"
                                            placeholder="ex: re_123456789abcdef..."
                                            value={smtpConfig.resendApiKey || ''}
                                            onChange={(e) => setSmtpConfig({ ...smtpConfig, resendApiKey: e.target.value })}
                                            className="text-input"
                                            style={{ width: '100%', padding: '0.55rem' }}
                                        />
                                        <span style={{ fontSize: '0.72rem', color: '#888', marginTop: '3px', display: 'block' }}>
                                            Obtenha em resend.com/api-keys (gratuito até 3.000 e-mails/mês). Ou adicione RESEND_API_KEY no painel da Vercel.
                                        </span>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
                                            Nome de Exibição do Remetente (Opcional):
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="ex: SysContábil AGF"
                                            value={smtpConfig.from || ''}
                                            onChange={(e) => setSmtpConfig({ ...smtpConfig, from: e.target.value })}
                                            className="text-input"
                                            style={{ width: '100%', padding: '0.55rem' }}
                                        />
                                        <span style={{ fontSize: '0.72rem', color: '#888', marginTop: '3px', display: 'block' }}>
                                            Digite apenas o nome da empresa ou sistema (ex: <em>SysContábil AGF</em>). O sistema gerencia o endereço automaticamente.
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                /* PAINEL SMTP TRADICIONAL */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                                    <div style={{ background: 'rgba(255, 152, 0, 0.08)', border: '1px solid rgba(255, 152, 0, 0.25)', borderRadius: '8px', padding: '0.8rem', fontSize: '0.76rem', color: '#FFB74D' }}>
                                        ℹ️ Para e-mails corporativos Microsoft/Google, recomendamos criar uma <strong>Senha de Aplicativo</strong> em vez da senha principal da sua conta.
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
                                                Servidor SMTP (Host):
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="ex: smtp.office365.com ou smtp.gmail.com"
                                                value={smtpConfig.host || ''}
                                                onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                                                className="text-input"
                                                style={{ width: '100%', padding: '0.55rem' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
                                                Porta:
                                            </label>
                                            <input
                                                type="number"
                                                placeholder="587 ou 465"
                                                value={smtpConfig.port || 587}
                                                onChange={(e) => setSmtpConfig({ ...smtpConfig, port: parseInt(e.target.value) || 587 })}
                                                className="text-input"
                                                style={{ width: '100%', padding: '0.55rem' }}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
                                            Usuário / E-mail de Autenticação:
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="ex: notificacoes@agfequipamentos.com.br"
                                            value={smtpConfig.user || ''}
                                            onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                                            className="text-input"
                                            style={{ width: '100%', padding: '0.55rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
                                            Senha / Token de Aplicativo:
                                        </label>
                                        <input
                                            type="password"
                                            placeholder="••••••••••••"
                                            value={smtpConfig.pass || ''}
                                            onChange={(e) => setSmtpConfig({ ...smtpConfig, pass: e.target.value })}
                                            className="text-input"
                                            style={{ width: '100%', padding: '0.55rem' }}
                                        />
                                    </div>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: '#ccc' }}>
                                        <input
                                            type="checkbox"
                                            checked={Boolean(smtpConfig.secure)}
                                            onChange={(e) => setSmtpConfig({ ...smtpConfig, secure: e.target.checked })}
                                        />
                                        Conexão Segura SSL/TLS (marcar se porta for 465)
                                    </label>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                <button
                                    type="button"
                                    onClick={handleTestSmtp}
                                    disabled={isTestingSmtp}
                                    className="btn-secondary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
                                >
                                    <Send size={14} /> {isTestingSmtp ? 'Testando...' : 'Testar Conexão'}
                                </button>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowSmtpModal(false)}
                                        className="btn-secondary"
                                        style={{ padding: '0.55rem 1.2rem' }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-primary"
                                        style={{ padding: '0.55rem 1.4rem', fontWeight: 'bold' }}
                                    >
                                        Salvar Configuração
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DE NOTIFICAÇÃO MANUAL / DISPARO DE E-MAIL */}
            {emailModalData && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
                    <div style={{ background: '#1a1f2c', border: '1px solid rgba(33, 150, 243, 0.4)', borderRadius: '12px', width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', paddingBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Mail size={20} style={{ color: '#64B5F6' }} />
                                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem' }}>Enviar Notificação por E-mail</h3>
                            </div>
                            <button onClick={() => setEmailModalData(null)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '4px' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
                                    Destinatário (E-mail do Responsável):
                                </label>
                                <input
                                    type="email"
                                    value={emailModalData.to || ''}
                                    onChange={(e) => setEmailModalData({ ...emailModalData, to: e.target.value })}
                                    className="text-input"
                                    style={{ width: '100%', padding: '0.55rem' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
                                    Assunto:
                                </label>
                                <input
                                    type="text"
                                    value={emailModalData.subject || ''}
                                    onChange={(e) => setEmailModalData({ ...emailModalData, subject: e.target.value })}
                                    className="text-input"
                                    style={{ width: '100%', padding: '0.55rem' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '4px', fontWeight: 'bold' }}>
                                    Mensagem:
                                </label>
                                <textarea
                                    rows={6}
                                    value={emailModalData.body || ''}
                                    onChange={(e) => setEmailModalData({ ...emailModalData, body: e.target.value })}
                                    className="text-input"
                                    style={{ width: '100%', padding: '0.55rem', resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ background: 'rgba(33, 150, 243, 0.08)', border: '1px solid rgba(33, 150, 243, 0.25)', borderRadius: '6px', padding: '0.65rem 0.85rem', fontSize: '0.78rem', color: '#90CAF9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.1rem' }}>✉️</span>
                                <span>
                                    Ao clicar em <strong>Abrir no Outlook / Gmail</strong>, o e-mail será aberto diretamente no seu programa padrão com destinatário, assunto e mensagem preenchidos, registrando a cobrança no sistema.
                                </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap', gap: '10px' }}>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (emailModalData.rotina?.id) {
                                            await handleRecordEmailSent(emailModalData.rotina.id, 'manual');
                                            window.$toast('Marcado como cobrado no sistema!', { type: 'success' });
                                        }
                                        setEmailModalData(null);
                                    }}
                                    className="btn-secondary"
                                    style={{ padding: '0.6rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(76, 175, 80, 0.4)', color: '#81C784', background: 'rgba(76, 175, 80, 0.08)' }}
                                    title="Registra no card que você já cobrou o responsável (ex: por WhatsApp, Teams, ligação ou Outlook)"
                                >
                                    <Check size={14} /> Marcar como Cobrado
                                </button>

                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <button
                                        type="button"
                                        onClick={() => setEmailModalData(null)}
                                        className="btn-secondary"
                                        style={{ padding: '0.6rem 1.2rem' }}
                                    >
                                        Cancelar
                                    </button>

                                    <a
                                        href={`mailto:${emailModalData.to}?subject=${encodeURIComponent(emailModalData.subject)}&body=${encodeURIComponent(emailModalData.body)}`}
                                        onClick={async () => {
                                            if (emailModalData.rotina?.id) {
                                                await handleRecordEmailSent(emailModalData.rotina.id, 'outlook');
                                                window.$toast('Abrindo no Outlook/Gmail e registrando cobrança...', { type: 'success' });
                                            }
                                            setTimeout(() => setEmailModalData(null), 300);
                                        }}
                                        className="btn-primary"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontSize: '0.9rem',
                                            fontWeight: 'bold',
                                            textDecoration: 'none',
                                            padding: '0.6rem 1.4rem',
                                            background: '#2196F3',
                                            borderColor: '#1E88E5',
                                            color: '#fff',
                                            borderRadius: '6px',
                                            boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
                                        }}
                                        title="Abre seu Outlook ou Webmail corporativo já preenchido e registra a cobrança"
                                    >
                                        <ExternalLink size={16} /> Abrir no Outlook / Gmail
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default GestaoContabilModule;
