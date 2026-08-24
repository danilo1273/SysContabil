import * as XLSX from 'xlsx';
import fs from 'fs';

const bufInd = fs.readFileSync('c:/Users/User/Desktop/Consolidado/INDICADORES.xlsm');
const wbInd = XLSX.read(bufInd, { type: 'buffer', cellFormula: true, password: 'admin' });

function analyzeSheet(sheetName) {
  const sheet = wbInd.Sheets[sheetName];
  if (!sheet) {
    console.log(`Sheet ${sheetName} not found.`);
    return;
  }
  
  console.log(`\n--- Analyzing ${sheetName} ---`);
  const range = XLSX.utils.decode_range(sheet['!ref']);
  
  for (let R = 0; R <= Math.min(range.e.r, 100); ++R) {
    let rowValues = [];
    let hasProcv = false;
    let procvFormula = '';
    
    for (let C = 0; C <= Math.min(range.e.c, 10); ++C) {
      const cellAddress = XLSX.utils.encode_cell({c: C, r: R});
      const cell = sheet[cellAddress];
      if (!cell) continue;
      
      rowValues.push(`Col${C}: ${cell.v}`);
      if (cell.f && cell.f.toUpperCase().includes('VLOOKUP')) {
        hasProcv = true;
        procvFormula = cell.f;
      } else if (cell.f && cell.f.toUpperCase().includes('PROCV')) {
        hasProcv = true;
        procvFormula = cell.f;
      }
    }
    
    if (rowValues.length > 0) {
      console.log(`Row ${R+1}:`, rowValues.join(' | '));
      if (hasProcv) {
         console.log(`   -> Formula: ${procvFormula}`);
      }
    }
  }
}

analyzeSheet('DRE');
analyzeSheet('BALANCO');
