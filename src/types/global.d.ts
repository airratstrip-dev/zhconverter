// src/types/global.d.ts
export {};

export interface JsonFormatOptions {
    convertKeys: boolean;
    convertValues: boolean;
}

export type FormatOptions = JsonFormatOptions; 

export interface TaskState {
    id: string;
    displayName: string;
    type: 'file' | 'clipboard';
    sourcePathOrContent: string;
    saveDir: string;
    saveName: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    progress: number;
    errorMessage?: string;
    formatOptions?: FormatOptions; 
}

export interface TaskPayload {
    type: 'file' | 'clipboard';
    contentOrPath: string;
    displayName: string;
    saveDir: string;
    saveName: string;
    formatOptions?: FormatOptions; 
}

declare global {
    interface Window {
        api: {
            getSystemAccentColor: () => Promise<string | null>;
            getFilePath: (file: File) => string;
            selectDirectory: () => Promise<string | null>;
            checkDirectory: (dir: string) => Promise<boolean>;
            showWarning: (message: string) => Promise<void>;
            
            showProgressWindow: () => Promise<void>;
            closeProgressWindow: () => Promise<void>;
            getQueueState: () => Promise<TaskState[]>;
            enqueueTask: (payload: TaskPayload) => Promise<string>;
            onQueueUpdated: (callback: (queue: TaskState[]) => void) => void;

            setTheme: (isDark: boolean) => Promise<void>;
            onThemeChanged: (callback: (isDark: boolean) => void) => void;
        };
    }
}