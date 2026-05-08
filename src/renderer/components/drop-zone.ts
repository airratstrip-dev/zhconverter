// src/renderer/components/drop-zone.ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '@material/web/elevation/elevation.js';
import '@material/web/icon/icon.js';
import { FileReadyEvent } from '../events/FileReadyEvent.js';

@customElement('drop-zone')
export class DropZone extends LitElement {
    static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 300px;
      position: relative;
      border-radius: 24px;
      transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
      background: var(--md-sys-color-surface-container-low);
      border: 2px dashed var(--md-sys-color-outline-variant);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--md-sys-color-on-surface-variant);
    }
    :host([dragover]) {
      background: var(--md-sys-color-primary-container);
      border-color: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary-container);
      transform: scale(1.02);
    }
    md-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
    }
  `;

    @property({ type: Boolean, reflect: true })
    public dragover = false;

    public connectedCallback(): void {
        super.connectedCallback();
        window.addEventListener('paste', this.handlePaste);
        
        this.addEventListener('dragover', this.handleDragOver);
        this.addEventListener('dragleave', this.handleDragLeave);
        this.addEventListener('drop', this.handleDrop);
    }

    public disconnectedCallback(): void {
        window.removeEventListener('paste', this.handlePaste);
        this.removeEventListener('dragover', this.handleDragOver);
        this.removeEventListener('dragleave', this.handleDragLeave);
        this.removeEventListener('drop', this.handleDrop);
        super.disconnectedCallback();
    }

    private handleDragOver = (e: DragEvent): void => {
        e.preventDefault();
        this.dragover = true;
    };

    private handleDragLeave = (e: DragEvent): void => {
        e.preventDefault();
        this.dragover = false;
    };

    private handleDrop = (e: DragEvent): void => {
        e.preventDefault();
        this.dragover = false;

        if (!e.dataTransfer || !e.dataTransfer.files.length) return;

        const file = e.dataTransfer.files[0];
        
        const filePath = window.api.getFilePath(file);
        if (!filePath) return;

        this.dispatchEvent(new FileReadyEvent({ 
            type: 'file', 
            content: file.name, 
            path: filePath,
            name: file.name
        }));
    };


    private handlePaste = (e: ClipboardEvent): void => {
        if (!e.clipboardData) return;

        const text = e.clipboardData.getData('text');
        
        if (!text) return;

        this.dispatchEvent(new FileReadyEvent({ type: 'clipboard', content: text }));
    };
    
    protected render() {
        return html`
            <md-elevation></md-elevation>
            <md-icon>upload_file</md-icon>
            <h2>拖曳檔案至此，或按 Ctrl+V 貼上文字</h2>
            <p>支援 .txt, .md, .srt, .json, .jsonl, .xml, .html, .yaml, .toml, .ass</p>
        `;
    }
}