const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", "utf8");
code = code.replace("const records = await dbMod.db.dre_history.toArray();", "const records = await dbMod.checkAvailableMonths();");
fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", code);

