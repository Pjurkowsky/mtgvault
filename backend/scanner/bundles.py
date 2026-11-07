"""Install manavault's published scanner bundles (spec 003, AC-23).

A bundle is a GitHub release in cfbender/manavault tagged `scanner-bundle-*`
(MPL-2.0, models trained in cfbender/oracle). We download the files browsers
need, check every SHA-256 against the manifest, and switch `current` only when
everything matches. `printings.json` (~125 MB) is skipped: our catalog resolves
matches through `Printing.illustration_id`.

Spec 020: staff pick the source (`ScannerSource`): another repository's releases,
or a folder on the server holding bundles from Oracle (`<folder>/<version>/`),
of which the newest by its manifest's `created` wins. `sync()` installs from the
saved source and records the result.
"""

import fcntl
import hashlib
import json
import logging
import os
import re
import shutil
import tempfile
import urllib.request
from pathlib import Path

from django.conf import settings

log = logging.getLogger(__name__)

RELEASES_URL = 'https://api.github.com/repos/{repo}/releases?per_page=30'
DEFAULT_REPO = 'cfbender/manavault'
REPO_RE = re.compile(r'^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')
TAG_PREFIX = 'scanner-bundle-'
BROWSER_FILES = ['arts.json', 'detector.onnx', 'embed.onnx', 'search.onnx']
HEADERS = {'User-Agent': 'MTGVault/0.1', 'Accept': 'application/vnd.github+json'}
VERSION_RE = re.compile(r'^[A-Za-z0-9._-]+$')


class BundleError(Exception):
    pass


def bundle_root() -> Path:
    return Path(settings.SCANNER_DIR)


def current_version() -> str | None:
    pointer = bundle_root() / 'current'
    try:
        version = pointer.read_text().strip()
    except FileNotFoundError:
        return None
    return version if (bundle_root() / version / 'manifest.json').exists() else None


def manifest(version: str) -> dict:
    return json.loads((bundle_root() / version / 'manifest.json').read_text())


def file_path(version: str, name: str) -> Path | None:
    if not VERSION_RE.match(version) or name not in BROWSER_FILES:
        return None
    path = bundle_root() / version / name
    return path if path.exists() else None


def _get(url: str, accept: str | None = None):
    headers = dict(HEADERS)
    if accept:
        headers['Accept'] = accept
    return urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=300)


def newest_release(repo: str = DEFAULT_REPO) -> dict | None:
    """The newest published (not draft) scanner bundle release, or None."""
    if not REPO_RE.match(repo):
        raise BundleError(f'Bad repository {repo!r}; expected owner/name')
    with _get(RELEASES_URL.format(repo=repo)) as response:
        releases = json.load(response)
    bundles = [r for r in releases if r['tag_name'].startswith(TAG_PREFIX) and not r['draft']]
    bundles.sort(key=lambda r: r.get('published_at') or '', reverse=True)
    return bundles[0] if bundles else None


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def _install(version: str, fetch) -> str:
    """Download with `fetch(name, target_path)`, verify, then switch `current`."""
    if not VERSION_RE.match(version) or version in ('current', 'previous'):
        raise BundleError(f'Bad bundle version {version!r}')
    root = bundle_root()
    root.mkdir(parents=True, exist_ok=True)
    final = root / version
    if final.exists() and current_version() == version:
        return version

    staging = Path(tempfile.mkdtemp(prefix=f'{version}.', suffix='.partial', dir=root))
    try:
        fetch('manifest.json', staging / 'manifest.json')
        meta = json.loads((staging / 'manifest.json').read_text())
        if meta.get('version') != version:
            raise BundleError(f"Manifest version {meta.get('version')!r} does not match {version!r}")
        for name in BROWSER_FILES:
            expected = meta['files'][name]
            fetch(name, staging / name)
            if (staging / name).stat().st_size != expected['bytes'] or _sha256(staging / name) != expected['sha256']:
                raise BundleError(f'{name}: size or SHA-256 does not match the manifest')
        if final.exists():
            shutil.rmtree(final)
        staging.rename(final)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise

    previous = current_version()
    tmp_pointer = root / 'current.tmp'
    tmp_pointer.write_text(version)
    os.replace(tmp_pointer, root / 'current')  # atomic switch
    _prune(keep={version, previous})
    log.info('Scanner bundle %s installed', version)
    return version


def _prune(keep: set):
    for child in bundle_root().iterdir():
        if child.is_dir() and child.name not in keep and not child.name.endswith('.partial'):
            shutil.rmtree(child, ignore_errors=True)


def install_latest(repo: str = DEFAULT_REPO) -> str | None:
    """Install the newest published release. Returns its version, or None if there is none."""
    release = newest_release(repo)
    if release is None:
        return None
    version = release['tag_name'][len(TAG_PREFIX):]
    assets = {a['name']: a['browser_download_url'] for a in release['assets']}

    def fetch(name, target):
        if name not in assets:
            raise BundleError(f'Release {version} has no {name}')
        with _get(assets[name], accept='application/octet-stream') as response, target.open('wb') as out:
            shutil.copyfileobj(response, out)

    return _install(version, fetch)


def install_from_dir(source: str) -> str:
    """Install a bundle folder (tests, offline). Its manifest names the version."""
    source_path = Path(source)
    version = json.loads((source_path / 'manifest.json').read_text())['version']
    return _install(version, lambda name, target: shutil.copyfile(source_path / name, target))


def newest_in(folder: str) -> Path:
    """The newest bundle in a folder of bundles: real subfolders with a manifest, by `created`."""
    root = Path(folder)
    if not root.is_absolute():
        raise BundleError(f'{folder} is not an absolute path')
    if not root.is_dir():
        raise BundleError(f'{folder} is not a folder on the server')
    found = []
    for child in root.iterdir():
        if child.is_symlink() or not child.is_dir() or not (child / 'manifest.json').is_file():
            continue
        try:
            created = json.loads((child / 'manifest.json').read_text()).get('created', '')
        except (OSError, ValueError):
            continue
        found.append((created, child.name, child))
    if not found:
        raise BundleError(f'{folder} holds no bundle (a subfolder with manifest.json)')
    return max(found)[2]


def install_newest_in(folder: str) -> str:
    return install_from_dir(str(newest_in(folder)))


def sync() -> str | None:
    """Install the newest bundle from the saved source and record the result (spec 020).

    One install at a time: a second call while one runs returns None and changes nothing."""
    from django.utils import timezone

    from .models import ScannerSource

    bundle_root().mkdir(parents=True, exist_ok=True)
    with (bundle_root() / '.sync.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return None
        source = ScannerSource.get()
        ScannerSource.objects.filter(pk=source.pk).update(syncing=True)
        version, error = None, ''
        try:
            if source.kind == ScannerSource.FOLDER:
                version = install_newest_in(source.path)
            else:
                version = install_latest(source.repo or DEFAULT_REPO)
                if version is None:
                    error = f'{source.repo or DEFAULT_REPO} has no scanner-bundle release'
        except BundleError as exc:
            log.warning('Scanner bundle sync failed: %s', exc)
            error = str(exc)
        except Exception as exc:
            log.exception('Scanner bundle sync failed')
            error = str(exc) or type(exc).__name__
        ScannerSource.objects.filter(pk=source.pk).update(syncing=False, last_sync_at=timezone.now(), last_error=error)
        if error:
            raise BundleError(error)
        return version
