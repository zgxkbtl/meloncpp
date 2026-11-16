# Melon C++ · 浏览器里的练习场

纯前端 C++ 算法练习工具。代码、编译、运行和测试数据都留在浏览器，托管平台只负责分发静态文件。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fzgxkbtl%2Fmeloncpp&project-name=meloncpp&repository-name=meloncpp)

推荐使用 Vercel：导入仓库即可部署，无需 API Key 或环境变量。上方按钮使用 Vercel 的仓库克隆流程；私有仓库请由有访问权限的账户直接在 Vercel 中 Import，供其他人一键克隆时需使用公开仓库。

- 真实 Clang 22.1.8 + LLD + libc++；GNU++17 / GNU++20、O0 / O2。
- `#include <bits/stdc++.h>` 兼容头；常用 STL、`__int128`、cin/cout、scanf/printf。
- 最多 8 组样例，复用编译结果，标准输出、标准错误和编译诊断分开显示。
- 可选严格字符比较或忽略空白的逐项比较。
- 独立编译 Worker 与运行 Worker；停止、运行时限、1 MiB 输出上限、64/128/256 MiB 程序线性内存上限。
- 手机分页工作区、固定运行按钮、触控目标、16px 编辑字号与安全区适配。
- 本地草稿自动保存、导入 C++ 文件、下载 main.cpp、⌘/Ctrl+Enter 运行。

## 本地运行

项目文件夹与 npm 包名均为 `meloncpp`。以下命令在项目根目录执行。

需要 Node.js 22.12+、npm、Python 3 和 curl。第一次构建会下载锁定的工具链，后续使用 `.cache/` 缓存。

```sh
npm ci
npm run dev
```

开发地址：<http://127.0.0.1:5173/>。生产预览：

```sh
npm run build
npm run preview
```

生产预览地址：<http://127.0.0.1:4173/>。

```sh
npm test
```

部署说明见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)，选型与兼容性见 [docs/RESEARCH.md](docs/RESEARCH.md)。

## 下载与运行边界

首载工具链 **26.90 MiB**（gzip），单个最大资源约 13.04 MiB；应用 JavaScript gzip 约 169 kB。全部同源自托管，不依赖运行时第三方 CDN、远程编译接口或 R2。HTTP 缓存可重复利用，但移动浏览器可能自行回收缓存。

程序目标是 `wasm32-wasip1`，使用 libc++，不是 Linux GCC/libstdc++。指针、`size_t`、`long` 为 32 位，`long long` 为 64 位。`bits/stdc++.h` 是本项目的标准库聚合兼容头，不能据此推断 GNU 扩展兼容性。PBDS、`bits/extc++.h`、x86 内联汇编、线程、异常捕获、文件与网络不在支持范围。输入需在运行前一次填完，不支持交互题。

时限只计程序执行，与编译时间分开。内存选择约束链接后程序的 WASM 线性内存，不是整个标签页或编译器的内存；编译器还需数百 MiB 级设备余量，低内存手机可能失败。显示的 WASM 内存是退出时的线性内存大小，不是精确 RSS 或完整峰值。正式比赛以官方评测环境为准。

首次工具链加载最多等待 10 分钟，实际编译最多 120 秒，两者分别计时。下载较慢时可查看底部进度，或随时手动停止。

## 工具链来源

浏览器编译器使用 [CppStudio wasm-clang-runtime](https://github.com/cppstudio-io/wasm-clang-runtime) 的 Clang 22 `noeh` 构建，版本、下载地址与 SHA-256 锁定在 `scripts/toolchain.lock.json`。它是社区移植，不是 LLVM 官方发布的浏览器发行版；其底层是 LLVM 与 wasi-sdk。

本项目修正上游 sysroot 中的教学版 `iostream`，换入 **LLVM 官方 llvmorg-22.1.8 的原始头文件**，避免 `getline`、格式控制和布尔输出行为偏差。`scripts/patch-sysroot.py` 可重现此修正。浏览器 JS 运行时以 ESM 导入，未采用动态 `eval`。

选型调研验证过 YoWASP，但因为仓库已归档，本项目最终不依赖其 npm 包，也不会把它分发给浏览器。

## 凭据

Vercel 静态部署不需要运行凭据。可选的 Cloudflare 部署凭据仅存于被 Git 忽略的 `.env`，权限为 0600；个人域名与账户配置使用 `wrangler.local.jsonc`。不要将真实 Token 放进 skills、README、公开目录或 `VITE_*` 变量。项目 skills 及其参考文件位于 `.agents/skills/`，包括 Cloudflare、Wrangler、Sandbox、Workers 最佳实践等。

## 开源声明

本项目采用 MIT，第三方部分保留原许可证；详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
