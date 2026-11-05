"""Check startup ordering without starting services or touching a database."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


@unittest.skipUnless(shutil.which('sh'), 'A POSIX shell is required')
class EntrypointTests(unittest.TestCase):
    def run_entrypoint(self, command, migration_status=0):
        script = '''
python() { printf 'python %s\\n' "$*"; return "$MIGRATION_STATUS"; }
PATH="$PWD/$QA_BIN:$PATH"
export PATH
set -- "$SERVICE_COMMAND"
. ./backend/entrypoint.sh
'''
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix='entrypoint-test-', dir=root) as directory:
            for name in ('daphne', 'celery'):
                executable = Path(directory) / name
                executable.write_text(f'#!/bin/sh\nprintf "exec {name}\\n"\n')
                executable.chmod(0o755)
            return subprocess.run(
                [shutil.which('sh'), '-c', script], cwd=root,
                env={**os.environ, 'MIGRATION_STATUS': str(migration_status),
                     'SERVICE_COMMAND': command, 'QA_BIN': Path(directory).name},
                capture_output=True, text=True,
            )

    def test_backend_migrates_before_serving(self):
        result = self.run_entrypoint('daphne')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.splitlines(),
                         ['python manage.py migrate --noinput', 'exec daphne'])

    def test_celery_checks_migrations_before_starting(self):
        result = self.run_entrypoint('celery')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.splitlines(),
                         ['python manage.py migrate --check', 'exec celery'])

    def test_pending_migrations_block_celery(self):
        result = self.run_entrypoint('celery', migration_status=1)
        self.assertEqual(result.returncode, 1)
        self.assertNotIn('exec celery', result.stdout)
        self.assertIn('Celery startup blocked', result.stderr)


if __name__ == '__main__':
    unittest.main()
