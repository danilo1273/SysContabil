import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Target, CheckCircle2, Clock, AlertTriangle, Plus, 
  Trash2, Edit3, ArrowLeft, Printer, Users, TrendingUp, Calendar, 
  ChevronRight, Building2, Shield, DollarSign, Search, Filter, 
  Sparkles, CheckSquare, MessageSquare, ExternalLink, RefreshCw, X, Save, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getSettings, saveSettings } from '../utils/db';

// Exportação padronizada para Excel com nome da rotina
export const exportPlanejamentoToExcel = (projetos, pilares, atas) => {
  try {
    const now = new Date();
    const dataFormatada = now.toISOString().split('T')[0];
    const filename = `Planejamento_Estrategico_Fiscal_Projetos_AGF_${dataFormatada}.xlsx`;

    const rows = (projetos || []).map(p => {
      const pilarObj = (pilares || PILARES_ESTRATEGICOS_DEFAULT).find(pil => pil.id === p.pilar);
      const statusObj = STATUS_PROJETO.find(s => s.id === p.status);
      const etapasTotal = (p.etapas || []).length;
      const etapasConcluidas = (p.etapas || []).filter(e => e.concluido).length;
      const ultimaAtualizacao = (p.timeline || [])[p.timeline?.length - 1]?.texto || '';

      return {
        'Código': p.codigo || '',
        'Título do Projeto': p.titulo || '',
        'Pilar Estratégico': pilarObj ? pilarObj.label : (p.pilar || ''),
        'Líder / Responsável': p.responsavel || '',
        'Status': statusObj ? statusObj.label : (p.status || ''),
        'Progresso (%)': `${p.progresso || 0}%`,
        'Impacto Financeiro Estimado (R$)': Number(p.impactoValor) || 0,
        'Tipo de Impacto': p.impactoTipo || '',
        'Descrição do Impacto': p.impactoDesc || '',
        'Data Limite': p.dataLimite || '',
        'Descrição do Projeto': p.descricao || '',
        'Qtd Etapas': etapasTotal,
        'Etapas Concluídas': etapasConcluidas,
        'Última Atualização Diário': ultimaAtualizacao
      };
    });

    const wsProjetos = XLSX.utils.json_to_sheet(rows);
    wsProjetos['!cols'] = [
      { wch: 10 },
      { wch: 45 },
      { wch: 30 },
      { wch: 18 },
      { wch: 22 },
      { wch: 14 },
      { wch: 25 },
      { wch: 22 },
      { wch: 40 },
      { wch: 14 },
      { wch: 50 },
      { wch: 12 },
      { wch: 16 },
      { wch: 45 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsProjetos, 'Projetos');

    if (Array.isArray(atas) && atas.length > 0) {
      const ataRows = atas.map(a => ({
        'Título da Reunião': a.titulo || '',
        'Data': a.data || '',
        'Local': a.local || '',
        'Participantes': Array.isArray(a.participantes) ? a.participantes.join(', ') : '',
        'Objetivo Master': a.objetivoMaster || '',
        'Deliberações da Diretoria': a.anotacoesMestres || ''
      }));
      const wsAtas = XLSX.utils.json_to_sheet(ataRows);
      wsAtas['!cols'] = [
        { wch: 35 },
        { wch: 12 },
        { wch: 25 },
        { wch: 30 },
        { wch: 40 },
        { wch: 60 }
      ];
      XLSX.utils.book_append_sheet(wb, wsAtas, 'Atas Diretoria');
    }

    XLSX.writeFile(wb, filename);
    window.$toast?.(`Planilha exportada com sucesso: ${filename}`, { type: 'success' });
  } catch (err) {
    console.error('Erro ao exportar Excel:', err);
    window.$toast?.('Erro ao gerar arquivo Excel.', { type: 'error' });
  }
};

// Pilares Estratégicos com cores e ícones padrão
export const PILARES_ESTRATEGICOS_DEFAULT = [
  { id: 'tributos_diretos', label: 'Redução Direta (IRPJ/CSLL/PIS)', color: '#4CAF50', bg: 'rgba(76, 175, 80, 0.15)', iconName: 'dollar' },
  { id: 'incentivos_regionais', label: 'Incentivos (SUDENE / Compete / ICMS)', color: '#FF9800', bg: 'rgba(255, 152, 0, 0.15)', iconName: 'building' },
  { id: 'holding_societario', label: 'Holding & Estruturação Societária', color: '#2196F3', bg: 'rgba(33, 150, 243, 0.15)', iconName: 'shield' },
  { id: 'inovacao_pesquisa', label: 'Inovação & Subvenções (Lei do Bem)', color: '#9C27B0', bg: 'rgba(156, 39, 176, 0.15)', iconName: 'sparkles' },
  { id: 'reforma_compliance', label: 'Reforma Tributária & Compliance (CBS/IBS)', color: '#00BCD4', bg: 'rgba(0, 188, 212, 0.15)', iconName: 'target' },
  { id: 'financeiro_funding', label: 'Financeiro, FIDIC & Securitização', color: '#E91E63', bg: 'rgba(233, 30, 99, 0.15)', iconName: 'trending' }
];

export const PILARES_ESTRATEGICOS = PILARES_ESTRATEGICOS_DEFAULT;

export const getPilarIcon = (iconName) => {
  switch (iconName) {
    case 'dollar': return DollarSign;
    case 'building': return Building2;
    case 'shield': return Shield;
    case 'sparkles': return Sparkles;
    case 'target': return Target;
    case 'trending': return TrendingUp;
    default: return Target;
  }
};

export const hexToRgba = (hex, alpha = 0.15) => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(0, 188, 212, ${alpha})`;
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16) || 0;
    const g = parseInt(cleanHex[1] + cleanHex[1], 16) || 0;
    const b = parseInt(cleanHex[2] + cleanHex[2], 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (cleanHex.length >= 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(0, 188, 212, ${alpha})`;
};

// Responsáveis & Funções Padronizadas
export const RESPONSAVEIS_DEFAULT = [
  { id: 'resp-1', nome: 'Danilo Machado', cargo: 'Diretoria Fiscal / Controladoria', assinaDocumento: true },
  { id: 'resp-2', nome: 'Alex / Jonata', cargo: 'Diretoria Executiva / Operações', assinaDocumento: true },
  { id: 'resp-3', nome: 'Mayara / Andre', cargo: 'Diretoria Administrativa / RH', assinaDocumento: true },
  { id: 'resp-4', nome: 'Danilo', cargo: 'Diretoria Fiscal / Controladoria', assinaDocumento: false },
  { id: 'resp-5', nome: 'Alex', cargo: 'Diretoria Executiva / Operações', assinaDocumento: false },
  { id: 'resp-6', nome: 'Jonata', cargo: 'Diretoria Financeira', assinaDocumento: false },
  { id: 'resp-7', nome: 'Andre', cargo: 'Diretoria Geral', assinaDocumento: false },
  { id: 'resp-8', nome: 'Mayara', cargo: 'Diretoria Administrativa / RH', assinaDocumento: false },
  { id: 'resp-9', nome: 'Ryan Santos', cargo: 'Pricing & Compliance Fiscal', assinaDocumento: false },
  { id: 'resp-11', nome: 'Jurídico', cargo: 'Assessoria Jurídica', assinaDocumento: false },
  { id: 'resp-12', nome: 'Fiscal', cargo: 'Equipe Fiscal / Tributária', assinaDocumento: false },
  { id: 'resp-13', nome: 'Diretoria', cargo: 'Diretoria Colegiada', assinaDocumento: false }
];

export const STATUS_PROJETO = [
  { id: 'ideia', label: 'Ideia / Levantamento', color: '#9E9E9E', bg: 'rgba(158, 158, 158, 0.15)' },
  { id: 'estudo', label: 'Em Estudo / Parecer', color: '#FFC107', bg: 'rgba(255, 193, 7, 0.15)' },
  { id: 'execucao', label: 'Em Execução', color: '#2196F3', bg: 'rgba(33, 150, 243, 0.15)' },
  { id: 'aguardando', label: 'Aguardando Consultoria / Terceiros', color: '#FF9800', bg: 'rgba(255, 152, 0, 0.15)' },
  { id: 'concluido', label: 'Concluído / Operando', color: '#4CAF50', bg: 'rgba(76, 175, 80, 0.15)' },
  { id: 'pausado', label: 'Pausado', color: '#F44336', bg: 'rgba(244, 67, 54, 0.15)' }
];

// Dados Iniciais extraídos das anotações reais das reuniões
const INITIAL_ATAS = [
  {
    id: 'ata-1',
    numero: '01/2026',
    titulo: 'Ata de Reunião – Planejamento Estratégico Fiscal – AGF GRUPO',
    data: '2026-04-14',
    dataRevisao: '2026-03-12',
    local: 'Sala de Diretoria - Matriz / Presencial',
    area: 'Planejamento Tributário & Diretoria Executiva',
    objetivoMaster: 'Levantar e executar projetos/ações fiscais para aumentar a lucratividade da empresa e mitigar impactos tributários futuros (CBS/IBS e Monofásico).',
    participantes: ['Andre', 'Mayara', 'Jonata', 'Danilo', 'Alex', 'Ryan'],
    anotacoesMestres: `• OBJETIVO MASTER: MELHORAR LUCRATIVIDADE (Zerar/Pagar menos IRPJ e CSLL).
• BAIXA DE INADIMPLENTES: Formalizar e auditar perdas para dedutibilidade no Lucro Real (Cálculo de impacto: 55,65 x custo = 0,125 x custo / 44,35).
• HOLDING PATRIMONIAL: Passar a AGF para dentro da holding (preparar PDF com as quotas e Balanço de 2025). Como tratar a contribuição sindical patronal? Não é obrigatória, basta fazer a oposição formal (Sinolimp).
• REFORMA TRIBUTÁRIA 2027: CONFIA (CBS e IBS) - alinhamento técnico com Ryan. Mapeamento de 25 NCMs de maior volume (entrada e saída) e capacitação de equipes em precificação (Pricing).
• CONSULTORIA TRIBUTÁRIA: Contratação do Dr. Octávio (Escritório Lacada) para estruturação SUDENE / Compete-ES / InvestE.`,
    proximaReuniao: {
      data: '2026-05-06',
      hora: '14:00',
      pauta: 'Apresentação de bancos (Itaú/Santander na Paulista), status da adesão ao PAT e parecer da consultoria sobre Compete-ES/SUDENE.'
    },
    status: 'em_andamento',
    createdAt: '2026-04-14T10:00:00Z'
  }
];

