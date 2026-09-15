const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  console.warn('Nodemailer not loaded yet', e);
}

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
  db.run('CREATE TABLE IF NOT EXISTS agf_users (id TEXT PRIMARY KEY, username TEXT, password TEXT, role TEXT, email TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS agf_integracoes (id TEXT PRIMARY KEY, mes INTEGER, ano INTEGER, tipo TEXT, dia_atual INTEGER, responsavel TEXT, updated_at TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS agf_obrigacoes (id TEXT PRIMARY KEY, mes INTEGER, ano INTEGER, tipo TEXT, status TEXT, data_entrega TEXT, responsavel TEXT, updated_at TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS agf_pendencias (id TEXT PRIMARY KEY, documento TEXT, motivo TEXT, responsavel TEXT, criador TEXT, status TEXT, data_criacao TEXT, data_correcao TEXT, historico TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS agf_rotinas (id TEXT PRIMARY KEY, ano INTEGER, mes INTEGER, empresaId TEXT, filialCode TEXT, filialNome TEXT, titulo TEXT, categoria TEXT, tipo TEXT, dia_atual INTEGER, status TEXT, responsavel TEXT, responsavelEmail TEXT, dependencias TEXT, data_limite TEXT, concluido_em TEXT, concluido_por TEXT, email_notificado INTEGER, updated_at TEXT)');
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
    const { documento, motivo, responsavel, criador, status, data_criacao, data_correcao, historico } = req.body;
    db.run(
        'UPDATE agf_pendencias SET documento = COALESCE(?, documento), motivo = COALESCE(?, motivo), responsavel = COALESCE(?, responsavel), criador = COALESCE(?, criador), status = COALESCE(?, status), data_criacao = COALESCE(?, data_criacao), data_correcao = ?, historico = COALESCE(?, historico) WHERE id = ?', 
        [documento, motivo, responsavel, criador, status, data_criacao, data_correcao, historico, req.params.id], 
        () => res.json({ success: true })
    );
});

app.delete('/api/gestao/pendencias/:id', (req, res) => {
    db.run('DELETE FROM agf_pendencias WHERE id = ?', [req.params.id], () => res.json({ success: true }));
});

// --- Gestão de Rotinas e Workflow Contábil com Dependências ---
app.get('/api/gestao/rotinas', (req, res) => {
    const { ano, mes, empresaId } = req.query;
    let query = 'SELECT * FROM agf_rotinas WHERE ano = ? AND mes = ?';
    const params = [parseInt(ano), parseInt(mes)];
    if (empresaId && empresaId !== 'todas' && empresaId !== 'consolidado') {
        query += ' AND empresaId = ?';
        params.push(empresaId);
    }
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const parsed = (rows || []).map(r => {
            let deps = [];
            try { deps = JSON.parse(r.dependencias); } catch (e) { deps = []; }
            return { ...r, dependencias: deps, email_notificado: Boolean(r.email_notificado) };
        });
        res.json(parsed);
    });
});

