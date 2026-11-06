"""Docker-free failure-path tests for the new offline-only source witness."""
import importlib.util
import itertools
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('person_closed_producer', ROOT / 'scripts/acceptance/run-person-account-closed-proof.py')
producer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(producer)


class OwnedContainerTests(unittest.TestCase):
    def test_all_run_remove_and_query_failures_attempt_independent_absence_readback(self):
        for body_type, remove_type, query_type in itertools.product((None, OSError, KeyboardInterrupt), repeat=3):
            errors = {name: kind() if kind else None for name, kind in
                [('run', body_type), ('rm', remove_type), ('ps', query_type)]}
            calls = []

            def command(*args, **options):
                stage = args[1]
                calls.append(stage)
                if errors[stage] is not None:
                    raise errors[stage]
                return SimpleNamespace(returncode=0, stdout='', stderr='')

            expected = errors['run'] or (errors['rm'] if remove_type is KeyboardInterrupt else None) or errors['ps']
            with self.subTest(body=body_type, remove=remove_type, query=query_type), patch.object(producer, 'command', new=command):
                if expected is None:
                    producer.owned_container('fake-image', ['-e', ''])
                else:
                    try:
                        producer.owned_container('fake-image', ['-e', ''])
                    except BaseException as actual:
                        self.assertIs(actual, expected)
                    else:
                        self.fail('Failure/cancellation was consumed')
            self.assertEqual(calls, ['run', 'rm', 'ps'])

    def test_remaining_container_is_not_an_absence_confirmation(self):
        calls = []

        def command(*args, **options):
            calls.append(args[1])
            return SimpleNamespace(returncode=0, stdout='remaining' if args[1] == 'ps' else '', stderr='')

        with patch.object(producer, 'command', new=command), self.assertRaisesRegex(ValueError, 'PERSON_OWNED_CONTAINER_REMAINS'):
            producer.owned_container('fake-image', ['-e', ''])
        self.assertEqual(calls, ['run', 'rm', 'ps'])

    def test_existing_report_is_preserved_before_docker_or_source_access(self):
        with tempfile.TemporaryDirectory() as temporary:
            report = Path(temporary) / 'report.json'
            report.write_text('keep')
            with (patch('sys.argv', ['producer', '--output', str(report)]),
                  patch.object(producer, 'command') as command,
                  self.assertRaisesRegex(ValueError, 'PERSON_OUTPUT_ALREADY_EXISTS')):
                producer.main()
            command.assert_not_called()
            self.assertEqual(report.read_text(), 'keep')

    def test_optimized_python_refuses_before_any_execution(self):
        import sys
        result = subprocess.run([sys.executable, '-O', str(ROOT / 'scripts/acceptance/run-person-account-closed-proof.py')],
            capture_output=True, text=True, timeout=10, env={'PATH': '/no-docker'})
        self.assertEqual(result.returncode, 1)
        self.assertIn('requires assertions enabled', result.stderr)


if __name__ == '__main__':
    unittest.main()
