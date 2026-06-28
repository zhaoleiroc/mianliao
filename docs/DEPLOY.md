# 部署到 GitHub Pages

本仓库已配置 GitHub Actions 自动部署。Push 到 `main` 分支即会构建并发布到 Pages。

## 一次性设置

1. 进入 GitHub 仓库页面 → **Settings** → **Pages**
2. **Source** 选 **GitHub Actions**（不是 "Deploy from a branch"）
3. 第一次 push 后会自动创建 `github-pages` environment；如果用的是组织仓库，可能需要管理员批准
4. 等待 workflow 跑完，访问 `https://zhaoleiroc.github.io/mianliao/` 即可

## 触发方式

| 触发条件 | 行为 |
| --- | --- |
| `git push origin main` | 自动构建并部署 |
| 仓库页面 → Actions → Deploy → **Run workflow** | 手动重跑 |

## 流水线步骤

1. checkout
2. setup-python 3.12 → pip install openpyxl
3. python scripts/extract_fabrics.py
4. python scripts/archive_images.py --apply
5. setup-node 22 → npm ci
6. npm run build（注入 BASE_URL=/mianliao/）
   - tsc -b
   - vite build
   - node scripts/postbuild.mjs（生成 404.html + .nojekyll）
7. actions/upload-pages-artifact（dist/）
8. actions/deploy-pages

## 关键文件

- `.github/workflows/deploy.yml` — 工作流定义
- `vite.config.ts` — `base` 由 `BASE_URL` 环境变量决定；CI 注入 `/mianliao/`，本地默认 `/`
- `scripts/postbuild.mjs` — 在 dist 里复制 `index.html → 404.html` + 写 `.nojekyll`
- `src/data.ts` 的 `imageUrl()` — 使用 `import.meta.env.BASE_URL` 生成正确的图片路径

## 自定义域名

把 `vite.config.ts` 里的 `BASE` 默认值改成 `/`，workflow 里删掉 `BASE_URL: /mianliao/` 这一行。然后在仓库根放一个 `CNAME` 文件（包含你的域名），push 后 Pages 会自动识别。

## 深链支持

React Router 用的是 BrowserRouter，URL 像 `/mianliao/fabrics/abc123` 这样的深链需要服务器端 fallback。GitHub Pages 的 fallback 是 `404.html`，所以 postbuild 步骤把 `index.html` 复制成 `404.html`——深链刷新或直接访问都能正确进入 SPA。

## 本地验证

```bash
# 用 CI 一样的环境变量本地构建
BASE_URL=/mianliao/ npm run build
npx vite preview --port 4173

# 然后访问
# http://localhost:4173/mianliao/
```


## 持续集成

PR 推送到 `main` 或 push 到 `main` 都会触发 `.github/workflows/lint.yml`：

1. `python scripts/validate_data.py` — 检查 `data/*.json` 的完整性
2. `npx tsc -b` — TypeScript 类型检查
3. `npm run build` — 完整构建（验证 Vite 配置未坏）

本地等价命令：

```bash
npm run lint        # = tsc -b && python validate_data.py
npm run lint:ts     # 仅类型检查
npm run lint:data   # 仅数据校验
```

校验器会捕获：

- 缺字段（id / name / category / supplier）
- 非法 category 枚举值
- 重复的 fabric / supplier ID
- `counts` 总和与 `total` 不一致
- 3S-AVVA 款式的报价数 ≠ 7
- 图片 manifest 引用的 fabric_id 在 `fabrics.json` 中找不到
- 图片 manifest 的 `archive_path` 在磁盘上不存在

故意注入 5 类错误 → 校验器全部捕获（exit 1），可放心作 PR 门禁。

## main 分支保护

把 `lint.yml` 的 `validate` job 设成 PR 合入的硬性门槛，避免带病数据或类型错误进 main。

### 方式 A：网页 UI

1. 仓库页面 → **Settings** → **Branches** → **Add branch protection rule**
2. **Branch name pattern** 填 `main`
3. 勾选 **Require status checks to pass before merging**
   - 在搜索框里等出现 `validate`（这是 `.github/workflows/lint.yml` 里的 job 名）
   - 勾上它
   - 勾选 **Require branches to be up to date before merging**
4. 勾选 **Require conversation resolution before merging**（让未解决的 PR 评论挡合并）
5. **Do not allow force pushes** 与 **Do not allow deletions** 默认就是关的，保留即可
6. **Apply rule**

⚠️ 个人项目别勾 **Do not allow bypassing the above settings**（即 enforce_admins），否则你自己也无法 force-push 修历史。

### 方式 B：命令行（gh api）

仓库根已准备好配置：`scripts/setup-branch-protection.json`。需要本地装 [GitHub CLI](https://cli.github.com/) 并 `gh auth login`。

```bash
# 设置 main 分支保护
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /repos/zhaoleiroc/mianliao/branches/main/protection \
  --input scripts/setup-branch-protection.json

# 验证已生效
gh api /repos/zhaoleiroc/mianliao/branches/main/protection | jq '.required_status_checks.contexts'
# → ["validate"]
```

### 第一次 push 后的预期

1. 仓库的 Actions tab 出现两次 workflow run：
   - `Lint`（来自 lint.yml）
   - `Deploy to GitHub Pages`（来自 deploy.yml）
2. PR 还没合并前，仓库 Settings → Branches 里勾选的 `validate` 必须通过
3. 合并后 deploy.yml 自动跑，产物推到 `https://zhaoleiroc.github.io/mianliao/`
