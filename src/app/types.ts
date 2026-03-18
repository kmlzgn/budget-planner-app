// Type definitions for the Budget Planner

export type BudgetMethod = 'zero-based' | 'carryover';
export type TransactionFrequency = 'once' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'annually';
export type TransactionType = 'income' | 'expense';
export type TransactionKind = 'standard' | 'credit-card-payment';
export type MarketDataMode = 'manual' | 'auto';
export type AccountType =
  | 'checking'
  | 'savings'
  | 'credit-card'
  | 'investment'
  | 'blocked'
  | 'pension'
  | 'life-insurance'
  | 'loan'
  | 'cash'
  | 'brokerage'
  | 'retirement'
  | 'mortgage'
  | 'auto-loan'
  | 'other-asset'
  | 'other-liability';
export type DebtStrategy = 'snowball' | 'avalanche';
export type CategoryClassification = 'needs' | 'wants' | 'savings' | 'none';
export type DebtInstallmentStatus = 'pending' | 'paid';
export type Language = 'en' | 'tr';
export type FundTransactionType = 'buy' | 'sell';
export type DepositStatus = 'active' | 'matured' | 'due-soon';
export type WealthViewMode = 'nominal' | 'real';

export interface Settings {
  currency: string;
  startMonth: number; // 0-11 (January = 0)
  startYear: number;
  budgetMethod: BudgetMethod;
  familyMembers: string[];
  language: Language;
  owners?: string[];
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  classification: CategoryClassification;
  color?: string;
}

export interface RecurringTransaction {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  frequency: TransactionFrequency;
  startDate: string;
  endDate?: string;
  type: TransactionType;
  accountId?: string;
  isActive: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  accountCurrency?: string;
  accountAmount?: number;
  fxRateToBase?: number;
  baseAmount?: number;
  categoryId: string;
  accountId?: string;
  creditCardAccountId?: string;
  paymentAccountId?: string;
  debtId?: string;
  installmentId?: string;
  description: string;
  type: TransactionType;
  spender?: string;
  transactionKind?: TransactionKind;
}

export interface FundTransaction {
  id: string;
  assetClass: 'fund';
  date: string;
  fund: string;
  accountId?: string;
  spender?: string;
  units: number;
  price: number;
  amount: number;
  type: FundTransactionType;
  cashTransactionId?: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: number;
  currentBalance: number;
  isAsset: boolean;
  currency?: string;
  isForeignCurrency?: boolean;
  exchangeRate?: number;
  notes?: string;
  owner?: string;
  institution?: string;
  statementDay?: number;
  dueDay?: number;
  pensionFundValue?: number;
  governmentContribution?: number;
}

export interface DebtInstallment {
  id: string;
  dueDate: string;
  amount: number;
  status: DebtInstallmentStatus;
  transactionId?: string;
}

export interface Debt {
  id: string;
  name: string;
  totalAmount: number;
  currentBalance: number;
  interestRate: number;
  minimumPayment: number;
  alreadyPaidAmount?: number;
  alreadyPaidInstallments?: number;
  oneTimeFee?: number;
  oneTimeFeeNote?: string;
  accountId?: string;
  paymentCategoryId?: string;
  installmentStartDate?: string;
  installmentFrequency?: TransactionFrequency;
  installmentCount?: number;
  installmentAmount?: number;
  installments?: DebtInstallment[];
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  accountId?: string;
}

export interface Deposit {
  id: string;
  owner?: string;
  institution?: string;
  principal: number;
  termDays: number;
  grossRate: number;
  withholdingTaxRate: number;
  startDate: string;
  maturityDate: string;
  grossInterest: number;
  withholdingTaxAmount: number;
  netInterest: number;
  maturityValue: number;
  daysRemaining: number;
  status: DepositStatus;
  source?: 'import' | 'manual';
}

export interface WealthSnapshot {
  id: string;
  date: string;
  totalAssets: number;
  totalDebts: number;
  netWealth: number;
  cash: number;
  funds: number;
  deposits: number;
  gold: number;
  blockedAssets: number;
  otherAssets: number;
}

export interface FundHoldingMeta {
  fund: string;
  currentPrice: number;
  withholdingTaxRate: number;
  transactionFeeRate?: number;
  priceMode?: MarketDataMode;
  lastUpdated?: string;
}

export interface FxRate {
  pair: string;
  rate: number;
  mode: MarketDataMode;
  updatedAt?: string;
}

export interface CommodityPrice {
  commodity: string;
  price: number;
  mode: MarketDataMode;
  updatedAt?: string;
}

export interface MarketDataState {
  fxRates: FxRate[];
  commodities: CommodityPrice[];
}

export interface BudgetState {
  schemaVersion: number;
  settings: Settings;
  categories: Category[];
  recurringTransactions: RecurringTransaction[];
  transactions: Transaction[];
  fundTransactions: FundTransaction[];
  fundHoldingsMeta: FundHoldingMeta[];
  marketData: MarketDataState;
  deposits: Deposit[];
  wealthSnapshots: WealthSnapshot[];
  accounts: Account[];
  debts: Debt[];
  savingsGoals: SavingsGoal[];
}
