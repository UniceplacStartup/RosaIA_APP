import type { PasswordRuleItem } from '../../types/auth';

interface PasswordRequirementListProps {
  rules: PasswordRuleItem[];
}

/** Checklist visual OWASP Top 10 de senha em tempo real. */
export default function PasswordRequirementList({ rules }: PasswordRequirementListProps) {
  return (
    <ul
      aria-label="Requisitos da senha"
      className="bg-white rounded-xl p-3 border border-rosa-200 text-[11px] grid grid-cols-2 sm:grid-cols-3 gap-1.5"
    >
      {rules.map((rule) => (
        <li
          key={rule.key}
          id={`req-${rule.key}`}
          className={rule.satisfied ? 'text-emerald-700 font-bold' : 'text-gray-500'}
        >
          {rule.satisfied ? '✓ ' : '○ '}
          {rule.label}
        </li>
      ))}
    </ul>
  );
}
