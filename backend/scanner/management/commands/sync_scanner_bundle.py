from django.core.management.base import BaseCommand, CommandError

from scanner.bundles import current_version, install_from_dir, install_latest


class Command(BaseCommand):
    help = "Install the newest published manavault scanner bundle (or one from a local folder)."

    def add_arguments(self, parser):
        parser.add_argument('--from-dir', help='Install the bundle in this folder instead of downloading')
        parser.add_argument('--if-missing', action='store_true', help='Do nothing when a bundle is installed')

    def handle(self, *args, from_dir=None, if_missing=False, **options):
        if if_missing and current_version():
            self.stdout.write(f'Scanner bundle {current_version()} already installed.')
            return
        try:
            version = install_from_dir(from_dir) if from_dir else install_latest()
        except Exception as exc:
            raise CommandError(f'Scanner bundle install failed: {exc}') from exc
        self.stdout.write(f'Scanner bundle: {version or "no published release"} (current: {current_version()}).')
