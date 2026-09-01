const fs = require("fs");
const sqlite3 = require("sqlite3");
const db = new sqlite3.Database("database.sqlite");
const c = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/utils/mappingConfig.js", "utf8");
const prefixes = [];
const matches = c.match(/"[34567][^"]*"/g);
if (matches) {
  matches.forEach(m => prefixes.push(m.replace(/"/g, "")));
}
db.all("SELECT conta, descricao, SUM(valorMensal) as valor FROM dre_history WHERE empresaId=\x27equipamentos\x27 AND ano=2026 AND mes<=7 GROUP BY conta", (e, r) => {
  const unmapped = r.filter(row => !prefixes.some(p => row.conta.startsWith(p)));
  let totalUnmapped = 0;
  unmapped.forEach(u => {
    console.log(u);
    totalUnmapped += u.valor;
  });
  console.log("Total Unmapped DRE:", totalUnmapped);
});
