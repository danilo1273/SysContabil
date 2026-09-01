const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/utils/db.js", "utf8");

const filterDre = "if (r && !( (r.conta.startsWith(\"7\") || r.conta.startsWith(\"6\") || r.conta.startsWith(\"5.1.1.1.01\")) && !r.id.includes(\"tax-dre\") && !r.id.includes(\"manual_\") )) {";
const filterBal = "if (r && !( r.conta.startsWith(\"2.1.1.6\") && !r.id.includes(\"tax-bal\") && !r.id.includes(\"manual_\") )) {";

// getDREFromDB
code = code.replace(
  "for (const r of records || []) {",
  "for (const r of records || []) {\n    " + filterDre
);
code = code.replace(
  "consolidated[r.conta].valor += r.valorMensal;\n  }",
  "consolidated[r.conta].valor += r.valorMensal;\n    }\n  }"
);

// getBalancoFromDB
code = code.replace(
  "for (const r of records) {",
  "for (const r of records) {\n    " + filterBal
);
code = code.replace(
  "consolidated[r.conta].valor += r.saldoAcumulado;\n  }",
  "consolidated[r.conta].valor += r.saldoAcumulado;\n    }\n  }"
);

// getHistorySeries
code = code.replace(
  "const dre = await fetchAll(dreQuery);",
  "let dre = await fetchAll(dreQuery);\n  dre = dre.filter(r => !( (r.conta.startsWith(\"7\") || r.conta.startsWith(\"6\") || r.conta.startsWith(\"5.1.1.1.01\")) && !r.id.includes(\"tax-dre\") && !r.id.includes(\"manual_\") ));"
);
code = code.replace(
  "const balanco = await fetchAll(balancoQuery);",
  "let balanco = await fetchAll(balancoQuery);\n  balanco = balanco.filter(r => !( r.conta.startsWith(\"2.1.1.6\") && !r.id.includes(\"tax-bal\") && !r.id.includes(\"manual_\") ));"
);

fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/utils/db.js", code);
console.log("Patched db.js");

