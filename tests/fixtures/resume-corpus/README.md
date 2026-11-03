# 简历导入测试样本

本目录包含 10 份 PDF 和 10 份 DOCX 测试夹具，共 10 个脱敏候选人，每个候选人分别生成 PDF 与 DOCX。

这些夹具用于验证受控数据下的字段识别和 DOCX/PDF 双解析路径，不代表任意版式的复杂真实 PDF 已达到同样准确率。

## 来源与脱敏

- 样本结构来自浏览器检索到的公开简历、公开研究简历和高校招聘简历表。
- 原始文件只下载到系统临时目录，不进入仓库。
- 姓名、电话、邮箱、城市、单位、学校、项目和经历均已替换或重新编写。
- PDF / DOCX 由 `scripts/build-resume-corpus.mjs` 从同一份虚构数据生成，避免分发来源文件中的个人信息。
- 未采用无法提取文字的扫描 PDF；OCR 仍按 v1.1 计划保持占位。

## 来源索引

| # | 公开来源 |
|---|---|
| 1 | https://geo.nenu.edu.cn/jianli.pdf |
| 2 | https://www.chem.pku.edu.cn/page/lixg/docs/20181217095825137150.pdf |
| 3 | https://www.sem.tsinghua.edu.cn/__local/A/82/78/A58C13D5802783BBAC21BDD7292_897ECCA1_4085B.pdf |
| 4 | https://pg.sem.tsinghua.edu.cn/zhongwenjianli-guyu-20240104.pdf |
| 5 | https://www.tycc.cn/file/1d150a9d5a554d51b4ebe65af2286764.pdf |
| 6 | https://www.huii.top/zhenghui_CV_20260313.pdf |
| 7 | https://cs.tiangong.edu.cn/_upload/article/files/32/5a/2322c3114231b3bd872aae2fc37c/a9ee49a3-8b75-46c9-847a-4e779445f803.pdf |
| 8 | https://zs.cust.edu.cn/docs/2024-05/2fc2ea78ddc74064b6e5bbd20d886d0d.pdf |
| 9 | https://www.ghd.pku.edu.cn/docs//2021-05/f051cdad6ae54fa890ce005fda755b60.pdf |
| 10 | https://ch.nwsuaf.edu.cn/docs/2024-12/ba5f463b4f5a4730a2d778bf32d184c1.pdf |

DOCX 生成器同时参考了公开高校与政府招聘表格的字段结构。仓库不保存这些原始表格。

## 复现

```bash
pnpm fixtures:resumes
pnpm test
pnpm test:e2e
```

准确率结果见 [accuracy.json](accuracy.json)。
