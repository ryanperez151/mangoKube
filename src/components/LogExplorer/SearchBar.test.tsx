import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  it('shows the current query value', () => {
    render(<SearchBar value="source=edr" onChange={() => {}} onSubmit={() => {}} />);
    expect(screen.getByLabelText('search query')).toHaveValue('source=edr');
  });

  it('reports typing through onChange', () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} onSubmit={() => {}} />);
    fireEvent.change(screen.getByLabelText('search query'), { target: { value: 'verb=get' } });
    expect(onChange).toHaveBeenCalledWith('verb=get');
  });

  it('submits on form submission', () => {
    const onSubmit = vi.fn();
    render(<SearchBar value="verb=get" onChange={() => {}} onSubmit={onSubmit} />);
    fireEvent.submit(screen.getByRole('search'));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('shows a parse error when one is supplied', () => {
    render(
      <SearchBar value="user=" onChange={() => {}} onSubmit={() => {}} error='Missing value for field "user".' />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Missing value for field "user".');
  });

  it('shows the result count when there is no error', () => {
    render(<SearchBar value="" onChange={() => {}} onSubmit={() => {}} resultCount={42} />);
    expect(screen.getByTestId('result-count')).toHaveTextContent('42 events');
  });

  it('hides the result count when there is an error', () => {
    render(
      <SearchBar value="" onChange={() => {}} onSubmit={() => {}} resultCount={42} error="bad" />
    );
    expect(screen.queryByTestId('result-count')).toBeNull();
  });
});
