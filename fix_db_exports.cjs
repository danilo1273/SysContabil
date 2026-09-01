const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/utils/db.js", "utf8");

code += `
export async function getRawRecords(ano, mes) {
  const { data: dre } = await supabase.from("dre_history").select("*").eq("ano", ano).eq("mes", mes);
  const { data: bal } = await supabase.from("balanco_history").select("*").eq("ano", ano).eq("mes", mes);
  return [...(dre || []), ...(bal || [])];
}

export async function bulkPutRecords(table, entries) {
  const tableName = table === "dre_history" ? "dre_history" : "balanco_history";
  for (let i = 0; i < entries.length; i += 500) {
    await supabase.from(tableName).upsert(entries.slice(i, i + 500));
  }
  return { success: true };
}

export async function getHistorySeries(empresaId, ano) {
  const { data: dre } = await supabase.from("dre_history").select("*").eq("empresaId", empresaId).eq("ano", ano);
  return dre || [];
}

export async function updateRecord(id, type, valor) {
  const table = type === "dre" ? "dre_history" : "balanco_history";
  const field = type === "dre" ? "valorMensal" : "saldoAcumulado";
  await supabase.from(table).update({ [field]: valor }).eq("id", id);
  return { success: true };
}

export async function deleteRecords(empresaId, ano, mes) {
  const match = { ano, mes };
  if (empresaId) match.empresaId = empresaId;
  await supabase.from("dre_history").delete().match(match);
  await supabase.from("balanco_history").delete().match(match);
  return { success: true };
}
`;

fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/utils/db.js", code);

