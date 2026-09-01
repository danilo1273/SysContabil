const fs = require("fs");
let lines = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", "utf8").split("\n");
lines[2043] = "await supabase.from(\"settings\").upsert({ key: \"customMapping\", value: JSON.stringify(newMap) });";
lines.splice(2044, 4);
fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", lines.join("\n"));

