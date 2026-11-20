
from django.contrib import admin
from django.utils import timezone
from users.models import ClosureRequest


@admin.register(ClosureRequest)
class ClosureRequestAdmin(admin.ModelAdmin):
    list_display = ['id', 'scope', 'status', 'created_at', 'eligible_at', 'completed_at']
    list_filter = ['scope', 'status']
    search_fields = ['id']
    exclude = ['confirmation_hash', 'identity_email_hash']
    readonly_fields = ['id', 'organization', 'requested_by', 'scope', 'identity_verified_at',
                       'confirmation_expires_at', 'confirmation_sent_at', 'eligible_at',
                       'created_at', 'updated_at', 'updated_by', 'completed_at']

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        if obj.status == 'completed' and not obj.completed_at:
            obj.completed_at = timezone.now()
        super().save_model(request, obj, form, change)
