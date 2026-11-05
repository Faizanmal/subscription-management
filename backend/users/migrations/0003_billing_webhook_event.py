from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('users', '0002_rename_timezone')]

    operations = [
        migrations.AddField(
            model_name='organization', name='stripe_checkout_session_id',
            field=models.CharField(max_length=255, blank=True, default=''),
        ),
        migrations.CreateModel(
            name='BillingWebhookEvent',
            fields=[
                ('event_id', models.CharField(max_length=255, primary_key=True, serialize=False)),
                ('event_type', models.CharField(max_length=100)),
                ('processed_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]
