import { describe, it, expect } from 'vitest';
import { AssignmentFilter } from '../AssignmentFilter';
import { AssignmentEngine } from '../AssignmentEngine';
import { RankingEngine } from '../RankingEngine';
import { TimingCalculator } from '../TimingCalculator';
import { Assignment, AssignmentHistory, MeetingPart, Publisher } from '../../types/models';

const basePublisher = (overrides: Partial<Publisher> = {}): Publisher => ({
  publisherId: 'pub-base',
  name: 'Base Publisher',
  gender: 'M',
  privileges: [],
  authorityLevel: 'PUBLISHER',
  isApprovedForTreasures: false,
  isApprovedForEBC_Dirigente: false,
  isApprovedForEBC_Leitor: false,
  approvalNeeded: false,
  canBeHelper: true,
  unavailableWeeks: [],
  ...overrides,
});

const basePart = (overrides: Partial<MeetingPart> = {}): MeetingPart => ({
  partId: 'part-base',
  week: '2025-12-01',
  partType: 'Leitura',
  section: 'TESOUROS',
  teachingCategory: 'STUDENT',
  requiredPrivileges: [],
  requiredGender: 'OTHER',
  requiresHelper: false,
  requiresApprovalByElder: false,
  duration: 5,
  ...overrides,
});

describe('AssignmentFilter', () => {
  it('excludes publishers that are unavailable or already assigned', () => {
    const available = basePublisher({ publisherId: 'pub-available' });
    const unavailable = basePublisher({ publisherId: 'pub-unavailable', unavailableWeeks: ['2025-12-01'] });

    const currentAssignments: Assignment[] = [
      {
        assignmentId: 'assg-1',
        meetingPartId: 'part-x',
        principalPublisherId: 'pub-available',
        approvalStatus: 'DRAFT',
      },
    ];

    const eligible = AssignmentFilter.getEligibleCandidates(basePart(), [available, unavailable], currentAssignments);

    expect(eligible).toHaveLength(0); // unavailable is filtered, available is already assigned
  });

  it('enforces privilege and approval requirements for treasures parts', () => {
    const elder = basePublisher({
      publisherId: 'pub-elder',
      privileges: ['ANCIÃO'],
      isApprovedForTreasures: true,
    });

    const smWithoutApproval = basePublisher({
      publisherId: 'pub-sm',
      privileges: ['SM'],
      isApprovedForTreasures: false,
    });

    const part = basePart({
      partType: 'Discurso Tesouros',
      teachingCategory: 'TEACHING',
      requiredPrivileges: ['ANCIÃO', 'SM'],
      requiredGender: 'M',
    });

    const eligible = AssignmentFilter.getEligibleCandidates(part, [elder, smWithoutApproval], []);

    expect(eligible).toEqual([elder]);
  });

  it('requires EBC approvals for dirigente and leitor roles', () => {
    const dirigente = basePublisher({
      publisherId: 'pub-dirigente',
      isApprovedForEBC_Dirigente: true,
      privileges: ['SM'],
    });

    const leitor = basePublisher({
      publisherId: 'pub-leitor',
      isApprovedForEBC_Leitor: true,
    });

    const partDirigente = basePart({
      partId: 'part-dir',
      section: 'VIDA_CRISTA',
      partType: 'Estudo Bíblico de Congregação',
      requiredGender: 'M',
      requiredPrivileges: ['SM'],
      specialTag: 'EBC_DIRIGENTE'
    });

    const partLeitor = basePart({
      partId: 'part-leitor',
      section: 'VIDA_CRISTA',
      partType: 'Leitor do Estudo',
      requiredGender: 'M',
      specialTag: 'EBC_LEITOR'
    });

    const eligibleDir = AssignmentFilter.getEligibleCandidates(partDirigente, [dirigente, leitor], []);
    const eligibleLeitor = AssignmentFilter.getEligibleCandidates(partLeitor, [dirigente, leitor], []);

    expect(eligibleDir).toEqual([dirigente]);
    expect(eligibleLeitor).toEqual([leitor]);
  });

  it('blocks approvalNeeded publishers when the part disallows pending approval', () => {
    const pending = basePublisher({ publisherId: 'pub-pending', approvalNeeded: true });
    const clear = basePublisher({ publisherId: 'pub-clear' });

    const part = basePart({ allowsPendingApproval: false });

    const eligible = AssignmentFilter.getEligibleCandidates(part, [pending, clear], []);

    expect(eligible).toEqual([clear]);
  });

  it('applies helper-specific requirements and canBeHelper flag', () => {
    const helperPart = basePart({
      requiresHelper: true,
      helperRequirements: { requiredGender: 'F', requiredPrivileges: ['PIONEIRO'] },
    });

    const malePioneer = basePublisher({ publisherId: 'pub-m', privileges: ['PIONEIRO'] });
    const femaleNonPioneer = basePublisher({ publisherId: 'pub-f', gender: 'F' });
    const femalePioneerBlocked = basePublisher({
      publisherId: 'pub-fb',
      gender: 'F',
      privileges: ['PIONEIRO'],
      canBeHelper: false,
    });
    const femalePioneer = basePublisher({
      publisherId: 'pub-fp',
      gender: 'F',
      privileges: ['PIONEIRO'],
    });

    const candidates = AssignmentFilter.getEligibleCandidates(
      helperPart,
      [malePioneer, femaleNonPioneer, femalePioneerBlocked, femalePioneer],
      [],
      { mode: 'helper' }
    );

    expect(candidates.map(c => c.publisherId)).toEqual(['pub-fp']);
  });
});

