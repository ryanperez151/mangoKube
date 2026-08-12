import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttackMap } from './AttackMap';
import type { AttackMapNode } from '@/content/types';

const nodes: AttackMapNode[] = [
  {
    id: 'root',
    label: 'Poisoned build image',
    tactic: 'Initial Access',
    summary: 'Something was already in the image.',
    lesson: 'Not every incident yields a patient zero.',
    prevention: 'Sign and verify images.',
    suspectedByFacts: ['f1'],
    confirmedByFacts: [],
    containedByFacts: [],
    x: 10,
    y: 80,
  },
  {
    id: 'exec',
    label: 'Interactive shell',
    tactic: 'Execution',
    summary: 'A shell ran in the build pod.',
    lesson: 'Build agents do not run shells.',
    prevention: 'Alert on pods/exec.',
    suspectedByFacts: ['f1'],
    confirmedByFacts: ['f1', 'f2'],
    containedByFacts: ['f3'],
    x: 40,
    y: 60,
    parentId: 'root',
  },
];

describe('AttackMap', () => {
  it('renders a node per entry', () => {
    render(<AttackMap nodes={nodes} facts={[]} />);
    expect(screen.getByTestId('map-node-root')).toBeInTheDocument();
    expect(screen.getByTestId('map-node-exec')).toBeInTheDocument();
  });

  it('starts every node undiscovered with no facts', () => {
    render(<AttackMap nodes={nodes} facts={[]} />);
    expect(screen.getByTestId('map-node-exec')).toHaveAttribute('data-state', 'undiscovered');
  });

  it('promotes a node to confirmed once its facts are collected', () => {
    render(<AttackMap nodes={nodes} facts={['f1', 'f2']} />);
    expect(screen.getByTestId('map-node-exec')).toHaveAttribute('data-state', 'confirmed');
  });

  it('marks a node contained once its containment facts land', () => {
    render(<AttackMap nodes={nodes} facts={['f1', 'f2', 'f3']} />);
    expect(screen.getByTestId('map-node-exec')).toHaveAttribute('data-state', 'contained');
  });

  it('names the state in words, not colour alone', () => {
    render(<AttackMap nodes={nodes} facts={['f1', 'f2']} />);
    expect(screen.getByTestId('map-node-exec')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('confirmed')
    );
  });

  it('hides the label of an undiscovered node', () => {
    render(<AttackMap nodes={nodes} facts={[]} />);
    expect(screen.queryByText('Interactive shell')).toBeNull();
  });

  it('reveals the label once the node is at least suspected', () => {
    render(<AttackMap nodes={nodes} facts={['f1']} />);
    expect(screen.getByText('Interactive shell')).toBeInTheDocument();
  });

  it('opens the lesson when a discovered node is clicked', () => {
    render(<AttackMap nodes={nodes} facts={['f1', 'f2']} />);
    fireEvent.click(screen.getByTestId('map-node-exec'));
    expect(screen.getByTestId('map-detail')).toHaveTextContent('Build agents do not run shells.');
    expect(screen.getByTestId('map-detail')).toHaveTextContent('Alert on pods/exec.');
  });

  it('does not open a detail for an undiscovered node', () => {
    render(<AttackMap nodes={nodes} facts={[]} />);
    fireEvent.click(screen.getByTestId('map-node-exec'));
    expect(screen.queryByTestId('map-detail')).toBeNull();
  });

  it('draws a limb between a node and its parent', () => {
    render(<AttackMap nodes={nodes} facts={[]} />);
    expect(screen.getByTestId('map-limb-exec')).toBeInTheDocument();
  });
});
