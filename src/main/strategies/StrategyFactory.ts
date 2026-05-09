// src/main/strategies/StrategyFactory.ts
import path from 'path';
import { TxtStrategy } from './TxtStrategy.js';
import { SrtStrategy } from './SrtStrategy.js';
import { JsonStrategy } from './JsonStrategy.js';
import { XmlHtmlStrategy } from './XmlHtmlStrategy.js';
import { YamlStrategy } from './YamlStrategy.js';
import { TomlStrategy } from './TomlStrategy.js';
import { AssStrategy } from './AssStrategy.js';
import { CsvStrategy } from './CsvStrategy.js';
import { EpubStrategy } from './EpubStrategy.js';
import { DocxStrategy } from './DocxStrategy.js';

export interface ConverterOptions {
    converter?: string;
    chunkSize?: number;
    batchSize?: number;
    protect?: string[];
}

export class StrategyFactory {
    public static getStrategy(filePath: string) {
        if (!filePath) throw new Error('無效的檔案路徑');

        const ext = path.extname(filePath).toLowerCase();

        switch (ext) {
        case '.md':
        case '.log':
        case '.txt':
            return TxtStrategy;
        case '.srt':
            return SrtStrategy;
        case '.json':
        case '.jsonl':
            return JsonStrategy;
        case '.xml':
        case '.html':
        case '.htm':
        case '.xhtml':
            return XmlHtmlStrategy;
        case '.yaml':
        case '.yml':
            return YamlStrategy;
        case '.toml':
            return TomlStrategy;
        case '.ass':
        case '.ssa':
            return AssStrategy;
        case '.csv':
        case '.tsv':
            return CsvStrategy;
        case '.epub':
            return EpubStrategy;
        case '.docx':
            return DocxStrategy;
        default:
            throw new Error(`目前尚未支援此檔案格式: ${ext}`);
        }
    }
}