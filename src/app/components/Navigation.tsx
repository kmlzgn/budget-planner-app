import { Link, useLocation } from 'react-router';
import { useBudget } from '../context/BudgetContext';
import { t } from '../utils/i18n';
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

const navItems = [
  { path: '/', label: 'Instructions', icon: HelpOutlineIcon },
  { path: '/setup', label: 'Setup', icon: SettingsIcon },
  { path: '/recurring', label: 'Recurring Transactions', icon: RepeatIcon },
  { path: '/transactions', label: 'Transaction Log', icon: ReceiptLongIcon },
  { path: '/monthly', label: 'Monthly Overview', icon: CalendarMonthIcon },
  { path: '/dashboard', label: 'Annual Dashboard', icon: BarChartIcon },
  { path: '/accounts', label: 'Accounts & Wealth', icon: AccountBalanceWalletIcon },
  { path: '/market', label: 'Market Data', icon: ShowChartIcon },
  { path: '/debt', label: 'Debt Planner', icon: CreditCardIcon },
  { path: '/503020', label: '50/30/20 Rule', icon: PieChartIcon },
];

export function Navigation() {
  const location = useLocation();
  const { state } = useBudget();
  const language = state.settings.language;
  const { state: sidebarState, toggleSidebar } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <div className="flex items-center gap-2">
            <BarChartIcon className="h-5 w-5 text-emerald-600" />
            <span
              className={`text-sm font-semibold ${sidebarState === 'collapsed' ? 'hidden' : ''}`}
            >
              {t('Budget Planner 2026', language)}
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
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={t(item.label, language)}
                >
                  <Link to={item.path}>
                    <Icon className="h-4 w-4" />
                    <span>{t(item.label, language)}</span>
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
