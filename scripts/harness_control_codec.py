"""Read legacy/plain and losslessly archived Harness control states; never mutate them."""
import base64
import hashlib
import json
import re
import zlib

ARCHIVE_SCHEMA = 'bangumi-harness-control/gzip-v1'
MAX_STATE_BYTES = 4 * 1024 * 1024
MAX_ARCHIVE_BYTES = 65536


def _reject_non_json_constant(_value):
    raise ValueError('CONTROL_ARCHIVE_INVALID')


def decode_control_state(content, marker):
    if not isinstance(content, str) or len(content.encode('utf-8')) > MAX_STATE_BYTES:
        raise ValueError('CONTROL_STATE_TOO_LARGE')
    state = json.loads(content, parse_constant=_reject_non_json_constant)
    if not isinstance(state, dict) or state.get('schema') != ARCHIVE_SCHEMA:
        return state
    if (len(content.encode('utf-8')) > MAX_ARCHIVE_BYTES or
            set(state) != {'schema', 'codec', 'marker', 'bytes', 'sha256', 'data'} or
            state['codec'] != 'gzip+base64' or state['marker'] != marker or
            type(state['bytes']) is not int or not 1 <= state['bytes'] <= MAX_STATE_BYTES or
            not isinstance(state['sha256'], str) or re.fullmatch(r'[0-9a-f]{64}', state['sha256']) is None or
            not isinstance(state['data'], str) or not state['data']):
        raise ValueError('CONTROL_ARCHIVE_INVALID')
    try:
        compressed = base64.b64decode(state['data'], validate=True)
        if base64.b64encode(compressed).decode('ascii') != state['data']:
            raise ValueError('noncanonical base64')
        # Match gunzip's concatenated-member/zero-padding support with one shared
        # output budget. No unbounded gzip.decompress allocation is permitted.
        chunks = []
        total = 0
        while compressed:
            if compressed.strip(b'\0') == b'':
                break
            decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
            chunk = decoder.decompress(compressed, MAX_STATE_BYTES - total + 1)
            total += len(chunk)
            if total > MAX_STATE_BYTES or not decoder.eof or decoder.unconsumed_tail:
                raise ValueError('bounded gzip failure')
            chunks.append(chunk)
            compressed = decoder.unused_data
        raw = b''.join(chunks)
        if len(raw) != state['bytes'] or hashlib.sha256(raw).hexdigest() != state['sha256']:
            raise ValueError('archive integrity mismatch')
        decoded = json.loads(raw.decode('utf-8'), parse_constant=_reject_non_json_constant)
        if not isinstance(decoded, dict) or decoded.get('schema') == ARCHIVE_SCHEMA:
            raise ValueError('nested archive')
        return decoded
    except (ValueError, UnicodeError, zlib.error):
        raise ValueError('CONTROL_ARCHIVE_INVALID') from None
