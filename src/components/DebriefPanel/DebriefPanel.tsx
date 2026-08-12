'use client';

interface DebriefPanelProps {
  narrative: string[];
  lesson: string;
  detection?: string[];
  nextChapterTeaser: string;
  onRestart: () => void;
}

export function DebriefPanel({
  narrative,
  lesson,
  detection,
  nextChapterTeaser,
  onRestart,
}: DebriefPanelProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <section data-testid="debrief-narrative" className="space-y-2">
        {narrative.map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </section>

      <section className="rounded-lg border border-mango-500/40 p-4">
        <h3 className="mb-2 font-bold text-mango-500">Real-World Lesson</h3>
        <p>{lesson}</p>
      </section>

      {detection && detection.length > 0 && (
        <section data-testid="debrief-detection" className="rounded-lg border border-leaf-500/40 p-4">
          <h3 className="mb-2 font-bold text-leaf-300">How You Would Catch This</h3>
          <ul className="space-y-2 text-sm">
            {detection.map((rule, index) => (
              <li key={index} className="border-l-2 border-leaf-500/50 pl-3">
                {rule}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="text-sm italic text-mango-500/70">{nextChapterTeaser}</section>

      <button
        onClick={onRestart}
        className="rounded bg-mango-500 px-4 py-2 font-semibold text-mango-950"
      >
        Return to Briefing
      </button>
    </div>
  );
}
