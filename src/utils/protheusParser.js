import * as XLSX from 'xlsx';

/**
 * Lê um arquivo Excel gerado pelo Protheus (Balancete/Razão CTBR044)
 * Detecta automaticamente a aba de relatório (busca por 'relatorio' no nome da aba)
 * 
 * Estrutura das colunas do arquivo:
 *   [0] Conta
 *   [1] Descrição
 *   [2] Mov. Anterior Débito
 *   [3] Mov. Anterior Crédito
 *   [4] Mov. do Mês Débito
 *   [5] Mov. do Mês Crédito
 *   [6] Saldo Débito
 *   [7] Saldo Crédito
 *   [8] Valor calculado Ativo/Passivo (número já pronto, positivo=ativo, negativo=passivo)
 *   [9] Valor calculado DRE (número já pronto, positivo=receita, negativo=despesa)
 *
 * Retorna um objeto onde a chave é o código da conta (ex: '1.1.1.1.01')
 */
export const parseProtheusExcel = async (fileBlob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Detecta a aba de relatório por correspondência parcial no nome
        // Aceita: 'Relatorio impresso somente em', '2-Relatorio impresso somente ', etc.
        const relatorioSheetName = workbook.SheetNames.find(n =>
          n.toLowerCase().includes('relatorio') || n.toLowerCase().includes('relatório')
        ) || workbook.SheetNames[0];

        const sheet = workbook.Sheets[relatorioSheetName];

        if (!sheet) {
          throw new Error('Aba de relatório não encontrada no Excel. Abas disponíveis: ' + workbook.SheetNames.join(', '));
        }

        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const accounts = {};

        const parseNumber = (val) => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') {
            const clean = val.replace(/\./g, '').replace(',', '.');
            const n = parseFloat(clean);
            return isNaN(n) ? 0 : n;
          }
          return 0;
        };

        // Row 0 = título do relatório, Row 1 = cabeçalho das colunas
        // Dados começam no Row 2
        for (let i = 2; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 2) continue;

          const conta = String(row[0] ?? '').trim();
          const descricao = String(row[1] ?? '').trim();

          // Só aceita contas no formato contábil: começa com dígito e contém ponto
          // Ex: '1.1.1.1.01', '3.1.1.2', '4.2.1.1.07.00005', '2.1.1.1.01.MUNIC'
          // Descarta: 'Pergunta 01', 'Data Inicial ?', textos, etc.
          if (!conta || !(/^\d[\d.a-zA-Z_-]+$/.test(conta)) || !conta.includes('.')) continue;

          let valorMensal = 0;
          let valorAcumulado = 0;

          const movDebito = parseNumber(row[4]);
          const movCredito = parseNumber(row[5]);
          const saldoDebito = parseNumber(row[6]);
          const saldoCredito = parseNumber(row[7]);

          if (conta.startsWith('1.')) {
            // Ativo: Natureza Devedora
            valorAcumulado = saldoDebito - saldoCredito;
            valorMensal = valorAcumulado;
          } else if (conta.startsWith('2.')) {
            // Passivo e PL: Natureza Credora
            valorAcumulado = saldoCredito - saldoDebito;
            valorMensal = valorAcumulado;
          } else if (conta.startsWith('3.')) {
            // DRE Receitas: Natureza Credora
            valorMensal = movCredito - movDebito;
            valorAcumulado = valorMensal;
          } else if (conta.startsWith('4.') || conta.startsWith('5.') || conta.startsWith('6.')) {
            // DRE Custos/Despesas: Natureza Devedora
            // Mas precisam ser NEGATIVOS na DRE (subtraem da receita no BD)
            valorMensal = (movDebito - movCredito) * -1;
            valorAcumulado = valorMensal;
          }

          accounts[conta] = {
            descricao,
            mensal: valorMensal,
            acumulado: valorAcumulado
          };
        }

        // Pós-processamento: identifica Contas Analíticas vs Sintéticas
        // Uma conta é SINTÉTICA se alguma outra conta começa com ela + '.'
        const accountCodes = Object.keys(accounts);
        for (let i = 0; i < accountCodes.length; i++) {
          const parentCode = accountCodes[i];
          let isAnalitica = true;
          for (let j = 0; j < accountCodes.length; j++) {
            if (i !== j && accountCodes[j].startsWith(parentCode + '.')) {
              isAnalitica = false;
              break;
            }
          }
          accounts[parentCode].isAnalitica = isAnalitica;
        }

        console.log(`[PARSER] Lidas ${accountCodes.length} contas da aba "${relatorioSheetName}"`);
        const analiticas = accountCodes.filter(k => accounts[k].isAnalitica);
        console.log(`[PARSER] Analíticas: ${analiticas.length} | Sample:`, analiticas.slice(0, 5).map(k => ({ conta: k, mensal: accounts[k].mensal })));

        resolve(accounts);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(fileBlob);
  });
};
