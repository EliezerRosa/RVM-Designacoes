import { Assignment, HelperRequirements, MeetingPart, Publisher } from '../types/models';

interface CandidateFilterOptions {
  mode?: 'principal' | 'helper';
}

export class AssignmentFilter {
  /**
   * Filtra os publicadores elegíveis para uma determinada parte, aplicando as regras rígidas.
   * @param part A parte da reunião a ser designada.
   * @param allPublishers Lista completa de publicadores.
   * @param currentAssignments Designações já realizadas para a mesma reunião (para evitar duplicidade).
   * @returns Lista de publicadores que atendem a todos os critérios.
   */
  static getEligibleCandidates(
    part: MeetingPart,
    allPublishers: Publisher[],
    currentAssignments: Assignment[],
    options: CandidateFilterOptions = {}
  ): Publisher[] {
    const helperRequirements = this.resolveHelperRequirements(part, options);
    const requiredGender = helperRequirements?.requiredGender ?? part.requiredGender;
    const requiredPrivileges = helperRequirements?.requiredPrivileges ?? part.requiredPrivileges;

    return allPublishers.filter(publisher => {
      // 1. Filtro de Disponibilidade (Regra 1.1)
      if (this.isUnavailable(publisher, part.week)) return false;

      // 2. Filtro de Gênero (Regra 1.2)
      if (this.hasWrongGender(publisher, requiredGender)) return false;

      // 3. Filtro de Privilégios e Aprovações (Regra 1.3)
      if (!this.hasRequiredPrivileges(publisher, part, requiredPrivileges)) return false;

      // 4. Filtro de aprovação pendente vs parte restrita
      if (this.isApprovalBlocked(publisher, part)) return false;

      // 5. Filtro específico para ajudantes
      if (options.mode === 'helper' && !publisher.canBeHelper) return false;

      // 6. Filtro de Duplicidade na Reunião (Regra 1.4)
      if (this.isAlreadyAssigned(publisher, currentAssignments)) return false;     

      return true;
    });
  }

  /**
   * Verifica se o publicador marcou indisponibilidade para a semana da parte.     
   */
  private static isUnavailable(publisher: Publisher, week: string): boolean {      
    return publisher.unavailableWeeks.includes(week);
  }

  private static resolveHelperRequirements(part: MeetingPart, options: CandidateFilterOptions): HelperRequirements | undefined {
    return options.mode === 'helper' ? part.helperRequirements : undefined;
  }

  /**
   * Verifica se o gênero do publicador é compatível com o exigido pela parte.  
   */
  private static hasWrongGender(publisher: Publisher, requiredGender: MeetingPart['requiredGender']): boolean {
    // Se a parte aceita 'OTHER' (qualquer um) ou se os gêneros coincidem
    if (requiredGender === 'OTHER') return false;
    return publisher.gender !== requiredGender;
  }

  /**
   * Verifica se o publicador tem os privilégios e aprovações específicas para a parte.
   */
  private static hasRequiredPrivileges(
    publisher: Publisher,
    part: MeetingPart,
    requiredPrivileges: string[]
  ): boolean {
    // 1. Verifica privilégios hierárquicos explícitos (Ex: ANCIÃO, SM)
    if (requiredPrivileges.length > 0) {
      const hasPrivilege = requiredPrivileges.some(req => publisher.privileges.includes(req));
      if (!hasPrivilege) return false;
    }

    // 2. Verifica aprovações específicas baseadas no tipo de parte

    // Partes de Ensino (Tesouros) requerem aprovação específica
    if (part.teachingCategory === 'TEACHING' && part.section === 'TESOUROS') {
       if (!publisher.isApprovedForTreasures) return false;
    }

    // Regras específicas para o Estudo Bíblico de Congregação (EBC)
    switch (part.specialTag) {
      case 'EBC_LEITOR':
        if (!publisher.isApprovedForEBC_Leitor) return false;
        break;
      case 'EBC_DIRIGENTE':
        if (!publisher.isApprovedForEBC_Dirigente) return false;
        break;
      default: {
        // Fallback textual para compatibilidade retroativa
        const lowerTitle = part.partType.toLowerCase();
        const isEBC = part.section === 'VIDA_CRISTA' || lowerTitle.includes('estudo bíblico') || lowerTitle.includes('ebc');

        if (isEBC) {
          if (lowerTitle.includes('leitor')) {
            if (!publisher.isApprovedForEBC_Leitor) return false;
          } else if (lowerTitle.includes('estudo') || lowerTitle.includes('ebc')) {
            if (!publisher.isApprovedForEBC_Dirigente) return false;
          }
        }
      }
    }

    return true;
  }

  private static isApprovalBlocked(publisher: Publisher, part: MeetingPart): boolean {
    return Boolean(publisher.approvalNeeded && part.allowsPendingApproval === false);
  }

  /**
   * Verifica se o publicador já tem uma designação nesta mesma reunião.       
   */
  private static isAlreadyAssigned(publisher: Publisher, currentAssignments: Assignment[]): boolean {
    return currentAssignments.some(a =>
      a.principalPublisherId === publisher.publisherId ||
      a.secondaryPublisherId === publisher.publisherId
    );
  }
}
