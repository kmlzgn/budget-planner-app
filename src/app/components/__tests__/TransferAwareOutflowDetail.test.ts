// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { TransferAwareOutflowDetail } from '../TransferAwareOutflowDetail';
import { TransferAwareOutflowSummary } from '../../utils/financeSummaries';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver =
  globalThis.ResizeObserver ||
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

const baseSummary: TransferAwareOutflowSummary = {
  outflowExTransfers: 0,
  transferAwareBalance: 0,
  hasDerivedTransfers: false,
  excludedTransferCount: 0,
  showTransferAwareDetail: false,
};

const renderDetailDom = (summary: TransferAwareOutflowSummary, options?: { forceTooltipOpen?: boolean }) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      React.createElement(TransferAwareOutflowDetail, {
        summary,
        currency: '$',
        locale: 'en-US',
        language: 'en',
        size: 'sm',
        forceTooltipOpen: options?.forceTooltipOpen,
      })
    );
  });

  return {
    container,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

describe('TransferAwareOutflowDetail', () => {
  it('hides entirely when showTransferAwareDetail is false', () => {
    const { container, cleanup } = renderDetailDom(baseSummary);
    expect(container.innerHTML).toBe('');
    cleanup();
  });

  it('renders label and tooltip copy when visible', () => {
    const { container, cleanup } = renderDetailDom({
      ...baseSummary,
      showTransferAwareDetail: true,
      outflowExTransfers: 125,
      hasDerivedTransfers: true,
    });
    expect(container.textContent ?? '').toContain('Cash outflow (ex-transfers)');
    const trigger = container.querySelector('button[aria-label="Transfer-aware outflow detail"]');
    expect(trigger).toBeTruthy();
    expect(trigger?.getAttribute('data-tooltip-copy')).toBe(
      'Excludes derived transfer events and explicit credit-card payment outflows.'
    );
    cleanup();
  });

  it('shows tooltip trigger only when detail is shown', () => {
    const hidden = renderDetailDom(baseSummary);
    expect(hidden.container.querySelector('button[aria-label="Transfer-aware outflow detail"]')).toBeNull();
    hidden.cleanup();

    const visible = renderDetailDom({
      ...baseSummary,
      showTransferAwareDetail: true,
      outflowExTransfers: 90,
    });
    expect(visible.container.querySelector('button[aria-label="Transfer-aware outflow detail"]')).toBeTruthy();
    visible.cleanup();
  });

  it('renders tooltip content when tooltip is open', async () => {
    const { container, cleanup } = renderDetailDom(
      {
        ...baseSummary,
        showTransferAwareDetail: true,
        outflowExTransfers: 125,
        excludedTransferCount: 2,
        hasDerivedTransfers: true,
      },
      { forceTooltipOpen: true }
    );

    const trigger = container.querySelector('button[aria-label="Transfer-aware outflow detail"]');
    expect(trigger).toBeTruthy();

    const tooltip = document.body.querySelector('[data-slot="tooltip-content"]');
    expect(tooltip?.textContent ?? '').toContain(
      'Excludes derived transfer events and explicit credit-card payment outflows.'
    );
    expect(tooltip?.textContent ?? '').toContain('Excluded transfers this month: 2');

    cleanup();
  });

  it('shows excluded transfer count only when > 0', () => {
    const withCount = renderDetailDom(
      {
        ...baseSummary,
        showTransferAwareDetail: true,
        outflowExTransfers: 125,
        excludedTransferCount: 2,
        hasDerivedTransfers: true,
      },
      { forceTooltipOpen: true }
    );
    const triggerWithCount = withCount.container.querySelector('button[aria-label="Transfer-aware outflow detail"]');
    expect(triggerWithCount?.getAttribute('data-excluded-count')).toBe('2');
    withCount.cleanup();

    const withoutCount = renderDetailDom({
      ...baseSummary,
      showTransferAwareDetail: true,
      outflowExTransfers: 125,
    });
    const triggerWithoutCount = withoutCount.container.querySelector(
      'button[aria-label="Transfer-aware outflow detail"]'
    );
    expect(triggerWithoutCount?.hasAttribute('data-excluded-count')).toBe(false);
    withoutCount.cleanup();
  });
});
