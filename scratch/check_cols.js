import * as XLSX from 'xlsx';
import fs from 'fs';

const data = fs.readFileSync('c:/Users/User/Desktop/Consolidado/06.xlsx');
const workbook = XLSX.read(data, { type: 'buffer' });
const sheet = workbook.Sheets[workbook.SheetNames[0]];

const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
for (let i = 0; i < 5; i++) {
  console.log(\`Row \${i}:\`, rows[i]);
}
