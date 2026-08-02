'use strict';

const { REST, DefaultRestOptions } = require('@discordjs/rest');
const { Agent, ProxyAgent, buildConnector } = require('undici');
const {
  DefaultUserAgent,
  DefaultSuperProperties,
  DefaultCiphers,
  encodeSuperProperties,
} = require('../util/SelfbotDefaults');

/**
 * Header tĩnh mà Discord web client luôn gửi. Thiếu bộ này thì request
 * lộ ra là không phải browser.
 * @param {Object} clientOptions Options của client
 * @returns {Object<string, string>}
 */
function buildSelfbotHeaders(clientOptions) {
  // Fallback vì user có thể truyền `ws` partial.
  const properties = clientOptions.ws?.properties ?? DefaultSuperProperties;
  const userAgent = properties.browser_user_agent ?? DefaultUserAgent;

  return {
    accept: '*/*',
    'accept-language': 'en-US',
    origin: 'https://discord.com',
    priority: 'u=1, i',
    referer: 'https://discord.com/channels/@me',
    'sec-ch-ua': '"Not:A-Brand";v="24", "Chromium";v="134"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': userAgent,
    'x-debug-options': 'bugReporterEnabled',
    'x-discord-locale': 'en-US',
    'x-discord-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    'x-super-properties': encodeSuperProperties(properties),
    ...clientOptions.http?.headers,
  };
}

/**
 * `@discordjs/rest` luôn ghép `${authPrefix} ${token}` vào header Authorization.
 * User token gửi trần, không prefix. Sửa tại chỗ trước khi request đi.
 * @param {Object} headers Header của request
 * @param {string} token Token trần
 * @returns {Object} chính object headers đã sửa
 */
function rewriteAuthorization(headers, token) {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'authorization') headers[key] = token;
  }
  return headers;
}

/**
 * `@discordjs/ws` gọi `GET /gateway/bot` để lấy gateway URL và session limit.
 * User token bị 401 ở route đó, nên trả response tự dựng thay vì gọi mạng.
 * Shape phải khớp `RESTGetAPIGatewayBotResult`.
 * @returns {Object} object giống Response đủ cho @discordjs/rest parse
 */
function makeGatewayBotResponse() {
  const body = JSON.stringify({
    url: 'wss://gateway.discord.gg',
    shards: 1,
    session_start_limit: {
      total: 1000,
      remaining: 1000,
      reset_after: 0,
      max_concurrency: 1,
    },
  });

  // Shape phải khớp `ResponseLike` của @discordjs/rest
  // (packages/rest/src/strategies/undiciRequest.ts).
  return {
    body: null,
    bodyUsed: false,
    status: 200,
    statusText: 'OK',
    ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => JSON.parse(body),
    text: async () => body,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  };
}

/**
 * Dispatcher undici có TLS fingerprint giống Chrome, hoặc proxy nếu được cấu hình.
 * @param {Object} clientOptions Options của client
 * @returns {Dispatcher}
 */
function buildDispatcher(clientOptions) {
  const proxy = clientOptions.http?.agent;
  const ciphers = DefaultCiphers.join(':');

  if (proxy) {
    return new ProxyAgent({ ...(typeof proxy === 'string' ? { uri: proxy } : proxy), ciphers });
  }

  // Agent chứ không phải Client: Client chỉ phục vụ một origin, Agent dùng
  // được cho mọi host mà REST có thể chạm tới.
  return new Agent({ connect: buildConnector({ ciphers }) });
}

/**
 * Tạo instance REST đã gắn shim selfbot.
 * @param {Object} clientOptions Options của client (đã merge default)
 * @returns {REST}
 */
function createSelfbotREST(clientOptions) {
  const dispatcher = buildDispatcher(clientOptions);
  // Token phải lấy tại thời điểm request, không phải lúc tạo REST.
  let token = null;

  const rest = new REST({
    ...clientOptions.rest,
    headers: buildSelfbotHeaders(clientOptions),
    makeRequest: async (url, init) => {
      if (new URL(url).pathname.endsWith('/gateway/bot')) {
        return makeGatewayBotResponse();
      }
      if (token) rewriteAuthorization(init.headers, token);
      return DefaultRestOptions.makeRequest(url, { ...init, dispatcher });
    },
  });

  const originalSetToken = rest.setToken.bind(rest);
  rest.setToken = value => {
    token = value;
    return originalSetToken(value);
  };

  return rest;
}

module.exports = {
  createSelfbotREST,
  buildSelfbotHeaders,
  rewriteAuthorization,
  buildDispatcher,
  makeGatewayBotResponse,
};
