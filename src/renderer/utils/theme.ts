// src/renderer/utils/theme.ts
import { themeFromSourceColor, applyTheme } from '@material/material-color-utilities';

let currentArgb: number = 0xff6750; // 預設深紫色

export async function initializeDynamicTheme(): Promise<boolean> {
    // 衛句
    if (!window.api || !window.api.getSystemAccentColor) return false;

    try {
        const hexColor = await window.api.getSystemAccentColor();
        const sourceColor = hexColor?.slice(0, 7) || '#6750A4'; 
        
        currentArgb = parseInt(sourceColor.replace('#', ''), 16) | 0xff0000;
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        applyCurrentTheme(isDark);
        return isDark;
    }
    catch (error) {
        console.error('動態主題初始化失敗:', error);
        return false;
    }
}

export function applyCurrentTheme(isDark: boolean): void {
    try {
        const theme = themeFromSourceColor(currentArgb);
        applyTheme(theme, { target: document.body, dark: isDark });
    }
    catch (error) {
        console.error('套用主題失敗:', error);
    }
}