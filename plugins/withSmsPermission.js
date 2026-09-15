const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Agrega el permiso READ_SMS al AndroidManifest.xml generado por el prebuild.
 * Este permiso es un "dangerous permission" de Android 6+, lo que significa que
 * además de declararlo acá, hay que pedírselo al usuario en tiempo de ejecución
 * con PermissionsAndroid.request() antes de intentar leer el inbox.
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

      if (!xml.includes('android.permission.READ_SMS')) {
        xml = xml.replace(
          /(<manifest\b[^>]*>)/,
          '$1\n    <uses-permission android:name="android.permission.READ_SMS" />'
        );
      }

      fs.writeFileSync(manifestPath, xml, 'utf8');
      return cfg;
    },
  ]);
