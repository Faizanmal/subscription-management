# Generated migration for renaming user_timezone to timezone

<<<<<<< HEAD
from django.db import migrations, models
=======
from django.db import migrations
>>>>>>> f2225d53a335250fd763dea989142daf386167f6


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
