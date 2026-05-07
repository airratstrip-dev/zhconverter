// src/main/strategies/JsonStrategy.ts
import fs from 'fs/promises';
import ZhConverter from '../../lib/ZhConverter';
import { ConverterOptions } from './StrategyFactory.js';
import type { JsonFormatOptions } from '../../types/global.js';

// ★ 1. 嚴格的 JSON 遞迴型別定義，徹底消滅 any
export type JsonPrimitive = string | number | boolean | null;
export interface JsonObject { [key: string]: JsonValue; }
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

// ★ 2. 策略專屬的選項介面，結合通用選項與 JSON 專屬選項
export interface JsonConverterOptions extends ConverterOptions, Partial<JsonFormatOptions> {}

export class JsonStrategy {
    public static async execute(
        filePath: string,
        options: JsonConverterOptions,
        onProgress?: (progress: { current: number; total: number }) => void
    ): Promise<string> {
        
        if (!filePath) throw new Error('檔案路徑不能為空');

        // 預設為全轉，如果前端有透過 FormatOptions 傳遞，則以此為準
        const convertKeys = options.convertKeys ?? true;
        const convertValues = options.convertValues ?? true;

        let rawContent = '';
        try {
            rawContent = await fs.readFile(filePath, 'utf-8');
        } 
        catch (error) {
            throw new Error(`讀取 JSON 檔案失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        const isJsonl = filePath.toLowerCase().endsWith('.jsonl');
        
        // 使用我們剛剛定義的嚴格型別來承接解析結果
        let parsedData: JsonValue | JsonArray;

        try {
            if (isJsonl) {
                const lines = rawContent.split(/\r?\n/).filter(line => line.trim().length > 0);
                // 強制轉型為 JsonValue，讓後續的走訪受限於我們的介面
                parsedData = lines.map(line => JSON.parse(line) as JsonValue) as JsonArray;
            } 
            else {
                parsedData = JSON.parse(rawContent) as JsonValue;
            }
        } 
        catch (error) {
            throw new Error(`JSON 解析失敗，請確認檔案結構: ${error instanceof Error ? error.message : String(error)}`);
        }

        // 衛句：如果使用者選擇都不轉換，直接將原資料格式化後回傳
        if (!convertKeys && !convertValues) {
            return isJsonl 
                ? (parsedData as JsonArray).map(obj => JSON.stringify(obj)).join('\n') + '\n'
                : JSON.stringify(parsedData, null, 2);
        }

        // --- 第一階段：雙次確定性走訪 (萃取) ---
        const textsToConvert: string[] = [];

        // 逃脫邏輯：保護原本 JSON 字串內部的 \n
        const escapeText = (text: string): string => {
            return text.replace(/\\n/g, '\\\\n').replace(/\r?\n/g, '\\n');
        };

        const unescapeText = (text: string): string => {
            return text.replace(/\\\\n|\\n/g, (match) => {
                if (match === '\\\\n') return '\\n';
                if (match === '\\n') return '\n';
                return match;
            });
        };

        const extract = (node: JsonValue): void => {
            if (node === null || typeof node !== 'object') return;

            if (Array.isArray(node)) {
                for (const item of node) {
                    extract(item);
                }
            } 
            else {
                for (const [key, value] of Object.entries(node as JsonObject)) {
                    if (convertKeys) {
                        textsToConvert.push(escapeText(key));
                    }
                    if (typeof value === 'string') {
                        if (convertValues) {
                            textsToConvert.push(escapeText(value));
                        }
                    } 
                    else if (value !== null && typeof value === 'object') {
                        extract(value);
                    }
                }
            }
        };

        extract(parsedData);

        // 衛句：如果萃取後發現完全沒有字串需要轉換
        if (textsToConvert.length === 0) {
            return isJsonl 
                ? (parsedData as JsonArray).map(obj => JSON.stringify(obj)).join('\n') + '\n'
                : JSON.stringify(parsedData, null, 2);
        }

        // --- 核心轉換階段 ---
        const textForConverter = textsToConvert.join('\n');
        const converterOptions = {
            converter: options.converter || 'Taiwan',
            chunkSize: 4096, // 針對純字串調大區塊以提升效能
            batchSize: options.batchSize || 4,
            jitter: [100, 500] as [number, number],
            protect: options.protect ? new Set(options.protect) : new Set<string>(),
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
            throw new Error(`JSON 轉換失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        // --- 第二階段：雙次確定性走訪 (重建) ---
        const convertedLines = convertedFullText.split('\n');
        
        const rebuild = (node: JsonValue): JsonValue => {
            if (node === null || typeof node !== 'object') return node;

            if (Array.isArray(node)) {
                const newArr: JsonArray = [];
                for (const item of node) {
                    newArr.push(rebuild(item));
                }
                return newArr;
            } 
            else {
                const newObj: JsonObject = {};
                for (const [key, value] of Object.entries(node as JsonObject)) {
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

        // 5. 序列化並回傳
        return isJsonl 
            ? (rebuiltData as JsonArray).map(obj => JSON.stringify(obj)).join('\n') + '\n'
            : JSON.stringify(rebuiltData, null, 2);
    }
}