'use client';

interface DebriefPanelProps {
  narrative: string[];
  lesson: string;
  nextChapterTeaser: string;
  onRestart: () => void;
}

export function DebriefPanel({ narrative, lesson, nextChapterTeaser, onRestart }: DebriefPanelProps) {
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

      <section className="text-sm italic text-mango-500/70">{nextChapterTeaser}</section>

      <button onClick={onRestart} className="rounded bg-mango-500 px-4 py-2 font-semibold text-mango-950">
        Return to Briefing
      </button>
    </div>
  );
}
