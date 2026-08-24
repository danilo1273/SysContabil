import * as pdfjsLib from 'pdfjs-dist/build/pdf.min.mjs';

// Definição do worker para o pdfjs usando CDN unpkg para garantir a versão exata
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Lê o PDF e extrai o texto página por página.
 * @param {File} file - Arquivo PDF recebido do input.
 * @returns {Promise<string>} - Texto completo extraído.
 */
export const extractTextFromPdf = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Agrupar itens por linha (Y)
      const items = textContent.items;
      const lines = [];
      
      items.forEach(item => {
        // transform[5] é a coordenada Y (geralmente bottom-up)
        // transform[4] é a coordenada X
        const y = item.transform[5];
        
        // Procura se já existe uma linha próxima (tolerância de 3 pixels)
        let line = lines.find(l => Math.abs(l.y - y) < 3);
        if (!line) {
          line = { y: y, items: [] };
          lines.push(line);
        }
        line.items.push(item);
      });
      
      // Ordena as linhas de cima para baixo (Y decrescente)
      lines.sort((a, b) => b.y - a.y);
      
      const pageText = lines.map(line => {
        // Ordena os itens da linha da esquerda para a direita (X crescente)
        line.items.sort((a, b) => a.transform[4] - b.transform[4]);
        return line.items.map(i => i.str.trim()).filter(str => str.length > 0).join(' ');
      }).join('\n');
      
      fullText += pageText + '\n';
    } 
    // para transformar o 'fullText' em arrays de contas e valores.
    // Para efeito de demonstração, retornaremos o texto bruto.
    
    console.log(`Texto extraído de ${file.name}:`, fullText.substring(0, 200) + '...');
    
    return fullText;
  } catch (error) {
    console.error("Erro ao ler PDF:", error);
    throw error;
  }
};
