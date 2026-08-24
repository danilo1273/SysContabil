import * as XLSX from 'xlsx';
import fs from 'fs';

const bufInd = fs.readFileSync('c:/Users/User/Desktop/Consolidado/INDICADORES.xlsm');
const wbInd = XLSX.read(bufInd, { type: 'buffer', password: 'admin', bookVBA: true });

['DB', 'DADOS', 'BDINDICADORES', 'BDDRE'].forEach(sheetName => {
  const sheet = wbInd.Sheets[sheetName];
  if (sheet) {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log('Headers:', rows[0]);
    console.log('Row 1:', rows[1]);
    console.log('Row 2:', rows[2]);
  }
});
