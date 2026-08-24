import { describe, it, expect } from 'vitest';
import { decideDeploy } from './decide.js';

describe('decideDeploy', () => {
  it('triggers when the post was deleted', () => {
    const d = decideDeploy('published', undefined, true);
    expect(d.trigger).toBe(true);
    expect(d.reason).toContain('Post deleted');
  });

  it('skips when the post is a draft and stayed a draft', () => {
    expect(decideDeploy('draft', 'draft', false).trigger).toBe(false);
  });

  it('skips when a brand-new post is created as a draft', () => {
    expect(decideDeploy(undefined, 'draft', false).trigger).toBe(false);
  });

  it('triggers when a live post moves back to draft', () => {
    const d = decideDeploy('published', 'draft', false);
    expect(d.trigger).toBe(true);
    expect(d.reason).toContain('moved to draft');
  });

  it('treats unlisted as live when un-drafting', () => {
    const toUnlisted = decideDeploy(undefined, 'unlisted', false);
    expect(toUnlisted.trigger).toBe(true);
    expect(toUnlisted.reason).toContain('"unlisted"');

    const draftToPublished = decideDeploy('draft', 'published', false);
    expect(draftToPublished.trigger).toBe(true);
    expect(draftToPublished.reason).toContain('"published"');
  });

  it('treats unlisted as live when staying live (no removal deploy)', () => {
    const d = decideDeploy('unlisted', 'published', false);
    expect(d.trigger).toBe(true);
    // Still triggers (status changed) but reason reflects live status, not draft removal
    expect(d.reason).not.toContain('remove from site');
  });
});
