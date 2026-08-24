import * as XLSX from 'xlsx';
import fs from 'fs';

const data = fs.readFileSync('c:/Users/User/Desktop/Consolidado/INDICADORES.xlsm');
const wb = XLSX.read(data, {type: 'buffer'});
const sheet = wb.Sheets['INDICADORES'];
const rows = XLSX.utils.sheet_to_json(sheet, {header: 1});

for(let i=0; i<30; i++) {
  if (rows[i] && rows[i].some(c => c)) {
    console.log(\`Row \${i}:\`, rows[i].filter(c => c));
  }
}
