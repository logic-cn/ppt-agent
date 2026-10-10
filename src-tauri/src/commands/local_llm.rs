use std::num::NonZeroU32;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Instant;

use llama_cpp_2::context::params::{KvCacheType, LlamaContextParams};
use llama_cpp_2::json_schema_to_grammar;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{LlamaChatMessage, LlamaModel};
use llama_cpp_2::sampling::LlamaSampler;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

fn backend() -> &'static LlamaBackend {
    static B: OnceLock<LlamaBackend> = OnceLock::new();
    B.get_or_init(|| {
        LlamaBackend::init().expect("llama.cpp backend initialization failed")
    })
}

fn default_threads() -> i32 {
    // 基准/调优用：PPT_LOCAL_THREADS 可模拟低配机（限线程）推理
    if let Some(v) = std::env::var("PPT_LOCAL_THREADS")
        .ok()
        .and_then(|s| s.trim().parse::<i32>().ok())
    {
        if (1..=64).contains(&v) {
            return v;
        }
    }
    let logical = std::thread::available_parallelism()
        .map(|p| p.get())
        .unwrap_or(4);
    (logical.saturating_sub(1)).clamp(1, 8) as i32
}

pub struct LocalLlmState {
    model: Mutex<Option<Arc<LlamaModel>>>,
    model_path: Mutex<Option<String>>,
    ctx_size: Mutex<u32>,
    cancel: Arc<AtomicBool>,
    generation: tokio::sync::Mutex<()>,
}

impl Default for LocalLlmState {
    fn default() -> Self {
        Self {
            model: Mutex::new(None),
            model_path: Mutex::new(None),
            ctx_size: Mutex::new(8192),
            cancel: Arc::new(AtomicBool::new(false)),
            generation: tokio::sync::Mutex::new(()),
        }
    }
}

#[derive(Serialize)]
pub struct LoadStatus {
    pub loaded: bool,
    pub model_path: Option<String>,
    pub ctx_size: u32,
}

#[derive(Deserialize)]
pub struct ChatMessageDto {
    pub role: String,
    pub content: String,
}

#[derive(Deserialize)]
pub struct ChatRequestDto {
    pub messages: Vec<ChatMessageDto>,
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub max_tokens: Option<u32>,
    /// JSON Schema 字符串；提供时用 grammar 约束解码
    pub grammar_schema: Option<String>,
    pub seed: Option<u32>,
    /// MiniCPM5 思考链开关：默认 false（模板等价 enable_thinking=false，直接出答案）
    #[serde(default)]
    pub thinking: Option<bool>,
}

#[derive(Serialize)]
pub struct ChatResponseDto {
    pub content: String,
    pub tokens_generated: u32,
    pub cancelled: bool,
    pub truncated: bool,
    pub elapsed_ms: u64,
}

/// 流式增量事件负载：前端边生成边展示
#[derive(Clone, Serialize)]
struct TokenDelta {
    text: String,
}

const TOKEN_FLUSH_CHARS: usize = 24;

#[tauri::command]
pub async fn local_llm_load(
    state: State<'_, LocalLlmState>,
    model_path: String,
    ctx_size: Option<u32>,
) -> Result<LoadStatus, String> {
    let path = PathBuf::from(&model_path);
    if !path.exists() {
        return Err(format!("模型文件不存在: {model_path}"));
    }
    let _guard = state.generation.lock().await;
    let ctx_size = ctx_size.unwrap_or(8192).max(2048);
    let b = backend();
    let load_path = path.clone();
    let model = tokio::task::spawn_blocking(move || {
        LlamaModel::load_from_file(b, &load_path, &LlamaModelParams::default())
    })
    .await
    .map_err(|e| format!("模型加载任务失败: {e}"))?
    .map_err(|e| format!("模型加载失败: {e}"))?;

    *state.model.lock().unwrap_or_else(|e| e.into_inner()) = Some(Arc::new(model));
    *state.model_path.lock().unwrap_or_else(|e| e.into_inner()) =
        Some(path.to_string_lossy().into_owned());
    *state.ctx_size.lock().unwrap_or_else(|e| e.into_inner()) = ctx_size;

    Ok(LoadStatus {
        loaded: true,
        model_path: Some(path.to_string_lossy().into_owned()),
        ctx_size,
    })
}

