import React, { useState, useEffect } from 'react';
import { getBalancoFromDB } from '../utils/db';

export default function RelatoriosContabeis({ selectedAno, selectedMes, companies }) {
  const [selectedCompany, setSelectedCompany] = useState('consolidado');
  const [reportType, setReportType] = useState('endividamento'); // 'endividamento', 'disponivel'
  const [balancoData, setBalancoData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedAno, selectedMes, selectedCompany]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      let data = [];
      if (selectedCompany === 'consolidado') {
         if (companies && companies.length > 0) {
            const allData = {};
            for (let c of companies) {
                const res = await getBalancoFromDB(c.id, selectedAno, selectedMes);
                Object.entries(res).forEach(([conta, info]) => {
                   if (!allData[conta]) allData[conta] = { conta, descricao: info.descricao, saldoAcumulado: 0 };
                   allData[conta].saldoAcumulado += info.valor;
                });
            }
            data = Object.values(allData);
         }
      } else {
         const res = await getBalancoFromDB(selectedCompany, selectedAno, selectedMes);
         data = Object.entries(res).map(([conta, info]) => ({
             conta,
             descricao: info.descricao,
             saldoAcumulado: info.valor
         }));
      }
      
      setBalancoData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
     const oldTitle = document.title;
     const compName = compData ? compData.name.replace(/\s+/g, '_') : 'Consolidado';
     const repName = reportType === 'endividamento' ? 'Endividamento' : 'Disponibilidade';
     const dateStr = `${String(selectedMes).padStart(2, '0')}_${selectedAno}`;
     document.title = `Relatorio_${repName}_${compName}_${dateStr}`;
     
     window.print();
     
     document.title = oldTitle;
  };

  const filterEndividamento = (r) => r.conta.startsWith('2.1.1.2') || r.conta.startsWith('2.2.1.1') || r.conta.startsWith('2.3.1.1') || r.conta.startsWith('2.1.1.3') || r.conta.startsWith('2.1.2.1') || r.conta.startsWith('2.2.2.1') || r.descricao.toUpperCase().includes('EMPRESTIMO') || r.descricao.toUpperCase().includes('FINANCIAMENTO');
  const filterDisponivel = (r) => r.conta.startsWith('1.1.1.1') || r.conta.startsWith('1.1.1.2') || (r.descricao.toUpperCase().includes('CAIXA') && r.tipo === 'ativo') || (r.descricao.toUpperCase().includes('BANCO') && r.tipo === 'ativo') || (r.descricao.toUpperCase().includes('APLICACAO') && r.tipo === 'ativo');

  const filteredData = balancoData.filter(r => {
      const match = reportType === 'endividamento' ? filterEndividamento(r) : filterDisponivel(r);
      return match && Math.abs(r.saldoAcumulado) > 0.009;
  });
  
  const total = filteredData.reduce((acc, curr) => acc + Math.abs(curr.saldoAcumulado), 0);

  const compData = selectedCompany !== 'consolidado' && companies ? companies.find(c => c.id === selectedCompany) : null;
  const headerNome = compData ? compData.name.toUpperCase() : 'AGF GROUP - CONSOLIDADO';

  return (
    <div className="glass-panel" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'flex-end' }} className="no-print">
        <div>
           <label style={{ display: 'block', marginBottom: '0.5rem', color: '#aaa', fontSize: '0.85rem' }}>Empresa</label>
           <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} className="select-input">
             <option value="consolidado">Consolidado</option>
             {companies && companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
           </select>
        </div>
        <div>
           <label style={{ display: 'block', marginBottom: '0.5rem', color: '#aaa', fontSize: '0.85rem' }}>Tipo de Relatório</label>
           <select value={reportType} onChange={e => setReportType(e.target.value)} className="select-input">
             <option value="endividamento">Endividamento (Curto e Longo Prazo)</option>
             <option value="disponivel">Disponibilidade (Caixa, Bancos, Aplicações)</option>
           </select>
        </div>
        <button onClick={handlePrint} className="btn-primary" style={{ marginLeft: 'auto', padding: '0.6rem 1rem' }}>
           🖨️ Exportar PDF
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Carregando dados do balancete...</div>
      ) : (
        <div id="printable-report" style={{ fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '0 auto', color: '#000', background: '#fff', padding: '2rem', borderRadius: '8px' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px solid #333', paddingBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.4rem', margin: '0 0 0.5rem 0', fontWeight: 'bold', color: '#222' }}>{headerNome}</h2>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', color: '#444' }}>
               {reportType === 'endividamento' ? 'RELATÓRIO DE ENDIVIDAMENTO' : 'RELATÓRIO DE DISPONIBILIDADE'}
            </h3>
            <p style={{ fontSize: '0.9rem', margin: 0, color: '#666' }}>Competência: {String(selectedMes).padStart(2, '0')}/{selectedAno}</p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #333', color: '#333' }}>Conta Contábil</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #333', color: '#333' }}>Descrição</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '2px solid #333', color: '#333' }}>Saldo Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 ? filteredData.sort((a,b) => a.conta.localeCompare(b.conta)).map((r, i) => (
                <tr key={r.conta} style={{ backgroundColor: i % 2 === 0 ? '#f9f9f9' : '#fff' }}>
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #eee' }}>{r.conta}</td>
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #eee' }}>{r.descricao}</td>
                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #eee' }}>
                    {Math.abs(r.saldoAcumulado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="3" style={{ padding: '1.5rem', textAlign: 'center', color: '#888' }}>
                    Nenhuma conta encontrada para este relatório.
                  </td>
                </tr>
              )}
              <tr>
                 <td colSpan="2" style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', fontSize: '1.05rem', color: '#000', borderTop: '2px solid #333' }}>TOTAL:</td>
                 <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', fontSize: '1.05rem', color: '#000', borderTop: '2px solid #333' }}>
                    {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                 </td>
              </tr>
            </tbody>
          </table>
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              @page {
                size: A4;
                margin: 15mm;
              }
              body * { visibility: hidden !important; }
              #printable-report, #printable-report * { visibility: visible !important; }
              #printable-report { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
              .no-print { display: none !important; }
              body { background: #fff; }
              .glass-panel { box-shadow: none; border: none; background: #fff; padding: 0 !important; }
              
              /* Force background colors in print */
              tr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          `}} />
        </div>
      )}
    </div>
  );
}
