// src/renderer/app.ts
import 'material-symbols/outlined.css';
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/textfield/filled-text-field.js';
import '@material/web/icon/icon.js';
// ★ 新增 Checkbox 元件
import '@material/web/checkbox/checkbox.js'; 
import './components/drop-zone.js';
import { initializeDynamicTheme, applyCurrentTheme } from './utils/theme.js';
import { FileReadyEvent, FileReadyDetail } from './events/FileReadyEvent.js';
// ★ 嚴格引入型別
import type { TaskPayload, JsonFormatOptions } from '../types/global.js';

@customElement('zh-converter-app')
export class ZhConverterApp extends LitElement {
    static styles = css`
        :host {
            display: flex;
            width: 100vw;
            height: 100vh;
            color: var(--md-sys-color-on-background);
        }

        /* ★ 桌面端必備：無邊框視窗的拖曳區 */
        .window-drag-area {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 32px;
            -webkit-app-region: drag; /* 讓 Electron 知道這塊可以拖曳視窗 */
            z-index: 1000;
        }

        /* 側邊欄設計 */
        .sidebar {
            width: 260px;
            min-width: 260px;
            background: var(--md-sys-color-surface-container-low);
            border-right: 1px solid var(--md-sys-color-outline-variant);
            display: flex;
            flex-direction: column;
            padding: 40px 16px 24px 16px; /* 頂部留出 40px 避開拖曳區 */
            box-sizing: border-box;
            -webkit-app-region: no-drag; /* 確保按鈕不會變成拖曳把手 */
        }

        .sidebar-header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding-bottom: 24px;
            border-bottom: 1px solid var(--md-sys-color-outline-variant);
            margin-bottom: 24px;
        }

        .sidebar-header md-icon {
            color: var(--md-sys-color-primary);
            font-size: 28px;
        }

        .sidebar-header h2 {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: var(--md-sys-color-on-surface);
        }

        .sidebar-content {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .sidebar-title {
            font-size: 12px;
            font-weight: 600;
            color: var(--md-sys-color-on-surface-variant);
            margin-bottom: 8px;
            padding-left: 8px;
            letter-spacing: 1px;
        }

        .sidebar-footer {
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding-top: 24px;
            border-top: 1px solid var(--md-sys-color-outline-variant);
        }

        .sidebar-btn {
            width: 100%;
            --md-outlined-button-container-shape: 12px;
            display: flex;
            justify-content: flex-start;
        }

        /* 主內容區 */
        .main-area {
            flex-grow: 1;
            background: var(--md-sys-color-surface);
            overflow-y: auto;
            position: relative;
            display: flex;
            justify-content: center; /* 內容置中 */
            padding-top: 32px; /* 避開頂部拖曳區 */
            -webkit-app-region: no-drag;
        }

        .content-wrapper {
            max-width: 720px;
            width: 100%;
            padding: 32px 48px;
            display: flex;
            flex-direction: column;
            gap: 32px;
            box-sizing: border-box;
        }

        /* 以下保留先前的精緻卡片化設計 */
        .settings-section {
            display: flex;
            flex-direction: column;
            gap: 20px;
            background: var(--md-sys-color-surface-container-lowest);
            border: 1px solid var(--md-sys-color-outline-variant);
            padding: 24px;
            border-radius: 24px;
            transition: border-color 0.3s ease;
        }

        .settings-section:hover {
            border-color: var(--md-sys-color-outline);
        }

        .section-title {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: var(--md-sys-color-primary);
        }

        .path-selector-area {
            display: flex;
            gap: 16px;
            align-items: center;
            width: 100%;
        }

        md-filled-text-field {
            flex-grow: 1;
            --md-filled-text-field-container-shape: 12px;
            --md-filled-text-field-container-color: var(--md-sys-color-background);
        }

        .action-area {
            display: flex;
            justify-content: flex-end;
            margin-top: 8px;
        }

        .status-text {
            font-size: 14px;
            font-weight: 600;
            color: var(--md-sys-color-primary);
            text-align: right;
            font-variant-numeric: tabular-nums;
        }

        @keyframes slideFadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .animated-appear {
            animation: slideFadeIn 0.4s cubic-bezier(0.2, 0, 0, 1) forwards;
        }

        .format-settings-wrapper {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 0 8px; /* 配合側邊欄的內距 */
        }

        .format-panel {
            background: var(--md-sys-color-surface-container-lowest);
            border: 1px solid var(--md-sys-color-outline-variant);
            border-radius: 12px; /* 側邊欄較小，圓角稍微收斂 */
            overflow: hidden;
            transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .format-panel:hover {
            border-color: var(--md-sys-color-outline);
        }

        .format-panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px; /* 縮小內距以適應窄邊欄 */
            cursor: pointer;
            user-select: none;
            background: transparent;
            transition: background 0.2s ease;
        }

        .format-panel-header:hover {
            background: var(--md-sys-color-surface-container-low);
        }

        .format-panel-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px; /* 稍微縮小字體 */
            font-weight: 600;
            color: var(--md-sys-color-on-surface);
        }

        .format-panel-title md-icon {
            font-size: 18px;
        }

        .expand-icon {
            font-size: 20px;
            color: var(--md-sys-color-on-surface-variant);
            transition: transform 0.3s cubic-bezier(0.2, 0, 0, 1);
        }

        .expand-icon.expanded {
            transform: rotate(180deg);
        }

        .expandable-panel {
            display: grid;
            grid-template-rows: 0fr;
            transition: grid-template-rows 0.3s cubic-bezier(0.2, 0, 0, 1);
        }

        .expandable-panel.expanded {
            grid-template-rows: 1fr;
        }

        .expandable-content {
            min-height: 0; 
        }

        .expandable-content-inner {
            padding: 0 16px 16px 16px; 
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .checkbox-label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: var(--md-sys-color-on-surface);
            cursor: pointer;
            user-select: none;
        }
    `;

