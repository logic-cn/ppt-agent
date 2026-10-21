//! 无头端到端 harness 的推理侧：stdio JSON-lines 协议包装 llama.cpp 推理。
//!
//! 桌面端里这层是 Tauri IPC（`local_llm_chat` 命令）；harness 没有 GUI，
//! 于是用同一条推理路径（同一个 `generate()` 函数、同一套 grammar 约束）
//! 以行 JSON 暴露给 Node 侧的管线脚本。
//!
//! 用法：`cargo run --release --bin llm_headless -- <model-path> [ctx-size]`
//! 协议：每行一个 JSON 请求 → 每行一个 JSON 响应。
//!   请求：`{"messages":[{"role":"user","content":"..."}],"temperature":0.7,
//!          "top_p":0.9,"max_tokens":1024,"grammar_schema":"{...}"}`
//!   响应：`{"ok":true,"content":"...","tokens_generated":123,"elapsed_ms":456}`

use std::io::{self, BufRead, Write};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::LlamaModel;
use ppt_agent_lib::commands::local_llm::{backend, generate, ChatRequestDto};

fn main() {
    let mut args = std::env::args().skip(1);
    let model_path = args.next().unwrap_or_default();
    let ctx_size: u32 = args.next().and_then(|s| s.parse().ok()).unwrap_or(8192);

    let b = backend();
    let model = match LlamaModel::load_from_file(b, &model_path, &LlamaModelParams::default()) {
        Ok(m) => Arc::new(m),
        Err(e) => {
            eprintln!("[llm_headless] 模型加载失败: {e}");
            std::process::exit(1);
        }
    };
    eprintln!("[llm_headless] 模型已加载: {model_path} (ctx={ctx_size})");

    let cancel = Arc::new(AtomicBool::new(false));
    let stdin = io::stdin();
    let mut out = io::stdout();

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[llm_headless] 读取 stdin 失败: {e}");
                break;
            }
        };
        if line.trim().is_empty() {
            continue;
        }

        let req: ChatRequestDto = match serde_json::from_str(&line) {
            Ok(r) => r,
            Err(e) => {
                let resp = serde_json::json!({ "ok": false, "error": format!("请求解析失败: {e}") });
                let _ = writeln!(out, "{resp}");
                let _ = out.flush();
                continue;
            }
        };

        let started = std::time::Instant::now();
        match generate(None, model.clone(), ctx_size, req, cancel.clone()) {
            Ok(res) => {
                let resp = serde_json::json!({
                    "ok": true,
                    "content": res.content,
                    "tokens_generated": res.tokens_generated,
                    "cancelled": res.cancelled,
                    "truncated": res.truncated,
                    "elapsed_ms": started.elapsed().as_millis() as u64,
                    "prompt_tokens": res.prompt_tokens,
                });
                let _ = writeln!(out, "{resp}");
            }
            Err(e) => {
                let resp = serde_json::json!({ "ok": false, "error": e });
                let _ = writeln!(out, "{resp}");
            }
        }
        let _ = out.flush();
    }
}
