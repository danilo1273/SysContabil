import sqlite3 from "sqlite3";
const db = new sqlite3.Database("database.sqlite");

db.all("SELECT conta, valorMensal FROM dre_history WHERE empresaId=\x27equipamentos\x27 AND ano=2026 AND mes=4", (e, dreMensal) => {
  let lair = 0;
  dreMensal.forEach(r => {
    if (!r.conta.startsWith("6") && !r.conta.startsWith("7") && !r.conta.startsWith("5.1.1.1.01")) {
      lair += (r.valorMensal || 0);
    }
  });
  console.log("LAIR (isolated month):", lair);
});
