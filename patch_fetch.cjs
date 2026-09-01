const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/utils/db.js", "utf8");

const fetchAllStr = `
async function fetchAll(queryBuilder) {
  let allData = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await queryBuilder.range(from, from + step - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < step) break;
    from += step;
  }
  return allData;
}
`;

code = code.replace("import { supabase } from \"../supabaseClient\";", "import { supabase } from \"../supabaseClient\";\n" + fetchAllStr);

code = code.replace(
  "const { data: records, error } = await query;",
  "const records = await fetchAll(query);"
);

code = code.replace(
  "if (error) throw error;\n  \n  const consolidated = {};\n  for (const r of records || []) {",
  "const consolidated = {};\n  for (const r of records || []) {"
);

code = code.replace(
  `let { data: records, error } = await supabase.from("balanco_history")
    .select("*").eq("empresaId", empresaId).eq("ano", ano).eq("mes", mes);

  if (error) throw error;
  records = records || [];`,
  `let records = await fetchAll(supabase.from("balanco_history").select("*").eq("empresaId", empresaId).eq("ano", ano).eq("mes", mes));`
);

code = code.replace(
  `const { data: carryOvers } = await supabase.from("balanco_history")
      .select("*").eq("empresaId", empresaId).eq("ano", ano).lt("mes", mes)
      .or("id.like.manual_%,id.like.tax-bal-%");`,
  `const carryOvers = await fetchAll(supabase.from("balanco_history")
      .select("*").eq("empresaId", empresaId).eq("ano", ano).lt("mes", mes)
      .or("id.like.manual_%,id.like.tax-bal-%"));`
);

fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/utils/db.js", code);
console.log("Patched getBalancoFromDB and getDREFromDB");

