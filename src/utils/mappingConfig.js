export const protheusMapping = {
  dre: {
    "RECEITA OPERACIONAL BRUTA": {
      "Venda de Produtos": ["3.1.1.1.01.00001"],
      "Revenda de Mercadorias": ["3.1.1.1.01.00002"],
      "Prestação de Serviços": ["3.1.1.1.01.00003"],
      "Locações": ["3.1.1.1.01.00004"],
      "Exportação": ["3.1.1.1.01.00006"]
    },
    "DEDUÇÕES DA RECEITA": {
      "(-) Impostos s/ Vendas": ["3.1.1.2.01"],
      "(-) Devoluções s/ Vendas": ["3.1.1.2.02"]
    },
    "CUSTOS": {
      "Custo Produto Vendido": ["4.1.1.1.13"],
      "Custo Mercadorias Revendidas": ["4.1.1.1.20"],
      "Salários e encargos": ["4.1.1.1.01", "4.1.1.2.01"],
      "Material de Uso e Consumo": ["4.1.1.1.07.00007", "4.1.1.2.07.00008"],
      "Viagens, Estadias e Refeições": ["4.1.1.1.04", "4.1.1.2.04"],
      "Desp. Veic / Manut. / Combust.": ["4.1.1.1.05", "4.1.1.2.05"],
      "Manutenção Máquinas e Equiptos": ["4.1.1.1.07.00005", "4.1.1.1.07.00006", "4.1.1.2.07.00006", "4.1.1.2.07.00007"],
      "Outros Custos e Serviços": ["4.1.1.1.07.00002", "4.1.1.1.07.00001", "4.1.1.1.07.00009", "4.1.1.1.07.00003", "4.1.1.1.07.00004", "4.1.1.1.07.00008", "4.1.1.1.07.00010", "4.1.1.2.07.00002", "4.1.1.2.07.00001", "4.1.1.2.07.00005", "4.1.1.2.07.00003", "4.1.1.2.07.00009"]
    },
    "DESPESAS COM VENDAS": {
      "Despesas com Pessoal": ["4.2.1.1.01"],
      "Transportes s/ Vendas": ["4.2.1.1.02"],
      "Comissões sobre Vendas": ["4.2.1.1.03"],
      "Propaganda e Publicidade": ["4.2.1.1.04"],
      "Despesas de Viagens": ["4.2.1.1.05"],
      "Despesas com Veículos": ["4.2.1.1.06"],
      "Outras Despesas com Vendas": ["4.2.1.1.90"]
    },
    "DESPESAS ADMINISTRATIVAS": {
      "Despesas com Pessoal": ["4.2.1.2.01"],
      "Serviços Profissionais / Terceiros": ["4.2.1.2.02"],
      "Despesas com Ocupação": ["4.2.1.2.03"],
      "Utilidades e Serviços": ["4.2.1.2.04"],
      "Consumo de Materiais e Produtos": ["4.2.1.2.05"],
      "Despesas de Viagens": ["4.2.1.2.06"],
      "Despesas com Veículos": ["4.2.1.2.07"],
      "Despesas Gerais": ["4.2.1.2.08"],
      "Outras Desp.Administrativas": ["4.2.1.2.90", "!4.2.1.2.90.00001", "!4.2.1.2.90.00020"]
    },
    "DESPESAS TRIBUTÁRIAS": {
      "Tributárias": ["4.2.1.2.20"]
    },
    "DESPESAS DE RATEIO": {
      "Despesas Absorvidas de Rateio": ["9.9.9.9"]
    },
    "DEPRECIAÇÕES / AMORTIZAÇÕES": {
      "Depreciações": ["4.2.1.2.25"]
    },
    "DOAÇÕES / INCENTIVOS FISCAIS": {
      "Doação/Patrocinio com Incetivos Fiscais": ["4.2.1.2.90.00001", "4.2.1.2.90.00020"]
    },
    "RECEITAS FINANCEIRAS": {
      "Receitas Financeiras": ["4.3.1.1.01"]
    },
    "DESPESAS FINANCEIRAS": {
      "Despesas Financeiras (Exceto Reversão JSCP)": [
        "4.3.1.1.02", "!4.3.1.1.02.00008"
      ]
    },
    "VARIAÇÕES MONETÁRIAS / CAMBIAIS LÍQUIDAS": {
      "Variações Monetárias / Cambiais": ["4.3.1.1.03"]
    },
    "AJUSTES FINANCEIROS": {
      "Ajustes Financeiros": ["4.3.1.1.04"]
    },
    "RESULTADO COM PARTICIP. SOCIETÁRIA": {
      "Resultado com Particip. Societária": ["4.4"]
    },
    "OUTRAS RECEITAS E DESPESAS": {
      "Outras Receitas Diversas": ["4.3.2"],
      "Outras Receitas Operacionais": ["4.9.1.2", "4.9.1.1"]
    },
    "PROVISÃO IRPJ": {
      "Provisão IRPJ": ["7"]
    },
    "PROVISÃO CSLL": {
      "Provisão CSLL": ["6"]
    },
    "REVERSÃO JUROS S/ CAPITAL PROPRIO": {
      "Reversão Juros s/ Capital Proprio": ["4.3.1.1.02.00008"]
    }
  },
  ativo: {
    "ATIVO CIRCULANTE": {
      "Caixa e Bancos": ["1.1.1.1"],
      "Aplicacoes Financeiras": ["1.1.1.2"],
      "Duplicatas a Receber": ["1.1.1.3.01", "1.1.1.3.02"],
      "Clientes Exterior": ["1.1.1.3.03"],
      "(-)Prov P/Credito de Liquidacao Duvidosa": ["1.1.1.3.90"],
      "Impostos e Contribuicoes a Recuperar": ["1.1.1.5"],
      "Estoques": ["1.1.1.6"],
      "Adiantamentos a Fornecedores": ["1.1.1.7.01"],
      "Adiantamentos - Despachante Aduaneiro": ["1.1.1.7.02"],
      "Adiantamento - Funcionários": ["1.1.1.7.03"],
      "Adiantamento de Viagem": ["1.1.1.7.04"],
      "Adto a Fornecedores Exterior": ["1.1.1.7.05"],
      "Adiantamentos - Partes Relacionadas": ["1.1.1.7.06"],
      "Compra - Entrega Futura": ["1.1.1.7.07"],
      "Outros Adiantamentos": ["1.1.1.7.90"],
      "Programa Apoio Empreendedor": ["1.1.1.7.08"],
      "Outros Recebíveis": ["1.1.1.8"],
      "Despesas Exercicio Seguinte": ["1.1.1.9"]
    },
    "REALIZAVEL A LONGO PRAZO": {
      "Depositos e Caucoes": ["1.3.1.1"],
      "Clientes Longo Prazo": ["1.3.1.3"]
    },
    "INVESTIMENTOS": {
      "Participações Societaria": ["1.3.2.2"],
      "Aplicações Financeiras LP": ["1.3.2.3"]
    },
    "IMOBILIZADO TECNICO": {
      "Moveis e Utensilios": ["1.3.3.1.01.00003"],
      "Veiculos": ["1.3.3.1.01.00009"],
      "Edificios": ["1.3.3.1.01.00002"],
      "Veiculos - Leasing Financeiro": ["1.3.3.5.01.00002"],
      "Equipamentos de Informatica": ["1.3.3.1.01.00005"],
      "Maquinas e Equipamentos - Produção": ["1.3.3.1.01.00006"],
      "Instalacoes": ["1.3.3.1.01.00007"],
      "Ferramentas / Moldes": ["1.3.3.1.01.00008"],
      "Aparelhos de Telefonia": ["1.3.3.1.01.00010"],
      "Benfeitorias em Imoveis de Terceiros": ["1.3.3.1.01.00012"],
      "Imobilizado em Andamento": ["1.3.3.1.03"],
      "Depreciacao/Amortizacao Acumulada": ["1.3.3.1.99"],
      "Depreciações - Leasing Financeiro": ["1.3.3.5.99"]
    },
    "INTANGIVEL": {
      "Modelos, Projetos e Prototipos": ["1.3.4.1.01.00004"],
      "Direito Uso Software": ["1.3.4.1.01.00001"],
      "Marcas e Patentes": ["1.3.4.1.01.00002"],
      "Paginas de Internet / Sites": ["1.3.4.1.01.00003"],
      "Amortizacao Acumulada": ["1.3.4.1.99"]
    }
  },
  passivo: {
    "PASSIVO CIRCULANTE": {
      "Fornecedores Nacionais": ["2.1.1.1.01"],
      "Fornecedor - Compras para Entrega Futura": ["2.1.1.1.02"],
      "Fornecedores No Exterior": ["2.1.1.1.03"],
      "Emprestimos E Financimentos - TERCEIROS": ["2.1.1.2"],
      "Salarios e Encargos Sociais": ["2.1.1.4"],
      "Impostos e Contribuições a Recolher": ["2.1.1.5.01", "2.1.1.5.02"],
      "Provisao do Imposto de Renda e CSSLL": ["2.1.1.6"],
      "Dividendos": ["2.1.1.7.01"],
      "Juros s/ Capital Proprio": ["2.1.1.7.02"],
      "Adiantamento Terceiros": ["2.1.1.8"]
    },
    "PASSIVO NAO CIRCULANTE": {
      "Emprestimos de Terceiros LP": ["2.3.1"],
      "Dividendos Longo Prazo": ["2.3.6.1"]
    },
    "PATRIMONIO LIQUIDO": {
      "Capital Social": ["2.9.1"],
      "Reserva de Lucros": ["2.9.4.1.01.00001"],
      "Lucros Acumulados": ["2.9.8.1.01.00002"],
      "Ajustes Exercicios Anteriores": ["2.9.8.1.01.00007", "2.9.8.1.01.00004"],
      "Lucro do Exercício": [],
      "(-) Dividendos Distribuídos": ["2.9.9.1.01.00002"]
    }
  },
  dfc_lucro_ajuste_dre: {
    "Ajustes DRE": {
      "Depreciações / Amortizações": ["4.2.1.2.25"],
      "Equivalência Patrimonial": ["4.4"]
    }
  },
  dfc_lucro_ajuste_ativo: {
    "Ajustes Ativo": {
      "(-)Prov P/Credito de Liquidacao Duvidosa": ["1.1.1.3.90"]
    }
  },
  dfc_lucro_ajuste_passivo: {
    "Ajustes Passivo": {
      "Ajuste Exercicio Anteriores": ["2.9.8.1.01.00007"]
    }
  },
  dfc_ativo: {
    "Variação": {
      "Contas a receber / titulos a receber": ["1.1.1.3.01", "1.1.1.3.02", "1.1.1.3.03"],
      "Tributos a compensar": ["1.1.1.5"],
      "Depósitos e Cauções": ["1.3.1.1"],
      "Estoques": ["1.1.1.6"],
      "Adiantamentos": ["1.1.1.7"],
      "Outros Créditos / Valores a Classificar": ["1.1.1.8"],
      "Despesas de Exercícios Seguintes": ["1.1.1.9"],
      "Títulos de Capitalização": ["1.3.1.2"]
    }
  },
  dfc_passivo: {
    "Variação": {
      "Fornecedores": ["2.1.1.1"],
      "Salários e encargos": ["2.1.1.4"],
      "Tributos a recolher": ["2.1.1.5", "2.1.1.6"],
      "Adiantamentos de Terceiros": ["2.1.1.8"],
      "Outras": ["2.1.1.99"]
    }
  },
  dfc_investimento: {
    "Investimentos": {
      "Investimentos - Participação Societária": ["1.3.2.2"],
      "(Aquisições) / vendas de imobilizado": ["1.3.3.1.01", "1.3.3.1.03", "1.3.3.5.01"],
      "Intangível (Softwares, Projetos)": ["1.3.4.1.01"],
      "Aplicação Longo Prazo": ["1.3.2.3"],
      "Aplicações Financeiras CP": ["1.1.1.2"]
    }
  },
  dfc_financiamento: {
    "Financiamentos": {
      "Dividendos propostos e pagos e juros sobre capital próprio": ["2.9.9.1.01.00002", "2.1.1.7"],
      "Captação (pagamento) de empréstimos": ["2.1.1.2", "2.3.1.1"],
      "Aumento / (Redução) de Capital Social": ["2.9.1"]
    }
  },
  dfc_caixa: {
    "Saldos": {
      "Caixa e Equivalentes": ["1.1.1.1"]
    }
  }
};

