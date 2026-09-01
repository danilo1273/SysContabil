const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://qxowhfxhotofktsteule.supabase.co",
  "sb_publishable_R5XYBT2dd7abUG-C1zN9Uw_ScSzLuos"
);

async function check() {
  const { data: dre, error: e1 } = await supabase.from("dre_history").select("id").limit(10);
  console.log("DRE:", dre ? dre.length : e1);
  const { data: balanco, error: e2 } = await supabase.from("balanco_history").select("id").limit(10);
  console.log("Balanco:", balanco ? balanco.length : e2);
}
check();

