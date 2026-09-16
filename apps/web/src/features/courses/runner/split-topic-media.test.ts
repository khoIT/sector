import { describe, expect, it } from 'vitest';

import { hasReadableBody, splitTopicMedia } from './split-topic-media';

describe('splitTopicMedia', () => {
  it('lifts the player out and leaves the prose behind', () => {
    const html =
      '<p>Before</p><iframe src="https://player.vimeo.com/video/1"></iframe><p>After</p>';
    const { media, body } = splitTopicMedia(html);
    expect(media).toBe('<iframe src="https://player.vimeo.com/video/1"></iframe>');
    expect(body).toBe('<p>Before</p><p>After</p>');
  });

  it('leaves a text-only topic whole', () => {
    const { media, body } = splitTopicMedia('<p>Only words</p>');
    expect(media).toBeNull();
    expect(body).toBe('<p>Only words</p>');
  });

  it('moves only the first embed, because a second one is inline in the prose', () => {
    const html = '<iframe src="a"></iframe><p>mid</p><iframe src="b"></iframe>';
    const { media, body } = splitTopicMedia(html);
    expect(media).toBe('<iframe src="a"></iframe>');
    expect(body).toBe('<p>mid</p><iframe src="b"></iframe>');
  });

  it('survives an absent or empty content field', () => {
    expect(splitTopicMedia(null)).toEqual({ media: null, body: '' });
    expect(splitTopicMedia(undefined)).toEqual({ media: null, body: '' });
  });

  it('treats markup with no words as nothing to read', () => {
    expect(hasReadableBody('<p></p>')).toBe(false);
    expect(hasReadableBody('<p>&nbsp;</p>')).toBe(false);
    expect(hasReadableBody('<p>Real</p>')).toBe(true);
  });
});
