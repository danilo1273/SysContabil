/**
 * Utilitários para parsing, formatação e cópia de valores financeiros e contábeis
 * no formato brasileiro (R$, pontos de milhar, vírgula decimal, parênteses negativos).
 */

/**
 * Converte qualquer formato de número financeiro/contábil (brasileiro ou internacional)
 * para um float válido em JavaScript.
 * Suporta:
 *   - "1.664,73" -> 1664.73
 *   - "-1.664,73" -> -1664.73
 *   - "(1.664,73)" -> -1664.73
 *   - "1.664,73-" -> -1664.73
 *   - "R$ 1.664,73" ou "R$ -1.664,73" -> 1664.73 ou -1664.73
 *   - "1664,73" -> 1664.73
 *   - "1,664.73" (US) -> 1664.73
 *   - "1664.73" -> 1664.73
 *   - 1664.73 (number) -> 1664.73
 */
export function parseFinancialValue(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  
  let str = String(val).trim();
  if (!str) return 0;

  // Detectar negativo por parênteses contábeis (ex: "(1.234,56)") ou sinal no final (ex: "1.234,56-")
  let isNegative = false;
  if (/^\(.*\)$/.test(str)) {
    isNegative = true;
    str = str.replace(/^\(|\)$/g, '');
  } else if (str.endsWith('-')) {
    isNegative = true;
    str = str.slice(0, -1);
  }

  // Remove "R$", "BRL", espaços, espaços não-quebráveis (\u00A0)
  str = str.replace(/r\s*\$/gi, '').replace(/brl/gi, '').replace(/\s|\u00A0/g, '');

  // Detectar sinal negativo no início após limpar símbolos
  if (str.startsWith('-')) {
    isNegative = true;
    str = str.slice(1);
  } else if (str.endsWith('-')) {
    isNegative = true;
    str = str.slice(0, -1);
  }

  // Strip letras residuais (ex: 'D', 'C')
  str = str.replace(/[a-zA-Z]/g, '');

  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      // Padrão brasileiro: "1.234.567,89" -> remove pontos e troca vírgula por ponto
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Padrão americano: "1,234,567.89" -> remove vírgulas
      str = str.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    // Apenas vírgula(s)
    const commas = (str.match(/,/g) || []).length;
    if (commas === 1) {
      // "1664,73" -> vírgula decimal
      str = str.replace(',', '.');
    } else {
      // "1,234,567" -> separador de milhar americano
      str = str.replace(/,/g, '');
    }
  } else if (lastDot !== -1) {
    // Apenas ponto(s)
    const dots = (str.match(/\./g) || []).length;
    if (dots > 1) {
      // Múltiplos pontos: "1.234.567" -> separador de milhar brasileiro
      str = str.replace(/\./g, '');
    }
  }

  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
}

/**
 * Formata um valor numérico para exibição/edição amigável em inputs de texto
 * Ex: 1664.73 -> "1.664,73" ou "-1.664,73"
 */
export function formatFinancialInput(val) {
  if (val === null || val === undefined || val === '') return '';
  const num = typeof val === 'number' ? val : parseFinancialValue(val);
  if (isNaN(num)) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Copia um valor para a área de transferência de forma limpa e emite notificação
 */
export function copyFinancialValue(val, label = 'Valor') {
  const num = typeof val === 'number' ? val : parseFinancialValue(val);
  const formatted = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(formatted).then(() => {
      if (window.$toast) window.$toast(`${label} copiado: ${formatted}`, { type: 'info' });
    }).catch(() => {
      fallbackCopy(formatted, label);
    });
  } else {
    fallbackCopy(formatted, label);
  }
}

function fallbackCopy(text, label) {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    if (window.$toast) window.$toast(`${label} copiado: ${text}`, { type: 'info' });
  } catch (e) {
    console.error('Falha ao copiar:', e);
  }
}
