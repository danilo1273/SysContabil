import * as XLSX from 'xlsx';
import fs from 'fs';

const bufInd = fs.readFileSync('c:/Users/User/Desktop/Consolidado/INDICADORES.xlsm');
const wbInd = XLSX.read(bufInd, { type: 'buffer', password: 'admin' });
const dbSheet = wbInd.Sheets['DB'];
const rows = XLSX.utils.sheet_to_json(dbSheet, { header: 1 });

const headerRow = rows[3];
const dataRows = rows.slice(4, 10); // just first few rows

console.log('--- Dates ---');
const dateCols = [];
for (let i = 2; i < headerRow.length; i++) {
  const val = headerRow[i];
  if (typeof val === 'number' && val > 40000) {
     const date = new Date((val - 25569) * 86400 * 1000);
     dateCols.push({ colIndex: i, ano: date.getUTCFullYear(), mes: date.getUTCMonth() + 1 });
  }
}
console.log(`Found ${dateCols.length} valid date columns. First 3:`, dateCols.slice(0, 3));

console.log('\n--- Accounts ---');
const allAccounts = [];
for (let i = 4; i < rows.length; i++) {
  if (rows[i][0]) allAccounts.push(String(rows[i][0]));
}

let analiticas = 0;
let sinteticas = 0;
for (let i = 0; i < allAccounts.length; i++) {
  const parent = allAccounts[i];
  let isAnalitica = true;
  for (let j = 0; j < allAccounts.length; j++) {
    if (i !== j && allAccounts[j].startsWith(parent)) {
      isAnalitica = false;
      break;
    }
  }
  if (isAnalitica) analiticas++; else sinteticas++;
}
console.log(`Total Accounts: ${allAccounts.length}. Analiticas: ${analiticas}, Sinteticas: ${sinteticas}`);
