const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/utils/db.js", "utf8");

code = code.replace(
  `export async function getHistorySeries(empresaId, ano) {
  const { data: dre } = await supabase.from("dre_history").select("*").eq("empresaId", empresaId).eq("ano", ano);
  return dre || [];
}`,
  `export async function getHistorySeries(empresaId, ano) {
  const { data: dre } = await supabase.from("dre_history").select("*").eq("empresaId", empresaId).eq("ano", ano);
  const { data: balanco } = await supabase.from("balanco_history").select("*").eq("empresaId", empresaId).eq("ano", ano);
  return { dre: dre || [], balanco: balanco || [] };
}`
);

fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/utils/db.js", code);

