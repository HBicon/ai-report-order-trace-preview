# AI 报告订单追溯链路

REQ-20261021-001 · Gate 2 产品评审站。

本仓库只发布该需求的可交互原型、Proposal 和评审记录，不包含其他项目。所有订单、设备、买家、规则和金额均为脱敏演示数据；站点为纯静态页面，不连接真实后端。

## 页面

- 首页：`index.html`
- 方案说明：`proposal/`
- 可交互原型：`prototype/`
- 评审记录：`review-record/`

## 当前阶段

- Gate 1 范围确认：已通过
- Gate 2 方案评审：待评审
- Specification、测试用例和归档 PRD：Gate 2 通过后生成

## 本地预览

```bash
python3 -m http.server 4173
```

访问 `http://127.0.0.1:4173/`。也可直接打开首页进行评审；文档页通过浏览器读取同目录 Markdown，建议使用本地静态服务。
