const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://qxowhfxhotofktsteule.supabase.co", "sb_publishable_R5XYBT2dd7abUG-C1zN9Uw_ScSzLuos");
async function test() {
  let allData = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase.from("balanco_history").select("*").eq("empresaId", "equipamentos").eq("ano", 2026).eq("mes", 1).range(from, from + step - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < step) break;
    from += step;
  }
  console.log("Total Fetched:", allData.length);
}
test();
