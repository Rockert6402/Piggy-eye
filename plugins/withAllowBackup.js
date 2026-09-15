const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Agrega tools:replace="android:allowBackup" al elemento <application>
 * para resolver el conflicto con react-native-android-notification-listener,
 * que declara allowBackup=false en su propio AndroidManifest.
 */
module.exports = withAndroidManifest(async (config) => {
  const manifest = config.modResults;
  const app = manifest.manifest.application[0];

  // Declarar el namespace tools si aún no existe
  if (!manifest.manifest.$['xmlns:tools']) {
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  }

  // Indicarle al merger que el valor del app gana
  app.$['tools:replace'] = app.$['tools:replace']
    ? app.$['tools:replace'] + ',android:allowBackup'
    : 'android:allowBackup';

  return config;
});
