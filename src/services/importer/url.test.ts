import { describe, it, expect } from "vitest";
import { assertPublicHttpUrl } from "./url";

describe("assertPublicHttpUrl（SSRF 黑名单）", () => {
  it.each([
    "http://localhost:3000/x",
    "http://sub.localhost/x",
    "http://127.0.0.1/x",
    "http://127.0.0.2/x",
    "http://0x7f000001/x",
    "http://2130706433/x",
    "http://0177.0.0.1/x",
    "http://10.1.2.3/x",
    "http://172.16.0.1/x",
    "http://172.31.255.255/x",
    "http://192.168.1.1/x",
    "http://169.254.169.254/latest/meta-data",
    "http://100.64.0.1/x",
    "http://0.0.0.0/x",
    "http://[::1]/x",
    "http://[::ffff:127.0.0.1]/x",
    "http://[fe80::1]/x",
    "http://[fd00::1]/x",
    "http://host.internal/x",
    "http://host.local/x",
    "file:///etc/passwd",
    "ftp://example.com/x",
  ])("拒绝内网/保留/非法地址 %s", (url) => {
    expect(() => assertPublicHttpUrl(url)).toThrow();
  });

  it.each([
    "https://example.com/article",
    "http://8.8.8.8/x",
    "https://172.32.0.1/x", // 172.16-31 之外是公网
    "http://100.128.0.1/x", // CGNAT 之外是公网
    "https://docs.example.com/a/b?q=1",
  ])("放行公网地址 %s", (url) => {
    expect(() => assertPublicHttpUrl(url)).not.toThrow();
  });
});
