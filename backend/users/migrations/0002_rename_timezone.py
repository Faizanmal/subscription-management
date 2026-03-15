# Generated migration for renaming user_timezone to timezone

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.RenameField(
            model_name='user',
            old_name='user_timezone',
            new_name='timezone',
        ),
    ]
