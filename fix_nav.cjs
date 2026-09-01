const fs = require("fs");
let c = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", "utf8");
c = c.replace("[\"dash\", \"dre\", \"balanco\", \"dfc\", \"faturamento\"]", "[\"dash\", \"dre\", \"balanco\", \"dfc\", \"faturamento\", \"perdcomp\"]");
c = c.replace(/\[\x27dash\x27, \x27dre\x27, \x27balanco\x27, \x27dfc\x27, \x27faturamento\x27\]/g, "[\x27dash\x27, \x27dre\x27, \x27balanco\x27, \x27dfc\x27, \x27faturamento\x27, \x27perdcomp\x27]");
c = c.replace("tab === \x27dfc\x27 ? \x27?? Fluxo de Caixa (DFC)\x27 : \x27?? Relação de Faturamento\x27", "tab === \x27dfc\x27 ? \x27?? Fluxo de Caixa (DFC)\x27 : tab === \x27faturamento\x27 ? \x27?? Relação de Faturamento\x27 : \x27?? PER/DCOMP\x27");
fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", c);
