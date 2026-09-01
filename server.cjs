const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS dre_history (id TEXT PRIMARY KEY, empresaId TEXT, ano INTEGER, mes INTEGER, trimestre INTEGER, conta TEXT, descricao TEXT, valorMensal REAL)');
  db.run('CREATE TABLE IF NOT EXISTS balanco_history (id TEXT PRIMARY KEY, empresaId TEXT, ano INTEGER, mes INTEGER, trimestre INTEGER, tipo TEXT, conta TEXT, descricao TEXT, saldoAcumulado REAL)');
  db.run('CREATE TABLE IF NOT EXISTS cc_history (id TEXT PRIMARY KEY, empresaId TEXT, ano INTEGER, mes INTEGER, trimestre INTEGER, cc_codigo TEXT, cc_descricao TEXT, conta TEXT, conta_descricao TEXT, valor REAL)');
  db.run('CREATE TABLE IF NOT EXISTS agf_users (id TEXT PRIMARY KEY, username TEXT, password TEXT, role TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS agf_integracoes (id TEXT PRIMARY KEY, mes INTEGER, ano INTEGER, tipo TEXT, dia_atual INTEGER, responsavel TEXT, updated_at TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS agf_obrigacoes (id TEXT PRIMARY KEY, mes INTEGER, ano INTEGER, tipo TEXT, status TEXT, data_entrega TEXT, responsavel TEXT, updated_at TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS agf_pendencias (id TEXT PRIMARY KEY, documento TEXT, motivo TEXT, responsavel TEXT, criador TEXT, status TEXT, data_criacao TEXT, data_correcao TEXT, historico TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
});

app.get('/api/dre', (req, res) => {
  const { empresaId, ano, mes, tipoConsulta } = req.query;
  let query = 'SELECT * FROM dre_history WHERE empresaId = ? AND ano = ?';
  const params = [empresaId, parseInt(ano)];

  if (tipoConsulta === 'mensal') {
    query += ' AND mes = ?'; params.push(parseInt(mes));
  } else if (tipoConsulta === 'trimestre') {
    const trimestre = Math.ceil(parseInt(mes) / 3);
    query += ' AND trimestre = ? AND mes <= ?'; params.push(trimestre, parseInt(mes));
  } else if (tipoConsulta === 'acumulado') {
    query += ' AND mes <= ?'; params.push(parseInt(mes));
  }
  db.all(query, params, (err, rows) => { res.json(rows || []); });
});

app.get('/api/balanco', (req, res) => {
  const { empresaId, ano, mes } = req.query;
  db.all('SELECT * FROM balanco_history WHERE empresaId = ? AND ano = ? AND mes = ?', [empresaId, parseInt(ano), parseInt(mes)], (err, rows) => { res.json(rows || []); });
});

app.post('/api/balancete', (req, res) => {
  const { dreEntries, balancoEntries, empresaId, ano, mes } = req.body;
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run('DELETE FROM dre_history WHERE empresaId = ? AND ano = ? AND mes = ?', [empresaId, ano, mes]);
    db.run('DELETE FROM balanco_history WHERE empresaId = ? AND ano = ? AND mes = ?', [empresaId, ano, mes]);

    if (dreEntries.length > 0) {
      const stmt = db.prepare('INSERT INTO dre_history (id, empresaId, ano, mes, trimestre, conta, descricao, valorMensal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      dreEntries.forEach(e => stmt.run([e.id, e.empresaId, e.ano, e.mes, e.trimestre, e.conta, e.descricao, e.valorMensal]));
      stmt.finalize();
    }
    if (balancoEntries.length > 0) {
      const stmt = db.prepare('INSERT INTO balanco_history (id, empresaId, ano, mes, trimestre, tipo, conta, descricao, saldoAcumulado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      balancoEntries.forEach(e => stmt.run([e.id, e.empresaId, e.ano, e.mes, e.trimestre, e.tipo, e.conta, e.descricao, e.saldoAcumulado]));
      stmt.finalize();
    }
    db.run('COMMIT', (err) => res.json({ success: true }));
  });
});

