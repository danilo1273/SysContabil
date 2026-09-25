/**
 * Utilitário de propagação e replicação contínua de rotinas contábeis
 * Permite que rotinas criadas em um mês sigam automaticamente para os próximos meses
 */

export function propagateRoutinesToNewMonth(sourceRoutines, targetAno, targetMes) {
    if (!Array.isArray(sourceRoutines) || sourceRoutines.length === 0) return [];
    
    const targetAnoNum = parseInt(targetAno, 10);
    const targetMesNum = parseInt(targetMes, 10);
    const idMap = {};

    // 1. Mapear cada rotina anterior para um ID novo no mês de destino
    sourceRoutines.forEach(r => {
        if (!r || !r.id) return;
        const parts = r.id.split('-');
        let newId;
        // Padrão: rot-${ano}-${mes}-${filialCode}-${tipoOuSufixo}
        if (parts.length >= 4 && parts[0] === 'rot') {
            newId = `rot-${targetAnoNum}-${targetMesNum}-${parts.slice(3).join('-')}`;
        } else {
            const filial = r.filialCode || 'filial';
            const rnd = Math.random().toString(36).substring(2, 6);
            newId = `rot-${targetAnoNum}-${targetMesNum}-${filial}-${rnd}`;
        }
        idMap[r.id] = newId;
    });

    // 2. Montar as novas rotinas clonadas com status e dependências atualizadas
    const newRoutines = sourceRoutines.map(r => {
        if (!r || !r.id) return null;
        const newId = idMap[r.id];

        // Atualizar IDs das dependências para apontar para as tarefas do novo mês
        const newDeps = (r.dependencias || []).map(oldDepId => {
            if (idMap[oldDepId]) return idMap[oldDepId];
            const parts = oldDepId.split('-');
            if (parts.length >= 4 && parts[0] === 'rot') {
                return `rot-${targetAnoNum}-${targetMesNum}-${parts.slice(3).join('-')}`;
            }
            return oldDepId;
        });

        // Atualizar data limite preservando o dia do mês
        let newDataLimite = '';
        if (r.data_limite && typeof r.data_limite === 'string') {
            const dParts = r.data_limite.split('-');
            if (dParts.length === 3) {
                const diaOrig = parseInt(dParts[2], 10) || 1;
                // Máximo de dias no mês de destino
                const maxDias = new Date(targetAnoNum, targetMesNum, 0).getDate();
                const diaAjustado = Math.min(diaOrig, maxDias);
                newDataLimite = `${targetAnoNum}-${String(targetMesNum).padStart(2, '0')}-${String(diaAjustado).padStart(2, '0')}`;
            } else {
                newDataLimite = r.data_limite;
            }
        }

        const hasDeps = newDeps.length > 0;

        return {
            id: newId,
            ano: targetAnoNum,
            mes: targetMesNum,
            empresaId: r.empresaId,
            filialCode: r.filialCode,
            filialNome: r.filialNome || '',
            titulo: r.titulo,
            categoria: r.categoria || 'integracao',
            tipo: r.tipo || 'personalizado',
            abrangencia: r.abrangencia || (r.filialCode === 'consolidado' ? 'consolidado' : 'filial'),
            dia_atual: 0,
            status: hasDeps ? 'bloqueada' : 'em_andamento',
            responsavel: r.responsavel || '',
            responsavelEmail: r.responsavelEmail || '',
            dependencias: newDeps,
            data_limite: newDataLimite,
            concluido_em: null,
            concluido_por: null,
            email_notificado: false,
            updated_at: new Date().toISOString()
        };
    }).filter(Boolean);

    return newRoutines;
}
