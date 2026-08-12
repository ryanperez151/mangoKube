import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryChips } from './QueryChips';

const suggestions = [
  { label: 'High-severity endpoint alerts', query: 'source=edr severity=high' },
  { label: 'Exec calls', query: 'source=k8s-audit resource=pods/exec' },
];

describe('QueryChips', () => {
  it('renders a chip per suggestion', () => {
    render(<QueryChips suggestions={suggestions} onSelect={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('shows the query syntax each chip will insert', () => {
    render(<QueryChips suggestions={suggestions} onSelect={() => {}} />);
    expect(screen.getByText('source=edr severity=high')).toBeInTheDocument();
  });

  it('passes the query up when a chip is clicked', () => {
    const onSelect = vi.fn();
    render(<QueryChips suggestions={suggestions} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /High-severity/ }));
    expect(onSelect).toHaveBeenCalledWith('source=edr severity=high');
  });

  it('renders nothing when there are no suggestions', () => {
    const { container } = render(<QueryChips suggestions={[]} onSelect={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
