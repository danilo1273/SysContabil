const fs = require("fs");
let code = fs.readFileSync("src/components/ProtheusModule.jsx", "utf8");

code = code.replace("import { saveBalanceteToDB", "import { supabase } from \"../supabaseClient\";\nimport { saveBalanceteToDB");

code = code.replace(
  "fetch(`/api/dre?empresaId=${c.id}&ano=${ano}&mes=12&tipoConsulta=acumulado`)",
  "supabase.from(\"dre_history\").select(\"id, mes\").eq(\"empresaId\", c.id).eq(\"ano\", ano).lte(\"mes\", 12)"
);
code = code.replace(
  ".then(res => res.json())",
  ""
);

code = code.replace(
  "const cmRes = await fetch(`/api/settings/customMapping`);",
  "const cmRes = { ok: false }; const { data: cmData } = await supabase.from(\"settings\").select(\"value\").eq(\"key\", \"customMapping\").single(); if (cmData) { cmRes.ok = true; cmRes.json = async () => JSON.parse(cmData.value); }"
);

code = code.replace(
  "await fetch(`/api/settings/customMapping`, {",
  "await supabase.from(\"settings\").upsert({ key: \"customMapping\", value: JSON.stringify(cm) }); /*"
);
code = code.replace(
  "body: JSON.stringify({ value: cm })",
  "body: JSON.stringify({ value: cm }) */"
);

fs.writeFileSync("src/components/ProtheusModule.jsx", code);

