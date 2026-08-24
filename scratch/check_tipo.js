import * as XLSX from 'xlsx';
import fs from 'fs';

const buf06 = fs.readFileSync('c:/Users/User/Desktop/Consolidado/06.xlsx');
const wb06 = XLSX.read(buf06, { type: 'buffer' });
const sheet06 = wb06.Sheets['Relatorio impresso somente em'];

const rows06 = XLSX.utils.sheet_to_json(sheet06, { header: 1 });
console.log('--- 06.xlsx first rows ---');
for (let i = 2; i < 10; i++) {
  console.log(`Row ${i}:`, rows06[i]);
}
