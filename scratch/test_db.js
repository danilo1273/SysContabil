import * as XLSX from 'xlsx';
import fs from 'fs';

const data = fs.readFileSync('c:/Users/User/Desktop/Consolidado/INDICADORES.xlsm');
const workbook = XLSX.read(data, { type: 'buffer' });
const dbSheet = workbook.Sheets['DB'];

const rows = XLSX.utils.sheet_to_json(dbSheet, { header: 1 });
const allAccounts = [];
for (let i = 4; i < rows.length; i++) {
  if (rows[i][0]) allAccounts.push(String(rows[i][0]).trim());
}

const parent = '1.1.1.3.01';
console.log('Parent:', parent);
const children = allAccounts.filter(a => a.startsWith(parent));
console.log('Children found:', children.slice(0, 5));

const isAnaliticaDot = !allAccounts.some(a => a !== parent && a.startsWith(parent + '.'));
console.log('Is Analitica with dot:', isAnaliticaDot);

const isAnaliticaNoDot = !allAccounts.some(a => a !== parent && a.startsWith(parent));
console.log('Is Analitica NO dot:', isAnaliticaNoDot);
