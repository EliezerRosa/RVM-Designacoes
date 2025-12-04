import { useMemo } from 'react';
import clsx from 'clsx';
import { Assignment, AssignmentWarning, MeetingPart, Publisher } from '../types/models';
import styles from './PrintLayout.module.css';

interface PrintLayoutProps {
  meetingDate: string;
  assignments: Assignment[];
  publishers: Publisher[];
  meetingParts: MeetingPart[];
  warnings: AssignmentWarning[];
}

export function PrintLayout({ meetingDate, assignments, publishers, meetingParts, warnings }: PrintLayoutProps) {
  
  const getPublisherName = (id?: string) => {
    if (!id) return '---';
    const pub = publishers.find(p => p.publisherId === id);
    return pub ? pub.name : 'Desconhecido';
  };

  const getPart = (id: string) => meetingParts.find(p => p.partId === id);

  const sections = [
    { key: 'TESOUROS', title: 'Tesouros da Palavra de Deus' },
    { key: 'MINISTERIO', title: 'Faça Seu Melhor no Ministério' },
    { key: 'VIDA_CRISTA', title: 'Nossa Vida Cristã' },
  ];

  const assignmentsBySection = useMemo(() => {
    const grouped: Record<string, Assignment[]> = {};
    assignments.forEach(a => {
      const part = getPart(a.meetingPartId);
      const section = part?.section || 'OUTROS';
      if (!grouped[section]) grouped[section] = [];
      grouped[section].push(a);
    });
    return grouped;
  }, [assignments, meetingParts]);

  const warningsByPart = useMemo(() => {
    return warnings.reduce<Record<string, AssignmentWarning[]>>((acc, warning) => {
      if (!warning.meetingPartId) return acc;
      if (!acc[warning.meetingPartId]) acc[warning.meetingPartId] = [];
      acc[warning.meetingPartId].push(warning);
      return acc;
    }, {});
  }, [warnings]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Nossa Vida e Ministério Cristão</h1>
        <p className={styles.subtitle}>Programa da Reunião | Semana de {new Date(meetingDate).toLocaleDateString('pt-BR')}</p>
      </header>

      {warnings.length > 0 && (
        <section className={styles.warningBanner}>
          <div className={styles.warningTitle}>Alertas para revisão</div>
          <ul className={styles.warningList}>
            {warnings.map((warning, index) => {
              const part = warning.meetingPartId ? getPart(warning.meetingPartId) : null;
              return (
                <li key={`${warning.type}-${warning.meetingPartId ?? 'general'}-${index}`} className={styles.warningItem}>
                  {part ? <strong>{part.partType}:</strong> : <strong>Geral:</strong>} {warning.message}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div>
        {sections.map(section => {
          const sectionAssignments = assignmentsBySection[section.key] || [];
          if (sectionAssignments.length === 0) return null;

          const sectionHeaderClass = clsx(styles.sectionHeader, {
            [styles.headerMinisterio]: section.key === 'MINISTERIO',
            [styles.headerVidaCrista]: section.key === 'VIDA_CRISTA',
          });

          return (
            <div key={section.key} className={styles.sectionContainer}>
              <div className={sectionHeaderClass}>
                <span>{section.title}</span>
              </div>
              <div>
                {sectionAssignments.map((assignment, index) => {
                  const part = getPart(assignment.meetingPartId);
                  if (!part) return null;

                  // Lógica Especial: Leitor do Estudo
                  if (part.partType === 'Leitor do Estudo') return null;

                  let publisherDisplay = getPublisherName(assignment.principalPublisherId);
                  
                  if (part.partType === 'Estudo Bíblico de Congregação') {
                    const leitorAssignment = sectionAssignments.find(a => {
                      const p = getPart(a.meetingPartId);
                      return p?.partType === 'Leitor do Estudo';
                    });
                    if (leitorAssignment) {
                      const leitorName = getPublisherName(leitorAssignment.principalPublisherId);
                      publisherDisplay += ` / ${leitorName} (Leitor)`;
                    }
                  } else if (assignment.secondaryPublisherId) {
                    const helperName = getPublisherName(assignment.secondaryPublisherId);
                    publisherDisplay += ` / ${helperName}`;
                  }

                  const partWarnings = warningsByPart[part.partId] ?? [];

                  // Remove border from last item
                  const isLast = index === sectionAssignments.length - 1;
                  const rowClassName = clsx(styles.row, {
                    [styles.rowLast]: isLast,
                    [styles.rowWarning]: partWarnings.length > 0,
                  });

                  return (
                    <div key={assignment.assignmentId} className={rowClassName}>
                      <div className={styles.time}>
                          {assignment.startTime}
                      </div>
                      <div>
                        <span className={styles.partTitle}>
                          {part.partType} <span className={styles.duration}>({part.duration} min)</span>
                        </span>
                      </div>
                      <div className={styles.publisherColumn}>
                        <span className={styles.publisher}>{publisherDisplay}</span>
                        {partWarnings.length > 0 && (
                          <div className={styles.warningChipList}>
                            {partWarnings.map((warning, warningIndex) => (
                              <span key={`${warning.type}-${warning.meetingPartId}-${warningIndex}`} className={styles.warningChip}>
                                {warning.type === 'NO_CANDIDATE' ? 'Titular ausente' : warning.type === 'HELPER_MISSING' ? 'Sem ajudante' : warning.type}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className={styles.footer}>
        Gerado pelo Sistema RVM
      </div>
    </div>
  );
}
