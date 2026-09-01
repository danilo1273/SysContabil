const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", "utf8");
code = code.replace(".then(data => {\\n            let lastImport = 0;", ".then(({ data }) => {\\n            let lastImport = 0;");
fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", code);

