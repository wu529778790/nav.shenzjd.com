/**
 * auth.ts 单元测试：HMAC session 签发/校验（安全关键）
 */

import { describe, expect, it, beforeEach } from "vitest";
import { createSessionToken, verifySessionToken, getSessionLogin, adminLogin } from "./auth";

const SECRET = "test-secret-0123456789-abcdefghijklmn";
const OTHER_SECRET = "another-secret-9876543210-abcdefghij";

beforeEach(() => {
  process.env.AUTH_SECRET = SECRET;
  process.env.ADMIN_GITHUB_LOGIN = "wu529778790";
});

describe("createSessionToken / verifySessionToken", () => {
  it("正常签发 → 校验通过并返回 sub", () => {
    const token = createSessionToken("wu529778790");
    expect(verifySessionToken(token)).toBe("wu529778790");
  });

  it("空/undefined/null → null", () => {
    expect(verifySessionToken(undefined)).toBeNull();
    expect(verifySessionToken(null)).toBeNull();
    expect(verifySessionToken("")).toBeNull();
  });

  it("格式错误（非两段）→ null", () => {
    expect(verifySessionToken("abc")).toBeNull();
    expect(verifySessionToken("a.b.c")).toBeNull();
  });

  it("payload 被篡改 → null（签名不匹配）", () => {
    const token = createSessionToken("wu529778790");
    const [payload, sig] = token.split(".");
    // 篡改 payload：换成另一个用户
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: "attacker", exp: Math.floor(Date.now() / 1000) + 3600 })
    ).toString("base64url");
    expect(verifySessionToken(`${forgedPayload}.${sig}`)).toBeNull();
  });

  it("签名被篡改 → null", () => {
    const token = createSessionToken("wu529778790");
    const [payload] = token.split(".");
    expect(verifySessionToken(`${payload}.AAAA`)).toBeNull();
  });

  it("过期 token → null", () => {
    // 手工构造一个已过期的 payload（用同一密钥签名）
    const expiredPayload = Buffer.from(
      JSON.stringify({ sub: "wu529778790", exp: Math.floor(Date.now() / 1000) - 10 })
    ).toString("base64url");
    const { createHmac } = require("node:crypto");
    const sig = createHmac("sha256", SECRET).update(expiredPayload).digest("base64url");
    expect(verifySessionToken(`${expiredPayload}.${sig}`)).toBeNull();
  });

  it("不同密钥签发的 token 用本密钥校验 → null", () => {
    process.env.AUTH_SECRET = OTHER_SECRET;
    const token = createSessionToken("wu529778790");
    process.env.AUTH_SECRET = SECRET;
    expect(verifySessionToken(token)).toBeNull();
  });
});

describe("getSessionLogin（从 Request cookie 解析）", () => {
  it("无 cookie → null", () => {
    const req = new Request("https://example.com");
    expect(getSessionLogin(req)).toBeNull();
  });

  it("有有效 admin_session → 返回登录名", () => {
    const token = createSessionToken("wu529778790");
    const req = new Request("https://example.com", {
      headers: { cookie: `admin_session=${encodeURIComponent(token)}; other=1` },
    });
    expect(getSessionLogin(req)).toBe("wu529778790");
  });

  it("非管理员账号 → null", () => {
    process.env.AUTH_SECRET = SECRET;
    const token = createSessionToken("someone_else");
    const req = new Request("https://example.com", {
      headers: { cookie: `admin_session=${encodeURIComponent(token)}` },
    });
    expect(getSessionLogin(req)).toBeNull();
  });
});

describe("adminLogin", () => {
  it("默认值 wu529778790", () => {
    delete process.env.ADMIN_GITHUB_LOGIN;
    expect(adminLogin()).toBe("wu529778790");
  });
});
