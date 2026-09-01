const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", "utf8");
code = code.replace("const { data: cmData }", "const { data: _cmData }");
code = code.replace("cmData.value", "_cmData.value");
fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", code);