/**
 * Função otimizada para aplicar o mapeamento suportando drill-down 
 * Retorna os totais e um array com o detalhamento conta a conta para auditoria no frontend.
 */
export const applyMapping = (dbData, groupMapping = {}, multiplier = 1, valueField = 'valorMensal') => {
  const result = {};

  for (const [groupName, accountsMap] of Object.entries(groupMapping)) {
    result[groupName] = {};
    let groupTotal = 0;
    
    for (const [lineName, prefixes] of Object.entries(accountsMap)) {
      let lineTotal = 0;
      let details = [];
      
      const dbDataArray = Array.isArray(dbData) 
          ? dbData 
          : Object.entries(dbData || {}).map(([conta, data]) => ({ conta, ...data }));
          
      const includePrefixes = prefixes.filter(p => !p.startsWith('!'));
      const excludePrefixes = prefixes.filter(p => p.startsWith('!')).map(p => p.slice(1));

      const matchedRecords = dbDataArray.filter(d => {
        const matchInclude = includePrefixes.some(prefix => d.conta.startsWith(prefix));
        const matchExclude = excludePrefixes.some(prefix => d.conta.startsWith(prefix));
        return matchInclude && !matchExclude;
      });
      
      matchedRecords.forEach(d => {
        const val = (d[valueField] || 0) * multiplier;
        lineTotal += val;
        details.push({
          conta: d.conta,
          descricao: d.descricao,
          valor: val
        });
      });
      
      details.sort((a, b) => a.conta.localeCompare(b.conta));
      
      result[groupName][lineName] = {
        total: lineTotal,
        details: details
      };
      
      groupTotal += lineTotal;
    }
    
    result[groupName]['TOTAL'] = { total: groupTotal };
  }

  return result;
};
