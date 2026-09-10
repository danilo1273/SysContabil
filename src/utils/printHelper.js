/**
 * Helper utilitário para impressão e exportação de PDF no navegador.
 *
 * Garante que o PDF salvo pelo navegador ("Salvar como PDF") receba o nome padronizado:
 * [Empresa] - [Nome do Relatório] - [Período]
 *
 * Preserva o document.title durante todo o ciclo do diálogo de impressão do navegador
 * e restaura o título original de forma segura via evento 'afterprint'.
 */

export function printReport({ company = '', reportName = 'Relatório', period = '', orientation = null }) {
  const originalTitle = document.title;

  // Formatar padrão: [Empresa] - [Nome do Relatório] - [Período]
  const parts = [];
  if (company && company.trim()) parts.push(company.trim());
  if (reportName && reportName.trim()) parts.push(reportName.trim());
  if (period && period.trim()) parts.push(period.trim());

  const formattedTitle = parts.join(' - ');
  document.title = formattedTitle;

  let cleanupStyle = null;
  if (orientation) {
    cleanupStyle = document.createElement('style');
    cleanupStyle.innerHTML = `@media print { @page { size: A4 ${orientation} !important; } }`;
    document.head.appendChild(cleanupStyle);
  }

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    window.removeEventListener('afterprint', restore);
    if (cleanupStyle && cleanupStyle.parentNode) {
      cleanupStyle.parentNode.removeChild(cleanupStyle);
    }
    // Delay para garantir que o Chrome/Edge/Firefox termine de renderizar os metadados do PDF
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  window.addEventListener('afterprint', restore);

  // Fallback caso afterprint não seja disparado
  setTimeout(restore, 20000);

  window.print();
}
