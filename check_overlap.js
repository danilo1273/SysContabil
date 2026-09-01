import { protheusMapping as mappingConfig } from "./src/utils/mappingConfig.js";
import sqlite3 from "sqlite3";
const db = new sqlite3.Database("database.sqlite");

db.all("SELECT conta, descricao, saldoAcumulado FROM balanco_history WHERE empresaId=\x27equipamentos\x27 AND ano=2026 AND mes=7 AND (conta LIKE \x271%\x27 OR conta LIKE \x272%\x27)", (e, rows) => {
  let overlaps = 0;
  rows.forEach(r => {
    let matchCount = 0;
    const type = r.conta.startsWith("1") ? "ativo" : "passivo";
    const groups = mappingConfig[type];
    for (const group of Object.values(groups)) {
      for (const [line, prefixes] of Object.entries(group)) {
        const inc = prefixes.filter(p => !p.startsWith("!"));
        const exc = prefixes.filter(p => p.startsWith("!")).map(p => p.slice(1));
        if (inc.some(p => r.conta.startsWith(p)) && !exc.some(p => r.conta.startsWith(p))) {
          matchCount++;
        }
      }
    }
    if (matchCount > 1) {
      console.log(`OVERLAP: ${r.conta} ${r.descricao} matches ${matchCount} times. Valor: ${r.saldoAcumulado}`);
      overlaps += (matchCount - 1) * r.saldoAcumulado;
    }
  });
  console.log("Total overlap impact:", overlaps);
});
