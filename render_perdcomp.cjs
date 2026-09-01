const fs = require("fs");
let c = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", "utf8");
let search = `<FaturamentoModule
              companies={companies}
              selectedCompany={selectedCompany}
              selectedAno={selectedAno}
              selectedMes={selectedMes}
            />
          </div>
        )}`;`;
let replace = search + `\n\n        {secondaryTab === "perdcomp" && (
          <PerdcompModule 
            companies={companies} 
            canEdit={userPermissions?.includes("contabil") || ["danilo", "ryan.santos"].includes(username)} 
          />
        )}`;
c = c.replace(/<FaturamentoModule[\s\S]*?\/>\s*<\/div>\s*\)\}/, replace);
fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", c);
