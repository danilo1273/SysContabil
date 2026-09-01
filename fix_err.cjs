const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/utils/db.js", "utf8");
code = code.replace(/const records = await fetchAll\\(query\\);\\s*if \\(error\\) throw error;/g, "const records = await fetchAll(query);");
fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/utils/db.js", code);

