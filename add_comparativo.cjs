const fs = require('fs');
const file = 'c:/Users/User/Desktop/Consolidado/src/components/TaxModule.jsx';
let txt = fs.readFileSync(file, 'utf8');

const replacement = `  const renderComparativo = () => {
    const isEstimativa = taxConfig[selectedComp] === 'real_anual';
    if (!isEstimativa) return null;

    const calcPres = calcPresumido();
    const cM = calcPres.mensal;
    const calcR = calcReal();
    
    const impostoRealIrpj = Math.max(0, calcR.irpjTotal);
    const impostoRealCsll = Math.max(0, calcR.csllTotal);

    const impostoEstimativaIrpj = Math.max(0, cM.irpjTotal);
    const impostoEstimativaCsll = Math.max(0, cM.csllTotal);
    
    const suspenderIrpj = impostoRealIrpj <= impostoEstimativaIrpj;
    const suspenderCsll = impostoRealCsll <= impostoEstimativaCsll;

    return (
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid #FFC107', background: 'rgba(255, 193, 7, 0.05)' }}>
        <h3 style={{ color: '#FFC107', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="material-icons">balance</span> 
          Comparativo para Suspensão / Redução (Mês {selectedMes}/{selectedAno})
        </h3>
        <p style={{ color: '#ccc', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Analise se é mais vantajoso pagar o imposto pela Estimativa (Regra do Presumido) ou levantar Balanço de Suspensão/Redução (Lucro Real).
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', textAlign: 'center' }}>
           <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
              <h4 style={{ color: '#888', marginBottom: '0.5rem' }}>IMPOSTO DE RENDA (IRPJ)</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: '#aaa' }}>DARF Estimativa:</span>
                <strong style={{ color: '#2196F3' }}>{impostoEstimativaIrpj.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: '#aaa' }}>Balanço (Real):</span>
                <strong style={{ color: '#9C27B0' }}>{impostoRealIrpj.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </div>
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #333' }}>
                 {suspenderIrpj ? (
                    <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓ Suspender / Reduzir (Pagar pelo Real)</span>
                 ) : (
                    <span style={{ color: '#FF9800', fontWeight: 'bold' }}>⚠️ Pagar pela Estimativa</span>
                 )}
              </div>
           </div>

           <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
              <h4 style={{ color: '#888', marginBottom: '0.5rem' }}>CONTRIBUIÇÃO SOCIAL (CSLL)</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: '#aaa' }}>DARF Estimativa:</span>
                <strong style={{ color: '#2196F3' }}>{impostoEstimativaCsll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: '#aaa' }}>Balanço (Real):</span>
                <strong style={{ color: '#9C27B0' }}>{impostoRealCsll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </div>
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #333' }}>
                 {suspenderCsll ? (
                    <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓ Suspender / Reduzir (Pagar pelo Real)</span>
                 ) : (
                    <span style={{ color: '#FF9800', fontWeight: 'bold' }}>⚠️ Pagar pela Estimativa</span>
                 )}
              </div>
           </div>

           <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h4 style={{ color: '#fff', marginBottom: '0.5rem' }}>TOTAL A PAGAR NESTE MÊS</h4>
              <h2 style={{ color: '#4CAF50', margin: '0.5rem 0' }}>
                 {(
                    (suspenderIrpj ? impostoRealIrpj : impostoEstimativaIrpj) + 
                    (suspenderCsll ? impostoRealCsll : impostoEstimativaCsll)
                 ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Decisão mais vantajosa.</span>
           </div>
        </div>
      </div>
    );
  };
`;

const lines = txt.split('\n');
const start = lines.findIndex(l => l.includes('const renderPresumido = () => {'));

if (start !== -1) {
  lines.splice(start, 0, replacement);
  
  // also inject it in the main render
  const renderIndex = lines.findIndex(l => l.includes("&& renderPresumido()}"));
  if (renderIndex !== -1) {
    lines.splice(renderIndex, 0, "                  {taxConfig[selectedComp] === 'real_anual' && renderComparativo()}");
  }

  fs.writeFileSync(file, lines.join('\n'));
  console.log('Successfully updated!');
} else {
  console.log('Could not find bounds');
}
