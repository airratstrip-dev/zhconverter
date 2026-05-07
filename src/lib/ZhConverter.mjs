// ==========================================
// JSDoc 型別定義與公開介面說明
// ==========================================

/**
 * @typedef {Object} ZhConvertRetryOptions
 * @property {number} [times=5] - 重試次數
 * @property {(times: number) => number} [delay] - 每次重試的延遲時間 (ms)
 * @property {[number, number]} [jitter=[1, 100]] - 重試延遲的抖動範圍 [min, max] (ms)
 * @property {(times: number, error: Error, response: Response|null) => void} [callback] - 發生重試時的回呼
 */

/**
 * @typedef {Object} ZhConvertReplaceOptions
 * @property {Record<string, string>} [before={}] - 轉換前的自訂取代字串字典
 * @property {Record<string, string>} [after={}] - 轉換後的自訂取代字串字典
 * @property {string[]|Set<string>} [protect=[]] - 保護不被轉換的字串陣列或集合
 */

/**
 * @typedef {Object} ZhConvertOptions
 * @property {number} [chunkSize=512] - 每個分塊的行數大小
 * @property {number} [batchSize=4] - 並行請求的數量
 * @property {string} [converter="Taiwan"] - 轉換目標（例如 "Taiwan", "China" 等）
 * @property {(current: number, total: number) => void} [processingCallback] - 處理進度回呼
 * @property {(result: string, missing: number[], error: Error[]) => void} [resultCallback] - 總結回呼
 * @property {number} [timeout=10000] - 單一請求超時時間 (ms)
 * @property {number} [totalTimeout=60000] - 總任務超時時間 (ms)
 * @property {[number, number]} [jitter=[0, 0]] - 每個請求發送前的抖動等待時間 [min, max] (ms)
 * @property {ZhConvertRetryOptions} [retry] - 重試設定
 * @property {["allow"|"deny", number[]]} [allowStatus=["deny", [401, 403, 404]]] - 允許或拒絕的 HTTP 狀態碼
 * @property {ZhConvertReplaceOptions} [replace] - 自訂取代與保護設定
 * @property {string[]} [useModel=[]] - 啟用的模組陣列 (例如 ["ChineseVariant", "Computer"])
 * @property {boolean} [integrity=true] - 資料完整性檢查。若為 true，當遭遇無法重試的錯誤時會直接報錯並停止所有任務；若為 false 則僅回報並繼續
 */

// ==========================================
// 模組級全域變數與防呆工具
// ==========================================

const internalState = new WeakMap();

// 防呆工具：確保數字是有效且合理的 (排除 NaN, Infinity, -Infinity)
function getValidNumber(val, fallback, min = -Infinity, max = Infinity) {
    if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
    return Math.max(min, Math.min(val, max));
}

// 防呆工具：確保是陣列且長度符合預期
function getValidNumberArray(arr, fallback, expectedLength = 2) {
    if (!Array.isArray(arr) || arr.length !== expectedLength) return fallback;
    const isValid = arr.every(n => typeof n === 'number' && Number.isFinite(n));
    return isValid ? arr : fallback;
}

// 防呆工具：確保是物件 (排除 null 與 Array)
function isPlainObject(val) {
    return typeof val === 'object' && val !== null && !Array.isArray(val);
}

const DEFAULT_MODULES = {
    'ChineseVariant':'0', 'Computer':'0', 'EllipsisMark':'0',
    'EngNumFWToHW':'0', 'GanToZuo':'-1', 'Gundam':'0',
    'HunterXHunter':'0', 'InternetSlang':'-1', 'Mythbusters':'0',
    'Naruto':'0', 'OnePiece':'0', 'Pocketmon':'0',
    'ProperNoun':'-1', 'QuotationMark':'0', 'RemoveSpaces':'0',
    'Repeat':'-1', 'RepeatAutoFix':'-1', 'Smooth':'-1',
    'TengTong':'0', 'TransliterationToTranslation':'0',
    'Typo':'-1', 'Unit':'-1', 'VioletEvergarden':'0'
};

