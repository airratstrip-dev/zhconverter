// src/main/strategies/CsvStrategy.ts
import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import ZhConverter from '../../lib/ZhConverter';
import { ConverterOptions } from './StrategyFactory.js';
import type { CsvFormatOptions } from '../../types/global.js';

export interface CsvConverterOptions extends ConverterOptions, Partial<CsvFormatOptions> {}

export class CsvStrategy {
    public static async execute(
        filePath: string,
        options: CsvConverterOptions,
        onProgress?: (progress: { current: number; total: number }) => void
    ): Promise<string> {
        if (!filePath) throw new Error('檔案路徑不能為空');

        let rawContent = '';
        try {
            rawContent = await fs.readFile(filePath, 'utf-8');
        }
        catch (error) {
            throw new Error(`讀取 CSV/TSV 檔案失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        const isTsv = filePath.toLowerCase().endsWith('.tsv');
        const delimiter = options.delimiter || (isTsv ? '\t' : ',');
        const recordDelimiter = rawContent.includes('\r\n') ? '\r\n' : '\n';

        let records: string[][] = [];
        try {
            records = parse(rawContent, {
                delimiter: delimiter,
                relax_column_count: true,
                skip_empty_lines: false
            });
        }
        catch (error) {
            throw new Error(`解析 CSV/TSV 失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        if (records.length === 0) return rawContent;

        const convertHeaders = options.convertHeaders ?? true;
        const isColWhitelist = options.isColumnWhitelist ?? false;
        const isRowWhitelist = options.isRowWhitelist ?? false;

        // 解析 Row 規則 (1-based index)
        const rowRules = new Set<number>();
        if (options.rowRules) {
            const parts = options.rowRules.split(',');
            for (const p of parts) {
                const val = parseInt(p.trim(), 10);
                if (!isNaN(val)) rowRules.add(val);
            }
        }

        // 解析 Column 規則
        const colRules = new Set<number>();
        if (options.columnRules) {
            const headerRow = records[0] || [];
            const parts = options.columnRules.split(',');
            
            for (const p of parts) {
                const trimmed = p.trim();
                let foundHeaderMatch = false;

                // 優先比對標頭字串 (解決標頭剛好是數字的衝突)
                for (let i = 0; i < headerRow.length; i++) {
                    if (headerRow[i] === trimmed) {
                        colRules.add(i); // 儲存為 0-based
                        foundHeaderMatch = true;
                    }
                }

                // 如果找不到對應的標頭，則嘗試解析為 1-based index
                if (!foundHeaderMatch) {
                    const val = parseInt(trimmed, 10);
                    if (!isNaN(val)) {
                        colRules.add(val - 1);
                    }
                }
            }
        }

        const textsToConvert: string[] = [];
        const refs: { r: number; c: number }[] = [];

        // 逃脫字元處理 (保護欄位原有的換行符號，防止干擾 ZhConverter)
        const escapeText = (text: string): string => text.replace(/\\n/g, '\\\\n').replace(/\r?\n/g, '\\n');
        const unescapeText = (text: string): string => text.replace(/\\\\n|\\n/g, (m) => m === '\\\\n' ? '\\n' : '\n');

        for (let r = 0; r < records.length; r++) {
            const row = records[r];

            // 處理 Row 過濾邏輯
            if (r === 0) {
                if (!convertHeaders) continue;
            }
            else {
                if (options.rowRules && options.rowRules.trim().length > 0) {
                    const inRule = rowRules.has(r + 1); // Row 是從 1 開始算
                    if (isRowWhitelist && !inRule) continue;
                    if (!isRowWhitelist && inRule) continue;
                }
            }

            for (let c = 0; c < row.length; c++) {
                const cell = row[c];
                if (!cell) continue;

                // 處理 Column 過濾邏輯
                if (options.columnRules && options.columnRules.trim().length > 0) {
                    const inRule = colRules.has(c);
                    if (isColWhitelist && !inRule) continue;
                    if (!isColWhitelist && inRule) continue;
                }

                textsToConvert.push(escapeText(cell));
                refs.push({ r, c });
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
            throw new Error(`CSV/TSV 轉換失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        const convertedLines = convertedFullText.split('\n');

        for (const ref of refs) {
            const converted = unescapeText(convertedLines.shift() || '');
            records[ref.r][ref.c] = converted;
        }

        let result = '';
        try {
            result = stringify(records, { delimiter, record_delimiter: recordDelimiter });
        }
        catch (error) {
            throw new Error(`生成 CSV/TSV 失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        return result;
    }
}