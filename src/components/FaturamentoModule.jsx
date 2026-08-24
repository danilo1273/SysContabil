import React, { useState, useEffect } from 'react';
import { getHistorySeries } from '../utils/db';
import { protheusMapping } from '../utils/mappingConfig';

const formatNumber = (val) => {
  return (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const monthNames = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];

function FaturamentoModule({ companies, selectedCompany, selectedAno, selectedMes }) {
  const [loading, setLoading] = useState(false);
  const [faturamentoData, setFaturamentoData] = useState([]);

  useEffect(() => {
    async function loadLTMData() {
      if (!selectedAno || !selectedMes) return;
      setLoading(true);
      try {
        // Contas exatas usadas na planilha (Coluna J e K)
        const accReceita = '3.1.1.1.01'; // J
        const accDevolucao = '3.1.1.2.02.00001'; // K

        const companyIds = selectedCompany === 'consolidado' 
          ? companies.map(c => c.id) 
          : [selectedCompany];

        let totalCurrentYear = [];
        let totalPreviousYear = [];

        const processRow = (row, targetArray) => {
          let valueToAdd = 0;
          if (row.conta.startsWith(accReceita)) {
            // Receita bruta (valor positivo)
            valueToAdd = Math.abs(row.total);
          } else if (row.conta.startsWith(accDevolucao)) {
            // Devoluções (deve reduzir a receita, row.total original é negativo)
            valueToAdd = -Math.abs(row.total);
          }

          if (valueToAdd !== 0) {
            const mesIdx = targetArray.findIndex(m => m.mes === row.mes);
            if (mesIdx >= 0) {
              targetArray[mesIdx].total += valueToAdd;
            } else {
              targetArray.push({ mes: row.mes, total: valueToAdd });
            }
          }
        };

        // Aggregate across companies se consolidado
        for (const cid of companyIds) {
          const resCurrent = await getHistorySeries(cid, selectedAno);
          const resPrevious = await getHistorySeries(cid, selectedAno - 1);

          resCurrent.dre.forEach(row => processRow(row, totalCurrentYear));
          resPrevious.dre.forEach(row => processRow(row, totalPreviousYear));
        }

        // Construir array com os ultimos 12 meses
        const ltm = [];
        // LTM order: oldest to newest
        // if selectedMes = 6, start at 7 of prev year, end at 6 of current year
        for (let i = 11; i >= 0; i--) {
          let m = selectedMes - i;
          let y = selectedAno;
          if (m <= 0) {
            m += 12;
            y -= 1;
          }
          
          let val = 0;
          if (y === selectedAno) {
            const row = totalCurrentYear.find(r => r.mes === m);
            if (row) val = row.total;
          } else {
            const row = totalPreviousYear.find(r => r.mes === m);
            if (row) val = row.total;
          }
          
          ltm.push({
            label: `${monthNames[m - 1]} ${y}`,
            value: val
          });
        }

        setFaturamentoData(ltm);
      } catch (err) {
        console.error('Erro ao carregar Faturamento LTM:', err);
      } finally {
        setLoading(false);
      }
    }

    loadLTMData();
  }, [selectedCompany, selectedAno, selectedMes, companies]);

  // Seperar em duas colunas de 6 meses
  const col1 = faturamentoData.slice(0, 6);
  const col2 = faturamentoData.slice(6, 12);
  const grandTotal = faturamentoData.reduce((acc, curr) => acc + curr.value, 0);

  // Empresa Cabeçalho
  const defaultHeader = {
    nome: 'AGF IMPORTAÇÃO EXPORTAÇÃO E COMERCIALIZAÇÃO DE MAQUINAS E ACESSORIOS LTDA',
    cnpj: '11.681.470/0001-84 IE: 530051442114'
  };

  const compData = selectedCompany !== 'consolidado' 
    ? companies.find(c => c.id === selectedCompany) 
    : null;
    
  const headerNome = compData ? compData.name.toUpperCase() : defaultHeader.nome;
  const headerCnpj = compData && compData.cnpj ? `CNPJ: ${compData.cnpj}` : defaultHeader.cnpj;

  const dataAtual = new Date();
  const dataFormatada = `${dataAtual.getDate()} ${monthNames[dataAtual.getMonth()]} ${dataAtual.getFullYear()}`;

  return (
    <div className="glass-panel" style={{ padding: '2rem', position: 'relative', background: '#fff', color: '#000' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }} className="action-btn">
        <button onClick={() => window.print()} className="btn-primary" style={{ padding: '0.6rem 1rem' }}>
          🖨️ Exportar PDF
        </button>
      </div>

      <div id="printable-faturamento" style={{ fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '0 auto', color: '#000' }}>
        
        {/* Header da Empresa */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3rem' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem 0', fontWeight: 'bold' }}>{headerNome}</h2>
            <p style={{ fontSize: '0.9rem', margin: 0 }}>{headerCnpj}</p>
          </div>
        </div>

        {/* Tabela de Dados */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '1rem' }}>
          <thead>
            <tr>
              <th colSpan="4" style={{ background: '#e8e8e8', border: '1px solid #000', padding: '0.5rem', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: '#000' }}>
                RELAÇÃO DE FATURAMENTO ATÉ {monthNames[selectedMes - 1]} {selectedAno}
              </th>
            </tr>
            <tr style={{ background: '#a5a5a5' }}>
              <th style={{ border: '1px solid #000', padding: '0.75rem', width: '25%', color: '#fff', fontWeight: 'normal' }}>MÊS/ANO</th>
              <th style={{ border: '1px solid #000', padding: '0.75rem', width: '25%', color: '#fff', fontWeight: 'normal' }}>R$</th>
              <th style={{ border: '1px solid #000', padding: '0.75rem', width: '25%', color: '#fff', fontWeight: 'normal' }}>MÊS/ANO</th>
              <th style={{ border: '1px solid #000', padding: '0.75rem', width: '25%', color: '#fff', fontWeight: 'normal' }}>R$</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>Calculando Faturamento...</td></tr>
            ) : (
              col1.map((item1, idx) => {
                const item2 = col2[idx];
                return (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#ebebeb' : '#f9f9f9', color: '#333' }}>
                    <td style={{ border: '1px solid #777', padding: '0.4rem 0.75rem', textAlign: 'center' }}>
                      {item1?.label}
                    </td>
                    <td style={{ border: '1px solid #777', padding: '0.4rem 0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>R$</span>
                        <span>{formatNumber(item1?.value)}</span>
                      </div>
                    </td>
                    <td style={{ border: '1px solid #777', padding: '0.4rem 0.75rem', textAlign: 'center' }}>
                      {item2?.label}
                    </td>
                    <td style={{ border: '1px solid #777', padding: '0.4rem 0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>R$</span>
                        <span>{formatNumber(item2?.value)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            <tr style={{ background: '#a5a5a5', color: '#fff', fontSize: '1.05rem' }}>
              <td colSpan="2" style={{ border: '1px solid #777', background: '#a5a5a5' }}></td>
              <td style={{ border: '1px solid #777', padding: '0.5rem 0.75rem', textAlign: 'center' }}>TOTAL PERÍODO</td>
              <td style={{ border: '1px solid #777', padding: '0.5rem 0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>R$</span>
                  <span>{formatNumber(grandTotal)}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Assinatura */}
        <div style={{ marginTop: '5rem', textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '60%', margin: '0 auto 1rem auto' }}></div>
          <p style={{ fontSize: '1rem', fontWeight: 'bold' }}>{dataFormatada}</p>
        </div>
      </div>
    </div>
  );
}

export default FaturamentoModule;
