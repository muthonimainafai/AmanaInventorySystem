const { app, BrowserWindow } = require("electron");
const { startServer, stopServer } = require("./server");

const LOCAL_URL = "http://localhost:3000";
const REMOTE_URL = process.env.AMANA_SERVER_URL;
const APP_URL = REMOTE_URL || LOCAL_URL;

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadURL(APP_URL);
}

app.whenReady().then(async () => {
  if (!REMOTE_URL) {
    process.env.AMANA_DATA_DIR = app.getPath("userData");
    await startServer(3000);
  }
  await createWindow();
});

app.on("window-all-closed", async () => {
  if (!REMOTE_URL) {
    await stopServer();
  }
  if (process.platform !== "darwin") app.quit();
});
