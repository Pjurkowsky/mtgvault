from django.contrib import admin

from .models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'kind', 'set_code', 'released_at', 'deck_type')
    list_filter = ('kind',)
    search_fields = ('name', 'code')
