const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", "utf8");

code = code.replace(
  `{pendente ? "FALTA APURAR!" : "EM DIA"}`,
  `{st.lastImport === 0 ? "SEM DADOS" : pendente ? "FALTA APURAR!" : "EM DIA"}`
);
code = code.replace(
  `{pendente ? "#FFCA28" : "#4CAF50"}`,
  `{st.lastImport === 0 ? "#888" : pendente ? "#FFCA28" : "#4CAF50"}`
);
code = code.replace(
  `border: "1px solid " + (pendente ? "#FFCA28" : "#4CAF50")`,
  `border: "1px solid " + (st.lastImport === 0 ? "#444" : pendente ? "#FFCA28" : "#4CAF50")`
);
code = code.replace(
  `background: pendente ? "rgba(255,202,40,0.1)" : "rgba(76,175,80,0.1)"`,
  `background: st.lastImport === 0 ? "rgba(255,255,255,0.05)" : pendente ? "rgba(255,202,40,0.1)" : "rgba(76,175,80,0.1)"`
);

fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", code);
console.log("Widget patched");

