// src/preload/index.ts
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { TaskPayload, TaskState } from '../types/global'; // 確保這裡有正確匯入

contextBridge.exposeInMainWorld('api', {
    getSystemAccentColor: () => ipcRenderer.invoke('get-accent-color'),
    getFilePath: (file: File) => webUtils.getPathForFile(file),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    checkDirectory: (dir: string) => ipcRenderer.invoke('check-directory', dir),
    showWarning: (message: string) => ipcRenderer.invoke('show-warning', message),
    
    showProgressWindow: () => ipcRenderer.invoke('show-progress-window'),
    closeProgressWindow: () => ipcRenderer.invoke('close-progress-window'),
    
    getQueueState: () => ipcRenderer.invoke('get-queue-state'),
    
    enqueueTask: (payload: TaskPayload) => ipcRenderer.invoke('enqueue-task', payload),
    
    onQueueUpdated: (callback: (queue: TaskState[]) => void) => {
        ipcRenderer.removeAllListeners('queue-updated');
        ipcRenderer.on('queue-updated', (_event, queue) => callback(queue));
    },

    getTheme: () => ipcRenderer.invoke('get-theme'),
    setTheme: (isDark: boolean) => ipcRenderer.invoke('set-theme', isDark),
    onThemeChanged: (callback: (isDark: boolean) => void) => {
        ipcRenderer.removeAllListeners('theme-changed');
        ipcRenderer.on('theme-changed', (_event, isDark) => callback(isDark));
    }
});