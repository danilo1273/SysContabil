const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/server.cjs", "utf8");

const newEndpoint = `
app.get("/api/pendencias", (req, res) => {
  const { ano } = req.query;
  const targetAno = parseInt(ano) || new Date().getFullYear();
  
  db.all("SELECT empresaId, MAX(mes) as lastMonth FROM dre_history WHERE ano = ? AND id NOT LIKE \x27tax-dre-%\x27 GROUP BY empresaId", [targetAno], (err, imports) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.all("SELECT empresaId, MAX(mes) as lastTaxMonth FROM dre_history WHERE ano = ? AND id LIKE \x27tax-dre-irpj-%\x27 GROUP BY empresaId", [targetAno], (err, taxes) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const result = {};
      imports.forEach(i => {
        result[i.empresaId] = { lastImport: i.lastMonth, lastTax: 0 };
      });
      taxes.forEach(t => {
        if (!result[t.empresaId]) result[t.empresaId] = { lastImport: 0, lastTax: 0 };
        result[t.empresaId].lastTax = t.lastTaxMonth;
      });
      
      res.json(result);
    });
  });
});
`;

if (!code.includes("/api/pendencias")) {
  code = code.replace("app.listen(port", newEndpoint + "\napp.listen(port");
  fs.writeFileSync("c:/Users/User/Desktop/Consolidado/server.cjs", code);
  console.log("Endpoint added.");
} else {
  console.log("Endpoint already exists.");
}
