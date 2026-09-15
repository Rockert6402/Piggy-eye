const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Agrega tools:replace="android:allowBackup" al <application> del AndroidManifest
 * para resolver el merger conflict con react-native-android-notification-listener.
 */
module.exports = withAndroidManifest((config) => {
  const manifest = config.modResults;
  // Solo aplica en contexto de build Android (modResults puede estar vacío en expo config --json)
  if (!manifest?.manifest?.application?.[0]) {
    return config;
  }

  const app = manifest.manifest.application[0];

  if (!manifest.manifest.$['xmlns:tools']) {
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  }

  const prev = app.$['tools:replace'];
  app.$['tools:replace'] = prev
    ? prev + ',android:allowBackup'
    : 'android:allowBackup';

  return config;
});
