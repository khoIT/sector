import { describe, expect, it } from 'vitest';

import { MEDIA_PROXY_PATH, isProxyableMediaUrl, proxiedMediaUrl } from './media-proxy-url';

const SIGNED =
  'https://d2i5h4x9hhv8tx.cloudfront.net/storage/scan/a b.mp4' +
  '?Expires=1773000000&Signature=Ab~cD_e-f&Key-Pair-Id=APKAEXAMPLE';

describe('which URLs the media proxy will fetch', () => {
  it('accepts the signed CloudFront URLs scan media actually uses', () => {
    expect(isProxyableMediaUrl(SIGNED)).toBe(true);
  });

  it('accepts S3, which is the same bytes by another route', () => {
    expect(isProxyableMediaUrl('https://a-bucket.s3.us-east-1.amazonaws.com/k.jpg')).toBe(true);
  });

  it.each([
    ['http://d2i5h4x9hhv8tx.cloudfront.net/k.mp4', 'plaintext http'],
    ['https://localhost:5001/api/scan', 'the developer machine'],
    ['https://169.254.169.254/latest/meta-data/', 'the cloud metadata endpoint'],
    ['https://cloudfront.net.evil.example/k.mp4', 'a host merely containing the suffix'],
    ['file:///etc/passwd', 'a local file'],
  ])('refuses %s (%s)', (url) => {
    // The dev server would otherwise proxy anything a URL could name.
    expect(isProxyableMediaUrl(url)).toBe(false);
  });

  it('refuses a relative URL, which is already same-origin', () => {
    expect(isProxyableMediaUrl('/media/x.mp4')).toBe(false);
  });
});

describe('rewriting a media URL onto the dev server', () => {
  it('carries the whole upstream URL in one encoded parameter', () => {
    // The CloudFront signature covers the query string, so the URL travels
    // whole and encoded rather than being spliced into the proxy path.
    const rewritten = proxiedMediaUrl(SIGNED);

    expect(rewritten.startsWith(`${MEDIA_PROXY_PATH}?url=`)).toBe(true);

    const carried = new URL(rewritten, 'http://localhost:3100').searchParams.get('url');
    expect(carried).toBe(SIGNED);
  });

  it('leaves a URL it cannot proxy exactly as it found it', () => {
    expect(proxiedMediaUrl('https://example.com/k.mp4')).toBe('https://example.com/k.mp4');
  });
});
