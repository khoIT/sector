/**
 * Real bodies pulled from `gusi_prod_mirror`, trimmed to the fragment that
 * matters and with nothing personally identifying in any of them (these are
 * lesson/topic/question CONTENT — clinical teaching material, not learner or
 * patient data). Each one was found with the query in its comment, run
 * against the local mirror described in README.md.
 *
 * sanitize-rich-text.test.ts asserts what each fixture loses and keeps, so a
 * future change to the allow-list has to look one of these real bodies in the
 * eye rather than a hand-written string that only looks like production.
 */

/** db.v2topics.find({content:/<iframe/i}).limit(1) — a Vimeo embed glued to a
 *  <script> tag, the exact pattern the legacy 677-line repair pass existed
 *  to work around. */
export const VIMEO_IFRAME_WITH_SCRIPT = `<div style="padding: 56.25% 0 0 0; position: relative;"><iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" title="US Guided Injections SF.mp4" src="https://player.vimeo.com/video/698028055?h=1dbffba934&amp;badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479" frameborder="0" allowfullscreen="allowfullscreen"></iframe></div>
<p><script src="https://player.vimeo.com/api/player.js"></script></p>
<p>&nbsp;</p>
<p class="p1"><b>Introduction to US Guided Injections</b></p>
<p class="p3"><b>Scanning Technique</b></p>
<ul>
	<li class="p4">- Set up:<span class="Apple-converted-space">  </span>Needle, probe, screen all in line for ease of procedure and view</li>
	<li class="p4">- Anchor probe hand for better control</li>
</ul>`;

/** db.v2lessons.find({content:/<iframe/i}).limit(1) — a YouTube embed inside
 *  a WordPress block comment, the shortest real reproduction of the WP
 *  block-comment noise that surrounds a lot of migrated video content. */
export const YOUTUBE_IFRAME_IN_WP_BLOCK_COMMENT = `<!-- wp:html -->
<iframe width="560" height="315" src="https://www.youtube.com/embed/OvO-VmZ-KIA" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen=""></iframe>
<!-- /wp:html -->

<ol>
<li><span style="font-size: 12pt;">Hover over the '<strong>Estimates</strong>' menu link.</span></li>
</ol>`;

/** db.v2lessons.find({content:/\\[\\w+[^\\]]*\\]/}).limit(1) — a WordPress
 *  quiz-plugin shortcode left over from the migration. It was never a tag,
 *  so a sanitiser has nothing to remove; it survives as the literal bracketed
 *  text an author would still recognise. */
export const WORDPRESS_SHORTCODE_REMNANT = '[LDAdvQuiz 47]';

/** db.v2lessons.find({content:/<table[\\s\\S]*<table/i}).limit(1) trimmed —
 *  an inline-styled image inside an inline-styled table cell, linking back
 *  into the app with a relative href. Proves nested tables survive AND that
 *  the internal link is not forced into a new tab. */
export const STYLED_TABLE_WITH_INTERNAL_LINK = `<p>Learn the fundamentals before the obstetric applications.</p>
<table style="width: 100%;">
<tbody>
<tr style="height: auto;">
<td style="width: 33.3333%; height: auto;"><a href=" /dashboard/my-courses/681a4b98779a0d9e6c9cc67d/lessons/681a4dafacc6f28eaec5e397/topics/681a4f9b82414b2fcc5affce"> <img style="width: 100%; height: auto;" src="https://legacywp-content.s3.ap-southeast-1.amazonaws.com/wp-content/uploads/2022/12/Screenshot-300x169.png" alt="OB POCUS Essentials" /> </a></td>
</tr>
</tbody>
</table>`;

/** db.v2questions.find({content:/onclick|style=/i}).limit(1) shape — a Word
 *  paste's inline font-weight span, the ordinary case (no attack, just noise
 *  a decade of copy-paste left behind) that the allow-list has to tolerate
 *  without keeping the `style` attribute. */
