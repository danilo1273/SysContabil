-- Tabela de Histórico da DRE
CREATE TABLE dre_history (
    id TEXT PRIMARY KEY,
    "empresaId" TEXT,
    ano INTEGER,
    mes INTEGER,
    trimestre INTEGER,
    conta TEXT,
    descricao TEXT,
    "valorMensal" DOUBLE PRECISION
);

-- Tabela de Histórico do Balanço Patrimonial
CREATE TABLE balanco_history (
    id TEXT PRIMARY KEY,
    "empresaId" TEXT,
    ano INTEGER,
    mes INTEGER,
    trimestre INTEGER,
    tipo TEXT,
    conta TEXT,
    descricao TEXT,
    "saldoAcumulado" DOUBLE PRECISION
);

-- Tabela de Centro de Custo
CREATE TABLE cc_history (
    id TEXT PRIMARY KEY,
    "empresaId" TEXT,
    ano INTEGER,
    mes INTEGER,
    trimestre INTEGER,
    cc_codigo TEXT,
    cc_descricao TEXT,
    conta TEXT,
    conta_descricao TEXT,
    valor DOUBLE PRECISION
);

-- Tabela de Usuários
CREATE TABLE agf_users (
    id TEXT PRIMARY KEY,
    username TEXT,
    password TEXT,
    role TEXT
);

-- Tabela de Controle de Integrações
CREATE TABLE agf_integracoes (
    id TEXT PRIMARY KEY,
    mes INTEGER,
    ano INTEGER,
    tipo TEXT,
    dia_atual INTEGER,
    responsavel TEXT,
    updated_at TEXT
);

-- Tabela de Obrigações Acessórias
CREATE TABLE agf_obrigacoes (
    id TEXT PRIMARY KEY,
    mes INTEGER,
    ano INTEGER,
    tipo TEXT,
    status TEXT,
    data_entrega TEXT,
    responsavel TEXT,
    updated_at TEXT
);

-- Tabela de Pendências Contábeis
CREATE TABLE agf_pendencias (
    id TEXT PRIMARY KEY,
    documento TEXT,
    motivo TEXT,
    responsavel TEXT,
    criador TEXT,
    status TEXT,
    data_criacao TEXT,
    data_correcao TEXT,
    historico TEXT
);

-- Tabela de Configurações e Armazenamento JSON (Ex: PERDCOMP, Regimes de Impostos)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