const INITIAL_PROJETOS = [
  {
    id: 'proj-1',
    ataId: 'ata-1',
    codigo: 'PEF-01',
    titulo: 'Adesão ao PAT (Programa de Alimentação do Trabalhador)',
    pilar: 'tributos_diretos',
    responsavel: 'Mayara',
    coresponsaveis: ['Danilo'],
    impactoTipo: 'economia_anual',
    impactoValor: 160000,
    impactoDesc: 'Potencial de redução de até 4% do IRPJ devido (~R$ 160k/ano) via benefício fiscal do PAT.',
    status: 'execucao',
    progresso: 65,
    dataLimite: '2026-05-31',
    descricao: 'Implantação do benefício fiscal do PAT para os colaboradores do Grupo AGF, gerando incentivo fiscal direto que deduz o IRPJ devido na apuração do Lucro Real.',
    etapas: [
      { id: 'e1', titulo: 'Cotação e seleção da operadora de cartões', concluido: true, responsavel: 'Mayara' },
      { id: 'e2', titulo: 'Inscrição formal da empresa no sistema do PAT/MTE', concluido: true, responsavel: 'Mayara' },
      { id: 'e3', titulo: 'Distribuição dos cartões e início da recarga (Maio)', concluido: true, responsavel: 'Mayara' },
      { id: 'e4', titulo: 'Parametrização contábil/fiscal para dedução do IRPJ', concluido: false, responsavel: 'Danilo' }
    ],
    timeline: [
      { id: 't1', autor: 'Mayara', data: '2026-04-14', texto: 'Contrato com a operadora de benefícios assinado. Entrega dos cartões prevista para início de Maio.' },
      { id: 't2', autor: 'Danilo', data: '2026-04-20', texto: 'Cálculo prévio do limite de dedução de 4% de IRPJ realizado com base no resultado projetado de 2026.' }
    ]
  },
  {
    id: 'proj-2',
    ataId: 'ata-1',
    codigo: 'PEF-02',
    titulo: 'Queda do PIS/COFINS Monofásico em 2027 (Operação Rompedores)',
    pilar: 'reforma_compliance',
    responsavel: 'Danilo',
    coresponsaveis: ['Alex', 'Jonata'],
    impactoTipo: 'risco_custo',
    impactoValor: 450000,
    impactoDesc: 'Prevenção de aumento brusco da alíquota com o fim do regime monofásico.',
    status: 'estudo',
    progresso: 30,
    dataLimite: '2026-11-30',
    descricao: 'Com a mudança legislativa do PIS/COFINS monofásico prevista para 2027, faz-se necessário rever todo o modelo comercial e tributário da AGF Rompedores.',
    etapas: [
      { id: 'e1', titulo: 'Contatar a consultora Daniela para parecer técnico oficial', concluido: true, responsavel: 'Danilo' },
      { id: 'e2', titulo: 'Simulação do impacto na margem líquida dos rompedores com tributação cheia', concluido: false, responsavel: 'Danilo' },
      { id: 'e3', titulo: 'Desenhar plano de contingência ou reestruturação de fornecimento', concluido: false, responsavel: 'Alex' }
    ],
    timeline: [
      { id: 't1', autor: 'Danilo', data: '2026-04-14', texto: 'Daniela acionada para elaboração do parecer com base no NCM de rompedores e peças.' }
    ]
  },
  {
    id: 'proj-3',
    ataId: 'ata-1',
    codigo: 'PEF-03',
    titulo: 'Incentivos Regionais: SUDENE, Compete-ES e InvestE',
    pilar: 'incentivos_regionais',
    responsavel: 'Danilo',
    coresponsaveis: ['Alex'],
    impactoTipo: 'economia_anual',
    impactoValor: 850000,
    impactoDesc: 'Redução de 75% no IRPJ (SUDENE) e benefício de até 1% de ICMS no Espírito Santo.',
    status: 'aguardando',
    progresso: 40,
    dataLimite: '2026-09-30',
    descricao: 'Levantamento de viabilidade de abertura de filial ou transferência operacional para regiões com incentivo fiscal: Espírito Santo (Compete-ES / InvestE) e área SUDENE (75% redução de IRPJ).',
    etapas: [
      { id: 'e1', titulo: 'Contratar escritório de consultoria tributária (Dr. Octávio - Lacada)', concluido: true, responsavel: 'Danilo' },
      { id: 'e2', titulo: 'Levantamento de CNAEs, cartões CNPJ e operações elegíveis', concluido: true, responsavel: 'Alex' },
      { id: 'e3', titulo: 'Estudo do impacto tributário de ICMS (benefício de 1%)', concluido: false, responsavel: 'Danilo' },
      { id: 'e4', titulo: 'Decisão de constituição de unidade filial incentiva', concluido: false, responsavel: 'Diretoria' }
    ],
    timeline: [
      { id: 't1', autor: 'Danilo', data: '2026-04-14', texto: 'Reunião de alinhamento com Dr. Octávio realizada. Solicitada lista de CNAEs e faturamento por UF.' }
    ]
  },
  {
    id: 'proj-4',
    ataId: 'ata-1',
    codigo: 'PEF-04',
    titulo: 'Estruturação de Holding e Integralização da AGF',
    pilar: 'holding_societario',
    responsavel: 'Alex',
    coresponsaveis: ['Danilo', 'Jonata'],
    impactoTipo: 'blindagem_eficiencia',
    impactoValor: 200000,
    impactoDesc: 'Blindagem patrimonial, segregação de ativos e redução da tributação de locações.',
    status: 'estudo',
    progresso: 25,
    dataLimite: '2026-10-31',
    descricao: 'Passar as quotas da AGF para a Holding patrimonial. Avaliar locação de ativos e máquinas através da Holding com alíquotas reduzidas de IRPJ/CSLL.',
    etapas: [
      { id: 'e1', titulo: 'Montar dossiê PDF com as quotas e Balanço Patrimonial 2025', concluido: true, responsavel: 'Danilo' },
      { id: 'e2', titulo: 'Parecer sobre contribuição sindical patronal (fazer oposição formal - Sinolimp)', concluido: true, responsavel: 'Alex' },
      { id: 'e3', titulo: 'Elaborar alteração do contrato social para transferência de quotas', concluido: false, responsavel: 'Jurídico' },
      { id: 'e4', titulo: 'Modelagem dos contratos de aluguel dos ativos pela Holding', concluido: false, responsavel: 'Alex' }
    ],
    timeline: [
      { id: 't1', autor: 'Alex', data: '2026-04-14', texto: 'Verificado que a contribuição sindical patronal não é compulsória, basta protocolar a oposição.' }
    ]
  },
  {
    id: 'proj-5',
    ataId: 'ata-1',
    codigo: 'PEF-05',
    titulo: 'Lei do Bem - Estruturação de Centros de Custo de P&D',
    pilar: 'inovacao_pesquisa',
    responsavel: 'Danilo',
    coresponsaveis: ['Andre'],
    impactoTipo: 'economia_anual',
    impactoValor: 320000,
    impactoDesc: 'Exclusão fiscal de até 80% das despesas de P&D da base de cálculo do Lucro Real.',
    status: 'estudo',
    progresso: 20,
    dataLimite: '2026-11-30',
    descricao: 'Mapear e segregar em centro de custo próprio os gastos com engenharia, projetos mecânicos e desenvolvimento de equipamentos para fruição dos benefícios da Lei do Bem (Lei 11.196/05).',
    etapas: [
      { id: 'e1', titulo: 'Criar Centros de Custo específicos para Projetos e Engenharia no Protheus', concluido: true, responsavel: 'Danilo' },
      { id: 'e2', titulo: 'Levantamento de Bolsas FAPESP e CNPq para pesquisadores em engenharia', concluido: false, responsavel: 'Andre' },
      { id: 'e3', titulo: 'Laudo técnico de inovação tecnológica dos projetos desenvolvidos', concluido: false, responsavel: 'Engenharia' },
      { id: 'e4', titulo: 'Submissão no formulário do MCTI (Novembro)', concluido: false, responsavel: 'Danilo' }
    ],
    timeline: [
      { id: 't1', autor: 'Danilo', data: '2026-04-14', texto: 'Meta de fechamento dos dossiês técnicos até Novembro para aproveitamento integral no encerramento anual.' }
    ]
  },
  {
    id: 'proj-6',
    ataId: 'ata-1',
    codigo: 'PEF-06',
    titulo: 'Reforma Tributária 2027: Dossiê de 25 NCMs e Pricing (CONFIA - CBS/IBS)',
    pilar: 'reforma_compliance',
    responsavel: 'Ryan',
    coresponsaveis: ['Danilo'],
    impactoTipo: 'compliance_estrategico',
    impactoValor: 500000,
    impactoDesc: 'Garantia de margem e precificação correta na transição do PIS/COFINS/ICMS para CBS/IBS.',
    status: 'execucao',
    progresso: 50,
    dataLimite: '2026-12-31',
    descricao: 'Preparação estratégica para a Reforma Tributária: auditoria dos 25 NCMs de maior representatividade de compras e vendas, capacitação geral e nova política de formação de preços.',
    etapas: [
      { id: 'e1', titulo: 'Extração dos 25 NCMs de maior volume (entradas e saídas)', concluido: true, responsavel: 'Ryan' },
      { id: 'e2', titulo: 'Módulo de Capacitação Geral da equipe (8 horas)', concluido: false, responsavel: 'Ryan' },
      { id: 'e3', titulo: 'Módulo de Pricing e Formação de Preços com CBS/IBS (14 horas)', concluido: false, responsavel: 'Ryan' },
      { id: 'e4', titulo: 'Alinhamento do Programa CONFIA da Receita Federal', concluido: false, responsavel: 'Danilo' }
    ],
    timeline: [
      { id: 't1', autor: 'Ryan', data: '2026-04-14', texto: 'Lista dos 25 NCMs de maior giro consolidada. Dossiê de entradas e saídas em elaboração.' }
    ]
  },
  {
    id: 'proj-7',
    ataId: 'ata-1',
    codigo: 'PEF-07',
    titulo: 'Drawback & Reintegra na Exportação (Auditoria 5 Anos)',
    pilar: 'tributos_diretos',
    responsavel: 'Danilo',
    coresponsaveis: ['Jonata'],
    impactoTipo: 'recuperacao_credito',
    impactoValor: 180000,
    impactoDesc: 'Recuperação de créditos fiscais e suspensão tributária em insumos importados.',
    status: 'estudo',
    progresso: 35,
    dataLimite: '2026-08-31',
    descricao: 'Auditoria das importações e exportações dos últimos 5 anos para aproveitamento de Drawback Integrado e apuração do crédito do Reintegra para exportadores.',
    etapas: [
      { id: 'e1', titulo: 'Levantamento dos dados de importação/exportação dos últimos 5 anos', concluido: true, responsavel: 'Danilo' },
      { id: 'e2', titulo: 'Avaliação da contratação do sistema Fazcomex para gestão de Drawback', concluido: false, responsavel: 'Danilo' },
      { id: 'e3', titulo: 'Protocolo de atos concessórios de Drawback e pedidos de Reintegra', concluido: false, responsavel: 'Fiscal' }
    ],
    timeline: [
      { id: 't1', autor: 'Danilo', data: '2026-04-14', texto: 'Iniciado levantamento dos volumes exportados e insumos importados vinculados.' }
    ]
  },
  {
    id: 'proj-8',
    ataId: 'ata-1',
    codigo: 'PEF-08',
    titulo: 'Estruturação FIDIC e Securitizadora para Vendas > 24x',
    pilar: 'financeiro_funding',
    responsavel: 'Alex',
    coresponsaveis: ['Jonata'],
    impactoTipo: 'funding_liquidez',
    impactoValor: 1200000,
    impactoDesc: 'Funding para parcelamentos longos sem travar capital de giro nem limite bancário.',
    status: 'execucao',
    progresso: 45,
    dataLimite: '2026-07-31',
    descricao: 'Criação de FIDIC ou parceria com securitizadora para viabilizar vendas de máquinas e equipamentos em prazos superiores a 24 meses.',
    etapas: [
      { id: 'e1', titulo: 'Apresentação bancos na Av. Paulista (Itaú dia 11 / Santander dia 12)', concluido: true, responsavel: 'Alex' },
      { id: 'e2', titulo: 'Reunião de apresentação no dia 6 de maio', concluido: false, responsavel: 'Alex' },
      { id: 'e3', titulo: 'Modelagem do FIDIC / Securitizadora para cessão de carteira', concluido: false, responsavel: 'Jonata' }
    ],
    timeline: [
      { id: 't1', autor: 'Alex', data: '2026-04-14', texto: 'Rodada inicial com Itaú e Santander finalizada. Próxima reunião agendada para 06/05.' }
    ]
  },
  {
    id: 'proj-9',
    ataId: 'ata-1',
    codigo: 'PEF-09',
    titulo: 'AGF Steel - Transição da Usinagem para Lucro Presumido',
    pilar: 'holding_societario',
    responsavel: 'Alex',
    coresponsaveis: ['Danilo'],
    impactoTipo: 'economia_anual',
    impactoValor: 140000,
    impactoDesc: 'Carga tributária reduzida sobre a prestação de serviços de usinagem industrial.',
    status: 'estudo',
    progresso: 25,
    dataLimite: '2026-10-31',
    descricao: 'Análise de segregação das atividades de usinagem na AGF Steel com opção pelo Lucro Presumido, reduzindo a alíquota efetiva sobre a prestação de serviços.',
    etapas: [
      { id: 'e1', titulo: 'Simulação comparativa Lucro Real vs Lucro Presumido na usinagem', concluido: true, responsavel: 'Danilo' },
      { id: 'e2', titulo: 'Análise de regras de preço de transferência e operações intercompany', concluido: false, responsavel: 'Danilo' },
      { id: 'e3', titulo: 'Planejamento de migração contábil para o exercício 2027', concluido: false, responsavel: 'Alex' }
    ],
    timeline: [
      { id: 't1', autor: 'Alex', data: '2026-04-14', texto: 'Simulação inicial mostra economia estimada de ~R$ 140k/ano mantendo margem da usinagem no presumido.' }
    ]
  },
  {
    id: 'proj-10',
    ataId: 'ata-1',
    codigo: 'PEF-10',
    titulo: 'Auditoria e Baixa de Perdas por Inadimplência (Lucro Real)',
    pilar: 'tributos_diretos',
    responsavel: 'Danilo',
    coresponsaveis: ['Fiscal'],
    impactoTipo: 'deducao_fiscal',
    impactoValor: 280000,
    impactoDesc: 'Dedutibilidade formal de créditos incobráveis da base de cálculo de IRPJ e CSLL.',
    status: 'execucao',
    progresso: 60,
    dataLimite: '2026-06-30',
    descricao: 'Aplicação do Art. 9º da Lei 9.430/96 para dedução fiscal de perdas no recebimento de créditos vencidos sem pagamento, reduzindo o IRPJ e CSLL no Lucro Real.',
    etapas: [
      { id: 'e1', titulo: 'Relatório de contas a receber vencidas há mais de 6 meses / 1 ano', concluido: true, responsavel: 'Fiscal' },
      { id: 'e2', titulo: 'Comprovação das medidas de cobrança administrativa/judicial', concluido: true, responsavel: 'Jurídico' },
      { id: 'e3', titulo: 'Lançamento da perda e estorno tributário no LALUR/LACS', concluido: false, responsavel: 'Danilo' }
    ],
    timeline: [
      { id: 't1', autor: 'Danilo', data: '2026-04-14', texto: 'Fórmula de custo versus benefício fiscal de baixa validada na reunião de diretoria.' }
    ]
  }
];

