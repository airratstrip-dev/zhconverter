/**
 * 繁簡轉換重試設定
 */
export interface ZhConvertRetryOptions {
  /** 重試次數，預設為 5 */
  times?: number;
  /** 每次重試的延遲時間 (ms)，傳入當前重試次數 */
  delay?: (times: number) => number;
  /** 重試延遲的抖動範圍 [min, max] (ms)，預設為 [1, 100] */
  jitter?: [number, number];
  /** 發生重試時的回呼 */
  callback?: (times: number, error: Error, response: Response | null) => void;
}

/**
 * 自訂取代與保護設定
 */
export interface ZhConvertReplaceOptions {
  /** 轉換前的自訂取代字串字典 */
  before?: Record<string, string>;
  /** 轉換後的自訂取代字串字典 */
  after?: Record<string, string>;
  /** 保護不被轉換的字串陣列或集合 */
  protect?: string[] | Set<string>;
}

/**
 * 差異比較設定
 */
export interface ZhConvertDiffOptions {
  /** 是否啟用差異比較 */
  enable?: boolean;
  /** 是否進行字元級比較 */
  charLevel?: boolean;
  /** 上下文行數 */
  contextLines?: number;
}

/**
 * 轉換進度資訊
 */
export interface ZhConvertProgress {
  /** 目前已完成的分塊數量 */
  current: number;
  /** 總分塊數量 */
  total: number;
  /** 失敗的分塊索引列表 */
  missing: number[];
  /** 錯誤物件列表 */
  error: Error[];
}

/**
 * ZhConvert 核心配置選項
 */
export interface ZhConvertOptions {
  /** 每個分塊的行數大小，預設為 512 */
  chunkSize?: number;
  /** 並行請求的數量，預設為 4 */
  batchSize?: number;
  /** 轉換目標（例如 "Taiwan", "China" 等），預設為 "Taiwan" */
  converter?: string;
  /** 處理進度回呼 */
  processingCallback?: (current: number, total: number) => void;
  /** 總結回呼 */
  resultCallback?: (result: string, missing: number[], error: Error[]) => void;
  /** 單一請求超時時間 (ms)，預設為 10000 */
  timeout?: number;
  /** 總任務超時時間 (ms)，預設為 60000 */
  totalTimeout?: number;
  /** 每個請求發送前的抖動等待時間 [min, max] (ms) */
  jitter?: [number, number];
  /** 重試設定 */
  retry?: ZhConvertRetryOptions;
  /** 允許或拒絕的 HTTP 狀態碼策略 */
  allowStatus?: ['allow' | 'deny', number[]];
  /** 自訂取代與保護設定 */
  replace?: ZhConvertReplaceOptions;
  /** 差異比較設定 */
  diff?: ZhConvertDiffOptions;
  /** 啟用的模組陣列 (例如 ["ChineseVariant", "Computer"]) */
  useModel?: string[];
  /** 
   * 資料完整性檢查。
   * 若為 true，遇到無法重試的錯誤會立即停止；若為 false 則繼續執行並回報 missing。
   */
  integrity?: boolean;
}

/**
 * ZhConverter 類別
 * 提供繁簡轉換功能，支援 Promise 介面與非同步迭代進度。
 */
export default class ZhConverter implements PromiseLike<string> {
    /**
   * 建立一個 ZhConvert 轉換任務實例。
   * @param text 要轉換的原始文字
   * @param options 轉換設定選項
   */
    constructor(text: string, options?: ZhConvertOptions);

    /**
   * 支援 Promise 的 .then() 方法。
   */
    then<TResult1 = string, TResult2 = never>(
    onfulfilled?: ((value: string) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2>;

    /**
   * 支援 Promise 的 .catch() 方法。
   */
    catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
  ): Promise<string | TResult>;

    /**
   * 支援 Promise 的 .finally() 方法。
   */
    finally(onfinally?: (() => void) | undefined | null): Promise<string>;

    /**
   * 支援 for await...of 語法，用於迭代轉換進度。
   */
    [Symbol.asyncIterator](): AsyncGenerator<ZhConvertProgress, void, unknown>;
}