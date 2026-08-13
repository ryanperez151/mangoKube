import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { chapter1Campaigns } from '@/content/chapter1';
import { DebriefPanel } from './DebriefPanel';

describe('DebriefPanel', () => {
  it('renders conditional narrative, decision consequence, findings, lesson, and teaser', () => {
    const campaign = chapter1Campaigns.infiltrator;
    render(
      <DebriefPanel
        campaign={campaign}
        decisions={{ 'operational-order': 'exfil-first' }}
        collectedFacts={['found-implant-pod', 'exfiltrated-ip']}
        clusterStatus="compromised"
        onReplay={() => {}}
        onOtherRole={() => {}}
      />
    );

    expect(screen.getByText(/genome in Citrus Dynamics.*before securing/i)).toBeInTheDocument();
    expect(screen.getByText('Exfiltrate first')).toBeInTheDocument();
    expect(screen.getByText('Implant pod located')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /transferable kubernetes lesson/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /next chapter/i })).toBeInTheDocument();
  });

  it('shows Sentinel detection guidance and invokes both role actions', () => {
    const onReplay = vi.fn();
    const onOtherRole = vi.fn();
    render(
      <DebriefPanel
        campaign={chapter1Campaigns.sentinel}
        decisions={{ 'containment-timing': 'contain-now' }}
        collectedFacts={Object.keys(chapter1Campaigns.sentinel.factLibrary)}
        clusterStatus="contained"
        onReplay={onReplay}
        onOtherRole={onOtherRole}
      />
    );

    expect(screen.getByTestId('debrief-detection')).toHaveTextContent('Alert on create pods/exec');
    fireEvent.click(screen.getByRole('button', { name: 'Replay This Role' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play the Other Role' }));
    expect(onReplay).toHaveBeenCalledOnce();
    expect(onOtherRole).toHaveBeenCalledOnce();
  });
});
