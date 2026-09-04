import { supabase } from "../supabaseClient";

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


export async function saveBalanceteToDB(fileData, empresaId, ano, mes, userConfigs) {
  const dreEntries = [];
  const balancoEntries = [];
  const trimestre = Math.ceil(mes / 3);

  const rawAccounts = fileData.DRE || fileData;

  for (const [conta, data] of Object.entries(rawAccounts)) {
    if (!data.isAnalitica) continue;

    if (conta.startsWith("3.") || conta.startsWith("4.") || conta.startsWith("5.") || conta.startsWith("6.") || conta.startsWith("7.")) {
      dreEntries.push({
        id: `${empresaId}-${ano}-${mes}-${conta}`,
        empresaId, ano, mes, trimestre, conta,
        descricao: data.descricao,
        valorMensal: data.mensal
      });
    } else if (conta.startsWith("1.") || conta.startsWith("2.")) {
      balancoEntries.push({
        id: `${empresaId}-${ano}-${mes}-${conta}`,
        empresaId, ano, mes, trimestre,
        tipo: conta.startsWith("1.") ? "ativo" : "passivo",
        conta, descricao: data.descricao,
        saldoAcumulado: data.acumulado
      });
    }
  }

  // Delete existing records for this month to avoid duplicates
  await supabase.from("dre_history").delete().match({ empresaId, ano, mes });
  await supabase.from("balanco_history").delete().match({ empresaId, ano, mes });

  // Insert in chunks
  const insertChunks = async (table, entries) => {
    for (let i = 0; i < entries.length; i += 500) {
      await supabase.from(table).upsert(entries.slice(i, i + 500));
    }
  };

  await Promise.all([
    insertChunks("dre_history", dreEntries),
    insertChunks("balanco_history", balancoEntries)
  ]);

  return { success: true };
}

export async function saveCCToDB(ccRecords, empresaId, ano, mes) {
  const ccEntries = ccRecords.map(r => ({
    id: `${empresaId}-${ano}-${mes}-${r.cc_codigo}-${r.conta}`,
    empresaId, ano, mes, trimestre: Math.ceil(mes / 3),
    cc_codigo: r.cc_codigo ? r.cc_codigo.toString() : "",
    cc_descricao: r.cc_descricao || "",
    conta: r.conta ? r.conta.toString() : "",
    conta_descricao: r.conta_descricao || "",
    valor: r.valor || 0
  }));

  await supabase.from("cc_history").delete().match({ empresaId, ano, mes });

  for (let i = 0; i < ccEntries.length; i += 500) {
    await supabase.from("cc_history").upsert(ccEntries.slice(i, i + 500));
  }
  return { success: true };
}

export async function getDREFromDB(empresaId, ano, mes, tipoConsulta = "mensal") {
  let query = supabase.from("dre_history").select("*").eq("empresaId", empresaId).eq("ano", ano);
  
  if (tipoConsulta === "mensal") {
    query = query.eq("mes", mes);
  } else if (tipoConsulta === "trimestre") {
    const trimestre = Math.ceil(mes / 3);
    query = query.eq("trimestre", trimestre).lte("mes", mes);
  } else if (tipoConsulta === "acumulado") {
    query = query.lte("mes", mes);
  }

  const records = await fetchAll(query);

  const consolidated = {};
  for (const r of records || []) {
    if (r && !( (r.conta.startsWith("7") || r.conta.startsWith("6") || r.conta.startsWith("5.1.1.1.01")) && !r.id.includes("tax-dre") && !r.id.includes("manual_") )) {
    if (!consolidated[r.conta]) {
      consolidated[r.conta] = { descricao: r.descricao, valor: 0 };
    }
    consolidated[r.conta].valor += r.valorMensal;
    }
  }
  return consolidated;
}

export async function getBalancoFromDB(empresaId, ano, mes) {
  let records = await fetchAll(supabase.from("balanco_history").select("*").eq("empresaId", empresaId).eq("ano", ano).eq("mes", mes));

  if (mes > 1) {
    const { data: taxConfigData } = await supabase.from('settings').select('value').eq('key', 'agf_tax_config').single();
    let taxConfig = {};
    if (taxConfigData) taxConfig = JSON.parse(taxConfigData.value || '{}');
    const isTrimestral = empresaId !== 'consolidado' && empresaId !== 'todas' && (taxConfig[empresaId] === 'presumido' || taxConfig[empresaId] === 'real_trimestral');

    let startMes = 1;
    if (isTrimestral) {
      if (mes <= 3) startMes = 1;
      else if (mes <= 6) startMes = 4;
      else if (mes <= 9) startMes = 7;
      else startMes = 10;
    }

    if (mes > startMes) {
      const carryOvers = await fetchAll(supabase.from("balanco_history")
        .select("*").eq("empresaId", empresaId).eq("ano", ano).gte("mes", startMes).lt("mes", mes)
        .or("id.like.manual_%,id.like.tax-bal-%"));

      if (carryOvers) {
        records = records.concat(carryOvers);
      }
    }
  }

  const consolidated = {};
  for (const r of records) {
    if (r && !( r.conta.startsWith("2.1.1.6") && !r.id.includes("tax-bal") && !r.id.includes("manual_") )) {
    if (!consolidated[r.conta]) {
      consolidated[r.conta] = { descricao: r.descricao, valor: 0 };
    }
    consolidated[r.conta].valor += r.saldoAcumulado;
    }
  }
  return consolidated;
}

