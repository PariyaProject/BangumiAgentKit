from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path
from urllib.parse import unquote, urlparse

from bangumi_host.nonebot_adapter import build_nonebot_reply
from bangumi_host.response import ArtifactOutput, HostResponse
from bangumi_host.service import HostResult


PNG = b'\x89PNG\r\n\x1a\ncompatibility-fixture'


class NoneBotAdapterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(tempfile.mkdtemp(prefix='bangumi-nonebot-adapter-test-'))
        self.image = self.root / 'card.png'
        self.image.write_bytes(PNG)

    def tearDown(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)

    def test_text_and_png_path_build_onebot_message(self) -> None:
        result = HostResult(
            response=HostResponse(
                text='card ready',
                artifacts=(ArtifactOutput('art_card', 'image/png'),),
                pending_confirmation=None,
            ),
            artifact_paths=(self.image,),
        )

        message = build_nonebot_reply(result)

        self.assertEqual([segment.type for segment in message], ['text', 'image'])
        self.assertEqual(message[0].data['text'], 'card ready')
        image_uri = str(message[1].data['file'])
        self.assertTrue(image_uri.startswith('file:'))
        self.assertEqual(Path(unquote(urlparse(image_uri).path)).resolve(), self.image.resolve())


if __name__ == '__main__':
    unittest.main()