#[tauri::command]
pub async fn local_llm_chat(
    app: AppHandle,
    state: State<'_, LocalLlmState>,
    req: ChatRequestDto,
) -> Result<ChatResponseDto, String> {
    let _guard = state.generation.lock().await;
    let model = state
        .model
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone()
        .ok_or_else(|| "本地模型尚未加载，请先下载并加载模型".to_string())?;
    let ctx_size = *state.ctx_size.lock().unwrap_or_else(|e| e.into_inner());
    let cancel = state.cancel.clone();
    cancel.store(false, Ordering::Relaxed);

    tokio::task::spawn_blocking(move || generate(Some(&app), model, ctx_size, req, cancel))
        .await
        .map_err(|e| format!("推理任务失败: {e}"))?
}

#[tauri::command]
pub fn local_llm_cancel(state: State<'_, LocalLlmState>) {
    state.cancel.store(true, Ordering::Relaxed);
}

#[tauri::command]
pub async fn local_llm_unload(state: State<'_, LocalLlmState>) -> Result<LoadStatus, String> {
    let _guard = state.generation.lock().await;
    state.cancel.store(true, Ordering::Relaxed);
    *state.model.lock().unwrap_or_else(|e| e.into_inner()) = None;
    *state.model_path.lock().unwrap_or_else(|e| e.into_inner()) = None;
    Ok(LoadStatus {
        loaded: false,
        model_path: None,
        ctx_size: *state.ctx_size.lock().unwrap_or_else(|e| e.into_inner()),
    })
}

#[tauri::command]
pub fn local_llm_status(state: State<'_, LocalLlmState>) -> LoadStatus {
    LoadStatus {
        loaded: state.model.lock().unwrap_or_else(|e| e.into_inner()).is_some(),
        model_path: state
            .model_path
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone(),
        ctx_size: *state.ctx_size.lock().unwrap_or_else(|e| e.into_inner()),
    }
}

