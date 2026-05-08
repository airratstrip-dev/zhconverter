// src/main/strategies/TomlStrategy.ts
import fs from 'fs/promises';
import * as toml from '@iarna/toml';
import ZhConverter from '../../lib/ZhConverter';
import { ConverterOptions } from './StrategyFactory.js';
import type { TomlFormatOptions } from '../../types/global.js';

export interface TomlConverterOptions extends ConverterOptions, Partial<TomlFormatOptions> {}

export class TomlStrategy {
    public static async execute(
        filePath: string,
        options: TomlConverterOptions,
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
            throw new Error(`讀取 TOML 檔案失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        let parsedData: Record<string, unknown>;
        try {
            parsedData = toml.parse(rawContent);
        }
        catch (error) {
            throw new Error(`TOML 解析失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        const knownKeys = new Set<string>();
        const knownValues = new Set<string>();

        const extractKnown = (node: unknown) => {
            if (node === null || node === undefined) return;
            if (node instanceof Date) return;

            if (Array.isArray(node)) {
                node.forEach(item => {
                    if (typeof item === 'string') knownValues.add(item);
                    else extractKnown(item);
                });
            }
            else if (typeof node === 'object') {
                for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
                    knownKeys.add(k);
                    if (typeof v === 'string') knownValues.add(v);
                    else extractKnown(v);
                }
            }
        };

        extractKnown(parsedData);

        const regex = /("""[\s\S]*?""")|('''[\s\S]*?''')|("(?:\\.|[^\\"\n])*")|('(?:\\.|[^\\'\n])*')|(#.*)/g;

        const refs: { index: number; length: number; rawText: string }[] = [];
        const textsToConvert: string[] = [];

        const escapeText = (text: string): string => text.replace(/\\n/g, '\\\\n').replace(/\r?\n/g, '\\n');
        const unescapeText = (text: string): string => text.replace(/\\\\n|\\n/g, (m) => m === '\\\\n' ? '\\n' : '\n');

        let match;
        while ((match = regex.exec(rawContent)) !== null) {
            const rawText = match[0];
            let isComment = false;
            let innerValue = '';

            if (match[5]) {
                isComment = true;
            }
            else {
                try {
                    const tmp = toml.parse(`x = ${rawText}`);
                    innerValue = tmp.x as string;
                }
                catch {
                    innerValue = rawText.replace(/^['"]+|['"]+$/g, '');
                }
            }

            let shouldConvert = false;

            if (isComment) {
                if (convertComments) shouldConvert = true;
            }
            else {
                const isK = knownKeys.has(innerValue);
                const isV = knownValues.has(innerValue);

                if (isK && convertKeys) shouldConvert = true;
                if (isV && convertValues) shouldConvert = true;
            }

            if (shouldConvert && rawText.trim().length > 0) {
                refs.push({ index: match.index, length: rawText.length, rawText });
                textsToConvert.push(escapeText(rawText));
            }
        }

        if (refs.length === 0) return rawContent;

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
            throw new Error(`TOML 轉換失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        const convertedLines = convertedFullText.split('\n');

        let finalContent = rawContent;
        for (let i = refs.length - 1; i >= 0; i--) {
            const ref = refs[i];
            const convertedValue = unescapeText(convertedLines[i] || '');
            finalContent = finalContent.substring(0, ref.index) + convertedValue + finalContent.substring(ref.index + ref.length);
        }

        return finalContent;
    }
}