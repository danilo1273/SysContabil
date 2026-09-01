const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/index.css", "utf8");
code = code.replace("table {", ".table-container { overflow: visible !important; width: 100% !important; }\n    table {");
fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/index.css", code);

