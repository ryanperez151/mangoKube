import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClusterDiagram } from './ClusterDiagram';

describe('ClusterDiagram', () => {
  it('marks highlighted nodes', () => {
    render(<ClusterDiagram highlightedNodeIds={['ci-deploy-bot']} revealedEdgeIds={[]} status="suspicious" />);
    expect(screen.getByTestId('node-ci-deploy-bot').getAttribute('data-highlighted')).toBe('true');
    expect(screen.getByTestId('node-log-rotator').getAttribute('data-highlighted')).toBe('false');
  });

  it('renders only revealed edges', () => {
    render(
      <ClusterDiagram
        highlightedNodeIds={[]}
        revealedEdgeIds={['ci-deploy-bot-to-clusteradmin']}
        status="suspicious"
      />
    );
    expect(screen.getByTestId('edge-ci-deploy-bot-to-clusteradmin')).toBeInTheDocument();
    expect(screen.queryByTestId('edge-log-rotator-to-clusteradmin')).not.toBeInTheDocument();
  });

  it('reflects cluster status on the border', () => {
    render(<ClusterDiagram highlightedNodeIds={[]} revealedEdgeIds={[]} status="compromised" />);
    expect(screen.getByTestId('cluster-status-border').getAttribute('data-status')).toBe('compromised');
  });
});
