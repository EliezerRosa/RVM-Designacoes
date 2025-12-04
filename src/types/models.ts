export type Gender = 'M' | 'F' | 'OTHER';
export type AuthorityLevel = 'ELDER' | 'SM' | 'PUBLISHER';
export type TeachingCategory = 'TEACHING' | 'STUDENT' | 'HELPER';
export type ApprovalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

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
  /** Flag: Se TRUE, todas as designações (exceto cânticos) requerem aprovação de Ancião (Regra 2). */
  approvalNeeded: boolean;
  /** Indica vontade pessoal de ser ajudante (Revisão 1). */
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
  /** Categoria para ponderação do rodízio */
  teachingCategory: TeachingCategory;
  /** Requisitos mínimos da parte */
  requiredPrivileges: string[];
  /** Gênero requerido para a parte */
  requiredGender: Gender;
  /** Se true, ativa a lógica de pareamento */
  requiresHelper: boolean;
  /** Se true, a atribuição entra em PENDING_APPROVAL (Revisão 3) */
  requiresApprovalByElder: boolean;
  /** Duração estimada em minutos (para cronometragem) */
  duration?: number;
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
