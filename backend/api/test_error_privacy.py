from django.test import SimpleTestCase, override_settings

from api.exceptions import custom_exception_handler


class ErrorPrivacyTests(SimpleTestCase):
    @override_settings(DEBUG=False)
    def test_unexpected_error_does_not_reveal_internal_details(self):
        response = custom_exception_handler(RuntimeError('private-database-password'), {})
        self.assertEqual(response.status_code, 500)
        self.assertNotIn('private-database-password', str(response.data))
