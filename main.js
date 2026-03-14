const { app, BrowserWindow, ipcMain, shell, dialog, session, Menu } = require("electron");
const path = require("path");

let mainWindow;

function createWindow(options = {}) {
  const win = new BrowserWindow({
    width: options.width || 1450,
    height: options.height || 920,
    minWidth: 1000,
    minHeight: 700,
    title: options.title || "S Browser Pro",
    autoHideMenuBar: true,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: false
    }
  });

  win.loadFile("index.html", {
    query: {
      incognito: options.incognito ? "1" : "0"
    }
  });

  return win;
}

function setAppMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "New Window",
          accelerator: "Ctrl+N",
          click: () => {
            createWindow();
          }
        },
        {
          label: "New Incognito Window",
          accelerator: "Ctrl+Shift+N",
          click: () => {
            createWindow({ title: "S Browser Pro - Incognito", incognito: true });
          }
        },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "togglefullscreen" },
        { role: "toggleDevTools" }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  mainWindow = createWindow();
  setAppMenu();

  session.defaultSession.on("will-download", async (event, item) => {
    const result = await dialog.showSaveDialog({
      title: "Save Download",
      defaultPath: item.getFilename()
    });

    if (result.canceled || !result.filePath) {
      event.preventDefault();
      return;
    }

    item.setSavePath(result.filePath);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

ipcMain.handle("open-external", async (event, url) => {
  if (!url) return false;
  await shell.openExternal(url);
  return true;
});

ipcMain.handle("download-url", async (event, url) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || !url) return false;
  await win.webContents.downloadURL(url);
  return true;
});

ipcMain.handle("new-window", async () => {
  createWindow();
  return true;
});

ipcMain.handle("new-incognito-window", async () => {
  createWindow({ title: "S Browser Pro - Incognito", incognito: true });
  return true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
