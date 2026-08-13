import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Primer } from './Primer';
import { infiltratorPrimer, sentinelPrimer } from '@/content/chapter1/primer';

describe('Primer', () => {
  it('renders every section with its reference rows', () => {
    render(
      <Primer primer={sentinelPrimer} roleLabel="The Sentinel" onBegin={vi.fn()} onBack={vi.fn()} />
    );

    expect(screen.getByRole('heading', { name: sentinelPrimer.title })).toBeInTheDocument();
    expect(screen.getByText(sentinelPrimer.tagline)).toBeInTheDocument();
    for (const section of sentinelPrimer.sections) {
      const heading = screen.getByRole('heading', { name: section.title });
      expect(heading).toBeInTheDocument();
      // Terms are scoped to their own section: some, like `namespace`, are
      // deliberately defined twice — once as a concept, once as a log field.
      const scope = heading.closest('section')!;
      for (const entry of section.entries ?? []) {
        expect(within(scope).getByText(entry.term)).toBeInTheDocument();
      }
    }
  });

  it('explains what each log source proves, and what it cannot', () => {
    render(
      <Primer primer={sentinelPrimer} roleLabel="The Sentinel" onBegin={vi.fn()} onBack={vi.fn()} />
    );

    const sources = screen.getByRole('heading', { name: /the four sources/i }).closest('section')!;
    expect(within(sources).getByText('k8s-audit')).toBeInTheDocument();
    expect(within(sources).getByText('apiserver')).toBeInTheDocument();
    expect(within(sources).getByText('edr')).toBeInTheDocument();
    expect(within(sources).getByText('ci-cd')).toBeInTheDocument();
  });

  it('gives the Infiltrator the token path and the command families', () => {
    render(
      <Primer
        primer={infiltratorPrimer}
        roleLabel="The Infiltrator"
        onBegin={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(
      screen.getByText('/var/run/secrets/kubernetes.io/serviceaccount/token')
    ).toBeInTheDocument();
    expect(screen.getByText('kubectl auth can-i --list')).toBeInTheDocument();
    expect(screen.getByText(/Reads \(get, list, describe\)/)).toBeInTheDocument();
  });

  it('reports both exits', () => {
    const onBegin = vi.fn();
    const onBack = vi.fn();
    render(
      <Primer
        primer={infiltratorPrimer}
        roleLabel="The Infiltrator"
        onBegin={onBegin}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /begin the operation/i }));
    expect(onBegin).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /change role/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
