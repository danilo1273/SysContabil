const fs = require('fs');
const file = 'c:/Users/User/Desktop/Consolidado/src/components/TaxModule.jsx';
let txt = fs.readFileSync(file, 'utf8');

const replacement = `  const renderPresumido = () => {
    const isEstimativa = taxConfig[selectedComp] === 'real_anual';
    const calc = calcPresumido();
    const cM = calc.mensal;
    const cA = calc.acumulado;
    
    const Row = ({ label, m, a, color, bold }) => (
      <div style={{ display: 'grid', gridTemplateColumns: isEstimativa ? '2fr 1fr 1fr' : '2fr 1fr', gap: '1rem', marginBottom: '0.5rem', color: color || 'inherit', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
        <span style={{ fontSize: '0.9rem' }}>{label}</span>
        <span style={{ textAlign: 'right', fontWeight: bold ? 'bold' : 'normal' }}>{m.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        {isEstimativa && <span style={{ textAlign: 'right', color: '#888' }}>{a.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
      </div>
    );

    return (
      <div style={{ marginTop: '1.5rem' }}>
        <h3 style={{ color: '#2196F3', marginBottom: '1rem' }}>{isEstimativa ? 'Cálculo da Estimativa Mensal (DARF - Regra do Presumido)' : 'Cálculo do Lucro Presumido (Trimestre Atual)'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(33, 150, 243, 0.05)' }}>
            <h4 style={{ color: '#ccc', marginBottom: '1rem' }}>1. Receitas e Base</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: isEstimativa ? '2fr 1fr 1fr' : '2fr 1fr', gap: '1rem', marginBottom: '1rem', color: '#666', fontSize: '0.8rem', borderBottom: '1px solid #444', paddingBottom: '0.5rem' }}>
               <span></span>
               <span style={{ textAlign: 'right' }}>{isEstimativa ? 'DO MÊS' : 'DO TRIMESTRE'}</span>
               {isEstimativa && <span style={{ textAlign: 'right' }}>ACUMULADO DO ANO</span>}
            </div>

            <Row label="Receita Venda/Revenda:" m={cM.recRevenda} a={cA.recRevenda} bold={true} />
            <Row label="(-) IPI sobre Vendas (Extraído da DRE)" m={cM.ipi} a={cA.ipi} color="#f44336" />
            <Row label="(-) ICMS ST sobre Vendas (Extraído da DRE)" m={cM.icmsSt} a={cA.icmsSt} color="#f44336" />
            
            <div style={{ margin: '1rem 0' }}>
               <Row label="Base Receita Venda Líquida (8% / 12%):" m={cM.recRevendaLiquida} a={cA.recRevendaLiquida} color="#2196F3" bold={true} />
            </div>

            <Row label="Receita Serviço (32%):" m={cM.recServico} a={cA.recServico} bold={true} />
            
            <div style={{ marginBottom: '1rem', marginTop: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(+) Outras Receitas (Financ, Ganho Cap, etc - 100%) - <b>Valor do Mês</b></label>
              <input type="number" className="text-input" value={presumidoOutrasReceitas} onChange={e => setPresumidoOutrasReceitas(e.target.value)} style={{ width: '100%' }} />
            </div>
            
            {cambioConfig[selectedComp] === 'caixa' && (
              <>
                <Row label="(-) Variação Cambial DRE (Estorno Auto):" m={cM.variacaoCambial > 0 ? cM.variacaoCambial * -1 : 0} a={cA.variacaoCambial > 0 ? cA.variacaoCambial * -1 : 0} color="#888" />
                <div style={{ marginBottom: '1rem', marginTop: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#FFCA28', marginBottom: '0.3rem' }}>(+) Variação Cambial Realizada (Regime de Caixa) - <b>Valor do Mês</b></label>
                  <input type="number" className="text-input" value={presumidoCambioRealizado} onChange={e => setPresumidoCambioRealizado(e.target.value)} style={{ width: '100%', borderColor: '#FFCA28' }} />
                </div>
              </>
            )}

            <div style={{ marginTop: '1.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center' }}>
                <input type="checkbox" id="presumidoMajoracao" checked={presumidoMajoracao} onChange={e => setPresumidoMajoracao(e.target.checked)} style={{ marginRight: '0.5rem', transform: 'scale(1.2)' }} />
                <label htmlFor="presumidoMajoracao" style={{ color: '#ddd', fontSize: '0.9rem', cursor: 'pointer' }}>Aplicar majoração de 10% sobre a presunção (Lei 2026)</label>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
               <Row label="Base IRPJ:" m={cM.baseIrpj} a={cA.baseIrpj} color="#FF9800" bold={true} />
               <Row label="Base CSLL:" m={cM.baseCsll} a={cA.baseCsll} color="#FF9800" bold={true} />
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(76, 175, 80, 0.05)' }}>
            <h4 style={{ color: '#ccc', marginBottom: '1rem' }}>2. Apuração dos Impostos</h4>
            <div style={{ display: 'grid', gridTemplateColumns: isEstimativa ? '2fr 1fr 1fr' : '2fr 1fr', gap: '1rem', marginBottom: '1rem', color: '#666', fontSize: '0.8rem', borderBottom: '1px solid #444', paddingBottom: '0.5rem' }}>
               <span></span>
               <span style={{ textAlign: 'right' }}>{isEstimativa ? 'DO MÊS' : 'DO TRIMESTRE'}</span>
               {isEstimativa && <span style={{ textAlign: 'right' }}>ACUMULADO DO ANO</span>}
            </div>

            <Row label="IRPJ Normal (15%):" m={cM.irpjNormal} a={cA.irpjNormal} />
            <Row label="IRPJ Adicional (10%):" m={cM.irpjAdicional} a={cA.irpjAdicional} />
            
            <div style={{ marginBottom: '1rem', marginTop: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(-) Imposto de Renda Retido (IRRF) - <b>Valor do Mês</b></label>
              <input type="number" className="text-input" value={presumidoRetencoesIR} onChange={e => setPresumidoRetencoesIR(e.target.value)} style={{ width: '100%' }} />
            </div>

            <div style={{ marginTop: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #444' }}>
               <Row label="IRPJ DEVIDO:" m={Math.max(0, cM.irpjTotal)} a={Math.max(0, cA.irpjTotal)} color="#4CAF50" bold={true} />
            </div>

            <div style={{ marginTop: '1.5rem' }}>
               <Row label="CSLL Normal (9%):" m={cM.csll} a={cA.csll} />
            </div>

            <div style={{ marginBottom: '1rem', marginTop: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.3rem' }}>(-) CSLL Retida - <b>Valor do Mês</b></label>
              <input type="number" className="text-input" value={presumidoRetencoesCS} onChange={e => setPresumidoRetencoesCS(e.target.value)} style={{ width: '100%' }} />
            </div>

            <div style={{ marginTop: '1.5rem' }}>
               <Row label="CSLL DEVIDA:" m={Math.max(0, cM.csllTotal)} a={Math.max(0, cA.csllTotal)} color="#4CAF50" bold={true} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'right' }}>
            <button className="btn-primary" onClick={() => isEstimativa ? handleSaveInputsOnly() : handleGravar(cM.irpjTotal, cM.csllTotal)} style={{ padding: '1rem 2rem', fontSize: '1.1rem' }} disabled={isProcessing}>
                {isProcessing ? 'Gravando...' : (isEstimativa ? '💾 Salvar Memória de Cálculo (Controle DARF)' : '💾 Lançar Apuração no DRE e Balanço')}
            </button>
        </div>
      </div>
    );
  };
`;

const lines = txt.split('\n');
const start = lines.findIndex(l => l.includes('const renderPresumido = () => {'));
const end = lines.findIndex(l => l.includes('const renderReal = () => {'));

if (start !== -1 && end !== -1) {
  lines.splice(start, end - start, replacement);
  fs.writeFileSync(file, lines.join('\n'));
  console.log('Successfully updated!');
} else {
  console.log('Could not find bounds');
}
