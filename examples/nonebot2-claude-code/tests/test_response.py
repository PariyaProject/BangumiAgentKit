from __future__ import annotations

import json
import unittest

from bangumi_host.response import HostResponseError, parse_claude_output


class ResponseTests(unittest.TestCase):
    def test_parses_structured_output_and_ignores_raw_result(self) -> None:
        session_id, response = parse_claude_output(
            json.dumps(
                {
                    'session_id': 'session-1',
                    'result': 'raw prose',
                    'structured_output': {
                        'text': 'safe text',
                        'artifacts': [{'id': 'art_abc', 'mimeType': 'image/png'}],
                        'pendingConfirmation': None,
                    },
                }
            )
        )
        self.assertEqual(session_id, 'session-1')
        self.assertEqual(response.text, 'safe text')
        self.assertEqual(response.artifacts[0].id, 'art_abc')

    def test_rejects_invalid_artifact_and_confirmation_ids(self) -> None:
        for field, value in (
            ('artifacts', [{'id': '../secret', 'mimeType': 'image/png'}]),
            (
                'pendingConfirmation',
                {'confirmationId': 'not-a-confirmation', 'summary': 'danger'},
            ),
        ):
            payload = {
                'session_id': 'session-1',
                'structured_output': {
                    'text': 'safe text',
                    'artifacts': [],
                    'pendingConfirmation': None,
                },
            }
            payload['structured_output'][field] = value
            with self.subTest(field=field), self.assertRaises(HostResponseError):
                parse_claude_output(json.dumps(payload))

    def test_requires_complete_wrapper(self) -> None:
        with self.assertRaises(HostResponseError):
            parse_claude_output(json.dumps({'session_id': 'session-1'}))


if __name__ == '__main__':
    unittest.main()
