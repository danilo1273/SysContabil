import { protheusMapping as mappingConfig, applyMapping } from "./src/utils/mappingConfig.js";
import sqlite3 from "sqlite3";
const db = new sqlite3.Database("database.sqlite");

db.all("SELECT conta, descricao, valorMensal as valor FROM dre_history WHERE empresaId=\x27equipamentos\x27 AND ano=2026 AND mes<=7", (e, dbData) => {
  const dreMapped = applyMapping(dbData, mappingConfig.dre, 1, "valor");
  let total = 0;
  for (const group of Object.values(dreMapped)) {
    if (group["TOTAL"]) total += group["TOTAL"].total;
  }
  console.log("Total DRE mapped:", total);
});
