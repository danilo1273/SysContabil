import * as XLSX from 'xlsx';
import fs from 'fs';

const buf = fs.readFileSync('c:/Users/User/Desktop/Consolidado/06.xlsx');
const workbook = XLSX.read(buf, { type: 'buffer' });
const sheetName = 'Relatorio impresso somente em';
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

for (let i = 2; i < rows.length; i++) {
  const row = rows[i];
  const conta = String(row[0]).trim();
  if (conta.startsWith('3.1.1.1.01.00001')) {
    console.log('Account:', conta, row[1]);
    console.log('Mov Mes DB:', row[4]);
    console.log('Mov Mes CR:', row[5]);
    console.log('Saldo DB:', row[6]);
    console.log('Saldo CR:', row[7]);
    console.log('Col 9:', row[8]);
    console.log('Col 10:', row[9]);
  }
}
