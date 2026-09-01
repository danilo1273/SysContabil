const fs = require("fs");
let code = fs.readFileSync("src/main.jsx", "utf8");
if (!code.includes("fetchAdapter")) {
  code = "import \"./fetchAdapter\";\n" + code;
  fs.writeFileSync("src/main.jsx", code);
}
