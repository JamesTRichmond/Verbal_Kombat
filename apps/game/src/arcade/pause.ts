/** P = pause: a DOM overlay with the annotated transcript so far. */

import { FALLACIES, type Genius, type Side, type TranscriptEntry } from '@vk/core';

export class TranscriptOverlay {
  private el: HTMLDivElement;

  constructor() {
    const existing = document.getElementById('vk-pause');
    this.el = (existing as HTMLDivElement | null) ?? document.createElement('div');
    this.el.id = 'vk-pause';
    this.el.hidden = true;
    if (!existing) document.body.appendChild(this.el);
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  show(title: string, entries: TranscriptEntry[], fighters: Record<Side, Genius>): void {
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
    const rows = entries
      .map((e) => {
        const v = e.verdict;
        const who = fighters[e.argument.side];
        const bad = v.fallacies.length > 0;
        const fall = v.fallacies.map((f) => FALLACIES[f]?.label ?? f).join(', ');
        const ev = e.combat
          .map((c) => {
            const lbl = c.type === 'finisher' ? 'POSITION BROKEN' : (c.label ?? '');
            return `${c.type.toUpperCase()}${c.damage ? ` −${c.damage}` : ''}${c.selfDamage ? ` (self −${c.selfDamage})` : ''}${lbl ? ` · ${esc(lbl)}` : ''}`;
          })
          .join(' / ');
        return `<li class="${bad ? 'bad' : 'ok'} side-${e.argument.side}">
          <div class="who">#${e.argument.seq} ${esc(who.name)}</div>
          <div class="said">${esc(e.argument.text)}</div>
          <div class="ann">${bad ? `FALLACY: ${esc(fall)}` : `SOUND ${v.soundness.toFixed(2)} · EVIDENCE ${v.evidence.toFixed(2)}`}${v.rebuttalForce > 0 ? ` · REBUTTAL ${v.rebuttalForce.toFixed(2)}` : ''}</div>
          <div class="ev">${ev}</div>
          <div class="why">${esc(v.rationale)}</div>
        </li>`;
      })
      .join('');
    this.el.innerHTML = `<div class="box"><h2>PAUSED — ${esc(title)}</h2>
      <p class="hint">Annotated transcript so far. P or Esc to resume.</p>
      <ol>${rows || '<li>No exchanges yet.</li>'}</ol></div>`;
    this.el.hidden = false;
    const list = this.el.querySelector('ol');
    if (list) list.scrollTop = list.scrollHeight;
  }

  hide(): void {
    this.el.hidden = true;
  }
}