export async function addManualEntryToDB(empresaId, ano, mes, conta, descricao, valor) {
  const trimestre = Math.ceil(mes / 3);
  const type = (conta.startsWith("3") || conta.startsWith("4") || conta.startsWith("6") || conta.startsWith("7")) ? "dre" : "balanco";
  
  const entry = {
    id: `manual_${empresaId}_${ano}_${mes}_${conta}_${Date.now()}`,
    empresaId, ano, mes, trimestre, conta, descricao,
  };

  if (type === "dre") {
    entry.valorMensal = valor;
    await supabase.from("dre_history").upsert(entry);
  } else {
    entry.tipo = conta.startsWith("1") ? "ativo" : "passivo";
    entry.saldoAcumulado = valor;
    await supabase.from("balanco_history").upsert(entry);
  }

  return { success: true };
}

export async function checkAvailableMonths() {
  const { data } = await supabase.from("dre_history").select("ano, mes");
  const unique = [];
  const map = {};
  for (const d of data || []) {
    const key = `${d.ano}-${d.mes}`;
    if (!map[key]) {
      map[key] = true;
      unique.push(d);
    }
  }
  return unique;
}

export async function getSettings(key) {
  const { data, error } = await supabase.from("settings").select("value").eq("key", key).single();
  if (error || !data) return null;
  try { return JSON.parse(data.value); } catch(e) { return data.value; }
}

export async function saveSettings(key, value) {
  const val = typeof value === "string" ? value : JSON.stringify(value);
  await supabase.from("settings").upsert({ key, value: val });
  return { success: true };
}


export async function getRawRecords(ano, mes) {
  let dre = await fetchAll(supabase.from("dre_history").select("*").eq("ano", ano).eq("mes", mes));
  let balanco = await fetchAll(supabase.from("balanco_history").select("*").eq("ano", ano).eq("mes", mes));
  let cc = await fetchAll(supabase.from("cc_history").select("*").eq("ano", ano).eq("mes", mes));
  
  if (dre) dre = dre.filter(r => !( (r.conta.startsWith("7") || r.conta.startsWith("6") || r.conta.startsWith("5.1.1.1.01")) && !r.id.includes("tax-dre") && !r.id.includes("manual_") ));
  if (balanco) balanco = balanco.filter(r => !( r.conta.startsWith("2.1.1.6") && !r.id.includes("tax-bal") && !r.id.includes("manual_") ));
  
  return { dre: dre || [], balanco: balanco || [], cc: cc || [] };
}

export async function getCCFromDB(empresaId, ano, mes, tipoConsulta = "mensal") {
  let query = supabase.from("cc_history").select("*").eq("ano", ano);
  if (empresaId && empresaId !== "consolidado" && empresaId !== "todas") {
    query = query.eq("empresaId", empresaId);
  }
  if (tipoConsulta === "mensal") {
    query = query.eq("mes", mes);
  } else if (tipoConsulta === "trimestre") {
    const trimestre = Math.ceil(mes / 3);
    query = query.eq("trimestre", trimestre).lte("mes", mes);
  } else if (tipoConsulta === "acumulado") {
    query = query.lte("mes", mes);
  }
  return (await fetchAll(query)) || [];
}

export async function bulkPutRecords(table, entries) {
  const tableName = table === "dre_history" ? "dre_history" : "balanco_history";
  for (let i = 0; i < entries.length; i += 500) {
    await supabase.from(tableName).upsert(entries.slice(i, i + 500));
  }
  return { success: true };
}

export async function getHistorySeries(empresaId, ano) {
  let dreQuery = supabase.from("dre_history").select("*").eq("ano", ano);
  let balancoQuery = supabase.from("balanco_history").select("*").eq("ano", ano);

  if (empresaId && empresaId !== "consolidado" && empresaId !== "todas") {
    dreQuery = dreQuery.eq("empresaId", empresaId);
    balancoQuery = balancoQuery.eq("empresaId", empresaId);
  }

  let dre = await fetchAll(dreQuery);
  dre = dre.filter(r => !( (r.conta.startsWith("7") || r.conta.startsWith("6") || r.conta.startsWith("5.1.1.1.01")) && !r.id.includes("tax-dre") && !r.id.includes("manual_") ));
  let balanco = await fetchAll(balancoQuery);
  balanco = balanco.filter(r => !( r.conta.startsWith("2.1.1.6") && !r.id.includes("tax-bal") && !r.id.includes("manual_") ));
  return { dre: dre || [], balanco: balanco || [] };
}

export async function updateRecord(id, type, valor) {
  const table = type === "dre" ? "dre_history" : "balanco_history";
  const field = type === "dre" ? "valorMensal" : "saldoAcumulado";
  await supabase.from(table).update({ [field]: valor }).eq("id", id);
  return { success: true };
}

export async function deleteRecords(empresaId, ano, mes) {
  const match = {};
  if (ano) match.ano = ano;
  if (mes) match.mes = mes;
  if (empresaId) match.empresaId = empresaId;
  await supabase.from("dre_history").delete().match(match);
  await supabase.from("balanco_history").delete().match(match);
  return { success: true };
}
