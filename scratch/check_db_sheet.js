import * as XLSX from 'xlsx';
import fs from 'fs';

const bufInd = fs.readFileSync('c:/Users/User/Desktop/Consolidado/INDICADORES.xlsm');
const wbInd = XLSX.read(bufInd, { type: 'buffer', password: 'admin' });
const dbSheet = wbInd.Sheets['DB'];

const rows = XLSX.utils.sheet_to_json(dbSheet, { header: 1 });
console.log('--- DB Sheet (Row 3, 4, 5) ---');
console.log('Row 3 (idx 2):', rows[2]);
console.log('Row 4 (idx 3):', rows[3]);
console.log('Row 5 (idx 4):', rows[4]);
console.log('Row 6 (idx 5):', rows[5]);
