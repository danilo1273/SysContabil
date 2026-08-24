import fs from 'fs';

const p = 'c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx';
let content = fs.readFileSync(p, 'utf8');

// 1. Add secondaryTab state
if (!content.includes('const [secondaryTab')) {
  content = content.replace(
    /const \[activeTab, setActiveTab\] = useState\('upload'\);/,
    "const [activeTab, setActiveTab] = useState('upload');\n  const [secondaryTab, setSecondaryTab] = useState('dash');"
  );
}

// 2. Rewrite buildDRE
const dreRegex = /\/\/ DRE Customizada com Subtotais[\s\S]*?const dreResult = buildDRE\(\);/;
const newDRE = `// DRE Customizada com Subtotais (Fiel ao Excel do Cliente)
      const buildDRE = () => {
         const lines = [];
         let globalIdx = 0;
         const getId = () => \`dre-\${globalIdx++}\`;

         let recBruta = { id: getId(), conta: 'RECEITA OPERACIONAL BRUTA', isTotal: true, isSubtotal: true, consolidado: 0 };
         let recLiq = { id: getId(), conta: 'RECEITA OPERACIONAL LÍQUIDA', isTotal: true, isSubtotal: true, consolidado: 0 };
         let custoVend = { id: getId(), conta: 'CUSTO DOS PRODUTOS VENDIDOS', isTotal: true, isSubtotal: true, consolidado: 0 };
         let lucroBruto = { id: getId(), conta: 'LUCRO BRUTO', isTotal: true, isSubtotal: true, consolidado: 0 };
         let ebit = { id: getId(), conta: 'RESULTADO DAS OPERAÇÕES (EBIT)', isTotal: true, isSubtotal: true, consolidado: 0 };
         let ebitda = { id: getId(), conta: 'EBITDA (Calculado)', isTotal: true, isSubtotal: true, consolidado: 0 };
         let lucroLiq = { id: getId(), conta: 'LUCRO LÍQUIDO (EBIT)', isTotal: true, isSubtotal: true, consolidado: 0 };
         
         consolidated.companies.forEach(c => {
           recBruta[c.id] = 0; recLiq[c.id] = 0; custoVend[c.id] = 0; 
           lucroBruto[c.id] = 0; ebit[c.id] = 0; ebitda[c.id] = 0; lucroLiq[c.id] = 0;
         });

         const sampleComp = consolidated.companies[0]?.id;
         if (!sampleComp) return { lines: [], subtotals: { recBruta, recLiq, custoVend, lucroBruto, ebit, ebitda, lucroLiq } };

         // A - Receita Bruta
         const rBrutaGroup = buildGenericTable(consolidated.dre, { 'RECEITA OPERACIONAL BRUTA': protheusMapping.dre['RECEITA OPERACIONAL BRUTA'] }, 'dre-a');
         lines.push(...rBrutaGroup);
         const rbTotal = rBrutaGroup.find(l => l.conta === 'TOTAL RECEITA OPERACIONAL BRUTA');
         if (rbTotal) {
           consolidated.companies.forEach(c => recBruta[c.id] = rbTotal[c.id] || 0);
           recBruta.consolidado = rbTotal.consolidado || 0;
         }

         // B - Impostos s/ Vendas
         const impostosGroup = buildGenericTable(consolidated.dre, { 'IMPOSTOS S/ VENDAS E DEVOLUÇÕES': protheusMapping.dre['IMPOSTOS S/ VENDAS E DEVOLUÇÕES'] }, 'dre-b');
         lines.push(...impostosGroup);
         const impTotal = impostosGroup.find(l => l.conta === 'TOTAL IMPOSTOS S/ VENDAS E DEVOLUÇÕES');
         
         // C - Receita Operacional Líquida
         consolidated.companies.forEach(c => recLiq[c.id] = recBruta[c.id] + (impTotal ? impTotal[c.id] || 0 : 0));
         recLiq.consolidado = recBruta.consolidado + (impTotal ? impTotal.consolidado || 0 : 0);
         lines.push(recLiq);

         // Custos (D, E, F, G, H)
         const custoGroups = ['CUSTO PRODUTO VENDIDO', 'CUSTO MERC REVENDIDAS', 'MÃO DE OBRA', 'GASTOS GERAIS PRODUTOS/MERC REVENDIDAS', 'GASTOS GERAIS PRESTAÇÃO SERVIÇOS'];
         let hasCustos = false;
         custoGroups.forEach(g => {
            if (protheusMapping.dre[g]) {
              const gLines = buildGenericTable(consolidated.dre, { [g]: protheusMapping.dre[g] }, \`dre-\${g}\`);
              lines.push(...gLines);
              const gTotal = gLines.find(l => l.conta === 'TOTAL ' + g);
              if (gTotal) {
                 consolidated.companies.forEach(c => custoVend[c.id] += gTotal[c.id] || 0);
                 custoVend.consolidado += gTotal.consolidado || 0;
                 hasCustos = true;
              }
            }
         });
         
         // I - Custo dos Produtos Vendidos (Totalizador)
         if (hasCustos) lines.push(custoVend);
         
         // J - Lucro Bruto
         consolidated.companies.forEach(c => lucroBruto[c.id] = recLiq[c.id] + custoVend[c.id]);
         lucroBruto.consolidado = recLiq.consolidado + custoVend.consolidado;
         lines.push(lucroBruto);
         
         // K, L, M, N - Despesas
         const despGroups = ['DESPESAS COM VENDAS', 'DESPESAS ADMINISTRATIVAS', 'DESPESAS TRIBUTÁRIAS', 'DEPRECIAÇÕES / AMORTIZAÇÕES'];
         let despTotal = { consolidado: 0 };
         consolidated.companies.forEach(c => despTotal[c.id] = 0);
         
         let deprTotal = { consolidado: 0 };
         consolidated.companies.forEach(c => deprTotal[c.id] = 0);
         
         despGroups.forEach(g => {
            if (protheusMapping.dre[g]) {
              const gLines = buildGenericTable(consolidated.dre, { [g]: protheusMapping.dre[g] }, \`dre-\${g}\`);
              lines.push(...gLines);
              const gTotal = gLines.find(l => l.conta === 'TOTAL ' + g);
              if (gTotal) {
                 consolidated.companies.forEach(c => despTotal[c.id] += gTotal[c.id] || 0);
                 despTotal.consolidado += gTotal.consolidado || 0;
                 
                 if (g === 'DEPRECIAÇÕES / AMORTIZAÇÕES') {
                    consolidated.companies.forEach(c => deprTotal[c.id] += gTotal[c.id] || 0);
                    deprTotal.consolidado += gTotal.consolidado || 0;
                 }
              }
            }
         });
         
         // O - EBIT
         consolidated.companies.forEach(c => ebit[c.id] = lucroBruto[c.id] + despTotal[c.id]);
         ebit.consolidado = lucroBruto.consolidado + despTotal.consolidado;
         lines.push(ebit);
         
         // Lucro Liq is same as EBIT for now based on the Excel
         consolidated.companies.forEach(c => lucroLiq[c.id] = ebit[c.id]);
         lucroLiq.consolidado = ebit.consolidado;
         
         // EBITDA = EBIT - Depreciações (Depreciação é negativa no DRE, então EBIT - Depreciacao soma)
         consolidated.companies.forEach(c => ebitda[c.id] = ebit[c.id] - deprTotal[c.id]);
         ebitda.consolidado = ebit.consolidado - deprTotal.consolidado;

         return { lines, subtotals: { recBruta, recLiq, lucroBruto, ebitda, lucroLiq, custoVend } };
      };
      
      const dreResult = buildDRE();`;
