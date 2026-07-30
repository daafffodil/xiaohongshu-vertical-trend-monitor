# 小红书垂直趋势雷达

一个围绕「旧衣、断舍离、极简、女性成长」的公开案例项目。

它不读取整个平台固定热榜，而是持续观察特定主题在 24 小时、本周和本月的内容信号，并把信号转化为可供运营、增长和内容团队使用的选题。

## 这套项目解决什么问题

- 固定热榜太宽，无法回答垂直业务正在发生什么。
- 累计互动量不能代表当下增长速度。
- 交易热、内容热和品牌热混在一起，会扭曲选题判断。
- AI 缺少实时信号时，往往只能生成空泛、常识化的选题。
- 详情页偶发失败时，直接删除候选会造成幸存者偏差。

## 工作流

1. 建立主题树与扩展词。
2. 只读采样公开可见内容。
3. 归类为内容型、交易型、品牌型或求助型。
4. 对比同帖前后互动，计算互动增量。
5. 分别生成 24 小时、本周和本月榜。
6. 把趋势翻译成 20 字以内、无冒号的选题。
7. 每日归档，保留待复核信号和数据缺口。

## 公开安全

- 不包含账号密码、Cookie、登录会话或自动化凭证。
- 小红书链接已移除临时访问参数，仅保留公开笔记路径。
- 只展示公开可见标题和采样时刻的互动信息。
- 本项目与小红书无隶属或官方合作关系。

## 本地查看

```bash
npm run dev
```

## 构建

```bash
npm run build
```

站点为静态页面，可直接部署到 GitHub Pages。

## Markdown 报告页

- 当前报告：`report.html`
- 历史日榜：`archive.html`
- Markdown 源文件：`report.md`、`archive.md`

从监控工作区同步新报告时运行：

```bash
npm run sync:report -- <趋势总报.md> <日榜归档.md>
```

同步脚本会移除小红书临时访问参数，保留公开笔记 ID，并重新生成可分享的静态页面。GitHub Pages 的分享地址为：

- `https://daafffodil.github.io/xiaohongshu-vertical-trend-monitor/report.html`
- `https://daafffodil.github.io/xiaohongshu-vertical-trend-monitor/archive.html`

## 视觉系统

视觉原则参考 London Institute for Mathematical Sciences 对自身网站的公开总结：简洁、清晰、持续演进、模块化与可递归分割网格。本站只借鉴设计原则，不复制其品牌资产或页面。

参考文章：https://lims.ac.uk/perspectives/designing-web-design/
