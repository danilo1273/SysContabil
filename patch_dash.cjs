const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/components/DashboardView.jsx", "utf8");
code = code.replace(
  "if (row.conta.startsWith(prefix)) return acc + row.total;",
  "if (row.conta.startsWith(prefix)) return acc + (row.total || row.valorMensal || row.saldoAcumulado || 0);"
);
fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/components/DashboardView.jsx", code);

