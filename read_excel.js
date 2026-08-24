import pkg from 'xlsx';
const { readFile, utils } = pkg;

try {
  console.log('--- Lendo INDICADORES.xlsm ---');
  const wb = readFile('INDICADORES.xlsm', { bookVBA: true, password: 'admin' });
  console.log('Planilhas encontradas:', wb.SheetNames);
  
  console.log('--- Lendo aba FORMULAS ---');
  const sheet = wb.Sheets['FORMULAS'];
  if (sheet) {
    const data = utils.sheet_to_json(sheet, { header: 1 });
    console.log(data.slice(0, 30));
  }

  console.log('\n\n--- Lendo 06.xlsx (Possível Protheus) ---');
  const wb2 = readFile('06.xlsx');
  console.log('Planilhas encontradas:', wb2.SheetNames);
  for (const sheetName of wb2.SheetNames) {
    console.log(`\n=== Planilha: ${sheetName} ===`);
    const sheet = wb2.Sheets[sheetName];
    if (!sheet) continue;
    
    const data = utils.sheet_to_json(sheet, { header: 1 });
    console.log(data.slice(0, 10));
  }

} catch (err) {
  console.error('Erro ao ler Excel:', err.message);
}
