import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Terminal } from './Terminal';

describe('Terminal', () => {
  it('renders history entries', () => {
    render(
      <Terminal
        history={[{ input: 'kubectl get pods', output: ['pod-a', 'pod-b'] }]}
        availableCommands={[]}
        onSubmit={() => {}}
      />
    );
    expect(screen.getByText('$ kubectl get pods')).toBeInTheDocument();
    expect(screen.getByText('pod-a')).toBeInTheDocument();
  });

  it('renders hint descriptions for available commands', () => {
    render(
      <Terminal
        history={[]}
        availableCommands={[{ description: 'kubectl get pods' }, { description: 'whoami' }]}
        onSubmit={() => {}}
      />
    );
    expect(screen.getByTestId('terminal-hints').textContent).toContain('kubectl get pods');
    expect(screen.getByTestId('terminal-hints').textContent).toContain('whoami');
  });

  it('calls onSubmit with trimmed input and clears the field', () => {
    const onSubmit = vi.fn();
    render(<Terminal history={[]} availableCommands={[]} onSubmit={onSubmit} />);
    const input = screen.getByLabelText('terminal input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  kubectl get pods  ' } });
    fireEvent.submit(input.closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith('kubectl get pods');
    expect(input.value).toBe('');
  });

  it('does not call onSubmit for empty input', () => {
    const onSubmit = vi.fn();
    render(<Terminal history={[]} availableCommands={[]} onSubmit={onSubmit} />);
    const input = screen.getByLabelText('terminal input');
    fireEvent.submit(input.closest('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
