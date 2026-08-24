const XLSX = require('xlsx');
const workbook = XLSX.readFile('c:/Users/User/Desktop/Consolidado/INDICADORES.xlsm');
const sheet = workbook.Sheets['DFC'];
if (!sheet) {
  console.log('Sheet DFC not found!');
} else {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  for (let i = 0; i < Math.min(60, data.length); i++) {
     const row = data[i];
     if (row && row.length > 0) {
        console.log('Linha ' + (i+1) + ': ' + row.slice(0, 5).join(' | '));
     }
  }
}
