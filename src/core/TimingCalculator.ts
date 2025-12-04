import { Assignment, MeetingPart } from '../types/models';

export class TimingCalculator {
  /**
   * Calcula os horários de início e fim para uma lista de designações sequenciais.
   * @param assignments Lista de designações geradas.
   * @param parts Lista de partes correspondentes (para obter a duração).
   * @param meetingStartTime Horário de início da reunião (ex: "19:30").
   * @returns Nova lista de designações com startTime e endTime preenchidos.
   */
  static calculateTimings(
    assignments: Assignment[],
    parts: MeetingPart[],
    meetingStartTime: string = "19:30"
  ): Assignment[] {
    let currentMinutes = this.timeToMinutes(meetingStartTime);

    // Mapeia partes por ID para acesso rápido
    const partsMap = new Map(parts.map(p => [p.partId, p]));

    return assignments.map(assignment => {
      const part = partsMap.get(assignment.meetingPartId);
      const duration = part?.duration || 0;

      const startMinutes = currentMinutes;
      const endMinutes = currentMinutes + duration;

      // Atualiza o tempo corrente para a próxima parte
      currentMinutes = endMinutes;

      return {
        ...assignment,
        startTime: this.minutesToTime(startMinutes),
        endTime: this.minutesToTime(endMinutes)
      };
    });
  }

  /**
   * Converte string "HH:mm" para total de minutos desde 00:00.
   */
  private static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours * 60) + minutes;
  }

  /**
   * Converte total de minutos para string "HH:mm".
   */
  private static minutesToTime(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60) % 24; // % 24 para lidar com virada de dia se necessário
    const minutes = totalMinutes % 60;

    const hh = hours.toString().padStart(2, '0');
    const mm = minutes.toString().padStart(2, '0');

    return `${hh}:${mm}`;
  }
}
