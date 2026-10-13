import test from 'node:test';
import assert from 'node:assert/strict';
import { checkD02AnonymousSourceRequest } from '../../scripts/lib/d02-source-fence.mjs';

const allowedRequest = {
  url: new URL('https://api.bgm.tv/v0/search/subjects?limit=8&offset=0'),
  method: 'POST',
  authorizationHeaderPresent: false,
  body: { keyword: '末世 旅行', sort: 'match', filter: { type: [2], nsfw: false } },
  requestCount: 1,
};

test('D02 allows exactly the anonymous bounded official-v0 search request', () => {
  assert.deepEqual(checkD02AnonymousSourceRequest(allowedRequest), {
    allowed: true,
    reasonCode: 'ALLOWLISTED_ANONYMOUS_PUBLIC_SEARCH',
  });
});

test('D02 source fence rejects bearer, extra calls, changed filters, and other endpoints', () => {
  assert.equal(checkD02AnonymousSourceRequest({
    ...allowedRequest,
    authorizationHeaderPresent: true,
  }).reasonCode, 'AUTHORIZATION_HEADER_PROHIBITED');
  assert.equal(checkD02AnonymousSourceRequest({
    ...allowedRequest,
    requestCount: 2,
  }).reasonCode, 'SOURCE_REQUEST_LIMIT_REACHED');
  assert.equal(checkD02AnonymousSourceRequest({
    ...allowedRequest,
    body: { ...allowedRequest.body, filter: { type: [2], nsfw: false, tag: ['末世'] } },
  }).reasonCode, 'SOURCE_REQUEST_PROFILE_MISMATCH');
  assert.equal(checkD02AnonymousSourceRequest({
    ...allowedRequest,
    url: new URL('https://api.bgm.tv/v0/users/me'),
  }).reasonCode, 'SOURCE_OPERATION_NOT_ALLOWLISTED');
});

test('D02 source fence rejects extra query parameters and non-anime searches', () => {
  assert.equal(checkD02AnonymousSourceRequest({
    ...allowedRequest,
    url: new URL('https://api.bgm.tv/v0/search/subjects?limit=8'),
  }).reasonCode, 'SOURCE_REQUEST_PROFILE_MISMATCH');
  assert.equal(checkD02AnonymousSourceRequest({
    ...allowedRequest,
    url: new URL('https://api.bgm.tv/v0/search/subjects?limit=8&offset=0&page=1'),
  }).reasonCode, 'SOURCE_REQUEST_PROFILE_MISMATCH');
  assert.equal(checkD02AnonymousSourceRequest({
    ...allowedRequest,
    body: { ...allowedRequest.body, filter: { type: [1], nsfw: false } },
  }).reasonCode, 'SOURCE_REQUEST_PROFILE_MISMATCH');
});
