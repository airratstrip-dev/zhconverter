// src/main/strategies/YamlStrategy.ts
import fs from 'fs/promises';
import { parseDocument, isMap, isSeq, isScalar, isPair, Document } from 'yaml';
import ZhConverter from '../../lib/ZhConverter';
import { ConverterOptions } from './StrategyFactory.js';
import type { YamlFormatOptions } from '../../types/global.js';

export interface YamlConverterOptions extends ConverterOptions, Partial<YamlFormatOptions> {}

interface YamlRef {
    obj: unknown;
    prop: 'value' | 'comment' | 'commentBefore';
    originalValue: string;
}

export class YamlStrategy {
    public static async execute(
        filePath: string,
        options: YamlConverterOptions,
        onProgress?: (progress: { current: number; total: number }) => void
    ): Promise<string> {
        if (!filePath) throw new Error('檔案路徑不能為空');

        const convertKeys = options.convertKeys ?? false;
        const convertValues = options.convertValues ?? true;
        const convertComments = options.convertComments ?? true;

        let rawContent = '';
        try {
            rawContent = await fs.readFile(filePath, 'utf-8');
        }
        catch (error) {
            throw new Error(`讀取 YAML 檔案失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        let doc: Document;
        try {
            doc = parseDocument(rawContent);
        }
        catch (error) {
            throw new Error(`YAML 解析失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        if (!convertKeys && !convertValues && !convertComments) return String(doc);

        const refs: YamlRef[] = [];

        const escapeText = (text: string): string => text.replace(/\\n/g, '\\\\n').replace(/\r?\n/g, '\\n');
        
        const unescapeText = (text: string): string => {
            return text.replace(/\\\\n|\\n/g, (match) => {
                if (match === '\\\\n') return '\\n';
                if (match === '\\n') return '\n';
                return match;
            });
        };

        const traverse = (item: unknown) => {
            if (!item || typeof item !== 'object') return;

            if (convertComments) {
                const record = item as Record<string, unknown>;
                if (typeof record.commentBefore === 'string') {
                    refs.push({ obj: item, prop: 'commentBefore', originalValue: record.commentBefore });
                }
                if (typeof record.comment === 'string') {
                    refs.push({ obj: item, prop: 'comment', originalValue: record.comment });
                }
            }

            if (isMap(item)) {
                item.items.forEach((pair) => traverse(pair));
            }
            else if (isSeq(item)) {
                item.items.forEach((child) => {
                    if (isScalar(child) && convertValues && typeof child.value === 'string') {
                        refs.push({ obj: child, prop: 'value', originalValue: child.value });
                    }
                    traverse(child);
                });
            }
            else if (isPair(item)) {
                if (isScalar(item.key) && convertKeys && typeof item.key.value === 'string') {
                    refs.push({ obj: item.key, prop: 'value', originalValue: item.key.value });
                }
                traverse(item.key);

                if (isScalar(item.value) && convertValues && typeof item.value.value === 'string') {
                    refs.push({ obj: item.value, prop: 'value', originalValue: item.value.value });
                }
                traverse(item.value);
            }
            else if (item instanceof Document) {
                if (isScalar(item.contents) && convertValues && typeof item.contents.value === 'string') {
                    refs.push({ obj: item.contents, prop: 'value', originalValue: item.contents.value });
                }
                traverse(item.contents);
            }
        };

        traverse(doc);

        if (refs.length === 0) return String(doc);

        const textsToConvert = refs.map(ref => escapeText(ref.originalValue));
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
            throw new Error(`YAML 轉換失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        const convertedLines = convertedFullText.split('\n');

        refs.forEach((ref, i) => {
            const convertedValue = unescapeText(convertedLines[i] || '');
            (ref.obj as Record<string, string>)[ref.prop] = convertedValue;
        });

        return String(doc);
    }
}