    @state() private currentFile: FileReadyDetail | null = null;
    @state() private saveDirectory: string = '';
    @state() private saveFileName: string = '';

    @state() private isDarkMode = false;

    @state() private isSubmitting = false;

    @state() private activeFormatPanels = new Set<string>();

    @state() private jsonOptions: JsonFormatOptions = {
        convertKeys: false,
        convertValues: true
    };

    public async connectedCallback(): Promise<void> {
        super.connectedCallback();
        this.isDarkMode = await initializeDynamicTheme();
    }

    private handleFileReady(e: Event): void {
        const event = e as FileReadyEvent;
        if (!event.detail || !event.detail.content) return;
        
        this.currentFile = event.detail;

        if (this.currentFile.type === 'file' && this.currentFile.name) {
            const ext = this.currentFile.name.match(/\.[^.]+$/)?.[0].toLowerCase() || '';
            const baseName = this.currentFile.name.replace(/\.[^.]+$/, '');
            this.saveFileName = `${baseName}-converted${ext}`;

            if (ext === '.json' || ext === '.jsonl') {
                const newSet = new Set(this.activeFormatPanels);
                newSet.add('json');
                this.activeFormatPanels = newSet;
            }
        }
        else {
            this.saveFileName = '';
        }
    }

    private togglePanel(panelId: string): void {
        const newSet = new Set(this.activeFormatPanels);
        if (newSet.has(panelId)) {
            newSet.delete(panelId);
        }
        else {
            newSet.add(panelId);
        }
        this.activeFormatPanels = newSet;
    }

    private async handleSelectDirectory(): Promise<void> {
        const selected = await window.api.selectDirectory();
        if (!selected) return;
        this.saveDirectory = selected;
    }

    private async toggleTheme(): Promise<void> {
        this.isDarkMode = !this.isDarkMode;
        applyCurrentTheme(this.isDarkMode);

        if (window.api && window.api.setTheme) {
            await window.api.setTheme(this.isDarkMode);
        }
    }

    private async startConversion(): Promise<void> {
        if (!this.currentFile || this.isSubmitting) return;

        this.isSubmitting = true;

        try {
            let isDirValid = false;
            if (this.saveDirectory) {
                isDirValid = await window.api.checkDirectory(this.saveDirectory);
            }


            if (!isDirValid) {
                const selected = await window.api.selectDirectory();
                if (!selected) {
                    await window.api.showWarning('未選擇儲存路徑！任務已取消。');
                    return;
                }
                this.saveDirectory = selected;
            }

            const ext = this.currentFile.type === 'file' && this.currentFile.name 
                ? this.currentFile.name.match(/\.[^.]+$/)?.[0].toLowerCase() 
                : '';

            const payload: TaskPayload = {
                type: this.currentFile.type,
                contentOrPath: this.currentFile.type === 'file' ? this.currentFile.path! : this.currentFile.content,
                displayName: this.currentFile.type === 'file' ? this.currentFile.name! : '剪貼簿文字',
                saveDir: this.saveDirectory,
                saveName: this.saveFileName,
                formatOptions: (ext === '.json' || ext === '.jsonl') ? { ...this.jsonOptions } : undefined
            };

            await window.api.enqueueTask(payload);

            this.currentFile = null;
            this.saveFileName = '';
        }
        catch (error) {
            console.error('提交任務失敗:', error);
            await window.api.showWarning('提交任務失敗，請查看開發者工具。');
        }
        finally {
            this.isSubmitting = false;
        }
    }

