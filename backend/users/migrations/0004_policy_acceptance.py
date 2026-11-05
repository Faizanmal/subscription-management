import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('users', '0003_billing_webhook_event')]
    operations = [migrations.CreateModel(
        name='PolicyAcceptance',
        fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
            ('terms_version', models.CharField(max_length=64)),
            ('privacy_version', models.CharField(max_length=64)),
            ('accepted_at', models.DateTimeField(auto_now_add=True)),
            ('source', models.CharField(max_length=20)),
            ('user', models.ForeignKey(to='users.user', related_name='policy_acceptances', on_delete=django.db.models.deletion.CASCADE)),
        ],
        options={'ordering': ['-accepted_at'], 'constraints': [models.UniqueConstraint(fields=('user', 'terms_version', 'privacy_version'), name='unique_user_policy_versions')]},
    )]
