// src/main/strategies/TxtStrategy.ts
import fs from 'fs/promises';
import ZhConverter from '../../lib/ZhConverter';

export interface ConverterOptions {
    converter?: string;
    chunkSize?: number;
    batchSize?: number;
    protect?: string[];
}

export class TxtStrategy {
    public static async execute(
        filePath: string, 
        options: ConverterOptions, 
        onProgress?: (progress: { current: number; total: number }) => void
    ): Promise<string> {
        
        if (!filePath) throw new Error('檔案路徑不能為空');

        let text = '';
        try {
            text = await fs.readFile(filePath, 'utf-8');
        }
        catch (error) {
            throw new Error(`讀取檔案失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        const converterOptions = {
            converter: options.converter || 'Taiwan',
            chunkSize: options.chunkSize || 512,
            batchSize: options.batchSize || 12,
            jitter: [100, 600] as [number, number],
            protect: options.protect ? new Set(options.protect) : new Set<string>(),
            retry: {
                times: 8,
                delay: (times: number) => 200 * times ** 2,
                jitter: [200, 700] as [number, number]
            }
        };

        const converter = new ZhConverter(text, converterOptions);

        const trackProgress = async () => {
            try {
                for await (const progress of converter) {
                    if (!onProgress) continue;
                    onProgress(progress);
                }
            }
            catch {
                console.debug('進度追蹤已終止');
            }
        };

        trackProgress();

        let result = '';
        try {
            result = await converter;
        }
        catch (error) {
            throw new Error(`轉換過程失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        // 不在這裡存檔了，把結果還給呼叫者
        return result;
    }
}