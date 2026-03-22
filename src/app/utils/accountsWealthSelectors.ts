import { PortfolioAllocationItem } from './financeSummaries';

export const getPortfolioAllocationTotal = (items: PortfolioAllocationItem[]) =>
  items.reduce((sum, item) => sum + item.value, 0);
