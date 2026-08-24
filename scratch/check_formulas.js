import * as XLSX from 'xlsx';
import fs from 'fs';

const buf06 = fs.readFileSync('c:/Users/User/Desktop/Consolidado/06.xlsx');
const wb06 = XLSX.read(buf06, { type: 'buffer', cellFormula: true });
const sheet06 = wb06.Sheets['Relatorio impresso somente em'];

console.log('--- 06.xlsx (Formulas) ---');
for (let i = 2; i < 50; i++) {
  const rIdx = i + 1; // 1-based row index in Excel
  const cellI = sheet06['I' + rIdx]; // Col 9
  const cellJ = sheet06['J' + rIdx]; // Col 10
  const cellA = sheet06['A' + rIdx];
  
  if (cellA && cellA.v && String(cellA.v).startsWith('3.')) {
     console.log(`Row ${rIdx} [${cellA.v}]`);
     if (cellI) console.log(`  Col9 Val: ${cellI.v} | Frm: ${cellI.f}`);
     if (cellJ) console.log(`  Col10 Val: ${cellJ.v} | Frm: ${cellJ.f}`);
  }
}
