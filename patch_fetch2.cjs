const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/utils/db.js", "utf8");

code = code.replace(
  `const { data: dre } = await supabase.from("dre_history").select("*").eq("ano", ano).eq("mes", mes);`,
  `const dre = await fetchAll(supabase.from("dre_history").select("*").eq("ano", ano).eq("mes", mes));`
);

code = code.replace(
  `const { data: balanco } = await supabase.from("balanco_history").select("*").eq("ano", ano).eq("mes", mes);`,
  `const balanco = await fetchAll(supabase.from("balanco_history").select("*").eq("ano", ano).eq("mes", mes));`
);

code = code.replace(
  `const { data: dre } = await supabase.from("dre_history").select("*").eq("empresaId", empresaId).eq("ano", ano);`,
  `const dre = await fetchAll(supabase.from("dre_history").select("*").eq("empresaId", empresaId).eq("ano", ano));`
);

code = code.replace(
  `const { data: balanco } = await supabase.from("balanco_history").select("*").eq("empresaId", empresaId).eq("ano", ano);`,
  `const balanco = await fetchAll(supabase.from("balanco_history").select("*").eq("empresaId", empresaId).eq("ano", ano));`
);

fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/utils/db.js", code);
console.log("Patched getRawRecords and getHistorySeries");

