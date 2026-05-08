// src/main/strategies/YamlStrategy.ts
import fs from 'fs/promises';
import yaml from 'yaml';
import ZhConverter from '../../lib/ZhConverter';
import { ConverterOptions } from './StrategyFactory.js';
import type { YamlFormatOptions } from '../../types/global.js';

export type YamlPrimitive = string | number | boolean | null;
export type YamlArray = YamlValue[];
export interface YamlObject { [key: string]: YamlValue; }
export type YamlValue = YamlPrimitive | YamlArray | YamlObject;

export interface YamlConverterOptions extends ConverterOptions, Partial<YamlFormatOptions> {}

export class YamlStrategy {
    public static async execute(
        filePath: string,
        options: YamlConverterOptions,
        onProgress?: (progress: { current: number; total: number }) => void
    ): Promise<string> {
        if (!filePath) throw new Error('檔案路徑不能為空');

        const convertKeys = options.convertKeys ?? false;
        const convertValues = options.convertValues ?? true;

        let rawContent = '';
        try {
            rawContent = await fs.readFile(filePath, 'utf-8');
        }
        catch (error) {
            throw new Error(`讀取 YAML 檔案失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        let parsedData: YamlValue;
        try {
            parsedData = yaml.parse(rawContent) as YamlValue;
        }
        catch (error) {
            throw new Error(`YAML 解析失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        if (!convertKeys && !convertValues) return yaml.stringify(parsedData);

        const textsToConvert: string[] = [];

        const escapeText = (text: string): string => text.replace(/\\n/g, '\\\\n').replace(/\r?\n/g, '\\n');
        
        const unescapeText = (text: string): string => {
            return text.replace(/\\\\n|\\n/g, (match) => {
                if (match === '\\\\n') return '\\n';
                if (match === '\\n') return '\n';
                return match;
            });
        };

        const extract = (node: YamlValue): void => {
            if (node === null || typeof node !== 'object') return;

            if (Array.isArray(node)) {
                for (const item of node) extract(item);
            }
            else {
                for (const [key, value] of Object.entries(node as YamlObject)) {
                    if (convertKeys) textsToConvert.push(escapeText(key));
                    
                    if (typeof value === 'string') {
                        if (convertValues) textsToConvert.push(escapeText(value));
                    }
                    else if (value !== null && typeof value === 'object') {
                        extract(value);
                    }
                }
            }
        };

        extract(parsedData);

        if (textsToConvert.length === 0) return yaml.stringify(parsedData);

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

        const rebuild = (node: YamlValue): YamlValue => {
            if (node === null || typeof node !== 'object') return node;

            if (Array.isArray(node)) {
                return node.map(item => rebuild(item));
            }
            else {
                const newObj: YamlObject = {};
                for (const [key, value] of Object.entries(node as YamlObject)) {
                    let newKey = key;
                    if (convertKeys) {
                        const shifted = convertedLines.shift() || '';
                        newKey = unescapeText(shifted);
                    }

                    let newValue = value;
                    if (typeof value === 'string') {
                        if (convertValues) {
                            const shifted = convertedLines.shift() || '';
                            newValue = unescapeText(shifted);
                        }
                    }
                    else if (value !== null && typeof value === 'object') {
                        newValue = rebuild(value);
                    }
                    newObj[newKey] = newValue;
                }
                return newObj;
            }
        };

        const rebuiltData = rebuild(parsedData);
        return yaml.stringify(rebuiltData);
    }
}