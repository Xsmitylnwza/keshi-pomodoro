const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const { MakerSquirrel } = require('@electron-forge/maker-squirrel');
const path = require('node:path');

const iconPath = path.join(__dirname, 'assets', 'generated', 'keshi-icon.ico');
const certificateFile = process.env.WINDOWS_CERTIFICATE_FILE;
const certificatePassword = process.env.WINDOWS_CERTIFICATE_PASSWORD;
const windowsSign = certificateFile && certificatePassword
  ? {
      certificateFile,
      certificatePassword,
      description: 'Keshi Pomodoro',
      website: 'https://pomodoro.xsmity.cloud',
      timestampServer: 'http://timestamp.digicert.com',
    }
  : undefined;

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'Keshi Pomodoro',
    appBundleId: 'cloud.xsmity.keshiPomodoro',
    icon: iconPath,
    ...(windowsSign ? { windowsSign } : {}),
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'keshi_pomodoro_desktop',
      authors: 'Xsmity',
      description: 'Keshi Pomodoro desktop timer',
      setupIcon: iconPath,
      iconUrl: 'https://pomodoro.xsmity.cloud/keshi-icon.ico',
      ...(windowsSign ? { windowsSign } : {}),
    }),
  ],
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
