import tempfile
import unittest
from pathlib import Path

from bootstrap_env import bootstrap, read_values


class BootstrapTests(unittest.TestCase):
    def test_repeat_setup_preserves_secrets_and_existing_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'backend').mkdir()
            (root / 'frontend').mkdir()
            (root / 'backend/.env.example').write_text('ENCRYPTION_KEY=\n', encoding='utf-8')
            (root / 'backend/.env.prod.example').write_text('ENCRYPTION_KEY=\nPOSTGRES_PASSWORD=replace\n', encoding='utf-8')
            (root / 'frontend/.env.example').write_text('NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1\n', encoding='utf-8')
            bootstrap(root)
            paths = [root / name for name in ('.env', 'backend/.env', 'backend/.env.prod', 'frontend/.env.local')]
            contents = [path.read_bytes() for path in paths]
            bootstrap(root)
            self.assertEqual(contents, [path.read_bytes() for path in paths])
            self.assertEqual(read_values(paths[0])['ENCRYPTION_KEY'], read_values(paths[1])['ENCRYPTION_KEY'])
            self.assertEqual(read_values(paths[0])['ENCRYPTION_KEY'], read_values(paths[2])['ENCRYPTION_KEY'])

    def test_existing_distinct_keys_are_never_rotated(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'backend').mkdir()
            (root / 'frontend').mkdir()
            for name, text in [('backend/.env', 'ENCRYPTION_KEY=local-key'), ('.env', 'ENCRYPTION_KEY=compose-key'), ('backend/.env.prod', 'ENCRYPTION_KEY=production-key'), ('frontend/.env.local', 'keep')]:
                (root / name).write_text(text, encoding='utf-8')
            bootstrap(root)
            self.assertEqual(read_values(root / 'backend/.env')['ENCRYPTION_KEY'], 'local-key')
            self.assertEqual(read_values(root / '.env')['ENCRYPTION_KEY'], 'compose-key')
            self.assertEqual(read_values(root / 'backend/.env.prod')['ENCRYPTION_KEY'], 'production-key')


if __name__ == '__main__':
    unittest.main()
