import type { Prompt } from '../types/handwriting'

export function PromptDisplay({ prompt }: { prompt: Prompt }) {
  return <section className="prompt-display" aria-live="polite">
    <div className="eyebrow">Write the {prompt.type === 'glyph' ? 'symbol' : 'expression'}</div>
    <div className={`target ${prompt.type}`} data-testid="target">{prompt.label}</div>
    <p>Your natural handwriting. One sample at a time.</p>
  </section>
}
