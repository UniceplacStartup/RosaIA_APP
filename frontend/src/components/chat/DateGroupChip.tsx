interface DateGroupChipProps {
  dateGroup: string;
}

/** Separador cronológico de data (`02/09/2026`, `15/09/2026`, `Hoje`). */
export default function DateGroupChip({ dateGroup }: DateGroupChipProps) {
  return (
    <div data-date-chip={dateGroup} className="flex justify-center my-3">
      <span className="px-3 py-1 rounded-full bg-rosa-200/90 text-rosa-900 text-[11px] font-bold shadow-sm border border-rosa-300">
        📅 {dateGroup}
      </span>
    </div>
  );
}
