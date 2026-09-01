const { createClient } = require("@supabase/supabase-js");
const sqlite3 = require("sqlite3");

const db = new sqlite3.Database("database.sqlite");

const supabase = createClient(
  "https://qxowhfxhotofktsteule.supabase.co",
  "sb_publishable_R5XYBT2dd7abUG-C1zN9Uw_ScSzLuos"
);

const tables = [
  "dre_history",
  "balanco_history",
  "cc_history",
  "agf_users",
  "agf_integracoes",
  "agf_obrigacoes",
  "agf_pendencias",
  "settings"
];

async function migrate() {
  for (const table of tables) {
    console.log(`Migrando tabela: ${table}`);
    
    await new Promise((resolve, reject) => {
      db.all(`SELECT * FROM ${table}`, async (err, rows) => {
        if (err) return reject(err);
        if (rows.length === 0) {
          console.log(`- Vazia.`);
          return resolve();
        }
        
        console.log(`- Encontrados ${rows.length} registros.`);
        
        const chunkSize = 500;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const { error } = await supabase.from(table).upsert(chunk);
          if (error) {
            console.error(`Erro inserindo chunk na ${table}:`, error);
          }
        }
        console.log(`- Migração da ${table} concluída.`);
        resolve();
      });
    });
  }
  console.log("MIGRAÇÃO TOTAL CONCLUÍDA!");
}

migrate();

