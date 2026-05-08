// src/renderer/app.styles.ts
import { css } from 'lit';

export const appStyles = css`
:host {
    display: flex;
    width: 100vw;
    height: 100vh;
    color: var(--md-sys-color-on-background);
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
    display: flex;
    flex-direction: column;
    gap: 8px;
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
    background: var(--md-sys-color-surface);
    overflow-y: auto;
    position: relative;
    display: flex;
    justify-content: center;
    padding-top: 32px;
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
`;