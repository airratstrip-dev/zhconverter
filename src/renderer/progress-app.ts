// src/renderer/progress-app.ts
import 'material-symbols/outlined.css';
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@material/web/progress/linear-progress.js';
import '@material/web/icon/icon.js';
import { initializeDynamicTheme, applyCurrentTheme } from './utils/theme.js';
import '@material/web/iconbutton/icon-button.js';

interface TaskState {
    id: string;
    displayName: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    progress: number;
    errorMessage?: string;
}

@customElement('zh-progress-app')
export class ZhProgressApp extends LitElement {
    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            width: 100vw;
            height: 100vh;
            background: var(--md-sys-color-surface);
            color: var(--md-sys-color-on-surface);
            box-sizing: border-box;
        }

        .window-drag-area {
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 32px;
            -webkit-app-region: drag;
            z-index: 1000;
        }

        .header {
            padding: 16px 24px 16px 24px;
            border-bottom: 1px solid var(--md-sys-color-outline-variant);
            background: var(--md-sys-color-surface-container-low);
            -webkit-app-region: drag; 
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .close-btn {
            -webkit-app-region: no-drag; /* ★ 致命關鍵：讓按鈕恢復點擊功能 */
            color: var(--md-sys-color-on-surface-variant);
        }

        .header h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 700;
            color: var(--md-sys-color-primary);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .task-list {
            flex-grow: 1;
            overflow-y: auto;
            padding: 16px 24px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            -webkit-app-region: no-drag;
        }

        .task-card {
            background: var(--md-sys-color-surface-container-lowest);
            border: 1px solid var(--md-sys-color-outline-variant);
            border-radius: 16px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            transition: all 0.3s ease;
        }

        .task-card[data-status="processing"] {
            border-color: var(--md-sys-color-primary);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .task-info {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .task-name {
            font-size: 14px;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 220px;
        }

        .status-icon {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            font-weight: 500;
        }

        /* 狀態顏色定義 */
        .status-pending { color: var(--md-sys-color-outline); }
        .status-processing { color: var(--md-sys-color-primary); }
        .status-completed { color: #388E3C; /* 綠色 */ }
        .status-error { color: var(--md-sys-color-error); }

        md-linear-progress {
            width: 100%;
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--md-sys-color-outline);
            gap: 16px;
            opacity: 0.7;
        }

        .empty-state md-icon {
            font-size: 48px;
        }
    `;

    @state() private tasks: TaskState[] = [];
    @state() private isDarkMode = false;

    public async connectedCallback(): Promise<void> {
        super.connectedCallback();
        
        // 先建立 Material Theme 所需的種子顏色基礎
        this.isDarkMode = await initializeDynamicTheme();
        
        // 向主進程同步真實的當前主題狀態
        if (window.api && window.api.getTheme) {
            this.isDarkMode = await window.api.getTheme();
            applyCurrentTheme(this.isDarkMode);
        }

        if (window.api && window.api.getQueueState) {
            this.tasks = await window.api.getQueueState();
        }

        if (window.api && window.api.onQueueUpdated) {
            window.api.onQueueUpdated((updatedQueue) => {
                this.tasks = updatedQueue;
                this.scrollToBottom();
            });
        }

        if (window.api && window.api.onThemeChanged) {
            window.api.onThemeChanged((isDark) => {
                this.isDarkMode = isDark;
                applyCurrentTheme(this.isDarkMode);
            });
        }
    }

    private scrollToBottom(): void {
        setTimeout(() => {
            const list = this.shadowRoot?.querySelector('.task-list');
            if (list) {
                list.scrollTop = list.scrollHeight;
            }
        }, 50);
    }

    private renderStatus(task: TaskState) {
        if (task.status === 'pending') {
            return html`<div class="status-icon status-pending"><md-icon style="font-size: 16px;">schedule</md-icon> 等待中</div>`;
        } 
        else if (task.status === 'processing') {
            return html`<div class="status-icon status-processing"><md-icon style="font-size: 16px;">sync</md-icon> 轉換中 ${Math.round(task.progress * 100)}%</div>`;
        } 
        else if (task.status === 'completed') {
            return html`<div class="status-icon status-completed"><md-icon style="font-size: 16px;">check_circle</md-icon> 已完成</div>`;
        } 
        else {
            return html`<div class="status-icon status-error"><md-icon style="font-size: 16px;">error</md-icon> 失敗</div>`;
        }
    }

    private handleClose(): void {
        if (window.api && window.api.closeProgressWindow) {
            window.api.closeProgressWindow();
        }
    }

    protected render() {
        return html`
            <div class="window-drag-area"></div>
            
            <div class="header">
                <h1><md-icon>format_list_bulleted</md-icon> 轉換任務佇列</h1>
                <md-icon-button class="close-btn" @click="${this.handleClose}">
                    <md-icon>close</md-icon>
                </md-icon-button>
            </div>

            <div class="task-list">
                ${this.tasks.length === 0 ? html`
                    <div class="empty-state">
                        <md-icon>inbox</md-icon>
                        <div>目前沒有任務</div>
                    </div>
                ` : this.tasks.map(task => html`
                    <div class="task-card" data-status="${task.status}">
                        <div class="task-info">
                            <div class="task-name" title="${task.displayName}">${task.displayName}</div>
                            ${this.renderStatus(task)}
                        </div>
                        
                        ${task.status === 'processing' ? html`
                            <md-linear-progress value="${task.progress}"></md-linear-progress>
                        ` : ''}
                        
                        ${task.status === 'error' && task.errorMessage ? html`
                            <div style="font-size: 12px; color: var(--md-sys-color-error); margin-top: -4px;">
                                ${task.errorMessage}
                            </div>
                        ` : ''}
                    </div>
                `)}
            </div>
        `;
    }
}