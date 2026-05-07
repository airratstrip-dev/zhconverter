import { BrowserWindow, app, dialog, ipcMain, systemPreferences } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import crypto from "crypto";
import os from "os";
//#region src/lib/ZhConverter.mjs
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
var internalState = /* @__PURE__ */ new WeakMap();
function getValidNumber(val, fallback, min = -Infinity, max = Infinity) {
	if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
	return Math.max(min, Math.min(val, max));
}
function getValidNumberArray(arr, fallback, expectedLength = 2) {
	if (!Array.isArray(arr) || arr.length !== expectedLength) return fallback;
	return arr.every((n) => typeof n === "number" && Number.isFinite(n)) ? arr : fallback;
}
function isPlainObject(val) {
	return typeof val === "object" && val !== null && !Array.isArray(val);
}
var DEFAULT_MODULES = {
	"ChineseVariant": "0",
	"Computer": "0",
	"EllipsisMark": "0",
	"EngNumFWToHW": "0",
	"GanToZuo": "-1",
	"Gundam": "0",
	"HunterXHunter": "0",
	"InternetSlang": "-1",
	"Mythbusters": "0",
	"Naruto": "0",
	"OnePiece": "0",
	"Pocketmon": "0",
	"ProperNoun": "-1",
	"QuotationMark": "0",
	"RemoveSpaces": "0",
	"Repeat": "-1",
	"RepeatAutoFix": "-1",
	"Smooth": "-1",
	"TengTong": "0",
	"TransliterationToTranslation": "0",
	"Typo": "-1",
	"Unit": "-1",
	"VioletEvergarden": "0"
};
function parseOptions(userOpts) {
	const opts = isPlainObject(userOpts) ? userOpts : {};
	const retry = isPlainObject(opts.retry) ? opts.retry : {};
	const diff = isPlainObject(opts.diff) ? opts.diff : {};
	const replace = isPlainObject(opts.replace) ? opts.replace : {};
	let allowStatus = ["deny", [
		401,
		403,
		404
	]];
	if (Array.isArray(opts.allowStatus) && opts.allowStatus.length === 2) {
		const [rule, codes] = opts.allowStatus;
		if ((rule === "allow" || rule === "deny") && Array.isArray(codes)) allowStatus = [rule, codes.filter((c) => typeof c === "number" && Number.isFinite(c))];
	}
	return {
		chunkSize: getValidNumber(opts.chunkSize, 512, 1),
		batchSize: getValidNumber(opts.batchSize, 4, 1),
		converter: typeof opts.converter === "string" ? opts.converter : "Taiwan",
		processingCallback: typeof opts.processingCallback === "function" ? opts.processingCallback : () => {},
		resultCallback: typeof opts.resultCallback === "function" ? opts.resultCallback : () => {},
		timeout: getValidNumber(opts.timeout, 1e4),
		totalTimeout: getValidNumber(opts.totalTimeout, -1),
		jitter: getValidNumberArray(opts.jitter, [0, 0]),
		retry: {
			times: getValidNumber(retry.times, 5, 0),
			delay: typeof retry.delay === "function" ? retry.delay : (times) => 300 * times,
			jitter: getValidNumberArray(retry.jitter, [200, 700]),
			callback: typeof retry.callback === "function" ? retry.callback : () => {}
		},
		allowStatus,
		diff: {
			enable: typeof diff.enable === "boolean" ? diff.enable : false,
			charLevel: typeof diff.charLevel === "boolean" ? diff.charLevel : false,
			contextLines: getValidNumber(diff.contextLines, 1, 0)
		},
		replace: {
			before: isPlainObject(replace.before) ? replace.before : {},
			after: isPlainObject(replace.after) ? replace.after : {},
			protect: Array.isArray(replace.protect) || replace.protect instanceof Set ? replace.protect : []
		},
		useModel: Array.isArray(opts.useModel) ? opts.useModel.filter((m) => typeof m === "string") : [],
		integrity: typeof opts.integrity === "boolean" ? opts.integrity : true
	};
}
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
function getJitter(min, max) {
	if (max <= 0 || min >= max) return min;
	return Math.floor(Math.random() * (max - min + 1) + min);
}
function splitText(text, chunkSize) {
	const lines = text.split(/\r?\n/);
	const chunks = [];
	for (let i = 0; i < lines.length; i += chunkSize) chunks.push(lines.slice(i, i + chunkSize).join("\n"));
	return chunks.length ? chunks : [""];
}
function formatReplaceObj(obj) {
	return Object.entries(obj).map(([k, v]) => `${k}=${v}`).join("\n");
}
function formatProtect(protect) {
	return (protect instanceof Set ? Array.from(protect) : protect).join("\n");
}
function buildPayload(text, options) {
	const activeModules = { ...DEFAULT_MODULES };
	for (const mod of options.useModel) if (mod in activeModules) activeModules[mod] = "1";
	return {
		text,
		converter: options.converter,
		modules: JSON.stringify(activeModules),
		userPreReplace: formatReplaceObj(options.replace.before),
		userPostReplace: formatReplaceObj(options.replace.after),
		userProtectReplace: formatProtect(options.replace.protect),
		diffEnable: options.diff.enable ? 1 : 0,
		diffCharLevel: options.diff.charLevel ? 1 : 0,
		diffContextLines: options.diff.contextLines,
		apiKey: "",
		ignoreTextStyles: "",
		jpTextStyles: "",
		jpTextConversionStrategy: "protectOnlySameOrigin",
		jpStyleConversionStrategy: "protectOnlySameOrigin",
		diffIgnoreCase: 0,
		diffIgnoreWhiteSpaces: 0,
		diffTemplate: "Json",
		cleanUpText: 0,
		ensureNewlineAtEof: 0,
		translateTabsToSpaces: -1,
		trimTrailingWhiteSpaces: 0,
		unifyLeadingHyphen: 0
	};
}
function checkAllowStatus(status, allowStatusRule) {
	const [rule, codes] = allowStatusRule;
	const isIncluded = codes.includes(status);
	if (rule === "deny" && isIncluded) throw new Error(`HTTP Status ${status} is denied.`);
	if (rule === "allow" && !isIncluded) throw new Error(`HTTP Status ${status} is not allowed.`);
}
function emitProgress(state, current, total, missing, error) {
	state.progressQueue.push({
		current,
		total,
		missing,
		error
	});
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
async function executeTaskWithRetry(chunkText, index, globalSignal, options) {
	let attempt = 0;
	const { retry, jitter, timeout, allowStatus } = options;
	while (attempt <= retry.times) {
		const waitJitter = getJitter(jitter[0], jitter[1]);
		if (waitJitter > 0) await sleep(waitJitter);
		const localAbort = new AbortController();
		const localTimeoutId = setTimeout(() => {
			if (options.timeout > 0) localAbort.abort(/* @__PURE__ */ new Error("Request Timeout"));
		}, timeout > 0 ? timeout : 0);
		const onGlobalAbort = () => localAbort.abort(globalSignal.reason);
		globalSignal.addEventListener("abort", onGlobalAbort);
		let response = null;
		try {
			const payload = buildPayload(chunkText, options);
			response = await fetch("https://api.zhconvert.org/convert", {
				method: "POST",
				headers: {
					"accept": "application/json, text/plain, */*",
					"content-type": "application/json"
				},
				body: JSON.stringify(payload),
				signal: localAbort.signal
			});
			checkAllowStatus(response.status, allowStatus);
			const { data } = await response.json();
			if (data.diff) console.log("diff:", data.diff);
			return {
				index,
				text: data.text,
				diff: data.diff
			};
		} catch (error) {
			console.error(`Attempt ${attempt + 1} failed for chunk ${index}:`, error);
			attempt++;
			retry.callback(attempt, error, response);
			if (attempt > retry.times || error.message === "Total Timeout Exceeded") throw error;
			await sleep(retry.delay(attempt) + getJitter(retry.jitter[0], retry.jitter[1]));
		} finally {
			clearTimeout(localTimeoutId);
			globalSignal.removeEventListener("abort", onGlobalAbort);
		}
	}
}
async function runCore(state) {
	const { text, options } = state;
	const chunks = splitText(text, options.chunkSize);
	const total = chunks.length;
	const results = new Array(total).fill("");
	const missing = [];
	const errors = [];
	let current = 0;
	const globalAbort = new AbortController();
	const globalTimeoutId = setTimeout(() => {
		if (options.totalTimeout > 0) globalAbort.abort(/* @__PURE__ */ new Error("Total Timeout Exceeded"));
	}, options.totalTimeout > 0 ? options.totalTimeout : 0);
	const pool = /* @__PURE__ */ new Set();
	try {
		for (let i = 0; i < total; i++) {
			if (globalAbort.signal.aborted) throw globalAbort.signal.reason;
			let taskPromise;
			if (!chunks[i].trim()) taskPromise = Promise.resolve({
				index: i,
				text: chunks[i]
			});
			else taskPromise = executeTaskWithRetry(chunks[i], i, globalAbort.signal, options);
			const task = taskPromise.then(({ index, text }) => {
				results[index] = text;
			}).catch((err) => {
				if (options.integrity) {
					globalAbort.abort(err);
					throw err;
				}
				missing.push(i);
				errors.push(err);
			}).finally(() => {
				current++;
				emitProgress(state, current, total, [...missing], [...errors]);
				pool.delete(task);
			});
			pool.add(task);
			if (pool.size >= options.batchSize) await Promise.race(pool);
		}
		await Promise.all(pool);
		const finalString = results.join("\n");
		options.resultCallback(finalString, missing, errors);
		return finalString;
	} finally {
		clearTimeout(globalTimeoutId);
		markCompleted(state);
	}
}
function startRun(instance) {
	const state = internalState.get(instance);
	if (!state.resultPromise) if (state.isTextEmpty) {
		state.options.resultCallback("", [], []);
		state.isCompleted = true;
		if (state.progressResolver) state.progressResolver();
		state.resultPromise = Promise.resolve("");
	} else state.resultPromise = runCore(state);
	return state.resultPromise;
}
var ZhConverter = class {
	/**
	* 建立一個 ZhConvert 轉換任務實例。
	* @param {string} text - 要轉換的原始文字
	* @param {ZhConvertOptions} [options] - 轉換設定選項
	*/
	constructor(text, options = {}) {
		if (typeof text !== "string") throw new TypeError("The 'text' argument must be of type string");
		const isTextEmpty = !text.trim();
		internalState.set(this, {
			text,
			isTextEmpty,
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
		startRun(this).catch(() => {});
		const state = internalState.get(this);
		while (true) if (state.progressQueue.length > 0) yield state.progressQueue.shift();
		else if (state.isCompleted) break;
		else await new Promise((resolve) => {
			state.progressResolver = resolve;
		});
	}
};
//#endregion
//#region src/main/strategies/TxtStrategy.ts
var TxtStrategy = class {
	static async execute(filePath, options, onProgress) {
		if (!filePath) throw new Error("檔案路徑不能為空");
		let text = "";
		try {
			text = await fs.readFile(filePath, "utf-8");
		} catch (error) {
			throw new Error(`讀取檔案失敗: ${error instanceof Error ? error.message : String(error)}`);
		}
		const converterOptions = {
			converter: options.converter || "Taiwan",
			chunkSize: options.chunkSize || 512,
			batchSize: options.batchSize || 12,
			jitter: [100, 600],
			protect: options.protect ? new Set(options.protect) : /* @__PURE__ */ new Set(),
			retry: {
				times: 8,
				delay: (times) => 200 * times ** 2,
				jitter: [200, 700]
			}
		};
		const converter = new ZhConverter(text, converterOptions);
		const trackProgress = async () => {
			try {
				for await (const progress of converter) {
					if (!onProgress) continue;
					onProgress(progress);
				}
			} catch {
				console.debug("進度追蹤已終止");
			}
		};
		trackProgress();
		let result = "";
		try {
			result = await converter;
		} catch (error) {
			throw new Error(`轉換過程失敗: ${error instanceof Error ? error.message : String(error)}`);
		}
		return result;
	}
};
//#endregion
//#region src/main/strategies/SrtStrategy.ts
var SrtStrategy = class {
	static async execute(filePath, options, onProgress) {
		if (!filePath) throw new Error("檔案路徑不能為空");
		let rawContent = "";
		try {
			rawContent = await fs.readFile(filePath, "utf-8");
		} catch (error) {
			throw new Error(`讀取 SRT 檔案失敗: ${error instanceof Error ? error.message : String(error)}`);
		}
		const parsedBlocks = rawContent.trim().split(/\r?\n\r?\n/).map((block) => {
			const match = block.match(/^(.*?)\r?\n(.*?)\r?\n([\s\S]*)$/);
			if (!match) return {
				isStandard: false,
				raw: block,
				text: ""
			};
			return {
				isStandard: true,
				index: match[1],
				time: match[2],
				text: match[3],
				raw: block
			};
		});
		const converter = new ZhConverter(parsedBlocks.map((b) => {
			if (!b.isStandard) return "";
			let encoded = b.text;
			encoded = encoded.replace(/\\n/g, "\\\\n");
			encoded = encoded.replace(/\r?\n/g, "\\n");
			return encoded;
		}).join("\n"), {
			converter: options.converter || "Taiwan",
			chunkSize: options.chunkSize || 512,
			batchSize: options.batchSize || 4,
			jitter: [100, 500],
			protect: options.protect ? new Set(options.protect) : /* @__PURE__ */ new Set()
		});
		const trackProgress = async () => {
			try {
				for await (const progress of converter) if (onProgress) onProgress(progress);
			} catch {
				console.debug("進度追蹤已終止");
			}
		};
		trackProgress();
		let convertedFullText = "";
		try {
			convertedFullText = await converter;
		} catch (error) {
			throw new Error(`SRT 轉換過程失敗: ${error instanceof Error ? error.message : String(error)}`);
		}
		const convertedLines = convertedFullText.split("\n");
		return parsedBlocks.map((b, i) => {
			if (!b.isStandard) return b.raw;
			let decoded = convertedLines[i] || "";
			decoded = decoded.replace(/\\\\n|\\n/g, (match) => {
				if (match === "\\\\n") return "\\n";
				if (match === "\\n") return "\n";
				return match;
			});
			return `${b.index}\n${b.time}\n${decoded}`;
		}).join("\n\n") + "\n";
	}
};
//#endregion
//#region src/main/strategies/JsonStrategy.ts
var JsonStrategy = class {
	static async execute(filePath, options, onProgress) {
		if (!filePath) throw new Error("檔案路徑不能為空");
		const convertKeys = options.convertKeys ?? true;
		const convertValues = options.convertValues ?? true;
		let rawContent = "";
		try {
			rawContent = await fs.readFile(filePath, "utf-8");
		} catch (error) {
			throw new Error(`讀取 JSON 檔案失敗: ${error instanceof Error ? error.message : String(error)}`);
		}
		const isJsonl = filePath.toLowerCase().endsWith(".jsonl");
		let parsedData;
		try {
			if (isJsonl) parsedData = rawContent.split(/\r?\n/).filter((line) => line.trim().length > 0).map((line) => JSON.parse(line));
			else parsedData = JSON.parse(rawContent);
		} catch (error) {
			throw new Error(`JSON 解析失敗，請確認檔案結構: ${error instanceof Error ? error.message : String(error)}`);
		}
		if (!convertKeys && !convertValues) return isJsonl ? parsedData.map((obj) => JSON.stringify(obj)).join("\n") + "\n" : JSON.stringify(parsedData, null, 2);
		const textsToConvert = [];
		const escapeText = (text) => {
			return text.replace(/\\n/g, "\\\\n").replace(/\r?\n/g, "\\n");
		};
		const unescapeText = (text) => {
			return text.replace(/\\\\n|\\n/g, (match) => {
				if (match === "\\\\n") return "\\n";
				if (match === "\\n") return "\n";
				return match;
			});
		};
		const extract = (node) => {
			if (node === null || typeof node !== "object") return;
			if (Array.isArray(node)) for (const item of node) extract(item);
			else for (const [key, value] of Object.entries(node)) {
				if (convertKeys) textsToConvert.push(escapeText(key));
				if (typeof value === "string") {
					if (convertValues) textsToConvert.push(escapeText(value));
				} else if (value !== null && typeof value === "object") extract(value);
			}
		};
		extract(parsedData);
		if (textsToConvert.length === 0) return isJsonl ? parsedData.map((obj) => JSON.stringify(obj)).join("\n") + "\n" : JSON.stringify(parsedData, null, 2);
		const converter = new ZhConverter(textsToConvert.join("\n"), {
			converter: options.converter || "Taiwan",
			chunkSize: 4096,
			batchSize: options.batchSize || 4,
			jitter: [100, 500],
			protect: options.protect ? new Set(options.protect) : /* @__PURE__ */ new Set()
		});
		const trackProgress = async () => {
			try {
				for await (const progress of converter) if (onProgress) onProgress(progress);
			} catch {
				console.debug("進度追蹤已終止");
			}
		};
		trackProgress();
		let convertedFullText = "";
		try {
			convertedFullText = await converter;
		} catch (error) {
			throw new Error(`JSON 轉換失敗: ${error instanceof Error ? error.message : String(error)}`);
		}
		const convertedLines = convertedFullText.split("\n");
		const rebuild = (node) => {
			if (node === null || typeof node !== "object") return node;
			if (Array.isArray(node)) {
				const newArr = [];
				for (const item of node) newArr.push(rebuild(item));
				return newArr;
			} else {
				const newObj = {};
				for (const [key, value] of Object.entries(node)) {
					let newKey = key;
					if (convertKeys) newKey = unescapeText(convertedLines.shift() || "");
					let newValue = value;
					if (typeof value === "string") {
						if (convertValues) newValue = unescapeText(convertedLines.shift() || "");
					} else if (value !== null && typeof value === "object") newValue = rebuild(value);
					newObj[newKey] = newValue;
				}
				return newObj;
			}
		};
		const rebuiltData = rebuild(parsedData);
		return isJsonl ? rebuiltData.map((obj) => JSON.stringify(obj)).join("\n") + "\n" : JSON.stringify(rebuiltData, null, 2);
	}
};
//#endregion
//#region src/main/strategies/StrategyFactory.ts
var StrategyFactory = class {
	static getStrategy(filePath) {
		if (!filePath) throw new Error("無效的檔案路徑");
		const ext = path.extname(filePath).toLowerCase();
		switch (ext) {
			case ".md":
			case ".log":
			case ".txt": return TxtStrategy;
			case ".srt": return SrtStrategy;
			case ".json":
			case ".jsonl": return JsonStrategy;
			default: throw new Error(`目前尚未支援此檔案格式: ${ext}`);
		}
	}
};
//#endregion
//#region src/main/QueueManager.ts
var QueueManager = class QueueManager {
	constructor() {
		this.queue = [];
		this.isProcessing = false;
		this.progressWindow = null;
	}
	static getInstance() {
		if (!QueueManager.instance) QueueManager.instance = new QueueManager();
		return QueueManager.instance;
	}
	setProgressWindow(window) {
		this.progressWindow = window;
		this.broadcastQueueUpdate();
	}
	addTask(task) {
		this.queue.push(task);
		this.broadcastQueueUpdate();
		if (!this.isProcessing) this.processNext();
	}
	getQueue() {
		return [...this.queue];
	}
	async processNext() {
		const pendingTask = this.queue.find((t) => t.status === "pending");
		if (!pendingTask) {
			this.isProcessing = false;
			return;
		}
		this.isProcessing = true;
		pendingTask.status = "processing";
		this.broadcastQueueUpdate();
		let tempFilePath = "";
		try {
			let resultText = "";
			const strategyOptions = {
				converter: "Taiwan",
				...pendingTask.formatOptions
			};
			if (pendingTask.type === "file") resultText = await StrategyFactory.getStrategy(pendingTask.sourcePathOrContent).execute(pendingTask.sourcePathOrContent, strategyOptions, (progress) => this.updateTaskProgress(pendingTask.id, progress.current / progress.total));
			else {
				const timestamp = Date.now();
				tempFilePath = path.join(os.tmpdir(), `zh_converter_paste_${timestamp}.txt`);
				await fs.writeFile(tempFilePath, pendingTask.sourcePathOrContent, "utf-8");
				resultText = await TxtStrategy.execute(tempFilePath, strategyOptions, (progress) => this.updateTaskProgress(pendingTask.id, progress.current / progress.total));
			}
			const finalPath = await this.resolveSavePath(pendingTask.saveDir, pendingTask.saveName);
			await fs.writeFile(finalPath, resultText, "utf-8");
			pendingTask.status = "completed";
			pendingTask.progress = 1;
		} catch (error) {
			console.error(`任務 ${pendingTask.id} 失敗:`, error);
			pendingTask.status = "error";
			pendingTask.errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			if (tempFilePath) await fs.unlink(tempFilePath).catch(() => {});
			this.broadcastQueueUpdate();
			this.processNext();
		}
	}
	async resolveSavePath(dir, initialName) {
		let finalName = initialName || "clipboard-converted.txt";
		if (!finalName.endsWith(".txt")) finalName += ".txt";
		const ext = path.extname(finalName);
		const base = path.basename(finalName, ext);
		let finalPath = path.join(dir, finalName);
		let counter = 1;
		while (true) try {
			await fs.access(finalPath);
			finalPath = path.join(dir, `${base}(${counter})${ext}`);
			counter++;
		} catch {
			break;
		}
		return finalPath;
	}
	updateTaskProgress(id, progress) {
		const task = this.queue.find((t) => t.id === id);
		if (task) {
			task.progress = progress;
			this.broadcastQueueUpdate();
		}
	}
	broadcastQueueUpdate() {
		if (!this.progressWindow || this.progressWindow.isDestroyed()) return;
		this.progressWindow.webContents.send("queue-updated", this.queue);
	}
};
//#endregion
//#region src/main/ipcHandlers.ts
function registerIpcHandlers() {
	ipcMain.handle("get-accent-color", () => {
		try {
			if (process.platform !== "win32" && process.platform !== "darwin") return null;
			return `#${systemPreferences.getAccentColor()}`;
		} catch (error) {
			console.error("無法取得系統強調色:", error);
			return null;
		}
	});
	ipcMain.handle("select-directory", async (event) => {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (!window) return null;
		const result = await dialog.showOpenDialog(window, { properties: ["openDirectory", "createDirectory"] });
		if (result.canceled || result.filePaths.length === 0) return null;
		return result.filePaths[0];
	});
	ipcMain.handle("check-directory", async (_, dir) => {
		if (!dir) return false;
		try {
			return (await fs.stat(dir)).isDirectory();
		} catch {
			return false;
		}
	});
	ipcMain.handle("show-progress-window", () => {
		showProgressWindow();
	});
	ipcMain.handle("close-progress-window", (event) => {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (!window) return;
		window.close();
	});
	ipcMain.handle("get-queue-state", () => {
		return QueueManager.getInstance().getQueue();
	});
	ipcMain.handle("enqueue-task", (_, payload) => {
		if (!payload.contentOrPath) throw new Error("任務內容不能為空");
		if (!payload.saveDir) throw new Error("儲存路徑不能為空");
		const task = {
			id: crypto.randomUUID(),
			displayName: payload.displayName,
			type: payload.type,
			sourcePathOrContent: payload.contentOrPath,
			saveDir: payload.saveDir,
			saveName: payload.saveName,
			status: "pending",
			progress: 0,
			formatOptions: payload.formatOptions
		};
		QueueManager.getInstance().addTask(task);
		showProgressWindow();
		return task.id;
	});
	ipcMain.handle("set-theme", (_, isDark) => {
		const windows = BrowserWindow.getAllWindows();
		for (const win of windows) {
			if (win.isDestroyed()) continue;
			win.webContents.send("theme-changed", isDark);
		}
	});
}
//#endregion
//#region src/main/main.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var mainWindow = null;
var progressWindow = null;
function createMainWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 720,
		autoHideMenuBar: true,
		titleBarStyle: "default",
		webPreferences: {
			preload: path.join(__dirname, "../preload/index.mjs"),
			nodeIntegration: false,
			contextIsolation: true
		}
	});
	if (process.env.VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
		mainWindow.webContents.openDevTools();
	} else mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
	mainWindow.on("closed", () => {
		mainWindow = null;
		if (progressWindow) progressWindow.close();
	});
}
function showProgressWindow() {
	if (progressWindow && !progressWindow.isDestroyed()) {
		progressWindow.focus();
		return;
	}
	progressWindow = new BrowserWindow({
		width: 400,
		height: 600,
		autoHideMenuBar: true,
		titleBarStyle: "hidden",
		webPreferences: {
			preload: path.join(__dirname, "../preload/index.mjs"),
			nodeIntegration: false,
			contextIsolation: true
		}
	});
	if (process.env.VITE_DEV_SERVER_URL) progressWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}progress.html`);
	else progressWindow.loadFile(path.join(__dirname, "../../dist/progress.html"));
	QueueManager.getInstance().setProgressWindow(progressWindow);
	progressWindow.on("closed", () => {
		progressWindow = null;
		QueueManager.getInstance().setProgressWindow(null);
	});
}
app.whenReady().then(() => {
	registerIpcHandlers();
	createMainWindow();
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
	});
});
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
//#endregion
export { showProgressWindow };
