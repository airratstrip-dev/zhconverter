// src/main/QueueManager.ts
import { BrowserWindow } from 'electron';
import os from 'os';
import { StrategyFactory } from './strategies/StrategyFactory.js';
import { TxtStrategy } from './strategies/TxtStrategy.js';
import fs from 'fs/promises';
import path from 'path';
import type { TaskState } from '../types/global.js';

export class QueueManager {
    private static instance: QueueManager;
    private queue: TaskState[] = [];
    private isProcessing = false;

    private progressWindow: BrowserWindow | null = null;

    private constructor() { }

    public static getInstance(): QueueManager {
        if (!QueueManager.instance) {
            QueueManager.instance = new QueueManager();
        }
        return QueueManager.instance;
    }

    public setProgressWindow(window: BrowserWindow | null): void {
        this.progressWindow = window;
        this.broadcastQueueUpdate();
    }

    public addTask(task: TaskState): void {
        this.queue.push(task);
        this.broadcastQueueUpdate();

        if (!this.isProcessing) {
            this.processNext();
        }
    }

    public getQueue(): TaskState[] {
        return [...this.queue];
    }

    private async processNext(): Promise<void> {
        const pendingTask = this.queue.find(t => t.status === 'pending');
        if (!pendingTask) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        pendingTask.status = 'processing';
        this.broadcastQueueUpdate();

        let tempFilePath = '';

        try {
            let resultText = '';
            
            const strategyOptions = {
                converter: 'Taiwan',
                ...pendingTask.formatOptions
            };

            if (pendingTask.type === 'file') {
                const Strategy = StrategyFactory.getStrategy(pendingTask.sourcePathOrContent);
                resultText = await Strategy.execute(
                    pendingTask.sourcePathOrContent, 
                    strategyOptions, 
                    (progress) => this.updateTaskProgress(pendingTask.id, progress.current / progress.total)
                );
            } 
            else {
                const timestamp = Date.now();
                tempFilePath = path.join(os.tmpdir(), `zh_converter_paste_${timestamp}.txt`);
                await fs.writeFile(tempFilePath, pendingTask.sourcePathOrContent, 'utf-8');
                
                resultText = await TxtStrategy.execute(
                    tempFilePath,
                    strategyOptions, 
                    (progress) => this.updateTaskProgress(pendingTask.id, progress.current / progress.total)
                );
            }

            const finalPath = await this.resolveSavePath(pendingTask.saveDir, pendingTask.saveName);
            await fs.writeFile(finalPath, resultText, 'utf-8');

            pendingTask.status = 'completed';
            pendingTask.progress = 1;
        } 
        catch (error) {
            console.error(`任務 ${pendingTask.id} 失敗:`, error);
            pendingTask.status = 'error';
            pendingTask.errorMessage = error instanceof Error ? error.message : String(error);
        } 
        finally {
            if (tempFilePath) {
                await fs.unlink(tempFilePath).catch(() => {});
            }
            this.broadcastQueueUpdate();
            this.processNext();
        }
    }

    private async resolveSavePath(dir: string, initialName: string): Promise<string> {
        let finalName = initialName || 'clipboard-converted.txt';
        
        const currentExt = path.extname(finalName);
        if (!currentExt) {
            finalName += '.txt';
        }

        const ext = path.extname(finalName);
        const base = path.basename(finalName, ext);
        let finalPath = path.join(dir, finalName);
        let counter = 1;

        while (true) {
            try {
                await fs.access(finalPath);
                finalPath = path.join(dir, `${base}(${counter})${ext}`);
                counter++;
            }
            catch {
                break;
            }
        }
        return finalPath;
    }

    private updateTaskProgress(id: string, progress: number): void {
        const task = this.queue.find(t => t.id === id);
        if (task) {
            task.progress = progress;
            this.broadcastQueueUpdate();
        }
    }

    private broadcastQueueUpdate(): void {
        if (!this.progressWindow || this.progressWindow.isDestroyed()) return;
        this.progressWindow.webContents.send('queue-updated', this.queue);
    }
}