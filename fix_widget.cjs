const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", "utf8");

const widgetCode = `
function PendencyWidget({ companies, ano }) {
  const [statusMap, setStatusMap] = React.useState({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    Promise.all(companies.map(c => 
      fetch(\`/api/dre?empresaId=\${c.id}&ano=\${ano}&mes=12&tipoConsulta=acumulado\`)
        .then(res => res.json())
        .then(data => {
          let lastImport = 0;
          let lastTax = 0;
          if (Array.isArray(data)) {
            data.forEach(r => {
              if (r.id && r.id.startsWith("tax-dre-irpj")) {
                if (r.mes > lastTax) lastTax = r.mes;
              } else {
                if (r.mes > lastImport) lastImport = r.mes;
              }
            });
          }
          return { id: c.id, lastImport, lastTax };
        })
    )).then(results => {
      const map = {};
      results.forEach(r => map[r.id] = r);
      setStatusMap(map);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [companies, ano]);

  if (loading) return <div style={{color:"#888", marginBottom: "1rem"}}>Carregando pendências...</div>;

  return (
    <div style={{ marginBottom: "2rem", background: "linear-gradient(135deg, #1e1e1e 0%, #1a233a 100%)", padding: "1.5rem", borderRadius: "12px", border: "1px solid #333" }}>
      <h3 style={{ margin: "0 0 1rem 0", color: "#64B5F6", display: "flex", alignItems: "center", gap: "8px" }}>
        <span>?? Status de Apuração - {ano}</span>
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        {companies.map(c => {
          const st = statusMap[c.id];
          if (!st) return null;
          const pendente = st.lastImport > st.lastTax;
          return (
            <div key={c.id} style={{ background: st.lastImport === 0 ? "rgba(255,255,255,0.05)" : pendente ? "rgba(255,202,40,0.1)" : "rgba(76,175,80,0.1)", padding: "1rem", borderRadius: "8px", border: "1px solid " + (st.lastImport === 0 ? "#444" : pendente ? "#FFCA28" : "#4CAF50") }}>
              <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>{c.name}</div>
              <div style={{ fontSize: "0.85rem", color: "#ccc", display: "flex", justifyContent: "space-between" }}>
                <span>Base Integrada:</span> <strong style={{color:"#fff"}}>{st.lastImport === 0 ? "-" : "Mês " + st.lastImport.toString().padStart(2, "0")}</strong>
              </div>
              <div style={{ fontSize: "0.85rem", color: "#ccc", display: "flex", justifyContent: "space-between" }}>
                <span>IRPJ Apurado:</span> <strong style={{color:"#fff"}}>{st.lastTax === 0 ? "-" : "Mês " + st.lastTax.toString().padStart(2, "0")}</strong>
              </div>
              <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", textAlign: "center", fontWeight: "bold", color: st.lastImport === 0 ? "#888" : pendente ? "#FFCA28" : "#4CAF50", padding: "4px", background: st.lastImport === 0 ? "transparent" : pendente ? "rgba(255,202,40,0.1)" : "rgba(76,175,80,0.1)", borderRadius: "4px" }}>
                {st.lastImport === 0 ? "SEM DADOS" : pendente ? "FALTA APURAR!" : "EM DIA"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
`;

if (!code.includes("function PendencyWidget({ companies, ano })")) {
  code = code.replace("function ProtheusModule(", widgetCode + "\nfunction ProtheusModule(");
  fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", code);
  console.log("Function injected!");
} else {
  console.log("Already injected.");
}
