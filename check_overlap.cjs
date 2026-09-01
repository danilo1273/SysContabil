const fs = require("fs");
const c = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/utils/mappingConfig.js", "utf8");
// Too complex to parse JS object from string without eval.
// Let us just write a script that imports it dynamically using ES modules!