describe('RankingEngine', () => {
  const meetingDate = '2025-12-01';
  const part = basePart({ partType: 'Leitura' });

  it('prioritizes publishers with longer cooldown since last assignment', () => {
    const candidateFresh = basePublisher({ publisherId: 'pub-fresh' });
    const candidateRecent = basePublisher({ publisherId: 'pub-recent' });

    const history: AssignmentHistory[] = [
      { historyId: 'h1', publisherId: 'pub-fresh', date: '2025-09-01', assignmentType: 'STUDENT', partType: 'Leitura' },
      { historyId: 'h2', publisherId: 'pub-recent', date: '2025-11-20', assignmentType: 'STUDENT', partType: 'Leitura' },
    ];

    const [first] = RankingEngine.rankCandidates([candidateFresh, candidateRecent], part, history, meetingDate);

    expect(first.publisher.publisherId).toBe('pub-fresh');
  });

  it('applies cooldown penalty when same cooldownGroup occurs within 56 days', () => {
    const penalized = basePublisher({ publisherId: 'pub-penalized' });
    const clear = basePublisher({ publisherId: 'pub-clear' });

    const history: AssignmentHistory[] = [
      {
        historyId: 'h3',
        publisherId: 'pub-penalized',
        date: '2025-11-15',
        assignmentType: 'STUDENT',
        partType: 'Outra Parte',
        cooldownGroup: 'LEITURA_GROUP'
      },
    ];

    const groupedPart = basePart({ partType: 'Leitura', cooldownGroup: 'LEITURA_GROUP' });

    const ranked = RankingEngine.rankCandidates([penalized, clear], groupedPart, history, meetingDate);

    const penalizedEntry = ranked.find(entry => entry.publisher.publisherId === 'pub-penalized');
    const clearEntry = ranked.find(entry => entry.publisher.publisherId === 'pub-clear');

    expect((penalizedEntry?.score ?? 0)).toBeLessThan(clearEntry?.score ?? 0);
    expect(penalizedEntry?.debugInfo.some(info => info.includes('PENALIDADE'))).toBe(true);
  });
});

describe('TimingCalculator', () => {
  it('calculates sequential start and end times from meeting start', () => {
    const assignments: Assignment[] = [
      {
        assignmentId: 'assg-1',
        meetingPartId: 'part-1',
        principalPublisherId: 'pub-1',
        approvalStatus: 'DRAFT',
      },
      {
        assignmentId: 'assg-2',
        meetingPartId: 'part-2',
        principalPublisherId: 'pub-2',
        approvalStatus: 'DRAFT',
      },
    ];

    const parts: MeetingPart[] = [
      basePart({ partId: 'part-1', duration: 10, partType: 'Parte 1' }),
      basePart({ partId: 'part-2', duration: 5, partType: 'Parte 2' }),
    ];

    const result = TimingCalculator.calculateTimings(assignments, parts, '19:30');

    expect(result[0].startTime).toBe('19:30');
    expect(result[0].endTime).toBe('19:40');
    expect(result[1].startTime).toBe('19:40');
    expect(result[1].endTime).toBe('19:45');
  });
});

describe('AssignmentEngine warnings', () => {
  it('emits NO_CANDIDATE warning when no titular is eligible', () => {
    const noCandidatePart = basePart({
      partId: 'part-no-candidate',
      partType: 'Discurso Especial',
      teachingCategory: 'TEACHING',
      section: 'TESOUROS',
      requiredPrivileges: ['ANCIÃO'],
      requiredGender: 'F',
    });

    const publishers = [
      basePublisher({
        publisherId: 'pub-elder',
        privileges: ['ANCIÃO'],
        gender: 'M',
        isApprovedForTreasures: true,
      })
    ];

    const result = AssignmentEngine.generateAssignments(
      [noCandidatePart],
      publishers,
      [],
      '2025-12-01'
    );

    expect(result.assignments).toHaveLength(0);
    expect(result.warnings).toEqual([
      expect.objectContaining({ type: 'NO_CANDIDATE', meetingPartId: 'part-no-candidate' })
    ]);
  });

  it('emits HELPER_MISSING warning when helper requirements cannot be met', () => {
    const helperPart = basePart({
      partId: 'part-helper-missing',
      partType: 'Demonstração Dirigida',
      requiresHelper: true,
      helperRequirements: { requiredPrivileges: ['ANCIÃO'] },
      requiredPrivileges: [],
      requiredGender: 'OTHER',
      teachingCategory: 'STUDENT',
      section: 'MINISTERIO'
    });

    const publishers = [
      basePublisher({ publisherId: 'pub-student', gender: 'F' }),
      basePublisher({
        publisherId: 'pub-elder-1',
        privileges: ['ANCIÃO'],
        canBeHelper: false,
        isApprovedForTreasures: true,
      }),
      basePublisher({
        publisherId: 'pub-elder-2',
        privileges: ['ANCIÃO'],
        canBeHelper: false,
        isApprovedForTreasures: true,
      })
    ];

    const result = AssignmentEngine.generateAssignments(
      [helperPart],
      publishers,
      [],
      '2025-12-01'
    );

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].secondaryPublisherId).toBeUndefined();
    expect(result.warnings).toEqual([
      expect.objectContaining({ type: 'HELPER_MISSING', meetingPartId: 'part-helper-missing' })
    ]);
  });
});