content = content.replace(dreRegex, newDRE);

// 3. Rewrite activeTab == 'resultados' section
const resultadosRegex = /\{\/\* Dashboard Superior \*\/\}[\s\S]*?(?=\s*<\/div>\s*<\/div>\s*\)\s*;\s*\}\s*export default ProtheusModule)/;

const newResultados = `{/* Tabs de Resultado */}
          <div className="results-subtabs glass-panel" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', padding: '1rem' }}>
            <button className={\`tab-btn \${secondaryTab === 'dash' ? 'active' : ''}\`} onClick={() => setSecondaryTab('dash')}>📊 Dashboard</button>
            <button className={\`tab-btn \${secondaryTab === 'dre' ? 'active' : ''}\`} onClick={() => setSecondaryTab('dre')}>📉 DRE</button>
            <button className={\`tab-btn \${secondaryTab === 'balanco' ? 'active' : ''}\`} onClick={() => setSecondaryTab('balanco')}>⚖️ Balanço</button>
            <button className={\`tab-btn \${secondaryTab === 'dfc' ? 'active' : ''}\`} onClick={() => setSecondaryTab('dfc')}>💸 DFC</button>
          </div>

          {secondaryTab === 'dash' && (
            <div className="analysis-board">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', borderTop: '4px solid #4CAF50' }}>
                  <h4 style={{ color: '#aaa', marginBottom: '0.5rem' }}>Receita Líquida ({period.toUpperCase()})</h4>
                  <h2 style={{ fontSize: '1.8rem' }}>{results.subtotals.recLiq.consolidado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</h2>
                </div>
                <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', borderTop: '4px solid #2196F3' }}>
                  <h4 style={{ color: '#aaa', marginBottom: '0.5rem' }}>Margem Bruta</h4>
                  <h2 style={{ fontSize: '1.8rem' }}>
                    {results.subtotals.recLiq.consolidado > 0 ? ((results.subtotals.lucroBruto.consolidado / results.subtotals.recLiq.consolidado) * 100).toFixed(1) : 0}%
                  </h2>
                </div>
                <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', borderTop: '4px solid #f7c324' }}>
                  <h4 style={{ color: '#aaa', marginBottom: '0.5rem' }}>EBITDA ({period.toUpperCase()})</h4>
                  <h2 style={{ fontSize: '1.8rem' }}>{results.subtotals.ebitda.consolidado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</h2>
                </div>
                <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', borderTop: '4px solid #9C27B0' }}>
                  <h4 style={{ color: '#aaa', marginBottom: '0.5rem' }}>Margem Líquida</h4>
                  <h2 style={{ fontSize: '1.8rem' }}>
                    {results.subtotals.recLiq.consolidado > 0 ? ((results.subtotals.lucroLiq.consolidado / results.subtotals.recLiq.consolidado) * 100).toFixed(1) : 0}%
                  </h2>
                </div>
              </div>
            </div>
          )}

          {secondaryTab === 'dre' && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
               {renderTable(\`Demonstração de Resultado do Exercício (DRE) - \${period.toUpperCase()}\`, results.dre)}
            </div>
          )}

          {secondaryTab === 'balanco' && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
               {renderTable('Balanço Patrimonial - ATIVO', results.ativo)}
               {renderTable('Balanço Patrimonial - PASSIVO', results.passivo)}
            </div>
          )}

          {secondaryTab === 'dfc' && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
               {renderTable(\`Demonstração de Fluxo de Caixa (DFC) - \${period.toUpperCase()}\`, results.dfc)}
            </div>
          )}`;
          
content = content.replace(resultadosRegex, newResultados);

// 4. Update the DFC build logic that referenced old dreResult names
content = content.replace(/dreResult\.subtotals\.lucroLiq/g, "dreResult.subtotals.lucroLiq"); // already matching
// Wait, DFC had `deprLine = dreResult.lines.find(l => l.conta === 'Depreciações e Amortizações');`
// In the new DRE, it's called 'TOTAL DEPRECIAÇÕES / AMORTIZAÇÕES'
content = content.replace(/l\.conta === 'Depreciações e Amortizações'/g, "l.conta === 'TOTAL DEPRECIAÇÕES / AMORTIZAÇÕES'");
// also the DFC used dreResult.subtotals.ebitda which still exists.

fs.writeFileSync(p, content);
console.log('UI Rewritten');
