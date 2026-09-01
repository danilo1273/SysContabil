import { protheusMapping as mappingConfig, applyMapping } from "./src/utils/mappingConfig.js";
import sqlite3 from "sqlite3";
const db = new sqlite3.Database("database.sqlite");

db.all("SELECT conta, descricao, saldoAcumulado as valor FROM balanco_history WHERE empresaId=\x27equipamentos\x27 AND ano=2026 AND mes=7 AND (conta LIKE \x271%\x27 OR conta LIKE \x272%\x27)", (e, dbData) => {
  const passivoMapped = applyMapping(dbData, mappingConfig.passivo, 1, "valor");
  const grp = passivoMapped["PATRIMONIO LIQUIDO"];
  if (grp) {
     grp["Lucro do Exercício"] = { total: 3471671.097, details: [] };
     grp["TOTAL"].total += 3471671.097;
  }
  let finalTotal = 0;
  for (const [groupName, groupData] of Object.entries(passivoMapped)) {
    if (groupData["TOTAL"]) finalTotal += groupData["TOTAL"].total;
  }
  console.log("FINAL PASSIVO TOTAL:", finalTotal);
});
