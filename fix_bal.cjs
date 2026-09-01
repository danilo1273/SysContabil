const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/utils/db.js", "utf8");
const target = "let { data: records, error } = await supabase.from(\"balanco_history\")\n    .select(\"*\").eq(\"empresaId\", empresaId).eq(\"ano\", ano).eq(\"mes\", mes);\n  \n  if (error) throw error;\n  records = records || [];";
const replacement = "let records = await fetchAll(supabase.from(\"balanco_history\").select(\"*\").eq(\"empresaId\", empresaId).eq(\"ano\", ano).eq(\"mes\", mes));";
code = code.replace(target, replacement);
// also try carriage returns
const target2 = "let { data: records, error } = await supabase.from(\"balanco_history\")\r\n    .select(\"*\").eq(\"empresaId\", empresaId).eq(\"ano\", ano).eq(\"mes\", mes);\r\n  \r\n  if (error) throw error;\r\n  records = records || [];";
code = code.replace(target2, replacement);
fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/utils/db.js", code);

