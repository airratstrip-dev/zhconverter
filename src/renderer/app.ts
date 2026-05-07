// src/renderer/app.ts
import 'material-symbols/outlined.css';
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/textfield/filled-text-field.js';
import '@material/web/icon/icon.js';
import '@material/web/checkbox/checkbox.js';
import './components/drop-zone.js';
import { initializeDynamicTheme, applyCurrentTheme } from './utils/theme.js';
import { FileReadyEvent, FileReadyDetail } from './events/FileReadyEvent.js';
import type { TaskPayload, JsonFormatOptions, XmlHtmlFormatOptions, FormatOptions } from '../types/global.js';

@customElement('zh-converter-app')
export class ZhConverterApp extends LitElement {
    static styles = css`
        :host {
            display: flex;
            width: 100vw;
            height: 100vh;
            background-color: var(--md-sys-color-surface);
            color: var(--md-sys-color-on-surface);
        }

        .window-drag-area {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 32px;
            -webkit-app-region: drag;
            z-index: 1000;
        }

        md-filled-text-field {
            flex-grow: 1;
            --md-filled-text-field-container-shape: 12px;
            --md-filled-text-field-container-color: var(--md-sys-color-background);
        }

        .sidebar {
            width: 260px;
            background-color: var(--md-sys-color-surface-container-low);
            border-right: 1px solid var(--md-sys-color-outline-variant);
            display: flex;
            flex-direction: column;
            padding: 48px 12px 16px 12px;
            box-sizing: border-box;
            z-index: 10;
        }

        .sidebar-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 32px;
            padding-left: 8px;
        }

        .sidebar-header md-icon {
            color: var(--md-sys-color-primary);
            font-size: 28px;
        }

        .sidebar-header h2 {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }

        .sidebar-content {
            flex-grow: 1;
            overflow-y: auto;
        }

        .sidebar-title {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--md-sys-color-on-surface-variant);
            margin: 24px 0 12px 8px;
        }

        .sidebar-footer {
            margin-top: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .sidebar-btn {
            --md-outlined-button-container-shape: 12px;
            width: 100%;
        }

        .main-area {
            flex-grow: 1;
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 32px;
            overflow-y: auto;
        }

        .content-wrapper {
            width: 100%;
            max-width: 600px;
            display: flex;
            flex-direction: column;
            gap: 32px;
        }

        .settings-section {
            background-color: var(--md-sys-color-surface-container-lowest);
            border-radius: 24px;
            padding: 24px;
            border: 1px solid var(--md-sys-color-outline-variant);
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .section-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            font-weight: 700;
            color: var(--md-sys-color-primary);
            margin-bottom: 4px;
        }

        .path-selector-area {
            display: flex;
            gap: 12px;
            align-items: flex-start;
        }

        .path-selector-area md-filled-text-field {
            flex-grow: 1;
        }

        .format-settings-wrapper {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 0 8px;
        }

        .format-panel {
            background: var(--md-sys-color-surface-container-lowest);
            border: 1px solid var(--md-sys-color-outline-variant);
            border-radius: 12px;
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
            padding: 12px 16px;
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
            font-size: 13px;
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

        .action-area {
            display: flex;
            justify-content: center;
            margin-top: 8px;
        }

        .action-area md-filled-button {
            --md-filled-button-container-shape: 16px;
            min-width: 200px;
            height: 56px;
            font-size: 16px;
        }

        .animated-appear {
            animation: slideUp 0.4s cubic-bezier(0.2, 0, 0, 1) forwards;
        }

        @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
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

    @state() private xmlHtmlOptions: XmlHtmlFormatOptions = {
        convertText: true,
        convertAttributes: false
    };

    public async connectedCallback(): Promise<void> {
        super.connectedCallback();
        this.isDarkMode = await initializeDynamicTheme();
        
        if (window.api && window.api.onThemeChanged) {
            window.api.onThemeChanged((isDark) => {
                this.isDarkMode = isDark;
                applyCurrentTheme(isDark);
            });
        }
    }

    private handleFileReady(e: Event): void {
        const event = e as FileReadyEvent;
        if (!event.detail || !event.detail.content) {
            return;
        }
        
        this.currentFile = event.detail;

        if (this.currentFile.type === 'file' && this.currentFile.name) {
            const ext = this.currentFile.name.match(/\.[^.]+$/)?.[0].toLowerCase() || '';
            const baseName = this.currentFile.name.replace(/\.[^.]+$/, '');
            this.saveFileName = `${baseName}-converted${ext}`;

            const newSet = new Set(this.activeFormatPanels);
            if (ext === '.json' || ext === '.jsonl') {
                newSet.add('json');
            }
            else if (['.xml', '.html', '.htm', '.xhtml'].includes(ext)) {
                newSet.add('xmlhtml');
            }
            this.activeFormatPanels = newSet;
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
        if (!selected) {
            return;
        }
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

            const extMatch = (this.currentFile.type === 'file' && this.currentFile.name)
                ? this.currentFile.name.match(/\.[^.]+$/)
                : null;
            const ext = extMatch ? extMatch[0].toLowerCase() : '';

            let options: FormatOptions | undefined = undefined;
            if (ext === '.json' || ext === '.jsonl') {
                options = { ...this.jsonOptions };
            }
            else if (['.xml', '.html', '.htm', '.xhtml'].includes(ext)) {
                options = { ...this.xmlHtmlOptions };
            }

            const payload: TaskPayload = {
                type: this.currentFile.type,
                contentOrPath: this.currentFile.type === 'file' ? this.currentFile.path! : this.currentFile.content,
                displayName: this.currentFile.type === 'file' ? this.currentFile.name! : '剪貼簿文字',
                saveDir: this.saveDirectory,
                saveName: this.saveFileName,
                formatOptions: options
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
                    
                    <div class="format-settings-wrapper">
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

                        <div class="format-panel">
                            <div class="format-panel-header" @click="${() => this.togglePanel('xmlhtml')}">
                                <div class="format-panel-title">
                                    <md-icon>code</md-icon>
                                    XML / HTML
                                </div>
                                <md-icon class="expand-icon ${this.activeFormatPanels.has('xmlhtml') ? 'expanded' : ''}">
                                    expand_more
                                </md-icon>
                            </div>
                            <div class="expandable-panel ${this.activeFormatPanels.has('xmlhtml') ? 'expanded' : ''}">
                                <div class="expandable-content">
                                    <div class="expandable-content-inner">
                                        <label class="checkbox-label">
                                            <md-checkbox
                                                ?checked="${this.xmlHtmlOptions.convertText}"
                                                @change="${(e: Event) => this.xmlHtmlOptions = { ...this.xmlHtmlOptions, convertText: (e.target as HTMLInputElement).checked }}"
                                            ></md-checkbox>
                                            轉換文本內容
                                        </label>
                                        <label class="checkbox-label">
                                            <md-checkbox
                                                ?checked="${this.xmlHtmlOptions.convertAttributes}"
                                                @change="${(e: Event) => this.xmlHtmlOptions = { ...this.xmlHtmlOptions, convertAttributes: (e.target as HTMLInputElement).checked }}"
                                            ></md-checkbox>
                                            轉換標籤屬性 (alt, title...)
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
                            <md-outlined-button @click="${this.handleSelectDirectory}">瀏覽</md-outlined-button>
                        </div>
                        <md-filled-text-field
                            label="檔案名稱"
                            value="${this.saveFileName}"
                            @input="${(e: Event) => this.saveFileName = (e.target as HTMLInputElement).value}"
                        >
                            <md-icon slot="leading-icon">description</md-icon>
                        </md-filled-text-field>
                    </div>

                    ${this.currentFile ? html`
                        <div class="action-area animated-appear">
                            <md-filled-button @click="${this.startConversion}" ?disabled="${this.isSubmitting}">
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