// src/renderer/app.ts
import 'material-symbols/outlined.css';
import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/textfield/filled-text-field.js';
import '@material/web/icon/icon.js';
import '@material/web/checkbox/checkbox.js';
import './components/drop-zone.js';
import './components/format-panel.js';
import { initializeDynamicTheme, applyCurrentTheme } from './utils/theme.js';
import { FileReadyEvent, FileReadyDetail } from './events/FileReadyEvent.js';
import type { TaskPayload, JsonFormatOptions, XmlHtmlFormatOptions, YamlFormatOptions, TomlFormatOptions, AssFormatOptions, FormatOptions } from '../types/global.js';
import { appStyles } from './app.style.js';

@customElement('zh-converter-app')
export class ZhConverterApp extends LitElement {
    static styles = appStyles;

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
        convertAttributes: false,
        convertComments: true
    };

    @state() private yamlOptions: YamlFormatOptions = {
        convertKeys: false,
        convertValues: true,
        convertComments: true
    };

    @state() private tomlOptions: TomlFormatOptions = {
        convertKeys: false,
        convertValues: true,
        convertComments: true
    };

    @state() private assOptions: AssFormatOptions = {
        convertText: true,
        convertScriptInfo: false,
        convertComments: true
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
            const extMatch = this.currentFile.name.match(/\.[^.]+$/);
            const ext = extMatch ? extMatch[0].toLowerCase() : '';
            const baseName = this.currentFile.name.replace(/\.[^.]+$/, '');
            this.saveFileName = `${baseName}-converted${ext}`;

            const newSet = new Set(this.activeFormatPanels);
            if (ext === '.json' || ext === '.jsonl') newSet.add('json');
            else if (['.xml', '.html', '.htm', '.xhtml'].includes(ext)) newSet.add('xmlhtml');
            else if (ext === '.yaml' || ext === '.yml') newSet.add('yaml');
            else if (ext === '.toml') newSet.add('toml');
            else if (ext === '.ass' || ext === '.ssa') newSet.add('ass');
            this.activeFormatPanels = newSet;
        }
        else {
            this.saveFileName = '';
        }
    }

    private togglePanel(panelId: string): void {
        const newSet = new Set(this.activeFormatPanels);
        if (newSet.has(panelId)) newSet.delete(panelId);
        else newSet.add(panelId);
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
        if (window.api && window.api.setTheme) await window.api.setTheme(this.isDarkMode);
    }

    private async startConversion(): Promise<void> {
        if (!this.currentFile || this.isSubmitting) return;

        this.isSubmitting = true;

        try {
            let isDirValid = false;
            if (this.saveDirectory) isDirValid = await window.api.checkDirectory(this.saveDirectory);

            if (!isDirValid) {
                const selected = await window.api.selectDirectory();
                if (!selected) {
                    await window.api.showWarning('未選擇儲存路徑！任務已取消。');
                    return;
                }
                this.saveDirectory = selected;
            }

            const fileName = this.currentFile.name || '';
            const extMatch = fileName.match(/\.[^.]+$/);
            const ext = extMatch ? extMatch[0].toLowerCase() : '';

            let options: FormatOptions | undefined = undefined;
            if (ext === '.json' || ext === '.jsonl') options = { ...this.jsonOptions };
            else if (['.xml', '.html', '.htm', '.xhtml'].includes(ext)) options = { ...this.xmlHtmlOptions };
            else if (ext === '.yaml' || ext === '.yml') options = { ...this.yamlOptions };
            else if (ext === '.toml') options = { ...this.tomlOptions };
            else if (ext === '.ass' || ext === '.ssa') options = { ...this.assOptions };

            const payload: TaskPayload = {
                type: this.currentFile.type,
                contentOrPath: this.currentFile.type === 'file' ? this.currentFile.path! : this.currentFile.content,
                displayName: this.currentFile.name! || '剪貼簿文字',
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
                        <format-panel icon="data_object" label="JSON / JSONL" ?expanded="${this.activeFormatPanels.has('json')}" @toggle="${() => this.togglePanel('json')}">
                            <label class="checkbox-label">
                                <md-checkbox ?checked="${this.jsonOptions.convertKeys}" @change="${(e: Event) => this.jsonOptions = { ...this.jsonOptions, convertKeys: (e.target as HTMLInputElement).checked }}"></md-checkbox>
                                轉換鍵名 (Keys)
                            </label>
                            <label class="checkbox-label">
                                <md-checkbox ?checked="${this.jsonOptions.convertValues}" @change="${(e: Event) => this.jsonOptions = { ...this.jsonOptions, convertValues: (e.target as HTMLInputElement).checked }}"></md-checkbox>
                                轉換數值 (Values)
                            </label>
                        </format-panel>

                        <format-panel icon="code" label="XML / HTML" ?expanded="${this.activeFormatPanels.has('xmlhtml')}" @toggle="${() => this.togglePanel('xmlhtml')}">
                            <label class="checkbox-label">
                                <md-checkbox ?checked="${this.xmlHtmlOptions.convertText}" @change="${(e: Event) => this.xmlHtmlOptions = { ...this.xmlHtmlOptions, convertText: (e.target as HTMLInputElement).checked }}"></md-checkbox>
                                轉換文本內容
                            </label>
                            <label class="checkbox-label">
                                <md-checkbox ?checked="${this.xmlHtmlOptions.convertAttributes}" @change="${(e: Event) => this.xmlHtmlOptions = { ...this.xmlHtmlOptions, convertAttributes: (e.target as HTMLInputElement).checked }}"></md-checkbox>
                                轉換標籤屬性
                            </label>
                            <label class="checkbox-label">
                                <md-checkbox ?checked="${this.xmlHtmlOptions.convertComments}" @change="${(e: Event) => this.xmlHtmlOptions = { ...this.xmlHtmlOptions, convertComments: (e.target as HTMLInputElement).checked }}"></md-checkbox>
                                轉換註解
                            </label>
                        </format-panel>

                        <format-panel icon="segment" label="YAML / YML" ?expanded="${this.activeFormatPanels.has('yaml')}" @toggle="${() => this.togglePanel('yaml')}">
                            <label class="checkbox-label">
                                <md-checkbox ?checked="${this.yamlOptions.convertKeys}" @change="${(e: Event) => this.yamlOptions = { ...this.yamlOptions, convertKeys: (e.target as HTMLInputElement).checked }}"></md-checkbox>
                                轉換鍵名 (Keys)
                            </label>
                            <label class="checkbox-label">
                                <md-checkbox ?checked="${this.yamlOptions.convertValues}" @change="${(e: Event) => this.yamlOptions = { ...this.yamlOptions, convertValues: (e.target as HTMLInputElement).checked }}"></md-checkbox>
                                轉換數值 (Values)
                            </label>
                            <label class="checkbox-label">
                                <md-checkbox ?checked="${this.yamlOptions.convertComments}" @change="${(e: Event) => this.yamlOptions = { ...this.yamlOptions, convertComments: (e.target as HTMLInputElement).checked }}"></md-checkbox>
                                轉換註解
                            </label>
                        </format-panel>

                        <format-panel icon="reorder" label="TOML" ?expanded="${this.activeFormatPanels.has('toml')}" @toggle="${() => this.togglePanel('toml')}">
                            <label class="checkbox-label">
                                <md-checkbox ?checked="${this.tomlOptions.convertKeys}" @change="${(e: Event) => this.tomlOptions = { ...this.tomlOptions, convertKeys: (e.target as HTMLInputElement).checked }}"></md-checkbox>
                                轉換鍵名 (Keys)
                            </label>
                            <label class="checkbox-label">
                                <md-checkbox ?checked="${this.tomlOptions.convertValues}" @change="${(e: Event) => this.tomlOptions = { ...this.tomlOptions, convertValues: (e.target as HTMLInputElement).checked }}"></md-checkbox>
                                轉換數值 (Values)
                            </label>
                            <label class="checkbox-label">
                                <md-checkbox ?checked="${this.tomlOptions.convertComments}" @change="${(e: Event) => this.tomlOptions = { ...this.tomlOptions, convertComments: (e.target as HTMLInputElement).checked }}"></md-checkbox>
                                轉換註解
                            </label>
                        </format-panel>

                        <format-panel icon="subtitles" label="ASS / SSA" ?expanded="${this.activeFormatPanels.has('ass')}" @toggle="${() => this.togglePanel('ass')}">
                            <label class="checkbox-label">
                                <md-checkbox ?checked="${this.assOptions.convertText}" @change="${(e: Event) => this.assOptions = { ...this.assOptions, convertText: (e.target as HTMLInputElement).checked }}"></md-checkbox>
                                轉換字幕內文
                            </label>
                            <label class="checkbox-label">
                                <md-checkbox ?checked="${this.assOptions.convertScriptInfo}" @change="${(e: Event) => this.assOptions = { ...this.assOptions, convertScriptInfo: (e.target as HTMLInputElement).checked }}"></md-checkbox>
                                轉換腳本資訊 (標題, 作者...)
                            </label>
                            <label class="checkbox-label">
                                <md-checkbox ?checked="${this.assOptions.convertComments}" @change="${(e: Event) => this.assOptions = { ...this.assOptions, convertComments: (e.target as HTMLInputElement).checked }}"></md-checkbox>
                                轉換註解
                            </label>
                        </format-panel>
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
                    
                    <md-outlined-button class="sidebar-btn" @click="${() => { }}">
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
                            <md-filled-text-field label="儲存資料夾" value="${this.saveDirectory}" @input="${(e: Event) => this.saveDirectory = (e.target as HTMLInputElement).value}">
                                <md-icon slot="leading-icon">folder</md-icon>
                            </md-filled-text-field>
                            <md-outlined-button @click="${this.handleSelectDirectory}">瀏覽</md-outlined-button>
                        </div>
                        <md-filled-text-field label="檔案名稱 (剪貼簿預設自動編號)" value="${this.saveFileName}" @input="${(e: Event) => this.saveFileName = (e.target as HTMLInputElement).value}">
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