const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/utils/mappingConfig.js", "utf8");

code = code.replace(/    "PROVISÃO IRPJ": \{\s*"Provisão IRPJ": \["7", "5\.1\.1\.1\.01\.00001"\]\s*\},/g, "");
code = code.replace(/    "PROVISÃO CSLL": \{\s*"Provisão CSLL": \["6", "5\.1\.1\.1\.01\.00002"\]\s*\},/g, "");
code = code.replace(/    "Provisao do Imposto de Renda e CSSLL": \["2\.1\.1\.6"\],\s*/g, "");

fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/utils/mappingConfig.js", code);
console.log("Patched mappingConfig.js");

