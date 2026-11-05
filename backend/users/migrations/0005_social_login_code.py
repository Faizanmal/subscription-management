from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('users', '0004_policy_acceptance')]
    operations = [migrations.CreateModel(name='SocialLoginCode', fields=[
        ('code_hash', models.CharField(max_length=64, primary_key=True, serialize=False)),
        ('challenge', models.CharField(max_length=43)),
        ('expires_at', models.DateTimeField()),
        ('used_at', models.DateTimeField(null=True, blank=True)),
        ('user', models.ForeignKey(to='users.user', on_delete=django.db.models.deletion.CASCADE)),
    ])]
