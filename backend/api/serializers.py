"""Shared organization boundaries for writable model relationships."""

from rest_framework import serializers


class OrganizationModelSerializer(serializers.ModelSerializer):
    """Never resolve a writable foreign key against another organization's data."""

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get('request')
        if request is None:
            return fields
        org_id = getattr(request.user, 'organization_id', None)
        for field in fields.values():
            relation = getattr(field, 'child_relation', field)
            queryset = getattr(relation, 'queryset', None)
            if field.read_only or queryset is None:
                continue
            model_fields = {item.name for item in queryset.model._meta.fields}
            if 'organization' in model_fields:
                relation.queryset = queryset.filter(organization_id=org_id) if org_id else queryset.none()
            elif 'subscription' in model_fields:
                relation.queryset = queryset.filter(subscription__organization_id=org_id) if org_id else queryset.none()
        return fields
