import sqlite3 from "sqlite3";
const db = new sqlite3.Database("database.sqlite");

db.all("SELECT conta, valorMensal FROM dre_history WHERE empresaId=\x27equipamentos\x27 AND ano=2026 AND mes=4", (e, dreMensal) => {
  let lair = 0;
  let variacaoCambial = 0;
  dreMensal.forEach(r => {
    if (!r.conta.startsWith("6") && !r.conta.startsWith("7") && !r.conta.startsWith("5.1.1.1.01")) lair += (r.valorMensal || 0);
    if (r.conta.startsWith("4.3.1.1.03")) variacaoCambial += (r.valorMensal || 0);
  });
  
  let adicoesAuto = 0, exclusoesAuto = 0;
  let cambioAdicao = 0, cambioExclusao = 0;
  
  // cambioConfig = caixa
  if (variacaoCambial > 0) exclusoesAuto += variacaoCambial;
  else if (variacaoCambial < 0) adicoesAuto += Math.abs(variacaoCambial);
  
  const realizado = 78707;
  if (realizado > 0) cambioAdicao = realizado;
  else if (realizado < 0) cambioExclusao = Math.abs(realizado);
  
  const baseAjustada = lair + adicoesAuto + cambioAdicao - exclusoesAuto - cambioExclusao;
  const bcIrpj = Math.max(0, baseAjustada);
  
  const irpjNormal = bcIrpj * 0.15;
  const irpjAdicional = Math.max(0, bcIrpj - 20000) * 0.10;
  const irpjTotal = Math.max(0, irpjNormal + irpjAdicional);
  
  console.log("LAIR:", lair);
  console.log("Variacao Cambial:", variacaoCambial);
  console.log("AdicoesAuto:", adicoesAuto);
  console.log("ExclusoesAuto:", exclusoesAuto);
  console.log("Base Ajustada:", baseAjustada);
  console.log("IRPJ Total do Mes:", irpjTotal);
});
