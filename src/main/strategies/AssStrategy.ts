// src/main/strategies/AssStrategy.ts
import fs from 'fs/promises';
import ZhConverter from '../../lib/ZhConverter';
import { ConverterOptions } from './StrategyFactory.js';
import type { AssFormatOptions } from '../../types/global.js';

export interface AssConverterOptions extends ConverterOptions, Partial<AssFormatOptions> {}

interface AssRef {
    lineIndex: number;
    type: 'simple' | 'complex';
    prefix: string;
    tokens?: { isTag: boolean; value: string }[];
}

export class AssStrategy {
    private static readonly INFO_WHITELIST = [
        'title', 
        'original script', 
        'original translation', 
        'original editing', 
        'original timing', 
        'synch point', 
        'script updated by', 
        'update details'
    ];

    public static async execute(
        filePath: string,
        options: AssConverterOptions,
        onProgress?: (progress: { current: number; total: number }) => void
    ): Promise<string> {
        if (!filePath) throw new Error('檔案路徑不能為空');

        const convertText = options.convertText ?? true;
        const convertScriptInfo = options.convertScriptInfo ?? false;
        const convertComments = options.convertComments ?? true;

        let rawContent = '';
        try {
            rawContent = await fs.readFile(filePath, 'utf-8');
        }
        catch (error) {
            throw new Error(`讀取 ASS/SSA 檔案失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        const lineEnding = rawContent.includes('\r\n') ? '\r\n' : '\n';
        const lines = rawContent.split(/\r?\n/);
        const refs: AssRef[] = [];
        const textsToConvert: string[] = [];

        const escapeText = (text: string): string => text.replace(/\\n/g, '\\\\n').replace(/\r?\n/g, '\\n');
        const unescapeText = (text: string): string => text.replace(/\\\\n|\\n/g, (m) => m === '\\\\n' ? '\\n' : '\n');

        let currentSection = '';
        let formatTextIndex = 9;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            if (trimmedLine.length === 0) continue;

            if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
                currentSection = trimmedLine;
                continue;
            }

            if (line.startsWith(';') || line.startsWith('#')) {
                if (convertComments && line.length > 1) {
                    const prefixChar = line[0];
                    refs.push({ lineIndex: i, type: 'simple', prefix: prefixChar });
                    textsToConvert.push(escapeText(line.substring(1)));
                }
                continue;
            }

            if (currentSection === '[Script Info]') {
                const colonIdx = line.indexOf(':');
                if (colonIdx !== -1) {
                    const key = line.substring(0, colonIdx).trim().toLowerCase();
                    const val = line.substring(colonIdx + 1);
                    
                    if (key === 'scripttype' && val.trim() === 'v4.00') {
                        formatTextIndex = 8;
                    }
                    
                    if (convertScriptInfo && AssStrategy.INFO_WHITELIST.includes(key) && val.trim().length > 0) {
                        refs.push({ lineIndex: i, type: 'simple', prefix: line.substring(0, colonIdx + 1) });
                        textsToConvert.push(escapeText(val));
                    }
                }
                continue;
            }

            if (currentSection === '[Events]') {
                if (line.startsWith('Format:')) {
                    const parts = line.substring(7).split(',');
                    const idx = parts.findIndex(p => p.trim().toLowerCase() === 'text');
                    if (idx !== -1) formatTextIndex = idx;
                    continue;
                }

                const isDialogue = line.startsWith('Dialogue:');
                const isComment = line.startsWith('Comment:');

                if (isDialogue || isComment) {
                    if (isComment && !convertComments) continue;
                    if (isDialogue && !convertText) continue;

                    const contentStart = line.indexOf(':') + 1;
                    const dataStr = line.substring(contentStart);
                    let commaCount = 0;
                    let splitPos = -1;

                    for (let j = 0; j < dataStr.length; j++) {
                        if (dataStr[j] === ',') {
                            commaCount++;
                            if (commaCount === formatTextIndex) {
                                splitPos = j;
                                break;
                            }
                        }
                    }

                    let actualText = '';
                    let preText = '';

                    if (splitPos === -1 && isComment) {
                        preText = line.substring(0, contentStart);
                        actualText = dataStr;
                    }
                    else if (splitPos !== -1) {
                        preText = line.substring(0, contentStart + splitPos + 1);
                        actualText = line.substring(contentStart + splitPos + 1);
                    }

                    if (actualText) {
                        const tagRegex = /(\{[^}]*\})/g;
                        const tokens = actualText.split(tagRegex);
                        const refTokens: { isTag: boolean; value: string }[] = [];
                        
                        for (const token of tokens) {
                            if (token.startsWith('{') && token.endsWith('}')) {
                                refTokens.push({ isTag: true, value: token });
                            }
                            else if (token.length > 0) {
                                refTokens.push({ isTag: false, value: token });
                                textsToConvert.push(escapeText(token));
                            }
                        }
                        refs.push({ lineIndex: i, type: 'complex', prefix: preText, tokens: refTokens });
                    }
                }
            }
        }

        if (textsToConvert.length === 0) return rawContent;

        const textForConverter = textsToConvert.join('\n');
        const converterOptions = {
            converter: options.converter || 'Taiwan',
            chunkSize: 4096,
            batchSize: options.batchSize || 4,
            jitter: [100, 500] as [number, number],
            protect: options.protect ? new Set(options.protect) : new Set<string>()
        };

        const converter = new ZhConverter(textForConverter, converterOptions);
        const trackProgress = async () => {
            try {
                for await (const progress of converter) {
                    if (onProgress) onProgress(progress);
                }
            }
            catch {
                console.debug('進度追蹤已終止');
            }
        };
        trackProgress();

        let convertedFullText = '';
        try {
            convertedFullText = await converter;
        }
        catch (error) {
            throw new Error(`ASS/SSA 轉換失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        const convertedLines = convertedFullText.split('\n');

        for (const ref of refs) {
            if (ref.type === 'simple') {
                const converted = unescapeText(convertedLines.shift() || '');
                lines[ref.lineIndex] = ref.prefix + converted;
            }
            else if (ref.type === 'complex' && ref.tokens) {
                let newLine = ref.prefix;
                for (const token of ref.tokens) {
                    if (token.isTag) {
                        newLine += token.value;
                    }
                    else if (token.value.length > 0) {
                        newLine += unescapeText(convertedLines.shift() || '');
                    }
                }
                lines[ref.lineIndex] = newLine;
            }
        }

        return lines.join(lineEnding);
    }
}