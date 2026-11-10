"""Plays queued pod simulations, one run at a time (spec 024, AC-14)."""

import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from django.core.management.base import BaseCommand

from sims import worker


class Health(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'ok')

    def log_message(self, *args):
        pass


class Command(BaseCommand):
    help = 'Play queued pod simulations against the Forge service.'

    def add_arguments(self, parser):
        parser.add_argument('--health-port', type=int, help='Answer GET / on this port while running (for tests).')

    def handle(self, *args, **options):
        if options['health_port']:
            server = ThreadingHTTPServer(('127.0.0.1', options['health_port']), Health)
            threading.Thread(target=server.serve_forever, daemon=True).start()
        self.stdout.write('Waiting for pod simulations.')
        worker.loop()
