import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('budgetPlannerData');
  });
});

test('smoke: add transaction, account, debt, and see overview update', async ({ page }) => {
  await page.goto('/overview');

  const netWorthCard = page.locator('.app-card', { hasText: 'Net Worth' });
  const netWorthValue = netWorthCard.locator('.text-3xl');
  const initialNetWorth = (await netWorthValue.textContent())?.trim();

  await page.goto('/tools/transactions');
  await page.getByText('Add New Transaction').click();
  await page.getByLabel('Date').fill('2026-03-19');
  await page.getByLabel('Type').selectOption('expense');
  await page.getByLabel('Category').selectOption({ label: 'Food & Groceries' });
  await page.getByLabel(/Amount/i).fill('123.45');
  await page.getByLabel('Description').fill('Coffee');
  await page.getByRole('button', { name: 'Add Transaction' }).click();
  await expect(page.getByText('Coffee')).toBeVisible();

  await page.goto('/net-worth');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('button', { name: 'Add Account' }).click();
  await page.getByLabel('Account Name').fill('Test Checking');
  await page.getByLabel('Opening Balance').fill('1000');
  await page.getByLabel('Current Balance').fill('1000');
  await page.getByRole('button', { name: 'Add Account' }).click();
  await expect(page.getByText('Test Checking')).toBeVisible();

  await page.goto('/debt');
  await page.getByLabel('Debt Name').fill('Test Card');
  await page.getByLabel('Total Amount').fill('5000');
  await page.getByLabel('Current Balance').fill('3000');
  await page.getByLabel('Monthly Interest Rate (%)').fill('1.2');
  await page.getByLabel('Min. Payment').fill('100');
  await page.getByRole('button', { name: 'Add Debt' }).click();
  await expect(page.getByText('Test Card')).toBeVisible();

  await page.goto('/overview');
  const updatedNetWorth = (await netWorthValue.textContent())?.trim();
  expect(updatedNetWorth).not.toEqual(initialNetWorth);
  await expect(netWorthCard).toContainText('$');
});
