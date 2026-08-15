"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("crushSetup", {
  meta: () => ipcRenderer.invoke("crush:meta"),
  load: (opts) => ipcRenderer.invoke("crush:load", opts),
  save: () => ipcRenderer.invoke("crush:save"),
  reload: () => ipcRenderer.invoke("crush:reload"),
  apply: (op, args) => ipcRenderer.invoke("crush:apply", op, args),
  state: () => ipcRenderer.invoke("crush:state"),
  pickDirectory: () => ipcRenderer.invoke("crush:pick-directory"),
  discoverModels: (opts) => ipcRenderer.invoke("crush:discover-models", opts),
  window: {
    minimize: () => ipcRenderer.invoke("win:minimize"),
    maximize: () => ipcRenderer.invoke("win:maximize"),
    close: () => ipcRenderer.invoke("win:close"),
    isMaximized: () => ipcRenderer.invoke("win:isMaximized"),
  },
});
