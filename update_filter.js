const fs = require('fs');
const path = require('path');

const content = `import { Publisher, MeetingPart, Assignment } from '../types/models';

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
    currentAssignments: Assignment[]
  ): Publisher[] {
    return allPublishers.filter(publisher => {
      // 1. Filtro de Disponibilidade (Regra 1.1)
      if (this.isUnavailable(publisher, part.week)) return false;

      // 2. Filtro de Gênero (Regra 1.2)
      if (this.hasWrongGender(publisher, part)) return false;

      // 3. Filtro de Privilégios e Aprovações (Regra 1.3)
      if (!this.hasRequiredPrivileges(publisher, part)) return false;

      // 4. Filtro de Duplicidade na Reunião (Regra 1.4)
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

  /**
   * Verifica se o gênero do publicador é compatível com o exigido pela parte.  
   */
  private static hasWrongGender(publisher: Publisher, part: MeetingPart): boolean {
    // Se a parte aceita 'OTHER' (qualquer um) ou se os gêneros coincidem
    if (part.requiredGender === 'OTHER') return false;
    return publisher.gender !== part.requiredGender;
  }

  /**
   * Verifica se o publicador tem os privilégios e aprovações específicas para a parte.
   */
  private static hasRequiredPrivileges(publisher: Publisher, part: MeetingPart): boolean {
    // 1. Verifica privilégios hierárquicos explícitos (Ex: ANCIÃO, SM)
    if (part.requiredPrivileges.length > 0) {
      const hasPrivilege = part.requiredPrivileges.some(req => publisher.privileges.includes(req));
      if (!hasPrivilege) return false;
    }

    // 2. Verifica aprovações específicas baseadas no tipo de parte

    // Partes de Ensino (Tesouros) requerem aprovação específica
    // Alterado: Só verifica se for da seção TESOUROS
    if (part.teachingCategory === 'TEACHING' && part.section === 'TESOUROS') {
       if (!publisher.isApprovedForTreasures) return false;
    }

    // Regras específicas para o Estudo Bíblico de Congregação (EBC)
    const lowerTitle = part.partType.toLowerCase();
    const isEBC = part.section === 'VIDA_CRISTA' || lowerTitle.includes('estudo bíblico') || lowerTitle.includes('ebc');

    if (isEBC) {
      if (lowerTitle.includes('leitor')) {
        if (!publisher.isApprovedForEBC_Leitor) return false;
      } 
      else if (lowerTitle.includes('estudo') || lowerTitle.includes('ebc')) {
        if (!publisher.isApprovedForEBC_Dirigente) return false;
      }
    }

    return true;
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
`;

fs.writeFileSync(path.join(__dirname, 'src/core/AssignmentFilter.ts'), content, 'utf8');
console.log('File updated successfully');
`;

fs.writeFileSync('update_filter.js', content);
