export type Gender = 'M' | 'F' | 'OTHER';
export type AuthorityLevel = 'ELDER' | 'SM' | 'PUBLISHER';
export type TeachingCategory = 'TEACHING' | 'STUDENT' | 'HELPER';
export type ApprovalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type AssignmentWarningType = 'NO_CANDIDATE' | 'HELPER_MISSING' | 'API_FALLBACK';

export interface HelperRequirements {
  /** Gênero exigido apenas para o ajudante (ver docs/data-contract.md#helper-rules) */
  requiredGender?: Gender;
  /** Privilégios específicos solicitados ao ajudante (ver docs/data-contract.md#helper-rules) */
  requiredPrivileges?: string[];
}

export type MeetingPartTag = 'EBC_DIRIGENTE' | 'EBC_LEITOR';

export interface Publisher {
  /** ID único do publicador (PK) */
  publisherId: string;
  /** Nome completo */
  name: string;
  /** Gênero */
  gender: Gender;
  /** Lista de privilégios (Ex: ANCIÃO, SM, PIONEIRO) */
  privileges: string[];
  /** Nível de controle de acesso (RBAC). Essencial para Regra 8. */
  authorityLevel: AuthorityLevel;
  /** Aprovação para partes de ensino principal/discurso. */
  isApprovedForTreasures: boolean;
  /** Aprovação para dirigir Estudo Bíblico de Congregação. */
  isApprovedForEBC_Dirigente: boolean;
  /** Aprovação para ser leitor do EBC. */
  isApprovedForEBC_Leitor: boolean;
  /** Flag: Se TRUE, todas as designações (exceto cânticos) requerem aprovação de Ancião (ver docs/data-contract.md#approval-flow). */
  approvalNeeded: boolean;
  /** Indica vontade pessoal de ser ajudante (ver docs/data-contract.md#helper-rules). */
  canBeHelper: boolean;
  /** Lista de datas (YYYY-MM-DD) em que o publicador não está disponível (Filtro Rígido). */
  unavailableWeeks: string[];
}

export interface MeetingPart {
  /** ID único da parte (PK) */
  partId: string;
  /** Data da semana (YYYY-MM-DD) */
  week: string;
  /** Título específico (Ex: "Leitura da Bíblia", "Joias espirituais") */
  partType: string;
  /** Seção da reunião (Ex: "Tesouros", "Ministério", "Vida Cristã") */
  section?: string;
  /** Tag semântica para regras específicas como EBC (ver docs/data-contract.md#part-tags) */
  specialTag?: MeetingPartTag;
  /** Categoria para ponderação do rodízio */
  teachingCategory: TeachingCategory;
  /** Requisitos mínimos da parte */
  requiredPrivileges: string[];
  /** Gênero requerido para a parte */
  requiredGender: Gender;
  /** Se true, ativa a lógica de pareamento */
  requiresHelper: boolean;
  /** Permite definir requisitos exclusivos para ajudantes (ver docs/data-contract.md#helper-rules) */
  helperRequirements?: HelperRequirements;
  /** Se true, a atribuição entra em PENDING_APPROVAL (Revisão 3) */
  requiresApprovalByElder: boolean;
  /** Controla se candidatos com approvalNeeded podem participar (ver docs/data-contract.md#approval-flow) */
  allowsPendingApproval?: boolean;
  /** Duração estimada em minutos (para cronometragem) */
  duration?: number;
  /** Grupo lógico para penalidade de cooldown (ver docs/data-contract.md#cooldown-groups) */
  cooldownGroup?: string;
}

export interface AssignmentHistory {
  /** ID único do histórico (PK) */
  historyId: string;
  /** FK para Publisher */
  publisherId: string;
  /** Data da participação (YYYY-MM-DD) */
  date: string;
  /** Categoria de ponderação */
  assignmentType: TeachingCategory;
  /** Tipo exato da parte (para evitar repetição imediata) */
  partType: string;
  /** Grupo lógico compartilhado por partes similares (ver docs/data-contract.md#cooldown-groups) */
  cooldownGroup?: string;
}

export interface Assignment {
  /** ID único da designação (PK) */
  assignmentId: string;
  /** FK para MeetingPart */
  meetingPartId: string;
  /** ID do Titular/Estudante */
  principalPublisherId: string;
  /** ID do Ajudante/Leitor (opcional) */
  secondaryPublisherId?: string;
  /** Status da aprovação */
  approvalStatus: ApprovalStatus;
  /** ID do Ancião que aprovou (opcional) */
  approvedByElderId?: string;
  /** Horário de início calculado (HH:mm) */
  startTime?: string;
  /** Horário de fim calculado (HH:mm) */
  endTime?: string;
}

export interface AssignmentWarning {
  /** Categoria do aviso (ver docs/data-contract.md#assignment-warnings) */
  type: AssignmentWarningType;
  /** Parte associada, quando aplicável */
  meetingPartId?: string;
  /** Mensagem amigável pronta para exibir na UI */
  message: string;
}

export interface AssignmentResult {
  assignments: Assignment[];
  warnings: AssignmentWarning[];
}

/**
 * Payload padrão utilizado pelo endpoint POST /api/generateAssignments.
 * Mantido aqui para que UI, API e motor compartilhem o mesmo contrato JSON.
 */
export interface GenerateAssignmentsRequest {
  meetingDate: string;
  parts: MeetingPart[];
  publishers: Publisher[];
  history: AssignmentHistory[];
}

export interface GenerateAssignmentsResponse extends AssignmentResult {}
