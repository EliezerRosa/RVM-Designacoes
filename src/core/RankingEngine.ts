import { Publisher, MeetingPart, AssignmentHistory } from '../types/models';

export interface ScoredPublisher {
  publisher: Publisher;
  score: number;
  debugInfo: string[];
}

export class RankingEngine {
  /**
   * Classifica os candidatos elegíveis baseando-se no tempo desde a última designação
   * e aplicando penalidades por repetição recente.
   * 
   * A pontuação (Score) representa a prioridade: quanto maior, mais chance de ser escolhido.
   */
  static rankCandidates(
    candidates: Publisher[],
    part: MeetingPart,
    history: AssignmentHistory[],
    meetingDate: string
  ): ScoredPublisher[] {
    const scored = candidates.map(publisher => {
      return this.calculateScore(publisher, part, history, meetingDate);
    });

    // Ordena por pontuação decrescente (maior pontuação = maior prioridade)
    return scored.sort((a, b) => b.score - a.score);
  }

  private static calculateScore(
    publisher: Publisher,
    part: MeetingPart,
    history: AssignmentHistory[],
    meetingDate: string
  ): ScoredPublisher {
    const debugInfo: string[] = [];
    let score = 0;

    // 1. Filtrar histórico apenas deste publicador
    const publisherHistory = history.filter(h => h.publisherId === publisher.publisherId);

    // 2. Encontrar a data da última designação (qualquer tipo)
    // Ordenar histórico por data decrescente
    publisherHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const lastAssignment = publisherHistory[0];
    let daysSinceLast = 0;

    if (!lastAssignment) {
      // Se nunca teve designação, damos prioridade máxima.
      // Usamos 100 dias como base arbitrária alta.
      daysSinceLast = 100; 
      debugInfo.push('Nunca teve designações (+100)');
    } else {
      const diffTime = new Date(meetingDate).getTime() - new Date(lastAssignment.date).getTime();
      daysSinceLast = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      debugInfo.push(`Dias desde última parte: ${daysSinceLast}`);
    }

    score += daysSinceLast;

    // 3. Aplicar Penalidade de Cooldown (Repetição do mesmo tipo de parte ou grupo)
    // Regra: Penalizar severamente se fez o mesmo 'partType' ou 'cooldownGroup' nas últimas 8 semanas (56 dias)
    const COOLDOWN_DAYS = 56;
    const appliesCooldown = (entry: AssignmentHistory): boolean => {
      const groupMatches = part.cooldownGroup
        ? entry.cooldownGroup === part.cooldownGroup
        : entry.partType === part.partType;
      return groupMatches && this.getDaysDiff(meetingDate, entry.date) <= COOLDOWN_DAYS;
    };

    const recentSameBucket = publisherHistory.find(appliesCooldown);

    if (recentSameBucket) {
      const penalty = 500; // Penalidade alta para jogar para o fim da fila
      score -= penalty;
      const bucketLabel = part.cooldownGroup ?? part.partType;
      debugInfo.push(
        `PENALIDADE: '${bucketLabel}' há ${this.getDaysDiff(meetingDate, recentSameBucket.date)} dias (-${penalty})`
      );
    }

    return { publisher, score, debugInfo };
  }

  private static getDaysDiff(date1: string, date2: string): number {
    const diff = new Date(date1).getTime() - new Date(date2).getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}
