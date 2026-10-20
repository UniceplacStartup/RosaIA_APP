/** Horário `HH:mm` local. */
export function formatClockTime(date: Date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Iniciais (primeiro e último nome) para o avatar de perfil. */
export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? 'M';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? 'S' : 'S';
  return (first + last).toUpperCase();
}
