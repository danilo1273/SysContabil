const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/utils/db.js", "utf8");

code = code.replace(
  `export async function deleteRecords(empresaId, ano, mes) {
  const match = { ano, mes };
  if (empresaId) match.empresaId = empresaId;
  await supabase.from("dre_history").delete().match(match);
  await supabase.from("balanco_history").delete().match(match);
  return { success: true };
}`,
  `export async function deleteRecords(empresaId, ano, mes) {
  const match = {};
  if (ano) match.ano = ano;
  if (mes) match.mes = mes;
  if (empresaId) match.empresaId = empresaId;
  await supabase.from("dre_history").delete().match(match);
  await supabase.from("balanco_history").delete().match(match);
  return { success: true };
}`
);

fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/utils/db.js", code);

