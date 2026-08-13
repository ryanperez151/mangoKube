import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SceneShell } from './Cinematic';

function setMotionPreference(reduced: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query === '(prefers-reduced-motion: reduce)' ? reduced : true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as MediaQueryList
  );
}

afterEach(() => vi.restoreAllMocks());

describe('SceneShell initial motion preference', () => {
  it('renders the entrance class on the initial full-motion render', () => {
    setMotionPreference(false);

    const html = renderToString(
      <SceneShell label="Test scene" eyebrow="Test" title="Full motion">
        Content
      </SceneShell>
    );

    expect(html).toContain('data-motion="full"');
    expect(html).toContain('scene-enter');
  });

  it('omits the entrance class on the initial reduced-motion render', () => {
    setMotionPreference(true);

    const html = renderToString(
      <SceneShell label="Test scene" eyebrow="Test" title="Reduced motion">
        Content
      </SceneShell>
    );

    expect(html).toContain('data-motion="reduced"');
    expect(html).not.toContain('scene-enter');
  });
});
