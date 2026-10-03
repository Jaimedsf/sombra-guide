// "Copiar link" / "Compartilhar": share sheet on phones, clipboard otherwise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareLink } from '../src/share.js';

const URL = 'https://jaimedsf.github.io/sombra-guide/?data=2026-12-21&hora=16:30#17/-3.72/-38.5/-25/60';
const named = (name) => Object.assign(new Error(name), { name });
function spies({ share = async () => {}, copy = async () => {} } = {}) {
  const calls = { share: [], copy: [] };
  return {
    calls,
    share: async (data) => { calls.share.push(data); return share(data); },
    copy: async (text) => { calls.copy.push(text); return copy(text); },
  };
}

test('phones share the link and do not also copy it', async () => {
  const s = spies();
  assert.equal(await shareLink(URL, s), 'shared');
  assert.deepEqual(s.calls.share, [{ title: 'Sombra Guide', url: URL }]);
  assert.deepEqual(s.calls.copy, []);
});

test('closing the share sheet is not an error and copies nothing', async () => {
  const s = spies({ share: async () => { throw named('AbortError'); } });
  assert.equal(await shareLink(URL, s), 'cancelled');
  assert.deepEqual(s.calls.copy, []);
});

test('if the share sheet cannot open, the link is copied instead', async () => {
  const s = spies({ share: async () => { throw named('NotAllowedError'); } });
  assert.equal(await shareLink(URL, s), 'copied');
  assert.deepEqual(s.calls.copy, [URL]);
});

test('without a share sheet the link is copied', async () => {
  const s = spies();
  assert.equal(await shareLink(URL, { share: null, copy: s.copy }), 'copied');
  assert.deepEqual(s.calls.copy, [URL]);
});

test('a clipboard that refuses reports failure', async () => {
  const s = spies({ copy: async () => { throw named('NotAllowedError'); } });
  assert.equal(await shareLink(URL, { share: null, copy: s.copy }), 'failed');
});