    protected render() {
        return html`
            <div class="window-drag-area"></div>
            
            <div class="sidebar">
                <div class="sidebar-header">
                    <md-icon>translate</md-icon>
                    <h2>萬用繁簡轉換器</h2>
                </div>

                <div class="sidebar-content">
                    <div class="sidebar-title">格式專屬設定</div>
                    
                    <!-- ★ 格式面板移入側邊欄 -->
                    <div class="format-settings-wrapper">
                        <!-- JSON / JSONL 面板 -->
                        <div class="format-panel">
                            <div class="format-panel-header" @click="${() => this.togglePanel('json')}">
                                <div class="format-panel-title">
                                    <md-icon>data_object</md-icon>
                                    JSON / JSONL
                                </div>
                                <md-icon class="expand-icon ${this.activeFormatPanels.has('json') ? 'expanded' : ''}">
                                    expand_more
                                </md-icon>
                            </div>
                            
                            <div class="expandable-panel ${this.activeFormatPanels.has('json') ? 'expanded' : ''}">
                                <div class="expandable-content">
                                    <div class="expandable-content-inner">
                                        <label class="checkbox-label">
                                            <md-checkbox
                                                ?checked="${this.jsonOptions.convertKeys}"
                                                @change="${(e: Event) => this.jsonOptions = { ...this.jsonOptions, convertKeys: (e.target as HTMLInputElement).checked }}"
                                            ></md-checkbox>
                                            轉換鍵名 (Keys)
                                        </label>
                                        
                                        <label class="checkbox-label">
                                            <md-checkbox
                                                ?checked="${this.jsonOptions.convertValues}"
                                                @change="${(e: Event) => this.jsonOptions = { ...this.jsonOptions, convertValues: (e.target as HTMLInputElement).checked }}"
                                            ></md-checkbox>
                                            轉換數值 (Values)
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="sidebar-footer">
                    <md-outlined-button class="sidebar-btn" @click="${() => window.api.showProgressWindow()}">
                        <md-icon slot="icon">format_list_bulleted</md-icon>
                        任務佇列
                    </md-outlined-button>

                    <md-outlined-button class="sidebar-btn" @click="${this.toggleTheme}">
                        <md-icon slot="icon">${this.isDarkMode ? 'light_mode' : 'dark_mode'}</md-icon>
                        切換${this.isDarkMode ? '亮色' : '暗色'}主題
                    </md-outlined-button>
                    
                    <md-outlined-button class="sidebar-btn" @click="${() => {}}">
                        <md-icon slot="icon">settings</md-icon>
                        應用程式設定
                    </md-outlined-button>
                </div>
            </div>

            <div class="main-area">
                <div class="content-wrapper">
                    <drop-zone @file-ready="${this.handleFileReady}"></drop-zone>

                    <!-- 輸出設定依然留在主工作區 -->
                    <div class="settings-section">
                        <div class="section-title">
                            <md-icon>settings</md-icon>
                            輸出設定
                        </div>
                        
                        <div class="path-selector-area">
                            <md-filled-text-field
                                label="儲存資料夾"
                                value="${this.saveDirectory}"
                                @input="${(e: Event) => this.saveDirectory = (e.target as HTMLInputElement).value}"
                            >
                                <md-icon slot="leading-icon">folder</md-icon>
                            </md-filled-text-field>
                            <md-outlined-button @click="${this.handleSelectDirectory}">
                                瀏覽
                            </md-outlined-button>
                        </div>
                        
                        <md-filled-text-field
                            label="檔案名稱 (剪貼簿預設自動編號)"
                            value="${this.saveFileName}"
                            @input="${(e: Event) => this.saveFileName = (e.target as HTMLInputElement).value}"
                        >
                            <md-icon slot="leading-icon">description</md-icon>
                        </md-filled-text-field>
                    </div>

                    ${this.currentFile ? html`
                        <div class="action-area animated-appear">
                            <md-filled-button 
                                @click="${this.startConversion}" 
                                ?disabled="${this.isSubmitting}">
                                <md-icon slot="icon">send</md-icon>
                                ${this.isSubmitting ? '傳送中...' : `加入佇列 (${this.currentFile.type === 'file' ? this.currentFile.name : '剪貼簿'})`}
                            </md-filled-button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
}