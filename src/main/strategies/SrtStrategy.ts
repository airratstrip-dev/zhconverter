// src/main/strategies/SrtStrategy.ts
import fs from 'fs/promises';
import ZhConverter from '../../lib/ZhConverter';
import { ConverterOptions } from './StrategyFactory.js';

export class SrtStrategy {
    public static async execute(
        filePath: string,
        options: ConverterOptions,
        onProgress?: (progress: { current: number; total: number }) => void
    ): Promise<string> {
        
        if (!filePath) throw new Error('檔案路徑不能為空');

        let rawContent = '';
        try {
            rawContent = await fs.readFile(filePath, 'utf-8');
        }
        catch (error) {
            throw new Error(`讀取 SRT 檔案失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        // 1. 解析 SRT：以空白行拆分區塊
        const blocks = rawContent.trim().split(/\r?\n\r?\n/);
        
        const parsedBlocks = blocks.map(block => {
            // SRT 規範：第一行是序號，第二行是時間軸，後面是字幕內容
            const match = block.match(/^(.*?)\r?\n(.*?)\r?\n([\s\S]*)$/);
            if (!match) {
                // 不符合標準格式（例如損壞或空塊），保留原樣不轉換
                return { isStandard: false, raw: block, text: '' };
            }
            return {
                isStandard: true,
                index: match[1],
                time: match[2],
                text: match[3],
                raw: block
            };
        });

        // 2. 提取並編碼要轉換的文字
        const textsToConvert = parsedBlocks.map(b => {
            if (!b.isStandard) return '';
            
            let encoded = b.text;
            // 步驟 A：先逃脫原本就存在的字串 \n -> \\n
            encoded = encoded.replace(/\\n/g, '\\\\n');
            // 步驟 B：再將真實的換行符變成字串 \n
            encoded = encoded.replace(/\r?\n/g, '\\n');
            return encoded;
        });

        // 將所有字幕塊用真實的 \n 串接，這樣 ZhConverter 每一行剛好對應一個字幕塊
        const textForConverter = textsToConvert.join('\n');

        // 3. 呼叫 ZhConverter
        const converterOptions = {
            converter: options.converter || 'Taiwan',
            chunkSize: options.chunkSize || 512,
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
            throw new Error(`SRT 轉換過程失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        // 4. 解碼並重組 SRT
        const convertedLines = convertedFullText.split('\n');

        const finalBlocks = parsedBlocks.map((b, i) => {
            if (!b.isStandard) return b.raw;

            let decoded = convertedLines[i] || '';
            
            // 解碼：把 \\n 變回字串 \n，把字串 \n 變回真實換行
            // 使用 | 確保只 match 一次，不會發生連鎖錯誤替換
            decoded = decoded.replace(/\\\\n|\\n/g, (match) => {
                if (match === '\\\\n') return '\\n';
                if (match === '\\n') return '\n'; 
                return match;
            });

            return `${b.index}\n${b.time}\n${decoded}`;
        });

        // SRT 每個區塊之間需要一個空行，最後也要留一個空行確保播放器相容性
        return finalBlocks.join('\n\n') + '\n';
    }
}