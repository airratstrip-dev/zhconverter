// src/types/global.d.ts
export {};

export interface JsonFormatOptions {
    convertKeys: boolean;
    convertValues: boolean;
}

export interface XmlHtmlFormatOptions {
    convertText: boolean;
    convertAttributes: boolean;
    convertComments: boolean;
}

export interface YamlFormatOptions {
    convertKeys: boolean;
    convertValues: boolean;
    convertComments: boolean;
}

export interface TomlFormatOptions {
    convertKeys: boolean;
    convertValues: boolean;
    convertComments: boolean;
}

export interface AssFormatOptions {
    convertText: boolean;
    convertScriptInfo: boolean;
    convertComments: boolean;
}

export interface CsvFormatOptions {
    convertHeaders: boolean;
    columnRules: string;
    isColumnWhitelist: boolean;
    rowRules: string;
    isRowWhitelist: boolean;
    delimiter: string;
}

export type FormatOptions = 
    | JsonFormatOptions 
    | XmlHtmlFormatOptions 
    | YamlFormatOptions 
    | TomlFormatOptions
    | AssFormatOptions
    | CsvFormatOptions;

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
            getTheme: () => Promise<boolean>;
            setTheme: (isDark: boolean) => Promise<void>;
            onThemeChanged: (callback: (isDark: boolean) => void) => void;
        };
    }
}