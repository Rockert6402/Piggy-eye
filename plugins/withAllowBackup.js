const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Parcha AndroidManifest.xml después del prebuild para resolver el merger
 * conflict con react-native-android-notification-listener (allowBackup=false).
 * Usa withDangerousMod (edición directa del archivo) en lugar de withAndroidManifest
 * porque xml2js serializa incorrectamente atributos con namespace (tools:replace).
 */
module.exports = (config) =>
  withDangerousMod(config, [
    'android',
    (cfg) => {
      const manifestPath = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'AndroidManifest.xml'
      );

      let xml = fs.readFileSync(manifestPath, 'utf8');

      // 1. Agregar xmlns:tools al elemento <manifest> si no existe
      if (!xml.includes('xmlns:tools')) {
        xml = xml.replace(
          /(<manifest\b[^>]*?)>/,
          '$1\n    xmlns:tools="http://schemas.android.com/tools">'
        );
      }

      // 2. Agregar tools:replace al elemento <application> si no existe
      if (!xml.includes('tools:replace')) {
        xml = xml.replace(
          /(<application\b)/,
          '$1\n        tools:replace="android:allowBackup"'
        );
      }

      fs.writeFileSync(manifestPath, xml, 'utf8');
      return cfg;
    },
  ]);