export default function PlanejamentoFiscalModule({ user, isSuperAdmin, onBackToModules }) {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'atas', 'projetos'
  const [atas, setAtas] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Filtros de Projetos
  const [filtroPilar, setFiltroPilar] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroResponsavel, setFiltroResponsavel] = useState('todos');
  const [buscaTexto, setBuscaTexto] = useState('');
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban', 'tabela'

  // Modais
  const [selectedAta, setSelectedAta] = useState(null);
  const [selectedProjeto, setSelectedProjeto] = useState(null);
  const [isAtaModalOpen, setIsAtaModalOpen] = useState(false);
  const [isProjetoModalOpen, setIsProjetoModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [newUpdateText, setNewUpdateText] = useState('');
  const [proximaReuniaoCustom, setProximaReuniaoCustom] = useState(null);
  const [isEditReuniaoModalOpen, setIsEditReuniaoModalOpen] = useState(false);
  const [pilares, setPilares] = useState(PILARES_ESTRATEGICOS_DEFAULT);
  const [isPilaresModalOpen, setIsPilaresModalOpen] = useState(false);
  const [responsaveis, setResponsaveis] = useState(RESPONSAVEIS_DEFAULT);
  const [isResponsaveisModalOpen, setIsResponsaveisModalOpen] = useState(false);

  // Carregar dados salvos ou inicializar com o padrão
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [savedAtas, savedProjetos, savedReuniao, savedPilares, savedResponsaveis] = await Promise.all([
        getSettings('agf_planejamento_atas', false),
        getSettings('agf_planejamento_projetos', false),
        getSettings('agf_planejamento_reuniao_custom', false),
        getSettings('agf_planejamento_pilares', false),
        getSettings('agf_planejamento_responsaveis', false)
      ]);

      if (Array.isArray(savedAtas) && savedAtas.length > 0) {
        setAtas(savedAtas);
      } else {
        setAtas(INITIAL_ATAS);
        await saveSettings('agf_planejamento_atas', INITIAL_ATAS);
      }

      if (Array.isArray(savedProjetos) && savedProjetos.length > 0) {
        let modifiedProj = false;
        const sanitizedProjetos = savedProjetos.map(p => {
          let pCopy = { ...p };
          if (Array.isArray(pCopy.coresponsaveis) && pCopy.coresponsaveis.some(c => /oct[aá]vio/i.test(c))) {
            pCopy.coresponsaveis = pCopy.coresponsaveis.filter(c => !/oct[aá]vio/i.test(c));
            modifiedProj = true;
          }
          if (Array.isArray(pCopy.etapas) && pCopy.etapas.some(e => /oct[aá]vio/i.test(e.responsavel || ''))) {
            pCopy.etapas = pCopy.etapas.map(e => /oct[aá]vio/i.test(e.responsavel || '') ? { ...e, responsavel: pCopy.responsavel || 'Danilo' } : e);
            modifiedProj = true;
          }
          return pCopy;
        });
        setProjetos(sanitizedProjetos);
        if (modifiedProj) {
          await saveSettings('agf_planejamento_projetos', sanitizedProjetos);
        }
      } else {
        setProjetos(INITIAL_PROJETOS);
        await saveSettings('agf_planejamento_projetos', INITIAL_PROJETOS);
      }

      if (savedReuniao && typeof savedReuniao === 'object') {
        setProximaReuniaoCustom(savedReuniao);
      }

      if (Array.isArray(savedPilares) && savedPilares.length > 0) {
        setPilares(savedPilares);
      } else {
        setPilares(PILARES_ESTRATEGICOS_DEFAULT);
        await saveSettings('agf_planejamento_pilares', PILARES_ESTRATEGICOS_DEFAULT);
      }

      if (Array.isArray(savedResponsaveis) && savedResponsaveis.length > 0) {
        let modifiedResp = false;
        const sanitizedResponsaveis = savedResponsaveis.filter(r => {
          if (/oct[aá]vio/i.test(r.nome || '')) {
            modifiedResp = true;
            return false;
          }
          return true;
        });
        setResponsaveis(sanitizedResponsaveis);
        if (modifiedResp) {
          await saveSettings('agf_planejamento_responsaveis', sanitizedResponsaveis);
        }
      } else {
        setResponsaveis(RESPONSAVEIS_DEFAULT);
        await saveSettings('agf_planejamento_responsaveis', RESPONSAVEIS_DEFAULT);
      }
    } catch (err) {
      console.error('Erro ao carregar planejamento fiscal:', err);
      setAtas(INITIAL_ATAS);
      setProjetos(INITIAL_PROJETOS);
      setPilares(PILARES_ESTRATEGICOS_DEFAULT);
      setResponsaveis(RESPONSAVEIS_DEFAULT);
    } finally {
      setIsLoading(false);
    }
  };

  const persistResponsaveis = async (newResponsaveis) => {
    setResponsaveis(newResponsaveis);
    setIsSaving(true);
    try {
      await saveSettings('agf_planejamento_responsaveis', newResponsaveis);
    } catch (err) {
      console.error('Erro ao salvar responsáveis:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const persistPilares = async (newPilares) => {
    setPilares(newPilares);
    setIsSaving(true);
    try {
      await saveSettings('agf_planejamento_pilares', newPilares);
    } catch (err) {
      console.error('Erro ao salvar pilares:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const persistAtas = async (newAtas) => {
    setAtas(newAtas);
    setIsSaving(true);
    try {
      await saveSettings('agf_planejamento_atas', newAtas);
    } catch (err) {
      console.error('Erro ao salvar atas:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const persistProjetos = async (newProjetos) => {
    setProjetos(newProjetos);
    setIsSaving(true);
    try {
      await saveSettings('agf_planejamento_projetos', newProjetos);
    } catch (err) {
      console.error('Erro ao salvar projetos:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const persistProximaReuniao = async (dados) => {
    setProximaReuniaoCustom(dados);
    setIsSaving(true);
    try {
      await saveSettings('agf_planejamento_reuniao_custom', dados);
    } catch (err) {
      console.error('Erro ao salvar próxima reunião:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Próxima Reunião exibida no Dashboard
  const proximaReuniaoExibida = useMemo(() => {
    if (proximaReuniaoCustom && proximaReuniaoCustom.data) return proximaReuniaoCustom;
    const ataComReuniao = atas.find(a => a.proximaReuniao?.data);
    if (ataComReuniao?.proximaReuniao) {
      return {
        data: ataComReuniao.proximaReuniao.data,
        hora: ataComReuniao.proximaReuniao.hora || '14:00h',
        pauta: ataComReuniao.proximaReuniao.pauta || 'Apresentação bancos (Itaú e Santander na Paulista para FIDIC/Securitizadora), status de entrega dos cartões PAT e retorno do parecer tributário sobre Compete-ES/SUDENE.',
        participantes: Array.isArray(ataComReuniao.participantes) ? ataComReuniao.participantes.join(', ') : 'Danilo, Mayara, Alex, Jonata, Andre',
        reuniaoSeguinte: '12/06/2026'
      };
    }
    return {
      data: '06/05/2026',
      hora: '14:00h',
      pauta: 'Apresentação bancos (Itaú e Santander na Paulista para FIDIC/Securitizadora), status de entrega dos cartões PAT e retorno do parecer tributário sobre Compete-ES/SUDENE.',
      participantes: 'Danilo, Mayara, Alex, Jonata, Andre',
      reuniaoSeguinte: '12/06/2026'
    };
  }, [proximaReuniaoCustom, atas]);

  // KPIs
  const kpis = useMemo(() => {
    const totalProjetos = projetos.length;
    const emExecucao = projetos.filter(p => p.status === 'execucucao' || p.status === 'execucao').length;
    const concluidos = projetos.filter(p => p.status === 'concluido').length;
    const emEstudo = projetos.filter(p => p.status === 'estudo').length;
    const economiaTotal = projetos.reduce((acc, p) => acc + (Number(p.impactoValor) || 0), 0);
    const mediaProgresso = totalProjetos > 0 ? Math.round(projetos.reduce((acc, p) => acc + (Number(p.progresso) || 0), 0) / totalProjetos) : 0;

    return { totalProjetos, emExecucao, concluidos, emEstudo, economiaTotal, mediaProgresso };
  }, [projetos]);

  // Lista de Responsáveis únicos (mesclando cadastrados e líderes nos projetos)
  const responsaveisList = useMemo(() => {
    const set = new Set();
    (responsaveis || []).forEach(r => {
      if (r.nome) set.add(r.nome);
    });
    projetos.forEach(p => {
      if (p.responsavel) set.add(p.responsavel);
    });
    return Array.from(set).sort();
  }, [responsaveis, projetos]);

  // Projetos filtrados
  const filteredProjetos = useMemo(() => {
    return projetos.filter(p => {
      if (filtroPilar !== 'todos' && p.pilar !== filtroPilar) return false;
      if (filtroStatus !== 'todos' && p.status !== filtroStatus) return false;
      if (filtroResponsavel !== 'todos' && p.responsavel !== filtroResponsavel) return false;
      if (buscaTexto.trim()) {
        const text = buscaTexto.toLowerCase();
        const matchTitle = (p.titulo || '').toLowerCase().includes(text);
        const matchCode = (p.codigo || '').toLowerCase().includes(text);
        const matchDesc = (p.descricao || '').toLowerCase().includes(text);
        const matchResp = (p.responsavel || '').toLowerCase().includes(text);
        if (!matchTitle && !matchCode && !matchDesc && !matchResp) return false;
      }
      return true;
    });
  }, [projetos, filtroPilar, filtroStatus, filtroResponsavel, buscaTexto]);

  // Salvar ou Editar Ata
  const handleSaveAta = (ataData) => {
    let updated;
    if (ataData.id && atas.some(a => a.id === ataData.id)) {
      updated = atas.map(a => a.id === ataData.id ? ataData : a);
    } else {
      const newAta = {
        ...ataData,
        id: `ata-${Date.now()}`,
        numero: `${(atas.length + 1).toString().padStart(2, '0')}/${new Date().getFullYear()}`,
        createdAt: new Date().toISOString()
      };
      updated = [newAta, ...atas];
    }
    persistAtas(updated);
    setIsAtaModalOpen(false);
    setSelectedAta(null);
    window.$toast?.('Ata de Reunião salva com sucesso!', { type: 'success' });
  };

  // Excluir Ata
  const handleDeleteAta = (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta Ata de Reunião?')) return;
    const updated = atas.filter(a => a.id !== id);
    persistAtas(updated);
    if (selectedAta?.id === id) setSelectedAta(null);
    window.$toast?.('Ata excluída com sucesso.', { type: 'info' });
  };

  // Salvar ou Editar Projeto
  const handleSaveProjeto = (projData) => {
    let updated;
    if (projData.id && projetos.some(p => p.id === projData.id)) {
      updated = projetos.map(p => p.id === projData.id ? projData : p);
    } else {
      const nextNum = projetos.length + 1;
      const newProj = {
        ...projData,
        id: `proj-${Date.now()}`,
        codigo: `PEF-${nextNum.toString().padStart(2, '0')}`,
        progresso: projData.progresso || 0,
        etapas: projData.etapas || [],
        timeline: projData.timeline || [{
          id: `t-${Date.now()}`,
          autor: user?.username || 'Diretoria',
          data: new Date().toISOString().split('T')[0],
          texto: 'Projeto criado e inserido no pipeline estratégico fiscal.'
        }]
      };
      updated = [newProj, ...projetos];
    }
    persistProjetos(updated);
    setIsProjetoModalOpen(false);
    setSelectedProjeto(null);
    window.$toast?.('Projeto estratégico salvo com sucesso!', { type: 'success' });
  };

  // Excluir Projeto
  const handleDeleteProjeto = (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este projeto?')) return;
    const updated = projetos.filter(p => p.id !== id);
    persistProjetos(updated);
    if (selectedProjeto?.id === id) setSelectedProjeto(null);
    window.$toast?.('Projeto excluído.', { type: 'info' });
  };

  // Alternar checkbox de etapa do projeto
  const handleToggleEtapa = (projId, etapaId) => {
    const proj = projetos.find(p => p.id === projId);
    if (!proj) return;
    const newEtapas = (proj.etapas || []).map(e => e.id === etapaId ? { ...e, concluido: !e.concluido } : e);
    const total = newEtapas.length;
    const conc = newEtapas.filter(e => e.concluido).length;
    const prog = total > 0 ? Math.round((conc / total) * 100) : proj.progresso;
    const newStatus = prog === 100 ? 'concluido' : (proj.status === 'concluido' ? 'execucao' : proj.status);

    const updatedProj = { ...proj, etapas: newEtapas, progresso: prog, status: newStatus };
    const updated = projetos.map(p => p.id === projId ? updatedProj : p);
    persistProjetos(updated);
    if (selectedProjeto?.id === projId) setSelectedProjeto(updatedProj);
  };

  // Adicionar atualização ao Diário de Bordo do Projeto
  const handleAddTimelineUpdate = (projId, entryOrText) => {
    const proj = projetos.find(p => p.id === projId);
    if (!proj) return;
    let newEntry;
    if (typeof entryOrText === 'object' && entryOrText !== null && entryOrText.texto) {
      newEntry = entryOrText;
    } else {
      const text = (typeof entryOrText === 'string' ? entryOrText : newUpdateText).trim();
      if (!text) return;
      newEntry = {
        id: `t-${Date.now()}`,
        autor: user?.username || 'Diretoria',
        data: new Date().toISOString().split('T')[0],
        texto: text
      };
    }
    const updatedProj = { ...proj, timeline: [newEntry, ...(proj.timeline || [])] };
    const updated = projetos.map(p => p.id === projId ? updatedProj : p);
    persistProjetos(updated);
    if (selectedProjeto?.id === projId) setSelectedProjeto(updatedProj);
    setNewUpdateText('');
    window.$toast?.('Atualização registrada no projeto!', { type: 'success' });
    return newEntry;
  };

  // Criar Projeto a partir de uma Ata
  const handleCreateProjetoFromAta = (ata) => {
    setSelectedProjeto({
      ataId: ata.id,
      titulo: '',
      pilar: 'tributos_diretos',
      responsavel: user?.username || 'Danilo',
      coresponsaveis: [],
      impactoTipo: 'economia_anual',
      impactoValor: 0,
      impactoDesc: '',
      status: 'estudo',
      progresso: 10,
      dataLimite: '',
      descricao: `Projeto derivado da ${ata.titulo} (Data: ${ata.data}).`,
      etapas: [
        { id: `e-${Date.now()}`, titulo: 'Elaborar levantamento inicial e parecer de viabilidade', concluido: false, responsavel: user?.username || 'Danilo' }
      ]
    });
    setIsProjetoModalOpen(true);
  };

  // Formatação em R$
  const formatMoney = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  return (
    <div className="planejamento-module-root" style={{ padding: '1.5rem', color: '#fff', minHeight: '85vh' }}>
      
      {/* WRAPPER PRINCIPAL DA INTERFACE (OCULTO EM IMPRESSÃO QUANDO O MODAL DE RELATÓRIO ESTÁ ABERTO) */}
      <div className={`planejamento-main-interface ${isPrintModalOpen ? 'print-hide' : ''}`}>

      {/* HEADER SUPERIOR EXECUTIVO */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, rgba(20, 24, 33, 0.95) 0%, rgba(13, 17, 23, 0.9) 100%)',
        border: '1px solid rgba(0, 188, 212, 0.25)',
        borderRadius: '16px',
        padding: '1.5rem 2rem',
        marginBottom: '1.5rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(12px)',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #00BCD4 0%, #00796B 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(0, 188, 212, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <Target size={30} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800', letterSpacing: '-0.5px', background: 'linear-gradient(90deg, #fff 0%, #b2ebf2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                AGF GROUP - Planejamento Estratégico Fiscal
              </h1>
              <span style={{
                background: 'rgba(0, 188, 212, 0.15)',
                color: '#80deea',
                border: '1px solid rgba(0, 188, 212, 0.3)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 'bold',
                letterSpacing: '0.5px'
              }}>
                DIRETORIA & GOVERNANÇA
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', color: '#90a4ae', fontSize: '0.88rem' }}>
              Atas de Reunião da Diretoria, Pipeline de Projetos Tributários e Ações de Lucratividade.
            </p>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO RÁPIDA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setSelectedAta(null); setIsAtaModalOpen(true); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.55rem 1.1rem',
              background: 'rgba(33, 150, 243, 0.15)',
              border: '1px solid rgba(33, 150, 243, 0.4)',
              color: '#64B5F6',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.85rem',
              transition: 'all 0.2s'
            }}
          >
            <Plus size={16} /> Nova Ata de Reunião
          </button>

          <button
            onClick={() => { setSelectedProjeto(null); setIsProjetoModalOpen(true); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.55rem 1.1rem',
              background: 'linear-gradient(135deg, #00BCD4 0%, #0097A7 100%)',
              border: 'none',
              color: '#fff',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              boxShadow: '0 4px 14px rgba(0, 188, 212, 0.35)',
              transition: 'all 0.2s'
            }}
          >
            <Plus size={16} /> Novo Projeto
          </button>

          <button
            onClick={() => exportPlanejamentoToExcel(projetos, pilares, atas)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.55rem 0.9rem',
              background: 'rgba(76, 175, 80, 0.15)',
              border: '1px solid rgba(76, 175, 80, 0.4)',
              color: '#81C784',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '0.85rem'
            }}
            title="Exportar dados para Excel (.xlsx) com o nome oficial da rotina"
          >
            <Download size={16} /> Exportar Excel
          </button>

          <button
            onClick={() => setIsPrintModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.55rem 0.9rem',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '0.85rem'
            }}
            title="Visualizar e Imprimir Relatório Executivo"
          >
            <Printer size={16} /> Imprimir Relatório
          </button>

          <button
            onClick={onBackToModules}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.55rem 0.9rem',
              background: 'rgba(244, 67, 54, 0.12)',
              border: '1px solid rgba(244, 67, 54, 0.35)',
              color: '#EF5350',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '0.85rem'
            }}
          >
            <ArrowLeft size={16} /> Módulos
          </button>
        </div>
      </div>

      {/* TABS DE NAVEGAÇÃO INTERNA */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: '1.5rem',
        paddingBottom: '0.2rem'
      }}>
        {[
          { id: 'dashboard', label: '📊 Painel Executivo', count: null },
          { id: 'atas', label: '📝 Atas de Reunião', count: atas.length },
          { id: 'projetos', label: '🚀 Projetos', count: projetos.length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.65rem 1.4rem',
              background: activeTab === tab.id ? 'rgba(0, 188, 212, 0.15)' : 'transparent',
              color: activeTab === tab.id ? '#80deea' : '#aaa',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #00BCD4' : '2px solid transparent',
              borderRadius: '6px 6px 0 0',
              fontSize: '0.92rem',
              fontWeight: activeTab === tab.id ? '700' : '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span style={{
                background: activeTab === tab.id ? '#00BCD4' : 'rgba(255,255,255,0.1)',
                color: activeTab === tab.id ? '#000' : '#ccc',
                padding: '1px 6px',
                borderRadius: '10px',
                fontSize: '0.72rem',
                fontWeight: 'bold'
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}

        {isSaving && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', color: '#80deea', fontSize: '0.8rem' }}>
            <RefreshCw size={14} className="spin" /> Salvando na nuvem...
          </div>
        )}
      </div>

      {/* CONTEÚDO DA TAB 1: PAINEL EXECUTIVO */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* CARDS DE KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            
            <div style={{ background: 'rgba(20, 24, 33, 0.8)', border: '1px solid rgba(0, 188, 212, 0.2)', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#90a4ae', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                <span>POTENCIAL DE GANHO / ANO</span>
                <DollarSign size={18} color="#4CAF50" />
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: '800', color: '#4CAF50' }}>
                {formatMoney(kpis.economiaTotal)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#81C784', marginTop: '4px' }}>
                Economia fiscal e financeira anual mapeada
              </div>
            </div>

            <div style={{ background: 'rgba(20, 24, 33, 0.8)', border: '1px solid rgba(33, 150, 243, 0.2)', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#90a4ae', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                <span>PROJETOS ESTRATÉGICOS</span>
                <Target size={18} color="#64B5F6" />
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: '800', color: '#fff' }}>
                {kpis.totalProjetos}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#90a4ae', marginTop: '4px' }}>
                {kpis.emExecucao} em execução • {kpis.emEstudo} em estudo
              </div>
            </div>

            <div style={{ background: 'rgba(20, 24, 33, 0.8)', border: '1px solid rgba(255, 193, 7, 0.2)', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#90a4ae', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                <span>ANDAMENTO MÉDIO</span>
                <TrendingUp size={18} color="#FFD54F" />
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: '800', color: '#FFD54F' }}>
                {kpis.mediaProgresso}%
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                <div style={{ width: `${kpis.mediaProgresso}%`, height: '100%', background: '#FFD54F', borderRadius: '3px' }} />
              </div>
            </div>

            <div style={{ background: 'rgba(20, 24, 33, 0.8)', border: '1px solid rgba(156, 39, 176, 0.2)', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#90a4ae', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                <span>ATAS DA DIRETORIA</span>
                <FileText size={18} color="#BA68C8" />
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: '800', color: '#fff' }}>
                {atas.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#CE93D8', marginTop: '4px' }}>
                Reuniões documentadas com deliberações
              </div>
            </div>

          </div>

          {/* CARD DE DESTAQUE: PRÓXIMA REUNIÃO AGENDADA & MARCOS CRÍTICOS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            
            {/* PRÓXIMA REUNIÃO */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(20, 30, 45, 0.85) 0%, rgba(13, 20, 30, 0.8) 100%)',
              border: '1px solid rgba(0, 188, 212, 0.35)',
              borderRadius: '14px',
              padding: '1.5rem',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#80deea', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  <Calendar size={18} /> PRÓXIMA REUNIÃO DE DIRETORIA FISCAL
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditReuniaoModalOpen(true)}
                  style={{
                    background: 'rgba(0, 188, 212, 0.15)',
                    border: '1px solid rgba(0, 188, 212, 0.4)',
                    color: '#80deea',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontWeight: 'bold',
                    transition: 'all 0.2s'
                  }}
                  title="Editar dados da reunião"
                >
                  <Edit3 size={13} /> Editar Agendamento
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: '800', color: '#fff' }}>{proximaReuniaoExibida.data}</span>
                {proximaReuniaoExibida.hora && (
                  <span style={{ fontSize: '1.1rem', color: '#80deea', fontWeight: 'bold' }}>
                    {proximaReuniaoExibida.hora.startsWith('às') ? proximaReuniaoExibida.hora : `às ${proximaReuniaoExibida.hora}`}
                  </span>
                )}
              </div>
              <p style={{ color: '#b0bec5', fontSize: '0.88rem', margin: '0 0 1rem 0', lineHeight: '1.5' }}>
                <strong>Pauta prevista:</strong> {proximaReuniaoExibida.pauta}
              </p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                {proximaReuniaoExibida.participantes && (
                  <span style={{ background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', color: '#cfd8dc' }}>
                    👥 {proximaReuniaoExibida.participantes}
                  </span>
                )}
                {proximaReuniaoExibida.reuniaoSeguinte && (
                  <span style={{ background: 'rgba(76, 175, 80, 0.15)', color: '#81C784', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    Reunião Seguinte: {proximaReuniaoExibida.reuniaoSeguinte}
                  </span>
                )}
              </div>
            </div>

            {/* MARCOS CRÍTICOS / RADAR FISCAL */}
            <div style={{
              background: 'rgba(20, 24, 33, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFB74D', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '1rem' }}>
                <AlertTriangle size={18} /> RADAR DE PRAZOS & MARCOS CRÍTICOS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.85rem' }}>
                  <span style={{ background: 'rgba(76, 175, 80, 0.2)', color: '#81C784', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>Maio/2026</span>
                  <span style={{ color: '#ccc' }}><strong>Implantação Cartão PAT:</strong> Início do benefício fiscal direto de 4% de dedução no IRPJ.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.85rem' }}>
                  <span style={{ background: 'rgba(156, 39, 176, 0.2)', color: '#CE93D8', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>Novembro</span>
                  <span style={{ color: '#ccc' }}><strong>Lei do Bem (MCTI):</strong> Estruturação dos centros de custo de engenharia e P&D para dedução fiscal.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.85rem' }}>
                  <span style={{ background: 'rgba(244, 67, 54, 0.2)', color: '#EF5350', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>2027</span>
                  <span style={{ color: '#ccc' }}><strong>PIS/COFINS Rompedores:</strong> Fim do regime monofásico e transição do modelo operacional.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.85rem' }}>
                  <span style={{ background: 'rgba(0, 188, 212, 0.2)', color: '#80deea', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>Reforma 2027</span>
                  <span style={{ color: '#ccc' }}><strong>CONFIA (CBS e IBS):</strong> Dossiê dos 25 NCMs de maior giro e treinamento de Pricing.</span>
                </div>
              </div>
            </div>

          </div>

          {/* VISÃO POR PILARES E RESPONSÁVEIS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
            
            {/* DISTRIBUIÇÃO POR PILAR */}
            <div style={{ background: 'rgba(20, 24, 33, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '14px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', fontWeight: '700' }}>
                  Projetos por Pilar Estratégico
                </h3>
                <button
                  type="button"
                  onClick={() => setIsPilaresModalOpen(true)}
                  style={{
                    background: 'rgba(0, 188, 212, 0.1)',
                    border: '1px solid rgba(0, 188, 212, 0.3)',
                    color: '#80deea',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: '600'
                  }}
                  title="Gerenciar ou incluir novos pilares"
                >
                  <Sparkles size={12} /> Gerenciar Pilares
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {pilares.map(pilar => {
                  const pList = projetos.filter(p => p.pilar === pilar.id);
                  const pSum = pList.reduce((acc, p) => acc + (Number(p.impactoValor) || 0), 0);
                  const Icon = getPilarIcon(pilar.iconName);
                  return (
                    <div 
                      key={pilar.id} 
                      onClick={() => { setFiltroPilar(pilar.id); setActiveTab('projetos'); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        borderLeft: `4px solid ${pilar.color}`
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Icon size={16} color={pilar.color} />
                        <div>
                          <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600' }}>{pilar.label}</div>
                          <div style={{ color: '#888', fontSize: '0.75rem' }}>{pList.length} projeto(s)</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: pilar.color, fontWeight: 'bold', fontSize: '0.85rem' }}>{formatMoney(pSum)}</div>
                        <div style={{ color: '#666', fontSize: '0.7rem' }}>impacto anual</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AÇÕES POR RESPONSÁVEL */}
            <div style={{ background: 'rgba(20, 24, 33, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '14px', padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#fff', fontWeight: '700' }}>
                Líderes de Projeto & Ações
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {responsaveisList.map(resp => {
                  const respProjs = projetos.filter(p => p.responsavel === resp);
                  const concl = respProjs.filter(p => p.status === 'concluido').length;
                  return (
                    <div 
                      key={resp}
                      onClick={() => { setFiltroResponsavel(resp); setActiveTab('projetos'); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#00BCD4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#000', fontSize: '0.8rem' }}>
                          {resp.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ color: '#fff', fontSize: '0.88rem', fontWeight: '600' }}>{resp}</div>
                          <div style={{ color: '#888', fontSize: '0.75rem' }}>{respProjs.length} projetos atribuídos</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: 'rgba(33, 150, 243, 0.15)', color: '#64B5F6', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {concl}/{respProjs.length} concluídos
                        </span>
                        <ChevronRight size={16} color="#666" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* CONTEÚDO DA TAB 2: ATAS DE REUNIÃO */}
      {activeTab === 'atas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#fff', fontWeight: '700' }}>
                Registro Oficial de Atas de Reunião
              </h2>
              <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '0.85rem' }}>
                Histórico de alinhamentos da diretoria e pautas fiscais que originam os projetos.
              </p>
            </div>
            <button
              onClick={() => { setSelectedAta(null); setIsAtaModalOpen(true); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.55rem 1.1rem',
                background: '#00BCD4',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              <Plus size={16} /> Nova Ata
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {atas.map(ata => {
              const ataProjetos = projetos.filter(p => p.ataId === ata.id);
              return (
                <div
                  key={ata.id}
                  style={{
                    background: 'rgba(20, 24, 33, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '14px',
                    padding: '1.5rem',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ background: '#00BCD4', color: '#000', fontWeight: 'bold', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px' }}>
                          ATA {ata.numero}
                        </span>
                        <span style={{ color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={14} /> Data: <strong style={{ color: '#fff' }}>{ata.data}</strong>
                          {ata.dataRevisao && ` (Revisão da reunião de ${ata.dataRevisao})`}
                        </span>
                        <span style={{ color: '#888', fontSize: '0.85rem' }}>• Local: {ata.local}</span>
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#fff', fontWeight: '700' }}>
                        {ata.titulo}
                      </h3>
                      <div style={{ color: '#80deea', fontSize: '0.85rem', marginTop: '4px' }}>
                        🎯 <strong>Objetivo Master:</strong> {ata.objetivoMaster}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleCreateProjetoFromAta(ata)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '0.45rem 0.85rem',
                          background: 'rgba(76, 175, 80, 0.15)',
                          border: '1px solid rgba(76, 175, 80, 0.4)',
                          color: '#81C784',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 'bold'
                        }}
                        title="Criar um projeto estratégico formal a partir desta ata"
                      >
                        <Plus size={14} /> Gerar Projeto
                      </button>

                      <button
                        onClick={() => { setSelectedAta(ata); setIsAtaModalOpen(true); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '0.45rem 0.75rem',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: '#fff',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        <Edit3 size={14} /> Editar
                      </button>

                      <button
                        onClick={() => handleDeleteAta(ata.id)}
                        style={{
                          padding: '0.45rem 0.65rem',
                          background: 'rgba(244, 67, 54, 0.1)',
                          border: '1px solid rgba(244, 67, 54, 0.3)',
                          color: '#EF5350',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                        title="Excluir Ata"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* PARTICIPANTES */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={14} /> Participantes:
                    </span>
                    {(ata.participantes || []).map(p => (
                      <span key={p} style={{ background: 'rgba(255,255,255,0.06)', color: '#cfd8dc', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '500' }}>
                        {p}
                      </span>
                    ))}
                  </div>

                  {/* ANOTAÇÕES MESTRES & DELIBERAÇÕES */}
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1rem',
                    fontSize: '0.88rem',
                    color: '#ccc',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {ata.anotacoesMestres}
                  </div>

                  {/* PROJETOS VINCULADOS A ESTA ATA */}
                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.85rem' }}>
                    <div style={{ fontSize: '0.82rem', color: '#80deea', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                      PROJETOS FISCAIS ORIGINADOS DESTA REUNIÃO ({ataProjetos.length}):
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {ataProjetos.map(proj => {
                        const statusObj = STATUS_PROJETO.find(s => s.id === proj.status) || STATUS_PROJETO[0];
                        return (
                          <div
                            key={proj.id}
                            onClick={() => { setSelectedProjeto(proj); setIsProjetoModalOpen(true); }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '0.4rem 0.75rem',
                              background: 'rgba(255,255,255,0.04)',
                              border: `1px solid ${statusObj.color}40`,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                          >
                            <span style={{ fontWeight: 'bold', color: statusObj.color }}>{proj.codigo}</span>
                            <span style={{ color: '#fff' }}>{proj.titulo}</span>
                            <span style={{ color: '#888' }}>({proj.responsavel})</span>
                            <span style={{ background: statusObj.bg, color: statusObj.color, padding: '1px 5px', borderRadius: '4px', fontSize: '0.7rem' }}>
                              {proj.progresso}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* PRÓXIMA REUNIÃO */}
                  {ata.proximaReuniao && ata.proximaReuniao.data && (
                    <div style={{ marginTop: '0.85rem', fontSize: '0.8rem', color: '#90a4ae', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} color="#00BCD4" /> Próximo Encontro Agendado: <strong style={{ color: '#80deea' }}>{ata.proximaReuniao.data} às {ata.proximaReuniao.hora}</strong>
                    </div>
                  )}

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* CONTEÚDO DA TAB 3: PROJETOS & PIPELINE */}
      {activeTab === 'projetos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          {/* BARRA DE FILTROS & CONTROLES */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(20, 24, 33, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '1rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
              
              {/* BUSCA DE TEXTO */}
              <div style={{ position: 'relative', minWidth: '220px' }}>
                <Search size={16} color="#888" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                <input
                  type="text"
                  placeholder="Buscar projeto, código ou responsável..."
                  value={buscaTexto}
                  onChange={e => setBuscaTexto(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.5rem 0.5rem 2rem',
                    background: '#13161c',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              {/* FILTRO DE PILAR */}
              <select
                value={filtroPilar}
                onChange={e => setFiltroPilar(e.target.value)}
                style={{
                  padding: '0.5rem',
                  background: '#13161c',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.85rem'
                }}
              >
                <option value="todos">Todos os Pilares Estratégicos</option>
                {pilares.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>

              {/* FILTRO DE RESPONSÁVEL */}
              <select
                value={filtroResponsavel}
                onChange={e => setFiltroResponsavel(e.target.value)}
                style={{
                  padding: '0.5rem',
                  background: '#13161c',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.85rem'
                }}
              >
                <option value="todos">Todos os Responsáveis</option>
                {responsaveisList.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              {/* FILTRO DE STATUS */}
              <select
                value={filtroStatus}
                onChange={e => setFiltroStatus(e.target.value)}
                style={{
                  padding: '0.5rem',
                  background: '#13161c',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.85rem'
                }}
              >
                <option value="todos">Todos os Status</option>
                {STATUS_PROJETO.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>

              {/* BOTAO GERENCIAR PILARES */}
              <button
                type="button"
                onClick={() => setIsPilaresModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.5rem 0.85rem',
                  background: 'rgba(0, 188, 212, 0.12)',
                  border: '1px solid rgba(0, 188, 212, 0.35)',
                  color: '#80deea',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                title="Personalizar, editar ou incluir novos Pilares Estratégicos"
              >
                <Sparkles size={14} /> Pilares Estratégicos
              </button>

              {/* BOTAO GERENCIAR RESPONSAVEIS & FUNCOES */}
              <button
                type="button"
                onClick={() => setIsResponsaveisModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.5rem 0.85rem',
                  background: 'rgba(76, 175, 80, 0.12)',
                  border: '1px solid rgba(76, 175, 80, 0.35)',
                  color: '#81C784',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                title="Cadastrar, padronizar responsáveis e funções da diretoria"
              >
                <Users size={14} /> Responsáveis & Funções
              </button>

            </div>

            {/* TOGGLE VISÃO KANBAN / TABELA */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#13161c', padding: '3px', borderRadius: '8px', border: '1px solid #333' }}>
              <button
                onClick={() => setViewMode('kanban')}
                style={{
                  padding: '0.4rem 0.8rem',
                  background: viewMode === 'kanban' ? '#00BCD4' : 'transparent',
                  color: viewMode === 'kanban' ? '#000' : '#aaa',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Kanban
              </button>
              <button
                onClick={() => setViewMode('tabela')}
                style={{
                  padding: '0.4rem 0.8rem',
                  background: viewMode === 'tabela' ? '#00BCD4' : 'transparent',
                  color: viewMode === 'tabela' ? '#000' : '#aaa',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Tabela
              </button>
            </div>

          </div>

          {/* VISÃO 1: KANBAN POR STATUS */}
          {viewMode === 'kanban' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
              alignItems: 'flex-start'
            }}>
              {STATUS_PROJETO.map(col => {
                const colProjects = filteredProjetos.filter(p => p.status === col.id);
                return (
                  <div
                    key={col.id}
                    style={{
                      background: 'rgba(18, 22, 30, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '1rem',
                      minHeight: '400px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem'
                    }}
                  >
                    {/* CABEÇALHO DA COLUNA KANBAN */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: `2px solid ${col.color}`,
                      paddingBottom: '0.5rem'
                    }}>
                      <div style={{ fontWeight: 'bold', fontSize: '0.88rem', color: col.color }}>
                        {col.label}
                      </div>
                      <span style={{ background: col.bg, color: col.color, padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {colProjects.length}
                      </span>
                    </div>

                    {/* CARDS DOS PROJETOS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {colProjects.map(proj => {
                        const pilarObj = pilares.find(p => p.id === proj.pilar) || pilares[0] || { label: proj.pilar || 'Geral', color: '#00BCD4', bg: 'rgba(0, 188, 212, 0.15)' };
                        const totalEtapas = (proj.etapas || []).length;
                        const concEtapas = (proj.etapas || []).filter(e => e.concluido).length;

                        return (
                          <div
                            key={proj.id}
                            onClick={() => { setSelectedProjeto(proj); setIsProjetoModalOpen(true); }}
                            style={{
                              background: 'rgba(25, 30, 42, 0.95)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '10px',
                              padding: '1rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = '#00BCD4';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#00BCD4' }}>{proj.codigo}</span>
                              <span style={{ fontSize: '0.7rem', color: pilarObj.color, background: pilarObj.bg, padding: '1px 6px', borderRadius: '4px', fontWeight: '600' }}>
                                {pilarObj.label.split('(')[0]}
                              </span>
                            </div>

                            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.92rem', color: '#fff', fontWeight: '600', lineHeight: '1.4' }}>
                              {proj.titulo}
                            </h4>

                            {proj.impactoValor > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#81C784', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.6rem' }}>
                                <DollarSign size={14} /> {formatMoney(proj.impactoValor)}/ano
                              </div>
                            )}

                            {/* BARRA DE PROGRESSO */}
                            <div style={{ marginBottom: '0.6rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#aaa', marginBottom: '3px' }}>
                                <span>Progresso</span>
                                <span style={{ fontWeight: 'bold', color: '#fff' }}>{proj.progresso}%</span>
                              </div>
                              <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${proj.progresso}%`, height: '100%', background: col.color, borderRadius: '3px' }} />
                              </div>
                            </div>

                            {/* FOOTER DO CARD */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.5rem', fontSize: '0.75rem', color: '#888' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#00BCD4', color: '#000', fontSize: '0.65rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {(proj.responsavel || 'A').slice(0, 1).toUpperCase()}
                                </div>
                                <span>{proj.responsavel}</span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {totalEtapas > 0 && (
                                  <span style={{ color: concEtapas === totalEtapas ? '#4CAF50' : '#aaa' }}>
                                    ✓ {concEtapas}/{totalEtapas}
                                  </span>
                                )}
                                {proj.dataLimite && (
                                  <span>📅 {proj.dataLimite.split('-').slice(1).join('/')}</span>
                                )}
                              </div>
                            </div>

                          </div>
                        );
                      })}

                      {colProjects.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#555', fontSize: '0.8rem' }}>
                          Nenhum projeto neste status
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VISÃO 2: TABELA ANALÍTICA */}
          {viewMode === 'tabela' && (
            <div style={{ background: 'rgba(20, 24, 33, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0, 188, 212, 0.1)', borderBottom: '1px solid rgba(0, 188, 212, 0.25)', textAlign: 'left', color: '#80deea' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Código</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Projeto / Objetivo</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Pilar Estratégico</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Líder</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Impacto Financeiro</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Progresso</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Prazo</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjetos.map((proj, idx) => {
                      const pilarObj = pilares.find(p => p.id === proj.pilar) || pilares[0] || { label: proj.pilar || 'Geral', color: '#00BCD4', bg: 'rgba(0, 188, 212, 0.15)' };
                      const statusObj = STATUS_PROJETO.find(s => s.id === proj.status) || STATUS_PROJETO[0];
                      return (
                        <tr 
                          key={proj.id}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                            cursor: 'pointer'
                          }}
                          onClick={() => { setSelectedProjeto(proj); setIsProjetoModalOpen(true); }}
                        >
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: '#00BCD4' }}>{proj.codigo}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ fontWeight: '600', color: '#fff' }}>{proj.titulo}</div>
                            <div style={{ color: '#888', fontSize: '0.75rem', maxWidth: '380px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {proj.descricao}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{ background: pilarObj.bg, color: pilarObj.color, padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>
                              {pilarObj.label}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>{proj.responsavel}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#81C784', fontWeight: 'bold' }}>
                            {proj.impactoValor > 0 ? formatMoney(proj.impactoValor) : '-'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{ background: statusObj.bg, color: statusObj.color, padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                              {statusObj.label}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', minWidth: '110px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${proj.progresso}%`, height: '100%', background: statusObj.color }} />
                              </div>
                              <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 'bold' }}>{proj.progresso}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#aaa', fontSize: '0.8rem' }}>{proj.dataLimite || '-'}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteProjeto(proj.id); }}
                              style={{ background: 'transparent', border: 'none', color: '#EF5350', cursor: 'pointer' }}
                              title="Excluir Projeto"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      </div> {/* Fim de planejamento-main-interface */}

      {/* MODAL 1: EDITAR / CRIAR ATA DE REUNIÃO */}
      {isAtaModalOpen && (
        <AtaModal
          ata={selectedAta}
          onClose={() => { setIsAtaModalOpen(false); setSelectedAta(null); }}
          onSave={handleSaveAta}
        />
      )}

      {/* MODAL 2: EDITAR / CRIAR PROJETO ESTRATÉGICO & DIÁRIO DE BORDO */}
      {isProjetoModalOpen && (
        <ProjetoModal
          projeto={selectedProjeto}
          atas={atas}
          onClose={() => { setIsProjetoModalOpen(false); setSelectedProjeto(null); }}
          onSave={handleSaveProjeto}
          onToggleEtapa={handleToggleEtapa}
          onAddTimeline={handleAddTimelineUpdate}
          newUpdateText={newUpdateText}
          setNewUpdateText={setNewUpdateText}
          user={user}
          isSuperAdmin={isSuperAdmin}
          projetos={projetos}
          persistProjetos={persistProjetos}
          selectedProjeto={selectedProjeto}
          setSelectedProjeto={setSelectedProjeto}
          pilares={pilares}
          onOpenManagePilares={() => setIsPilaresModalOpen(true)}
          responsaveis={responsaveis}
          onOpenManageResponsaveis={() => setIsResponsaveisModalOpen(true)}
        />
      )}

      {/* MODAL 3: IMPRESSÃO EXECUTIVA / RELATÓRIO PDF TIMBRADO */}
      {isPrintModalOpen && (
        <PrintModal
          atas={atas}
          projetos={projetos}
          kpis={kpis}
          pilares={pilares}
          responsaveis={responsaveis}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}

      {/* MODAL 4: EDITAR PRÓXIMA REUNIÃO DE DIRETORIA FISCAL */}
      {isEditReuniaoModalOpen && (
        <EditReuniaoModal
          dados={proximaReuniaoExibida}
          onClose={() => setIsEditReuniaoModalOpen(false)}
          onSave={persistProximaReuniao}
        />
      )}

      {/* MODAL 5: GERENCIAR PILARES ESTRATÉGICOS */}
      {isPilaresModalOpen && (
        <GerenciarPilaresModal
          pilares={pilares}
          projetos={projetos}
          onClose={() => setIsPilaresModalOpen(false)}
          onSave={persistPilares}
        />
      )}

      {/* MODAL 6: GERENCIAR RESPONSÁVEIS & FUNÇÕES */}
      {isResponsaveisModalOpen && (
        <GerenciarResponsaveisModal
          responsaveis={responsaveis}
          projetos={projetos}
          onClose={() => setIsResponsaveisModalOpen(false)}
          onSave={persistResponsaveis}
        />
      )}

    </div>
  );
}

// SUB-COMPONENTE: MODAL DE EDIÇÃO DA PRÓXIMA REUNIÃO DE DIRETORIA
function EditReuniaoModal({ dados, onClose, onSave }) {
  const [formData, setFormData] = useState({
    data: dados?.data || '',
    hora: dados?.hora || '',
    pauta: dados?.pauta || '',
    participantes: dados?.participantes || '',
    reuniaoSeguinte: dados?.reuniaoSeguinte || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.data.trim() || !formData.pauta.trim()) {
      window.$alert?.('Preencha ao menos a data e a pauta da reunião.');
      return;
    }
    onSave(formData);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
    }}>
      <div style={{
        background: '#161a23',
        border: '1px solid rgba(0, 188, 212, 0.4)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '620px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={22} color="#00BCD4" />
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem', fontWeight: '700' }}>
              Editar Próxima Reunião de Diretoria Fiscal
            </h3>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#80deea', marginBottom: '6px', fontWeight: 'bold' }}>
                Data da Reunião *
              </label>
              <input
                type="text"
                placeholder="Ex: 06/05/2026"
                value={formData.data}
                onChange={e => setFormData({ ...formData, data: e.target.value })}
                required
                style={{ width: '100%', padding: '0.65rem', background: '#0e1219', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#80deea', marginBottom: '6px', fontWeight: 'bold' }}>
                Horário da Reunião *
              </label>
              <input
                type="text"
                placeholder="Ex: 14:00h"
                value={formData.hora}
                onChange={e => setFormData({ ...formData, hora: e.target.value })}
                required
                style={{ width: '100%', padding: '0.65rem', background: '#0e1219', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', color: '#80deea', marginBottom: '6px', fontWeight: 'bold' }}>
              Pauta Prevista da Reunião *
            </label>
            <textarea
              rows={4}
              placeholder="Descreva a pauta, temas prioritários e deliberações esperadas..."
              value={formData.pauta}
              onChange={e => setFormData({ ...formData, pauta: e.target.value })}
              required
              style={{ width: '100%', padding: '0.65rem', background: '#0e1219', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.85rem', resize: 'vertical', lineHeight: '1.4' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', color: '#80deea', marginBottom: '6px', fontWeight: 'bold' }}>
              Participantes Previstos
            </label>
            <input
              type="text"
              placeholder="Ex: Danilo, Mayara, Alex, Jonata, Andre"
              value={formData.participantes}
              onChange={e => setFormData({ ...formData, participantes: e.target.value })}
              style={{ width: '100%', padding: '0.65rem', background: '#0e1219', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', color: '#80deea', marginBottom: '6px', fontWeight: 'bold' }}>
              Data da Reunião Seguinte (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: 12/06/2026"
              value={formData.reuniaoSeguinte}
              onChange={e => setFormData({ ...formData, reuniaoSeguinte: e.target.value })}
              style={{ width: '100%', padding: '0.65rem', background: '#0e1219', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '0.8rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '0.6rem 1.2rem', background: 'transparent', border: '1px solid #444', color: '#aaa', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{ padding: '0.6rem 1.5rem', background: '#00BCD4', border: 'none', color: '#000', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
            >
              Salvar Agendamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// SUB-COMPONENTE: MODAL DE ATA DE REUNIÃO
function AtaModal({ ata, onClose, onSave }) {
  const [formData, setFormData] = useState({
    id: ata?.id || null,
    titulo: ata?.titulo || 'Ata de Reunião – Planejamento Estratégico Fiscal – AGF GRUPO',
    data: ata?.data || new Date().toISOString().split('T')[0],
    dataRevisao: ata?.dataRevisao || '',
    local: ata?.local || 'Sala de Diretoria - Matriz / Presencial',
    area: ata?.area || 'Planejamento Tributário & Diretoria Executiva',
    objetivoMaster: ata?.objetivoMaster || 'Levantar projetos/ações fiscais para aumentar a lucratividade da empresa e mitigar impactos tributários futuros.',
    participantesStr: (ata?.participantes || ['Danilo', 'Andre', 'Mayara', 'Jonata', 'Alex', 'Ryan']).join(', '),
    anotacoesMestres: ata?.anotacoesMestres || '',
    proximaData: ata?.proximaReuniao?.data || '',
    proximaHora: ata?.proximaReuniao?.hora || '',
    proximaPauta: ata?.proximaReuniao?.pauta || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.titulo.trim() || !formData.data) {
      window.$alert?.('Preencha ao menos o título e a data da reunião.');
      return;
    }
    const participantes = formData.participantesStr.split(',').map(s => s.trim()).filter(Boolean);
    onSave({
      ...formData,
      participantes,
      proximaReuniao: {
        data: formData.proximaData,
        hora: formData.proximaHora,
        pauta: formData.proximaPauta
      }
    });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
    }}>
      <div style={{
        background: '#161a23',
        border: '1px solid rgba(0, 188, 212, 0.4)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '750px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '2rem',
        boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
        color: '#fff'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={24} color="#00BCD4" />
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold' }}>
              {ata ? 'Editar Ata de Reunião' : 'Nova Ata de Reunião da Diretoria'}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          <div>
            <label style={{ display: 'block', color: '#90a4ae', fontSize: '0.85rem', marginBottom: '4px' }}>Título Oficial da Ata</label>
            <input
              type="text"
              value={formData.titulo}
              onChange={e => setFormData({ ...formData, titulo: e.target.value })}
              style={{ width: '100%', padding: '0.6rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: '#90a4ae', fontSize: '0.85rem', marginBottom: '4px' }}>Data da Reunião</label>
              <input
                type="date"
                value={formData.data}
                onChange={e => setFormData({ ...formData, data: e.target.value })}
                style={{ width: '100%', padding: '0.6rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#90a4ae', fontSize: '0.85rem', marginBottom: '4px' }}>Data de Revisão (opcional)</label>
              <input
                type="date"
                value={formData.dataRevisao}
                onChange={e => setFormData({ ...formData, dataRevisao: e.target.value })}
                style={{ width: '100%', padding: '0.6rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#90a4ae', fontSize: '0.85rem', marginBottom: '4px' }}>Local / Modalidade</label>
              <input
                type="text"
                value={formData.local}
                onChange={e => setFormData({ ...formData, local: e.target.value })}
                style={{ width: '100%', padding: '0.6rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', color: '#90a4ae', fontSize: '0.85rem', marginBottom: '4px' }}>Objetivo Master da Reunião</label>
            <input
              type="text"
              value={formData.objetivoMaster}
              onChange={e => setFormData({ ...formData, objetivoMaster: e.target.value })}
              style={{ width: '100%', padding: '0.6rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#90a4ae', fontSize: '0.85rem', marginBottom: '4px' }}>Participantes (separados por vírgula)</label>
            <input
              type="text"
              value={formData.participantesStr}
              onChange={e => setFormData({ ...formData, participantesStr: e.target.value })}
              style={{ width: '100%', padding: '0.6rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
              placeholder="Ex: Danilo, Andre, Mayara, Jonata, Alex, Ryan"
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#90a4ae', fontSize: '0.85rem', marginBottom: '4px' }}>Deliberações, Anotações & Pautas Discutidas</label>
            <textarea
              rows={7}
              value={formData.anotacoesMestres}
              onChange={e => setFormData({ ...formData, anotacoesMestres: e.target.value })}
              style={{ width: '100%', padding: '0.8rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.85rem', lineHeight: '1.5' }}
              placeholder="Escreva os tópicos, decisões tomadas e fórmulas discutidas na reunião..."
            />
          </div>

          <div style={{ background: 'rgba(0, 188, 212, 0.05)', border: '1px solid rgba(0, 188, 212, 0.2)', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ fontWeight: 'bold', color: '#80deea', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={16} /> Próxima Reunião Agendada
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', color: '#90a4ae', fontSize: '0.78rem', marginBottom: '2px' }}>Data</label>
                <input
                  type="date"
                  value={formData.proximaData}
                  onChange={e => setFormData({ ...formData, proximaData: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#90a4ae', fontSize: '0.78rem', marginBottom: '2px' }}>Horário</label>
                <input
                  type="text"
                  value={formData.proximaHora}
                  onChange={e => setFormData({ ...formData, proximaHora: e.target.value })}
                  placeholder="Ex: 14:00"
                  style={{ width: '100%', padding: '0.5rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', color: '#90a4ae', fontSize: '0.78rem', marginBottom: '2px' }}>Pauta Prevista</label>
              <input
                type="text"
                value={formData.proximaPauta}
                onChange={e => setFormData({ ...formData, proximaPauta: e.target.value })}
                placeholder="Ex: Apresentação de bancos, status do PAT e parecer tributário..."
                style={{ width: '100%', padding: '0.5rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '0.6rem 1.2rem', background: '#333', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{ padding: '0.6rem 1.4rem', background: '#00BCD4', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Salvar Ata
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

// SUB-COMPONENTE: MODAL DE PROJETO ESTRATÉGICO & DIÁRIO DE BORDO
function ProjetoModal({ 
  projeto, 
  atas, 
  onClose, 
  onSave, 
  onToggleEtapa, 
  onAddTimeline, 
  newUpdateText, 
  setNewUpdateText, 
  user,
  isSuperAdmin,
  projetos,
  persistProjetos,
  selectedProjeto,
  setSelectedProjeto,
  pilares = PILARES_ESTRATEGICOS_DEFAULT,
  onOpenManagePilares,
  responsaveis = RESPONSAVEIS_DEFAULT,
  onOpenManageResponsaveis
}) {
  const isEditing = Boolean(projeto?.id);
  const [formData, setFormData] = useState({
    id: projeto?.id || null,
    codigo: projeto?.codigo || '',
    ataId: projeto?.ataId || (atas[0]?.id || ''),
    titulo: projeto?.titulo || '',
    pilar: projeto?.pilar || 'tributos_diretos',
    responsavel: projeto?.responsavel || user?.username || 'Danilo',
    coresponsaveisStr: (projeto?.coresponsaveis || []).join(', '),
    impactoTipo: projeto?.impactoTipo || 'economia_anual',
    impactoValor: projeto?.impactoValor || 0,
    impactoDesc: projeto?.impactoDesc || '',
    status: projeto?.status || 'estudo',
    progresso: projeto?.progresso || 0,
    dataLimite: projeto?.dataLimite || '',
    descricao: projeto?.descricao || '',
    etapas: projeto?.etapas || [],
    timeline: projeto?.timeline || []
  });

  const [newEtapaTitulo, setNewEtapaTitulo] = useState('');
  const [newEtapaResp, setNewEtapaResp] = useState(formData.responsavel);
  const [localUpdateText, setLocalUpdateText] = useState('');

  // Edição inline de Etapas
  const [editingEtapaId, setEditingEtapaId] = useState(null);
  const [editingEtapaTitulo, setEditingEtapaTitulo] = useState('');
  const [editingEtapaResp, setEditingEtapaResp] = useState('');

  // Edição inline de Diário de Bordo
  const [editingTimelineId, setEditingTimelineId] = useState(null);
  const [editingTimelineText, setEditingTimelineText] = useState('');

  // Sincronizar estado local do modal caso o projeto mude
  useEffect(() => {
    if (projeto) {
      setFormData(prev => ({
        ...prev,
        id: projeto.id || prev.id,
        codigo: projeto.codigo || prev.codigo,
        ataId: projeto.ataId || prev.ataId,
        titulo: projeto.titulo || prev.titulo,
        pilar: projeto.pilar || prev.pilar,
        responsavel: projeto.responsavel || prev.responsavel,
        coresponsaveisStr: (projeto.coresponsaveis || []).join(', '),
        impactoTipo: projeto.impactoTipo || prev.impactoTipo,
        impactoValor: projeto.impactoValor ?? prev.impactoValor,
        impactoDesc: projeto.impactoDesc || prev.impactoDesc,
        status: projeto.status || prev.status,
        progresso: projeto.progresso ?? prev.progresso,
        dataLimite: projeto.dataLimite || prev.dataLimite,
        descricao: projeto.descricao || prev.descricao,
        etapas: projeto.etapas || prev.etapas,
        timeline: projeto.timeline || prev.timeline
      }));
    }
  }, [projeto]);

  const handleRegisterTimeline = () => {
    const text = localUpdateText.trim();
    if (!text) return;
    const newEntry = {
      id: `t-${Date.now()}`,
      autor: user?.username || 'Diretoria',
      data: new Date().toISOString().split('T')[0],
      texto: text
    };
    const updatedTimeline = [newEntry, ...(formData.timeline || [])];
    setFormData(prev => ({ ...prev, timeline: updatedTimeline }));
    setLocalUpdateText('');
    if (isEditing && formData.id) {
      onAddTimeline(formData.id, newEntry);
    }
  };

  const handleStartEditTimeline = (item) => {
    setEditingTimelineId(item.id);
    setEditingTimelineText(item.texto);
  };

  const handleSaveEditTimeline = (itemId) => {
    if (!editingTimelineText.trim()) return;
    const updatedTimeline = (formData.timeline || []).map(t =>
      t.id === itemId
        ? { ...t, texto: editingTimelineText.trim(), editadoEm: new Date().toISOString().split('T')[0] }
        : t
    );
    setFormData(prev => ({ ...prev, timeline: updatedTimeline }));
    setEditingTimelineId(null);
    if (isEditing && formData.id && persistProjetos) {
      const proj = (projetos || []).find(p => p.id === formData.id);
      if (proj) {
        const updatedProj = { ...proj, timeline: updatedTimeline };
        const newProjs = projetos.map(p => p.id === formData.id ? updatedProj : p);
        persistProjetos(newProjs);
        if (selectedProjeto?.id === formData.id) setSelectedProjeto(updatedProj);
      }
    }
    window.$toast?.('Anotação do Diário atualizada!', { type: 'success' });
  };

  const handleDeleteTimeline = (itemId) => {
    if (!window.confirm('Excluir esta anotação do Diário de Bordo?')) return;
    const updatedTimeline = (formData.timeline || []).filter(t => t.id !== itemId);
    setFormData(prev => ({ ...prev, timeline: updatedTimeline }));
    if (isEditing && formData.id && persistProjetos) {
      const proj = (projetos || []).find(p => p.id === formData.id);
      if (proj) {
        const updatedProj = { ...proj, timeline: updatedTimeline };
        const newProjs = projetos.map(p => p.id === formData.id ? updatedProj : p);
        persistProjetos(newProjs);
        if (selectedProjeto?.id === formData.id) setSelectedProjeto(updatedProj);
      }
    }
    window.$toast?.('Anotação excluída do Diário.', { type: 'info' });
  };

  const handleToggleLocalEtapa = (etapaId) => {
    const newEtapas = (formData.etapas || []).map(e => e.id === etapaId ? { ...e, concluido: !e.concluido } : e);
    const total = newEtapas.length;
    const conc = newEtapas.filter(e => e.concluido).length;
    const prog = total > 0 ? Math.round((conc / total) * 100) : formData.progresso;
    const newStatus = prog === 100 ? 'concluido' : (formData.status === 'concluido' ? 'execucao' : formData.status);
    setFormData(prev => ({
      ...prev,
      etapas: newEtapas,
      progresso: prog,
      status: newStatus
    }));
    if (isEditing && formData.id) {
      onToggleEtapa(formData.id, etapaId);
    }
  };

  const handleStartEditEtapa = (etapa) => {
    setEditingEtapaId(etapa.id);
    setEditingEtapaTitulo(etapa.titulo);
    setEditingEtapaResp(etapa.responsavel || formData.responsavel);
  };

  const handleSaveEditEtapa = (etapaId) => {
    if (!editingEtapaTitulo.trim()) return;
    const updated = (formData.etapas || []).map(e =>
      e.id === etapaId
        ? { ...e, titulo: editingEtapaTitulo.trim(), responsavel: editingEtapaResp.trim() || formData.responsavel }
        : e
    );
    setFormData(prev => ({ ...prev, etapas: updated }));
    setEditingEtapaId(null);
    if (isEditing && formData.id && persistProjetos) {
      const proj = (projetos || []).find(p => p.id === formData.id);
      if (proj) {
        const updatedProj = { ...proj, etapas: updated };
        const newProjs = projetos.map(p => p.id === formData.id ? updatedProj : p);
        persistProjetos(newProjs);
        if (selectedProjeto?.id === formData.id) setSelectedProjeto(updatedProj);
      }
    }
    window.$toast?.('Etapa atualizada com sucesso!', { type: 'success' });
  };

  const handleAddEtapa = () => {
    if (!newEtapaTitulo.trim()) return;
    const newEtapa = {
      id: `e-${Date.now()}`,
      titulo: newEtapaTitulo.trim(),
      concluido: false,
      responsavel: newEtapaResp || formData.responsavel
    };
    setFormData({
      ...formData,
      etapas: [...formData.etapas, newEtapa]
    });
    setNewEtapaTitulo('');
  };

  const handleRemoveEtapa = (id) => {
    setFormData({
      ...formData,
      etapas: formData.etapas.filter(e => e.id !== id)
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.titulo.trim()) {
      window.$alert?.('Preencha o título do projeto.');
      return;
    }
    const coresponsaveis = formData.coresponsaveisStr.split(',').map(s => s.trim()).filter(Boolean);
    onSave({
      ...formData,
      coresponsaveis,
      impactoValor: Number(formData.impactoValor) || 0,
      progresso: Number(formData.progresso) || 0
    });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
    }}>
      <div style={{
        background: '#161a23',
        border: '1px solid rgba(0, 188, 212, 0.4)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '850px',
        maxHeight: '92vh',
        overflowY: 'auto',
        padding: '2rem',
        boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
        color: '#fff'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Target size={24} color="#00BCD4" />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold' }}>
                {isEditing ? `Projeto: ${formData.codigo} - ${formData.titulo}` : 'Novo Projeto Estratégico Fiscal'}
              </h2>
              {isEditing && (
                <span style={{ fontSize: '0.75rem', color: '#80deea' }}>
                  Acompanhamento de etapas, diário de bordo e metas de lucratividade
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          <div>
            <label style={{ display: 'block', color: '#90a4ae', fontSize: '0.85rem', marginBottom: '4px' }}>Título do Projeto</label>
            <input
              type="text"
              value={formData.titulo}
              onChange={e => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Ex: Adesão ao PAT (Redução de 4% IRPJ)"
              style={{ width: '100%', padding: '0.6rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.95rem' }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ color: '#90a4ae', fontSize: '0.85rem' }}>Pilar Estratégico</label>
                {onOpenManagePilares && (
                  <button
                    type="button"
                    onClick={onOpenManagePilares}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#00BCD4',
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: 0,
                      textDecoration: 'underline',
                      fontWeight: 'bold'
                    }}
                    title="Incluir novo pilar ou editar existentes"
                  >
                    <Plus size={12} /> Incluir / Gerenciar
                  </button>
                )}
              </div>
              <select
                value={formData.pilar}
                onChange={e => setFormData({ ...formData, pilar: e.target.value })}
                style={{ width: '100%', padding: '0.6rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
              >
                {pilares.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ color: '#90a4ae', fontSize: '0.85rem' }}>Líder do Projeto (Responsável)</label>
                {onOpenManageResponsaveis && (
                  <button
                    type="button"
                    onClick={onOpenManageResponsaveis}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#81C784',
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: 0,
                      textDecoration: 'underline',
                      fontWeight: 'bold'
                    }}
                    title="Cadastrar novo responsável ou alterar funções"
                  >
                    <Plus size={12} /> Gerenciar / Novo
                  </button>
                )}
              </div>
              <select
                value={formData.responsavel}
                onChange={e => setFormData({ ...formData, responsavel: e.target.value })}
                style={{ width: '100%', padding: '0.6rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
                required
              >
                {formData.responsavel && !responsaveis.some(r => r.nome === formData.responsavel) && (
                  <option value={formData.responsavel}>{formData.responsavel}</option>
                )}
                {responsaveis.map(r => (
                  <option key={r.id} value={r.nome}>
                    {r.nome} {r.cargo ? `— (${r.cargo})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', color: '#90a4ae', fontSize: '0.85rem', marginBottom: '4px' }}>Ata de Origem</label>
              <select
                value={formData.ataId}
                onChange={e => setFormData({ ...formData, ataId: e.target.value })}
                style={{ width: '100%', padding: '0.6rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
              >
                {atas.map(a => (
                  <option key={a.id} value={a.id}>ATA {a.numero} - {a.data}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: '#90a4ae', fontSize: '0.85rem', marginBottom: '4px' }}>Status Atual</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                style={{ width: '100%', padding: '0.6rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
              >
                {STATUS_PROJETO.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', color: '#90a4ae', fontSize: '0.85rem', marginBottom: '4px' }}>Progresso Geral ({formData.progresso}%)</label>
              <input
                type="range"
                min="0"
                max="100"
                value={formData.progresso}
                onChange={e => setFormData({ ...formData, progresso: Number(e.target.value) })}
                style={{ width: '100%', marginTop: '8px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#90a4ae', fontSize: '0.85rem', marginBottom: '4px' }}>Impacto Financeiro (R$/ano)</label>
              <input
                type="number"
                step="1000"
                value={formData.impactoValor}
                onChange={e => setFormData({ ...formData, impactoValor: e.target.value })}
                style={{ width: '100%', padding: '0.6rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#4CAF50', fontWeight: 'bold' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#90a4ae', fontSize: '0.85rem', marginBottom: '4px' }}>Data Limite / Alvo</label>
              <input
                type="date"
                value={formData.dataLimite}
                onChange={e => setFormData({ ...formData, dataLimite: e.target.value })}
                style={{ width: '100%', padding: '0.6rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', color: '#90a4ae', fontSize: '0.85rem', marginBottom: '4px' }}>Descrição & Escopo do Projeto</label>
            <textarea
              rows={3}
              value={formData.descricao}
              onChange={e => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva o escopo, leis aplicáveis e benefícios fiscais esperados..."
              style={{ width: '100%', padding: '0.6rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
            />
          </div>

          {/* CHECKLIST DE ETAPAS / MILESTONES */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#80deea' }}>
                Etapas & Plano de Ação ({formData.etapas.filter(e => e.concluido).length}/{formData.etapas.length} concluídas)
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
              {formData.etapas.map(etapa => {
                const isEditingThis = editingEtapaId === etapa.id;

                if (isEditingThis) {
                  return (
                    <div key={etapa.id} style={{ display: 'flex', gap: '0.5rem', background: '#1c2230', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #00BCD4', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={editingEtapaTitulo}
                        onChange={e => setEditingEtapaTitulo(e.target.value)}
                        placeholder="Título da etapa..."
                        style={{ flex: 2, padding: '0.45rem', background: '#0f1218', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '0.85rem' }}
                        autoFocus
                      />
                      <select
                        value={editingEtapaResp}
                        onChange={e => setEditingEtapaResp(e.target.value)}
                        style={{ flex: 1, padding: '0.45rem', background: '#0f1218', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '0.85rem' }}
                      >
                        {editingEtapaResp && !responsaveis.some(r => r.nome === editingEtapaResp) && (
                          <option value={editingEtapaResp}>{editingEtapaResp}</option>
                        )}
                        {responsaveis.map(r => (
                          <option key={r.id} value={r.nome}>{r.nome}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleSaveEditEtapa(etapa.id)}
                        style={{ padding: '0.45rem 0.8rem', background: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.78rem' }}
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingEtapaId(null)}
                        style={{ padding: '0.45rem 0.6rem', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={etapa.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: etapa.concluido ? 'rgba(76, 175, 80, 0.12)' : 'rgba(0,0,0,0.3)',
                      border: etapa.concluido ? '1px solid rgba(76, 175, 80, 0.4)' : '1px solid rgba(255,255,255,0.06)',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '8px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={etapa.concluido}
                        onChange={() => handleToggleLocalEtapa(etapa.id)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.88rem', color: '#fff', fontWeight: etapa.concluido ? '600' : '400' }}>
                        {etapa.titulo}
                      </span>
                      {etapa.concluido ? (
                        <span style={{ background: 'rgba(76, 175, 80, 0.25)', color: '#81C784', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 'bold', marginLeft: '6px' }}>
                          ✓ Concluída
                        </span>
                      ) : (
                        <span style={{ background: 'rgba(255, 193, 7, 0.15)', color: '#FFD54F', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', marginLeft: '6px' }}>
                          Pendente
                        </span>
                      )}
                    </label>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#cfd8dc', background: 'rgba(255,255,255,0.08)', padding: '3px 8px', borderRadius: '4px', fontWeight: '500' }}>
                        {etapa.responsavel}
                      </span>

                      {/* EDITAR ETAPA */}
                      <button
                        type="button"
                        onClick={() => handleStartEditEtapa(etapa)}
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#64B5F6', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                        title="Editar Etapa"
                      >
                        <Edit3 size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveEtapa(etapa.id)}
                        style={{ background: 'rgba(244, 67, 54, 0.1)', border: '1px solid rgba(244, 67, 54, 0.2)', color: '#EF5350', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                        title="Excluir Etapa"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ADICIONAR NOVA ETAPA */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={newEtapaTitulo}
                onChange={e => setNewEtapaTitulo(e.target.value)}
                placeholder="Nova etapa do projeto..."
                style={{ flex: 2, padding: '0.5rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddEtapa(); } }}
              />
              <select
                value={newEtapaResp}
                onChange={e => setNewEtapaResp(e.target.value)}
                style={{ flex: 1, padding: '0.5rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
              >
                {newEtapaResp && !responsaveis.some(r => r.nome === newEtapaResp) && (
                  <option value={newEtapaResp}>{newEtapaResp}</option>
                )}
                {responsaveis.map(r => (
                  <option key={r.id} value={r.nome}>{r.nome}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddEtapa}
                style={{ padding: '0.5rem 1rem', background: '#2196F3', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                + Etapa
              </button>
            </div>
          </div>

          {/* DIÁRIO DE BORDO / LINHA DO TEMPO DE ANDAMENTO (SE EDITANDO) */}
          {isEditing && (
            <div style={{ background: 'rgba(0, 188, 212, 0.04)', border: '1px solid rgba(0, 188, 212, 0.2)', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#80deea', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={16} /> Diário de Bordo & Atualizações Recentes
              </div>

              {/* CAMPO PARA ADICIONAR NOVO UPDATE */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  type="text"
                  value={localUpdateText}
                  onChange={e => setLocalUpdateText(e.target.value)}
                  placeholder="Registre o que avançou neste projeto hoje..."
                  style={{ flex: 1, padding: '0.6rem', background: '#0f1218', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRegisterTimeline();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleRegisterTimeline}
                  style={{ padding: '0.6rem 1.2rem', background: '#00BCD4', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Registrar
                </button>
              </div>

              {/* LISTA DO FEED */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '280px', overflowY: 'auto' }}>
                {(formData.timeline || []).map(item => {
                  const isEditingThisTimeline = editingTimelineId === item.id;
                  const canEditTimeline = isSuperAdmin || item.autor === user?.username || ['danilo', 'ryan.santos', 'carol.cons', 'talita.alves'].includes(user?.username);

                  if (isEditingThisTimeline) {
                    return (
                      <div key={item.id} style={{ background: '#1c2230', padding: '0.8rem', borderRadius: '6px', border: '1px solid #00BCD4', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <input
                          type="text"
                          value={editingTimelineText}
                          onChange={e => setEditingTimelineText(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', background: '#0f1218', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '0.85rem' }}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEditTimeline(item.id);
                            }
                          }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => handleSaveEditTimeline(item.id)}
                            style={{ padding: '0.35rem 0.8rem', background: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTimelineId(null)}
                            style={{ padding: '0.35rem 0.6rem', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={item.id} style={{ background: 'rgba(0,0,0,0.35)', padding: '0.7rem 0.9rem', borderRadius: '6px', borderLeft: '3px solid #00BCD4' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#90a4ae', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ color: '#fff', fontSize: '0.82rem' }}>{item.autor}</strong>
                          <span>• {item.data}</span>
                          {item.editadoEm && <span style={{ color: '#888', fontStyle: 'italic' }}>(editado em {item.editadoEm})</span>}
                        </div>
                        {canEditTimeline && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleStartEditTimeline(item)}
                              style={{ background: 'transparent', border: 'none', color: '#64B5F6', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                              title="Editar Anotação"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTimeline(item.id)}
                              style={{ background: 'transparent', border: 'none', color: '#EF5350', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                              title="Excluir Anotação"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#e0e0e0', lineHeight: '1.4' }}>{item.texto}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '0.6rem 1.2rem', background: '#333', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{ padding: '0.6rem 1.4rem', background: '#00BCD4', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Salvar Projeto
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

// SUB-COMPONENTE: MODAL DE IMPRESSÃO EXECUTIVA / RELATÓRIO PDF TIMBRADO
function PrintModal({ atas, projetos, kpis, onClose, pilares, responsaveis }) {
  // Impressão com título dinâmico para o arquivo PDF sair com o nome da rotina
  const handlePrint = () => {
    const originalTitle = document.title;
    const now = new Date();
    const dataFormatada = now.toISOString().split('T')[0];
    
    // Nome oficial da rotina para o arquivo PDF ao Salvar
    document.title = `Planejamento_Estrategico_Fiscal_Relatorio_AGF_${dataFormatada}`;

    const restoreTitle = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };

    window.addEventListener('afterprint', restoreTitle);
    window.print();

    // Fallback de segurança para restauração do título da aba
    setTimeout(() => {
      document.title = originalTitle;
    }, 2000);
  };

  const handleExportExcel = () => {
    exportPlanejamentoToExcel(projetos, pilares, atas);
  };

  const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const signatarios = useMemo(() => {
    const list = (responsaveis || []).filter(r => r.assinaDocumento);
    if (list.length > 0) return list;
    return [
      { id: '1', nome: 'Danilo Machado', cargo: 'Diretoria Fiscal / Controladoria' },
      { id: '2', nome: 'Alex / Jonata', cargo: 'Diretoria Executiva / Operações' },
      { id: '3', nome: 'Mayara / Andre', cargo: 'Diretoria Administrativa / RH' }
    ];
  }, [responsaveis]);

  return (
    <div className="planejamento-print-backdrop" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem'
    }}>
      {/* ESTILOS DE IMPRESSÃO EMBUTIDOS PARA PDF PROFISSIONAL TIMBRADO */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait !important;
            margin: 10mm 10mm 12mm 10mm !important;
          }

          /* Ocultar elementos desnecessários da aplicação */
          .app-header,
          .print-hide,
          .no-print,
          nav,
          header,
          footer,
          aside,
          button,
          input,
          select {
            display: none !important;
          }

          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .app-container,
          .planejamento-module-root {
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            min-height: auto !important;
          }

          /* Reset do Backdrop do Modal */
          .planejamento-print-backdrop {
            position: static !important;
            inset: auto !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            backdrop-filter: none !important;
            box-shadow: none !important;
            z-index: auto !important;
          }

          /* Reset do Dialog para Fluxo A4 Contínuo */
          .planejamento-print-dialog {
            position: static !important;
            background: #ffffff !important;
            color: #0f172a !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Tabela de Projetos */
          .planejamento-report-table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 8px !important;
          }

          .planejamento-report-table thead {
            display: table-header-group !important;
          }

          .planejamento-report-table thead th {
            background-color: #00838F !important;
            color: #ffffff !important;
            font-size: 8pt !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
            padding: 6px 8px !important;
            border: 1px solid #00838F !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .planejamento-report-table tbody tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .planejamento-report-table tbody td {
            border: 1px solid #cbd5e1 !important;
            padding: 5px 7px !important;
            font-size: 7.5pt !important;
            line-height: 1.3 !important;
            vertical-align: top !important;
          }

          /* Seções que não devem quebrar ao meio */
          .planejamento-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Forçar exibição de cores e background exatos no papel/PDF */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />

      <div className="planejamento-print-dialog" style={{
        background: '#fff',
        color: '#0f172a',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '960px',
        maxHeight: '94vh',
        overflowY: 'auto',
        padding: '2.5rem',
        boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
        position: 'relative'
      }}>
        {/* BARRA SUPERIOR DE AÇÕES (NÃO IMPRESSA) */}
        <div className="no-print" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '1rem',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>
              Rotina: <strong style={{ color: '#00838F' }}>Planejamento Estratégico Fiscal</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={handleExportExcel}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.6rem 1.1rem',
                background: '#2e7d32',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
              title="Salvar arquivo Excel com o nome da rotina"
            >
              <Download size={16} /> Exportar Excel (.xlsx)
            </button>

            <button
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.6rem 1.2rem',
                background: '#00838F',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
              title="Salvar arquivo PDF com o nome da rotina"
            >
              <Printer size={16} /> Imprimir / Salvar PDF
            </button>

            <button
              onClick={onClose}
              style={{
                padding: '0.6rem 1rem',
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.85rem'
              }}
            >
              Fechar
            </button>
          </div>
        </div>

        {/* CABEÇALHO DO DOCUMENTO TIMBRADO */}
        <div style={{
          borderBottom: '3px solid #00838F',
          paddingBottom: '1.2rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#00838F', fontWeight: '900', letterSpacing: '-0.5px' }}>
                AGF GROUP • DIRETORIA EXECUTIVA
              </h1>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
              RELATÓRIO DE PLANEJAMENTO ESTRATÉGICO FISCAL & GOVERNANÇA
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
              Documento Confidencial • Uso Interno Corporativo • Diretoria Colegiada
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#475569', lineHeight: '1.5' }}>
            <div>Emissão: <strong>{new Date().toLocaleDateString('pt-BR')}</strong></div>
            <div>Status Geral: <strong style={{ color: '#00838F' }}>{kpis.mediaProgresso}% Concluído</strong></div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Rotina: Planejamento_Estrategico_Fiscal</div>
          </div>
        </div>

        {/* SUMÁRIO EXECUTIVO (KPIS) */}
        <div className="planejamento-avoid-break" style={{
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
          textAlign: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '700', letterSpacing: '0.5px' }}>PROJETOS MAPEADOS</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#00838F', marginTop: '2px' }}>{kpis.totalProjetos}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '700', letterSpacing: '0.5px' }}>EM EXECUÇÃO</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#0284c7', marginTop: '2px' }}>{kpis.emExecucao}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '700', letterSpacing: '0.5px' }}>IMPACTO FINANCEIRO ESTIMADO</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#16a34a', marginTop: '2px' }}>{formatMoney(kpis.economiaTotal)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '700', letterSpacing: '0.5px' }}>ATAS REGISTRADAS</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#9333ea', marginTop: '2px' }}>{atas.length}</div>
          </div>
        </div>

        {/* SEÇÃO 1: TABELA DE PROJETOS E AÇÕES */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '1.05rem', color: '#00838F', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px', fontWeight: '700' }}>
            1. Quadro Geral de Ações Estratégicas
          </h3>
          <table className="planejamento-report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#00838F', color: '#fff', textAlign: 'left' }}>
                <th style={{ padding: '6px', width: '60px', textAlign: 'center' }}>Cód.</th>
                <th style={{ padding: '6px' }}>Projeto / Escopo Estratégico</th>
                <th style={{ padding: '6px', width: '115px' }}>Pilar</th>
                <th style={{ padding: '6px', width: '85px' }}>Líder</th>
                <th style={{ padding: '6px', width: '105px', textAlign: 'right' }}>Ganho/Ano</th>
                <th style={{ padding: '6px', width: '100px' }}>Status</th>
                <th style={{ padding: '6px', width: '65px', textAlign: 'center' }}>Progresso</th>
              </tr>
            </thead>
            <tbody>
              {projetos.map((proj, idx) => {
                const statusObj = STATUS_PROJETO.find(s => s.id === proj.status) || STATUS_PROJETO[0];
                const pilarObj = (pilares || PILARES_ESTRATEGICOS).find(p => p.id === proj.pilar) || (pilares || PILARES_ESTRATEGICOS)[0];
                return (
                  <tr key={proj.id} style={{ borderBottom: '1px solid #cbd5e1', background: idx % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                    <td style={{ padding: '6px', fontWeight: 'bold', textAlign: 'center', color: '#00838F', border: '1px solid #cbd5e1' }}>
                      {proj.codigo}
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>
                      <strong style={{ color: '#0f172a', fontSize: '0.82rem' }}>{proj.titulo}</strong>
                      {proj.descricao && (
                        <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '2px', lineHeight: '1.3' }}>
                          {proj.descricao}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', color: '#334155' }}>
                      {pilarObj.label.split('(')[0]}
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: '600', color: '#1e293b' }}>
                      {proj.responsavel}
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold', color: proj.impactoValor > 0 ? '#15803d' : '#64748b', textAlign: 'right' }}>
                      {proj.impactoValor > 0 ? formatMoney(proj.impactoValor) : '-'}
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: '600',
                        background: '#f1f5f9',
                        color: '#334155'
                      }}>
                        {statusObj.label}
                      </span>
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                      <span style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '0.8rem' }}>{proj.progresso}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* SEÇÃO 2: DELIBERAÇÕES DA DIRETORIA (ATAS) */}
        <div className="planejamento-avoid-break" style={{ marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '1.05rem', color: '#00838F', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px', fontWeight: '700' }}>
            2. Deliberações da Diretoria & Alinhamentos Estratégicos
          </h3>
          {atas && atas.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {atas.slice(0, 2).map((ataItem) => (
                <div key={ataItem.id} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem', fontSize: '0.82rem', lineHeight: '1.5', color: '#1e293b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '8px', fontWeight: 'bold', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{ color: '#0f172a', fontSize: '0.9rem' }}>{ataItem.titulo}</span>
                    <span style={{ color: '#64748b' }}>Data: {ataItem.data ? ataItem.data.split('-').reverse().join('/') : '-'} {ataItem.local ? `• Local: ${ataItem.local}` : ''}</span>
                  </div>
                  <div style={{ marginBottom: '6px', color: '#334155' }}>
                    <strong>Participantes:</strong> {Array.isArray(ataItem.participantes) ? ataItem.participantes.join(', ') : 'Diretoria Colegiada'}
                  </div>
                  {ataItem.objetivoMaster && (
                    <div style={{ marginBottom: '6px', color: '#00838F', fontWeight: '700' }}>
                      🎯 {ataItem.objetivoMaster}
                    </div>
                  )}
                  {ataItem.anotacoesMestres && (
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem', whiteSpace: 'pre-wrap', color: '#334155', fontSize: '0.78rem' }}>
                      {ataItem.anotacoesMestres}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>Nenhuma ata registrada até o momento.</div>
          )}
        </div>

        {/* SEÇÃO 3: CAMPO DE ASSINATURAS */}
        <div className="planejamento-avoid-break" style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '2px solid #00838F' }}>
          <div style={{ textAlign: 'center', fontSize: '0.82rem', color: '#475569', marginBottom: '2rem', fontWeight: '600' }}>
            Documento deliberado e homologado pelos membros da Diretoria Executiva do AGF GROUP:
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(Math.max(signatarios.length, 1), 3)}, 1fr)`,
            gap: '2.5rem 1.5rem',
            textAlign: 'center'
          }}>
            {signatarios.map((sig, idx) => (
              <div key={sig.id || idx} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <div style={{ borderTop: '1px solid #1e293b', width: '80%', margin: '0 auto 6px auto' }} />
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0f172a' }}>{sig.nome}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{sig.cargo}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#94a3b8', marginTop: '2rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem' }}>
            SysContábil • AGF Group • Módulo: Planejamento Estratégico Fiscal • Documento emitido em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

      </div>
    </div>
  );
}

// SUB-COMPONENTE: MODAL DE GERENCIAMENTO DE PILARES ESTRATÉGICOS
function GerenciarPilaresModal({ pilares, projetos, onClose, onSave }) {
  const [pilaresList, setPilaresList] = useState(pilares);
  const [novoNome, setNovoNome] = useState('');
  const [novaCor, setNovaCor] = useState('#00BCD4');
  const [editingPilarId, setEditingPilarId] = useState(null);
  const [editingPilarNome, setEditingPilarNome] = useState('');

  const PALETA_CORES = [
    { label: 'Ciano', hex: '#00BCD4' },
    { label: 'Verde', hex: '#4CAF50' },
    { label: 'Laranja', hex: '#FF9800' },
    { label: 'Azul', hex: '#2196F3' },
    { label: 'Roxo', hex: '#9C27B0' },
    { label: 'Rosa', hex: '#E91E63' },
    { label: 'Amarelo', hex: '#FFC107' },
    { label: 'Teal', hex: '#009688' },
    { label: 'Coral', hex: '#FF7043' },
    { label: 'Índigo', hex: '#3F51B5' }
  ];

  const handleAddPilar = (e) => {
    e.preventDefault();
    if (!novoNome.trim()) return;

    const id = `pilar_${Date.now()}`;
    const novoPilar = {
      id,
      label: novoNome.trim(),
      color: novaCor,
      bg: hexToRgba(novaCor, 0.15),
      iconName: 'target',
      custom: true
    };

    const updated = [...pilaresList, novoPilar];
    setPilaresList(updated);
    onSave(updated);
    setNovoNome('');
    window.$toast?.(`Pilar "${novoNome.trim()}" incluído com sucesso!`, { type: 'success' });
  };

  const handleStartEdit = (pilar) => {
    setEditingPilarId(pilar.id);
    setEditingPilarNome(pilar.label);
  };

  const handleSaveEdit = (pilarId) => {
    if (!editingPilarNome.trim()) return;
    const updated = pilaresList.map(p => p.id === pilarId ? { ...p, label: editingPilarNome.trim() } : p);
    setPilaresList(updated);
    onSave(updated);
    setEditingPilarId(null);
    window.$toast?.('Pilar renomeado com sucesso!', { type: 'success' });
  };

  const handleDeletePilar = (pilarId) => {
    const emUso = (projetos || []).filter(p => p.pilar === pilarId).length;
    if (emUso > 0) {
      window.$alert?.(`Não é possível excluir este pilar pois há ${emUso} projeto(s) associado(s) a ele.`);
      return;
    }
    if (window.confirm('Tem certeza que deseja excluir este pilar estratégico?')) {
      const updated = pilaresList.filter(p => p.id !== pilarId);
      setPilaresList(updated);
      onSave(updated);
      window.$toast?.('Pilar removido com sucesso.', { type: 'info' });
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem'
    }}>
      <div style={{
        background: '#161a23',
        border: '1px solid rgba(0, 188, 212, 0.4)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '650px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={20} color="#00BCD4" />
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', fontWeight: '700' }}>
                Gerenciar Pilares Estratégicos
              </h3>
            </div>
            <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '0.8rem' }}>
              Inclua novos temas estratégicos ou altere os pilares que classificam os projetos fiscais.
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Adicionar Novo Pilar */}
          <form onSubmit={handleAddPilar} style={{ background: 'rgba(255,255,255,0.03)', padding: '1.1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h4 style={{ margin: '0 0 0.8rem 0', color: '#80deea', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={16} /> Incluir Novo Pilar Estratégico
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '4px', fontWeight: 'bold' }}>
                  Nome do Pilar *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Logística & Suprimentos, Tributos Indiretos, Comércio Exterior..."
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', background: '#0e1219', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '6px', fontWeight: 'bold' }}>
                  Cor de Identificação
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {PALETA_CORES.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setNovaCor(c.hex)}
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: c.hex,
                        border: novaCor === c.hex ? '3px solid #fff' : '2px solid transparent',
                        cursor: 'pointer',
                        transform: novaCor === c.hex ? 'scale(1.15)' : 'none',
                        transition: 'all 0.15s'
                      }}
                      title={c.label}
                    />
                  ))}
                  <span style={{ fontSize: '0.78rem', color: novaCor, marginLeft: '6px', fontWeight: 'bold' }}>
                    {PALETA_CORES.find(c => c.hex === novaCor)?.label || novaCor}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={!novoNome.trim()}
                style={{
                  padding: '0.6rem 1.2rem',
                  background: novoNome.trim() ? '#00BCD4' : '#333',
                  color: novoNome.trim() ? '#000' : '#888',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  cursor: novoNome.trim() ? 'pointer' : 'not-allowed',
                  marginTop: '4px',
                  alignSelf: 'flex-start'
                }}
              >
                + Adicionar Pilar
              </button>
            </div>
          </form>

          {/* Lista de Pilares Atuais */}
          <div>
            <h4 style={{ margin: '0 0 0.8rem 0', color: '#ccc', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Pilares Ativos ({pilaresList.length})
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '300px', overflowY: 'auto' }}>
              {pilaresList.map(pilar => {
                const emUso = (projetos || []).filter(p => p.pilar === pilar.id).length;
                const isEditing = editingPilarId === pilar.id;

                if (isEditing) {
                  return (
                    <div key={pilar.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#1c2230', padding: '0.6rem', borderRadius: '8px', border: '1px solid #00BCD4' }}>
                      <input
                        type="text"
                        value={editingPilarNome}
                        onChange={e => setEditingPilarNome(e.target.value)}
                        autoFocus
                        style={{ flex: 1, padding: '0.45rem', background: '#0e1219', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '0.85rem' }}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(pilar.id); }}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(pilar.id)}
                        style={{ padding: '0.4rem 0.8rem', background: '#4CAF50', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPilarId(null)}
                        style={{ padding: '0.4rem 0.6rem', background: '#333', border: 'none', color: '#aaa', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={pilar.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(0,0,0,0.35)',
                      padding: '0.65rem 0.9rem',
                      borderRadius: '8px',
                      borderLeft: `4px solid ${pilar.color}`
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: pilar.color }} />
                      <strong style={{ color: '#fff', fontSize: '0.88rem' }}>{pilar.label}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#888', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                        {emUso} projeto(s)
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(pilar)}
                        style={{ background: 'transparent', border: 'none', color: '#64B5F6', cursor: 'pointer', padding: '3px' }}
                        title="Editar Nome do Pilar"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePilar(pilar.id)}
                        disabled={emUso > 0}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: emUso > 0 ? '#555' : '#EF5350',
                          cursor: emUso > 0 ? 'not-allowed' : 'pointer',
                          padding: '3px'
                        }}
                        title={emUso > 0 ? 'Não pode excluir: há projetos associados' : 'Excluir Pilar'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '0.6rem 1.4rem', background: '#00BCD4', border: 'none', color: '#000', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
            >
              Concluir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// SUB-COMPONENTE: MODAL DE GERENCIAMENTO DE RESPONSÁVEIS & FUNÇÕES
function GerenciarResponsaveisModal({ responsaveis, projetos, onClose, onSave }) {
  const [lista, setLista] = useState(responsaveis);
  const [novoNome, setNovoNome] = useState('');
  const [novoCargo, setNovoCargo] = useState('');
  const [novoAssina, setNovoAssina] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingNome, setEditingNome] = useState('');
  const [editingCargo, setEditingCargo] = useState('');
  const [editingAssina, setEditingAssina] = useState(false);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!novoNome.trim()) return;

    const id = `resp_${Date.now()}`;
    const novoResp = {
      id,
      nome: novoNome.trim(),
      cargo: novoCargo.trim() || 'Colaborador / Fiscal',
      assinaDocumento: novoAssina
    };

    const updated = [...lista, novoResp];
    setLista(updated);
    onSave(updated);
    setNovoNome('');
    setNovoCargo('');
    setNovoAssina(false);
    window.$toast?.(`Responsável "${novoNome.trim()}" cadastrado com sucesso!`, { type: 'success' });
  };

  const handleStartEdit = (item) => {
    setEditingId(item.id);
    setEditingNome(item.nome);
    setEditingCargo(item.cargo || '');
    setEditingAssina(Boolean(item.assinaDocumento));
  };

  const handleSaveEdit = (id) => {
    if (!editingNome.trim()) return;
    const updated = lista.map(item => item.id === id ? {
      ...item,
      nome: editingNome.trim(),
      cargo: editingCargo.trim() || 'Colaborador / Fiscal',
      assinaDocumento: editingAssina
    } : item);
    setLista(updated);
    onSave(updated);
    setEditingId(null);
    window.$toast?.('Responsável atualizado com sucesso!', { type: 'success' });
  };

  const handleDelete = (id, nome) => {
    const emUso = (projetos || []).filter(p => p.responsavel === nome).length;
    if (emUso > 0) {
      window.$alert?.(`Não é possível excluir pois existem ${emUso} projeto(s) associado(s) a este responsável.`);
      return;
    }
    if (window.confirm(`Tem certeza que deseja excluir o responsável "${nome}"?`)) {
      const updated = lista.filter(item => item.id !== id);
      setLista(updated);
      onSave(updated);
      window.$toast?.('Responsável removido com sucesso.', { type: 'info' });
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem'
    }}>
      <div style={{
        background: '#161a23',
        border: '1px solid rgba(76, 175, 80, 0.4)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users size={22} color="#81C784" />
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', fontWeight: '700' }}>
                Gerenciar Responsáveis & Funções
              </h3>
            </div>
            <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '0.8rem' }}>
              Padronize os membros da equipe, cargos e os signatários que aprovam o relatório de diretoria.
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Formulário Novo Responsável */}
          <form onSubmit={handleAdd} style={{ background: 'rgba(255,255,255,0.03)', padding: '1.1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h4 style={{ margin: '0 0 0.8rem 0', color: '#81C784', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={16} /> Cadastrar Novo Responsável
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '4px', fontWeight: 'bold' }}>
                    Nome do Responsável *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Danilo Machado, Talita Alves..."
                    value={novoNome}
                    onChange={e => setNovoNome(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', background: '#0e1219', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '4px', fontWeight: 'bold' }}>
                    Cargo / Função / Área *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Diretoria Fiscal, Supervisão..."
                    value={novoCargo}
                    onChange={e => setNovoCargo(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', background: '#0e1219', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#cfd8dc' }}>
                <input
                  type="checkbox"
                  checked={novoAssina}
                  onChange={e => setNovoAssina(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span>Exibir como <strong>Signatário da Diretoria</strong> no Relatório Oficial (PDF)</span>
              </label>

              <button
                type="submit"
                disabled={!novoNome.trim()}
                style={{
                  padding: '0.6rem 1.2rem',
                  background: novoNome.trim() ? '#4CAF50' : '#333',
                  color: novoNome.trim() ? '#fff' : '#888',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  cursor: novoNome.trim() ? 'pointer' : 'not-allowed',
                  marginTop: '4px',
                  alignSelf: 'flex-start'
                }}
              >
                + Cadastrar Responsável
              </button>
            </div>
          </form>

          {/* Lista de Responsáveis Cadastrados */}
          <div>
            <h4 style={{ margin: '0 0 0.8rem 0', color: '#ccc', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Equipe & Cargos Cadastrados ({lista.length})
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '320px', overflowY: 'auto' }}>
              {lista.map(item => {
                const isEditing = editingId === item.id;
                const emUso = (projetos || []).filter(p => p.responsavel === item.nome).length;

                if (isEditing) {
                  return (
                    <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#1c2230', padding: '0.8rem', borderRadius: '8px', border: '1px solid #81C784' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <input
                          type="text"
                          value={editingNome}
                          onChange={e => setEditingNome(e.target.value)}
                          placeholder="Nome"
                          style={{ padding: '0.5rem', background: '#0e1219', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '0.85rem' }}
                        />
                        <input
                          type="text"
                          value={editingCargo}
                          onChange={e => setEditingCargo(e.target.value)}
                          placeholder="Cargo / Função"
                          style={{ padding: '0.5rem', background: '#0e1219', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#bbb', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={editingAssina}
                            onChange={e => setEditingAssina(e.target.checked)}
                          />
                          <span>Signatário no Relatório PDF</span>
                        </label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(item.id)}
                            style={{ padding: '0.35rem 0.8rem', background: '#4CAF50', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            style={{ padding: '0.35rem 0.6rem', background: '#333', border: 'none', color: '#aaa', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(0,0,0,0.35)',
                      padding: '0.65rem 0.9rem',
                      borderRadius: '8px',
                      borderLeft: item.assinaDocumento ? '4px solid #81C784' : '4px solid rgba(255,255,255,0.15)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{item.nome}</strong>
                        {item.assinaDocumento && (
                          <span style={{ background: 'rgba(76, 175, 80, 0.2)', color: '#81C784', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                            ✓ Signatário da Diretoria
                          </span>
                        )}
                        <span style={{ fontSize: '0.72rem', color: '#888', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>
                          {emUso} projeto(s)
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#90a4ae', marginTop: '2px' }}>
                        {item.cargo}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        style={{ background: 'transparent', border: 'none', color: '#64B5F6', cursor: 'pointer', padding: '3px' }}
                        title="Editar Responsável"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id, item.nome)}
                        disabled={emUso > 0}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: emUso > 0 ? '#555' : '#EF5350',
                          cursor: emUso > 0 ? 'not-allowed' : 'pointer',
                          padding: '3px'
                        }}
                        title={emUso > 0 ? 'Não pode excluir: há projetos associados' : 'Excluir Responsável'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '0.6rem 1.4rem', background: '#4CAF50', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
            >
              Concluir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
