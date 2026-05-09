// src/main/strategies/EpubStrategy.ts
import fs from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import ZhConverter from '../../lib/ZhConverter';
import { ConverterOptions } from './StrategyFactory.js';

// 精確定義 DOM 節點介面，包含 data 與 setAttribute，徹底避開環境型別衝突
interface EpubDomNode {
    nodeType: number;
    nodeName: string;
    nodeValue: string | null;
    data?: string;
    setAttribute?: (name: string, value: string) => void;
    childNodes: {
        length: number;
        [index: number]: EpubDomNode;
    };
    attributes?: {
        length: number;
        [index: number]: {
            nodeName: string;
            nodeValue: string | null;
            value?: string;
        };
    };
}

interface TextRef {
    type: 'text' | 'attr';
    node: EpubDomNode;
    attrName?: string;
    originalValue: string;
}

export class EpubStrategy {
    private static readonly TARGET_EXTENSIONS = ['.html', '.xhtml', '.xml', '.opf', '.ncx'];
    
    private static readonly SAFE_ATTR_WHITELIST = ['title', 'alt', 'placeholder', 'label', 'aria-label', 'value'];

    public static async execute(
        filePath: string,
        options: ConverterOptions,
        onProgress?: (progress: { current: number; total: number }) => void
    ): Promise<Buffer> {
        if (!filePath) throw new Error('EPUB 檔案路徑不能為空');

        let zipData: Buffer;
        try {
            zipData = await fs.readFile(filePath);
        }
        catch (error) {
            throw new Error(`讀取 EPUB 檔案失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        const originalZip = new JSZip();
        try {
            await originalZip.loadAsync(zipData);
        }
        catch (error) {
            throw new Error(`解析 EPUB 結構失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        const newZip = new JSZip();
        const mimetypeFile = originalZip.file('mimetype');
        if (mimetypeFile) {
            const mimetypeContent = await mimetypeFile.async('string');
            newZip.file('mimetype', mimetypeContent, { compression: 'STORE' });
        }

        const filesToProcess: string[] = [];
        originalZip.forEach((relativePath, zipEntry) => {
            if (zipEntry.dir || relativePath === 'mimetype') return;
            filesToProcess.push(relativePath);
        });

        const parser = new DOMParser({
            errorHandler: (level: string, msg: string): void => {
                if (level === 'fatalError') {
                    console.error(`XML 解析致命錯誤: ${msg}`);
                }
            }
        });
        
        const serializer = new XMLSerializer();

        let processedCount = 0;
        const totalFiles = filesToProcess.length;

        for (const relativePath of filesToProcess) {
            const fileObj = originalZip.file(relativePath);
            if (!fileObj) continue;

            const ext = path.extname(relativePath).toLowerCase();

            if (EpubStrategy.TARGET_EXTENSIONS.includes(ext)) {
                const rawContent = await fileObj.async('string');
                
                const mimeType = (ext === '.html' || ext === '.xhtml') ? 'application/xhtml+xml' : 'application/xml';
                const doc = parser.parseFromString(rawContent, mimeType);

                const refs: TextRef[] = [];

                const traverse = (node: EpubDomNode): void => {
                    if (node.nodeType === 1) { // ELEMENT_NODE
                        const tagName = node.nodeName.toLowerCase();
                        
                        if (tagName === 'script' || tagName === 'style') return;

                        if (node.attributes) {
                            for (let i = 0; i < node.attributes.length; i++) {
                                const attr = node.attributes[i];
                                if (EpubStrategy.SAFE_ATTR_WHITELIST.includes(attr.nodeName.toLowerCase())) {
                                    // 確保抓到真正的屬性值
                                    const val = attr.value || attr.nodeValue;
                                    if (val && val.trim()) {
                                        // ★ 修正：存入父元素 (node) 而不是屬性本身，才能呼叫 setAttribute
                                        refs.push({ 
                                            type: 'attr', 
                                            node: node, 
                                            attrName: attr.nodeName, 
                                            originalValue: val 
                                        });
                                    }
                                }
                            }
                        }

                        for (let i = 0; i < node.childNodes.length; i++) {
                            traverse(node.childNodes[i]);
                        }
                    } 
                    else if (node.nodeType === 3) { // TEXT_NODE
                        // ★ 修正：優先抓取底層的 data 屬性
                        const text = node.data || node.nodeValue;
                        if (text && text.trim()) {
                            refs.push({ type: 'text', node: node, originalValue: text });
                        }
                    }
                };

                if (doc.documentElement) {
                    traverse(doc.documentElement as unknown as EpubDomNode);
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

                    // 即使 UI 上不提供選項，QueueManager 也會傳入預設的 converter: 'Taiwan'
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
                        throw new Error(`EPUB 內容轉換失敗 (${relativePath}): ${error instanceof Error ? error.message : String(error)}`);
                    }

                    const convertedLines = convertedFullText.split('\n');

                    refs.forEach((ref, i) => {
                        const convertedValue = unescapeText(convertedLines[i] || '');
                        if (ref.type === 'text') {
                            ref.node.data = convertedValue;
                            ref.node.nodeValue = convertedValue;
                        } 
                        else if (ref.type === 'attr' && ref.attrName) {
                            if (ref.node.setAttribute) {
                                ref.node.setAttribute(ref.attrName, convertedValue);
                            }
                        }
                    });
                }

                const convertedContent = serializer.serializeToString(doc);
                newZip.file(relativePath, convertedContent);
            } 
            else {
                const contentBuffer = await fileObj.async('nodebuffer');
                newZip.file(relativePath, contentBuffer);
            }

            processedCount++;
            if (onProgress) {
                onProgress({ current: processedCount, total: totalFiles });
            }
        }

        const finalBuffer = await newZip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        return finalBuffer;
    }
}