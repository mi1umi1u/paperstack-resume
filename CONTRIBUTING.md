# 纸栈开发约定

## 基线与提交

- 当前执行依据是 `纸栈项目开发计划书-v1.1.md`，实际进度记录在 `项目进度书.md`。
- 每完成一个独立功能或修复提交一次，提交信息使用 Conventional Commits，例如 `feat: add startup choices`、`fix: edit split entries completely`。
- 提交前运行单元测试；涉及界面、分页、导入或导出时同时运行端到端测试。
- 实际 bug 修复必须附回归测试，不只修改现象。

## 代码风格

统一采用 **ESLint + Prettier**，风格与现有源码保持一致：

- TypeScript 与 Vue 3 组合式 API。
- 2 空格缩进、UTF-8、LF 换行、文件末尾保留换行。
- 单引号、不加分号；优先使用现有工具函数和类型，避免重复实现。
- 排版层保持纯 TypeScript，不依赖 Vue，不直接修改简历状态。
- 不为了新功能引入大型 UI 框架或远程运行时资源。

当前阶段只确定规范，不对既有代码做批量格式化，也不在功能提交中混入无关格式变化。后续接入 ESLint flat config、typescript-eslint、eslint-plugin-vue 与 Prettier 自动检查时，配置和格式化应分开提交。

## 测试命令

```bash
pnpm test
pnpm test:e2e
```

没有 pnpm 时：

```bash
npm test
npm run test:e2e
```

## 隐私与测试数据

- 默认功能不得产生网络请求。
- 测试简历必须使用虚构或彻底脱敏的数据。
- 真实简历、API Key、个人 JSON 备份不得提交到仓库。
- AI 自动测试使用模拟响应，不使用真实 Key。
