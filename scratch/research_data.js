import * as XLSX from 'xlsx';
import fs from 'fs';

// 1. Analyze 06.xlsx Columns 9 and 10 again
const buf06 = fs.readFileSync('c:/Users/User/Desktop/Consolidado/06.xlsx');
const wb06 = XLSX.read(buf06, { type: 'buffer' });
const sheet06 = wb06.Sheets['Relatorio impresso somente em'];
const rows06 = XLSX.utils.sheet_to_json(sheet06, { header: 1 });

console.log('--- 06.xlsx (Balancete) ---');
for (let i = 2; i < Math.min(rows06.length, 30); i++) {
  const r = rows06[i];
  if (r[0] && String(r[0]).trim()) {
    console.log(`[${r[0]}] ${r[1]} | DB Mes: ${r[4]} | CR Mes: ${r[5]} | DB Saldo: ${r[6]} | CR Saldo: ${r[7]} | Col9: ${r[8]} | Col10: ${r[9]}`);
  }
}

// 2. Analyze Banco de Dados from INDICADORES.xlsm
const bufInd = fs.readFileSync('c:/Users/User/Desktop/Consolidado/INDICADORES.xlsm');
const wbInd = XLSX.read(bufInd, { type: 'buffer', password: 'admin', bookVBA: true });
const bdSheet = wbInd.Sheets['banco de dados'];
if (bdSheet) {
  console.log('\n--- Banco de dados (INDICADORES.xlsm) ---');
  const rowsBD = XLSX.utils.sheet_to_json(bdSheet, { header: 1 });
  console.log('Headers:', rowsBD[0]);
  for(let i=1; i < Math.min(rowsBD.length, 10); i++) {
     console.log(`Row ${i}:`, rowsBD[i]);
  }
} else {
  console.log('\nSheet "banco de dados" not found. Available sheets:', wbInd.SheetNames);
}
