import { Assignment, AssignmentHistory, MeetingPart, Publisher } from '../types/models';
import { AssignmentFilter } from './AssignmentFilter';
import { RankingEngine } from './RankingEngine';
import { TimingCalculator } from './TimingCalculator';

export class AssignmentEngine {
  /**
   * Orquestra todo o processo de geração de designações para uma pauta.
   *
   * Pipeline:
   * 1. Itera sobre cada parte da reunião.
   * 2. Filtra candidatos elegíveis (AssignmentFilter).
   * 3. Ranqueia candidatos por prioridade (RankingEngine).
   * 4. Seleciona o titular e, se necessário, o ajudante.
   * 5. Define o status de aprovação (DRAFT ou PENDING_APPROVAL).
   * 6. Calcula os horários finais (TimingCalculator).
   */
  static generateAssignments(
    parts: MeetingPart[],
    publishers: Publisher[],
    history: AssignmentHistory[],
    meetingDate: string
  ): Assignment[] {
    const assignments: Assignment[] = [];

    for (const part of parts) {
      // --- 1. Selecionar Titular (Principal) ---
      const principalId = this.selectBestCandidate(
        part,
        publishers,
        assignments,
        history,
        meetingDate
      );

      if (!principalId) {
        console.warn(`[AssignmentEngine] Alerta: Nenhum candidato elegível para a parte '${part.partType}'`);
        // Em um sistema real, criaríamos uma notificação ou designação com erro.
        // Aqui, pulamos para não quebrar o fluxo, mas a parte ficará vaga.
        continue;
      }

      const principal = publishers.find(p => p.publisherId === principalId)!;

      // --- 2. Selecionar Ajudante (se necessário) ---
      let secondaryId: string | undefined;

      if (part.requiresHelper) {
        // O ajudante não pode ser o mesmo que o titular
        const candidateId = this.selectBestCandidate(
          part,
          publishers,
          assignments,
          history,
          meetingDate,
          principalId // Exclui o titular da lista de candidatos a ajudante
        );
        
        if (candidateId) {
          secondaryId = candidateId;
        } else {
          console.warn(`[AssignmentEngine] Alerta: Titular selecionado, mas sem ajudante para '${part.partType}'`);
        }
      }

      // --- 3. Determinar Status Inicial (Regras 4 e 5) ---
      let status: Assignment['approvalStatus'] = 'DRAFT';

      // Se a parte exige aprovação de ancião OU o publicador está em observação
      if (part.requiresApprovalByElder || principal.approvalNeeded) {
        status = 'PENDING_APPROVAL';
      }

      // --- 4. Criar Objeto de Designação ---
      const newAssignment: Assignment = {
        assignmentId: this.generateUUID(),
        meetingPartId: part.partId,
        principalPublisherId: principalId,
        secondaryPublisherId: secondaryId,
        approvalStatus: status
      };

      assignments.push(newAssignment);
    }

    // --- 5. Calcular Cronometragem ---
    return TimingCalculator.calculateTimings(assignments, parts);
  }

  /**
   * Helper para selecionar o melhor candidato único para uma função.
   */
  private static selectBestCandidate(
    part: MeetingPart,
    allPublishers: Publisher[],
    currentAssignments: Assignment[],
    history: AssignmentHistory[],
    meetingDate: string,
    excludePublisherId?: string
  ): string | null {
    // 1. Filtrar (Regras Rígidas)
    let eligible = AssignmentFilter.getEligibleCandidates(part, allPublishers, currentAssignments);

    // Exclusão manual (ex: titular não pode ser ajudante dele mesmo)
    if (excludePublisherId) {
      eligible = eligible.filter(p => p.publisherId !== excludePublisherId);
    }

    if (eligible.length === 0) return null;

    // 2. Ranquear (Regras de Prioridade)
    const ranked = RankingEngine.rankCandidates(eligible, part, history, meetingDate);
    
    // 3. Selecionar Top 1
    return ranked[0].publisher.publisherId;
  }

  private static generateUUID(): string {
    // Fallback simples para ambientes onde crypto.randomUUID não esteja disponível
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
