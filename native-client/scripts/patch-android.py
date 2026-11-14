#!/usr/bin/env python3
"""Ajustements du projet Android généré par « npx cap add android » (appelé par le workflow GitHub Actions).

- copie l'icône de notification (silhouette blanche) dans les ressources ;
- déclare cette icône et la couleur par défaut des notifications Firebase, ainsi que le canal « orders » ;
- autorise l'affichage des notifications (Android 13+) ;
- fixe le numéro de version (versionCode / versionName).
Usage : patch-android.py <numero_de_build> <version>
"""
import pathlib
import re
import shutil
import sys

build = sys.argv[1] if len(sys.argv) > 1 else '1'
version = sys.argv[2] if len(sys.argv) > 2 else '1.0.0'

root = pathlib.Path(__file__).resolve().parent.parent
app = root / 'android' / 'app'
res = app / 'src' / 'main' / 'res'

# 1. Icônes de notification
for d in (root / 'android-res').iterdir():
    if d.is_dir():
        target = res / d.name
        target.mkdir(parents=True, exist_ok=True)
        for f in d.iterdir():
            shutil.copy(f, target / f.name)

# 2. Couleur des notifications
colors = res / 'values' / 'colors.xml'
colors.parent.mkdir(parents=True, exist_ok=True)
if colors.exists():
    text = colors.read_text()
    if 'ff_notification_color' not in text:
        text = text.replace('</resources>', '    <color name="ff_notification_color">#0F3D2C</color>\n</resources>')
        colors.write_text(text)
else:
    colors.write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ff_notification_color">#0F3D2C</color>\n</resources>\n')

# 3. Manifeste : icône / couleur / canal par défaut + permission d'afficher les notifications
manifest = app / 'src' / 'main' / 'AndroidManifest.xml'
text = manifest.read_text()
meta = '''
        <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_notify" />
        <meta-data android:name="com.google.firebase.messaging.default_notification_color" android:resource="@color/ff_notification_color" />
        <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="orders" />
'''
if 'default_notification_icon' not in text:
    text = text.replace('</application>', meta + '    </application>')
if 'POST_NOTIFICATIONS' not in text:
    text = text.replace('</manifest>', '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n</manifest>')
manifest.write_text(text)

# 4. Version
for name in ('build.gradle', 'build.gradle.kts'):
    gradle = app / name
    if gradle.exists():
        g = gradle.read_text()
        g = re.sub(r'versionCode\s*=?\s*\d+', f'versionCode {build}' if name.endswith('.gradle') else f'versionCode = {build}', g)
        g = re.sub(r'versionName\s*=?\s*"[^"]*"', f'versionName "{version}"' if name.endswith('.gradle') else f'versionName = "{version}"', g)
        gradle.write_text(g)
print(f'Projet Android ajusté (build {build}, version {version}).')
