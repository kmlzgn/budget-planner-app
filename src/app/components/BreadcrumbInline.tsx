import { useLocation } from 'react-router';
import { useBudget } from '../context/BudgetContext';
import { t } from '../utils/i18n';

const getSectionLabel = (path: string) => {
  if (path.startsWith('/overview')) return 'Overview';
  if (path.startsWith('/cash-flow')) return 'Cash Flow';
  if (path.startsWith('/net-worth')) return 'Net Worth';
  if (path.startsWith('/portfolio')) return 'Portfolio';
  if (path.startsWith('/debt')) return 'Debt';
  if (path.startsWith('/planning')) return 'Planning';
  if (path.startsWith('/settings')) return 'Settings';
  if (
    path === '/' ||
    path.startsWith('/tools') ||
    path.startsWith('/transactions') ||
    path.startsWith('/recurring')
  ) {
    return 'Tools';
  }
  return '';
};

const getToolLabel = (path: string) => {
  if (path === '/' || path === '/tools/instructions') return 'Instructions';
  if (path === '/transactions' || path === '/tools/transactions') return 'Transaction Log';
  if (path === '/recurring' || path === '/tools/recurring') return 'Recurring Transactions';
  return '';
};

export function BreadcrumbInline() {
  const location = useLocation();
  const { state } = useBudget();
  const language = state.settings.language;
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const legacyToCanonical: Record<string, string> = {
    '/dashboard': '/overview',
    '/monthly': '/cash-flow',
    '/accounts': '/net-worth',
    '/market': '/portfolio',
    '/503020': '/planning',
    '/setup': '/settings',
  };
  const canonicalPath = legacyToCanonical[normalizedPath] ?? normalizedPath;
  const sectionLabel = getSectionLabel(canonicalPath);
  const toolLabel = getToolLabel(normalizedPath);
  const label = sectionLabel
    ? `${t(sectionLabel, language)}${toolLabel ? ` / ${t(toolLabel, language)}` : ''}`
    : '';

  if (!label) return null;

  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
      {label}
    </span>
  );
}
