import * as XLSX from 'xlsx';
import fs from 'fs';

const buf = fs.readFileSync('c:/Users/User/Desktop/Consolidado/INDICADORES.xlsm');
// a senha do VBA é 82190650 e admin, a sheet pode ter protection, let's try reading it.
const workbook = XLSX.read(buf, { type: 'buffer', password: 'admin', bookVBA: true });

const indSheet = workbook.Sheets['INDICADORES'];
if (indSheet) {
  console.log('--- INDICADORES ---');
  const data = XLSX.utils.sheet_to_json(indSheet, { header: 1 });
  console.log(data.slice(0, 30)); // get first 30 rows to see the dashboard layout
}

const dfcSheet = workbook.Sheets['DFC'];
if (dfcSheet) {
  console.log('--- DFC ---');
  const data = XLSX.utils.sheet_to_json(dfcSheet, { header: 1 });
  console.log(data.slice(0, 30));
}
