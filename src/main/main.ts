// src/main/main.ts
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerIpcHandlers } from './ipcHandlers.js';
import { QueueManager } from './QueueManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let progressWindow: BrowserWindow | null = null; // ★ 新增獨立進度視窗的參考

function createMainWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 720,
        // 隱藏預設標題列，讓畫面更乾淨、更像原生 App
        autoHideMenuBar: true,
        titleBarStyle: 'default',
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.mjs'),
            nodeIntegration: false,
            contextIsolation: true,
        }
    });

    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
        // 衛句：主視窗關閉時，若進度視窗還開著，連帶關閉
        if (progressWindow) {
            progressWindow.close();
        }
    });
}

// ★ 導出開啟進度視窗的方法，供 ipcHandlers 呼叫
export function showProgressWindow(): void {
    // 衛句：如果視窗已經存在且未被銷毀，直接將其帶到最上層
    if (progressWindow && !progressWindow.isDestroyed()) {
        progressWindow.focus();
        return;
    }

    // 建立新視窗 (尺寸稍微細長一點，適合顯示列表)
    progressWindow = new BrowserWindow({
        width: 400,
        height: 600,
        autoHideMenuBar: true,
        titleBarStyle: 'hidden',
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.mjs'),
            nodeIntegration: false,
            contextIsolation: true,
        }
    });

    // 依據環境載入 progress.html (MPA 架構)
    if (process.env.VITE_DEV_SERVER_URL) {
        progressWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}progress.html`);
        // 可選：progressWindow.webContents.openDevTools();
    }
    else {
        progressWindow.loadFile(path.join(__dirname, '../../dist/progress.html'));
    }

    // 將這個視窗綁定給 QueueManager，讓它可以接收進度廣播
    QueueManager.getInstance().setProgressWindow(progressWindow);

    progressWindow.on('closed', () => {
        progressWindow = null;
        // 清除 QueueManager 裡的參考，防止記憶體洩漏
        QueueManager.getInstance().setProgressWindow(null);
    });
}

app.whenReady().then(() => {
    registerIpcHandlers();
    createMainWindow();


    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});