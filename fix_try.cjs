const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/components/PerdcompModule.jsx", "utf8");
code = code.replace("body: JSON.stringify({ value: newData }) */\n      });", "body: JSON.stringify({ value: newData }) */\n");
fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/components/PerdcompModule.jsx", code);

