import { describe, expect, it } from 'vitest';

import { hasSubstantiveProse, proseLength } from './lesson-body';

/**
 * The bodies quoted here are shortened copies of real lesson content from the
 * production mirror — one of each population the threshold separates.
 */

const NAV_TABLE = `<table><tbody>
  <tr><td><a href="https://scanhub.upscan.com/dashboard/topic/probes">Probes and Mechanics</a></td></tr>
  <tr><td><a href="https://scanhub.upscan.com/dashboard/topic/knobology">Knobology and Image Optimization</a></td></tr>
  <tr><td><a href="https://scanhub.upscan.com/dashboard/topic/artifacts">Artifacts and Pitfalls</a></td></tr>
</tbody></table>`;

const TEACHING_BODY = `<p>Ultrasound Basics: Scanning Technique</p>
  <p>Probe Types. Curvilinear (Abdominal): low frequency, deep penetration.
  Linear (Vascular): high frequency, shallow structures. Phased array (Cardiac):
  small footprint for scanning between the ribs.</p>`;

describe('proseLength', () => {
  it('does not count the text inside links', () => {
    // Three link labels of real length, and nothing else on the page.
    expect(proseLength(NAV_TABLE)).toBeLessThan(10);
  });

  it('counts the words a learner actually reads', () => {
    expect(proseLength(TEACHING_BODY)).toBeGreaterThan(200);
  });

  it('treats a missing body as empty rather than throwing', () => {
    expect(proseLength(null)).toBe(0);
    expect(proseLength(undefined)).toBe(0);
    expect(proseLength('')).toBe(0);
  });

  it('does not count markup or non-breaking space padding', () => {
    expect(proseLength('<p>&nbsp;&nbsp;</p><div><br/></div>')).toBe(0);
  });
});

describe('hasSubstantiveProse', () => {
  it('suppresses a body that is only a table of links', () => {
    expect(hasSubstantiveProse(NAV_TABLE)).toBe(false);
  });

  it('keeps a body that teaches something', () => {
    expect(hasSubstantiveProse(TEACHING_BODY)).toBe(true);
  });

  it('suppresses the 164 lessons whose body is empty', () => {
    expect(hasSubstantiveProse('')).toBe(false);
    expect(hasSubstantiveProse(null)).toBe(false);
  });

  it('keeps a short intro that still says something', () => {
    // A real one: "This is lesson 2. Watch this video and then watch more in
    // depth videos in the topic areas." — 90 chars of prose, under the bar.
    // The one just above it is kept.
    const intro =
      '<p>Musculoskeletal Essentials Overview. The MSK Essentials series offers a comprehensive ' +
      'collection of ultrasound videos, including diagnostic and pathology scans.</p>';
    expect(hasSubstantiveProse(intro)).toBe(true);
  });
});