// ==========================================
// 模組級純函式 (資料與邏輯分離)
// ==========================================

function parseOptions(userOpts) {
    const opts = isPlainObject(userOpts) ? userOpts : {};
    
    const retry = isPlainObject(opts.retry) ? opts.retry : {};
    const diff = isPlainObject(opts.diff) ? opts.diff : {};
    const replace = isPlainObject(opts.replace) ? opts.replace : {};

    // 處理 allowStatus (格式必須為 ["allow"|"deny", [...numbers]])
    let allowStatus = ['deny', [401, 403, 404]];
    if (Array.isArray(opts.allowStatus) && opts.allowStatus.length === 2) {
        const [rule, codes] = opts.allowStatus;
        if ((rule === 'allow' || rule === 'deny') && Array.isArray(codes)) {
            allowStatus = [rule, codes.filter(c => typeof c === 'number' && Number.isFinite(c))];
        }
    }

    return {
        chunkSize: getValidNumber(opts.chunkSize, 512, 1),
        batchSize: getValidNumber(opts.batchSize, 4, 1),
        converter: typeof opts.converter === 'string' ? opts.converter : 'Taiwan',
        processingCallback: typeof opts.processingCallback === 'function' ? opts.processingCallback : () => {},
        resultCallback: typeof opts.resultCallback === 'function' ? opts.resultCallback : () => {},
        timeout: getValidNumber(opts.timeout, 10000),
        totalTimeout: getValidNumber(opts.totalTimeout, -1), 
        jitter: getValidNumberArray(opts.jitter, [0, 0]),
        
        retry: {
            times: getValidNumber(retry.times, 5, 0),
            delay: typeof retry.delay === 'function' ? retry.delay : (times) => 300 * times,
            jitter: getValidNumberArray(retry.jitter, [200, 700]),
            callback: typeof retry.callback === 'function' ? retry.callback : () => {}
        },
        
        allowStatus,
        
        diff: {
            enable: typeof diff.enable === 'boolean' ? diff.enable : false,
            charLevel: typeof diff.charLevel === 'boolean' ? diff.charLevel : false,
            contextLines: getValidNumber(diff.contextLines, 1, 0)
        },
        
        replace: {
            before: isPlainObject(replace.before) ? replace.before : {},
            after: isPlainObject(replace.after) ? replace.after : {},
            protect: (Array.isArray(replace.protect) || replace.protect instanceof Set) ? replace.protect : []
        },
        
        useModel: Array.isArray(opts.useModel) ? opts.useModel.filter(m => typeof m === 'string') : [],
        integrity: typeof opts.integrity === 'boolean' ? opts.integrity : true // 預設為 true
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getJitter(min, max) {
    if (max <= 0 || min >= max) return min;
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function splitText(text, chunkSize) {
    const lines = text.split(/\r?\n/);
    const chunks = [];
    for (let i = 0; i < lines.length; i += chunkSize) {
        chunks.push(lines.slice(i, i + chunkSize).join('\n'));
    }
    return chunks.length ? chunks : [''];
}

function formatReplaceObj(obj) {
    return Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('\n');
}

function formatProtect(protect) {
    const arr = protect instanceof Set ? Array.from(protect) : protect;
    return arr.join('\n');
}

function buildPayload(text, options) {
    const activeModules = { ...DEFAULT_MODULES };
    for (const mod of options.useModel) {
        if (mod in activeModules) activeModules[mod] = '1';
    }

    return {
        text: text,
        converter: options.converter,
        modules: JSON.stringify(activeModules),
        userPreReplace: formatReplaceObj(options.replace.before),
        userPostReplace: formatReplaceObj(options.replace.after),
        userProtectReplace: formatProtect(options.replace.protect),
        diffEnable: options.diff.enable ? 1 : 0,
        diffCharLevel: options.diff.charLevel ? 1 : 0,
        diffContextLines: options.diff.contextLines,
        apiKey: '', ignoreTextStyles: '', jpTextStyles: '',
        jpTextConversionStrategy: 'protectOnlySameOrigin',
        jpStyleConversionStrategy: 'protectOnlySameOrigin',
        diffIgnoreCase: 0, diffIgnoreWhiteSpaces: 0, diffTemplate: 'Json',
        cleanUpText: 0, ensureNewlineAtEof: 0, translateTabsToSpaces: -1,
        trimTrailingWhiteSpaces: 0, unifyLeadingHyphen: 0
    };
}

function checkAllowStatus(status, allowStatusRule) {
    const [rule, codes] = allowStatusRule;
    const isIncluded = codes.includes(status);
    if (rule === 'deny' && isIncluded) {
        throw new Error(`HTTP Status ${status} is denied.`);
    }
    if (rule === 'allow' && !isIncluded) {
        throw new Error(`HTTP Status ${status} is not allowed.`);
    }
}

// 狀態管理相關函式
function emitProgress(state, current, total, missing, error) {
    state.progressQueue.push({ current, total, missing, error });
    if (state.progressResolver) {
        state.progressResolver();
        state.progressResolver = null;
    }
    state.options.processingCallback(current, total);
}

function markCompleted(state) {
    state.isCompleted = true;
    if (state.progressResolver) {
        state.progressResolver();
        state.progressResolver = null;
    }
}

// 單一請求與重試機制
async function executeTaskWithRetry(chunkText, index, globalSignal, options) {
    let attempt = 0;
    const { retry, jitter, timeout, allowStatus } = options;

    while (attempt <= retry.times) {
        const waitJitter = getJitter(jitter[0], jitter[1]);
        if (waitJitter > 0) await sleep(waitJitter);

        const localAbort = new AbortController();
        const localTimeoutId = setTimeout(() => {
            if (options.timeout > 0) localAbort.abort(new Error('Request Timeout'));
        }, timeout > 0 ? timeout : 0);
        
        const onGlobalAbort = () => localAbort.abort(globalSignal.reason);
        globalSignal.addEventListener('abort', onGlobalAbort);

        let response = null;
        try {
            const payload = buildPayload(chunkText, options);
            response = await fetch('https://api.zhconvert.org/convert', {
                method: 'POST',
                headers: {
                    'accept': 'application/json, text/plain, */*',
                    'content-type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: localAbort.signal
            });

            checkAllowStatus(response.status, allowStatus);

            const { data } = await response.json();
            if (data.diff) console.log('diff:', data.diff);

            return { index, text: data.text, diff: data.diff };

        }
        catch (error) {
            console.error(`Attempt ${attempt + 1} failed for chunk ${index}:`, error);

            attempt++;
            retry.callback(attempt, error, response);

            if (attempt > retry.times || error.message === 'Total Timeout Exceeded') {
                throw error;
            }

            const delayMs = retry.delay(attempt);
            const retryJitter = getJitter(retry.jitter[0], retry.jitter[1]);
            await sleep(delayMs + retryJitter);

        }
        finally {
            clearTimeout(localTimeoutId);
            globalSignal.removeEventListener('abort', onGlobalAbort);
        }
    }
}

// 核心任務排程 (滑動窗口並行)
async function runCore(state) {
    const { text, options } = state;
    const chunks = splitText(text, options.chunkSize);
    const total = chunks.length;
    const results = new Array(total).fill('');
    const missing = [];
    const errors = [];
    let current = 0;

    const globalAbort = new AbortController();
    const globalTimeoutId = setTimeout(() => {
        if (options.totalTimeout > 0) globalAbort.abort(new Error('Total Timeout Exceeded'));
    }, options.totalTimeout > 0 ? options.totalTimeout : 0);

    const pool = new Set();

    try {
        for (let i = 0; i < total; i++) {
            if (globalAbort.signal.aborted) throw globalAbort.signal.reason;

            // 如果 chunk 只有空白，直接 resolve 避開網路請求
            let taskPromise;
            if (!chunks[i].trim()) {
                taskPromise = Promise.resolve({ index: i, text: chunks[i] });
            }
            else {
                taskPromise = executeTaskWithRetry(chunks[i], i, globalAbort.signal, options);
            }

            const task = taskPromise
                .then(({ index, text }) => {
                    results[index] = text;
                })
                .catch(err => {
                    if (options.integrity) {
                        // 如果要求完整性，透過 abort 通知其他 task 停止，並將錯誤向上拋出
                        globalAbort.abort(err);
                        throw err; 
                    }
                    missing.push(i);
                    errors.push(err);
                })
                .finally(() => {
                    current++;
                    emitProgress(state, current, total, [...missing], [...errors]);
                    pool.delete(task);
                });

            pool.add(task);

            if (pool.size >= options.batchSize) {
                await Promise.race(pool);
            }
        }

        await Promise.all(pool);

        const finalString = results.join('\n');
        options.resultCallback(finalString, missing, errors);
        return finalString;

    }
    finally {
        clearTimeout(globalTimeoutId);
        markCompleted(state);
    }
}

function startRun(instance) {
    const state = internalState.get(instance);
    if (!state.resultPromise) {
        // 如果 text 是空字串或純空白，提早結束，不浪費效能
        if (state.isTextEmpty) {
            state.options.resultCallback('', [], []);
            state.isCompleted = true; // 讓 asyncIterator 立刻完成
            if (state.progressResolver) state.progressResolver();
            state.resultPromise = Promise.resolve('');
        }
        else {
            // 正常的網路處理邏輯
            state.resultPromise = runCore(state);
        }
    }
    return state.resultPromise;
}

// ==========================================
// 乾淨的類別對外介面
// ==========================================

export default class ZhConverter {
    /**
     * 建立一個 ZhConvert 轉換任務實例。
     * @param {string} text - 要轉換的原始文字
     * @param {ZhConvertOptions} [options] - 轉換設定選項
     */
    constructor(text, options = {}) {
        // 防呆：確保 text 是字串
        if (typeof text !== 'string') throw new TypeError('The \'text\' argument must be of type string');
        const isTextEmpty = !text.trim();

        internalState.set(this, {
            text: text,
            isTextEmpty: isTextEmpty,
            options: parseOptions(options),
            resultPromise: null,
            progressQueue: [],
            progressResolver: null,
            isCompleted: false
        });
    }

    /**
     * 支援 Promise 的 .then() 方法，用於取得最終轉換結果。
     * @param {(result: string) => void} onFulfilled - 成功時的回呼
     * @param {(reason: any) => void} [onRejected] - 失敗時的回呼
     * @returns {Promise<string>}
     */
    then(onFulfilled, onRejected) {
        return startRun(this).then(onFulfilled, onRejected);
    }

    /**
     * 支援 Promise 的 .catch() 方法，用於捕捉轉換過程中的致命錯誤。
     * @param {(reason: any) => void} onRejected - 失敗時的回呼
     * @returns {Promise<string>}
     */
    catch(onRejected) {
        return startRun(this).catch(onRejected);
    }

    /**
     * 支援 Promise 的 .finally() 方法。
     * 不論轉換成功或失敗，都會執行指定的處理邏輯。
     * @param {() => void} onFinally - 完成時（不論成敗）的回呼
     * @returns {Promise<string>}
     */
    finally(onFinally) {
        return startRun(this).finally(onFinally);
    }

    /**
     * 支援 for await...of 語法，用於非同步迭代轉換進度。
     * @returns {AsyncGenerator<{current: number, total: number, missing: number[], error: Error[]}, void, unknown>}
     */
    async *[Symbol.asyncIterator]() {
        startRun(this).catch(() => {}); // 觸發執行，錯誤由 Iterator 或外部捕捉
        const state = internalState.get(this);

        while (true) {
            if (state.progressQueue.length > 0) {
                yield state.progressQueue.shift();
            }
            else if (state.isCompleted) {
                break;
            }
            else {
                await new Promise(resolve => {
                    state.progressResolver = resolve; 
                });
            }
        }
    }
}