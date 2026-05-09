// src/main/strategies/DocxStrategy.ts
import fs from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import ZhConverter from '../../lib/ZhConverter';
import { ConverterOptions } from './StrategyFactory.js';

interface DocxDomNode {
    nodeType: number;
    nodeName: string;
    nodeValue: string | null;
    data?: string;
    childNodes: {
        length: number;
        [index: number]: DocxDomNode;
    };
}

interface TextRef {
    node: DocxDomNode;
    originalValue: string;
}

export class DocxStrategy {
    public static async execute(
        filePath: string,
        options: ConverterOptions,
        onProgress?: (progress: { current: number; total: number }) => void
    ): Promise<Buffer> {
        if (!filePath) throw new Error('DOCX 檔案路徑不能為空');

        let zipData: Buffer;
        try {
            zipData = await fs.readFile(filePath);
        }
        catch (error) {
            throw new Error(`讀取 DOCX 檔案失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        const zip = new JSZip();
        try {
            await zip.loadAsync(zipData);
        }
        catch (error) {
            throw new Error(`解析 DOCX 結構失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        const filesToProcess: string[] = [];
        zip.forEach((relativePath, zipEntry) => {
            if (zipEntry.dir) return;
            
            const ext = path.extname(relativePath).toLowerCase();
            if (ext === '.xml' && (relativePath.startsWith('word/') || relativePath.startsWith('docProps/'))) {
                filesToProcess.push(relativePath);
            }
        });

        const parser = new DOMParser({
            errorHandler: (level: string, msg: string): void => {
                if (level === 'fatalError') {
                    console.error(`XML 解析致命錯誤 (${level}): ${msg}`);
                }
            }
        });
        
        const serializer = new XMLSerializer();
        let processedCount = 0;
        const totalFiles = filesToProcess.length;

        for (const relativePath of filesToProcess) {
            const fileObj = zip.file(relativePath);
            if (!fileObj) continue;

            const rawContent = await fileObj.async('string');
            const doc = parser.parseFromString(rawContent, 'application/xml');

            const refs: TextRef[] = [];

            const traverse = (node: DocxDomNode): void => {
                if (node.nodeType === 1) {
                    for (let i = 0; i < node.childNodes.length; i++) {
                        traverse(node.childNodes[i]);
                    }
                } 
                else if (node.nodeType === 3) {
                    const text = node.data || node.nodeValue;
                    if (text && text.trim()) {
                        refs.push({ node: node, originalValue: text });
                    }
                }
            };

            if (doc.documentElement) {
                traverse(doc.documentElement as unknown as DocxDomNode);
            }

            if (refs.length > 0) {
                const escapeText = (text: string): string => text.replace(/\\n/g, '\\\\n').replace(/\r?\n/g, '\\n');
                const unescapeText = (text: string): string => {
                    return text.replace(/\\\\n|\\n/g, (match) => {
                        if (match === '\\\\n') return '\\n';
                        if (match === '\\n') return '\n';
                        return match;
                    });
                };

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
                
                let convertedFullText = '';
                try {
                    convertedFullText = await converter;
                }
                catch (error) {
                    throw new Error(`DOCX 內容轉換失敗 (${relativePath}): ${error instanceof Error ? error.message : String(error)}`);
                }

                const convertedLines = convertedFullText.split('\n');

                refs.forEach((ref, i) => {
                    const convertedValue = unescapeText(convertedLines[i] || '');
                    ref.node.data = convertedValue;
                    ref.node.nodeValue = convertedValue;
                });
            }

            const convertedContent = serializer.serializeToString(doc);
            zip.file(relativePath, convertedContent);

            processedCount++;
            if (onProgress) {
                onProgress({ current: processedCount, total: totalFiles });
            }
        }

        const finalBuffer = await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        return finalBuffer;
    }
}