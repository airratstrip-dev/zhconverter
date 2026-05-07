// src/main/strategies/XmlHtmlStrategy.ts
import fs from 'fs/promises';
import * as cheerio from 'cheerio';
import type { Element, Text } from 'domhandler';
import ZhConverter from '../../lib/ZhConverter';
import { ConverterOptions } from './StrategyFactory.js';
import type { XmlHtmlFormatOptions } from '../../types/global.js';

export interface XmlHtmlConverterOptions extends ConverterOptions, Partial<XmlHtmlFormatOptions> {}

interface TextRef {
    type: 'text' | 'attr';
    node: Element | Text;
    attrName?: string;
    originalValue: string;
}

export class XmlHtmlStrategy {
    private static readonly ATTR_WHITELIST = ['title', 'alt', 'placeholder', 'label', 'aria-label', 'value'];

    public static async execute(
        filePath: string,
        options: XmlHtmlConverterOptions,
        onProgress?: (progress: { current: number; total: number }) => void
    ): Promise<string> {
        if (!filePath) throw new Error('檔案路徑不能為空');

        const convertText = options.convertText ?? true;
        const convertAttributes = options.convertAttributes ?? false;

        let rawContent = '';
        try {
            rawContent = await fs.readFile(filePath, 'utf-8');
        }
        catch (error) {
            throw new Error(`讀取標記檔案失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        const isXml = filePath.toLowerCase().endsWith('.xml') || filePath.toLowerCase().endsWith('.xhtml');
        
        // 移除 decodeEntities，直接載入
        const $ = cheerio.load(rawContent, { xmlMode: isXml });
        const refs: TextRef[] = [];

        const escapeText = (text: string): string => text.replace(/\\n/g, '\\\\n').replace(/\r?\n/g, '\\n');

        const unescapeText = (text: string): string => {
            return text.replace(/\\\\n|\\n/g, (match) => {
                if (match === '\\\\n') return '\\n';
                if (match === '\\n') return '\n';
                return match;
            });
        };

        // 走訪並處理屬性 (需確保節點是 Element)
        $('*').each((_, element) => {
            if (element.type === 'tag' || element.type === 'script' || element.type === 'style') {
                const el = element as Element;
                if (convertAttributes && el.attribs) {
                    for (const attrName in el.attribs) {
                        if (XmlHtmlStrategy.ATTR_WHITELIST.includes(attrName.toLowerCase())) {
                            const val = el.attribs[attrName].trim();
                            if (val) refs.push({ type: 'attr', node: el, attrName, originalValue: val });
                        }
                    }
                }
            }
        });

        // 走訪並處理純文本節點
        if (convertText) {
            $('*').contents().each((_, node) => {
                if (node.type === 'text') {
                    const textNode = node as Text;
                    const text = textNode.data.trim();
                    if (text) refs.push({ type: 'text', node: textNode, originalValue: textNode.data });
                }
            });
        }

        if (refs.length === 0) return isXml ? $.xml() : $.html();

        const textsToConvert = refs.map(ref => escapeText(ref.originalValue));
        const textForConverter = textsToConvert.join('\n');

        const converterOptions = {
            converter: options.converter || 'Taiwan',
            chunkSize: 4096,
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
            throw new Error(`標記語言轉換過程失敗: ${error instanceof Error ? error.message : String(error)}`);
        }

        const convertedLines = convertedFullText.split('\n');

        refs.forEach((ref, i) => {
            const convertedValue = unescapeText(convertedLines[i] || '');
            if (ref.type === 'text') {
                (ref.node as Text).data = convertedValue;
            }
            else if (ref.type === 'attr' && ref.attrName) {
                $(ref.node as Element).attr(ref.attrName, convertedValue);
            }
        });

        return isXml ? $.xml() : $.html();
    }
}