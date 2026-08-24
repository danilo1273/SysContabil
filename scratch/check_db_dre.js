import * as XLSX from 'xlsx';
import fs from 'fs';

const bufInd = fs.readFileSync('c:/Users/User/Desktop/Consolidado/INDICADORES.xlsm');
const wbInd = XLSX.read(bufInd, { type: 'buffer', password: 'admin' });
const dbSheet = wbInd.Sheets['DB'];
const rows = XLSX.utils.sheet_to_json(dbSheet, { header: 1 });

for (let i = 4; i < rows.length; i++) {
  if (rows[i][0] && String(rows[i][0]).startsWith('3.')) {
     console.log(`Row ${i}: [${rows[i][0]}] ${rows[i][1]} | Val: ${rows[i][20]}`); // Just print one column
  }
}
