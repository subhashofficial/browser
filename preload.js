const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  downloadURL: (url) => ipcRenderer.invoke("download-url", url),
  newWindow: () => ipcRenderer.invoke("new-window"),
  newIncognitoWindow: () => ipcRenderer.invoke("new-incognito-window")
});
