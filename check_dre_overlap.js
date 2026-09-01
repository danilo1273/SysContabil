import { protheusMapping as mappingConfig } from "./src/utils/mappingConfig.js";
import sqlite3 from "sqlite3";
const db = new sqlite3.Database("database.sqlite");

db.all("SELECT conta, descricao, SUM(valorMensal) as valor FROM dre_history WHERE empresaId=\x27equipamentos\x27 AND ano=2026 AND mes<=7 GROUP BY conta", (e, rows) => {
  let overlaps = 0;
  let dreSum = 0;
  rows.forEach(r => {
    let matchCount = 0;
    const groups = mappingConfig.dre;
    for (const group of Object.values(groups)) {
      for (const [line, prefixes] of Object.entries(group)) {
        const inc = prefixes.filter(p => !p.startsWith("!"));
        const exc = prefixes.filter(p => p.startsWith("!")).map(p => p.slice(1));
        if (inc.some(p => r.conta.startsWith(p)) && !exc.some(p => r.conta.startsWith(p))) {
          matchCount++;
          dreSum += r.valor;
        }
      }
    }
    if (matchCount > 1) {
      console.log(`DRE OVERLAP: ${r.conta} ${r.descricao} matches ${matchCount} times. Valor: ${r.valor}`);
      overlaps += (matchCount - 1) * r.valor;
    }
  });
  console.log("Total DRE overlap impact:", overlaps);
  console.log("Total mapped DRE sum (lucro):", dreSum);
});
