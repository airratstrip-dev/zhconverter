let electron = require("electron");
//#region src/preload/index.ts
electron.contextBridge.exposeInMainWorld("api", {
	getSystemAccentColor: () => electron.ipcRenderer.invoke("get-accent-color"),
	getFilePath: (file) => electron.webUtils.getPathForFile(file),
	selectDirectory: () => electron.ipcRenderer.invoke("select-directory"),
	checkDirectory: (dir) => electron.ipcRenderer.invoke("check-directory", dir),
	showWarning: (message) => electron.ipcRenderer.invoke("show-warning", message),
	showProgressWindow: () => electron.ipcRenderer.invoke("show-progress-window"),
	closeProgressWindow: () => electron.ipcRenderer.invoke("close-progress-window"),
	getQueueState: () => electron.ipcRenderer.invoke("get-queue-state"),
	enqueueTask: (payload) => electron.ipcRenderer.invoke("enqueue-task", payload),
	onQueueUpdated: (callback) => {
		electron.ipcRenderer.removeAllListeners("queue-updated");
		electron.ipcRenderer.on("queue-updated", (_event, queue) => callback(queue));
	},
	setTheme: (isDark) => electron.ipcRenderer.invoke("set-theme", isDark),
	onThemeChanged: (callback) => {
		electron.ipcRenderer.removeAllListeners("theme-changed");
		electron.ipcRenderer.on("theme-changed", (_event, isDark) => callback(isDark));
	}
});
//#endregion
