import * as XLSX from 'xlsx';
import fs from 'fs';

const data = fs.readFileSync('c:/Users/User/Desktop/Consolidado/06.xlsx');
const workbook = XLSX.read(data, { type: 'buffer' });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
const accounts = [];

for (let i = 2; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length < 2) continue;
  const conta = String(row[0]).trim();
  if (conta && conta !== 'undefined') {
    accounts.push(conta);
  }
}

const parent = '1.1.1.3.01';
console.log('Parent:', parent);
const children = accounts.filter(a => a.startsWith(parent));
console.log('Children found:', children.slice(0, 5));

const isAnalitica = !accounts.some(a => a !== parent && a.startsWith(parent + '.'));
console.log('Is Analitica with dot:', isAnalitica);

const isAnaliticaNoDot = !accounts.some(a => a !== parent && a.startsWith(parent));
console.log('Is Analitica NO dot:', isAnaliticaNoDot);
