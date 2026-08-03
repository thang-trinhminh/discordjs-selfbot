'use strict';

const assert = require('node:assert');
const { test } = require('node:test');
const { parseCaptchaError, bufferResponse } = require('../src/rest/SelfbotREST.js');
const { generateTOTP, decodeBase32 } = require('../src/util/totp.js');

// Vector thử của RFC 6238, phần SHA-1: secret ASCII "12345678901234567890".
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

test('decodeBase32 giai dung secret cua RFC 6238', () => {
  assert.strictEqual(decodeBase32(RFC_SECRET).toString('ascii'), '12345678901234567890');
});

test('decodeBase32 chiu duoc padding, dau cach va chu thuong', () => {
  assert.strictEqual(decodeBase32('gezd gnbv gy3t qojq====').toString('ascii'), '1234567890');
});

test('decodeBase32 tu choi ky tu ngoai bang chu', () => {
  assert.throws(() => decodeBase32('ABC1'), /Invalid base32 character/);
});

test('generateTOTP khop bo vector thu cua RFC 6238', () => {
  // RFC in mã 8 chữ số; mã 6 chữ số là 6 chữ số cuối của chúng.
  const vectors = [
    [59, '287082'],
    [1_111_111_109, '081804'],
    [1_111_111_111, '050471'],
    [1_234_567_890, '005924'],
    [2_000_000_000, '279037'],
    [20_000_000_000, '353130'],
  ];

  for (const [seconds, expected] of vectors) {
    assert.strictEqual(generateTOTP(RFC_SECRET, { timestamp: seconds * 1000 }), expected, `T=${seconds}`);
  }
});

test('generateTOTP ho tro 8 chu so', () => {
  assert.strictEqual(generateTOTP(RFC_SECRET, { timestamp: 59_000, digits: 8 }), '94287082');
});

test('generateTOTP dem so 0 cho du do dai', () => {
  const code = generateTOTP(RFC_SECRET, { timestamp: 1_111_111_109_000 });
  assert.strictEqual(code.length, 6);
  assert.strictEqual(code, '081804');
});

test('ma khong doi trong cung mot buoc 30 giay, doi khi sang buoc moi', () => {
  const inStep = generateTOTP(RFC_SECRET, { timestamp: 60_000 });
  const sameStep = generateTOTP(RFC_SECRET, { timestamp: 89_000 });
  const nextStep = generateTOTP(RFC_SECRET, { timestamp: 90_000 });

  assert.strictEqual(inStep, sameStep);
  assert.notStrictEqual(inStep, nextStep);
});

test('parseCaptchaError nhan ra loi captcha', () => {
  const captcha = parseCaptchaError(
    JSON.stringify({ captcha_key: ['captcha-required'], captcha_sitekey: 'abc', captcha_service: 'hcaptcha' }),
  );
  assert.strictEqual(captcha.captcha_sitekey, 'abc');
});

test('parseCaptchaError tra null cho loi thuong va body khong phai JSON', () => {
  assert.strictEqual(parseCaptchaError(JSON.stringify({ code: 50035, message: 'Invalid Form Body' })), null);
  assert.strictEqual(parseCaptchaError('<html>502</html>'), null);
});

test('bufferResponse cho doc body nhieu lan', async () => {
  let reads = 0;
  const original = {
    status: 400,
    statusText: 'Bad Request',
    ok: false,
    headers: new Headers(),
    text: async () => {
      reads += 1;
      return '{"a":1}';
    },
  };

  const buffered = await bufferResponse(original);

  assert.strictEqual(await buffered.text(), '{"a":1}');
  assert.deepStrictEqual(await buffered.json(), { a: 1 });
  // Body gốc chỉ được đọc đúng một lần.
  assert.strictEqual(reads, 1);
  assert.strictEqual(buffered.status, 400);
});

// Bọc `createSelfbotREST` để test vòng retry mà không chạm mạng: thay
// `rest.options.makeRequest` không được vì vòng lặp nằm bên trong chính nó, nên
// giả lập ở tầng dưới bằng cách gọi trực tiếp.
function makeCaptchaBody(rqtoken) {
  return JSON.stringify({
    captcha_key: ['captcha-required'],
    captcha_sitekey: 'sitekey',
    captcha_service: 'hcaptcha',
    ...(rqtoken ? { captcha_rqtoken: rqtoken } : {}),
  });
}

