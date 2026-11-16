# 部署 Melon C++

本项目是 Vite 静态站点。推荐 Vercel，也可将 `dist/` 发布到其他静态托管平台。C++ 编译与执行都在访问者的浏览器中完成，服务器不运行用户代码。

## Vercel

1. 在 Vercel 中选择 Add New Project / Import Git Repository，选择本仓库。
2. Framework Preset 使用 Vite。构建命令 `npm run build`，输出目录 `dist`，安装命令 `npm ci`。
3. Node.js 使用 22.x，由 package.json 声明。
4. 点击 Deploy，不需要配置 API Key 或环境变量。

`vercel.json` 已声明构建设置、WASM 所需 CSP 与长期资源缓存。首次构建会下载并校验固定版本的编译工具链，要求构建镜像具有 Python 3 与 curl。生成的工具链作为同源静态文件发布。

README 中提供标准 Deploy with Vercel 按钮。按钮的仓库克隆流程面向公开模板；仓库为私有时，应使用有权限的 Vercel/GitHub 账户直接 Import。无需为了部署而公开仓库。

## 本地构建

```sh
npm ci
npm run build
npm test
npm run preview
```

生产预览默认在 `http://127.0.0.1:4173/`。工具链准备脚本验证上游 SHA-256，替换教学版 iostream，并生成 gzip 资源。最大单个工具链资源约 13.04 MiB。

## 可选：Cloudflare

仓库中的 `wrangler.jsonc` 是不含个人账户或域名的通用模板。个人配置可复制到 `wrangler.local.jsonc`，此文件已忽略提交，部署脚本会优先读取它。

将部署凭据放入被忽略的 `.env`，参考 `.env.example`，并设置文件权限为 0600。不要使用 `VITE_*` 保存凭据，也不要将它们放到 skills、`public/` 或 `dist/`。

```sh
npm run cf:check
npm run cf:deploy
```

`cf:check` 只做 dry run。实际部署使用 `.env` 中指定的账户和本地 Wrangler 配置。Cloudflare 和 Wrangler 的参考 skills 位于 `.agents/skills/`。

## 个人配置与发布范围

`.env`、`.secrets/`、`.cache/`、`.wrangler/`、`.vercel/` 与 `wrangler.local.jsonc` 均不提交。个人部署记录、维护备份和账户设置保留在本机；GitHub 仓库只包含可复用的项目配置。只将生成的 `dist/` 静态文件交给托管平台。

## 参考

- [Vercel 部署按钮](https://vercel.com/docs/deploy-button)
- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel 项目配置](https://vercel.com/docs/project-configuration/vercel-json)
- [Cloudflare 静态资产配置](https://developers.cloudflare.com/workers/static-assets/binding/)
