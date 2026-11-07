from django.contrib import admin

from .models import WantItem


@admin.register(WantItem)
class WantItemAdmin(admin.ModelAdmin):
    list_display = ['printing', 'quantity', 'finish', 'any_printing', 'deck', 'user']
    raw_id_fields = ['printing', 'deck', 'user']