test('retry captcha gan header va dung khi thanh cong', async t => {
  const { createSelfbotREST } = require('../src/rest/SelfbotREST.js');
  const Options = require('../src/util/Options.js');
  const { DefaultRestOptions } = require('@discordjs/rest');

  const sent = [];
  const original = DefaultRestOptions.makeRequest;
  t.after(() => {
    DefaultRestOptions.makeRequest = original;
  });

  DefaultRestOptions.makeRequest = async (url, init) => {
    sent.push(init.headers);
    if (sent.length === 1) {
      return {
        status: 400,
        statusText: 'Bad Request',
        ok: false,
        headers: new Headers(),
        text: async () => makeCaptchaBody('rq1'),
      };
    }
    return { status: 200, statusText: 'OK', ok: true, headers: new Headers(), text: async () => '{}' };
  };

  const options = { ...Options.createDefault(), captchaSolver: async () => 'da-giai' };
  const rest = createSelfbotREST(options);
  const response = await rest.options.makeRequest('https://discord.com/api/v10/users/@me', { headers: {} });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(sent.length, 2);
  assert.strictEqual(sent[1]['x-captcha-key'], 'da-giai');
  assert.strictEqual(sent[1]['x-captcha-rqtoken'], 'rq1');
});

test('retry captcha dung lai o captchaRetryLimit', async t => {
  const { createSelfbotREST } = require('../src/rest/SelfbotREST.js');
  const Options = require('../src/util/Options.js');
  const { DefaultRestOptions } = require('@discordjs/rest');

  let calls = 0;
  const original = DefaultRestOptions.makeRequest;
  t.after(() => {
    DefaultRestOptions.makeRequest = original;
  });

  DefaultRestOptions.makeRequest = async () => {
    calls += 1;
    return {
      status: 400,
      statusText: 'Bad Request',
      ok: false,
      headers: new Headers(),
      text: async () => makeCaptchaBody(),
    };
  };

  const options = { ...Options.createDefault(), captchaRetryLimit: 2, captchaSolver: async () => 'x' };
  const rest = createSelfbotREST(options);
  const response = await rest.options.makeRequest('https://discord.com/api/v10/users/@me', { headers: {} });

  // Một lần đầu + đúng captchaRetryLimit lần thử lại.
  assert.strictEqual(calls, 3);
  assert.strictEqual(response.status, 400);
});

test('khong co captchaSolver thi tra thang loi 400', async t => {
  const { createSelfbotREST } = require('../src/rest/SelfbotREST.js');
  const Options = require('../src/util/Options.js');
  const { DefaultRestOptions } = require('@discordjs/rest');

  let calls = 0;
  const original = DefaultRestOptions.makeRequest;
  t.after(() => {
    DefaultRestOptions.makeRequest = original;
  });

  DefaultRestOptions.makeRequest = async () => {
    calls += 1;
    return {
      status: 400,
      statusText: 'Bad Request',
      ok: false,
      headers: new Headers(),
      text: async () => makeCaptchaBody(),
    };
  };

  const rest = createSelfbotREST(Options.createDefault());
  const response = await rest.options.makeRequest('https://discord.com/api/v10/users/@me', { headers: {} });

  assert.strictEqual(calls, 1);
  assert.strictEqual(response.status, 400);
});

test('loi 400 khong phai captcha thi khong goi solver', async t => {
  const { createSelfbotREST } = require('../src/rest/SelfbotREST.js');
  const Options = require('../src/util/Options.js');
  const { DefaultRestOptions } = require('@discordjs/rest');

  let solverCalls = 0;
  const original = DefaultRestOptions.makeRequest;
  t.after(() => {
    DefaultRestOptions.makeRequest = original;
  });

  DefaultRestOptions.makeRequest = async () => ({
    status: 400,
    statusText: 'Bad Request',
    ok: false,
    headers: new Headers(),
    text: async () => JSON.stringify({ code: 50035, message: 'Invalid Form Body' }),
  });

  const options = {
    ...Options.createDefault(),
    captchaSolver: async () => {
      solverCalls += 1;
      return 'x';
    },
  };
  const rest = createSelfbotREST(options);
  const response = await rest.options.makeRequest('https://discord.com/api/v10/users/@me', { headers: {} });

  assert.strictEqual(solverCalls, 0);
  // Body vẫn đọc được sau khi shim đã soi qua.
  assert.deepStrictEqual(await response.json(), { code: 50035, message: 'Invalid Form Body' });
});
