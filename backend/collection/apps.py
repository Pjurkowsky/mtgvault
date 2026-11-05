from django.apps import AppConfig
from django.db.models.signals import post_save


class CollectionConfig(AppConfig):
    name = 'collection'

    def ready(self):
        from .binder import sync_slots
        from .models import CollectionItem

        # Every row save keeps its binder slots true: moved out, to the cart, fewer copies (spec 007, AC-13).
        post_save.connect(lambda sender, instance, **kw: sync_slots(instance), sender=CollectionItem,
                          weak=False, dispatch_uid='collection_sync_slots')
