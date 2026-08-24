import * as XLSX from 'xlsx';
import fs from 'fs';

const bufInd = fs.readFileSync('c:/Users/User/Desktop/Consolidado/INDICADORES.xlsm');
const wbInd = XLSX.read(bufInd, { type: 'buffer', password: 'admin' });
const sheet = wbInd.Sheets['BALANCO'];

const range = XLSX.utils.decode_range(sheet['!ref']);
console.log('--- BALANCO Sheet ---');
for (let R = 0; R <= Math.min(range.e.r, 100); ++R) {
  let rowValues = [];
  for (let C = 0; C <= 5; ++C) {
    const cellAddress = XLSX.utils.encode_cell({c: C, r: R});
    const cell = sheet[cellAddress];
    if (cell) rowValues.push(`Col${C}: ${cell.v}`);
  }
  if (rowValues.length > 0) {
    console.log(`Row ${R+1}:`, rowValues.join(' | '));
  }
}
