import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Terminal } from './Terminal';

describe('Terminal', () => {
  function renderTerminal(
    overrides: Partial<React.ComponentProps<typeof Terminal>> = {}
  ) {
    const props = {
      history: [] as React.ComponentProps<typeof Terminal>['history'],
      availableCommands: [] as React.ComponentProps<typeof Terminal>['availableCommands'],
      value: '',
      onChange: vi.fn(),
      onSubmit: vi.fn(),
      ...overrides,
    };
    render(<Terminal {...props} />);
    return props;
  }

  it('renders history entries', () => {
    renderTerminal({ history: [{ input: 'kubectl get pods', output: ['pod-a', 'pod-b'] }] });
    expect(screen.getByText('$ kubectl get pods')).toBeInTheDocument();
    expect(screen.getByText('pod-a')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Command 1: kubectl get pods' })).toBeInTheDocument();
  });

  it('frames the transcript with a campaign banner and prompt', () => {
    renderTerminal({
      banner: ['MangoCorp build runner shell ready.'],
      prompt: 'root@build-runner:/workspace$',
      history: [{ input: 'whoami', output: ['root'] }],
    });

    expect(screen.getByText('MangoCorp build runner shell ready.')).toBeInTheDocument();
    expect(screen.getByText('root@build-runner:/workspace$ whoami')).toBeInTheDocument();
    expect(screen.getByText('root@build-runner:/workspace$')).toBeInTheDocument();
  });

  it('does not expose exact commands before the player types', () => {
    renderTerminal({
      availableCommands: [{ description: 'kubectl get pods' }, { description: 'whoami' }],
    });
    expect(screen.queryByText(/kubectl get pods.*whoami/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('terminal-hints')).not.toBeInTheDocument();
  });

  it('calls onSubmit with trimmed input and clears the field', () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    renderTerminal({ value: '  kubectl get pods  ', onChange, onSubmit });
    const input = screen.getByLabelText('terminal input') as HTMLInputElement;
    fireEvent.submit(input.closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith('kubectl get pods');
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('does not call onSubmit for empty input', () => {
    const props = renderTerminal();
    const input = screen.getByLabelText('terminal input');
    fireEvent.submit(input.closest('form')!);
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('submits the current command with Enter', () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    renderTerminal({ value: 'kubectl get pods', onChange, onSubmit });

    fireEvent.keyDown(screen.getByLabelText('terminal input'), { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith('kubectl get pods');
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('moves through submitted command history with Up and Down', () => {
    const onChange = vi.fn();
    renderTerminal({
      history: [
        { input: 'kubectl get pods', output: ['pods'] },
        { input: 'kubectl auth can-i --list', output: ['permissions'] },
      ],
      value: 'draft',
      onChange,
    });
    const input = screen.getByLabelText('terminal input');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith('kubectl auth can-i --list');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith('kubectl get pods');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith('kubectl auth can-i --list');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith('draft');
  });

  it('Tab completes only a non-empty prefix with one available match', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Terminal
        history={[]}
        availableCommands={[
          { description: 'kubectl get pods' },
          { description: 'kubectl get secrets -A' },
        ]}
        value="kubectl get p"
        onChange={onChange}
        onSubmit={() => {}}
      />
    );
    const input = screen.getByLabelText('terminal input');
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(onChange).toHaveBeenLastCalledWith('kubectl get pods');

    onChange.mockClear();
    rerender(
      <Terminal
        history={[]}
        availableCommands={[
          { description: 'kubectl get pods' },
          { description: 'kubectl get secrets -A' },
        ]}
        value="kubectl get"
        onChange={onChange}
        onSubmit={() => {}}
      />
    );
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <Terminal
        history={[]}
        availableCommands={[{ description: 'kubectl get pods' }]}
        value=""
        onChange={onChange}
        onSubmit={() => {}}
      />
    );
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