app.post('/api/gestao/rotinas', (req, res) => {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    db.serialize(() => {
        const stmt = db.prepare(`REPLACE INTO agf_rotinas 
          (id, ano, mes, empresaId, filialCode, filialNome, titulo, categoria, tipo, dia_atual, status, responsavel, responsavelEmail, dependencias, data_limite, concluido_em, concluido_por, email_notificado, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        
        items.forEach(item => {
            const depsStr = typeof item.dependencias === 'string' ? item.dependencias : JSON.stringify(item.dependencias || []);
            stmt.run([
                item.id,
                item.ano,
                item.mes,
                item.empresaId,
                item.filialCode,
                item.filialNome || '',
                item.titulo,
                item.categoria || 'integracao',
                item.tipo || 'personalizado',
                item.dia_atual || 0,
                item.status || 'bloqueada',
                item.responsavel || '',
                item.responsavelEmail || '',
                depsStr,
                item.data_limite || '',
                item.concluido_em || null,
                item.concluido_por || null,
                item.email_notificado ? 1 : 0,
                item.updated_at || new Date().toISOString()
            ]);
        });
        stmt.finalize(() => res.json({ success: true, count: items.length }));
    });
});

app.put('/api/gestao/rotinas/:id', (req, res) => {
    const item = req.body;
    const depsStr = typeof item.dependencias === 'string' ? item.dependencias : JSON.stringify(item.dependencias || []);
    db.run(
        `UPDATE agf_rotinas SET 
           titulo = COALESCE(?, titulo),
           dia_atual = COALESCE(?, dia_atual),
           status = COALESCE(?, status),
           responsavel = COALESCE(?, responsavel),
           responsavelEmail = COALESCE(?, responsavelEmail),
           dependencias = COALESCE(?, dependencias),
           data_limite = COALESCE(?, data_limite),
           concluido_em = ?,
           concluido_por = ?,
           email_notificado = COALESCE(?, email_notificado),
           updated_at = ?
         WHERE id = ?`,
        [
            item.titulo,
            item.dia_atual,
            item.status,
            item.responsavel,
            item.responsavelEmail,
            depsStr,
            item.data_limite,
            item.concluido_em,
            item.concluido_por,
            item.email_notificado !== undefined ? (item.email_notificado ? 1 : 0) : null,
            new Date().toISOString(),
            req.params.id
        ],
        () => res.json({ success: true })
    );
});

app.delete('/api/gestao/rotinas/:id', (req, res) => {
    db.run('DELETE FROM agf_rotinas WHERE id = ?', [req.params.id], () => res.json({ success: true }));
});

// Endpoint de Envio de E-mail via SMTP / Log
app.post('/api/send-email', async (req, res) => {
    const { to, subject, html, text } = req.body;
    if (!to || !subject) {
        return res.status(400).json({ error: 'Destinatário (to) e Assunto (subject) são obrigatórios' });
    }

    try {
        db.get("SELECT value FROM settings WHERE key = 'agf_smtp_config'", async (err, row) => {
            let smtpConfig = null;
            if (row && row.value) {
                try { smtpConfig = JSON.parse(row.value); } catch(e) {}
            }

            if (nodemailer && smtpConfig && smtpConfig.host && smtpConfig.user && smtpConfig.pass) {
                try {
                    const transporter = nodemailer.createTransport({
                        host: smtpConfig.host,
                        port: parseInt(smtpConfig.port) || 587,
                        secure: Boolean(smtpConfig.secure || smtpConfig.port === 465),
                        auth: {
                            user: smtpConfig.user,
                            pass: smtpConfig.pass
                        }
                    });

                    const info = await transporter.sendMail({
                        from: smtpConfig.from || `"SysContábil AGF" <${smtpConfig.user}>`,
                        to,
                        subject,
                        text: text || '',
                        html: html || `<p>${text || subject}</p>`
                    });

                    console.log('E-mail enviado via SMTP:', info.messageId);
                    return res.json({ success: true, messageId: info.messageId, mode: 'smtp' });
                } catch (sendErr) {
                    console.error('Erro ao enviar e-mail via SMTP:', sendErr);
                    return res.json({ success: false, error: sendErr.message, mode: 'smtp_failed' });
                }
            } else {
                console.log(`[ALERTA E-MAIL] Para: ${to} | Assunto: ${subject}\nConteúdo: ${text}`);
                return res.json({ 
                    success: true, 
                    mode: 'logged', 
                    message: 'E-mail registrado no log do sistema (para envio real, cadastre o SMTP na aba Gestão Contábil).' 
                });
            }
        });
    } catch (e) {
        console.error('Erro geral ao processar email:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/notifications', (req, res) => {
    const username = req.query.username;
    if (!username) return res.json([]);
    
    const currAno = new Date().getFullYear();
    const currMes = new Date().getMonth() + 1;
    
    const notifs = [];
    
    db.serialize(() => {
        // 1. Rotinas liberadas aguardando execução
        db.all('SELECT * FROM agf_rotinas WHERE status = "liberada" AND responsavel = ? AND mes = ? AND ano = ?', [username, currMes, currAno], (err, rots) => {
            if (rots) {
                rots.forEach(r => {
                    notifs.push({
                        id: `rot-${r.id}`,
                        title: 'Rotina Liberada!',
                        message: `As integrações da Filial ${r.filialCode || ''} foram concluídas! Você já pode seguir com: ${r.titulo}`,
                        type: 'success',
                        link: 'gestao-integracoes'
                    });
                });
            }

            // 2. Pendências
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
                
                // 3. Integrações antigas
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
                    
                    // 4. Obrigações
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

