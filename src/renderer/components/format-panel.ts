// src/renderer/components/format-panel.ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '@material/web/icon/icon.js';

@customElement('format-panel')
export class FormatPanel extends LitElement {
    @property({ type: String }) icon = '';
    @property({ type: String }) label = '';
    @property({ type: Boolean }) expanded = false;

    static styles = css`
        :host {
            display: block;
            background: var(--md-sys-color-surface-container-lowest);
            border: 1px solid var(--md-sys-color-outline-variant);
            border-radius: 12px;
            overflow: hidden;
            transition: border-color 0.3s ease, box-shadow 0.3s ease;
            margin-bottom: 8px;
        }

        :host(:hover) {
            border-color: var(--md-sys-color-outline);
        }

        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            cursor: pointer;
            user-select: none;
            background: transparent;
            transition: background 0.2s ease;
        }

        .header:hover {
            background: var(--md-sys-color-surface-container-low);
        }

        .title-wrapper {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 600;
            color: var(--md-sys-color-on-surface);
        }

        .title-wrapper md-icon {
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

        .content-container {
            min-height: 0;
        }

        .content-inner {
            padding: 0 16px 16px 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
    `;

    private toggle() {
        this.dispatchEvent(new CustomEvent('toggle', {
            bubbles: true,
            composed: true
        }));
    }

    protected render() {
        return html`
            <div class="header" @click="${this.toggle}">
                <div class="title-wrapper">
                    <md-icon>${this.icon}</md-icon>
                    ${this.label}
                </div>
                <md-icon class="expand-icon ${this.expanded ? 'expanded' : ''}">
                    expand_more
                </md-icon>
            </div>
            <div class="expandable-panel ${this.expanded ? 'expanded' : ''}">
                <div class="content-container">
                    <div class="content-inner">
                        <slot></slot>
                    </div>
                </div>
            </div>
        `;
    }
}