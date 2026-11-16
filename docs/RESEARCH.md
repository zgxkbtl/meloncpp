# 浏览器 C++ 编译器选型与实测

调研日期：2026-11-16 至 2026-11-17。Star 数是调研时 GitHub API 快照，不代表质量保证。

## 结论

采用 **Clang 22.1.8 + wasi-sdk sysroot + 社区浏览器移植运行时**。具体复用 CppStudio `wasm-clang-runtime` 的锁定发行资产，使用无需新异常指令的 `noeh` 版本。实现本项目自己的界面、Worker 编排、WASI 标准输入输出、运行限制与对拍；首载工具链实测 26.90 MiB。这个选择优先满足手机与纯静态部署，不将高 Star 数直接等同于适合本任务。

没有找到同时满足“LLVM 官方直接发布、可开箱浏览器内编译 C++、体积轻、完整 GCC 兼容”的发行包。LLVM / Emscripten / wasi-sdk 是可信的上游基础，但将 C++ 编译成 WASM 与将编译器自身编译成 WASM 是两件事。

## 比较

| 项目 | Star 快照 | 核对结果 | 本项目决策 |
| --- | ---: | --- | --- |
| [YoWASP/clang](https://github.com/YoWASP/clang) | 40 | GitHub 显示 2026-03-11 归档；Clang 21 功能实测可用 | 排除正式依赖 |
| [Wasmer SDK](https://github.com/wasmerio/wasmer-sdk) + [clang/clang](https://wasmer.io/clang/clang) | 1,264（SDK） | 官方 SDK 持续维护；实测 Clang 包下载约 106 MiB，包版本 0.160000.1 对应 Clang 16.0.0；浏览器需要 SharedArrayBuffer 和 COOP/COEP | 对本任务过重，排除 |
| [Emscripten](https://github.com/emscripten-core/emscripten) | 27,780 | 活跃，主要是在开发机运行的 C/C++→WASM 工具链 | 可作为未来自建工具链基础，不是可直接嵌入的浏览器编译器 |
| [WebAssembly/wasi-sdk](https://github.com/WebAssembly/wasi-sdk) | 1,664 | 活跃；主要提供在开发机运行、面向 WASI 的交叉编译器和 sysroot | 使用其生态与 sysroot，不误当现成网页编译器 |
| [Xeus-Cpp](https://github.com/compiler-research/xeus-cpp) | 136 | 活跃，Jupyter 官方博客介绍浏览器运行；架构偏 REPL / Notebook | 完整 main + stdin/stdout 工具接入成本较高 |
| [binji/wasm-clang](https://github.com/binji/wasm-clang) | 342 | 经典 CppCon 2019 原型；最后推送 2023-12 | 仅作技术来源参考 |
| [emception](https://github.com/jprendes/emception) | 359 | 在浏览器中运行 Emscripten 的社区项目；最后推送 2024-07 | 组件多、维护风险，不作为默认 |
| [browsercc](https://github.com/BertalanD/browsercc) | 11 | 可编译、具有 PCH；最后推送 2025-04 | 比较参考 |
| [CppStudio wasm-clang-runtime](https://github.com/cppstudio-io/wasm-clang-runtime) | 1 | 2026-08 有发行与更新，Clang 22.1.8，保留构建说明和移动内核兼容构建 | 选定；锁定资产并修正 sysroot |

Wasmer 的官方说明：[Running Clang in the browser](https://wasmer.io/posts/clang-in-browser)、[JavaScript SDK](https://docs.wasmer.io/runtime/js/)。Xeus-Cpp：[Jupyter 官方介绍](https://blog.jupyter.org/posts/2025/c-in-jupyter-interpreting-c-in-the-web/)。上游浏览器运行时：[发行页](https://github.com/cppstudio-io/wasm-clang-runtime/releases/tag/v0.1.0)。

## 不能只检查 README

一些包装项目宣称“完整 libstdc++ / bits / PBDS”，源码却是 libc++ 与补充的兼容头。不能据此保证 GNU GCC 的行为。

选定运行时的发行 sysroot 也存在实际问题：`iostream` 被替换成教学用 `teach_istream` / `teach_ostream`。回归测试发现 `getline` 无法编译，默认 bool 输出也不同于标准流。本项目以同版本 [LLVM 官方 iostream](https://github.com/llvm/llvm-project/blob/llvmorg-22.1.8/libcxx/include/iostream) 修正它，其余标准库、库归档与编译器仍使用锁定发行版。所有修正、来源与 SHA-256 都在仓库中保留。

## 已实测支持

真实编译与执行，不是模拟编译器响应：

- `#include <bits/stdc++.h>`：本地聚合兼容头，涵盖竞赛常用标准库，并按 C++20 条件加入 ranges/concepts/span/numbers 等。
- GNU++17、GNU++20、O0、O2。
- vector、sort、priority_queue、set、unordered_map、gcd、bitset、long long。
- C++20 ranges、concepts、popcount、span、numbers。
- `__int128` 运算；不是仅检查能否写出类型名。
- cin/cout、scanf/printf、真实 libc++ 流格式控制、UTF-8、CRLF、EOF。
- 编译错误诊断、不为错误程序生成执行文件。
- 超量输出中止、程序 WASM 内存增长受限、无限循环能由 Worker 终止。

PBDS 和 `bits/extc++.h` 不支持。`bits/stdc++.h` 仅解决常用标准头聚合问题，不会把 libc++ 变成 libstdc++。GNU 私有函数如 `std::__gcd` 不属于承诺接口，请使用标准 `std::gcd`。

## 为什么适合 Cloudflare

[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) 可直接托管生成的 `dist/`，编译和运行不会占用边缘 CPU。其[单个静态资产上限为 25 MiB](https://developers.cloudflare.com/workers/platform/limits/)；本项目最大压缩资源约 13.04 MiB，无需 R2 或拆分下载。

仅使用 Workers 静态资产路径，请求与流量计费以账户当前计划及 [Cloudflare 官方说明](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) 为准。无需开通新付费产品。`_headers` 为同源资源设置长期缓存与浏览器安全策略；编译器不需要 SharedArrayBuffer，也无需跨源隔离。

## 能否把编译与运行放到 Workers（2026-11-17）

Workers [支持运行 WASM](https://developers.cloudflare.com/workers/runtime-apis/webassembly/)。但需要区分固定随部署发布的模块、用户提交的动态 WASM，以及整套 C++ 编译器。

普通 Workers [禁止运行期调用 WebAssembly.compile / compileStreaming / instantiate(buffer)](https://developers.cloudflare.com/workers/runtime-apis/web-standards/#javascript-standards)。[Dynamic Workers](https://developers.cloudflare.com/dynamic-workers/api-reference/#modules-recordstring-string--module) 支持通过 `{wasm: ArrayBuffer}` 装载动态模块，适合隔离执行用户编译后的产物，并可限制 CPU 和网络访问；它目前[需要 Workers Paid](https://developers.cloudflare.com/dynamic-workers/pricing/)。这条路径仍需实现本项目的 WASI stdin/stdout 适配与执行限制，不能直接照搬浏览器 Worker API。

把用户程序的执行移到边缘，不能省掉浏览器端 C++ 编译器的下载。要让手机完全不下载工具链，C++ 编译过程也必须放到服务器。

普通 Workers 的[内存上限为每 isolate 128 MB，包含 JS 与 WASM；免费版 CPU 为 10 ms/请求，付费版默认 30 秒、最高 5 分钟](https://developers.cloudflare.com/workers/platform/limits/)。本项目用 A+B 和 bits/stdc++.h 进行 Node 本地诊断，单个 Clang 实例线性内存约 **127.75 MiB**，虚拟文件系统另需约 **36.31 MiB**，已经无法直接装入 128 MB 的 Worker；LLD 实例约 98.38 MiB。复现命令为 `node scripts/profile-toolchain.mjs`。这些是实例线性内存容量，不是精确 RSS，也不是所有实例同时驻留时的峰值保证。

若优先满足手机快速打开、零工具链下载，建议保留 Workers 静态前端与 API 入口，配合独立隔离的 GCC/Clang 编译运行服务。可以放在自有服务器，或者使用[Cloudflare Containers](https://developers.cloudflare.com/containers/)（需要付费计划与容器资源计费）；容器运行原生编译器，也更容易获得 GCC bits/PBDS 兼容性。需对提交程序设置隔离、运行与输出限制，并限制接口滥用。当前交付保持浏览器本地模式，没有切换到付费后端。
