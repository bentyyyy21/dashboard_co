# 各省边界数据看板

这是一个可直接部署到 GitHub Pages 的静态网页看板。页面优先读取 `data/dashboard-data.js`，也保留 `data/dashboard-data.json` 作为结构化数据，支持多省选择、单日或多日日期筛选，并按映射表维护日前/实时的柱线组合图字段。

## 本地更新数据

1. 将省份 Excel 放到对应省份目录，例如 `广东/`、`江苏/`。
2. 在 `映射表字段.xlsx` 中为新增省份增加同名 sheet，并维护：
   - 日前柱状图：`柱子1`、`柱子2`
   - 日前折线图：`折线1`
   - 实时柱状图：`柱子1`、`柱子2`
   - 实时折线图：`折线1`
3. 运行：

```powershell
python scripts/build_data.py
```

4. 提交并推送 `index.html`、`styles.css`、`app.js`、`data/dashboard-data.json`、`data/dashboard-data.js`、`scripts/build_data.py`。源 Excel 会被 `.gitignore` 忽略，不上传到 GitHub。

本地预览可以直接打开 `index.html`。如果使用本地静态服务或 GitHub Pages，也会正常读取同一份生成数据。

## GitHub Pages

仓库推送到 GitHub 后，在 `Settings -> Pages` 中选择从默认分支部署，目录选择仓库根目录即可。部署完成后访问 GitHub Pages 给出的链接。

## 说明

- 页面默认展示数据里的最新单日，点击“全量”或调整日期可看多日。
- 江苏 2026 年 2 月文件缺少 `储能发电计划`、`煤电发电计划`、`加权均价-实时`，生成脚本会保留提醒，并将对应值按 `0` 填充。
