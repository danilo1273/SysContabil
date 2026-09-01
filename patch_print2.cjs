const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/index.css", "utf8");

code = code.replace(".print-hide, .app-header", ".print-hide, .widget-pendencia, .app-header");
code = code.replace(".table-container { overflow: visible !important; width: 100% !important; }", ".table-container { overflow: visible !important; width: 100% !important; zoom: 0.7; }");

fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/index.css", code);

let jsx = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", "utf8");
jsx = jsx.replace("className=\"print-hide\"", "className=\"print-hide widget-pendencia\"");
fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", jsx);

