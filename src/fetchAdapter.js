import { supabase } from "./supabaseClient";

const originalFetch = window.fetch;

window.fetch = async (...args) => {
  const [resource, config] = args;
  const url = typeof resource === "string" ? resource : resource.url;
  
  if (url.startsWith("/api/")) {
    // Intercept GET requests
    if (!config || !config.method || config.method === "GET") {
      if (url.includes("/agf_users")) {
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
        await supabase.from("agf_pendencias").upsert(body);
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url.includes("/settings/agf_obrigacoes_tipos")) {
        await supabase.from("settings").upsert({ key: "agf_obrigacoes_tipos", value: JSON.stringify(body.value || body) });
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url.includes("/settings/agf_tax_store")) {
        await supabase.from("settings").upsert({ key: "agf_tax_store", value: JSON.stringify(body.value || body) });
        return { ok: true, json: async () => ({ success: true }) };
      }
    }
  }

  return originalFetch(...args);
};

