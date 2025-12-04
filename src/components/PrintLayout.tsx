import { useMemo, CSSProperties } from 'react';
import { Assignment, MeetingPart, Publisher } from '../types/models';

interface PrintLayoutProps {
  meetingDate: string;
  assignments: Assignment[];
  publishers: Publisher[];
  meetingParts: MeetingPart[];
}

export function PrintLayout({ meetingDate, assignments, publishers, meetingParts }: PrintLayoutProps) {
  
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

  // Styles object to avoid Tailwind OKLCH issues
  const styles = {
    container: {
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      color: '#000000',
      backgroundColor: '#ffffff',
      padding: '2rem',
      width: '100%',
      height: '100%',
      margin: '0 auto',
      boxSizing: 'border-box',
    } as CSSProperties,
    header: {
      textAlign: 'center',
      borderBottom: '2px solid #1f2937', // gray-800
      marginBottom: '1.5rem',
      paddingBottom: '1rem',
    } as CSSProperties,
    h1: {
      fontSize: '1.5rem',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.025em',
      color: '#111827', // gray-900
      margin: 0,
    } as CSSProperties,
    p: {
      fontSize: '1.125rem',
      color: '#4b5563', // gray-600
      marginTop: '0.5rem',
      margin: 0,
    } as CSSProperties,
    sectionContainer: {
      marginBottom: '1.5rem',
      border: '1px solid #d1d5db', // gray-300
      pageBreakInside: 'avoid',
    } as CSSProperties,
    sectionHeader: (color: string): CSSProperties => ({
      backgroundColor: color,
      color: '#ffffff',
      padding: '0.375rem 0.75rem',
      fontWeight: '700',
      textTransform: 'uppercase',
      fontSize: '0.875rem',
      letterSpacing: '0.05em',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      printColorAdjust: 'exact',
      WebkitPrintColorAdjust: 'exact',
    }),
    row: {
      display: 'grid',
      gridTemplateColumns: '50px 1fr 1fr',
      gap: '1rem',
      padding: '0.5rem 0.75rem',
      alignItems: 'center',
      fontSize: '0.875rem',
      borderBottom: '1px solid #e5e7eb', // gray-200
    } as CSSProperties,
    time: {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      color: '#111827', // gray-900
      fontWeight: '700',
    } as CSSProperties,
    partTitle: {
      fontWeight: '700',
      color: '#111827', // gray-900',
      display: 'block',
    } as CSSProperties,
    duration: {
      fontWeight: '400',
      color: '#4b5563', // gray-600
    } as CSSProperties,
    publisher: {
      fontWeight: '500',
      color: '#111827', // gray-900',
      textAlign: 'right',
    } as CSSProperties,
    footer: {
      marginTop: '2rem',
      fontSize: '10px',
      textAlign: 'center',
      color: '#9ca3af', // gray-400
      borderTop: '1px solid #e5e7eb',
      paddingTop: '0.5rem',
    } as CSSProperties
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.h1}>Nossa Vida e Ministério Cristão</h1>
        <p style={styles.p}>Programa da Reunião | Semana de {new Date(meetingDate).toLocaleDateString('pt-BR')}</p>
      </header>

      <div>
        {sections.map(section => {
          const sectionAssignments = assignmentsBySection[section.key] || [];
          if (sectionAssignments.length === 0) return null;

          let headerColor = '#334155'; // slate-700
          if (section.key === 'MINISTERIO') headerColor = '#ca8a04'; // yellow-600
          if (section.key === 'VIDA_CRISTA') headerColor = '#b91c1c'; // red-700

          return (
            <div key={section.key} style={styles.sectionContainer}>
              <div style={styles.sectionHeader(headerColor)}>
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
                      publisherDisplay +=  / ;
                    }
                  } else if (assignment.secondaryPublisherId) {
                    publisherDisplay +=  / ;
                  }

                  // Remove border from last item
                  const isLast = index === sectionAssignments.length - 1;
                  const rowStyle = isLast ? { ...styles.row, borderBottom: 'none' } : styles.row;

                  return (
                    <div key={assignment.assignmentId} style={rowStyle}>
                      <div style={styles.time}>
                          {assignment.startTime}
                      </div>
                      <div>
                        <span style={styles.partTitle}>
                          {part.partType} <span style={styles.duration}>({part.duration} min)</span>
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={styles.publisher}>{publisherDisplay}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      
      <div style={styles.footer}>
        Gerado pelo Sistema RVM
      </div>
    </div>
  );
}
