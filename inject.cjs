const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/index.html", "utf8");
if (!code.includes("addEventListener")) {
  code = code.replace("<body>", "<body><script>window.addEventListener(\"error\", function(e) { document.body.innerHTML += \"<div style=\\\"color:red; background: white; padding: 20px; position: fixed; top: 0; left: 0; z-index: 9999; width: 100%;\\\">ERROR: \" + (e.error ? e.error.stack : e.message) + \"</div>\"; }); window.addEventListener(\"unhandledrejection\", function(e) { document.body.innerHTML += \"<div style=\\\"color:red; background: white; padding: 20px; position: fixed; top: 0; left: 0; z-index: 9999; width: 100%;\\\">REJECTION: \" + (e.reason ? e.reason.stack : e.reason) + \"</div>\"; });</script>");
  fs.writeFileSync("c:/Users/User/Desktop/Consolidado/index.html", code);
}
