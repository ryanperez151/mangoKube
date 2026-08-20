import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FieldPanel } from './FieldPanel';
import type { LogEvent } from '@/content/types';

const resultEvents: LogEvent[] = [
  {
    id: 'a1',
    timestamp: '2026-08-12T02:14:01Z',
    source: 'k8s-audit',
    message: 'create pods/exec',
    fields: { user: 'ci-deploy-bot', verb: 'create' },
    arrivesAtStage: 0,
  },
  {
    id: 'a2',
    timestamp: '2026-08-12T02:15:00Z',
    source: 'k8s-audit',
    message: 'get secrets/genome',
    fields: { user: 'ci-deploy-bot', verb: 'get' },
    arrivesAtStage: 0,
  },
];

const groups = [
  {
    id: 'all' as const,
    label: 'All sources',
    fields: [
      { field: 'source', sources: ['k8s-audit' as const, 'edr' as const], count: 2, coverage: 1 },
    ],
  },
  {
    id: 'k8s-audit' as const,
    label: 'k8s-audit',
    fields: [
      { field: 'user', sources: ['k8s-audit' as const], count: 2, coverage: 1 },
      { field: 'verb', sources: ['k8s-audit' as const], count: 2, coverage: 1 },
      { field: 'sourceIP', sources: ['k8s-audit' as const], count: 0, coverage: 0 },
    ],
  },
  {
    id: 'edr' as const,
    label: 'edr',
    fields: [{ field: 'severity', sources: ['edr' as const], count: 0, coverage: 0 }],
  },
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof FieldPanel>> = {}) {
  const props = {
    open: true,
    pinned: false,
    groups,
    resultEvents,
    selectedFields: ['source', 'message'],
    presets: [{ id: 'audit-triage', label: 'Audit triage', fields: ['user', 'verb'] }],
    onToggleField: vi.fn(),
    onMoveField: vi.fn(),
    onApplyPreset: vi.fn(),
    onFilter: vi.fn(),
    onTogglePinned: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  const view = render(<FieldPanel {...props} />);
  return { ...props, rerender: view.rerender };
}

describe('FieldPanel', () => {
  it('renders nothing when closed', () => {
    renderPanel({ open: false });
    expect(screen.queryByTestId('field-panel')).toBeNull();
  });

  it('groups fields under the source that emits them', () => {
    renderPanel();
    expect(screen.getByRole('heading', { name: 'k8s-audit' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'edr' })).toBeInTheDocument();
  });

  it('leads with the shared-field group', () => {
    renderPanel();
    expect(screen.getByRole('heading', { name: 'All sources' })).toBeInTheDocument();
  });

  it('shows how many current results carry each field', () => {
    renderPanel();
    expect(screen.getByTestId('field-user')).toHaveTextContent('2');
    expect(screen.getByTestId('field-user')).toHaveTextContent('100%');
  });

  it('disables a field no current result carries', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: /toggle column sourceIP/i })).toBeDisabled();
  });

  it('toggles a field into the table', () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /toggle column user/i }));
    expect(props.onToggleField).toHaveBeenCalledWith('user');
  });

  it('marks fields already in the table', () => {
    renderPanel({ selectedFields: ['user'] });
    expect(screen.getByRole('button', { name: /toggle column user/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('lists the selected fields in table order', () => {
    renderPanel({ selectedFields: ['user', 'verb'] });
    const selected = screen.getByTestId('selected-fields');
    expect(selected).toHaveTextContent('user');
    expect(selected).toHaveTextContent('verb');
  });

  it('reorders a selected field', () => {
    const props = renderPanel({ selectedFields: ['user', 'verb'] });
    fireEvent.click(screen.getByRole('button', { name: /move verb up/i }));
    expect(props.onMoveField).toHaveBeenCalledWith('verb', -1);
  });

  it('applies a preset', () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /audit triage/i }));
    expect(props.onApplyPreset).toHaveBeenCalledWith(props.presets[0]);
  });

  it('narrows the field list as you type', () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText('filter fields'), { target: { value: 'ver' } });
    expect(screen.getByTestId('field-verb')).toBeInTheDocument();
    expect(screen.queryByTestId('field-user')).toBeNull();
  });

  it('expands a field to show its values', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /show values for verb/i }));
    expect(screen.getByRole('button', { name: 'Filter to verb=create' })).toBeInTheDocument();
  });

  it('passes a value filter up', () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /show values for verb/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter to verb=create' }));
    expect(props.onFilter).toHaveBeenCalledWith('verb', 'create', 'include');
  });

  it('closes on Escape when it is an overlay', () => {
    const props = renderPanel();
    fireEvent.keyDown(screen.getByTestId('field-panel'), { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('stays put on Escape when pinned', () => {
    const props = renderPanel({ pinned: true });
    fireEvent.keyDown(screen.getByTestId('field-panel'), { key: 'Escape' });
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('toggles the pin', () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /pin field browser/i }));
    expect(props.onTogglePinned).toHaveBeenCalled();
  });

  it('takes focus when it opens', () => {
    const props = renderPanel({ open: false });
    props.rerender(<FieldPanel {...props} open={true} />);
    expect(screen.getByTestId('field-panel')).toHaveFocus();
  });

  // `isPanelOpen = fieldPanelPinned || panelOpen` in LogExplorer means a
  // pinned panel is already `open: true` on the very first render — on
  // initial page load, and again on every stage advance, since LogExplorer
  // carries `key={stage.id}` and remounts. None of those are the player
  // opening the panel, so none of them should yank focus into the sidebar.
  it('does not steal focus when it mounts already open', () => {
    renderPanel({ open: true });
    expect(screen.getByTestId('field-panel')).not.toHaveFocus();
  });
});
