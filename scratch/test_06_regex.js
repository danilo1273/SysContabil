import * as XLSX from 'xlsx';
import fs from 'fs';

const data = fs.readFileSync('c:/Users/User/Desktop/Consolidado/06.xlsx');
const workbook = XLSX.read(data, { type: 'buffer' });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
const all = [];

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  if (row && row[0]) {
    const val = String(row[0]).trim();
    if (val.startsWith('1.1.1.3.01')) {
       all.push(val + ' - ' + String(row[1]).trim());
    }
  }
}

console.log('Found:', all);
