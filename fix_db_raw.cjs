const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/utils/db.js", "utf8");

code = code.replace(
  `export async function getRawRecords(ano, mes) {
  const { data: dre } = await supabase.from("dre_history").select("*").eq("ano", ano).eq("mes", mes);
  const { data: bal } = await supabase.from("balanco_history").select("*").eq("ano", ano).eq("mes", mes);
  return [...(dre || []), ...(bal || [])];
}`,
  `export async function getRawRecords(ano, mes) {
  const { data: dre } = await supabase.from("dre_history").select("*").eq("ano", ano).eq("mes", mes);
  const { data: balanco } = await supabase.from("balanco_history").select("*").eq("ano", ano).eq("mes", mes);
  return { dre: dre || [], balanco: balanco || [] };
}`
);

fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/utils/db.js", code);

