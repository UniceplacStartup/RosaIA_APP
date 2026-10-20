/** Indicador animado "Doutora Rosa está digitando..." (RF09). */
export default function TypingIndicator() {
  return (
    <div
      id="typingIndicator"
      role="status"
      aria-live="polite"
      className="px-4 py-2 bg-rosa-50 border-t border-rosa-200 flex items-center gap-2 text-xs text-rosa-800 font-medium"
    >
      <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-full border border-rosa-200">
        <span className="w-1.5 h-1.5 rounded-full bg-rosa-700 typing-dot" />
        <span className="w-1.5 h-1.5 rounded-full bg-rosa-700 typing-dot" />
        <span className="w-1.5 h-1.5 rounded-full bg-rosa-700 typing-dot" />
      </div>
      <span>Doutora Rosa está digitando com carinho...</span>
    </div>
  );
}
