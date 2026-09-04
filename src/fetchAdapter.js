import { supabase } from "./supabaseClient";

const originalFetch = window.fetch;

window.fetch = async (...args) => {
  const [resource, config] = args;
  const url = typeof resource === "string" ? resource : resource.url;
  
  if (url.startsWith("/api/")) {
    // Intercept GET requests
    if (!config || !config.method || config.method === "GET") {
      if (url.includes("/agf_users") || url.includes("/settings/agf_users")) {
        const { data: setRow } = await supabase.from("settings").select("value").eq("key", "agf_users").single();
        if (setRow && setRow.value) {
          const parsed = typeof setRow.value === "string" ? JSON.parse(setRow.value) : setRow.value;
          return { ok: true, json: async () => parsed || [] };
        }
        const { data } = await supabase.from("agf_users").select("*");
        return { ok: true, json: async () => data || [] };
      }
      if (url.includes("/gestao/integracoes")) {
        const params = new URL(url, window.location.origin).searchParams;
        const ano = params.get("ano");
        const mes = params.get("mes");
        const { data } = await supabase.from("agf_integracoes").select("*").eq("ano", ano).eq("mes", mes);
        return { ok: true, json: async () => data || [] };
      }
      if (url.includes("/gestao/obrigacoes")) {
        const params = new URL(url, window.location.origin).searchParams;
        const ano = params.get("ano");
        const mes = params.get("mes");
        const { data } = await supabase.from("agf_obrigacoes").select("*").eq("ano", ano).eq("mes", mes);
        return { ok: true, json: async () => data || [] };
      }
      if (url.includes("/gestao/pendencias")) {
        const { data } = await supabase.from("agf_pendencias").select("*");
        return { ok: true, json: async () => data || [] };
      }
      if (url.includes("/settings/agf_obrigacoes_tipos")) {
        const { data } = await supabase.from("settings").select("value").eq("key", "agf_obrigacoes_tipos").single();
        return { ok: true, json: async () => (data ? JSON.parse(data.value) : null) };
      }
      if (url.includes("/settings/agf_tax_store")) {
        const { data } = await supabase.from("settings").select("value").eq("key", "agf_tax_store").single();
        return { ok: true, json: async () => (data ? JSON.parse(data.value) : null) };
      }
    }
    
    // Intercept POST/PUT
    if (config && (config.method === "POST" || config.method === "PUT")) {
      const body = JSON.parse(config.body);
      
      if (url.includes("/gestao/integracoes")) {
        await supabase.from("agf_integracoes").upsert(body);
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url.includes("/gestao/obrigacoes")) {
        await supabase.from("agf_obrigacoes").upsert(body);
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url.includes("/gestao/pendencias")) {
        const parts = url.split("/");
        const lastPart = parts[parts.length - 1].split("?")[0];
        const targetId = (lastPart && lastPart !== "pendencias") ? lastPart : body.id;
        
        const cleanPayload = {
          id: targetId || ('pend-' + Date.now()),
          documento: body.documento || '',
          motivo: body.motivo || '',
          responsavel: body.responsavel || '',
          criador: body.criador || body.criado_por || 'Sistema',
          status: body.status || 'pendente',
          data_criacao: body.data_criacao || new Date().toISOString(),
          data_correcao: body.data_correcao || null,
          historico: typeof body.historico === 'string' ? body.historico : JSON.stringify(body.historico || [])
        };

        const { error } = await supabase.from("agf_pendencias").upsert(cleanPayload);
        if (error) console.error("Error upserting agf_pendencias:", error);
        return { ok: !error, json: async () => ({ success: !error, error }) };
      }
      if (url.includes("/settings/agf_obrigacoes_tipos")) {
        await supabase.from("settings").upsert({ key: "agf_obrigacoes_tipos", value: JSON.stringify(body.value || body) });
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url.includes("/settings/agf_tax_store")) {
        await supabase.from("settings").upsert({ key: "agf_tax_store", value: JSON.stringify(body.value || body) });
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url.includes("/agf_users") || url.includes("/settings/agf_users")) {
        await supabase.from("settings").upsert({ key: "agf_users", value: JSON.stringify(body.value || body) });
        return { ok: true, json: async () => ({ success: true }) };
      }
    }

    // Intercept DELETE
    if (config && config.method === "DELETE") {
      if (url.includes("/gestao/pendencias")) {
        const parts = url.split("/");
        const lastPart = parts[parts.length - 1].split("?")[0];
        if (lastPart && lastPart !== "pendencias") {
          await supabase.from("agf_pendencias").delete().eq("id", lastPart);
        } else {
          const params = new URL(url, window.location.origin).searchParams;
          const pId = params.get("id");
          if (pId) await supabase.from("agf_pendencias").delete().eq("id", pId);
        }
        return { ok: true, json: async () => ({ success: true }) };
      }
    }
  }

  return originalFetch(...args);
};