app.post('/api/cc-balancete', (req, res) => {
  const { ccEntries, empresaId, ano, mes } = req.body;
  console.log(`Receiving cc-balancete for ${empresaId} ${ano}/${mes} with ${ccEntries ? ccEntries.length : 0} entries`);
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run('DELETE FROM cc_history WHERE empresaId = ? AND ano = ? AND mes = ?', [empresaId, ano, mes]);

    if (ccEntries && ccEntries.length > 0) {
      const stmt = db.prepare('INSERT INTO cc_history (id, empresaId, ano, mes, trimestre, cc_codigo, cc_descricao, conta, conta_descricao, valor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      ccEntries.forEach(e => stmt.run([e.id, e.empresaId, e.ano, e.mes, e.trimestre, e.cc_codigo, e.cc_descricao, e.conta, e.conta_descricao, e.valor]));
      stmt.finalize();
    }
    db.run('COMMIT', (err) => res.json({ success: true }));
  });
});

app.post('/api/manual', (req, res) => {
  const { entry, type } = req.body;
  if (type === 'dre') {
    db.run('REPLACE INTO dre_history (id, empresaId, ano, mes, trimestre, conta, descricao, valorMensal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [entry.id, entry.empresaId, entry.ano, entry.mes, entry.trimestre, entry.conta, entry.descricao, entry.valorMensal], () => res.json({ success: true }));
  } else {
    db.run('REPLACE INTO balanco_history (id, empresaId, ano, mes, trimestre, tipo, conta, descricao, saldoAcumulado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [entry.id, entry.empresaId, entry.ano, entry.mes, entry.trimestre, entry.tipo, entry.conta, entry.descricao, entry.saldoAcumulado], () => res.json({ success: true }));
  }
});

app.post('/api/import', (req, res) => {
  const { dreEntries, balancoEntries, ccEntries } = req.body;
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    if (dreEntries && dreEntries.length > 0) {
      const stmt = db.prepare('REPLACE INTO dre_history (id, empresaId, ano, mes, trimestre, conta, descricao, valorMensal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      dreEntries.forEach(e => stmt.run([e.id, e.empresaId, e.ano, e.mes, e.trimestre, e.conta, e.descricao, e.valorMensal]));
      stmt.finalize();
    }
    if (balancoEntries && balancoEntries.length > 0) {
      const stmt = db.prepare('REPLACE INTO balanco_history (id, empresaId, ano, mes, trimestre, tipo, conta, descricao, saldoAcumulado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      balancoEntries.forEach(e => stmt.run([e.id, e.empresaId, e.ano, e.mes, e.trimestre, e.tipo, e.conta, e.descricao, e.saldoAcumulado]));
      stmt.finalize();
    }
    if (ccEntries && ccEntries.length > 0) {
      const stmt = db.prepare('REPLACE INTO cc_history (id, empresaId, ano, mes, trimestre, cc_codigo, cc_descricao, conta, conta_descricao, valor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      ccEntries.forEach(e => stmt.run([e.id, e.empresaId, e.ano, e.mes, e.trimestre, e.cc_codigo, e.cc_descricao, e.conta, e.conta_descricao, e.valor]));
      stmt.finalize();
    }
    db.run('COMMIT', () => res.json({ success: true }));
  });
});

app.get('/api/info', (req, res) => {
    db.all("SELECT DISTINCT ano, mes FROM dre_history WHERE conta NOT IN ('6', '7') ORDER BY ano DESC, mes DESC", (err, rows) => res.json(rows || []));
});

app.get('/api/records', (req, res) => {
  const { ano, mes } = req.query;
  db.serialize(() => {
    db.all('SELECT * FROM dre_history WHERE ano = ? AND mes = ?', [parseInt(ano), parseInt(mes)], (err1, dre) => {
      db.all('SELECT * FROM balanco_history WHERE ano = ? AND mes = ?', [parseInt(ano), parseInt(mes)], (err2, bal) => {
        db.all('SELECT * FROM cc_history WHERE ano = ? AND mes = ?', [parseInt(ano), parseInt(mes)], (err3, cc) => {
            res.json({ dre: dre || [], balanco: bal || [], cc: cc || [] });
        });
      });
    });
  });
});

app.get('/api/history-series', (req, res) => {
  const { empresaId, ano } = req.query;
  const targetAno = parseInt(ano);
  
  let qDre = 'SELECT mes, conta, SUM(valorMensal) as total FROM dre_history WHERE ano = ?';
  let qBal = 'SELECT mes, conta, SUM(saldoAcumulado) as total FROM balanco_history WHERE ano = ?';
  const params = [targetAno];

  if (empresaId && empresaId !== 'consolidado') {
    qDre += ' AND empresaId = ?';
    qBal += ' AND empresaId = ?';
    params.push(empresaId);
  }

  qDre += ' GROUP BY mes, conta';
  qBal += ' GROUP BY mes, conta';

  db.serialize(() => {
    db.all(qDre, params, (err1, dreRows) => {
      db.all(qBal, params, (err2, balRows) => {
        res.json({ dre: dreRows || [], balanco: balRows || [] });
      });
    });
  });
});

app.put('/api/records/:id', (req, res) => {
  const { id } = req.params;
  const { type, valor } = req.body;
  if (type === 'dre') {
    db.run('UPDATE dre_history SET valorMensal = ? WHERE id = ?', [valor, id], () => res.json({ success: true }));
  } else {
    db.run('UPDATE balanco_history SET saldoAcumulado = ? WHERE id = ?', [valor, id], () => res.json({ success: true }));
  }
});

app.delete('/api/records', (req, res) => {
  const { empresaId, ano, mes } = req.query;
  let q1 = 'DELETE FROM dre_history WHERE 1=1';
  let q2 = 'DELETE FROM balanco_history WHERE 1=1';
  let q3 = 'DELETE FROM cc_history WHERE 1=1';
  const params = [];
  if (empresaId && empresaId !== 'todas') {
    q1 += ' AND empresaId = ?'; q2 += ' AND empresaId = ?'; q3 += ' AND empresaId = ?';
    params.push(empresaId);
  }
  if (ano) {
    q1 += ' AND ano = ?'; q2 += ' AND ano = ?'; q3 += ' AND ano = ?';
    params.push(parseInt(ano));
  }
  if (mes) {
    q1 += ' AND mes = ?'; q2 += ' AND mes = ?'; q3 += ' AND mes = ?';
    params.push(parseInt(mes));
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run(q1, params);
    db.run(q2, params);
    db.run(q3, params);
    db.run('COMMIT', () => res.json({ success: true }));
  });
});

app.get('/api/settings/:key', (req, res) => {
  db.get('SELECT value FROM settings WHERE key = ?', [req.params.key], (err, row) => {
    res.json(row ? JSON.parse(row.value) : null);
  });
});

app.post('/api/settings/:key', (req, res) => {
  db.run('REPLACE INTO settings (key, value) VALUES (?, ?)', [req.params.key, JSON.stringify(req.body.value)], () => {
    res.json({ success: true });
  });
});

// --- Gestão Contábil Endpoints ---

app.get('/api/gestao/integracoes', (req, res) => {
    const { ano, mes } = req.query;
    db.all('SELECT * FROM agf_integracoes WHERE ano = ? AND mes = ?', [parseInt(ano), parseInt(mes)], (err, rows) => res.json(rows || []));
});

app.post('/api/gestao/integracoes', (req, res) => {
    const { id, mes, ano, tipo, dia_atual, responsavel, updated_at } = req.body;
    db.run('REPLACE INTO agf_integracoes (id, mes, ano, tipo, dia_atual, responsavel, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', 
        [id, mes, ano, tipo, dia_atual, responsavel, updated_at], () => res.json({ success: true }));
});

app.get('/api/gestao/obrigacoes', (req, res) => {
    const { ano, mes } = req.query;
    db.all('SELECT * FROM agf_obrigacoes WHERE ano = ? AND mes = ?', [parseInt(ano), parseInt(mes)], (err, rows) => res.json(rows || []));
});

app.post('/api/gestao/obrigacoes', (req, res) => {
    const { id, mes, ano, tipo, status, data_entrega, responsavel, updated_at } = req.body;
    db.run('REPLACE INTO agf_obrigacoes (id, mes, ano, tipo, status, data_entrega, responsavel, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
        [id, mes, ano, tipo, status, data_entrega, responsavel, updated_at], () => res.json({ success: true }));
});

app.get('/api/gestao/pendencias', (req, res) => {
    db.all('SELECT * FROM agf_pendencias ORDER BY data_criacao DESC', (err, rows) => res.json(rows || []));
});

app.post('/api/gestao/pendencias', (req, res) => {
    const { id, documento, motivo, responsavel, criador, status, data_criacao, data_correcao, historico } = req.body;
    db.run('INSERT INTO agf_pendencias (id, documento, motivo, responsavel, criador, status, data_criacao, data_correcao, historico) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [id, documento, motivo, responsavel, criador, status, data_criacao, data_correcao, historico], () => res.json({ success: true }));
});

app.put('/api/gestao/pendencias/:id', (req, res) => {
    const { status, data_correcao, historico } = req.body;
    db.run('UPDATE agf_pendencias SET status = ?, data_correcao = ?, historico = ? WHERE id = ?', 
        [status, data_correcao, historico, req.params.id], () => res.json({ success: true }));
});

app.delete('/api/gestao/pendencias/:id', (req, res) => {
    db.run('DELETE FROM agf_pendencias WHERE id = ?', [req.params.id], () => res.json({ success: true }));
});

app.get('/api/notifications', (req, res) => {
    const username = req.query.username;
    if (!username) return res.json([]);
    
    const currAno = new Date().getFullYear();
    const currMes = new Date().getMonth() + 1;
    
    const notifs = [];
    
    db.serialize(() => {
        db.all('SELECT * FROM agf_pendencias WHERE status = "pendente" AND responsavel = ?', [username], (err, pends) => {
            if (pends) {
                pends.forEach(p => {
                    notifs.push({
                        id: p.id,
                        title: 'Documento Pendente',
                        message: `Você precisa corrigir o doc: ${p.documento} (${p.motivo})`,
                        type: 'warning',
                        link: 'gestao-pendencias'
                    });
                });
            }
            
            db.all('SELECT * FROM agf_integracoes WHERE responsavel = ? AND dia_atual < 31 AND mes = ? AND ano = ?', [username, currMes, currAno], (err, ints) => {
                if (ints) {
                    ints.forEach(i => {
                        notifs.push({
                            id: `int-${i.id}`,
                            title: 'Atualizar Integração',
                            message: `Lembrete: Atualizar o dia da integração de ${i.tipo} (${i.mes}/${i.ano})`,
                            type: 'info',
                            link: 'gestao-integracoes'
                        });
                    });
                }
                
                db.all('SELECT * FROM agf_obrigacoes WHERE responsavel = ? AND status != "entregue" AND mes = ? AND ano = ?', [username, currMes, currAno], (err, obrs) => {
                    if (obrs) {
                        obrs.forEach(o => {
                            notifs.push({
                                id: `obr-${o.id}`,
                                title: 'Obrigação Acessória',
                                message: `Não se esqueça da obrigação ${o.tipo} (${o.mes}/${o.ano})`,
                                type: 'danger',
                                link: 'gestao-obrigacoes'
                            });
                        });
                    }
                    
                    res.json(notifs);
                });
            });
        });
    });
});


app.get("/api/pendencias", (req, res) => {
  const { ano } = req.query;
  const targetAno = parseInt(ano) || new Date().getFullYear();
  
  db.all("SELECT empresaId, MAX(mes) as lastMonth FROM dre_history WHERE ano = ? AND id NOT LIKE 'tax-dre-%' GROUP BY empresaId", [targetAno], (err, imports) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.all("SELECT empresaId, MAX(mes) as lastTaxMonth FROM dre_history WHERE ano = ? AND id LIKE 'tax-dre-irpj-%' GROUP BY empresaId", [targetAno], (err, taxes) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const result = {};
      imports.forEach(i => {
        result[i.empresaId] = { lastImport: i.lastMonth, lastTax: 0 };
      });
      taxes.forEach(t => {
        if (!result[t.empresaId]) result[t.empresaId] = { lastImport: 0, lastTax: 0 };
        result[t.empresaId].lastTax = t.lastTaxMonth;
      });
      
      res.json(result);
    });
  });
});

app.listen(port, () => console.log('Backend rodando na porta 3001'));

