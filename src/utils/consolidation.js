/**
 * Aplica as regras de consolidação CPC 36 (Soma e Eliminações).
 * @param {Object} parsedData - Dados extraídos de cada empresa.
 * @param {string} period - Período selecionado.
 * @returns {Object} - Estrutura tabular pronta para renderização (DRE, Ativo, Passivo).
 */
export const consolidateData = (parsedData, period, manualExclusions = {}) => {
  const uploadedCompanyIds = Object.keys(parsedData);

  const formulas = {
    'RECEITA OPERACIONAL BRUTA': ['Venda de Produtos', 'Revenda de Mercadorias', 'Prestação de Serviços', 'Locações', 'Exportação'],
    'RECEITA OPERACIONAL LÍQUIDA': ['RECEITA OPERACIONAL BRUTA', '(-) Impostos s/ Vendas', '(-) Devoluções s/ Vendas'],
    'LUCRO BRUTO': ['RECEITA OPERACIONAL LÍQUIDA', 'Custo dos Produtos / Merc. Vendidos'],
    'Total Despesas Operacionais': ['Despesas com Vendas', 'Despesas Gerais Administrativas', 'Despesas Tributárias', 'Depreciações / Amortizações', 'Doação/Patrocinio com Incetivos Fiscais'],
    'RESULTADO DAS OPERAÇÕES (E.B.I.T.)': ['LUCRO BRUTO', 'Total Despesas Operacionais'],
    'Total Efeitos Financeiros Líquidos': ['Receitas Financeiras', 'Despesas Financeiras', 'Variações Monetárias / Cambiais Líquidas', 'Ajustes Financeiros'],
    'LUCRO (PREJUÍZO) OPERACIONAL': ['RESULTADO DAS OPERAÇÕES (E.B.I.T.)', 'Total Efeitos Financeiros Líquidos', 'RESULTADO COM PARTICIP. SOCIETÁRIA'],
    'LUCRO (PREJUÍZO) ANTES IRPJ / CSSL': ['LUCRO (PREJUÍZO) OPERACIONAL', 'Outras Receitas e Despesas', 'Provisao custo perda Estoque'],
    'Lucro (Prejuizo) Líquido': ['LUCRO (PREJUÍZO) ANTES IRPJ / CSSL', 'Provisão IRPJ', 'Provisão CSLL'],
    'Lucro Antes dos Juros s/ Capital Proprio': ['Lucro (Prejuizo) Líquido', 'Reversão Juros s/ Capital Proprio'],
    'Lucro Liquido Total Empresas': ['Lucro Antes dos Juros s/ Capital Proprio'],
    
    'ATIVO CIRCULANTE': ['Caixa e Bancos', 'Aplicacoes Financeiras', 'Duplicatas a Receber', 'Clientes Exterior', '(-)Prov P/Credito de Liquidacao Duvidosa', 'Impostos e Contribuicoes a Recuperar', 'Estoques', 'Adiantamentos a Fornecedores', 'Adiantamentos - Despachante Aduaneiro', 'Adiantamento - Funcionários', 'Adiantamento de Viagem', 'Adto a Fornecedores Exterior', 'Adiantamentos - Partes Relacionadas', 'Programa Apoio Empreendedor', 'Compra - Entrega Futura', 'Outros Adiantamentos', 'Outros Recebíveis', 'Despesas Exercicio Seguinte'],
    'REALIZAVEL A LONGO PRAZO': ['Clientes Longo Prazo', 'Depositos e Caucoes', 'Títulos de Capitalização'],
    'INVESTIMENTOS': ['Participações Societaria', 'Aplicações Financeiras LP'],
    'INTANGIVEL': ['Modelos, Projetos e Prototipos', 'Direito Uso Software', 'Marcas e Patentes', 'Paginas de Internet / Sites', 'Amortizacao Acumulada'],
    'ATIVO NAO CIRCULANTE': ['REALIZAVEL A LONGO PRAZO', 'INVESTIMENTOS', 'IMOBILIZADO TECNICO', 'INTANGIVEL'],
    'ATIVO': ['ATIVO CIRCULANTE', 'ATIVO NAO CIRCULANTE'],
    
    'PASSIVO CIRCULANTE': ['Fornecedores Nacionais', 'Fornecedores No Exterior', 'Emprestimos E Financimentos - TERCEIROS', 'Salarios e Encargos Sociais', 'Impostos e Contribuicoes', 'Provisao do Imposto de Renda e CSSLL', 'Dividendos', 'Adiantamento Terceiros', 'Outras Contas'],
    'PASSIVO NAO CIRCULANTE': ['Emprestimos de Terceiros LP', 'Fornecedores Nacionais LP', 'Dividendos Longo Prazo'],
    'PATRIMONIO LIQUIDO': ['Capital Social', 'Reserva de Lucros', 'Reservas de Capital', 'Lucros Acumulados', 'Ajustes Exercicios Anteriores', 'Lucro do Exercicio', '( - ) Dividendos'],
    'PASSIVO': ['PASSIVO CIRCULANTE', 'PASSIVO NAO CIRCULANTE', 'PATRIMONIO LIQUIDO', 'Participação Empresas']
  };

  const extractValueFromText = (contaNome, fullText) => {
    if (!fullText) return 0;
    const escapedConta = contaNome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedConta + '\\s*(?:R\\$\\s*)?(\\(?\\s*\\d{1,3}(?:\\.\\d{3})*(?:,\\d{2})?\\s*\\)?|-\\s*\\d{1,3}(?:\\.\\d{3})*(?:,\\d{2})?)', 'i');
    
    const match = fullText.match(regex);
    if (match && match[1]) {
      let valStr = match[1];
      let isNegative = valStr.includes('(') || valStr.includes('-');
      let cleanStr = valStr.replace(/[^\d,]/g, '');
      if (!cleanStr) return 0;
      cleanStr = cleanStr.replace(',', '.');
      let val = parseFloat(cleanStr) || 0;
      return isNegative ? -val : val;
    }
    return 0; 
  };

  const processSection = (linesArray, sectionType) => {
    const baseAccountName = sectionType === 'dre' ? 'RECEITA OPERACIONAL LÍQUIDA' : (sectionType === 'ativo' ? 'ATIVO' : 'PASSIVO');
    
    // Pré-calcula soma e exclusões apenas das contas analíticas (que tem valor lido do PDF)
    const linesData = {};
    linesArray.forEach(line => {
      let soma = 0;
      uploadedCompanyIds.forEach(compId => {
        soma += extractValueFromText(line.conta, parsedData[compId]);
      });
      
      let exclusoes = 0;
      if (manualExclusions[line.conta] !== undefined && manualExclusions[line.conta] !== '') {
        exclusoes = Number(manualExclusions[line.conta]);
      }
      linesData[line.conta] = { soma, exclusoes };
    });

    // Função que calcula o consolidado seguindo a matemática do Excel
    const getConsolidado = (conta) => {
      // Se é conta totalizadora, desce e soma o consolidado dos filhos
      if (formulas[conta]) {
        return formulas[conta].reduce((acc, childConta) => acc + getConsolidado(childConta), 0);
      }
      // Se é conta analítica, Consolidado = Soma das empresas - Exclusão Manual
      if (linesData[conta]) {
        return linesData[conta].soma - linesData[conta].exclusoes;
      }
      return 0;
    };

    const baseValues = {};
    uploadedCompanyIds.forEach(compId => {
      baseValues[compId] = Math.abs(extractValueFromText(baseAccountName, parsedData[compId])) || 1;
    });

    return linesArray.map(line => {
      const finalLine = { conta: line.conta, isTotal: line.isTotal };
      
      uploadedCompanyIds.forEach(compId => {
        const val = extractValueFromText(line.conta, parsedData[compId]);
        finalLine[compId] = val;
        
        const pct = (val / baseValues[compId]) * 100;
        finalLine[`${compId}_pct`] = pct.toFixed(2).replace('.', ',') + '%';
      });

      // A coluna exclusões só exibe o valor digitado manualmente, deixando em 0 os totais automáticos
      finalLine.exclusoes = linesData[line.conta] ? linesData[line.conta].exclusoes : 0;
      
      // A coluna consolidado resolve a matemática (Soma - Exclusões ou Soma dos filhos conslidados)
      finalLine.consolidado = getConsolidado(line.conta);
      
      return finalLine;
    });
  };

  const calcConsolidatedPct = (processedLines, sectionType) => {
    const baseAccountName = sectionType === 'dre' ? 'RECEITA OPERACIONAL LÍQUIDA' : (sectionType === 'ativo' ? 'ATIVO' : 'PASSIVO');
    const baseRow = processedLines.find(r => r.conta === baseAccountName);
    const baseVal = baseRow ? Math.abs(baseRow.consolidado) : 1;
    
    return processedLines.map(line => {
      const pct = (line.consolidado / (baseVal || 1)) * 100;
      return { ...line, consolidado_pct: pct.toFixed(2).replace('.', ',') + '%' };
    });
  };

  const dreLines = [
    { conta: 'Venda de Produtos' },
    { conta: 'Revenda de Mercadorias' },
    { conta: 'Prestação de Serviços' },
    { conta: 'Locações', isZero: true },
    { conta: 'Exportação' },
    { conta: 'RECEITA OPERACIONAL BRUTA', isTotal: true },
    { conta: '(-) Impostos s/ Vendas' },
    { conta: '(-) Devoluções s/ Vendas' },
    { conta: 'RECEITA OPERACIONAL LÍQUIDA', isTotal: true },
    { conta: 'Custo dos Produtos / Merc. Vendidos' },
    { conta: 'LUCRO BRUTO', isTotal: true },
    { conta: 'Despesas com Vendas' },
    { conta: 'Despesas Gerais Administrativas' },
    { conta: 'Despesas Tributárias' },
    { conta: 'Depreciações / Amortizações' },
    { conta: 'Doação/Patrocinio com Incetivos Fiscais', isZero: true },
    { conta: 'Total Despesas Operacionais', isTotal: true },
    { conta: 'RESULTADO DAS OPERAÇÕES (E.B.I.T.)', isTotal: true },
    { conta: 'Receitas Financeiras' },
    { conta: 'Despesas Financeiras' },
    { conta: 'Variações Monetárias / Cambiais Líquidas' },
    { conta: 'Ajustes Financeiros', isZero: true },
    { conta: 'Total Efeitos Financeiros Líquidos', isTotal: true },
    { conta: 'RESULTADO COM PARTICIP. SOCIETÁRIA', isTotal: true },
    { conta: 'LUCRO (PREJUÍZO) OPERACIONAL', isTotal: true },
    { conta: 'Outras Receitas e Despesas' },
    { conta: 'Provisao custo perda Estoque', isZero: true },
    { conta: 'LUCRO (PREJUÍZO) ANTES IRPJ / CSSL', isTotal: true },
    { conta: 'Provisão IRPJ' },
    { conta: 'Provisão CSLL' },
    { conta: 'Lucro (Prejuizo) Líquido', isTotal: true },
    { conta: 'Reversão Juros s/ Capital Proprio', isZero: true },
    { conta: 'Lucro Antes dos Juros s/ Capital Proprio', isTotal: true },
    { conta: 'Lucro Liquido Total Empresas', isTotal: true },
    { conta: 'Participação Outras Empresas 85,5%', isTotal: true }
  ];

  const ativoLines = [
    { conta: 'ATIVO CIRCULANTE', isTotal: true },
    { conta: 'Caixa e Bancos' },
    { conta: 'Aplicacoes Financeiras' },
    { conta: 'Duplicatas a Receber' },
    { conta: 'Clientes Exterior' },
    { conta: '(-)Prov P/Credito de Liquidacao Duvidosa' },
    { conta: 'Impostos e Contribuicoes a Recuperar' },
    { conta: 'Estoques' },
    { conta: 'Adiantamentos a Fornecedores' },
    { conta: 'Adiantamentos - Despachante Aduaneiro' },
    { conta: 'Adiantamento - Funcionários' },
    { conta: 'Adiantamento de Viagem' },
    { conta: 'Adto a Fornecedores Exterior' },
    { conta: 'Adiantamentos - Partes Relacionadas', isZero: true },
    { conta: 'Programa Apoio Empreendedor' },
    { conta: 'Compra - Entrega Futura' },
    { conta: 'Outros Adiantamentos', isZero: true },
    { conta: 'Outros Recebíveis' },
    { conta: 'Despesas Exercicio Seguinte' },
    { conta: 'ATIVO NAO CIRCULANTE', isTotal: true },
    { conta: 'REALIZAVEL A LONGO PRAZO', isTotal: true },
    { conta: 'Clientes Longo Prazo' },
    { conta: 'Depositos e Caucoes' },
    { conta: 'Títulos de Capitalização', isZero: true },
    { conta: 'INVESTIMENTOS', isTotal: true },
    { conta: 'Participações Societaria', isZero: true },
    { conta: 'Aplicações Financeiras LP', isZero: true },
    { conta: 'IMOBILIZADO TECNICO', isTotal: true },
    { conta: 'INTANGIVEL', isTotal: true },
    { conta: 'Modelos, Projetos e Prototipos' },
    { conta: 'Direito Uso Software' },
    { conta: 'Marcas e Patentes' },
    { conta: 'Paginas de Internet / Sites' },
    { conta: 'Amortizacao Acumulada' },
    { conta: 'ATIVO', isTotal: true }
  ];

  const passivoLines = [
    { conta: 'PASSIVO CIRCULANTE', isTotal: true },
    { conta: 'Fornecedores Nacionais' },
    { conta: 'Fornecedores No Exterior' },
    { conta: 'Emprestimos E Financimentos - TERCEIROS' },
    { conta: 'Salarios e Encargos Sociais' },
    { conta: 'Impostos e Contribuicoes' },
    { conta: 'Provisao do Imposto de Renda e CSSLL' },
    { conta: 'Dividendos' },
    { conta: 'Adiantamento Terceiros' },
    { conta: 'Outras Contas', isZero: true },
    { conta: 'PASSIVO NAO CIRCULANTE', isTotal: true },
    { conta: 'Emprestimos de Terceiros LP' },
    { conta: 'Fornecedores Nacionais LP', isZero: true },
    { conta: 'Dividendos Longo Prazo' },
    { conta: 'PATRIMONIO LIQUIDO', isTotal: true },
    { conta: 'Capital Social' },
    { conta: 'Reserva de Lucros' },
    { conta: 'Reservas de Capital', isZero: true },
    { conta: 'Lucros Acumulados' },
    { conta: 'Ajustes Exercicios Anteriores' },
    { conta: 'Lucro do Exercicio' },
    { conta: '( - ) Dividendos' },
    { conta: 'Participação Empresas', isZero: true },
    { conta: 'PASSIVO', isTotal: true }
  ];

  const dre = calcConsolidatedPct(processSection(dreLines, 'dre'), 'dre');
  const ativo = calcConsolidatedPct(processSection(ativoLines, 'ativo'), 'ativo');
  const passivo = calcConsolidatedPct(processSection(passivoLines, 'passivo'), 'passivo');

  return { dre, ativo, passivo };
};
