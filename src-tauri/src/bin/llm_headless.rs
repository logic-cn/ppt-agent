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
//!   取消：`{"cancel":true}`——不产生响应，置位取消标记让进行中的生成尽快
//!          结束（对齐桌面端 `local_llm_cancel` 命令的语义）。
//!   响应：`{"ok":true,"content":"...","tokens_generated":123,"elapsed_ms":456}`

use std::io::{self, BufRead, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};

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
    let (tx, rx) = mpsc::channel::<Result<ChatRequestDto, String>>();
    let boot = std::time::Instant::now();

    // 读线程独立于生成主循环：生成是分钟级同步调用，若在主循环里读 stdin，
    // 取消请求只能等当前生成自然结束后才被看到——失控生成会占住串行队列
    // 直到自然结束（端侧实跑第 5 轮实测 25 分钟）。读线程让 {"cancel":true}
    // 在生成进行中被受理：generate 的逐 token 取消检查点会尽快收尾并返回
    // cancelled 响应，主循环随后取下一条请求。
    let cancel_reader = cancel.clone();
    let boot_reader = boot.clone();
    std::thread::spawn(move || {
        let stdin = io::stdin();
        for line in stdin.lock().lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => break,
            };
            let t = line.trim();
            if t.is_empty() {
                continue;
            }
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(t) {
                if v.get("cancel").and_then(|c| c.as_bool()).unwrap_or(false) {
                    eprintln!(
                        "[llm_headless] +{}s 收到 cancel 请求，置位取消标记",
                        boot_reader.elapsed().as_secs()
                    );
                    cancel_reader.store(true, Ordering::Relaxed);
                    continue;
                }
            }
            eprintln!(
                "[llm_headless] +{}s 读线程收到请求（{} 字节），送入队列",
                boot_reader.elapsed().as_secs(),
                t.len()
            );
            let parsed =
                serde_json::from_str::<ChatRequestDto>(t).map_err(|e| format!("请求解析失败: {e}"));
            if tx.send(parsed).is_err() {
                break;
            }
        }
        eprintln!(
            "[llm_headless] +{}s stdin 关闭，读线程退出",
            boot_reader.elapsed().as_secs()
        );
    });

    let mut out = io::stdout();
    for msg in rx {
        let req = match msg {
            Ok(r) => r,
            Err(e) => {
                let resp = serde_json::json!({ "ok": false, "error": e });
                let _ = writeln!(out, "{resp}");
                let _ = out.flush();
                continue;
            }
        };

        // 每次生成前复位取消标记：上一轮的取消（若有）不应影响本轮
        cancel.store(false, Ordering::Relaxed);

        let started = std::time::Instant::now();
        eprintln!(
            "[llm_headless] +{}s 开始生成（{} 条消息）",
            boot.elapsed().as_secs(),
            req.messages.len()
        );
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
                eprintln!(
                    "[llm_headless] +{}s 生成结束 gen={} cancelled={} 耗时{}ms",
                    boot.elapsed().as_secs(),
                    res.tokens_generated,
                    res.cancelled,
                    started.elapsed().as_millis()
                );
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
