// src/renderer/events/FileReadyEvent.ts
export interface FileReadyDetail {
    type: 'clipboard' | 'file';
    content: string; // 供剪貼簿使用，或顯示檔名
    path?: string;   // 真實檔案路徑
    name?: string;   // 原始檔案名稱
}

export class FileReadyEvent extends Event {
    public readonly detail: FileReadyDetail;
    constructor(detail: FileReadyDetail) {
        super('file-ready', { bubbles: true, composed: true });
        this.detail = detail;
    }
}