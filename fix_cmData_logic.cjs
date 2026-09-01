const fs = require("fs");
let code = fs.readFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", "utf8");

const oldCode = `const cmRes = { ok: false }; const { data: _cmData } = await supabase.from("settings").select("value").eq("key", "customMapping").single(); if (_cmData) { cmRes.ok = true; cmRes.json = async () => JSON.parse(_cmData.value); }
          const _cmData = await cmRes.json();
          if (_cmData) setCustomMappings(_cmData);`;

// Wait, I renamed it previously to `_cmData` for the second line too!
// Let me just replace those 3 lines.
let idx = code.indexOf(`const cmRes = { ok: false };`);
if (idx !== -1) {
    let endIdx = code.indexOf(`} catch (e) {`, idx);
    let newBlock = `const { data: _cmData } = await supabase.from("settings").select("value").eq("key", "customMapping").single();
          if (_cmData && _cmData.value) {
              try { setCustomMappings(JSON.parse(_cmData.value)); } catch(e){}
          }
        `;
    code = code.substring(0, idx) + newBlock + code.substring(endIdx);
    fs.writeFileSync("c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx", code);
}

