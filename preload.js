const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studioAPI', {
  pickFiles: () => ipcRenderer.invoke('pick-files'),
  pickZip: () => ipcRenderer.invoke('pick-zip'),
  importFiles: (paths) => ipcRenderer.invoke('import-files', paths),
  importZip: (zip) => ipcRenderer.invoke('import-zip', zip),
  projectFiles: () => ipcRenderer.invoke('project-files'),
  runCommand: (command, args) => ipcRenderer.invoke('run-command', command, args),
  pickKeystore: () => ipcRenderer.invoke('pick-keystore'),
  importUrl: (url) => ipcRenderer.invoke('import-url', url),
  buildRelease: (settings) => ipcRenderer.invoke('build-release', settings),
  openPath: (path) => ipcRenderer.invoke('open-path', path),
  showInFolder: (path) => ipcRenderer.invoke('show-in-folder', path),
  validateApk: (path) => ipcRenderer.invoke('validate-apk', path),
  saveApk: (path) => ipcRenderer.invoke('save-apk', path),
  authSendOtp: () => ipcRenderer.invoke('auth-send-otp'),
  authVerifyOtp: (sessionId, code) => ipcRenderer.invoke('auth-verify-otp', sessionId, code),
  createKeystore: (settings) => ipcRenderer.invoke('create-keystore', settings),
  pickLogo: () => ipcRenderer.invoke('pick-logo'),
  removeLogo: () => ipcRenderer.invoke('remove-logo'),
  readLogoData: (path) => ipcRenderer.invoke('read-logo-data', path),
  saveBuildSettings: (settings) => ipcRenderer.invoke('save-build-settings', settings),
  hashPassword: (password) => ipcRenderer.invoke('hash-password', password)
});
