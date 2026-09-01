const fs = require("fs");
let code = fs.readFileSync("src/components/PerdcompModule.jsx", "utf8");

code = code.replace("import { Plus", "import { supabase } from \"../supabaseClient\";\nimport { Plus");

code = code.replace(
  "fetch(\"/api/settings/perdcomp_store\")",
  "supabase.from(\"settings\").select(\"value\").eq(\"key\", \"perdcomp_store\").single()"
);
code = code.replace(
  ".then(res => res.json())",
  ""
);
code = code.replace(
  ".then(data => {",
  ".then(({ data }) => {"
);

code = code.replace(
  "await fetch(\"/api/settings/perdcomp_store\", {",
  "await supabase.from(\"settings\").upsert({ key: \"perdcomp_store\", value: JSON.stringify(newData) }); /*"
);
code = code.replace(
  "body: JSON.stringify({ value: newData })",
  "body: JSON.stringify({ value: newData }) */"
);

fs.writeFileSync("src/components/PerdcompModule.jsx", code);

