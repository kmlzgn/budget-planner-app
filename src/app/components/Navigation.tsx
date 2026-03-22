import { Link, useLocation } from 'react-router';
import { useBudget } from '../context/BudgetContext';
import { tKey, TranslationKey } from '../utils/i18n';
import {
  AccountBalanceWallet as AccountBalanceWalletIcon,
  BarChart as BarChartIcon,
  CalendarMonth as CalendarMonthIcon,
  CreditCard as CreditCardIcon,
  HelpOutline as HelpOutlineIcon,
  MenuOpen as MenuOpenIcon,
  PieChart as PieChartIcon,
  ShowChart as ShowChartIcon,
  ReceiptLong as ReceiptLongIcon,
  Repeat as RepeatIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { Button } from './ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from './ui/sidebar';

const primaryNavItems: Array<{ path: string; label: TranslationKey; icon: typeof BarChartIcon }> = [
  { path: '/overview', label: 'Overview', icon: BarChartIcon },
  { path: '/cash-flow', label: 'Cash Flow', icon: CalendarMonthIcon },
  { path: '/net-worth', label: 'Net Worth', icon: AccountBalanceWalletIcon },
  { path: '/portfolio', label: 'Portfolio', icon: ShowChartIcon },
  { path: '/debt', label: 'Debt', icon: CreditCardIcon },
  { path: '/planning', label: 'Planning', icon: PieChartIcon },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

const secondaryNavItems: Array<{ path: string; label: TranslationKey; icon: typeof HelpOutlineIcon }> = [
  { path: '/tools/instructions', label: 'Instructions', icon: HelpOutlineIcon },
  { path: '/tools/transactions', label: 'Transaction Log', icon: ReceiptLongIcon },
  { path: '/tools/recurring', label: 'Recurring Transactions', icon: RepeatIcon },
];

export function Navigation() {
  const location = useLocation();
  const { state } = useBudget();
  const language = state.settings.language;
  const { state: sidebarState, toggleSidebar } = useSidebar();
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const redirectMap: Record<string, string> = {
    '/dashboard': '/overview',
    '/monthly': '/cash-flow',
    '/accounts': '/net-worth',
    '/market': '/portfolio',
    '/503020': '/planning',
    '/setup': '/settings',
    '/tools': '/tools/instructions',
    '/tools/instructions': '/tools/instructions',
    '/tools/transactions': '/tools/transactions',
    '/tools/recurring': '/tools/recurring',
    '/': '/overview',
    '/transactions': '/tools/transactions',
    '/recurring': '/tools/recurring',
  };
  const activePath = redirectMap[normalizedPath] ?? normalizedPath;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <div className="flex items-center gap-2">
            <BarChartIcon className="h-5 w-5 text-emerald-600" />
            <span
              className={`text-sm font-semibold ${sidebarState === 'collapsed' ? 'hidden' : ''}`}
            >
              {tKey('Budget Planner 2026', language)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={toggleSidebar}
          >
            <MenuOpenIcon className="h-4 w-4" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent className="overflow-x-hidden">
        <SidebarMenu>
          <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {tKey('Core', language)}
          </div>
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePath === item.path;
            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={tKey(item.label, language)}
                >
                  <Link to={item.path}>
                    <Icon className="h-4 w-4" />
                    <span>{tKey(item.label, language)}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
          <div className="px-3 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {tKey('Tools', language)}
          </div>
          {secondaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePath === item.path;
            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={tKey(item.label, language)}
                >
                  <Link to={item.path}>
                    <Icon className="h-4 w-4" />
                    <span>{tKey(item.label, language)}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