fn generate(
    app: Option<&AppHandle>,
    model: Arc<LlamaModel>,
    n_ctx: u32,
    req: ChatRequestDto,
    cancel: Arc<AtomicBool>,
) -> Result<ChatResponseDto, String> {
    let started = Instant::now();
    let b = backend();
    let vocab = model.vocab();

    let tmpl = model
        .chat_template(None)
        .map_err(|e| format!("读取 chat template 失败: {e}"))?;
    let mut chat: Vec<LlamaChatMessage> = Vec::with_capacity(req.messages.len());
    for m in &req.messages {
        chat.push(
            LlamaChatMessage::new(m.role.clone(), m.content.clone())
                .map_err(|e| format!("构造消息失败: {e}"))?,
        );
    }
    let mut prompt = model
        .apply_chat_template(&tmpl, &chat, true)
        .map_err(|e| format!("应用 chat template 失败: {e}"))?;

    // MiniCPM5 默认输出思考链。其 chat template 支持 enable_thinking=false：
    // 在生成提示后预填「空 think 块」，模型直接续写正文。llama-cpp-2 不透传
    // jinja 变量，这里手动补同样的前缀；grammar 路径首 token 被语法强制，不受影响。
    let thinking = req.thinking.unwrap_or(false);
    let gen_tail = concat!("<|", "im_start|>assistant\n");
    if !thinking && prompt.ends_with(gen_tail) {
        prompt.push_str("<think>\n\n</think>\n\n");
    }

    let prompt_tokens = vocab.tokenize(prompt.as_bytes(), false, true);
    let n_prompt = prompt_tokens.len();
    if n_prompt + 8 >= n_ctx as usize {
        return Err(format!(
            "提示词过长（{} token），超出本地上下文 {n_ctx}",
            n_prompt
        ));
    }
    let threads = default_threads();
    let ctx_params = |n: u32| {
        LlamaContextParams::default()
            .with_n_ctx(NonZeroU32::new(n))
            .with_n_threads(threads)
            .with_n_threads_batch(threads)
            .with_type_k(KvCacheType::Q8_0)
            .with_type_v(KvCacheType::Q8_0)
    };
    // Metal 工作集被其他 GPU 大户挤占时上下文分配会失败（unable to extend the
    // memory map）：降档 KV 重试而不是让整份 deck 生成报废
    let mut ctx = match model.new_context(b, ctx_params(n_ctx)) {
        Ok(c) => c,
        Err(e) => {
            let smaller = (n_ctx / 4).max(2048);
            if smaller >= n_ctx || n_prompt + 8 >= smaller as usize {
                return Err(format!("创建推理上下文失败: {e}"));
            }
            model
                .new_context(b, ctx_params(smaller))
                .map_err(|e2| format!("创建推理上下文失败: {e}；降档 {smaller} 重试仍失败: {e2}"))?
        }
    };
    let n_ctx = ctx.n_ctx();
    let max_new = req.max_tokens.unwrap_or(1024) as usize;
    let budget = (n_ctx as usize - n_prompt - 1).min(max_new).max(1);

    let temperature = req.temperature.unwrap_or(0.7);
    let seed = req.seed.unwrap_or_else(|| {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos() as u32)
            .unwrap_or(42)
    });
    let mut parts: Vec<LlamaSampler> = Vec::new();
    let mut has_grammar = false;
    if let Some(schema) = req.grammar_schema.as_deref().filter(|s| !s.trim().is_empty()) {
        let gbnf =
            json_schema_to_grammar(schema).map_err(|e| format!("JSON Schema 转语法失败: {e}"))?;
        parts.push(
            LlamaSampler::grammar(&model, &gbnf, "root")
                .map_err(|e| format!("语法约束初始化失败: {e}"))?,
        );
        has_grammar = true;
    }
    if temperature <= 0.01 {
        parts.push(LlamaSampler::greedy());
    } else {
        parts.push(LlamaSampler::temp(temperature));
        parts.push(LlamaSampler::top_p(req.top_p.unwrap_or(0.9), 1));
        parts.push(LlamaSampler::dist(seed));
    }
    let mut sampler = LlamaSampler::chain_simple(parts);

    // prefill：按 n_batch 分块喂入，仅最后一个 token 请求 logits
    let chunk = (ctx.n_batch().max(1)) as usize;
    let mut batch = LlamaBatch::new(chunk.min(n_prompt).max(8), 1);
    let mut pos: i32 = 0;
    let mut fed = 0usize;
    let mut last_chunk_len = 1usize;
    while fed < n_prompt {
        if cancel.load(Ordering::Relaxed) {
            return Ok(cancelled_response(started));
        }
        let end = (fed + chunk).min(n_prompt);
        batch.clear();
        for j in fed..end {
            batch
                .add(prompt_tokens[j], pos, &[0], j == n_prompt - 1)
                .map_err(|e| format!("批处理添加 token 失败: {e}"))?;
            pos += 1;
        }
        ctx.decode(&mut batch)
            .map_err(|e| format!("prefill 解码失败: {e}"))?;
        last_chunk_len = end - fed;
        fed = end;
    }

    // 最后一个 prefill 批次里请求 logits 的 token 位于批内末尾，采样索引须指向它。
    // 注意：本版本 llama.cpp 的 llama_sampler_sample 内部已自动 accept 选中的 token，
    // 调用方不得再次 accept（grammar 会被推进两次导致空栈断言）。
    let mut next = sampler.sample(&ctx, (last_chunk_len - 1) as i32);

    let mut out_tokens: Vec<_> = Vec::with_capacity(budget);
    let mut closer = JsonTopCloser::new();
    let mut pending = String::new();
    let mut cancelled = false;
    let mut truncated = false;
    loop {
        if cancel.load(Ordering::Relaxed) {
            cancelled = true;
            break;
        }
        if vocab.is_eog(next) {
            break;
        }
        if out_tokens.len() >= budget {
            truncated = true;
            break;
        }
        out_tokens.push(next);
        let piece = vocab.detokenize(&[next], false, false);
        let piece_text = String::from_utf8_lossy(&piece).into_owned();
        pending.push_str(&piece_text);
        if pending.chars().count() >= TOKEN_FLUSH_CHARS {
            emit_delta(app, &mut pending);
        }
        if has_grammar && closer.feed(&piece_text) {
            // 顶层 JSON 已闭合：grammar 解析完成，继续采样会触发空 stacks 断言
            break;
        }
        batch.clear();
        batch
            .add(next, pos, &[0], true)
            .map_err(|e| format!("批处理添加 token 失败: {e}"))?;
        pos += 1;
        ctx.decode(&mut batch)
            .map_err(|e| format!("解码失败: {e}"))?;
        next = sampler.sample(&ctx, 0);
    }
    // 残留不足一个 flush 窗口的文本补发给前端（chat 返回值仍以完整结果为准）
    emit_delta(app, &mut pending);

    let bytes = vocab.detokenize(&out_tokens, true, false);
    let content = String::from_utf8_lossy(&bytes).into_owned();
    // 兜底剥离：若模型仍输出思考段（前缀注入未生效/自行重开 think），只保留正文
    let content = if thinking {
        content
    } else {
        strip_think(&content)
    };
    Ok(ChatResponseDto {
        content,
        tokens_generated: out_tokens.len() as u32,
        cancelled,
        truncated,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

/// 剥离 MiniCPM5 思考链：文本以 <think> 开头时，丢弃到 </think> 为止的内容；
/// 若被截断在思考段内（无闭合），正文尚未开始，返回空串交由上层重画。
fn strip_think(text: &str) -> String {
    let t = text.trim_start();
    if !t.starts_with("<think>") {
        return text.to_string();
    }
    match t.find("</think>") {
        Some(i) => t[i + "</think>".len()..].trim_start_matches(['\n', ' ']).to_string(),
        None => String::new(),
    }
}

fn cancelled_response(started: Instant) -> ChatResponseDto {
    ChatResponseDto {
        content: String::new(),
        tokens_generated: 0,
        cancelled: true,
        truncated: false,
        elapsed_ms: started.elapsed().as_millis() as u64,
    }
}

/// 把累积的增量文本作为 `local-llm-token` 事件发出并清空缓冲
fn emit_delta(app: Option<&AppHandle>, buf: &mut String) {
    if buf.is_empty() {
        return;
    }
    if let Some(app) = app {
        let text = std::mem::take(buf);
        let _ = app.emit("local-llm-token", TokenDelta { text });
    } else {
        buf.clear();
    }
}

/// 增量扫描生成文本，判断顶层 JSON 对象是否已闭合。
/// grammar 约束下解析完成后 stacks 为空，llama.cpp 会对后续 apply 触发断言，
/// 因此必须在闭合的当轮停止采样。
struct JsonTopCloser {
    depth: i32,
    in_string: bool,
    escape: bool,
    started: bool,
}

impl JsonTopCloser {
    fn new() -> Self {
        Self { depth: 0, in_string: false, escape: false, started: false }
    }

    fn feed(&mut self, text: &str) -> bool {
        for ch in text.chars() {
            if self.in_string {
                if self.escape {
                    self.escape = false;
                } else if ch == '\\' {
                    self.escape = true;
                } else if ch == '"' {
                    self.in_string = false;
                }
            } else {
                match ch {
                    '"' => self.in_string = true,
                    '{' | '[' => {
                        self.depth += 1;
                        self.started = true;
                    }
                    '}' | ']' => {
                        self.depth -= 1;
                        if self.started && self.depth == 0 {
                            return true;
                        }
                    }
                    _ => {}
                }
            }
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// grammar 构造的纯函数校验（不依赖模型文件）
    #[test]
    fn page_plan_schema_converts_to_grammar() {
        let schema = r#"{"type":"object","properties":{"pages":{"type":"array","items":{"type":"object","properties":{"role":{"type":"string","enum":["cover","content","closing"]},"title":{"type":"string"},"intent":{"type":"string"}},"required":["role","title","intent"]}}},"required":["pages"]}"#;
        let gbnf = json_schema_to_grammar(schema).expect("应能转为 GBNF");
        assert!(gbnf.contains("root"));
    }

    /// zod v4 discriminatedUnion 的 JSON Schema 形态（anyOf + const）
    /// 必须能转 grammar，否则端侧 patch 生成的 op 枚举不受约束
    #[test]
    fn discriminated_union_schema_converts_to_grammar() {
        let schema = r#"{"type":"object","properties":{"patches":{"type":"array","items":{"anyOf":[{"type":"object","properties":{"op":{"type":"string","const":"set_deck_title"},"title":{"type":"string"}},"required":["op","title"],"additionalProperties":false},{"type":"object","properties":{"op":{"type":"string","const":"delete_slide"},"slideId":{"type":"string"}},"required":["op","slideId"],"additionalProperties":false}]}}},"required":["patches"]}"#;
        let gbnf = json_schema_to_grammar(schema).expect("anyOf+const 应能转为 GBNF");
        assert!(gbnf.contains("root"));
    }

    /// 真实 deck-patch schema（zod v4 toJSONSchema 产物快照）必须可转 grammar，
    /// 防止 schema 演进引入转换器不支持的关键字（$ref/pattern 等）
    #[test]
    fn real_deck_patch_schema_converts_to_grammar() {
        let schema = include_str!("../../tests/deck_patch_schema.json");
        let gbnf = json_schema_to_grammar(schema).expect("真实 deck-patch schema 应能转为 GBNF");
        assert!(gbnf.contains("root"));
        assert!(gbnf.contains("set_deck_title"));
        assert!(gbnf.contains("merge_slides"));
    }

    #[test]
    fn json_top_closer_detects_object_completion() {
        let mut c = JsonTopCloser::new();
        assert!(!c.feed(r#"{"pages":[{"t":"a } b"#)); // 字符串内的 } 不计
        assert!(c.feed(r#""}]}"#)); // 闭合字符串后 } ] } → 顶层闭合
    }

    #[test]
    fn json_top_closer_handles_escapes() {
        let mut c = JsonTopCloser::new();
        // 字符串内 \" 不应提前闭合字符串；随后的 } 在字符串内不计
        assert!(!c.feed(r#"{"s":"a\"b}c""#));
        assert!(c.feed("}"));
    }

    #[test]
    fn strip_think_removes_reasoning() {
        let open = concat!("<", "think>");
        let close = concat!("<", "/think>");
        // 带思考前缀 -> 只留正文
        assert_eq!(strip_think(&format!("{open}\n推理{close}\n\n答案")), "答案");
        // 无前缀 -> 原样
        assert_eq!(strip_think("直接答案"), "直接答案");
        // 截断在思考段内 -> 空串（上层按失败重画）
        assert_eq!(strip_think(&format!("{open}\n推理未完")), "");
    }

    /// 真实模型冒烟（需本地 GGUF）：
    /// PPT_MODEL_PATH=/path/to/MiniCPM5-2B-Q4_K_M.gguf cargo test -p ppt-agent -- --ignored --nocapture
    #[test]
    #[ignore]
    fn grammar_constrained_json_with_real_model() {
        let path = std::env::var("PPT_MODEL_PATH").expect("需要 PPT_MODEL_PATH");
        let model = Arc::new(
            LlamaModel::load_from_file(
                backend(),
                PathBuf::from(&path),
                &LlamaModelParams::default(),
            )
            .expect("模型加载失败"),
        );
        let req = ChatRequestDto {
            messages: vec![ChatMessageDto {
                role: "user".into(),
                content: "为「Q3 业务复盘汇报」生成 2 页结构规划".into(),
            }],
            temperature: Some(0.6),
            top_p: None,
            max_tokens: Some(400),
            grammar_schema: Some(
                r#"{"type":"object","properties":{"pages":{"type":"array","items":{"type":"object","properties":{"role":{"type":"string","enum":["cover","content","closing"]},"title":{"type":"string"},"intent":{"type":"string"}},"required":["role","title","intent"]}}},"required":["pages"]}"#
                    .into(),
            ),
            seed: Some(42),
            thinking: None,
        };
        let out = generate(None, model, 8192, req, Arc::new(AtomicBool::new(false)))
            .expect("推理失败");
        println!(
            "tokens={} elapsed_ms={}\n{}",
            out.tokens_generated, out.elapsed_ms, out.content
        );
        let parsed: serde_json::Value =
            serde_json::from_str(&out.content).expect("grammar 下必须产出合法 JSON");
        assert!(parsed["pages"].is_array());
    }

    /// 前端管线联测 REPL（需本地 GGUF）：stdin 每行一个 ChatRequestDto JSON，
    /// stdout 每行一个响应（或 {"error":"..."}）。模型常驻、跨请求复用。
    /// 供 vitest 基准脚本驱动真实 generate() 链路：
    ///   PPT_MODEL_PATH=... ./target/debug/deps/ppt_agent_lib-* --ignored \
    ///     --nocapture local_llm_chat_repl_for_bench
    #[test]
    #[ignore]
    fn local_llm_chat_repl_for_bench() {
        use std::io::{BufRead, Write};
        let path = std::env::var("PPT_MODEL_PATH").expect("需要 PPT_MODEL_PATH");
        let n_ctx: u32 = std::env::var("PPT_LOCAL_CTX")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(16384);
        let model = Arc::new(
            LlamaModel::load_from_file(
                backend(),
                PathBuf::from(&path),
                &LlamaModelParams::default(),
            )
            .expect("模型加载失败"),
        );
        let mut out = std::io::stdout();
        writeln!(out, r#"{{"ready":true}}"#).unwrap();
        out.flush().unwrap();
        for line in std::io::stdin().lock().lines() {
            let Ok(line) = line else { break };
            if line.trim().is_empty() {
                continue;
            }
            let resp: String = match serde_json::from_str::<ChatRequestDto>(&line) {
                Ok(req) => match generate(
                    None,
                    model.clone(),
                    n_ctx,
                    req,
                    Arc::new(AtomicBool::new(false)),
                ) {
                    Ok(dto) => serde_json::to_string(&dto).unwrap(),
                    Err(e) => format!(r#"{{"error":{}}}"#, serde_json::to_string(&e).unwrap()),
                },
                Err(e) => format!(
                    r#"{{"error":{}}}"#,
                    serde_json::to_string(&format!("请求解析失败: {e}")).unwrap()
                ),
            };
            writeln!(out, "{resp}").unwrap();
            out.flush().unwrap();
        }
    }
}
