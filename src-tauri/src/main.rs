// 防止移动端额外的 stdout 输出
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ppt_agent_lib::run()
}