export const QUESTION_BODY_WITH_INLINE_STYLE_SPAN =
  '<span style="font-weight: 400;">What is the best orientation to measure a AAA?</span>';

/** db.v2questions.find({"answers.title":/<iframe/i}).limit(1) — a question
 *  answer whose entire `title` IS a video embed, the shape that makes
 *  `allowHtml` on an answer meaningful and proves the same rich-text policy
 *  has to run over answer bodies too, not just question/lesson content. */
export const ANSWER_TITLE_IS_AN_IFRAME =
  '<iframe width="560" height="315" src="https://www.youtube.com/embed/CHImlpUxg9w" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>';

/**
 * Hand-built (not pulled from the mirror) — the mirror holds no
 * `onclick=`/`javascript:` attack in this content family, but the sanitiser
 * still has to be proved against one directly: an inline event handler and a
 * `javascript:` link riding along in otherwise ordinary markup.
 */
export const HAND_BUILT_EVENT_HANDLER_AND_JAVASCRIPT_URL = `<p onclick="alert('x')">Tap here</p>
<a href="javascript:alert('x')">click</a>
<a href="https://gusi.org/safe">safe external link</a>`;

/** Hand-built — an http (not https) image next to an https one, proving the
 *  https-only rule removes exactly the insecure element. */
export const MIXED_HTTP_AND_HTTPS_IMAGES = `<img src="http://example.com/insecure.png" alt="insecure" />
<img src="https://example.com/secure.png" alt="secure" />`;

/** db.v2topics.find({content:/esono\.online/i}).limit(1) — GUSI's own scan
 *  viewer, embedded as an iframe. The second most common embed host in the
 *  mirror after Vimeo (620 occurrences) and, unlike Vimeo, on GUSI's own
 *  content — still cross-origin to the app itself (a different domain),
 *  which is what keeps the sandbox's allow-same-origin safe. */
export const ESONO_CATALOG_IFRAME_EMBED =
  '<p><iframe style="position: relative; height: 600px; width: 100%; padding: 0px; margin: 0px;" src="https://esono.online/gusi-catalog/S10eAGNJRQlYORQeCUI+DRc=" frameborder="0"></iframe></p>';

/** db.v2questions.find({content:/<video/i}).limit(1) — one of the 94
 *  published question-bank questions that ask the learner about an embedded
 *  clip ("The following image suggests:") using a native `<video>`/`<source>`
 *  rather than an iframe player. Stripping this element blindly leaves the
 *  stem unanswerable while the server still grades it — the exact defect
 *  this policy exists to not repeat. */
export const QUESTION_WITH_NATIVE_VIDEO_CLIP =
  '<p><span style="font-size: 12pt;">A 75 year old male with long standing history of smoking is seen in your clinic. The curvilinear probe is placed in the transverse plane in the abdominal midline above the umbilicus. The following image suggests:</span></p>\n' +
  '<p><video controls="controls" width="720" height="540">\n' +
  '  <source src="https://legacywp-content.s3.ap-southeast-1.amazonaws.com/wp-content/uploads/2024/01/AAA_with_Thrombus1__Short_Axis__normalized.mp4" type="video/mp4">\n' +
  '  Your browser does not support the video tag.</video></p>';

/**
 * Hand-built — the mirror's iframes only ever come from the three measured
 * hosts (player.vimeo.com, esono.online, www.youtube.com), so an iframe from
 * anywhere else has to be proved against a fabricated example: the
 * allow-list is what makes this the ONE fixture that must still lose its
 * iframe entirely, everything else having just been allowed back in.
 */
export const IFRAME_FROM_AN_UNLISTED_HOST =
  '<p>Before</p><iframe src="https://evil.example.com/widget"></iframe><p>After</p>';

/** Hand-built — an http embed on an otherwise-allowed host, proving the
 *  allow-list is host-AND-scheme, not host alone. */
export const IFRAME_ON_ALLOWED_HOST_BUT_HTTP =
  '<iframe src="http://player.vimeo.com/video/1"></iframe>';
