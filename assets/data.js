(function () {
  const stage = (title, icon, status, time, summary, facts, evidence, note) => ({
    title, icon, status, time, summary, facts, evidence: evidence || [], note: note || ''
  });

  const commonConfig = (priceVersion, priceCurrent, priceChanged) => [
    { name: '标签映射', used: 'MAP-V12.4', current: 'MAP-V12.4', changed: false, note: '' },
    { name: '成色规则', used: 'GRADE-V8.1', current: 'GRADE-V8.2', changed: true, note: '当前版本未参与本单' },
    { name: '价格规则', used: priceVersion, current: priceCurrent, changed: priceChanged, note: priceChanged ? '本单固定使用报价时版本' : '' },
    { name: '模型阈值', used: 'THR-CAM-0.65', current: 'THR-CAM-0.68', changed: true, note: '调阈值建议见 P1 预览' }
  ];

  const scenarios = [
    {
      id: 'normal',
      filter: 'consistent',
      short: '跨档取价正常',
      queueType: '报价偏高/偏低',
      orderNo: 'SC-20261021-0936',
      device: '华为 Mate 60 Pro',
      specs: '12GB + 512GB · 黑色',
      store: 'A17 星河店',
      channel: '包销机器人',
      time: '10:32',
      operator: '运营一组',
      reportGrade: '小花',
      issues: ['前摄像头异常'],
      amount: '¥2,700',
      amountValue: 2700,
      buyer: '合作买家 B-102',
      traceId: 'TRC-7F2A-936Q-8M1C',
      completenessText: '证据完整',
      completenessPct: 100,
      completenessTone: 'success',
      badge: '规则执行一致',
      badgeTone: 'success',
      verdict: {
        tone: 'success',
        icon: 'circleCheck',
        label: '规则执行一致',
        title: '实际报价可由规则链完整解释',
        description: 'AI 报告为“小花 + 前摄像头异常”。专项价格规则 PR-0831 命中，明确按大花价 2,800 取价，再扣减 100，最终实际报价 2,700。取用价档、规则优先级和计价明细均与实际报价勾稽一致，跨档取价属于合法业务。'
      },
      facts: [
        { label: 'AI 报告成色', value: '小花', note: '1 个问题项 · RPT-V4' },
        { label: '唯一实际报价', value: '¥2,700', note: '合作买家 B-102' },
        { label: '实际取用价档', value: '大花价', note: '专项规则明确指定' },
        { label: '下游结果', value: '已成交', note: '复检一致 · 无售后' }
      ],
      stages: {
        order: stage('订单创建', 'fileText', 'ok', '10:31:48', '门店提交回收订单，包销机器人自动触发 AI 识别与买家报价。', [
          ['订单号', 'SC-20261021-0936'], ['进入方式', '自动触发'], ['门店 / 渠道', 'A17 星河店 / 包销机器人'], ['店员选项', '开机正常 · 屏幕显示正常']
        ], [['订单事件', 'EVT-ORDER-01', 'fileText'], ['触发配置', 'TRIGGER-PB-03', 'gitBranch']]),
        input: stage('AI 输入', 'image', 'ok', '10:32:06', '3 张设备图片、9 个店员选项送入图片模型 M-CAM-2.3。', [
          ['模型 code', 'CAM-X2.3'], ['任务 ID', 'RUN-93K2-7A'], ['图片数量', '3 张'], ['输入指纹', 'IN-8E4C...91A']
        ], [['正面图', 'IMG-01 · 2.4 MB', 'image'], ['背面图', 'IMG-02 · 2.1 MB', 'image'], ['屏幕图', 'IMG-03 · 1.8 MB', 'image']], '只记录模型输入事实，不在追溯时重新提交图片或改变原任务。'),
        labels: stage('原始标签', 'scan', 'ok', '10:32:19', '模型返回 9 个候选标签，其中 2 个超过采纳阈值 0.65。', [
          ['采纳阈值', '0.65'], ['通过候选', '2 个'], ['过滤候选', '7 个'], ['关键标签', '前摄像头异常 · 0.92']
        ], [['原始响应', 'RAW-CAM-936 · 已冻结', 'database'], ['候选标签快照', 'LAB-936 · 9 行', 'tag']], '低于阈值的候选也必须保存，P1 才能模拟调低阈值可能救回的标签。'),
        mapping: stage('标签映射', 'gitBranch', 'ok', '10:32:21', '标签“前摄像头异常”映射到外观选项，严重度为中，并生成报告扣减项。', [
          ['映射版本', 'MAP-V12.4'], ['目标选项', '外观 / 前摄像头异常'], ['严重度', '中'], ['冲突处理', '无冲突']
        ], [['映射规则', 'MAP-CAM-044 · 命中', 'gitBranch'], ['成色规则快照', 'GRADE-V8.1', 'fileText']], '映射使用报价时版本，不使用当前配置反推历史结论。'),
        report: stage('AI 报告', 'fileText', 'ok', '10:32:24', '报告 RPT-936-V4 生成：小花，1 个扣减项“前摄像头异常 -100”。', [
          ['报告版本', 'RPT-936-V4'], ['成色', '小花'], ['问题项', '前摄像头异常'], ['扣减金额', '-100']
        ], [['报告快照', 'RPT-936-V4 · 已冻结', 'fileText'], ['源标签引用', 'LAB-936-004', 'tag']], 'AI 报告不可人工修改；追溯只读取系统生成版本。'),
        eligibility: stage('买家匹配', 'users', 'ok', '10:32:25', '4 个买家进入匹配，2 个符合渠道、机型和资格条件。', [
          ['进入匹配', '4 个买家'], ['符合资格', '2 个买家'], ['排除买家', '2 个'], ['资格版本', 'ELIG-V6.2']
        ], [['买家分支', 'BUY-B102 · 可报价', 'users'], ['排除原因', 'BUY-B211 · 渠道不匹配', 'filter']], '买家级分支独立追溯；单个买家未报价不影响其他买家。'),
        quote: stage('报价决策', 'receipt', 'ok', '10:32:26', '专项规则 PR-0831 命中，按大花价 2,800 取价，扣减 100，输出唯一实际报价 2,700。', [
          ['命中规则', 'PR-0831 · 优先级 100'], ['实际取用价档', '大花价 2,800'], ['扣减', '-100'], ['唯一实际报价', '2,700']
        ], [['规则命中快照', 'QUOTE-936 · PR-0831', 'gitBranch'], ['计价明细', 'LINE-936 · 2 行', 'receipt']], '专项规则明确指定跨档取价，不能将“报告小花、取大花价”误判为成色异常。'),
        downstream: stage('成交与售后', 'packageCheck', 'ok', '11:20:37', '买家 B-102 以 2,700 成交；复检结果与报告一致，无售后。', [
          ['中标买家', '合作买家 B-102'], ['成交价', '2,700'], ['复检结果', '一致'], ['售后', '无']
        ], [['成交记录', 'DEAL-936 · 已确认', 'packageCheck'], ['复检摘要', 'RECHECK-936 · 一致', 'shield']], '售后在 P0 只做关联与摘要，不做结构化归因。')
      },
      events: [
        ['10:31:48', '订单创建并触发 AI', '包销机器人任务 TG-936 创建', 'ok'],
        ['10:32:06', '图片与店员选项固化', '3 张图片完成质量校验', 'ok'],
        ['10:32:19', '模型返回原始标签', '前摄像头异常 0.92，超过阈值 0.65', 'ok'],
        ['10:32:21', '标签映射完成', 'MAP-CAM-044 → 前摄像头异常', 'ok'],
        ['10:32:24', 'AI 报告生成', 'RPT-936-V4 · 小花 · -100', 'ok'],
        ['10:32:25', '买家匹配完成', '4 个进入，2 个符合资格', 'ok'],
        ['10:32:26', '专项规则命中并报价', 'PR-0831 · 大花价 2,800 − 100 = 2,700', 'ok'],
        ['11:20:37', '买家成交并复检', '复检一致，链路关闭', 'ok']
      ],
      config: commonConfig('PRICE-V5.7', 'PRICE-V5.7', false),
      quote: {
        amount: '2,700', amountRaw: 2700,
        statusLabel: '规则执行一致', statusTone: 'success',
        attempt: 'QUOTE-936-A02', buyer: '合作买家 B-102',
        rules: [
          { priority: 100, id: 'PR-0831', name: '成色 + 前摄异常专项', condition: '成色 = 小花 且 扣减项包含 前摄像头异常', action: '指定取大花价 2,800，再执行扣减', result: '命中', tone: 'success', hit: true },
          { priority: 30, id: 'PR-0701', name: '通用成色规则', condition: '成色 = 小花', action: '取小花价 2,400', result: '未命中 · 低优先级', tone: 'neutral', hit: false },
          { priority: 10, id: 'PR-0001', name: '买家兜底规则', condition: '无其他规则命中', action: '按买家兜底策略处理', result: '不适用', tone: 'neutral', hit: false }
        ],
        lines: [
          { label: '大花成色价', source: 'PR-0831 指定取价档 · 价格配置 PRICE-V5.7', amount: 2800, kind: 'base' },
          { label: '前摄像头异常', source: '扣减配置 D-021 · 按规则扣减', amount: -100, kind: 'deduction' }
        ],
        total: '2,700', totalNote: '唯一报价结果 · 不展示规则重算价',
        difference: {
          good: true,
          title: '规则链与实际报价勾稽一致',
          description: '专项规则命中、价档一致、扣减只消费一次，计价明细与回写金额一致。系统不生成第二个价格，也不判断该价格在市场上的高低。',
          items: [
            ['规则优先级', '专项规则 100 > 通用规则 30'],
            ['取用价档', '大花价 2,800，符合 PR-0831'],
            ['实际报价', '2,700，与计价明细一致']
          ]
        }
      },
      images: [
        { id: 'front', title: '正面图 · 前摄区域', subtitle: '图片清晰，前摄外观与功能标签均被识别', angle: 'front', marker: '前摄区域', confidence: '0.92', meta: 'IMG-01 · 2.4 MB' },
        { id: 'back', title: '背面图 · 后摄区域', subtitle: '后摄区域未发现有效异常候选', angle: 'back', marker: '后摄区域', confidence: '0.11', meta: 'IMG-02 · 2.1 MB' },
        { id: 'screen', title: '屏幕图 · 显示区域', subtitle: '屏幕存在轻微痕迹候选，低于采纳阈值', angle: 'screen', marker: '屏幕区域', confidence: '0.47', meta: 'IMG-03 · 1.8 MB' }
      ],
      candidates: [
        { label: '前摄像头异常', type: '外观 / 摄像头', confidence: 0.92, threshold: 0.65, accepted: true, reason: '采纳并进入映射' },
        { label: '屏幕轻微划痕', type: '外观 / 屏幕', confidence: 0.47, threshold: 0.65, accepted: false, reason: '低于阈值' },
        { label: '后置摄像头异常', type: '外观 / 摄像头', confidence: 0.11, threshold: 0.65, accepted: false, reason: '低于阈值' }
      ],
      mappings: [
        { source: '前摄像头异常', type: '外观 / 摄像头', option: '外观 → 前摄像头异常', severity: '中', report: '扣减项 · -100', filtered: false },
        { source: '屏幕轻微划痕', type: '外观 / 屏幕', option: '未映射', severity: '—', report: '未进入报告', filtered: true }
      ],
      model: { code: 'CAM-X2.3', version: '2026.10.12', run: 'RUN-93K2-7A', threshold: '0.65 · THR-CAM-7', input: '3 图 / 9 项店员选择', quality: '全部通过基础质量校验' },
      downstream: {
        summary: [
          { label: '中标买家', value: 'B-102', note: '合作买家' },
          { label: '成交价', value: '¥2,700', note: '与报价一致' },
          { label: '复检结果', value: '一致', note: '未发现新增问题' },
          { label: '售后', value: '无', note: '链路已关闭' }
        ],
        events: [
          ['10:40', '4 个买家收到报价', 'B-102 提交 2,700，进入比价', 'ok'],
          ['10:43', 'B-102 中标', '订单进入确认成交', 'ok'],
          ['11:20', '买家复检完成', '复检结果与 AI 报告一致', 'ok'],
          ['11:20', '成交完成', '无售后，追溯链路关闭', 'ok']
        ],
        afterSale: null,
        note: '本单未进入售后链路。系统保留报价与成交快照，供后续抽检和策略分析。'
      }
    },
    {
      id: 'priority',
      filter: 'anomaly',
      short: '专项规则优先级异常',
      queueType: '报价偏高/偏低',
      orderNo: 'SC-20261021-0881',
      device: '华为 Mate 60 Pro',
      specs: '12GB + 512GB · 雅川青',
      store: 'A12 云栖店',
      channel: '包销机器人',
      time: '09:48',
      operator: '运营一组',
      reportGrade: '小花',
      issues: ['前摄像头异常'],
      amount: '¥2,300',
      amountValue: 2300,
      buyer: '合作买家 B-102',
      traceId: 'TRC-7F2A-881N-4C7D',
      completenessText: '证据完整',
      completenessPct: 100,
      completenessTone: 'warning',
      badge: '规则链差异',
      badgeTone: 'danger',
      verdict: {
        tone: 'danger',
        icon: 'alertCircle',
        label: '规则链差异 · 专项规则优先级错误',
        title: '专项规则满足条件，但被通用规则抢先命中',
        description: '报告条件同时满足专项规则 PR-0831 和通用规则 PR-0701。专项规则优先级为 20，低于通用规则的 30，因此实际按通用小花价 2,400 取价并扣减 100，形成报价 2,300。差异发生在规则优先级，不是模型识别或计算错误。'
      },
      facts: [
        { label: 'AI 报告成色', value: '小花', note: '1 个问题项 · RPT-881-V4' },
        { label: '唯一实际报价', value: '¥2,300', note: '合作买家 B-102' },
        { label: '实际取用价档', value: '小花价', note: '通用规则抢先命中' },
        { label: '首个差异', value: '规则优先级', note: '专项规则未被选择' }
      ],
      stages: {
        order: stage('订单创建', 'fileText', 'ok', '09:47:41', '门店提交回收订单，包销机器人自动触发 AI 识别。', [
          ['订单号', 'SC-20261021-0881'], ['进入方式', '自动触发'], ['门店 / 渠道', 'A12 云栖店 / 包销机器人'], ['店员选项', '开机正常 · 屏幕显示正常']
        ], [['订单事件', 'EVT-ORDER-02', 'fileText'], ['触发配置', 'TRIGGER-PB-03', 'gitBranch']]),
        input: stage('AI 输入', 'image', 'ok', '09:47:56', '3 张设备图片、9 个店员选项送入 M-CAM-2.3。', [
          ['模型 code', 'CAM-X2.3'], ['任务 ID', 'RUN-88K1-2C'], ['图片数量', '3 张'], ['输入指纹', 'IN-6B2A...72F']
        ], [['正面图', 'IMG-01 · 2.3 MB', 'image'], ['背面图', 'IMG-02 · 2.0 MB', 'image'], ['屏幕图', 'IMG-03 · 1.7 MB', 'image']], '模型输入证据完整，可排除图片缺失导致的条件不满足。'),
        labels: stage('原始标签', 'scan', 'ok', '09:48:08', '模型返回 8 个候选标签，关键标签“前摄像头异常”置信度 0.91。', [
          ['采纳阈值', '0.65'], ['通过候选', '2 个'], ['关键标签', '前摄像头异常 · 0.91'], ['过滤候选', '6 个']
        ], [['原始响应', 'RAW-CAM-881 · 已冻结', 'database'], ['候选标签快照', 'LAB-881 · 8 行', 'tag']], '标签和报告条件均满足专项规则，异常发生在下游规则选择。'),
        mapping: stage('标签映射', 'gitBranch', 'ok', '09:48:10', '前摄像头异常成功映射到业务选项，并生成报告扣减项。', [
          ['映射版本', 'MAP-V12.4'], ['目标选项', '外观 / 前摄像头异常'], ['严重度', '中'], ['报告扣减项', '-100']
        ], [['映射规则', 'MAP-CAM-044 · 命中', 'gitBranch'], ['成色规则快照', 'GRADE-V8.1', 'fileText']], '映射链完整，不存在标签到选项的断点。'),
        report: stage('AI 报告', 'fileText', 'ok', '09:48:13', '报告 RPT-881-V4 生成：小花，1 个扣减项“前摄像头异常 -100”。', [
          ['报告版本', 'RPT-881-V4'], ['成色', '小花'], ['问题项', '前摄像头异常'], ['报告条件', '满足专项规则']
        ], [['报告快照', 'RPT-881-V4 · 已冻结', 'fileText'], ['源标签引用', 'LAB-881-002', 'tag']], '报告条件本身无异常，可继续核对价格规则优先级。'),
        eligibility: stage('买家匹配', 'users', 'ok', '09:48:14', '3 个买家符合该报告和渠道条件，B-102 进入报价。', [
          ['进入匹配', '3 个买家'], ['符合资格', '1 个买家'], ['目标买家', 'B-102'], ['资格版本', 'ELIG-V6.2']
        ], [['买家分支', 'BUY-B102 · 匹配成功', 'users'], ['排除原因', '其他买家渠道不匹配', 'filter']], '本次差异只在 B-102 的专项规则优先级，不涉及买家资格。'),
        quote: stage('报价决策', 'receipt', 'error', '09:48:15', '专项 PR-0831 满足条件但未命中；通用 PR-0701 因优先级 30 高于专项规则 20 被选择，按小花价 2,400 扣减 100，实际报价 2,300。', [
          ['满足条件规则', 'PR-0831 与 PR-0701'], ['实际命中', 'PR-0701 · 优先级 30'], ['未命中', 'PR-0831 · 优先级 20'], ['唯一实际报价', '2,300']
        ], [['规则命中快照', 'QUOTE-881 · PR-0701', 'gitBranch'], ['价档取用记录', '小花价 2,400', 'receipt']], '这是一处真实规则链差异：专项规则的业务优先级未在配置中生效。'),
        downstream: stage('成交与售后', 'packageCheck', 'ok', '10:26:12', '订单已按 2,300 成交，当前无售后。', [
          ['中标买家', '合作买家 B-102'], ['成交价', '2,300'], ['复检结果', '一致'], ['售后', '无']
        ], [['成交记录', 'DEAL-881 · 已确认', 'packageCheck']], '售后无差异，不代表报价规则配置正确；本单仍需修正优先级并评估影响面。')
      },
      events: [
        ['09:47:41', '订单创建并触发 AI', '包销机器人任务 TG-881 创建', 'ok'],
        ['09:47:56', '图片与店员选项固化', '3 张图片完成质量校验', 'ok'],
        ['09:48:08', '模型返回原始标签', '前摄像头异常 0.91，超过阈值', 'ok'],
        ['09:48:10', '标签映射完成', '报告条件满足专项规则', 'ok'],
        ['09:48:13', 'AI 报告生成', 'RPT-881-V4 · 小花 · -100', 'ok'],
        ['09:48:14', '买家匹配完成', 'B-102 进入报价', 'ok'],
        ['09:48:15', '报价规则选择异常', 'PR-0701 优先级 30 > PR-0831 优先级 20', 'error'],
        ['10:26:12', '订单成交', '成交价 2,300，暂无售后', 'ok']
      ],
      config: commonConfig('PRICE-V5.7', 'PRICE-V5.7', false),
      quote: {
        amount: '2,300', amountRaw: 2300,
        statusLabel: '规则链差异', statusTone: 'danger',
        attempt: 'QUOTE-881-A01', buyer: '合作买家 B-102',
        rules: [
          { priority: 20, id: 'PR-0831', name: '成色 + 前摄异常专项', condition: '成色 = 小花 且 扣减项包含 前摄像头异常', action: '应指定取大花价，但本次未被选择', result: '未命中 · 优先级较低', tone: 'warning', hit: false },
          { priority: 30, id: 'PR-0701', name: '通用成色规则', condition: '成色 = 小花', action: '实际取小花价 2,400，执行扣减', result: '命中 · 与业务预期不符', tone: 'danger', hit: true },
          { priority: 10, id: 'PR-0001', name: '买家兜底规则', condition: '无其他规则命中', action: '按买家兜底策略处理', result: '不适用', tone: 'neutral', hit: false }
        ],
        lines: [
          { label: '小花成色价', source: 'PR-0701 实际取价档 · 价格配置 PRICE-V5.7', amount: 2400, kind: 'base' },
          { label: '前摄像头异常', source: '扣减配置 D-021 · 执行一次', amount: -100, kind: 'deduction' }
        ],
        total: '2,300', totalNote: '唯一报价结果 · 不生成规则重算价',
        difference: {
          good: false,
          title: '首个差异：专项规则优先级低于通用规则',
          description: '专项规则 PR-0831 已满足条件，但优先级 20 低于通用规则 PR-0701 的 30，导致报价使用了通用小花价。页面只展示实际报价 2,300，不另行生成“应有报价”。',
          items: [
            ['首个差异', '专项规则优先级低于通用规则'],
            ['实际取用价档', '小花价 2,400'],
            ['唯一实际报价', '2,300 · 扣减执行正确']
          ]
        }
      },
      images: [
        { id: 'front', title: '正面图 · 前摄区域', subtitle: '前摄区域清晰可见，标签置信度高于阈值', angle: 'front', marker: '前摄区域', confidence: '0.91', meta: 'IMG-01 · 2.3 MB' },
        { id: 'back', title: '背面图 · 后摄区域', subtitle: '后摄区域未形成有效异常候选', angle: 'back', marker: '后摄区域', confidence: '0.08', meta: 'IMG-02 · 2.0 MB' },
        { id: 'screen', title: '屏幕图 · 显示区域', subtitle: '屏幕痕迹候选低于阈值，不进入报告', angle: 'screen', marker: '屏幕区域', confidence: '0.51', meta: 'IMG-03 · 1.7 MB' }
      ],
      candidates: [
        { label: '前摄像头异常', type: '外观 / 摄像头', confidence: 0.91, threshold: 0.65, accepted: true, reason: '采纳并进入映射' },
        { label: '屏幕轻微划痕', type: '外观 / 屏幕', confidence: 0.51, threshold: 0.65, accepted: false, reason: '低于阈值' },
        { label: '后置摄像头异常', type: '外观 / 摄像头', confidence: 0.08, threshold: 0.65, accepted: false, reason: '低于阈值' }
      ],
      mappings: [
        { source: '前摄像头异常', type: '外观 / 摄像头', option: '外观 → 前摄像头异常', severity: '中', report: '扣减项 · -100', filtered: false },
        { source: '屏幕轻微划痕', type: '外观 / 屏幕', option: '未映射', severity: '—', report: '未进入报告', filtered: true }
      ],
      model: { code: 'CAM-X2.3', version: '2026.10.12', run: 'RUN-88K1-2C', threshold: '0.65 · THR-CAM-7', input: '3 图 / 9 项店员选择', quality: '全部通过基础质量校验' },
      downstream: {
        summary: [
          { label: '中标买家', value: 'B-102', note: '合作买家' },
          { label: '成交价', value: '¥2,300', note: '按实际报价成交' },
          { label: '复检结果', value: '一致', note: '无新增问题' },
          { label: '售后', value: '无', note: '链路已关闭' }
        ],
        events: [
          ['09:56', 'B-102 提交报价', '按实际规则链生成 2,300', 'warn'],
          ['10:03', 'B-102 中标', '订单进入确认成交', 'ok'],
          ['10:26', '成交完成', '复检一致，暂无售后', 'ok']
        ],
        afterSale: null,
        note: '当前无售后差异。报价规则差异仍会保留在 P0 问题队列，供修正优先级和评估影响面。'
      }
    },
    {
      id: 'unquoted',
      filter: 'unquoted',
      short: '未报价',
      queueType: '未报价',
      orderNo: 'SC-20261021-0662',
      device: 'iPhone 15 Pro',
      specs: '256GB · 原色钛金属',
      store: 'A06 江湾店',
      channel: '包销机器人',
      time: '09:20',
      operator: '运营二组',
      reportGrade: '大花',
      issues: ['后摄像头异常', '屏幕轻微划痕'],
      amount: '—',
      amountValue: null,
      buyer: '合作买家 B-201',
      traceId: 'TRC-7F2A-662U-9E3B',
      completenessText: '证据完整',
      completenessPct: 96,
      completenessTone: 'warning',
      badge: '未报价已定位',
      badgeTone: 'warning',
      verdict: {
        tone: 'warning',
        icon: 'alertCircle',
        label: '未报价 · 首个阻断点已定位',
        title: '买家扣减项未配置，报价在扣减匹配阶段停止',
        description: 'AI 报告为“大花 + 后摄像头异常 + 屏幕轻微划痕”。目标买家的价格配置缺少“后摄像头异常”扣减项，报价未生成。订单级未报价原因已记录为“买家扣减项未配置”，追溯补充了配置 ID、版本和阻断前的完整证据。'
      },
      facts: [
        { label: 'AI 报告成色', value: '大花', note: '2 个问题项 · RPT-662-V3' },
        { label: '唯一实际报价', value: '—', note: '未生成报价' },
        { label: '首个阻断点', value: '扣减项配置', note: 'D-035 未找到' },
        { label: '订单级原因', value: '已记录', note: '复用现有原因字段' }
      ],
      stages: {
        order: stage('订单创建', 'fileText', 'ok', '09:19:52', '门店提交 iPhone 回收订单，包销机器人自动触发。', [
          ['订单号', 'SC-20261021-0662'], ['进入方式', '自动触发'], ['门店 / 渠道', 'A06 江湾店 / 包销机器人'], ['店员选项', '开机正常 · 屏幕显示正常']
        ], [['订单事件', 'EVT-ORDER-03', 'fileText'], ['触发配置', 'TRIGGER-PB-03', 'gitBranch']]),
        input: stage('AI 输入', 'image', 'ok', '09:20:04', '3 张设备图片、10 个店员选项送入 M-CAM-2.3。', [
          ['模型 code', 'CAM-X2.3'], ['任务 ID', 'RUN-66L4-8B'], ['图片数量', '3 张'], ['输入指纹', 'IN-2C7A...14E']
        ], [['正面图', 'IMG-01 · 2.2 MB', 'image'], ['背面图', 'IMG-02 · 2.5 MB', 'image'], ['屏幕图', 'IMG-03 · 1.9 MB', 'image']], '图片与店员输入完整，不构成未报价原因。'),
        labels: stage('原始标签', 'scan', 'ok', '09:20:18', '模型返回 10 个候选标签，其中 2 个超过阈值并进入映射。', [
          ['采纳阈值', '0.65'], ['通过候选', '2 个'], ['后摄标签', '后摄像头异常 · 0.91'], ['屏幕标签', '屏幕轻微划痕 · 0.72']
        ], [['原始响应', 'RAW-CAM-662 · 已冻结', 'database'], ['候选标签快照', 'LAB-662 · 10 行', 'tag']], '标签识别并非阻断点，关键异常已稳定通过阈值。'),
        mapping: stage('标签映射', 'gitBranch', 'ok', '09:20:20', '两个标签均成功映射到业务选项，并进入 AI 报告。', [
          ['映射版本', 'MAP-V12.4'], ['目标选项', '后摄像头异常 / 屏幕轻微划痕'], ['严重度', '中 / 轻'], ['报告项', '2 个']
        ], [['映射规则', 'MAP-CAM-051 · 命中', 'gitBranch'], ['映射规则', 'MAP-SCR-013 · 命中', 'gitBranch']], '标签到报告的映射正常，断点在买家价格配置阶段。'),
        report: stage('AI 报告', 'fileText', 'ok', '09:20:23', '报告 RPT-662-V3 生成：大花，2 个扣减项，合计 -280。', [
          ['报告版本', 'RPT-662-V3'], ['成色', '大花'], ['问题项', '后摄像头异常 / 屏幕轻微划痕'], ['扣减金额', '-180 / -100']
        ], [['报告快照', 'RPT-662-V3 · 已冻结', 'fileText'], ['源标签引用', 'LAB-662-003 / 007', 'tag']], '报告内容完整，可作为向下游报价定位的事实基线。'),
        eligibility: stage('买家匹配', 'users', 'ok', '09:20:24', '2 个买家符合资格，B-201 是唯一进入报价的目标买家。', [
          ['进入匹配', '3 个买家'], ['符合资格', '2 个买家'], ['目标买家', 'B-201'], ['资格版本', 'ELIG-V6.2']
        ], [['买家分支', 'BUY-B201 · 进入报价', 'users'], ['排除分支', 'BUY-B205 · 机型不匹配', 'filter']], '买家资格正常，需继续检查 B-201 的价格配置。'),
        quote: stage('报价决策', 'receipt', 'error', '09:20:25', '已命中通用取价规则，但执行到扣减项“后摄像头异常”时未找到买家扣减配置 D-035，报价终止，未生成金额。', [
          ['取价规则', 'PR-0701 · 已命中'], ['阻断项', '后摄像头异常'], ['缺失配置', 'D-035'], ['报价结果', '未生成']
        ], [['买家价格配置', 'PRICE-B201-V4.2', 'database'], ['未报价原因', 'NOQUOTE-DEDUCT-MISSING', 'fileWarning']], '订单级未报价原因已有记录，追溯不重复建设录入，只补充阻断位置和证据。'),
        downstream: stage('成交与售后', 'packageCheck', 'muted', '—', '报价未生成，订单未进入成交链路。', [
          ['报价', '未生成'], ['成交', '未发生'], ['复检', '不适用'], ['售后', '不适用']
        ], [], '未报价订单不会进入成交和售后链路；后续跟进动作不在本次追溯范围内。')
      },
      events: [
        ['09:19:52', '订单创建并触发 AI', '包销机器人任务 TG-662 创建', 'ok'],
        ['09:20:04', '图片与店员选项固化', '3 张图片全部可用', 'ok'],
        ['09:20:18', '模型返回原始标签', '后摄异常 0.91 / 屏幕划痕 0.72', 'ok'],
        ['09:20:20', '标签映射完成', '2 个报告项均映射成功', 'ok'],
        ['09:20:23', 'AI 报告生成', 'RPT-662-V3 · 大花 · 合计 -280', 'ok'],
        ['09:20:24', '买家资格匹配完成', 'B-201 进入报价', 'ok'],
        ['09:20:25', '扣减项匹配失败', 'B-201 未配置“后摄像头异常”扣减项', 'error'],
        ['09:20:26', '订单级原因写入', 'NOQUOTE-DEDUCT-MISSING · 已记录', 'warn']
      ],
      config: commonConfig('PRICE-B201-V4.2', 'PRICE-B201-V4.3', true),
      quote: {
        amount: '—', amountRaw: null,
        statusLabel: '未报价已定位', statusTone: 'warning',
        attempt: 'QUOTE-662-A01', buyer: '合作买家 B-201',
        rules: [
          { priority: 30, id: 'PR-0701', name: '通用成色规则', condition: '成色 = 大花', action: '取大花价后进入扣减匹配', result: '取价规则命中', tone: 'success', hit: true },
          { priority: 20, id: 'D-035', name: '后摄像头异常扣减', condition: '扣减项 = 后摄像头异常', action: '查找买家 B-201 的扣减金额', result: '未配置 · 阻断', tone: 'danger', hit: false },
          { priority: 20, id: 'D-041', name: '屏幕轻微划痕扣减', condition: '扣减项 = 屏幕轻微划痕', action: '查找买家 B-201 的扣减金额', result: '已配置 · 未执行', tone: 'neutral', hit: false }
        ],
        lines: [],
        total: null, totalNote: '报价未生成',
        difference: {
          good: false,
          title: '首个阻断点：买家扣减项未配置',
          description: 'AI 报告、标签映射和买家资格均正常。报价在扣减项匹配阶段停止，未生成金额。订单级未报价原因已有记录，追溯只补充证据，不覆盖原因为主值。',
          items: [
            ['首个阻断点', '扣减项 D-035 未找到'],
            ['订单级原因', '买家扣减项未配置'],
            ['影响范围', '买家 B-201 · 本单未报价']
          ]
        }
      },
      images: [
        { id: 'back', title: '背面图 · 后摄区域', subtitle: '后摄异常清晰，置信度 0.91，进入报告', angle: 'back', marker: '后摄区域', confidence: '0.91', meta: 'IMG-02 · 2.5 MB' },
        { id: 'screen', title: '屏幕图 · 划痕区域', subtitle: '屏幕轻微划痕通过阈值并进入报告', angle: 'screen', marker: '屏幕区域', confidence: '0.72', meta: 'IMG-03 · 1.9 MB' },
        { id: 'front', title: '正面图 · 边框区域', subtitle: '边框磕碰候选低于阈值，未进入报告', angle: 'front', marker: '边框区域', confidence: '0.51', meta: 'IMG-01 · 2.2 MB' }
      ],
      candidates: [
        { label: '后摄像头异常', type: '外观 / 摄像头', confidence: 0.91, threshold: 0.65, accepted: true, reason: '采纳并进入映射' },
        { label: '屏幕轻微划痕', type: '外观 / 屏幕', confidence: 0.72, threshold: 0.65, accepted: true, reason: '采纳并进入映射' },
        { label: '边框磕碰', type: '外观 / 边框', confidence: 0.51, threshold: 0.65, accepted: false, reason: '低于阈值' }
      ],
      mappings: [
        { source: '后摄像头异常', type: '外观 / 摄像头', option: '外观 → 后摄像头异常', severity: '中', report: '扣减项 · -180', filtered: false },
        { source: '屏幕轻微划痕', type: '外观 / 屏幕', option: '外观 → 屏幕轻微划痕', severity: '轻', report: '扣减项 · -100', filtered: false },
        { source: '边框磕碰', type: '外观 / 边框', option: '未映射', severity: '—', report: '未进入报告', filtered: true }
      ],
      model: { code: 'CAM-X2.3', version: '2026.10.12', run: 'RUN-66L4-8B', threshold: '0.65 · THR-CAM-7', input: '3 图 / 10 项店员选择', quality: '全部通过基础质量校验' },
      downstream: {
        summary: [
          { label: '报价', value: '未生成', note: '扣减项配置缺失' },
          { label: '成交', value: '未发生', note: '链路在报价终止' },
          { label: '复检', value: '不适用', note: '无成交' },
          { label: '售后', value: '不适用', note: '无成交' }
        ],
        events: [],
        afterSale: null,
        note: '报价未生成，未进入成交与售后链路。订单后续是否补配置、重新报价或关闭，不属于追溯系统自动动作。'
      }
    },
    {
      id: 'aftersales',
      filter: 'aftersales',
      short: '售后差异关联',
      queueType: '售后关联',
      orderNo: 'SC-20261021-0518',
      device: '小米 14 Ultra',
      specs: '16GB + 512GB · 黑色',
      store: 'A21 临港店',
      channel: '包销机器人',
      time: '08:57',
      operator: '运营二组',
      reportGrade: '中花',
      issues: ['屏幕烧屏'],
      amount: '¥3,000',
      amountValue: 3000,
      buyer: '合作买家 B-116',
      traceId: 'TRC-7F2A-518S-2K8E',
      completenessText: '证据完整',
      completenessPct: 92,
      completenessTone: 'warning',
      badge: '售后差异关联',
      badgeTone: 'warning',
      verdict: {
        tone: 'warning',
        icon: 'alertCircle',
        label: '规则执行一致 · 售后差异关联',
        title: '报价链与报告一致，成交后复检发现主板维修',
        description: 'AI 报告为“中花 + 屏幕烧屏”，价格规则按中花价 3,300 扣减 300，实际报价 3,000。买家成交后复检发现主板维修，形成售后差异。P0 只关联成交、复检、售后状态和差异摘要，结构化归因在 P1。'
      },
      facts: [
        { label: 'AI 报告成色', value: '中花', note: '1 个问题项 · RPT-518-V2' },
        { label: '唯一实际报价', value: '¥3,000', note: '合作买家 B-116' },
        { label: '实际取用价档', value: '中花价', note: '通用规则命中' },
        { label: '售后状态', value: '处理中', note: '复检发现主板维修' }
      ],
      stages: {
        order: stage('订单创建', 'fileText', 'ok', '08:56:39', '门店提交小米回收订单，包销机器人触发 AI 识别。', [
          ['订单号', 'SC-20261021-0518'], ['进入方式', '自动触发'], ['门店 / 渠道', 'A21 临港店 / 包销机器人'], ['店员选项', '开机正常 · 屏幕存在明显烧屏']
        ], [['订单事件', 'EVT-ORDER-04', 'fileText'], ['触发配置', 'TRIGGER-PB-03', 'gitBranch']]),
        input: stage('AI 输入', 'image', 'ok', '08:56:52', '3 张设备图片、8 个店员选项送入 M-CAM-2.3。', [
          ['模型 code', 'CAM-X2.3'], ['任务 ID', 'RUN-51J8-6D'], ['图片数量', '3 张'], ['输入指纹', 'IN-1F9B...33D']
        ], [['正面图', 'IMG-01 · 2.6 MB', 'image'], ['背面图', 'IMG-02 · 2.0 MB', 'image'], ['屏幕图', 'IMG-03 · 2.8 MB', 'image']], '屏幕图片清晰，输入不存在影响识别的明显质量问题。'),
        labels: stage('原始标签', 'scan', 'ok', '08:57:07', '模型返回 7 个候选标签，关键标签“屏幕烧屏”置信度 0.88。', [
          ['采纳阈值', '0.65'], ['通过候选', '1 个'], ['关键标签', '屏幕烧屏 · 0.88'], ['过滤候选', '6 个']
        ], [['原始响应', 'RAW-CAM-518 · 已冻结', 'database'], ['候选标签快照', 'LAB-518 · 7 行', 'tag']], '主板维修相关候选未通过阈值；P1 可结合复检真值分析阈值与漏识别关系。'),
        mapping: stage('标签映射', 'gitBranch', 'ok', '08:57:09', '屏幕烧屏成功映射为外观选项，并生成报告扣减项。', [
          ['映射版本', 'MAP-V12.4'], ['目标选项', '屏幕 / 烧屏'], ['严重度', '严重'], ['报告扣减项', '-300']
        ], [['映射规则', 'MAP-SCR-027 · 命中', 'gitBranch'], ['成色规则快照', 'GRADE-V8.1', 'fileText']], '标签到报告的映射正常；售后新增信息不应反向改写原报告。'),
        report: stage('AI 报告', 'fileText', 'ok', '08:57:12', '报告 RPT-518-V2 生成：中花，1 个扣减项“屏幕烧屏 -300”。', [
          ['报告版本', 'RPT-518-V2'], ['成色', '中花'], ['问题项', '屏幕烧屏'], ['扣减金额', '-300']
        ], [['报告快照', 'RPT-518-V2 · 已冻结', 'fileText'], ['源标签引用', 'LAB-518-002', 'tag']], 'AI 报告是成交前的决策快照，不因售后复检结果回写修改。'),
        eligibility: stage('买家匹配', 'users', 'ok', '08:57:13', '4 个买家符合渠道与机型条件，B-116 进入报价。', [
          ['进入匹配', '5 个买家'], ['符合资格', '4 个买家'], ['目标买家', 'B-116'], ['资格版本', 'ELIG-V6.2']
        ], [['买家分支', 'BUY-B116 · 匹配成功', 'users'], ['排除原因', '1 个买家价格配置停用', 'filter']], '买家资格正常，售后差异不来自买家匹配。'),
        quote: stage('报价决策', 'receipt', 'ok', '08:57:14', '通用规则 PR-0701 命中，取中花价 3,300，扣减 300，唯一实际报价 3,000。', [
          ['命中规则', 'PR-0701 · 优先级 30'], ['实际取用价档', '中花价 3,300'], ['扣减', '-300'], ['唯一实际报价', '3,000']
        ], [['规则命中快照', 'QUOTE-518 · PR-0701', 'gitBranch'], ['计价明细', 'LINE-518 · 2 行', 'receipt']], '成交前报价链可完整解释；后续售后差异不在 P0 报价异常范围内。'),
        downstream: stage('成交与售后', 'packageCheck', 'warn', '09:42:31', 'B-116 以 3,000 成交；复检发现主板维修，售后案件创建并处理中。', [
          ['中标买家', '合作买家 B-116'], ['成交价', '3,000'], ['复检差异', '主板维修'], ['售后状态', '处理中 · AS-518']
        ], [['成交记录', 'DEAL-518 · 已确认', 'packageCheck'], ['售后案件', 'AS-518 · 处理中', 'alert']], 'P0 展示售后状态和差异摘要，不自动判定责任，也不重新计算或重跑报价。')
      },
      events: [
        ['08:56:39', '订单创建并触发 AI', '包销机器人任务 TG-518 创建', 'ok'],
        ['08:56:52', '图片与店员选项固化', '3 张图片完成质量校验', 'ok'],
        ['08:57:07', '模型返回原始标签', '屏幕烧屏 0.88', 'ok'],
        ['08:57:09', '标签映射完成', 'MAP-SCR-027 → 屏幕烧屏', 'ok'],
        ['08:57:12', 'AI 报告生成', 'RPT-518-V2 · 中花 · -300', 'ok'],
        ['08:57:14', '报价生成', '中花价 3,300 − 300 = 3,000', 'ok'],
        ['09:28:46', '买家成交', 'B-116 以 3,000 成交', 'ok'],
        ['09:42:31', '复检发现差异', '主板维修，创建售后 AS-518', 'warn']
      ],
      config: commonConfig('PRICE-V5.7', 'PRICE-V5.7', false),
      quote: {
        amount: '3,000', amountRaw: 3000,
        statusLabel: '规则执行一致', statusTone: 'success',
        attempt: 'QUOTE-518-A01', buyer: '合作买家 B-116',
        rules: [
          { priority: 30, id: 'PR-0701', name: '通用成色规则', condition: '成色 = 中花', action: '取中花价 3,300 并执行扣减', result: '命中', tone: 'success', hit: true },
          { priority: 20, id: 'PR-0755', name: '屏幕烧屏专项', condition: '成色 = 中花 且 问题项 = 屏幕烧屏', action: '未达到专项优先级', result: '未命中 · 低优先级', tone: 'neutral', hit: false },
          { priority: 10, id: 'PR-0001', name: '买家兜底规则', condition: '无其他规则命中', action: '按买家兜底策略处理', result: '不适用', tone: 'neutral', hit: false }
        ],
        lines: [
          { label: '中花成色价', source: 'PR-0701 指定取价档 · 价格配置 PRICE-V5.7', amount: 3300, kind: 'base' },
          { label: '屏幕烧屏', source: '扣减配置 D-052 · 按规则扣减', amount: -300, kind: 'deduction' }
        ],
        total: '3,000', totalNote: '唯一报价结果 · 成交前未发生报告变更',
        difference: {
          good: true,
          title: '报价规则链与实际报价勾稽一致',
          description: '成交前的报告、规则、价档和计价明细均可完整解释实际报价 3,000。复检新增主板维修属于成交后差异，不能反向改写原报价链。',
          items: [
            ['成交前规则', 'PR-0701 正常命中'],
            ['取用价档', '中花价 3,300'],
            ['成交后差异', '主板维修 · 售后处理中']
          ]
        }
      },
      images: [
        { id: 'screen', title: '屏幕图 · 烧屏区域', subtitle: '屏幕烧屏清晰可见，置信度 0.88', angle: 'screen', marker: '烧屏区域', confidence: '0.88', meta: 'IMG-03 · 2.8 MB' },
        { id: 'front', title: '正面图 · 设备外观', subtitle: '正面外观正常，未发现其他有效候选', angle: 'front', marker: '设备正面', confidence: '0.17', meta: 'IMG-01 · 2.6 MB' },
        { id: 'back', title: '背面图 · 主板区域不可见', subtitle: '图片只能观察外观，无法直接判断主板维修', angle: 'back', marker: '后壳区域', confidence: '0.06', meta: 'IMG-02 · 2.0 MB' }
      ],
      candidates: [
        { label: '屏幕烧屏', type: '屏幕 / 显示', confidence: 0.88, threshold: 0.65, accepted: true, reason: '采纳并进入映射' },
        { label: '屏幕坏点', type: '屏幕 / 显示', confidence: 0.63, threshold: 0.65, accepted: false, reason: '低于阈值' },
        { label: '主板维修', type: '功能 / 主板', confidence: 0.42, threshold: 0.65, accepted: false, reason: '低于阈值' }
      ],
      mappings: [
        { source: '屏幕烧屏', type: '屏幕 / 显示', option: '屏幕 → 烧屏', severity: '严重', report: '扣减项 · -300', filtered: false },
        { source: '主板维修', type: '功能 / 主板', option: '未映射', severity: '—', report: '未进入报告', filtered: true }
      ],
      model: { code: 'CAM-X2.3', version: '2026.10.12', run: 'RUN-51J8-6D', threshold: '0.65 · THR-CAM-7', input: '3 图 / 8 项店员选择', quality: '全部通过基础质量校验' },
      downstream: {
        summary: [
          { label: '中标买家', value: 'B-116', note: '合作买家' },
          { label: '成交价', value: '¥3,000', note: '与报价一致' },
          { label: '复检差异', value: '主板维修', note: '成交后新发现' },
          { label: '售后状态', value: '处理中', note: 'AS-518' }
        ],
        events: [
          ['09:02', 'B-116 提交报价', '按 3,000 报价', 'ok'],
          ['09:07', 'B-116 中标', '订单进入确认成交', 'ok'],
          ['09:28', '成交完成', '成交价 3,000', 'ok'],
          ['09:42', '复检发现主板维修', '与成交前报告不一致，创建售后 AS-518', 'warn'],
          ['09:50', '售后退回待处理', '当前处理中，金额与责任待确认', 'warn']
        ],
        afterSale: {
          id: 'AS-518', status: '处理中', buyer: '合作买家 B-116',
          issue: '复检发现主板维修，成交前 AI 报告未包含该问题',
          impact: '售后金额待确认 · 当前未回写订单结算',
          owner: '售后处理组'
        },
        note: 'P0 只展示售后关联、状态和差异摘要。结构化归因、责任判定和配置优化建议属于 P1。'
      }
    },
    {
      id: 'incomplete',
      filter: 'incomplete',
      short: '证据不完整',
      queueType: '报价偏高/偏低',
      orderNo: 'SC-20261021-0449',
      device: 'OPPO Find X7 Ultra',
      specs: '16GB + 512GB · 黑色',
      store: 'A03 西岸店',
      channel: '包销机器人',
      time: '08:31',
      operator: '运营二组',
      reportGrade: '小花',
      issues: ['屏幕轻微划痕'],
      amount: '¥1,900',
      amountValue: 1900,
      buyer: '合作买家 B-207',
      traceId: 'TRC-7F2A-449I-1P5A',
      completenessText: '证据不完整',
      completenessPct: 62,
      completenessTone: 'warning',
      badge: '证据不完整',
      badgeTone: 'neutral',
      verdict: {
        tone: 'neutral',
        icon: 'fileWarning',
        label: '证据不完整 · 待确认线索',
        title: '存在实际报价，但缺少当次模型响应与原始标签快照',
        description: '订单已记录唯一实际报价 1,900，但未找到当次模型任务的原始响应和候选标签快照，无法还原报告条件与标签之间的完整关系。页面保留已有事实和缺口，不生成规则执行结论，也不做无证据推断。'
      },
      facts: [
        { label: 'AI 报告成色', value: '小花', note: '报告存在 · 来源待核' },
        { label: '唯一实际报价', value: '¥1,900', note: '报价凭证存在' },
        { label: '取用价档', value: '小花价', note: '报价明细可读' },
        { label: '证据完整度', value: '62%', note: '缺失模型响应' }
      ],
      stages: {
        order: stage('订单创建', 'fileText', 'ok', '08:30:53', '门店提交 OPPO 回收订单，包销机器人触发 AI 识别。', [
          ['订单号', 'SC-20261021-0449'], ['进入方式', '自动触发'], ['门店 / 渠道', 'A03 西岸店 / 包销机器人'], ['店员选项', '开机正常 · 屏幕显示正常']
        ], [['订单事件', 'EVT-ORDER-05', 'fileText'], ['触发配置', 'TRIGGER-PB-03', 'gitBranch']]),
        input: stage('AI 输入', 'image', 'ok', '08:31:04', '图片资产存在，模型任务记录仅保留任务 ID，缺少请求参数摘要。', [
          ['模型 code', 'CAM-X2.3'], ['任务 ID', 'RUN-44R7-9F'], ['图片数量', '2 张'], ['请求参数', '缺失']
        ], [['正面图', 'IMG-01 · 2.0 MB', 'image'], ['屏幕图', 'IMG-03 · 1.7 MB', 'image']], '图片文件仍在，但输入参数摘要缺失，无法确认当次实际送入模型的完整选项。'),
        labels: stage('原始标签', 'scan', 'warn', '—', '未找到原始模型响应与候选标签快照，无法还原标签类型、置信度和过滤原因。', [
          ['原始响应', '缺失'], ['候选标签', '缺失'], ['采纳阈值', 'THR-CAM-0.65 · 配置可读'], ['模型任务', 'RUN-44R7-9F']
        ], [['通过标签快照', '未找到', 'fileWarning'], ['过滤候选快照', '未找到', 'fileWarning']], '这是本单首个证据缺口。P0 只标记证据不完整，不补造标签或根据最终报告反推。'),
        mapping: stage('标签映射', 'gitBranch', 'warn', '—', '报告项存在，但缺少源标签引用，无法还原映射规则和冲突处理过程。', [
          ['映射版本', 'MAP-V12.4 · 当前可读'], ['源标签引用', '缺失'], ['报告项', '屏幕轻微划痕'], ['映射决策路径', '缺失']
        ], [['映射规则快照', '未找到', 'fileWarning']], '不能使用当前映射配置反推当次决策，否则会形成事后重构。'),
        report: stage('AI 报告', 'fileText', 'warn', '08:31:17', '报告 RPT-449-V2 存在：小花，1 个扣减项“屏幕轻微划痕 -100”。源标签关系缺失。', [
          ['报告版本', 'RPT-449-V2'], ['成色', '小花'], ['问题项', '屏幕轻微划痕'], ['来源引用', '缺失']
        ], [['报告快照', 'RPT-449-V2 · 已冻结', 'fileText'], ['源标签引用', '未找到', 'fileWarning']], '报告本身可作为事实，但不能单独证明标签映射正确。'),
        eligibility: stage('买家匹配', 'users', 'ok', '08:31:18', '买家 B-207 符合资格并进入报价。', [
          ['进入匹配', '2 个买家'], ['符合资格', '1 个买家'], ['目标买家', 'B-207'], ['资格版本', 'ELIG-V6.2']
        ], [['买家分支', 'BUY-B207 · 进入报价', 'users']], '资格链路有记录，可排除买家未进入报价。'),
        quote: stage('报价决策', 'receipt', 'warn', '08:31:19', '报价凭证与计价明细存在，实际报价 1,900；因上游标签快照缺失，无法确认报告条件是否完整。', [
          ['命中规则', 'PR-0701 · 优先级 30'], ['实际取用价档', '小花价 2,000'], ['扣减', '-100'], ['唯一实际报价', '1,900']
        ], [['规则命中快照', 'QUOTE-449 · PR-0701', 'gitBranch'], ['计价明细', 'LINE-449 · 2 行', 'receipt']], '只能确认报价规则链与现有明细勾稽，不能确认报告条件来自完整标签。'),
        downstream: stage('成交与售后', 'packageCheck', 'muted', '—', '未找到成交与售后事件；无法判断订单当前所处生命周期。', [
          ['成交', '未找到事件'], ['复检', '未找到事件'], ['售后', '未找到事件'], ['链路状态', '证据不完整']
        ], [], '缺失数据不展示为空值结论；页面保留“未找到事件”，避免误导运营。')
      },
      events: [
        ['08:30:53', '订单创建并触发 AI', '包销机器人任务 TG-449 创建', 'ok'],
        ['08:31:04', '图片资产固化', '2 张图片文件存在', 'ok'],
        ['—', '原始标签快照缺失', '未找到 RAW-CAM-449 与标签候选记录', 'error'],
        ['—', '映射决策路径缺失', '无法连接源标签与报告项', 'error'],
        ['08:31:17', 'AI 报告生成', 'RPT-449-V2 · 小花 · -100', 'warn'],
        ['08:31:18', '买家资格匹配完成', 'B-207 进入报价', 'ok'],
        ['08:31:19', '实际报价生成', 'QUOTE-449 · 1,900', 'ok'],
        ['—', '成交与售后', '未找到后续业务事件', 'muted']
      ],
      config: commonConfig('PRICE-B207-V3.8', 'PRICE-B207-V3.8', false),
      quote: {
        amount: '1,900', amountRaw: 1900,
        statusLabel: '证据不完整', statusTone: 'neutral',
        attempt: 'QUOTE-449-A01', buyer: '合作买家 B-207',
        rules: [
          { priority: 30, id: 'PR-0701', name: '通用成色规则', condition: '成色 = 小花', action: '取小花价 2,000 并执行扣减', result: '命中 · 条件来源待核', tone: 'warning', hit: true },
          { priority: 20, id: 'MAP-?', name: '报告项来源映射', condition: '屏幕轻微划痕', action: '应关联源标签和映射规则', result: '快照缺失', tone: 'danger', hit: false },
          { priority: 10, id: 'PR-0001', name: '买家兜底规则', condition: '无其他规则命中', action: '按买家兜底策略处理', result: '不适用', tone: 'neutral', hit: false }
        ],
        lines: [
          { label: '小花成色价', source: 'PR-0701 实际取价档 · 报价明细可读', amount: 2000, kind: 'base' },
          { label: '屏幕轻微划痕', source: '扣减配置 D-041 · 实际执行', amount: -100, kind: 'deduction' }
        ],
        total: '1,900', totalNote: '唯一报价结果 · 上游证据待补',
        difference: {
          good: false,
          title: '证据缺口：无法确认报告条件是否完整',
          description: '报价规则链与现有计价明细勾稽一致，但缺少原始标签和映射快照，无法确认“小花 + 屏幕轻微划痕”是否由完整 AI 输出推导。系统不做确定性结论。',
          items: [
            ['已有事实', '报告、规则、计价和实际报价'],
            ['缺失证据', '模型响应、候选标签、映射路径'],
            ['当前结论', '待确认线索，需补证']
          ]
        }
      },
      images: [
        { id: 'screen', title: '屏幕图 · 划痕区域', subtitle: '图片文件存在，但标签关联快照缺失', angle: 'screen', marker: '屏幕区域', confidence: '待核', meta: 'IMG-03 · 1.7 MB' },
        { id: 'front', title: '正面图 · 设备外观', subtitle: '图片文件存在，无法确认当次过滤结果', angle: 'front', marker: '设备正面', confidence: '待核', meta: 'IMG-01 · 2.0 MB' }
      ],
      candidates: [],
      mappings: [],
      model: { code: 'CAM-X2.3', version: '未知', run: 'RUN-44R7-9F', threshold: '0.65 · THR-CAM-7', input: '2 图 / 请求参数缺失', quality: '图片可用 · 任务摘要缺失' },
      downstream: {
        summary: [
          { label: '成交', value: '未找到', note: '不能判断未成交' },
          { label: '复检', value: '未找到', note: '事件缺口' },
          { label: '售后', value: '未找到', note: '事件缺口' },
          { label: '链路状态', value: '待补证', note: '证据完整度 62%' }
        ],
        events: [],
        afterSale: null,
        note: 'P0 在关键快照缺失时降级为“待确认线索”，不生成规则异常或售后责任结论。'
      }
    }
  ];

  const dualReport = {
    id: 'dual',
    filter: 'dual',
    short: '一单双报告',
    queueType: '双报告分支',
    orderNo: 'SC-20261022-1042',
    device: 'iPhone 16 Pro',
    specs: '256GB · 沙漠色',
    store: 'A09 虹桥店',
    channel: '包销机器人',
    time: '10:26',
    operator: '运营一组',
    traceId: 'TRC-9B4A-042D-2R7K',
    reportCount: 2,
    reportGrade: '2 份',
    issues: [],
    amount: '¥4,120 / ¥3,780',
    amountValue: 4120,
    amountLines: [
      { label: 'A', value: '¥4,120' },
      { label: 'B', value: '¥3,780' }
    ],
    buyer: 'B-301 / B-305',
    completenessText: '分支证据完整',
    completenessPct: 96,
    completenessTone: 'warning',
    badge: '分支 B 规则链差异',
    badgeTone: 'warning',
    branchRelation: {
      status: 'parallel-demo',
      label: '并行派生 · 演示假设',
      reason: '订单同时命中 2 个运营策略，分别生成报告 A / B',
      strategies: ['S-COLOR-03 · v3.2', 'S-SCREEN-02 · v2.7'],
      sharedEvidence: true,
      note: '当前演示假设两份报告共用模型任务 RUN-1042-7K；若实际为分支重跑，应改为各自记录 run_id，不能沿用同一份标签快照。'
    },
    model: {
      code: 'CAM-X3.1', version: '2026.10.18', run: 'RUN-1042-7K',
      threshold: '0.65 · THR-CAM-8', input: '4 图 / 11 项店员选择',
      quality: '全部通过基础质量校验'
    },
    images: [
      { id: 'dual-front', title: '正面图 · 屏幕区域', subtitle: '屏幕轻微划痕候选清晰，置信度 0.88', angle: 'screen', marker: '屏幕区域', confidence: '0.88', meta: 'IMG-01 · 2.7 MB' },
      { id: 'dual-back', title: '背面图 · 后摄区域', subtitle: '后摄进灰候选置信度 0.93，当前演示假设为两份报告共用输入', angle: 'back', marker: '后摄区域', confidence: '0.93', meta: 'IMG-02 · 2.4 MB' },
      { id: 'dual-frame', title: '侧面图 · 边框区域', subtitle: '边框磕碰候选置信度 0.81，仅报告 A 选择该标签', angle: 'frame', marker: '边框区域', confidence: '0.81', meta: 'IMG-03 · 2.1 MB' },
      { id: 'dual-screen', title: '屏幕图 · 显示区域', subtitle: '主板维修候选低于阈值，不作为确定性报告项', angle: 'screen', marker: '显示区域', confidence: '0.44', meta: 'IMG-04 · 2.5 MB' }
    ],
    candidates: [
      { label: '后摄像头进灰', type: '外观 / 摄像头', confidence: 0.93, threshold: 0.65, accepted: true, reason: '通过阈值，可进入策略选择' },
      { label: '屏幕轻微划痕', type: '外观 / 屏幕', confidence: 0.88, threshold: 0.65, accepted: true, reason: '通过阈值，可进入策略选择' },
      { label: '边框磕碰', type: '外观 / 边框', confidence: 0.81, threshold: 0.65, accepted: true, reason: '通过阈值，可进入策略选择' },
      { label: '主板维修', type: '功能 / 主板', confidence: 0.44, threshold: 0.65, accepted: false, reason: '低于阈值，未进入策略选择' }
    ],
    sharedStages: {
      order: stage('订单创建', 'fileText', 'ok', '10:25:58', '门店提交回收订单，包销机器人创建一次 AI 识别任务；订单同一，后续按命中的运营策略派生多个报告分支。', [
        ['订单号', 'SC-20261022-1042'], ['进入方式', '自动触发'], ['门店 / 渠道', 'A09 虹桥店 / 包销机器人'], ['分支关系', '并行派生 · 待确认']
      ], [['订单事件', 'EVT-ORDER-D42', 'fileText'], ['触发配置', 'TRIGGER-PB-03', 'gitBranch']], '订单只有一条主链路；报告分支数量由命中的运营策略决定。并行还是覆盖，当前按待确认处理。'),
      input: stage('AI 输入（订单级）', 'image', 'ok', '10:26:05', '4 张设备图片、11 个店员选项送入图片模型 CAM-X3.1；当前演示假设两张报告共用一个模型任务。', [
        ['模型 code', 'CAM-X3.1'], ['任务 ID（假设）', 'RUN-1042-7K'], ['图片数量', '4 张'], ['输入指纹', 'IN-42D9...7K']
      ], [['输入快照', 'INPUT-1042 · 已冻结', 'database'], ['设备图片', 'IMG-01 至 IMG-04', 'image']], '当前演示假设共用输入；若实际分支重跑，应分别记录 input_hash 和 run_id，不能把分支差异误判为策略选择差异。'),
      labels: stage('AI 原始标签（订单级）', 'scan', 'ok', '10:26:18', '同一模型任务返回 4 个候选标签，其中 3 个通过阈值；两份报告从这里开始选择不同标签。', [
        ['采纳阈值', '0.65'], ['通过候选', '3 个'], ['未通过', '1 个'], ['关键标签', '后摄进灰 0.93 · 屏幕划痕 0.88']
      ], [['原始响应', 'RAW-CAM-1042 · 已冻结', 'database'], ['候选标签快照', 'LAB-1042 · 4 行', 'tag']], '当前演示假设候选标签为订单级共用；后续才能判断分支差异来自策略选择还是模型输出。共享关系待研发确认。')
    },
    branches: [
      {
        id: 'A',
        label: '报告 A',
        instanceId: 'RI-1042-A',
        strategy: { id: 'S-COLOR-03', name: '成色优先策略', version: 'v3.2', selected: '后摄进灰 + 边框磕碰' },
        reportGrade: '大花',
        issues: ['后摄像头进灰', '边框磕碰'],
        amountValue: 4120,
        amount: '¥4,120',
        buyer: '合作买家 B-301',
        completenessText: '证据完整',
        completenessPct: 96,
        completenessTone: 'warning',
        badge: '分支 A 规则执行一致',
        badgeTone: 'success',
        selectedLabels: ['后摄像头进灰', '边框磕碰'],
        verdict: {
          tone: 'success',
          icon: 'circleCheck',
          label: '分支 A · 规则执行一致',
          title: '报告 A 的报价可由本分支规则链完整解释',
          description: '运营策略 S-COLOR-03 选取“后摄进灰 + 边框磕碰”，报告 A 为大花。买家 B-301 按大花价 4,300 扣减 120 和 60，实际报价 4,120。该金额只属于报告分支 A，不能与报告 B 合并、平均或跨报告比较。'
        },
        facts: [
          { label: '当前报告', value: '报告 A', note: 'RI-1042-A · 大花' },
          { label: '分支实际报价', value: '¥4,120', note: 'B-301 · 唯一报价对象' },
          { label: '策略选用标签', value: '2 个', note: '后摄进灰 · 边框磕碰' },
          { label: '分支结果', value: '已报价', note: '成交分支待确认' }
        ],
        stages: {
          mapping: stage('分支策略与标签映射', 'gitBranch', 'ok', '10:26:20', '运营策略 S-COLOR-03 从共享候选标签中选择 2 个，并映射为大花报告项。', [
            ['运营策略', 'S-COLOR-03 · v3.2'], ['选用标签', '后摄进灰 · 边框磕碰'], ['映射版本', 'MAP-V12.4'], ['未选标签', '屏幕轻微划痕']
          ], [['策略配置', 'STR-SCOLOR-03-V3.2 · 已冻结', 'gitBranch'], ['映射决策', 'MAP-1042-A · 2 行', 'fileText']], '分支差异首先记录“选哪些 AI 标签”，不能只比较最终成色。'),
          report: stage('AI 报告 A', 'fileText', 'ok', '10:26:22', '报告实例 RI-1042-A 生成：大花，2 个扣减项，分别引用订单级原始标签。', [
            ['报告实例', 'RI-1042-A'], ['报告成色', '大花'], ['问题项', '后摄进灰 · 边框磕碰'], ['扣减合计', '-180']
          ], [['报告快照', 'RPT-1042-A · 已冻结', 'fileText'], ['标签引用', 'LAB-1042-001 / 004', 'tag']], '每份报告在分支内唯一；订单级可以同时存在多个报告实例。'),
          eligibility: stage('分支 A 买家匹配', 'users', 'ok', '10:26:23', '按报告 A、渠道和买家资格匹配，B-301 进入报价。', [
            ['进入匹配', '3 个买家'], ['符合报告条件', '1 个买家'], ['目标买家', 'B-301'], ['资格版本', 'ELIG-V6.3']
          ], [['买家分支', 'BUY-B301 · 匹配成功', 'users'], ['排除原因', '其他买家成色范围不匹配', 'filter']], '买家匹配绑定报告实例 A，不继承报告 B 的匹配结果。'),
          quote: stage('分支 A 报价决策', 'receipt', 'ok', '10:26:24', '大花价 4,300，扣减后摄进灰 120、边框磕碰 60，分支 A 实际报价 4,120。', [
            ['命中规则', 'PR-0701 · 优先级 30'], ['取用价档', '大花价 4,300'], ['扣减合计', '-180'], ['分支实际报价', '4,120']
          ], [['规则命中快照', 'QUOTE-1042-A · PR-0701', 'gitBranch'], ['计价明细', 'LINE-1042-A · 3 行', 'receipt']], '报告 A 与买家 B-301 形成独立报价尝试；该价格不外推为整单唯一价格。'),
          downstream: stage('分支 A 成交与售后', 'packageCheck', 'warn', '—', '分支 A 已有有效报价；订单存在两份报告，最终成交采用哪个分支尚未由业务规则确认。', [
            ['分支结果', '已报价 · B-301'], ['成交', '未确认'], ['售后', '未关联'], ['待确认', '成交分支选择规则']
          ], [['报价记录', 'QUOTE-1042-A · 已生成', 'receipt']], '在成交分支规则未确认前，追溯不能把分支 A 的价格写成整单成交价。')
        },
        events: [
          ['10:26:18', '订单级原始标签完成', 'LAB-1042 · 3 个候选通过阈值', 'ok'],
          ['10:26:20', '策略 A 选择标签', '后摄进灰 + 边框磕碰', 'ok'],
          ['10:26:22', '生成报告 A', 'RI-1042-A · 大花', 'ok'],
          ['10:26:23', '匹配买家 B-301', '报告 A 条件与买家资格匹配', 'ok'],
          ['10:26:24', '生成分支报价 A', '大花价 4,300 − 180 = 4,120', 'ok']
        ],
        config: [
          { name: '运营策略', used: 'S-COLOR-03 · v3.2', current: 'S-COLOR-03 · v3.3', changed: true, note: '当前版本未参与本单' },
          { name: '标签映射', used: 'MAP-V12.4', current: 'MAP-V12.4', changed: false, note: '' },
          { name: '价格规则', used: 'PRICE-B301-V4.1', current: 'PRICE-B301-V4.1', changed: false, note: '' },
          { name: '模型阈值', used: 'THR-CAM-0.65', current: 'THR-CAM-0.68', changed: true, note: '共享阈值快照' }
        ],
        mappings: [
          { source: '后摄像头进灰', type: '外观 / 摄像头', option: '外观 → 后摄进灰', severity: '中', report: '扣减项 · -120', filtered: false },
          { source: '边框磕碰', type: '外观 / 边框', option: '边框 → 磕碰', severity: '轻', report: '扣减项 · -60', filtered: false },
          { source: '屏幕轻微划痕', type: '外观 / 屏幕', option: '未被本策略选取', severity: '—', report: '未进入报告 A', filtered: true }
        ],
        quote: {
          amount: '4,120', amountRaw: 4120,
          statusLabel: '规则执行一致', statusTone: 'success',
          attempt: 'QUOTE-1042-A01', buyer: '合作买家 B-301',
          rules: [
            { priority: 30, id: 'PR-0701', name: '大花通用成色规则', condition: '成色 = 大花', action: '取大花价 4,300 并执行扣减', result: '命中', tone: 'success', hit: true },
            { priority: 10, id: 'PR-0001', name: '买家兜底规则', condition: '无其他规则命中', action: '按买家兜底策略处理', result: '不适用', tone: 'neutral', hit: false }
          ],
          lines: [
            { label: '大花成色价', source: 'PR-0701 实际取价档 · 价格配置 PRICE-B301-V4.1', amount: 4300, kind: 'base' },
            { label: '后摄像头进灰', source: '扣减配置 D-036 · 分支 A 执行一次', amount: -120, kind: 'deduction' },
            { label: '边框磕碰', source: '扣减配置 D-018 · 分支 A 执行一次', amount: -60, kind: 'deduction' }
          ],
          total: '4,120', totalNote: '报告 A · 买家 B-301 的实际报价',
          difference: {
            good: true,
            title: '分支 A 的报告、规则与报价完整勾稽',
            description: '该分支选用的标签、报告成色、价格规则和计价明细一致。系统只确认分支 A 执行正确，不据此评价分支 B 或整单价格。',
            items: [
              ['分支标识', 'RI-1042-A'],
              ['实际取用价档', '大花价 4,300'],
              ['分支实际报价', '4,120 · B-301']
            ]
          }
        },
        downstream: {
          summary: [
            { label: '分支买家', value: 'B-301', note: '合作买家' },
            { label: '分支实际报价', value: '¥4,120', note: '仅属于报告 A' },
            { label: '成交分支', value: '待确认', note: '订单存在 2 份报告' },
            { label: '售后', value: '未关联', note: '尚未成交' }
          ],
          events: [
            ['10:26', '分支 A 生成实际报价', 'B-301 · 4,120', 'ok'],
            ['—', '成交分支选择待确认', '不能由追溯系统自行选择报告 A 或 B', 'warn']
          ],
          afterSale: null,
          note: '订单存在多个报告分支时，成交与售后必须继续归属到实际采用的报告实例；当前示例不伪造成交结果。'
        }
      },
      {
        id: 'B',
        label: '报告 B',
        instanceId: 'RI-1042-B',
        strategy: { id: 'S-SCREEN-02', name: '屏幕专项策略', version: 'v2.7', selected: '后摄进灰 + 屏幕划痕' },
        reportGrade: '中花',
        issues: ['后摄像头进灰', '屏幕轻微划痕'],
        amountValue: 3780,
        amount: '¥3,780',
        buyer: '合作买家 B-305',
        completenessText: '证据完整',
        completenessPct: 92,
        completenessTone: 'warning',
        badge: '分支 B 规则链差异',
        badgeTone: 'danger',
        selectedLabels: ['后摄像头进灰', '屏幕轻微划痕'],
        verdict: {
          tone: 'danger',
          icon: 'alertCircle',
          label: '分支 B · 规则链差异',
          title: '专项规则满足条件，但被更高优先级通用规则抢先命中',
          description: '运营策略 S-SCREEN-02 选取“后摄进灰 + 屏幕划痕”，报告 B 为中花。专项规则 PR-0904 本应按大花价取价，但通用规则 PR-0701 优先级 30 高于专项规则 15，最终取中花价 4,000，扣减 220，实际报价 3,780。结论仅针对报告 B。'
        },
        facts: [
          { label: '当前报告', value: '报告 B', note: 'RI-1042-B · 中花' },
          { label: '分支实际报价', value: '¥3,780', note: 'B-305 · 唯一报价对象' },
          { label: '策略选用标签', value: '2 个', note: '后摄进灰 · 屏幕划痕' },
          { label: '首个差异', value: '规则优先级', note: 'PR-0904 未命中' }
        ],
        stages: {
          mapping: stage('分支策略与标签映射', 'gitBranch', 'ok', '10:26:21', '运营策略 S-SCREEN-02 从同一批共享候选标签中选择另外 2 个，并生成中花报告项。', [
            ['运营策略', 'S-SCREEN-02 · v2.7'], ['选用标签', '后摄进灰 · 屏幕划痕'], ['映射版本', 'MAP-V12.6'], ['未选标签', '边框磕碰']
          ], [['策略配置', 'STR-SSCREEN-02-V2.7 · 已冻结', 'gitBranch'], ['映射决策', 'MAP-1042-B · 2 行', 'fileText']], '两份报告共用原始标签，但标签选择不同；这是“同输入、不同策略、不同报告”的关键证据。'),
          report: stage('AI 报告 B', 'fileText', 'ok', '10:26:23', '报告实例 RI-1042-B 生成：中花，2 个扣减项，与报告 A 使用不同的标签组合。', [
            ['报告实例', 'RI-1042-B'], ['报告成色', '中花'], ['问题项', '后摄进灰 · 屏幕划痕'], ['扣减合计', '-220']
          ], [['报告快照', 'RPT-1042-B · 已冻结', 'fileText'], ['标签引用', 'LAB-1042-001 / 002', 'tag']], '报告 B 是独立快照，不覆盖报告 A，也不被报告 A 的结论覆盖。'),
          eligibility: stage('分支 B 买家匹配', 'users', 'ok', '10:26:24', '按报告 B、渠道和买家资格匹配，B-305 进入报价。', [
            ['进入匹配', '4 个买家'], ['符合报告条件', '1 个买家'], ['目标买家', 'B-305'], ['资格版本', 'ELIG-V6.3']
          ], [['买家分支', 'BUY-B305 · 匹配成功', 'users'], ['排除原因', '其他买家渠道或成色范围不匹配', 'filter']], '不同报告可以匹配不同买家；买家结果必须归属到报告实例 B。'),
          quote: stage('分支 B 报价决策', 'receipt', 'error', '10:26:25', '专项 PR-0904 满足“中花 + 屏幕划痕”条件，但优先级 15 低于通用规则 30；最终取中花价 4,000，扣减 220，分支实际报价 3,780。', [
            ['满足条件规则', 'PR-0904 与 PR-0701'], ['实际命中', 'PR-0701 · 优先级 30'], ['未命中', 'PR-0904 · 优先级 15'], ['分支实际报价', '3,780']
          ], [['规则命中快照', 'QUOTE-1042-B · PR-0701', 'gitBranch'], ['价档取用记录', '中花价 4,000', 'receipt']], '这是分支 B 内的真实规则链差异；不能因为分支 A 报价正常就忽略。'),
          downstream: stage('分支 B 成交与售后', 'packageCheck', 'warn', '—', '分支 B 已生成报价，但规则链存在差异；订单最终采用哪个报告分支尚未确认。', [
            ['分支结果', '已报价 · B-305'], ['规则链', '差异待修正'], ['成交', '未确认'], ['售后', '未关联']
          ], [['报价记录', 'QUOTE-1042-B · 已生成', 'receipt'], ['异常快照', 'RULE-DIFF-1042-B', 'alert']], '分支 B 的异常需独立处理；是否成交、由哪个买家成交仍需业务规则确认。')
        },
        events: [
          ['10:26:18', '订单级原始标签完成', 'LAB-1042 · 3 个候选通过阈值', 'ok'],
          ['10:26:21', '策略 B 选择标签', '后摄进灰 + 屏幕划痕', 'ok'],
          ['10:26:23', '生成报告 B', 'RI-1042-B · 中花', 'ok'],
          ['10:26:24', '匹配买家 B-305', '报告 B 条件与买家资格匹配', 'ok'],
          ['10:26:25', '规则选择异常', 'PR-0701 优先级 30 > PR-0904 优先级 15', 'error']
        ],
        config: [
          { name: '运营策略', used: 'S-SCREEN-02 · v2.7', current: 'S-SCREEN-02 · v2.7', changed: false, note: '' },
          { name: '标签映射', used: 'MAP-V12.6', current: 'MAP-V12.6', changed: false, note: '' },
          { name: '价格规则', used: 'PRICE-B305-V6.3', current: 'PRICE-B305-V6.4', changed: true, note: '当前版本未参与本单' },
          { name: '模型阈值', used: 'THR-CAM-0.65', current: 'THR-CAM-0.68', changed: true, note: '共享阈值快照' }
        ],
        mappings: [
          { source: '后摄像头进灰', type: '外观 / 摄像头', option: '外观 → 后摄进灰', severity: '中', report: '扣减项 · -120', filtered: false },
          { source: '屏幕轻微划痕', type: '外观 / 屏幕', option: '屏幕 → 轻微划痕', severity: '中', report: '扣减项 · -100', filtered: false },
          { source: '边框磕碰', type: '外观 / 边框', option: '未被本策略选取', severity: '—', report: '未进入报告 B', filtered: true }
        ],
        quote: {
          amount: '3,780', amountRaw: 3780,
          statusLabel: '规则链差异', statusTone: 'danger',
          attempt: 'QUOTE-1042-B01', buyer: '合作买家 B-305',
          rules: [
            { priority: 15, id: 'PR-0904', name: '中花 + 屏幕划痕专项', condition: '成色 = 中花 且 扣减项包含 屏幕轻微划痕', action: '应指定取大花价，但本次未被选择', result: '未命中 · 优先级较低', tone: 'warning', hit: false },
            { priority: 30, id: 'PR-0701', name: '通用成色规则', condition: '成色 = 中花', action: '实际取中花价 4,000，执行扣减', result: '命中 · 与业务预期不符', tone: 'danger', hit: true },
            { priority: 10, id: 'PR-0001', name: '买家兜底规则', condition: '无其他规则命中', action: '按买家兜底策略处理', result: '不适用', tone: 'neutral', hit: false }
          ],
          lines: [
            { label: '中花成色价', source: 'PR-0701 实际取价档 · 价格配置 PRICE-B305-V6.3', amount: 4000, kind: 'base' },
            { label: '后摄像头进灰', source: '扣减配置 D-036 · 分支 B 执行一次', amount: -120, kind: 'deduction' },
            { label: '屏幕轻微划痕', source: '扣减配置 D-041 · 分支 B 执行一次', amount: -100, kind: 'deduction' }
          ],
          total: '3,780', totalNote: '报告 B · 买家 B-305 的实际报价',
          difference: {
            good: false,
            title: '首个差异：专项规则优先级低于通用规则',
            description: '专项规则 PR-0904 已满足条件，但优先级 15 低于通用规则 PR-0701 的 30，报价使用了通用中花价。页面只展示报告 B 的实际报价 3,780，不生成“应有报价”。',
            items: [
              ['首个差异', '专项规则优先级低于通用规则'],
              ['实际取用价档', '中花价 4,000'],
              ['分支实际报价', '3,780 · B-305']
            ]
          }
        },
        downstream: {
          summary: [
            { label: '分支买家', value: 'B-305', note: '合作买家' },
            { label: '分支实际报价', value: '¥3,780', note: '仅属于报告 B' },
            { label: '成交分支', value: '待确认', note: '订单存在 2 份报告' },
            { label: '售后', value: '未关联', note: '尚未成交' }
          ],
          events: [
            ['10:26', '分支 B 生成实际报价', 'B-305 · 3,780', 'warn'],
            ['—', '成交分支选择待确认', '不能由追溯系统自行选择报告 A 或 B', 'warn']
          ],
          afterSale: null,
          note: '若订单最终按报告 B 成交，售后应关联 RI-1042-B；若按报告 A 成交，则售后必须关联 RI-1042-A。'
        }
      }
    ]
  };

  scenarios.unshift(dualReport);

  window.TRACE_SCENARIOS = scenarios;
  window.STAGE_ORDER = ['order', 'input', 'labels', 'mapping', 'report', 'eligibility', 'quote', 'downstream'];
})();
