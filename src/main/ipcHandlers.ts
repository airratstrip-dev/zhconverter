// src/main/ipcHandlers.ts
import { ipcMain, systemPreferences, BrowserWindow, dialog } from 'electron';
import fs from 'fs/promises';
import crypto from 'crypto'; // 用於生成 Task ID
import { QueueManager } from './QueueManager.js';
import { showProgressWindow } from './main.js';
import type { TaskPayload, TaskState } from '../types/global.js';

export function registerIpcHandlers(): void {
    ipcMain.handle('get-accent-color', () => {
        try {
            if (process.platform !== 'win32' && process.platform !== 'darwin') {
                return null;
            }
            return `#${systemPreferences.getAccentColor()}`;
        }
        catch (error) {
            console.error('無法取得系統強調色:', error);
            return null;
        }
    });

    ipcMain.handle('select-directory', async (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) return null;

        const result = await dialog.showOpenDialog(window, {
            properties: ['openDirectory', 'createDirectory']
        });

        if (result.canceled || result.filePaths.length === 0) return null;
        return result.filePaths[0];
    });

    ipcMain.handle('check-directory', async (_, dir: string) => {
        if (!dir) return false;
        try {
            const stat = await fs.stat(dir);
            return stat.isDirectory();
        }
        catch {
            return false;
        }
    });
    ipcMain.handle('show-progress-window', () => {
        showProgressWindow();
    });

    ipcMain.handle('close-progress-window', (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) return;
        window.close();
    });

    ipcMain.handle('get-queue-state', () => {
        return QueueManager.getInstance().getQueue();
    });

    ipcMain.handle('enqueue-task', (_, payload: TaskPayload) => {
        if (!payload.contentOrPath) throw new Error('任務內容不能為空');
        if (!payload.saveDir) throw new Error('儲存路徑不能為空');

        const task: TaskState = {
            id: crypto.randomUUID(),
            displayName: payload.displayName,
            type: payload.type,
            sourcePathOrContent: payload.contentOrPath,
            saveDir: payload.saveDir,
            saveName: payload.saveName,
            status: 'pending',
            progress: 0,
            formatOptions: payload.formatOptions // ★ 安全且嚴格地承接選項
        };

        QueueManager.getInstance().addTask(task);
        showProgressWindow();
        return task.id;
    });

    ipcMain.handle('set-theme', (_, isDark: boolean) => {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
            if (win.isDestroyed()) continue;
            win.webContents.send('theme-changed', isDark);
        }
    });
}