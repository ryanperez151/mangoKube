import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FieldValueList } from './FieldValueList';

const values = [
  { value: 'get', count: 180, share: 0.6 },
  { value: 'create', count: 120, share: 0.4 },
];

describe('FieldValueList', () => {
  it('lists each value with its count', () => {
    render(<FieldValueList field="verb" values={values} onFilter={() => {}} />);
    expect(screen.getByText('get')).toBeInTheDocument();
    expect(screen.getByText('180')).toBeInTheDocument();
  });

  it('filters to a value', () => {
    const onFilter = vi.fn();
    render(<FieldValueList field="verb" values={values} onFilter={onFilter} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter to verb=get' }));
    expect(onFilter).toHaveBeenCalledWith('verb', 'get', 'include');
  });

  it('excludes a value', () => {
    const onFilter = vi.fn();
    render(<FieldValueList field="verb" values={values} onFilter={onFilter} />);
    fireEvent.click(screen.getByRole('button', { name: 'Exclude verb=get' }));
    expect(onFilter).toHaveBeenCalledWith('verb', 'get', 'exclude');
  });

  it('says so when the field has no values in these results', () => {
    render(<FieldValueList field="verb" values={[]} onFilter={() => {}} />);
    expect(screen.getByTestId('no-values')).toBeInTheDocument();
  });

  it('renders a share bar sized to the value', () => {
    render(<FieldValueList field="verb" values={values} onFilter={() => {}} />);
    expect(screen.getByTestId('share-verb-get')).toHaveStyle({ width: '60%' });
  });
});
