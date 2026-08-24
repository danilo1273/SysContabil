const API_URL = `http://${window.location.hostname}:3001/api`;

// Fallback for API URL when accessed from network
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return 'http://' + window.location.hostname + ':3001/api';
  }
  return API_URL;
};

export async function saveBalanceteToDB(fileData, empresaId, ano, mes, userConfigs) {
  const dreEntries = [];
  const balancoEntries = [];
  const trimestre = Math.ceil(mes / 3);

  const rawAccounts = fileData.DRE || fileData;

  for (const [conta, data] of Object.entries(rawAccounts)) {
    if (!data.isAnalitica) continue;

    if (conta.startsWith('3.') || conta.startsWith('4.') || conta.startsWith('5.') || conta.startsWith('6.') || conta.startsWith('7.')) {
      dreEntries.push({
        id: `${empresaId}-${ano}-${mes}-${conta}`,
        empresaId, ano, mes, trimestre, conta,
        descricao: data.descricao,
        valorMensal: data.mensal
      });
    } else if (conta.startsWith('1.') || conta.startsWith('2.')) {
      balancoEntries.push({
        id: `${empresaId}-${ano}-${mes}-${conta}`,
        empresaId, ano, mes, trimestre,
        tipo: conta.startsWith('1.') ? 'ativo' : 'passivo',
        conta, descricao: data.descricao,
        saldoAcumulado: data.acumulado
      });
    }
  }

  const res = await fetch(`${getApiUrl()}/balancete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dreEntries, balancoEntries, empresaId, ano, mes })
  });
  if (!res.ok) throw new Error('Falha ao salvar no servidor central');
  return res.json();
}

export async function saveCCToDB(ccRecords, empresaId, ano, mes) {
  const ccEntries = ccRecords.map(r => ({
    id: `${empresaId}-${ano}-${mes}-${r.cc_codigo}-${r.conta}`,
    empresaId, 
    ano, 
    mes, 
    trimestre: Math.ceil(mes / 3),
    cc_codigo: r.cc_codigo ? r.cc_codigo.toString() : '',
    cc_descricao: r.cc_descricao || '',
    conta: r.conta ? r.conta.toString() : '',
    conta_descricao: r.conta_descricao || '',
    valor: r.valor || 0
  }));

  const res = await fetch(`${getApiUrl()}/cc-balancete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ccEntries, empresaId, ano, mes })
  });
  if (!res.ok) throw new Error('Falha ao salvar Centros de Custo no servidor central');
  return res.json();
}

export async function getDREFromDB(empresaId, ano, mes, tipoConsulta = 'mensal') {
  const res = await fetch(`${getApiUrl()}/dre?empresaId=${empresaId}&ano=${ano}&mes=${mes}&tipoConsulta=${tipoConsulta}`);
  if (!res.ok) throw new Error('Erro ao buscar DRE');
  const records = await res.json();

  const consolidated = {};
  for (const r of records) {
    if (!consolidated[r.conta]) {
      consolidated[r.conta] = { descricao: r.descricao, valor: 0 };
    }
    consolidated[r.conta].valor += r.valorMensal;
  }
  return consolidated;
}

export async function getBalancoFromDB(empresaId, ano, mes) {
    const res = await fetch(`${getApiUrl()}/balanco?empresaId=${empresaId}&ano=${ano}&mes=${mes}`);
    if (!res.ok) throw new Error('Erro ao buscar Balanço');
    let records = await res.json();
    
    // Carry over manual and tax entries from previous months of the same year
    if (mes > 1) {
        for (let m = 1; m < mes; m++) {
            try {
                const mRes = await fetch(`${getApiUrl()}/balanco?empresaId=${empresaId}&ano=${ano}&mes=${m}`);
                if (mRes.ok) {
                    const mRecords = await mRes.json();
                    const carryOvers = mRecords.filter(r => r.id.startsWith('manual_') || r.id.startsWith('tax-bal-'));
                    records = records.concat(carryOvers);
                }
            } catch (e) {
                console.error(`Erro ao buscar carry-over do mês ${m}:`, e);
            }
        }
    }

    const consolidated = {};
    for (const r of records) {
        if (!consolidated[r.conta]) {
            consolidated[r.conta] = { descricao: r.descricao, valor: 0 };
        }
        consolidated[r.conta].valor += r.saldoAcumulado;
    }
    return consolidated;
}

export async function addManualEntryToDB(empresaId, ano, mes, conta, descricao, valor) {
  const trimestre = Math.ceil(mes / 3);
  const type = (conta.startsWith('3') || conta.startsWith('4') || conta.startsWith('6') || conta.startsWith('7')) ? 'dre' : 'balanco';
  
  const entry = {
    id: `manual_${empresaId}_${ano}_${mes}_${conta}_${Date.now()}`,
    empresaId, ano, mes, trimestre, conta, descricao,
  };

  if (type === 'dre') {
    entry.valorMensal = valor;
  } else {
    entry.tipo = conta.startsWith('1') ? 'ativo' : 'passivo';
    entry.saldoAcumulado = valor;
  }

  const res = await fetch(`${getApiUrl()}/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry, type })
  });
  if (!res.ok) throw new Error('Falha ao salvar conta manual');
  return res.json();
}

export async function checkAvailableMonths() {
  const res = await fetch(`${getApiUrl()}/info`);
  if (!res.ok) return [];
  return res.json();
}

export async function getRawRecords(ano, mes) {
  const res = await fetch(`${getApiUrl()}/records?ano=${ano}&mes=${mes}`);
  if (!res.ok) throw new Error('Erro ao buscar registros brutos');
  return res.json();
}

export async function getHistorySeries(empresaId, ano) {
  const res = await fetch(`${getApiUrl()}/history-series?empresaId=${empresaId}&ano=${ano}`);
  if (!res.ok) throw new Error('Erro ao buscar série histórica');
  return res.json();
}

export async function updateRecord(id, type, valor) {
  const res = await fetch(`${getApiUrl()}/records/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, valor })
  });
  if (!res.ok) throw new Error('Erro ao atualizar registro');
  return res.json();
}

export async function deleteRecords(empresaId, ano, mes) {
  const params = new URLSearchParams();
  if (empresaId) params.append('empresaId', empresaId);
  if (ano) params.append('ano', ano);
  if (mes) params.append('mes', mes);
  const res = await fetch(`${getApiUrl()}/records?${params.toString()}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Erro ao deletar registros');
  return res.json();
}

export async function bulkPutRecords(table, entries) {
  const payload = table === 'dre_history' ? { dreEntries: entries } : { balancoEntries: entries };
  const res = await fetch(`${getApiUrl()}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Erro ao importar registros em lote');
  return res.json();
}

export async function getSettings(key) {
  const res = await fetch(`${getApiUrl()}/settings/${key}`);
  if (!res.ok) return null;
  return res.json();
}

export async function saveSettings(key, value) {
  const res = await fetch(`${getApiUrl()}/settings/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value })
  });
  if (!res.ok) throw new Error('Erro ao salvar configurações');
  return res.json();
}

export const db = {
  dre_history: {
    toArray: async () => {
      const res = await fetch(`${getApiUrl()}/info`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.map(d => ({ ano: d.ano, mes: d.mes }));
    }
  }
};
