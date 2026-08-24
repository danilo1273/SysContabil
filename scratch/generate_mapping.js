import * as XLSX from 'xlsx';
import fs from 'fs';

const bufInd = fs.readFileSync('c:/Users/User/Desktop/Consolidado/INDICADORES.xlsm');
const wbInd = XLSX.read(bufInd, { type: 'buffer', password: 'admin' });

function generateDREMapping() {
  const sheet = wbInd.Sheets['DRE'];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  
  const mapping = {};
  let currentGroup = 'Outros';
  
  for (let R = 0; R <= Math.min(range.e.r, 100); ++R) {
    const col2 = sheet[XLSX.utils.encode_cell({c: 2, r: R})]?.v; // prefix or group identifier
    const col3 = sheet[XLSX.utils.encode_cell({c: 3, r: R})]?.v; // group letter A -, B -
    const col5 = sheet[XLSX.utils.encode_cell({c: 5, r: R})]?.v; // Description
    
    if (!col5) continue;
    
    const desc = String(col5).trim();
    
    // If it's a group header (has Col3 like 'A -' or just uppercase and no Col2 prefix)
    if (col3 && String(col3).includes('-') && !col2) {
       currentGroup = desc;
       mapping[currentGroup] = {};
    } else if (col2 && typeof col2 === 'string' && (col2.startsWith('3.') || col2.startsWith('4.'))) {
       if (!mapping[currentGroup]) mapping[currentGroup] = {};
       mapping[currentGroup][desc] = [col2];
    }
  }
  return mapping;
}

function generateBalancoMapping() {
  const sheet = wbInd.Sheets['BALANCO'];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  
  const ativo = {};
  const passivo = {};
  
  let currentMain = ativo;
  let currentGroup = 'Geral';
  
  for (let R = 8; R <= Math.min(range.e.r, 100); ++R) {
    const col3 = sheet[XLSX.utils.encode_cell({c: 3, r: R})]?.v; // prefix
    const col4 = sheet[XLSX.utils.encode_cell({c: 4, r: R})]?.v; // description
    
    if (!col3 || !col4) continue;
    const prefix = String(col3).trim();
    const desc = String(col4).trim();
    
    if (prefix === '1') { currentMain = ativo; continue; }
    if (prefix === '2') { currentMain = passivo; continue; }
    
    // Groups usually have 2 or 3 parts (e.g., 1.1 or 1.1.1)
    if (prefix.split('.').length <= 3 && !prefix.includes('SEM CONTA')) {
       currentGroup = desc;
       currentMain[currentGroup] = {};
    } else if (prefix !== '1' && prefix !== '2') {
       if (!currentMain[currentGroup]) currentMain[currentGroup] = {};
       currentMain[currentGroup][desc] = [prefix];
    }
  }
  return { ativo, passivo };
}

const dreMapping = generateDREMapping();
const balancoMapping = generateBalancoMapping();

const output = `
export const protheusMapping = {
  dre: ${JSON.stringify(dreMapping, null, 2)},
  ativo: ${JSON.stringify(balancoMapping.ativo, null, 2)},
  passivo: ${JSON.stringify(balancoMapping.passivo, null, 2)},
  dfc_ativo: {},
  dfc_passivo: {}
};
`;

fs.writeFileSync('c:/Users/User/Desktop/Consolidado/scratch/generated_mapping.js', output);
console.log('Mapping generated successfully in scratch/generated_mapping.js');
