import { protheusMapping as mappingConfig, applyMapping } from "./src/utils/mappingConfig.js";
import sqlite3 from "sqlite3";
const db = new sqlite3.Database("database.sqlite");

db.all("SELECT conta, descricao, valorMensal as valor FROM dre_history WHERE empresaId=\x27equipamentos\x27 AND ano=2026 AND mes<=7", (e, dbData) => {
  const dreMappedYTD = applyMapping(dbData, mappingConfig.dre, 1, "valor");
  const getT = (group) => dreMappedYTD[group] ? dreMappedYTD[group]["TOTAL"].total : 0;
  
  const lucroBruto = getT("RECEITA OPERACIONAL BRUTA") + getT("DEDUÇÕES DA RECEITA") + getT("CUSTOS");
  const despOp = getT("DESPESAS COM VENDAS") + getT("DESPESAS ADMINISTRATIVAS") + getT("DESPESAS TRIBUTÁRIAS") + getT("DOAÇÕES / INCENTIVOS FISCAIS");
  const ebit = lucroBruto + despOp + getT("DEPRECIAÇÕES / AMORTIZAÇÕES");
  const finLiquido = getT("RECEITAS FINANCEIRAS") + getT("DESPESAS FINANCEIRAS") + getT("VARIAÇÕES MONETÁRIAS / CAMBIAIS LÍQUIDAS") + getT("AJUSTES FINANCEIROS") + getT("REVERSÃO JUROS S/ CAPITAL PROPRIO");
  const resAntesIr = ebit + finLiquido + getT("RESULTADO COM PARTICIP. SOCIETÁRIA") + getT("OUTRAS RECEITAS E DESPESAS");
  let lucroYTD = resAntesIr + getT("PROVISÃO IRPJ") + getT("PROVISÃO CSLL");
  
  console.log("RECEITA OPERACIONAL BRUTA:", getT("RECEITA OPERACIONAL BRUTA"));
  console.log("DEDUÇÕES DA RECEITA:", getT("DEDUÇÕES DA RECEITA"));
  console.log("PROVISÃO IRPJ:", getT("PROVISÃO IRPJ"));
  console.log("Provisão IRPJ (certo):", getT("Provisão IRPJ") || getT("PROVISÃO IRPJ"));
  console.log("Lucro YTD Final:", lucroYTD);
});
