(function () {
  const scenarios = window.TRACE_SCENARIOS || [];
  const stageOrder = window.STAGE_ORDER || [];
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const icon = (name, className) => window.iconSvg(name, className || '');
  const ic = (name) => `<span class="icon">${icon(name)}</span>`;

  const state = {
    filter: 'all',
    queueQuery: '',
    ledgerModel: 'all',
    ledgerAftersale: 'all',
    activeScenarioId: 'dual',
    activeBranchId: 'B',
    activeTab: 'chain',
    activeStage: 'report',
    p1Tab: 'strategy',
    lastFocus: null,
    modalOpen: false,
    drawerKey: null,
    drawerOpen: false,
    lastDrawerFocus: null
  };

  const stageLabels = { ok: '正常', warn: '需关注', error: '异常', muted: '未发生' };
  const filterLabels = {
    all: '全部报告',
    dual: '一单双报告',
    unquoted: '未报价',
    anomaly: '不支持',
    aftersales: '售后关联',
    incomplete: '待补证',
    consistent: '支持'
  };
  const queueOrder = ['dual', 'priority', 'unquoted', 'aftersales', 'incomplete', 'normal'];
  const stageJudgements = {
    order: ['订单事件只读，不覆盖原订单状态。', '触发方式与渠道配置用于解释订单为什么进入 AI 识别。', '订单时间与 trace_id 是全链路查询主键。'],
    input: ['图片和店员选项必须冻结为报告分支输入快照。', '追溯不会在查询时重新提交图片或重跑模型。', '不同报告可以使用不同任务、图片和模型输出，不能用一份输入覆盖所有分支。'],
    labels: ['原始分数与阈值必须同时保存，低于阈值的候选也不能丢。', '候选标签按报告分支的 run_id 独立保存，不能合并成订单级标签。', '结果标签不能替代原始标签证据。'],
    mapping: ['先记录当前报告分支选取/排除了哪些本分支 AI 标签，再看标签映射。', '映射必须使用报价时版本，不能以当前配置反推历史。', '映射链路中有缺口时，仅当前分支结论降级为待确认线索。'],
    report: ['每个报告实例是只读决策快照，不支持人工修改。', '订单可以有多份报告，报告“唯一”只约束单个报告实例内结论。', '报告项需要能追溯到本分支原始标签和当前分支映射规则。'],
    eligibility: ['买家独立策略在报告生成前决定报告买家组。', '报告生成后不再做买家再匹配；同一策略可绑定多个买家。', '归属关系需保留买家、策略 ID/版本和报告实例的稳定关联。'],
    quote: ['每份报告、每位买家、每次报价只保留一个报价结果：实际报价。', '“成色 + 特定扣减项”命中后按其他成色价出价属于合法业务。', '系统不跨报告分支、跨成色档或基于外部基准生成高低结论，只核对当前分支规则链。'],
    downstream: ['P0 按成交报告实例关联复检、售后状态和差异摘要。', '成交买家确定后按“成交买家 → 独立策略 → 报告实例”自动归属。', '售后差异不反向改写成交前的报告与报价快照。']
  };

  let queueBound = false;

  function getScenario(id) {
    return scenarios.find((item) => item.id === id) || scenarios[0];
  }

  function branchesOf(scenario) {
    if (Array.isArray(scenario.branches) && scenario.branches.length) return scenario.branches;
    const reportStage = scenario.stages && scenario.stages.report;
    const reportCode = reportStage ? (reportStage.facts.find(([label]) => label === '报告版本') || [])[1] || scenario.traceId : scenario.traceId;
    const buyerIds = String(scenario.buyer || '').replace(/^合作买家\s*/, '').split(/\s*\/\s*/).filter(Boolean);
    return [{
      id: 'single',
      label: '报告 A',
      instanceId: reportCode,
      reportId: reportCode,
      reportVersion: '报价时快照',
      audience: { label: '策略买家组', buyers: buyerIds, note: '演示单报告案例；正式数据由买家独立策略归属记录提供' },
      strategy: scenario.reportStrategy || { id: '策略快照待补', name: '单报告策略', version: '—', selected: scenario.issues.join(' · ') || '报告项待核' },
      staffReport: scenario.staffReport || '店员上报快照待补',
      reportGrade: scenario.reportGrade,
      issues: scenario.issues,
      amount: scenario.amount,
      amountValue: scenario.amountValue,
      buyer: scenario.buyer,
      completenessText: scenario.completenessText,
      completenessPct: scenario.completenessPct,
      badge: scenario.badge,
      badgeTone: scenario.badgeTone,
      verdict: scenario.verdict,
      facts: scenario.facts,
      stages: scenario.stages,
      model: scenario.model,
      images: scenario.images,
      candidates: scenario.candidates,
      events: scenario.events,
      config: scenario.config,
      mappings: scenario.mappings,
      quote: scenario.quote,
      downstream: scenario.downstream,
      selectedLabels: scenario.issues
    }];
  }

  function getBranch(scenario, branchId) {
    const branches = branchesOf(scenario);
    return branches.find((item) => item.id === branchId) || branches[0];
  }

  function defaultBranchId(scenario) {
    const branches = branchesOf(scenario);
    const flagged = branches.find((item) => item.badgeTone === 'danger' || item.badgeTone === 'warning');
    return (flagged || branches[0]).id;
  }

  function branchStages(scenario, branch) {
    return Object.assign({}, scenario.sharedStages || {}, branch.stages || {});
  }

  function branchData(scenario, branch, key) {
    return branch && branch[key] !== undefined ? branch[key] : scenario[key];
  }

  function branchImages(scenario, branch) {
    return branchData(scenario, branch, 'images') || [];
  }

  function branchCandidates(scenario, branch) {
    return branchData(scenario, branch, 'candidates') || [];
  }

  function branchModel(scenario, branch) {
    return branchData(scenario, branch, 'model') || {};
  }

  function branchStrategy(scenario, branch) {
    return branch.strategy || scenario.reportStrategy || { id: '策略快照待补', name: '买家策略', version: '—', selected: '—' };
  }

  function branchAudience(scenario, branch) {
    if (branch.audience && Array.isArray(branch.audience.buyers) && branch.audience.buyers.length) return branch.audience;
    const buyers = String(branch.buyer || scenario.buyer || '').replace(/^合作买家\s*/, '').split(/\s*\/\s*/).filter(Boolean);
    return { label: '策略买家组', buyers, note: '买家策略归属快照' };
  }

  function branchQuote(scenario, branch) {
    return branch.quote || scenario.quote || { amount: branch.amount, amountRaw: branch.amountValue, rules: [], lines: [], difference: { items: [] } };
  }

  function branchDownstream(scenario, branch) {
    return branch.downstream || scenario.downstream || { summary: [], events: [], afterSale: null };
  }

  function branchStaffReport(scenario, branch) {
    return branch.staffReport || scenario.staffReport || '店员上报快照待补';
  }

  function branchReportId(scenario, branch) {
    if (branch.reportId) return branch.reportId;
    const reportStage = branchStages(scenario, branch).report;
    return reportStage ? (reportStage.facts.find(([label]) => label === '报告版本') || [])[1] || branch.instanceId : branch.instanceId;
  }

  function branchReportVersion(scenario, branch) {
    return branch.reportVersion || '报价时快照';
  }

  function branchConclusion(scenario, branch) {
    const quote = branchQuote(scenario, branch);
    const downstream = branchDownstream(scenario, branch);
    const buyerRows = branchBuyerRows(scenario, branch);
    const partialUnquoted = buyerRows.filter((item) => item.status === 'unquoted').length;
    if (branch.amountValue == null || quote.amountRaw == null) {
      return { key: 'unquoted', label: '未报价', detail: '已定位阻断点', tone: 'danger' };
    }
    if (scenario.filter === 'incomplete' || branch.completenessPct < 70) {
      return { key: 'incomplete', label: '待补证', detail: '上游证据缺失', tone: 'neutral' };
    }
    if (branch.badgeTone === 'danger' || quote.statusTone === 'danger') {
      return { key: 'unsupported', label: '不支持', detail: partialUnquoted ? `规则链差异 · ${partialUnquoted} 个买家未报` : '规则链存在差异', tone: 'danger' };
    }
    if (downstream.afterSale || scenario.filter === 'aftersales') {
      return { key: 'supported', label: '支持', detail: partialUnquoted ? `报价可解释 · ${partialUnquoted} 个买家未报 · 售后差异` : '报价可解释 · 售后差异', tone: 'warning' };
    }
    return { key: 'supported', label: '支持', detail: partialUnquoted ? `报价可解释 · ${partialUnquoted} 个买家未报` : '报价链完整解释', tone: 'success' };
  }

  function branchBuyerRows(scenario, branch) {
    if (Array.isArray(branch.buyerQuotes) && branch.buyerQuotes.length) return branch.buyerQuotes;
    const audience = branchAudience(scenario, branch);
    const quote = branchQuote(scenario, branch);
    const hitRule = (quote.rules || []).find((rule) => rule.hit);
    const priceTier = (quote.lines || []).find((line) => line.kind === 'base');
    const quotedBuyer = String(branch.buyer || '').replace(/^合作买家\s*/, '');
    if (branch.amountValue == null) {
      const reasonItem = (quote.difference && quote.difference.items || []).find(([label]) => /订单级原因|首个阻断点/.test(label));
      const reason = reasonItem ? reasonItem[1] : branch.unquotedReason || '未报价原因已记录，详情待补';
      return audience.buyers.map((buyer, index) => ({
        buyer, status: 'unquoted', amount: '—', rule: '—', priceTier: '—',
        reason: index === 0 ? reason : '同一策略买家组内未生成报价'
      }));
    }
    return audience.buyers.map((buyer) => {
      const isQuoted = buyer === quotedBuyer || audience.buyers.length === 1;
      return {
        buyer,
        status: isQuoted ? 'quoted' : 'not-included',
        amount: isQuoted ? branch.amount || quote.amount : '—',
        rule: isQuoted ? hitRule ? `${hitRule.id} · 优先级 ${hitRule.priority}` : '规则快照待补' : '—',
        priceTier: isQuoted ? priceTier ? priceTier.label : '实际取用价档待补' : '—',
        reason: isQuoted ? quote.statusLabel || '已生成实际报价' : '未进入本次报价的买家级结果'
      };
    });
  }

  function allReportRows() {
    const ordered = scenarios.slice().sort((a, b) => {
      const ai = queueOrder.indexOf(a.id);
      const bi = queueOrder.indexOf(b.id);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
    return ordered.flatMap((scenario) => {
      const branches = branchesOf(scenario);
      return branches.map((branch, index) => ({
        scenario,
        branch,
        branchIndex: index + 1,
        branchCount: branches.length,
        conclusion: branchConclusion(scenario, branch)
      }));
    });
  }

  function reportRowSearchText(row) {
    const { scenario, branch } = row;
    const model = branchModel(scenario, branch);
    const audience = branchAudience(scenario, branch);
    const candidates = branchCandidates(scenario, branch);
    const mappings = branchData(scenario, branch, 'mappings') || [];
    const buyerRows = branchBuyerRows(scenario, branch);
    return [
      scenario.orderNo, scenario.device, scenario.specs, scenario.store, scenario.channel, scenario.traceId,
      branch.label, branch.instanceId, branchReportId(scenario, branch), branchReportVersion(scenario, branch),
      branch.reportGrade, (branch.issues || []).join(' '),
      branchStrategy(scenario, branch).id, branchStrategy(scenario, branch).name, branchStrategy(scenario, branch).version,
      audience.buyers.join(' '), model.code, model.run, model.threshold,
      candidates.map((item) => item.label).join(' '),
      mappings.map((item) => `${item.source} ${item.type} ${item.option}`).join(' '),
      buyerRows.map((item) => `${item.buyer} ${item.amount} ${item.rule} ${item.reason}`).join(' ')
    ].join(' ').toLowerCase();
  }

  function visibleReportRows() {
    let rows = allReportRows();
    if (state.filter === 'dual') rows = rows.filter((row) => row.branchCount > 1 || row.scenario.filter === 'dual');
    else if (state.filter === 'unquoted') rows = rows.filter((row) => row.conclusion.key === 'unquoted');
    else if (state.filter === 'anomaly') rows = rows.filter((row) => row.conclusion.key === 'unsupported');
    else if (state.filter === 'incomplete') rows = rows.filter((row) => row.conclusion.key === 'incomplete');
    else if (state.filter === 'consistent') rows = rows.filter((row) => row.conclusion.key === 'supported');
    else if (state.filter === 'aftersales') rows = rows.filter((row) => Boolean(branchDownstream(row.scenario, row.branch).afterSale));

    if (state.ledgerModel !== 'all') rows = rows.filter((row) => branchModel(row.scenario, row.branch).code === state.ledgerModel);
    if (state.ledgerAftersale !== 'all') {
      rows = rows.filter((row) => {
        const hasAfterSale = Boolean(branchDownstream(row.scenario, row.branch).afterSale);
        return state.ledgerAftersale === 'yes' ? hasAfterSale : !hasAfterSale;
      });
    }
    const query = state.queueQuery.trim().toLowerCase();
    if (query) rows = rows.filter((row) => reportRowSearchText(row).includes(query));
    return rows;
  }

  function isSharedStage(scenario, key) {
    return Boolean(scenario.sharedStages && scenario.sharedStages[key]);
  }

  function renderQueue() {
    const body = $('#queueBody');
    if (!body) return;
    const allRows = allReportRows();
    const rows = visibleReportRows();
    const counts = {
      all: allRows.length,
      consistent: allRows.filter((row) => row.conclusion.key === 'supported').length,
      anomaly: allRows.filter((row) => row.conclusion.key === 'unsupported').length,
      unquoted: allRows.filter((row) => row.conclusion.key === 'unquoted').length,
      incomplete: allRows.filter((row) => row.conclusion.key === 'incomplete').length,
      aftersales: allRows.filter((row) => Boolean(branchDownstream(row.scenario, row.branch).afterSale)).length,
      dual: allRows.filter((row) => row.branchCount > 1 || row.scenario.filter === 'dual').length
    };
    const filtersActive = state.ledgerModel !== 'all' || state.ledgerAftersale !== 'all' || Boolean(state.queueQuery.trim());
    $('#queueSubtitle').textContent = filtersActive
      ? `报告级台账 · 当前筛选 ${rows.length} / ${allRows.length} 份报告`
      : `报告级台账 · 一行一份 AI 报告实例 · 共 ${allRows.length} 份报告`;

    if (!rows.length) {
      body.innerHTML = `<tr class="empty-row"><td colspan="7"><div class="empty-state">${ic('search')}<strong>没有匹配的报告</strong><span>尝试清空筛选、模型 code 或关键词</span></div></td></tr>`;
    } else {
      body.innerHTML = rows.map((row) => {
        const { scenario, branch, branchIndex, branchCount, conclusion } = row;
        const model = branchModel(scenario, branch);
        const strategy = branchStrategy(scenario, branch);
        const audience = branchAudience(scenario, branch);
        const candidates = branchCandidates(scenario, branch);
        const mappings = branchData(scenario, branch, 'mappings') || [];
        const buyerRows = branchBuyerRows(scenario, branch);
        const downstream = branchDownstream(scenario, branch);
        const selected = branch.selectedLabels || candidates.filter((item) => item.accepted).map((item) => item.label);
        const topLabels = selected.slice(0, 2);
        const quote = branchQuote(scenario, branch);
        const quotedCount = buyerRows.filter((item) => item.status === 'quoted').length;
        const unquotedCount = buyerRows.filter((item) => item.status === 'unquoted').length;
        const mappingCount = mappings.filter((item) => !item.filtered).length;
        const afterSale = downstream.afterSale;
        const deal = (downstream.summary || []).find((item) => /中标买家|成交买家|成交/.test(item.label));
        const dealText = afterSale
          ? `${afterSale.id || '售后'} · ${afterSale.status || '处理中'}`
          : deal && deal.value === '待同步' ? '成交买家待同步'
            : deal ? `${deal.label} ${deal.value}` : '成交/售后待关联';
        const threshold = String(model.threshold || '阈值待补').split('·')[0].trim();
        return `<tr class="ledger-row${branchCount > 1 ? ' multi-report' : ''}" tabindex="0" role="button" data-report-key="${esc(scenario.id)}:${esc(branch.id)}" data-scenario-id="${esc(scenario.id)}" data-branch-id="${esc(branch.id)}" aria-label="查看 ${esc(scenario.orderNo)} ${esc(branch.label)} 的报告追溯详情">
          <td class="ledger-order-cell" data-label="订单 / 设备">
            <div class="ledger-order-head"><strong>${esc(scenario.orderNo)}</strong><span class="order-report-ratio">${branchCount > 1 ? `报告 ${branchIndex}/${branchCount}` : '单报告'}</span></div>
            <span>${esc(scenario.device)} · ${esc(scenario.specs)}</span>
            <small>${esc(scenario.store)} · ${esc(scenario.time)} · ${esc(scenario.channel)}</small>
          </td>
          <td data-label="报告实例 / 成色">
            <div class="ledger-report-identity"><div><span class="report-branch-label">${esc(branch.label)}</span><strong>${esc(branch.instanceId)}</strong></div><small>${esc(branchReportId(scenario, branch))} · ${esc(branchReportVersion(scenario, branch))}</small><span class="report-grade-chip">${esc(branch.reportGrade)} · ${branch.issues.length} 项</span></div>
          </td>
          <td data-label="买家策略 / 买家组">
            <div class="ledger-stack"><strong>${esc(strategy.id)} · ${esc(strategy.version)}</strong><span>${esc(strategy.name)}</span><small>${esc(audience.buyers.join(' / ') || '买家待补')} · ${audience.buyers.length} 个买家</small></div>
          </td>
          <td data-label="模型任务 / 图片 / 标签">
            <div class="ledger-stack"><strong>${esc(model.code || '模型待补')} · ${esc(model.run || '任务待补')}</strong><span>${branchImages(scenario, branch).length} 图 · ${candidates.length} 候选 · 阈值 ${esc(threshold)}</span><div class="ledger-tag-row">${topLabels.map((label) => `<i>${esc(label)}</i>`).join('') || '<i>标签待补</i>'}</div></div>
          </td>
          <td data-label="AI 报告 / 店员上报">
            <div class="ledger-stack"><strong>${esc(topLabels.join(' + ') || branch.issues.join(' + ') || '报告项待核')}</strong><span>${esc(branch.reportGrade)} · 映射 ${mappingCount} 条</span><small>${esc(branchStaffReport(scenario, branch))}</small></div>
          </td>
          <td data-label="实际报价 / 买家状态">
            <div class="ledger-quote ${branch.amountValue == null ? 'empty' : ''}"><strong>${branch.amountValue == null ? '未报价' : esc(branch.amount)}</strong><span>${quotedCount} 已报 / ${unquotedCount} 未报</span><small>${branch.amountValue == null ? esc(buyerRows[0] ? buyerRows[0].reason : '未报价原因待补') : esc(quote.attempt || '实际报价')}</small></div>
          </td>
          <td data-label="判定 / 成交售后">
            <div class="ledger-conclusion"><span class="status-pill ${esc(conclusion.tone)}">${esc(conclusion.label)}</span><span>${esc(conclusion.detail)}</span><small>${esc(dealText)}</small></div>
            <span class="ledger-row-action" aria-hidden="true">${ic('chevronRight')}</span>
          </td>
        </tr>`;
      }).join('');
    }

    $$('[data-filter-count]').forEach((node) => { node.textContent = String(counts[node.dataset.filterCount] || 0); });
    $$('[data-side-count]').forEach((node) => { node.textContent = String(counts[node.dataset.sideCount] || 0); });
    $('#metricReports').textContent = String(counts.all);
    $('#metricOrders').textContent = String(new Set(allRows.map((row) => row.scenario.id)).size);
    $('#metricUnquoted').textContent = String(counts.unquoted);
    $('#metricAnomaly').textContent = String(counts.anomaly);
    $('#metricAfterSales').textContent = String(counts.aftersales);
    $('#outcomeSupported').textContent = String(counts.consistent);
    $('#outcomeUnsupported').textContent = String(counts.anomaly);
    $('#outcomePending').textContent = String(counts.unquoted + counts.incomplete);

    $$('#queueFilters [data-queue-filter]').forEach((button) => {
      const active = button.dataset.queueFilter === state.filter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $$('.side-nav [data-filter]').forEach((button) => {
      const active = button.dataset.filter === state.filter;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });

    if (!queueBound) {
      queueBound = true;
      $('#queueBody').addEventListener('click', (event) => {
        const row = event.target.closest('[data-report-key]');
        if (row) navigateToReport(row.dataset.scenarioId, row.dataset.branchId);
      });
      $('#queueBody').addEventListener('keydown', (event) => {
        const row = event.target.closest('[data-report-key]');
        if (row && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          navigateToReport(row.dataset.scenarioId, row.dataset.branchId);
        }
      });
    }
  }

  function renderOverview() {
    renderQueue();
    const active = state.filter === 'all' ? '全部报告实例' : filterLabels[state.filter] || '当前筛选';
    const subtitle = state.filter === 'all'
      ? '一行对应一份 AI 报告实例；同一订单的多份报告分组保留，分别查看策略归属、模型标签、报告成色和买家报价。'
      : `当前查看：${active}。筛选只改变报告台账，不合并或改写任何报告分支事实。`;
    $('.page-heading .heading-desc').textContent = subtitle;
  }

  function navigateToScenario(id, branchId) {
    if (!getScenario(id)) return;
    const target = branchId ? `#trace/${encodeURIComponent(id)}/${encodeURIComponent(branchId)}` : `#trace/${encodeURIComponent(id)}`;
    if (window.location.hash !== target) {
      window.location.hash = target;
    } else {
      showScenario(id, branchId);
    }
  }

  function navigateToReport(scenarioId, branchId) {
    const scenario = getScenario(scenarioId);
    if (!scenario) return;
    const branch = getBranch(scenario, branchId);
    const target = `#report/${encodeURIComponent(scenario.id)}/${encodeURIComponent(branch.id)}`;
    if (window.location.hash !== target) window.location.hash = target;
    else openReportDrawer(scenario.id, branch.id);
  }

  function navigateOverview() {
    if (window.location.hash !== '#overview') window.location.hash = 'overview';
    else showOverviewView();
  }

  function showScenario(id, branchId) {
    const scenario = getScenario(id);
    if (!scenario) return;
    closeReportDrawer(false);
    state.activeScenarioId = scenario.id;
    state.activeBranchId = branchId && getBranch(scenario, branchId) ? getBranch(scenario, branchId).id : defaultBranchId(scenario);
    state.activeTab = 'chain';
    state.activeStage = 'report';
    renderDetail(scenario);
    $('#overviewView').hidden = true;
    $('#detailView').hidden = false;
    closeSidebar();
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.title = `${scenario.orderNo} · 报价追溯台`;
  }

  function showOverviewView() {
    closeReportDrawer(false);
    $('#detailView').hidden = true;
    $('#overviewView').hidden = false;
    renderOverview();
    closeSidebar();
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.title = 'AI 报告追溯台账 · AI 报告订单追溯链路';
  }

  function openReportDrawer(scenarioId, branchId) {
    const scenario = getScenario(scenarioId);
    if (!scenario) return;
    const branch = getBranch(scenario, branchId);
    const root = $('#reportDrawer');
    const content = $('#drawerContent');
    if (!state.drawerOpen) state.lastDrawerFocus = document.activeElement;
    state.drawerKey = `${scenario.id}:${branch.id}`;
    state.drawerOpen = true;
    content.innerHTML = renderReportDrawer(scenario, branch);
    $('#drawerBackdrop').hidden = false;
    root.hidden = false;
    document.body.classList.add('drawer-open');
    window.hydrateIcons(content);
    const scroll = $('.drawer-scroll', content);
    if (scroll) scroll.scrollTop = 0;
    document.title = `${scenario.orderNo} · ${branch.label} · 报告追溯`;
    window.requestAnimationFrame(() => {
      const close = $('[data-close-drawer]', content);
      if (close) close.focus({ preventScroll: true });
    });
  }

  function closeReportDrawer(updateHash) {
    const root = $('#reportDrawer');
    if (!root || !state.drawerOpen) return;
    root.hidden = true;
    $('#drawerBackdrop').hidden = true;
    $('#drawerContent').innerHTML = '';
    state.drawerOpen = false;
    state.drawerKey = null;
    document.body.classList.remove('drawer-open');
    if (!state.modalOpen) document.body.style.overflow = '';
    if (state.lastDrawerFocus && typeof state.lastDrawerFocus.focus === 'function') state.lastDrawerFocus.focus({ preventScroll: true });
    state.lastDrawerFocus = null;
    if (updateHash && window.location.hash.startsWith('#report/')) window.location.hash = 'overview';
    else if (window.location.hash === '#overview' || window.location.hash === '') document.title = 'AI 报告追溯台账 · AI 报告订单追溯链路';
  }

  function renderReportDrawer(scenario, branch) {
    const branches = branchesOf(scenario);
    const model = branchModel(scenario, branch);
    const strategy = branchStrategy(scenario, branch);
    const audience = branchAudience(scenario, branch);
    const candidates = branchCandidates(scenario, branch);
    const mappings = branchData(scenario, branch, 'mappings') || [];
    const buyerRows = branchBuyerRows(scenario, branch);
    const downstream = branchDownstream(scenario, branch);
    const quote = branchQuote(scenario, branch);
    const conclusion = branchConclusion(scenario, branch);
    const selected = branch.selectedLabels || candidates.filter((item) => item.accepted).map((item) => item.label);
    const accepted = candidates.filter((item) => item.accepted).length;
    const afterSale = downstream.afterSale;
    const recheck = (downstream.summary || []).find((item) => /复检/.test(item.label));
    const reportVersionText = `${branchReportId(scenario, branch)} · ${branchReportVersion(scenario, branch)}`;
    const siblings = branches.filter((item) => item.id !== branch.id);
    const candidateRows = candidates.length ? candidates.map((candidate) => {
      const mapping = mappings.find((item) => item.source === candidate.label);
      const isSelected = selected.includes(candidate.label);
      const decision = !candidate.accepted ? candidate.reason : isSelected ? '策略采用' : '策略未选取';
      return `<tr class="${candidate.accepted ? '' : 'filtered'}">
        <td><strong>${esc(candidate.label)}</strong><small>${esc(candidate.type)}</small></td>
        <td><span class="candidate-confidence">${esc(candidate.confidence.toFixed(2))}</span></td>
        <td>≥ ${esc(candidate.threshold.toFixed(2))}</td>
        <td><span class="accept-state${isSelected ? '' : ' filtered'}">${ic(isSelected ? 'circleCheck' : 'minus')}${esc(decision)}</span></td>
        <td>${mapping ? `<strong>${esc(mapping.option)}</strong><small>${esc(mapping.severity)} · ${esc(mapping.report)}</small>` : '<span class="muted-text">未映射 / 未进入报告</span>'}</td>
      </tr>`;
    }).join('') : `<tr><td colspan="5"><div class="drawer-missing">${ic('fileWarning')}<span>候选标签与映射快照缺失，无法用当前配置补造历史路径。</span></div></td></tr>`;
    const buyerRowsHtml = buyerRows.map((row) => {
      const statusLabel = row.status === 'quoted' ? '已报价' : row.status === 'unquoted' ? '未报价' : '未进入本次报价';
      const tone = row.status === 'quoted' ? 'success' : row.status === 'unquoted' ? 'danger' : 'neutral';
      return `<tr><td><strong>${esc(row.buyer)}</strong><small>${esc(audience.label)}</small></td><td><span class="status-pill ${tone} no-dot">${statusLabel}</span></td><td class="buyer-amount">${esc(row.amount)}</td><td><strong>${esc(row.rule)}</strong><small>${esc(row.priceTier)}</small></td><td>${esc(row.reason)}</td></tr>`;
    }).join('');
    const downstreamCards = (downstream.summary || []).map((item) => `<div><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong><small>${esc(item.note)}</small></div>`).join('');
    const siblingHtml = branches.length > 1 ? `<div class="drawer-siblings"><div>${ic('gitBranch')}<span><strong>本订单共 ${branches.length} 份报告</strong><small>当前只查看 ${esc(branch.label)}；切换仅改变分支，不合并报告结论。</small></span></div><div class="drawer-sibling-actions">${siblings.map((item) => `<button class="button small" type="button" data-sibling-report="${esc(scenario.id)}:${esc(item.id)}">查看 ${esc(item.label)}</button>`).join('')}</div></div>` : '';

    return `<div class="drawer-head">
      <div class="drawer-title-wrap"><p>AI report trace · 单报告只读快照</p><h2 id="drawerTitle">${esc(scenario.device)} · ${esc(scenario.specs)}</h2><span>${esc(scenario.orderNo)} · ${esc(scenario.store)} · ${esc(scenario.time)} · trace_id ${esc(scenario.traceId)}</span></div>
      <div class="drawer-head-actions"><button class="button small" type="button" data-copy-report>${ic('copy')}复制摘要</button><button class="button primary small" type="button" data-full-trace="${esc(scenario.id)}:${esc(branch.id)}">${ic('external')}打开完整链路</button><button class="drawer-close" type="button" data-close-drawer aria-label="关闭报告详情">${ic('x')}</button></div>
    </div>
    <div class="drawer-scroll">
      <div class="drawer-report-banner">
        <div class="drawer-report-badge"><span>${esc(branch.label)}</span><strong>${esc(branch.instanceId)}</strong><small>${esc(reportVersionText)}</small></div>
        <div class="drawer-report-meta"><span>${esc(strategy.id)} · ${esc(strategy.name)} ${esc(strategy.version)}</span><span>${esc(audience.buyers.join(' / '))} · ${audience.buyers.length} 个买家</span><span>${esc(model.code || '模型待补')} · ${esc(model.run || '任务待补')}</span></div>
        <span class="status-pill ${esc(conclusion.tone)}">${esc(conclusion.label)} · ${esc(conclusion.detail)}</span>
      </div>
      ${siblingHtml}
      <div class="drawer-verdict ${esc(branch.verdict.tone)}"><span class="drawer-verdict-icon">${ic(branch.verdict.icon)}</span><div><span class="status-pill ${esc(branch.badgeTone)} no-dot">${esc(branch.verdict.label)}</span><h3>${esc(branch.verdict.title)}</h3><p>${esc(branch.verdict.description)}</p></div><span class="drawer-completeness">${esc(branch.completenessText)}<b>${esc(branch.completenessPct)}%</b></span></div>
      <div class="drawer-metrics"><div><span>报告成色</span><strong>${esc(branch.reportGrade)}</strong><small>${branch.issues.length} 个问题项</small></div><div><span>实际报价</span><strong>${branch.amountValue == null ? '未报价' : esc(branch.amount)}</strong><small>${branch.amountValue == null ? '不生成推测金额' : '买家实际报价'}</small></div><div><span>策略买家组</span><strong>${audience.buyers.length} 个</strong><small>${esc(audience.buyers.join(' / '))}</small></div><div><span>下游</span><strong>${afterSale ? esc(afterSale.status) : downstream.summary && downstream.summary.length ? '已关联' : '待关联'}</strong><small>${afterSale ? esc(afterSale.id) : '成交与售后摘要'}</small></div></div>

      <section class="drawer-section">
        <header><div><h3>报告身份与数据来源</h3><p>以报告实例为锚点，不从当前配置反推历史。</p></div><span class="status-pill neutral no-dot">只读</span></header>
        <div class="drawer-identity-grid">
          <div><span>报告实例</span><strong>${esc(branch.instanceId)}</strong><small>分支锚点</small></div>
          <div><span>报告 ID / 版本</span><strong>${esc(reportVersionText)}</strong><small>报告不可人工修改</small></div>
          <div><span>买家策略</span><strong>${esc(strategy.id)} · ${esc(strategy.version)}</strong><small>${esc(strategy.name)}</small></div>
          <div><span>策略买家组</span><strong>${esc(audience.buyers.join(' / ') || '待补')}</strong><small>报告生成前归属</small></div>
          <div><span>模型任务</span><strong>${esc(model.code || '待补')} · ${esc(model.run || '待补')}</strong><small>${esc(model.version || '版本待补')}</small></div>
          <div><span>输入快照</span><strong>${esc(model.input || '输入待补')}</strong><small>${esc(model.quality || '质量结果待补')}</small></div>
          <div><span>报价尝试</span><strong>${esc(quote.attempt || '尚未生成')}</strong><small>${esc(quote.buyer || branch.buyer || '买家待补')}</small></div>
          <div><span>证据完整度</span><strong>${esc(branch.completenessPct)}%</strong><small>${esc(branch.completenessText)}</small></div>
        </div>
      </section>

      <section class="drawer-section">
        <header><div><h3>向前追溯 · 模型与标签证据</h3><p>模型任务、图片、候选标签和阈值按本报告独立保存。</p></div><span class="status-pill info no-dot">${branchImages(scenario, branch).length} 图 / ${candidates.length} 候选</span></header>
        <div class="drawer-evidence-chain">
          <article><span class="drawer-step-number">01</span><strong>图片输入</strong><p>${esc(model.input || '输入快照待补')}</p><small>${branchImages(scenario, branch).length} 张图片 · ${esc(model.quality || '质量待核')}</small></article>
          <span class="drawer-step-arrow">${ic('chevronRight')}</span>
          <article><span class="drawer-step-number">02</span><strong>候选标签</strong><p>${candidates.length} 个候选，${accepted} 个超过阈值</p><small>阈值 ${esc(model.threshold || '待补')}</small></article>
          <span class="drawer-step-arrow">${ic('chevronRight')}</span>
          <article><span class="drawer-step-number">03</span><strong>策略选择</strong><p>${esc(selected.join(' · ') || '策略未选取标签')}</p><small>${esc(strategy.id)} · ${esc(strategy.version)}</small></article>
          <span class="drawer-step-arrow">${ic('chevronRight')}</span>
          <article class="anchor"><span class="drawer-step-number">04</span><strong>${esc(branch.reportGrade)} · AI 报告</strong><p>${esc(branch.issues.join(' · ') || '报告项待核')}</p><small>${esc(branch.instanceId)}</small></article>
        </div>
        <div class="drawer-table-wrap"><table class="drawer-table"><thead><tr><th>原始候选标签</th><th>置信度</th><th>阈值</th><th>策略决策</th><th>最终映射 / 报告项</th></tr></thead><tbody>${candidateRows}</tbody></table></div>
      </section>

      <section class="drawer-section">
        <header><div><h3>三方对照 · AI / 店员 / 复检</h3><p>对照只针对当前报告实例，不混入同订单其他报告。</p></div><span class="status-pill neutral no-dot">差异摘要</span></header>
        <div class="drawer-compare-grid">
          <article><span>AI 报告</span><strong>${esc(branch.reportGrade)} · ${esc(branch.issues.join(' / ') || '报告项待核')}</strong><p>${esc(selected.join(' + ') || '采用标签待补')}</p></article>
          <article><span>店员上报</span><strong>${esc(branchStaffReport(scenario, branch))}</strong><p>用于解释 AI 与人工上报的差异，不覆盖原始上报。</p></article>
          <article><span>成交后复检</span><strong>${afterSale ? esc(afterSale.issue) : recheck ? `${esc(recheck.value)} · ${esc(recheck.note)}` : '未关联复检差异'}</strong><p>${afterSale ? `${esc(afterSale.id)} · ${esc(afterSale.status)}` : '无售后时保留“无差异/未发生”，不推断责任。'}</p></article>
        </div>
      </section>

      <section class="drawer-section">
        <header><div><h3>向后追溯 · 报价买家矩阵</h3><p>每个买家只保留实际报价；未报价买家保留订单级原因及本报告归属。</p></div><span class="status-pill ${esc(quote.statusTone || 'neutral')} no-dot">${esc(quote.statusLabel || '报价快照')}</span></header>
        <div class="drawer-table-wrap"><table class="drawer-table buyer-table"><thead><tr><th>买家</th><th>状态</th><th>实际报价</th><th>命中规则 / 实际取用价档</th><th>说明</th></tr></thead><tbody>${buyerRowsHtml || '<tr><td colspan="5">买家报价记录待补</td></tr>'}</tbody></table></div>
        <div class="drawer-note">${ic('info')}<span>不展示应得报价、成本价、市场价、规则重算价或跨成色档基准；每份报告、每个买家只展示买家实际报价。</span></div>
      </section>

      <section class="drawer-section">
        <header><div><h3>成交与售后归属</h3><p>成交买家确定后，按“成交买家 → 独立策略 → 报告实例”自动归属。</p></div>${afterSale ? `<span class="status-pill warning no-dot">${esc(afterSale.status)}</span>` : '<span class="status-pill neutral no-dot">待成交/无售后</span>'}</header>
        <div class="drawer-downstream">${downstreamCards || '<div><span>链路状态</span><strong>待补</strong><small>暂无下游事件</small></div>'}</div>
        ${afterSale ? `<div class="drawer-after-sale">${ic('alertCircle')}<div><strong>${esc(afterSale.id)} · ${esc(afterSale.issue)}</strong><p>${esc(afterSale.impact)} · 负责人 ${esc(afterSale.owner)}</p></div></div>` : ''}
        <div class="drawer-note">${ic('shield')}<span>报告、报价、成交归属和售后关联均为只读快照；售后差异不会反向改写成交前的 AI 报告。</span></div>
      </section>
      <div class="drawer-footer"><span>REQ-20261021-001 · v1.3 · ${esc(branch.instanceId)}</span><button class="button primary small" type="button" data-full-trace="${esc(scenario.id)}:${esc(branch.id)}">${ic('external')}查看完整全链路</button></div>
    </div>`;
  }

  function renderDetail(scenario) {
    const branches = branchesOf(scenario);
    const branch = getBranch(scenario, state.activeBranchId);
    $('#traceIdText').textContent = scenario.traceId;
    $('#detailTitle').textContent = `${scenario.device} · ${scenario.specs}`;
    $('#detailSubtitle').innerHTML = `${esc(scenario.orderNo)} · ${esc(scenario.store)} · ${esc(scenario.channel)} · 今日 ${esc(scenario.time)}`;
    $('#detailTags').innerHTML = [
      scenario.queueType,
      branches.length > 1 ? `${branches.length} 份 AI 报告` : `AI 报告 ${branch.reportGrade}`,
      branch.completenessText,
      `负责人 ${scenario.operator}`
    ].map((item) => `<span class="soft-tag">${esc(item)}</span>`).join('');

    const verdict = $('#verdictCard');
    verdict.className = `verdict-card ${branch.verdict.tone}`;
    $('#verdictIcon').innerHTML = ic(branch.verdict.icon);
    $('#verdictTitle').textContent = branch.verdict.title;
    $('#verdictBadge').className = `status-pill ${branch.badgeTone}`;
    $('#verdictBadge').textContent = branch.verdict.label;
    $('#verdictDescription').textContent = branch.verdict.description;
    $('#completenessText').textContent = branch.completenessText;
    const ring = $('#completenessRing');
    ring.textContent = `${branch.completenessPct}%`;
    ring.classList.toggle('warn', branch.completenessPct < 100);

    $('#detailFacts').innerHTML = branch.facts.map((fact) => `<div class="detail-fact"><span>${esc(fact.label)}</span><strong>${esc(fact.value)}</strong><small>${esc(fact.note)}</small></div>`).join('');
    $('#branchOverview').innerHTML = renderBranchOverview(scenario, branches, branch);
    $('#caseSwitcher').innerHTML = `<span class="case-switcher-label">演示案例</span>${scenarios.map((item) => `<button class="case-chip${item.id === scenario.id ? ' active' : ''}" type="button" data-case="${esc(item.id)}" aria-pressed="${item.id === scenario.id}">${esc(item.short)}</button>`).join('')}`;

    $$('.detail-tab').forEach((tab) => {
      const tabId = tab.dataset.detailTab;
      const active = tabId === state.activeTab;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.setAttribute('tabindex', active ? '0' : '-1');
      if (tabId === 'chain') tab.innerHTML = `全链路<span class="tab-count">${(scenario.stageOrder || stageOrder).length}</span>`;
      if (tabId === 'compare') {
        tab.hidden = branches.length < 2;
        tab.innerHTML = `分支对比<span class="tab-count">${branches.length}</span>`;
      }
      if (tabId === 'quote') tab.innerHTML = `分支报价<span class="tab-count">${branch.quote.rules.length}</span>`;
      if (tabId === 'evidence') tab.innerHTML = `AI 证据<span class="tab-count">${branchImages(scenario, branch).length}</span>`;
      if (tabId === 'downstream') tab.innerHTML = `成交与售后<span class="tab-count">${branch.downstream.events.length || '—'}</span>`;
    });
    if (state.activeTab === 'compare' && branches.length < 2) state.activeTab = 'chain';
    renderTab();
  }

  function renderBranchOverview(scenario, branches, activeBranch) {
    if (branches.length < 2) {
      return `<section class="branch-overview single"><div class="branch-overview-head"><div><span class="branch-kicker">${ic('fileText')}报告锚点</span><h2>本订单生成 1 份 AI 报告</h2><p>当前版本仍按单一报告展示；多报告订单请查看“一单双报告”案例。</p></div><span class="status-pill neutral no-dot">${esc(branches[0].instanceId || '单一报告')}</span></div></section>`;
    }
    const cards = branches.map((branch) => {
      const model = branchModel(scenario, branch);
      const buyers = branch.audience && branch.audience.buyers ? branch.audience.buyers.join(' / ') : branch.buyer;
      return `
      <button class="branch-card${branch.id === activeBranch.id ? ' active' : ''}" type="button" data-branch="${esc(branch.id)}" aria-pressed="${branch.id === activeBranch.id}">
        <span class="branch-card-top"><span class="branch-label">${esc(branch.label)}</span><span class="status-pill ${esc(branch.badgeTone)} no-dot">${esc(branch.badge)}</span></span>
        <strong>${esc(branch.reportGrade)} · ${esc(branch.amount || '未报价')}</strong>
        <span class="branch-strategy">${esc(buyers)} → ${esc(branch.strategy.id)} · ${esc(branch.strategy.name)} ${esc(branch.strategy.version)}</span>
        <span class="branch-meta">${esc(model.run || '任务待补')} · ${branchImages(scenario, branch).length} 图 · ${branchCandidates(scenario, branch).length} 个候选</span>
        <span class="branch-tags">${(branch.issues || []).map((issue) => `<i>${esc(issue)}</i>`).join('')}</span>
        <span class="branch-card-foot"><span>${esc(branch.buyer)}</span><span>${esc(branch.instanceId)}</span>${ic('chevronRight')}</span>
      </button>`;
    }).join('');
    const relation = scenario.branchRelation;
    const bindings = relation && relation.bindings ? relation.bindings.map((item) => `<div class="strategy-binding"><strong>${esc(item.buyer)}</strong><i>→</i><span>${esc(item.strategy)}</span><i>→</i><b>${esc(item.report)}</b></div>`).join('') : '';
    const origin = relation ? `<div class="branch-origin"><div class="branch-origin-copy">${ic('gitBranch')}<div><strong>为什么会有 ${branches.length} 份报告</strong><p>${esc(relation.reason)}：${relation.strategies.map((item) => `<span>${esc(item)}</span>`).join(' / ')}。买家独立策略先决定报告买家组，再由各分支独立执行 AI 任务、标签选择、报告和报价。</p><div class="strategy-binding-list">${bindings}</div></div></div><span class="status-pill info no-dot">${esc(relation.label)}</span></div><p class="branch-origin-note">${esc(relation.note)}</p>` : '';
    return `<section class="branch-overview">
      <div class="branch-overview-head"><div><span class="branch-kicker">${ic('gitBranch')}报告分支</span><h2>本订单生成 ${branches.length} 份不同的 AI 报告</h2><p>买家先按独立策略归组，报告生成前即确定受众；报告 A/B 并行保留，后生成报告不覆盖先生成报告，报价结果不合并。</p></div><span class="status-pill warning no-dot">多报告订单</span></div>
      ${origin}
      <div class="branch-card-grid">${cards}</div>
    </section>`;
  }

  function renderTab() {
    const scenario = getScenario(state.activeScenarioId);
    const content = $('#tabContent');
    if (!content) return;
    $$('.detail-tab').forEach((tab) => {
      const active = tab.dataset.detailTab === state.activeTab;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.setAttribute('tabindex', active ? '0' : '-1');
    });
    const branch = getBranch(scenario, state.activeBranchId);
    if (state.activeTab === 'compare') content.innerHTML = renderComparison(scenario);
    else if (state.activeTab === 'quote') content.innerHTML = renderQuote(scenario, branch);
    else if (state.activeTab === 'evidence') content.innerHTML = renderEvidence(scenario, branch);
    else if (state.activeTab === 'downstream') content.innerHTML = renderDownstream(scenario, branch);
    else content.innerHTML = renderChain(scenario, branch);
    window.hydrateIcons(content);
  }

  function renderChain(scenario, branch) {
    const stagesByKey = branchStages(scenario, branch);
    const chainOrder = scenario.stageOrder && scenario.stageOrder.length ? scenario.stageOrder : stageOrder;
    const stageKeys = chainOrder.filter((key) => stagesByKey[key]);
    const stages = stageKeys.map((key, index) => {
      const item = stagesByKey[key];
      const arrow = index < stageKeys.length - 1 ? `<span class="stage-arrow">${ic('chevronRight')}</span>` : '';
      const shared = isSharedStage(scenario, key);
      return `<button class="trace-stage ${esc(item.status)}${key === 'report' ? ' anchor' : ''}${shared ? ' shared' : ''}${key === state.activeStage ? ' active' : ''}" type="button" data-stage="${esc(key)}" aria-pressed="${key === state.activeStage}">
        <span class="stage-icon">${icon(item.icon)}</span>
        <strong>${esc(item.title)}</strong><span class="stage-scope${shared ? '' : ' branch'}">${shared ? '订单级' : '报告分支'}</span>
        <small>${esc(item.time || '—')}</small>
        <span class="stage-state">${esc(stageLabels[item.status] || item.status)}</span>
      </button>${arrow}`;
    }).join('');
    const stage = stagesByKey[state.activeStage] || stagesByKey.report;
    const judgments = (stageJudgements[state.activeStage] || stageJudgements.report).map((item) => `<li>${esc(item)}</li>`).join('');
    const facts = (stage.facts || []).map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('');
    const evidence = (stage.evidence || []).map(([name, meta, sourceIcon]) => `<div class="stage-evidence-row">${ic(sourceIcon || 'fileText')}<span>${esc(name)}</span><code>${esc(meta)}</code></div>`).join('');
    const noteClass = stage.status === 'warn' || stage.status === 'error' ? ' warning' : '';
    const config = renderConfig(branch.config);
    const events = branch.events.map(([time, title, description, status]) => `<div class="event-row"><span class="event-time">${esc(time)}</span><span class="event-line"><i class="event-dot ${esc(status)}"></i></span><span class="event-copy"><strong>${esc(title)}</strong><small>${esc(description)}</small></span><span class="event-state">${esc(stageLabels[status] || status || '')}</span></div>`).join('');
    const sharedCount = stageKeys.filter((key) => isSharedStage(scenario, key)).length;
    const buyers = branch.audience && branch.audience.buyers ? branch.audience.buyers.join(' / ') : branch.buyer;
    const model = branchModel(scenario, branch);
    const scopeNote = branchesOf(scenario).length > 1
      ? '订单节点只保留公共事实；买家策略归属、AI 输入、独立任务、候选标签、映射、报告和报价均属于当前报告分支。'
      : '前段记录订单级 AI 证据，后续节点属于当前报告实例。';
    return `<div class="branch-chain-banner"><div><span class="branch-kicker">${ic('gitBranch')}当前报告分支</span><strong>${esc(branch.label)} · ${esc(branch.instanceId)}</strong><span>${esc(buyers)} → ${esc(branch.strategy.id)} · ${esc(branch.strategy.name)} ${esc(branch.strategy.version)} · ${esc(model.run || '任务待补')}</span></div><span class="status-pill ${esc(branch.badgeTone)} no-dot">${esc(branch.badge)}</span></div>
      <div class="section-title-row"><div><h2>订单公共事实 → ${esc(branch.label)}独立链路</h2><p>${esc(scopeNote)}切换分支查看另一份报告。</p></div><span class="section-meta">${stageKeys.length} 个节点 · ${sharedCount} 个订单级 · 只读快照</span></div>
      <div class="trace-rail-wrap">
        <div class="trace-rail" role="group" aria-label="${esc(branch.label)}追溯链路">${stages}</div>
        <div class="trace-legend"><span><i></i>正常</span><span><i class="warn"></i>需关注</span><span><i class="error"></i>异常</span><span><i class="muted"></i>未发生</span><span>订单级节点 / 报告分支节点</span></div>
      </div>
      <div class="trace-detail-grid">
        <section class="panel stage-panel">
          <div class="stage-panel-head">
            <div class="stage-panel-title ${esc(stage.status)}"><span class="stage-icon">${icon(stage.icon)}</span><div><h3>${esc(stage.title)}</h3><p>${esc(stage.time || '—')} · ${esc(stageLabels[stage.status] || stage.status)}${isSharedStage(scenario, state.activeStage) ? ' · 订单级公共事实' : ' · 报告分支 · ' + esc(branch.instanceId)}</p></div></div>
            <span class="status-pill ${stage.status === 'ok' ? 'success' : stage.status === 'error' ? 'danger' : stage.status === 'muted' ? 'neutral' : 'warning'}">${esc(stageLabels[stage.status] || stage.status)}</span>
          </div>
          <p>${esc(stage.summary)}</p>
          <dl class="facts-grid">${facts}</dl>
          ${evidence ? `<div class="stage-evidence">${evidence}</div>` : ''}
          ${stage.note ? `<div class="stage-note${noteClass}">${ic(stage.status === 'warn' || stage.status === 'error' ? 'alertCircle' : 'info')}<span>${esc(stage.note)}</span></div>` : ''}
        </section>
        <aside class="panel judgement-panel">
          <h3>本节点判读原则</h3>
          <ul class="judgement-list">${judgments}</ul>
          <div class="config-block"><header><h3>本分支使用配置版本</h3><span class="status-pill info no-dot">固定快照</span></header><p>版本用于还原本分支事实，不用当前配置反推历史。</p>${config}</div>
        </aside>
      </div>
      <section class="panel timeline-panel">
        <header class="panel-head"><div><h3>${esc(branch.label)}追溯事件时间线</h3><p>来自 ${esc(branch.instanceId)} · 按发生时间排序</p></div><span class="status-pill ${esc(branch.badgeTone)} no-dot">${esc(branch.badge)}</span></header>
        <div class="event-timeline">${events}</div>
      </section>`;
  }

  function renderComparison(scenario) {
    const branches = branchesOf(scenario);
    const relation = scenario.branchRelation;
    const summaryValue = (branch, labels, fallback) => {
      const item = branch.downstream.summary.find((entry) => labels.includes(entry.label));
      return item ? item.value : fallback;
    };
    const rows = [
      ['分支来源 / 关系', () => relation ? `${relation.label} · ${relation.strategies.join(' / ')}` : '单一报告'],
      ['买家策略归属（报告生成前）', (branch) => `${branch.audience && branch.audience.buyers ? branch.audience.buyers.join(' / ') : branch.buyer} → ${branch.strategy.id} ${branch.strategy.version}`],
      ['独立模型任务', (branch) => {
        const model = branchModel(scenario, branch);
        return `${model.run || '待补'} · ${model.code || '—'} ${model.version || ''}`.trim();
      }],
      ['分支输入 / 候选标签', (branch) => {
        const model = branchModel(scenario, branch);
        return `${branchImages(scenario, branch).length} 图 · ${branchCandidates(scenario, branch).length} 个候选 · 阈值 ${model.threshold || '—'}`;
      }],
      ['策略选用标签', (branch) => (branch.selectedLabels || []).join(' · ') || branch.strategy.selected || '—'],
      ['报告实例 / 成色', (branch) => `${branch.instanceId} · ${branch.reportGrade}`],
      ['报告问题项', (branch) => (branch.issues || []).join(' · ') || '报告项待核'],
      ['规则链结论', (branch) => branch.quote.statusLabel],
      ['分支实际报价', (branch) => branch.amount || '未报价'],
      ['成交买家 / 报告归属', (branch) => `${summaryValue(branch, ['成交买家', '成交'], '未找到')} / ${summaryValue(branch, ['报告归属', '成交报告'], '待确认')}`],
      ['售后', (branch) => branch.downstream.afterSale ? branch.downstream.afterSale.status : branch.downstream.pendingDeal ? '待成交后关联' : '未找到']
    ];
    const evidenceLine = branches.map((branch) => {
      const model = branchModel(scenario, branch);
      return `${branch.label}：${model.run || '任务待补'} · ${branchImages(scenario, branch).length} 图 · ${branchCandidates(scenario, branch).length} 个候选`;
    }).join('；');
    const shareTitle = relation ? '每个报告分支独立保存 AI 输入、模型任务和候选标签' : '单份报告使用独立 AI 任务与候选证据';
    const shareNote = `${evidenceLine}。独立任务或输入导致的差异属于模型证据差异；从同一分支候选标签中选取不同标签属于策略选择差异，两类责任域分开判断。`;
    const head = branches.map((branch) => `<th><div class="compare-head"><strong>${esc(branch.label)}</strong><span>${esc(branch.instanceId)}</span><button class="panel-link" type="button" data-branch-jump="${esc(branch.id)}">查看分支${ic('chevronRight')}</button></div></th>`).join('');
    const body = rows.map(([label, value]) => `<tr><th scope="row">${esc(label)}</th>${branches.map((branch) => `<td>${esc(value(branch))}</td>`).join('')}</tr>`).join('');
    return `<section class="branch-share-card"><div>${ic('database')}<span><strong>${esc(shareTitle)}</strong><p>${esc(shareNote)}</p></span></div><span class="status-pill info no-dot">${relation ? '并行保留 · 不覆盖' : '独立证据'}</span></section>
      <div class="section-title-row"><div><h2>${esc(branches.map((branch) => branch.label).join(' / '))} 分支对比</h2><p>对比买家策略归属、独立模型任务、标签选择、报告和分支报价；金额不合并、不平均，也不跨成色档比较高低。</p></div><span class="section-meta">${branches.length} 个报告实例</span></div>
      <div class="table-wrap branch-compare-table"><table class="data-table"><thead><tr><th>比较维度</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
      <div class="branch-compare-notes"><div>${ic('info')}<span><strong>为什么必须分分支：</strong>每个买家先使用独立策略归属报告；各报告又可以拥有不同模型任务、输入、候选标签和阈值。把证据合成一张，会混淆模型输出差异、策略选择差异和单分支规则差异。</span></div><div>${ic('alertCircle')}<span><strong>成交归属规则：</strong>成交买家同步后，系统按“成交买家 → 其独立策略 → 对应报告实例”自动确定归属，再关联该报告下的报价尝试和售后。</span></div></div>`;
  }

  function renderConfig(config) {
    return `<div class="config-list">${config.map((item) => `<div class="config-row${item.changed ? ' changed' : ''}"><span>${esc(item.name)}</span><strong>${esc(item.used)}</strong>${item.changed ? `<em>当前 ${esc(item.current)} · 未参与本单${item.note ? ' · ' + esc(item.note) : ''}</em>` : item.note ? `<em>${esc(item.note)}</em>` : ''}</div>`).join('')}</div>`;
  }

  function renderQuote(scenario, branch) {
    const quote = branch.quote;
    const multiReport = branchesOf(scenario).length > 1;
    const buyers = branch.audience && branch.audience.buyers ? branch.audience.buyers.join(' / ') : branch.buyer;
    const model = branchModel(scenario, branch);
    const amount = quote.amountRaw == null ? '—' : quote.amount;
    const priceNote = quote.amountRaw == null ? '本分支未生成报价' : `${branch.label} · 分支唯一报价`;
    const rules = quote.rules.map((rule) => `<tr class="${rule.tone === 'danger' ? 'missed' : rule.hit && rule.tone === 'success' ? 'hit' : ''}"><td><span class="priority">${rule.priority}</span></td><td><span class="rule-id">${esc(rule.id)}</span><span class="rule-name">${esc(rule.name)}</span></td><td>${esc(rule.condition)}</td><td>${esc(rule.action)}</td><td><span class="status-pill ${esc(rule.tone)} no-dot">${esc(rule.result)}</span></td></tr>`).join('');
    const calc = quote.lines.length ? `${quote.lines.map((line) => `<div class="calc-line ${esc(line.kind)}"><span class="calc-label">${esc(line.label)}</span><span class="calc-amount">${line.amount < 0 ? '−' : ''}¥${Math.abs(line.amount).toLocaleString('zh-CN')}</span><span class="calc-source">${esc(line.source)}</span></div>`).join('')}<div class="calc-total"><span>本分支实际报价</span><div><strong>¥${esc(quote.total)}</strong><small>${esc(quote.totalNote)}</small></div></div>` : `<div class="empty-price">${ic('circleX')}<strong>未生成报价</strong><span>报价在扣减项匹配阶段终止，系统不生成推测金额或第二个价格。</span></div>`;
    const difference = quote.difference;
    return `<div class="branch-quote-banner"><div><span class="branch-kicker">${ic('gitBranch')}当前报告分支</span><strong>${esc(branch.label)} · ${esc(branch.instanceId)}</strong><span>${esc(buyers)} → ${esc(branch.strategy.id)} · ${esc(branch.strategy.name)} ${esc(branch.strategy.version)} · ${esc(model.run || '任务待补')}</span></div>${multiReport ? `<span class="branch-banner-note">仅展示当前分支报价，其他报告请切换分支或查看分支对比</span>` : ''}</div>
      <section class="single-price-card">
        <div><div class="single-price-label">${ic('receipt')}<span>${esc(priceNote)}</span></div><div class="single-price-value"><strong>${esc(amount)}</strong><span>${quote.amountRaw == null ? '未形成报价结果' : '买家实际报价 · 本次唯一报价对象'}</span></div><div class="single-price-sub">本页不展示应得报价、成本价、市场价、可比基准价或规则重算价，也不与其他报告分支的金额合并比较。</div></div>
        <div class="single-price-meta"><div><span>报价尝试</span><strong>${esc(quote.attempt)}</strong></div><div><span>买家策略归属</span><strong>${esc(buyers)} → ${esc(branch.strategy.id)}</strong></div><div><span>报告实例</span><strong>${esc(branch.instanceId)}</strong></div><div><span>规则链结论</span><span class="status-pill ${esc(quote.statusTone)} no-dot">${esc(quote.statusLabel)}</span></div></div>
      </section>
      <div class="quote-grid">
        <section class="panel">
          <header class="panel-head"><div><h3>规则命中与优先级</h3><p>先看应该命中哪条规则，再看实际命中哪条规则</p></div><span class="status-pill neutral no-dot">报价时配置</span></header>
          <div class="table-wrap"><table class="data-table rule-table"><thead><tr><th>优先级</th><th>规则</th><th>条件</th><th>取价 / 动作</th><th>结果</th></tr></thead><tbody>${rules}</tbody></table></div>
        </section>
        <section class="panel calc-panel">
          <header class="panel-head"><div><h3>计价凭证</h3><p>成色价与扣减金额是配置引用，不是第二报价</p></div>${ic('receipt')}</header>
          <div class="calc-body">${calc}</div>
        </section>
      </div>
      <section class="difference-panel${difference.good ? ' good' : ''}">
        <div class="difference-head">${ic(difference.good ? 'circleCheck' : 'alertCircle')}<div><strong>${esc(difference.title)}</strong><p>${esc(difference.description)}</p></div></div>
        <ul class="difference-list">${difference.items.map(([label, value]) => `<li><span>${esc(label)}</span><b>${esc(value)}</b></li>`).join('')}</ul>
      </section>
      <div class="quote-notes">${ic('info')}<span><strong>分支价格口径：</strong>每份报告、每个买家只保留一个实际报价。“成色 + 特定扣减项”命中后按其他成色价出价是合法能力；系统只还原当前报告分支的条件、规则优先级、实际价档和扣减/加价过程，不跨报告或跨成色档判断高低。</span></div>
      <section class="panel quote-config-panel"><header class="panel-head"><div><h3>${esc(branch.label)}配置版本对照</h3><p>本分支固定使用报价时版本；当前版本仅用于变更排查</p></div><span class="status-pill info no-dot">版本快照</span></header><div class="panel-body">${renderConfig(branch.config)}</div></section>`;
  }

  function renderEvidence(scenario, branch) {
    const images = branchImages(scenario, branch);
    const candidates = branchCandidates(scenario, branch);
    const model = branchModel(scenario, branch);
    const multiReport = branchesOf(scenario).length > 1;
    const audience = branch.audience && branch.audience.buyers ? branch.audience.buyers.join(' / ') : branch.buyer;
    const imageCards = images.map((image) => {
      const numeric = Number.parseFloat(image.confidence);
      const width = Number.isFinite(numeric) ? Math.max(3, Math.min(100, numeric * 100)) : 0;
      return `<article class="evidence-card"><div class="evidence-visual">${phoneIllustration(image)}<span class="evidence-badge">${esc(image.meta)}</span><button class="evidence-expand" type="button" data-image="${esc(image.id)}" aria-label="查看${esc(image.title)}大图">${ic('eye')}</button></div><div class="evidence-card-copy"><header><strong>${esc(image.title)}</strong><span class="status-pill ${numeric >= 0.65 ? 'success' : 'neutral'} no-dot">${esc(image.confidence)}</span></header><p>${esc(image.subtitle)}</p><footer><span>${esc(image.marker)}</span><span class="confidence"><span class="confidence-bar"><span style="width:${width}%"></span></span>${esc(image.confidence)}</span></footer></div></article>`;
    }).join('');
    const candidateRows = candidates.length ? candidates.map((item) => {
      const numeric = Number.parseFloat(item.confidence);
      const width = Number.isFinite(numeric) ? Math.max(3, Math.min(100, numeric * 100)) : 0;
      const selected = branch.selectedLabels ? branch.selectedLabels.includes(item.label) : item.accepted;
      const decision = !item.accepted ? item.reason : selected ? '本分支采用' : '本分支策略未选取';
      return `<tr class="${selected ? '' : 'filtered'}"><td class="label-name">${esc(item.label)}</td><td>${esc(item.type)}</td><td><span class="confidence-cell"><span class="confidence-bar"><span style="width:${width}%"></span></span><b>${esc(item.confidence.toFixed(2))}</b></span></td><td><span class="threshold-pill">≥ ${esc(item.threshold.toFixed(2))}</span></td><td><span class="accept-state${selected ? '' : ' filtered'}">${ic(selected ? 'circleCheck' : 'minus')}${esc(decision)}</span></td></tr>`;
    }).join('') : '';
    const candidateTable = candidates.length
      ? `<div class="table-wrap"><table class="data-table confidence-table"><thead><tr><th>候选标签</th><th>标签类型</th><th>原始置信度</th><th>采纳阈值</th><th>本分支决策</th></tr></thead><tbody>${candidateRows}</tbody></table></div>`
      : `<div class="missing-evidence">${ic('fileWarning')}<strong>原始标签与候选快照缺失</strong><p>当前只保留图片文件和最终报告，无法还原标签类型、原始置信度、阈值和过滤原因。此缺口会阻断对报告条件完整性的确认。</p></div>`;
    const mappingList = branch.mappings.length ? branch.mappings.map((item) => `<div class="mapping-item${item.filtered ? ' filtered' : ''}"><div class="mapping-node"><span>${esc(branch.label)}原始标签</span><strong>${esc(item.source)}</strong></div><span class="mapping-arrow">${ic('chevronRight')}</span><div class="mapping-node"><span>标签类型</span><strong>${esc(item.type)}</strong></div><span class="mapping-arrow">${ic('chevronRight')}</span><div class="mapping-node"><span>业务选项 / 严重度</span><strong>${esc(item.option)}<br>${esc(item.severity)}</strong></div><span class="mapping-arrow">${ic('chevronRight')}</span><div class="mapping-node report"><span>${esc(branch.label)}输出</span><strong>${esc(item.report)}</strong></div></div>`).join('') : `<div class="missing-evidence">${ic('gitBranch')}<strong>映射决策路径缺失</strong><p>无法连接源标签和报告项，不能用当前映射配置补造历史路径。</p></div>`;
    return `<div class="branch-quote-banner"><div><span class="branch-kicker">${ic('gitBranch')}当前报告分支</span><strong>${esc(branch.label)} · ${esc(branch.instanceId)}</strong><span>${esc(branch.strategy.id)} · ${esc(branch.strategy.name)} ${esc(branch.strategy.version)}</span></div><span class="status-pill ${esc(branch.badgeTone)} no-dot">${esc(branch.badge)}</span></div>
      <div class="evidence-intro"><div>${ic('image')}<span><strong>${esc(branch.label)}独立 AI 输入 + 策略选择与映射</strong><p>${multiReport ? '本页只展示当前报告分支的图片、模型任务、候选标签和阈值；其他报告分支可能使用不同任务与输出。' : '本页展示该报告实例对应的图片、模型任务、候选标签和阈值。'}“本分支采用”只代表买家策略从本分支候选标签中的选择。</p></span></div><span class="status-pill ${branch.completenessPct === 100 ? 'success' : 'warning'} no-dot">${esc(branch.completenessText)}</span></div>
      <div class="evidence-grid">${imageCards}</div>
      <div class="evidence-lower">
        <section class="panel"><header class="panel-head"><div><h3>候选标签观测</h3><p>${esc(branch.label)}独立候选；最后一列显示该分支买家策略是否采用</p></div><span class="status-pill neutral no-dot">${candidates.length || 0} 条</span></header>${candidateTable}</section>
        <aside class="panel model-panel"><h3>模型与阈值上下文</h3><dl class="model-list"><div><dt>策略买家组</dt><dd>${esc(audience)}</dd></div><div><dt>买家策略</dt><dd>${esc(branch.strategy.id)} · ${esc(branch.strategy.version)}</dd></div><div><dt>模型 code</dt><dd>${esc(model.code || '—')}</dd></div><div><dt>模型版本</dt><dd>${esc(model.version || '—')}</dd></div><div><dt>任务 run_id</dt><dd>${esc(model.run || '—')}</dd></div><div><dt>采纳阈值</dt><dd>${esc(model.threshold || '—')}</dd></div><div><dt>输入摘要</dt><dd>${esc(model.input || '—')}</dd></div><div><dt>图片质量</dt><dd>${esc(model.quality || '—')}</dd></div></dl></aside>
      </div>
      <section class="panel mapping-section"><header class="panel-head"><div><h3>${esc(branch.label)}：标签到报告的映射证据</h3><p>本分支原始标签 → 标签类型 → 业务选项/严重度 → 当前分支报告输出</p></div><span class="status-pill neutral no-dot">${esc(branch.strategy.id)} · MAP 快照</span></header><div class="panel-body"><div class="mapping-list">${mappingList}</div></div></section>
      <div class="stage-note">${ic('info')}<span>阈值调整在 P1 只做建议与只读模拟；分数校准在 P2 评估，模型重训不在本方案范围。任何阶段都不会由追溯系统自动修改模型或配置。</span></div>`;
  }

  function renderDownstream(scenario, branch) {
    const data = branch.downstream;
    const buyers = branch.audience && branch.audience.buyers ? branch.audience.buyers.join(' / ') : branch.buyer;
    const summary = `<div class="downstream-summary">${data.summary.map((item) => `<div><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong><small>${esc(item.note)}</small></div>`).join('')}</div>`;
    if (!data.events.length && !data.afterSale) {
      return `${summary}<div class="empty-downstream">${ic('packageCheck')}<strong>未找到成交与售后事件</strong><p>${esc(data.note)}</p></div><div class="p1-boundary">${ic('info')}<span>证据不完整时，P0 不推断“未成交”或“无售后”，只展示“未找到事件”。后续是否补证由运营或数据负责人处理。</span></div>`;
    }
    const events = data.events.map(([time, title, description, status]) => `<div class="downstream-event"><span class="downstream-time">${esc(time)}</span><span class="downstream-line"><i class="downstream-dot ${esc(status)}"></i></span><div class="downstream-copy"><strong>${esc(title)}</strong><p>${esc(description)}</p></div></div>`).join('');
    const side = data.afterSale
      ? `<aside class="panel after-sale-card"><header><div><h3>售后案件 ${esc(data.afterSale.id)}</h3><p class="single-price-sub">${esc(data.afterSale.buyer)}</p></div><span class="status-pill warning no-dot">${esc(data.afterSale.status)}</span></header><p>${esc(data.afterSale.issue)}</p><div class="after-sale-facts"><div><span>金额影响</span><strong>${esc(data.afterSale.impact)}</strong></div><div><span>当前负责人</span><strong>${esc(data.afterSale.owner)}</strong></div><div><span>处理状态</span><strong>${esc(data.afterSale.status)}</strong></div></div></aside>`
      : data.pendingDeal
      ? `<aside class="panel after-sale-card"><header><div><h3>成交后报告归属</h3><p class="single-price-sub">由成交买家自动反查</p></div><span class="status-pill neutral no-dot">待成交</span></header><p>${esc(data.note)}</p><div class="after-sale-facts"><div><span>归属路径</span><strong>成交买家 → 独立策略 → 报告</strong></div><div><span>报告回写</span><strong>不改写原报告</strong></div><div><span>售后关联</span><strong>绑定归属报告</strong></div></div></aside>`
      : `<aside class="panel after-sale-card"><header><div><h3>售后状态</h3><p class="single-price-sub">成交后结果</p></div><span class="status-pill success no-dot">无售后</span></header><p>${esc(data.note)}</p><div class="after-sale-facts"><div><span>报告回写</span><strong>不改写原报告</strong></div><div><span>报价回写</span><strong>不重算原报价</strong></div><div><span>责任判定</span><strong>不在 P0 自动归因</strong></div></div></aside>`;
    return `<div class="branch-quote-banner"><div><span class="branch-kicker">${ic('gitBranch')}当前报告分支</span><strong>${esc(branch.label)} · ${esc(branch.instanceId)}</strong><span>${esc(buyers)} → ${esc(branch.strategy.id)} · ${esc(branch.strategy.name)} ${esc(branch.strategy.version)}</span></div><span class="status-pill ${esc(branch.badgeTone)} no-dot">${esc(branch.badge)}</span></div>${summary}<div class="downstream-grid"><section class="panel"><header class="panel-head"><div><h3>${esc(branch.label)} 成交与售后时间线</h3><p>只关联当前报告实例的结果，不改变交易状态</p></div><span class="status-pill info no-dot">P0 摘要</span></header><div class="panel-body downstream-timeline">${events}</div></section>${side}</div><div class="p1-boundary">${ic('sparkles')}<span><strong>P1 延展：</strong>将复检结果、售后差异和成交前报告按报告实例做结构化归因，形成责任域、问题聚类与策略建议；P0 仅保留可追溯的证据和结果摘要。</span></div><div class="stage-note">${ic('info')}<span>${esc(data.note)}</span></div>`;
  }

  function phoneIllustration(image, modal) {
    const angle = image.angle || 'front';
    const uid = `phone-${String(image.id).replace(/[^a-z0-9-]/gi, '')}-${modal ? 'modal' : 'card'}-${Math.random().toString(36).slice(2, 6)}`;
    const transforms = { front: 'translate(105 11) rotate(4 53 78)', back: 'translate(106 11) rotate(-5 53 78)', screen: 'translate(105 11) rotate(3 53 78)', frame: 'translate(151 14) rotate(9 16 74)' };
    const markers = { front: [160, 72], back: [162, 70], screen: [160, 77], frame: [205, 87] };
    const marker = markers[angle] || markers.front;
    let body = '';
    if (angle === 'frame') {
      body = `<g transform="${transforms.frame}"><rect x="40" y="0" width="30" height="150" rx="13" fill="#29343d" stroke="#56636d" stroke-width="1.2"/><rect x="46" y="9" width="18" height="34" rx="7" fill="#35434e"/><path d="M48 65h14M48 76h14M48 87h14" stroke="#74818a" stroke-width="2" stroke-linecap="round" opacity=".55"/><circle cx="55" cy="126" r="4" fill="#65737d"/></g>`;
    } else if (angle === 'back') {
      body = `<g transform="${transforms.back}"><rect x="4" y="0" width="102" height="156" rx="17" fill="#202b33" stroke="#55636d" stroke-width="1.3"/><rect x="11" y="9" width="88" height="138" rx="12" fill="url(#${uid}-back)" stroke="#67747d" stroke-width=".7"/><rect x="22" y="19" width="43" height="39" rx="10" fill="#1d272e" stroke="#56636c" stroke-width="1"/><circle cx="34" cy="31" r="6" fill="#0d151a" stroke="#89959d" stroke-width="1"/><circle cx="52" cy="31" r="6" fill="#0d151a" stroke="#89959d" stroke-width="1"/><circle cx="34" cy="47" r="5" fill="#161e24" stroke="#76838b" stroke-width=".8"/><circle cx="53" cy="48" r="3" fill="#b8c0c5" opacity=".45"/><path d="M25 105c14-12 28-12 42 0s25 10 30-2" fill="none" stroke="#7d8990" stroke-width="1" opacity=".3"/><rect x="35" y="132" width="40" height="3" rx="1.5" fill="#7a858b" opacity=".35"/></g>`;
    } else {
      body = `<g transform="${transforms[angle] || transforms.front}"><rect x="4" y="0" width="102" height="156" rx="17" fill="#1c262e" stroke="#5a6670" stroke-width="1.3"/><rect x="8" y="4" width="94" height="148" rx="14" fill="url(#${uid}-screen)"/><circle cx="55" cy="11" r="2.2" fill="#10171d"/><rect x="40" y="7" width="30" height="3" rx="1.5" fill="#11191f"/><path d="M22 30c18-10 42-8 61 3" fill="none" stroke="#b4d5d2" stroke-width="1" opacity=".2"/><path d="M20 119c25-18 56-16 72 2" fill="none" stroke="#86b9b3" stroke-width="1" opacity=".16"/><rect x="43" y="147" width="24" height="2" rx="1" fill="#aab5b9" opacity=".35"/>${angle === 'screen' ? `<circle cx="38" cy="100" r="21" fill="url(#${uid}-scorch)" opacity=".72"/><path d="M25 114c10-12 19-9 28-18" fill="none" stroke="#c99a6e" stroke-width="1.2" opacity=".55"/>` : ''}</g>`;
    }
    return `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(image.title)}演示图">
      <defs>
        <linearGradient id="${uid}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8e1e4"/><stop offset=".55" stop-color="#bdcbd0"/><stop offset="1" stop-color="#9fb2b9"/></linearGradient>
        <linearGradient id="${uid}-screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f3d46"/><stop offset=".5" stop-color="#1a242b"/><stop offset="1" stop-color="#303b42"/></linearGradient>
        <linearGradient id="${uid}-back" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#aab4b8"/><stop offset=".5" stop-color="#858f94"/><stop offset="1" stop-color="#59646a"/></linearGradient>
        <radialGradient id="${uid}-scorch"><stop offset="0" stop-color="#e0b178" stop-opacity=".7"/><stop offset=".45" stop-color="#ba7a4d" stop-opacity=".32"/><stop offset="1" stop-color="#6f4c39" stop-opacity="0"/></radialGradient>
        <filter id="${uid}-blur"><feGaussianBlur stdDeviation="12"/></filter>
      </defs>
      <rect width="320" height="180" fill="url(#${uid}-bg)"/>
      <circle cx="270" cy="31" r="44" fill="#f7f2df" opacity=".24" filter="url(#${uid}-blur)"/>
      <path d="M0 151c55-18 95-12 140 5s104 13 180-13v37H0z" fill="#7e929a" opacity=".16"/>
      <path d="M0 156c62-14 101-6 151 8s101 10 169-10" fill="none" stroke="#eef2f3" stroke-width="1" opacity=".5"/>
      <ellipse cx="164" cy="169" rx="74" ry="10" fill="#1d2a31" opacity=".2" filter="url(#${uid}-blur)"/>
      ${body}
      <g transform="translate(${marker[0]} ${marker[1]})"><circle r="24" fill="none" stroke="#5ed6c8" stroke-width="1.2" opacity=".85"/><circle r="14" fill="none" stroke="#5ed6c8" stroke-width="1" opacity=".55"/><circle r="3.4" fill="#68e0d1"/><path d="M24 0h25" stroke="#5ed6c8" stroke-width="1" opacity=".9"/></g>
    </svg>`;
  }

  function openEvidenceModal(imageId) {
    const scenario = getScenario(state.activeScenarioId);
    const branch = getBranch(scenario, state.activeBranchId);
    const image = branchImages(scenario, branch).find((item) => item.id === imageId);
    if (!image) return;
    const model = branchModel(scenario, branch);
    openModal(`<div class="modal-head"><div><h2 id="modalTitle">${esc(image.title)}</h2><p>${esc(scenario.orderNo)} · ${esc(branch.label)} · ${esc(model.run || '')} · ${esc(image.meta)}</p></div><button class="modal-close" type="button" data-close-modal aria-label="关闭">${ic('x')}</button></div><div class="modal-body"><div class="evidence-modal-visual">${phoneIllustration(image, true)}</div><div class="evidence-modal-meta"><div><span>报告分支</span><strong>${esc(branch.label)} · ${esc(branch.instanceId)}</strong></div><div><span>证据区域</span><strong>${esc(image.marker)}</strong></div><div><span>候选置信度</span><strong>${esc(image.confidence)}</strong></div><div><span>证据说明</span><strong>${esc(image.subtitle)}</strong></div></div><div class="stage-note">${ic('info')}<span>演示图片只用于说明证据查看交互，不代表真实设备或真实用户数据。正式实现需按图片权限控制访问并记录查看日志。</span></div></div>`);
  }

  function openP1Modal(initialTab) {
    state.p1Tab = initialTab === 'threshold' ? 'threshold' : 'strategy';
    openModal(`<div class="modal-head"><div><h2 id="modalTitle">策略与阈值建议 · P1 延展预览</h2><p>展示追溯链如何从单笔排查走向配置优化，不包含在本期 P0 交付</p></div><button class="modal-close" type="button" data-close-modal aria-label="关闭">${ic('x')}</button></div><div class="modal-body"><div class="p1-banner">${ic('sparkles')}<div><strong>只读预览，不自动修改任何配置或模型</strong><p>P1 只输出建议、证据样本和模拟方案；执行仍需运营或模型平台按原审批流程发布，P2 才接入变更单和对照验证。</p></div></div><div class="p1-tabs"><button class="p1-tab" type="button" data-p1-tab="strategy">运营策略建议</button><button class="p1-tab" type="button" data-p1-tab="threshold">置信度阈值建议</button></div><div class="p1-content" id="p1Content"></div></div>`);
    renderP1Content();
  }

  function renderP1Content() {
    const container = $('#p1Content');
    if (!container) return;
    $$('.p1-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.p1Tab === state.p1Tab));
    const recommendations = state.p1Tab === 'threshold' ? [
      { title: '候选标签采纳阈值 0.65 → 0.72', desc: '对屏幕类标签做分层观察，重点看低于当前阈值但被后续复检证实的候选。建议先在新增订单上做只读模拟，不直接发布。', meta: ['样本 120 单', '分层抽样 40 单', '模拟假设待验证'], tone: 'info' },
      { title: '保持摄像头类标签阈值 0.65', desc: '当前样本中摄像头标签的证据完整度较高，暂不建议调整；继续观察低置信样本与误采纳率。', meta: ['样本 86 单', '证据完整度 98%', '继续观察'], tone: 'success' },
      { title: '主板维修相关标签单独复核', desc: '主板问题可能无法从外观图片直接识别，当前样本不足以支持阈值调整。建议由质量团队补充复检真值后再评估。', meta: ['样本 18 单', '样本不足', '待补真值'], tone: 'warning' }
    ] : [
      { title: '复核双报告策略的标签选择边界', desc: '同一订单的两个运营策略可能选择不同 AI 标签并生成不同成色。建议先核对策略适用范围、互斥关系和标签选择规则，再用新增订单做只读模拟。', meta: ['涉及 2 份报告', '标签选择不同', '需运营确认'], tone: 'warning' },
      { title: '提高专项价格规则 PR-0904 优先级', desc: '“中花 + 屏幕划痕”专项规则应优先于通用成色规则。建议按报告实例核对同类规则排序，再用新增订单做只读模拟，避免影响其他买家分支。', meta: ['分支 B', '差异：专项规则未命中', '高优先级'], tone: 'danger' },
      { title: '补齐买家 B-201 的扣减项 D-035', desc: '后摄像头异常在报告中存在，但目标买家价格配置缺少对应扣减项。建议由运营补齐配置，并复核对未报价的连带影响。', meta: ['涉及 4 单', '缺扣减配置', '需运营确认'], tone: 'warning' },
      { title: '为屏幕映射补充严重度', desc: '部分标签映射缺少严重度，导致报告生成成功但扣减来源不完整。建议补齐严重度并验证从标签到报告项的链路。', meta: ['涉及 3 单', '映射配置缺口', '中优先级'], tone: 'info' }
    ];
    container.innerHTML = `<div>${recommendations.map((item) => `<article class="recommendation"><div><h3>${esc(item.title)}</h3><p>${esc(item.desc)}</p></div><span class="status-pill ${esc(item.tone)} no-dot">P1 建议</span><div class="recommendation-meta">${item.meta.map((meta) => `<span>${esc(meta)}</span>`).join('')}</div></article>`).join('')}</div><p class="p1-note">以上为交互预览中的脱敏样例，不代表正式分析结论。P1 正式建议必须展示样本量、证据等级、影响面、风险和验证方案；P2 才关联变更单、审批、对照实验和回退结果。</p>`;
  }

  function openHelpModal() {
    openModal(`<div class="modal-head"><div><h2 id="modalTitle">P0 追溯口径</h2><p>先锁定报告实例，再解释当前报告内的规则、买家报价与证据；系统不评价跨报告的绝对高低</p></div><button class="modal-close" type="button" data-close-modal aria-label="关闭">${ic('x')}</button></div><div class="modal-body"><div class="p1-banner">${ic('info')}<div><strong>一行一份报告，同单多报告并行保留</strong><p>报告台账按报告实例展示，不按订单合并。每个买家独立配置策略，策略在报告生成前决定哪些买家使用该报告；同一策略可绑定多个买家，但每位买家的已报价/未报价结果分别保留。</p></div></div><div class="scope-compare"><article><h3>支持</h3><p>当前报告已经形成的实际报价，能够由报告条件、命中规则、实际取用价档和计价明细完整解释。成色与专项扣减项命中后跨档取价属于合法业务。报告行同时展示该策略买家组内是否有未报价买家。</p></article><article><h3>不支持</h3><p>当前报告的实际报价与规则条件、优先级、实际价档或计价明细不一致。其他报告分支报价正常，不能抵消这个差异。</p></article><article><h3>未报价 / 待补证</h3><p>报告没有任何有效报价时标为“未报价”；缺少关键快照、无法判断规则链时标为“待补证”。买家级未报价在详情买家矩阵展开，不等同于整份报告未报价。</p></article></div><div class="quote-notes">${ic('alertCircle')}<span><strong>价格边界：</strong>只展示买家实际报价，不使用其他报告分支金额、其他买家报价、历史成交、市场价、成本价、规则重算价或不同成色档的绝对价格作为自动高低基准。</span></div></div>`);
  }

  function openModal(contentHtml) {
    const root = $('#modalRoot');
    const content = $('#modalContent');
    state.lastFocus = document.activeElement;
    content.innerHTML = contentHtml;
    root.hidden = false;
    state.modalOpen = true;
    document.body.style.overflow = 'hidden';
    const close = $('[data-close-modal]', content);
    if (close) close.focus({ preventScroll: true });
    window.hydrateIcons(content);
  }

  function closeModal() {
    const root = $('#modalRoot');
    if (!state.modalOpen) return;
    root.hidden = true;
    $('#modalContent').innerHTML = '';
    state.modalOpen = false;
    document.body.style.overflow = state.drawerOpen ? 'hidden' : '';
    if (state.lastFocus && typeof state.lastFocus.focus === 'function') state.lastFocus.focus({ preventScroll: true });
  }

  function showToast(message, type) {
    const stack = $('#toastStack');
    const toast = document.createElement('div');
    toast.className = `toast${type === 'error' ? ' error' : ''}`;
    toast.innerHTML = `${ic(type === 'error' ? 'alertCircle' : 'circleCheck')}<span>${esc(message)}</span>`;
    stack.appendChild(toast);
    window.setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      window.setTimeout(() => toast.remove(), 180);
    }, 2600);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      showToast('已复制到剪贴板');
    } catch (error) {
      showToast('复制失败，请手动选择文本', 'error');
    }
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 500);
  }

  function exportOverviewCsv() {
    const rows = visibleReportRows();
    if (!rows.length) {
      showToast('当前筛选下没有可导出的报告', 'error');
      return;
    }
    const header = ['订单号', '设备', '门店', '渠道', '报告实例', '报告 ID / 版本', '买家策略', '策略买家组', '模型任务', 'run_id', '报告成色 / 问题项', '已报价买家 / 实际报价', '未报价买家 / 原因', '成交与售后', '链路结论', '证据完整度'];
    const lines = rows.map(({ scenario, branch, conclusion }) => {
      const model = branchModel(scenario, branch);
      const strategy = branchStrategy(scenario, branch);
      const audience = branchAudience(scenario, branch);
      const buyerRows = branchBuyerRows(scenario, branch);
      const downstream = branchDownstream(scenario, branch);
      const quoted = buyerRows.filter((row) => row.status === 'quoted').map((row) => `${row.buyer} ${row.amount}（${row.rule}）`).join(' / ');
      const unquoted = buyerRows.filter((row) => row.status === 'unquoted').map((row) => `${row.buyer}（${row.reason}）`).join(' / ');
      const afterSale = downstream.afterSale;
      return [
        scenario.orderNo,
        `${scenario.device} ${scenario.specs}`,
        scenario.store,
        scenario.channel,
        `${branch.label} ${branch.instanceId}`,
        `${branchReportId(scenario, branch)} ${branchReportVersion(scenario, branch)}`,
        `${strategy.id} ${strategy.version} · ${strategy.name}`,
        audience.buyers.join(' / '),
        model.code || '待补',
        model.run || '待补',
        `${branch.reportGrade}：${(branch.issues || []).join('、')}`,
        quoted || '—',
        unquoted || '—',
        afterSale ? `${afterSale.id} · ${afterSale.status}` : '无售后/待关联',
        `${conclusion.label} · ${conclusion.detail}`,
        `${branch.completenessText} ${branch.completenessPct}%`
      ];
    });
    const csv = '\ufeff' + [header, ...lines].map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    downloadFile('ai-report-ledger-demo.csv', csv, 'text/csv;charset=utf-8');
    showToast('已导出当前报告台账的脱敏演示数据');
  }

  function exportEvidenceJson() {
    const scenario = getScenario(state.activeScenarioId);
    const branches = branchesOf(scenario);
    const pack = {
      notice: '脱敏演示证据包，仅用于 Gate 2 原型评审，不代表真实订单或生产数据。',
      trace_id: scenario.traceId,
      order: { order_no: scenario.orderNo, device: scenario.device, specs: scenario.specs, store: scenario.store, channel: scenario.channel, time: scenario.time },
      report_count: branches.length,
      branch_relationship: scenario.branchRelation || null,
      order_evidence: {
        stages: scenario.sharedStages || {},
        buyer_strategy_assignments: branches.map((branch) => ({
          buyers: branch.audience && branch.audience.buyers ? branch.audience.buyers : [branch.buyer],
          strategy_id: branch.strategy.id,
          strategy_version: branch.strategy.version,
          report_instance_id: branch.instanceId
        }))
      },
      report_branches: branches.map((branch) => ({
        branch_id: branch.id,
        report_instance_id: branch.instanceId,
        audience: branch.audience || null,
        strategy: branch.strategy,
        model: branchModel(scenario, branch),
        images: branchImages(scenario, branch).map(({ id, title, meta, confidence }) => ({ id, title, meta, confidence })),
        candidates: branchCandidates(scenario, branch),
        report: { grade: branch.reportGrade, issues: branch.issues },
        selected_labels: branch.selectedLabels || [],
        mappings: branch.mappings,
        quote: { actual_amount: branch.amountValue, amount_display: branch.amount, status: branch.quote.statusLabel, rules: branch.quote.rules, calculation: branch.quote.lines, difference: branch.quote.difference },
        downstream: branch.downstream,
        config_versions: branch.config,
        stages: branch.stages || {}
      }))
    };
    downloadFile(`trace-${scenario.orderNo}-demo.json`, JSON.stringify(pack, null, 2), 'application/json;charset=utf-8');
    showToast('已导出脱敏证据包');
  }

  function copyCurrentSummary() {
    const scenario = getScenario(state.activeScenarioId);
    const branch = getBranch(scenario, state.activeBranchId);
    copyReportSummary(scenario, branch);
  }

  function copyReportSummary(scenario, branch) {
    const model = branchModel(scenario, branch);
    const strategy = branchStrategy(scenario, branch);
    const audience = branchAudience(scenario, branch);
    const buyerRows = branchBuyerRows(scenario, branch);
    const buyerText = buyerRows.map((row) => `${row.buyer}：${row.status === 'quoted' ? row.amount : `未报价（${row.reason}）`}`).join('；');
    const conclusion = branchConclusion(scenario, branch);
    const text = `【${scenario.orderNo}】${scenario.device} ${scenario.specs}\ntrace_id：${scenario.traceId}\n报告实例：${branch.label} · ${branch.instanceId} · ${branchReportVersion(scenario, branch)}\n买家策略归属：${audience.buyers.join('、')} → ${strategy.id} · ${strategy.name} ${strategy.version}\nAI 任务：${model.run || '待补'} · ${model.code || '—'} · ${model.input || '输入待补'}\nAI 报告：${branch.reportGrade} / ${branch.issues.join('、')}\n报价买家：${buyerText || '待补'}\n结论：${conclusion.label} · ${conclusion.detail}\n${branch.verdict.title}`;
    copyText(text);
  }

  function closeSidebar() {
    const sidebar = $('#sidebar');
    const overlay = $('#sidebarOverlay');
    const menu = $('#mobileMenu');
    if (!sidebar) return;
    sidebar.classList.remove('open');
    overlay.hidden = true;
    menu.setAttribute('aria-expanded', 'false');
  }

  function openSidebar() {
    const sidebar = $('#sidebar');
    const overlay = $('#sidebarOverlay');
    const menu = $('#mobileMenu');
    sidebar.classList.add('open');
    overlay.hidden = false;
    menu.setAttribute('aria-expanded', 'true');
  }

  function applyHash() {
    const raw = window.location.hash.replace(/^#/, '');
    if (raw.startsWith('trace/')) {
      const [idPart, branchPart] = raw.slice(6).split('/');
      const id = decodeURIComponent(idPart);
      const branchId = branchPart ? decodeURIComponent(branchPart) : null;
      if (scenarios.some((item) => item.id === id)) {
        showScenario(id, branchId);
        return;
      }
    }
    if (raw.startsWith('report/')) {
      const [idPart, branchPart] = raw.slice(7).split('/');
      const id = decodeURIComponent(idPart || '');
      const branchId = decodeURIComponent(branchPart || '');
      if (scenarios.some((item) => item.id === id)) {
        openReportDrawer(id, branchId || defaultBranchId(getScenario(id)));
        return;
      }
    }
    if (!raw) {
      history.replaceState(null, '', '#overview');
    }
    showOverviewView();
  }

  function bindEvents() {
    $$('.side-nav [data-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        state.filter = button.dataset.filter;
        state.queueQuery = '';
        $('#queueSearch').value = '';
        renderQueue();
        if (!$('#detailView').hidden) navigateOverview();
        else {
          renderOverview();
          closeSidebar();
        }
      });
    });

    $$('#queueFilters [data-queue-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        state.filter = button.dataset.queueFilter;
        renderQueue();
      });
    });

    $('#queueSearch').addEventListener('input', (event) => {
      state.queueQuery = event.target.value;
      renderQueue();
    });

    $('#ledgerModel').addEventListener('change', (event) => {
      state.ledgerModel = event.target.value;
      renderQueue();
    });

    $('#ledgerAftersale').addEventListener('change', (event) => {
      state.ledgerAftersale = event.target.value;
      renderQueue();
    });

    $('#globalSearch').addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const query = event.target.value.trim().toLowerCase();
      if (!query) return;
      const found = allReportRows().find((row) => reportRowSearchText(row).includes(query));
      if (found) navigateToReport(found.scenario.id, found.branch.id);
      else showToast('未找到匹配的演示订单，试试订单号、设备或 trace_id', 'error');
    });

    $('#backToOverview').addEventListener('click', navigateOverview);
    $('#copyTraceId').addEventListener('click', () => copyText(getScenario(state.activeScenarioId).traceId));
    $('#copySummary').addEventListener('click', copyCurrentSummary);
    $('#exportEvidence').addEventListener('click', exportEvidenceJson);
    $('#exportOverview').addEventListener('click', exportOverviewCsv);
    $('#queueHelp').addEventListener('click', openHelpModal);

    $('#caseSwitcher').addEventListener('click', (event) => {
      const button = event.target.closest('[data-case]');
      if (button) navigateToScenario(button.dataset.case);
    });

    $('#branchOverview').addEventListener('click', (event) => {
      const button = event.target.closest('[data-branch]');
      if (!button) return;
      state.activeBranchId = button.dataset.branch;
      renderDetail(getScenario(state.activeScenarioId));
    });

    $('.detail-tabs').addEventListener('click', (event) => {
      const tab = event.target.closest('[data-detail-tab]');
      if (!tab) return;
      state.activeTab = tab.dataset.detailTab;
      renderTab();
    });

    $('.detail-tabs').addEventListener('keydown', (event) => {
      const tab = event.target.closest('[data-detail-tab]');
      if (!tab || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const tabs = $$('.detail-tab:not([hidden])');
      const index = tabs.indexOf(tab);
      const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      state.activeTab = next.dataset.detailTab;
      renderTab();
      next.focus();
    });

    $('#tabContent').addEventListener('click', (event) => {
      const branchJump = event.target.closest('[data-branch-jump]');
      if (branchJump) {
        state.activeBranchId = branchJump.dataset.branchJump;
        state.activeTab = 'chain';
        state.activeStage = 'report';
        renderDetail(getScenario(state.activeScenarioId));
        return;
      }
      const stageButton = event.target.closest('[data-stage]');
      if (stageButton) {
        state.activeStage = stageButton.dataset.stage;
        renderTab();
        window.requestAnimationFrame(() => {
          const next = $('[data-stage="' + state.activeStage + '"]', $('#tabContent'));
          if (next) next.focus({ preventScroll: true });
        });
        return;
      }
      const imageButton = event.target.closest('[data-image]');
      if (imageButton) openEvidenceModal(imageButton.dataset.image);
    });

    $$('[data-open-p1]').forEach((button) => {
      button.addEventListener('click', () => { closeSidebar(); openP1Modal(button.dataset.openP1); });
    });

    $('#mobileMenu').addEventListener('click', () => {
      const sidebar = $('#sidebar');
      if (sidebar.classList.contains('open')) closeSidebar();
      else openSidebar();
    });
    $('#sidebarOverlay').addEventListener('click', closeSidebar);

    $('#drawerBackdrop').addEventListener('click', () => closeReportDrawer(true));
    $('#drawerContent').addEventListener('click', (event) => {
      if (event.target.closest('[data-close-drawer]')) {
        closeReportDrawer(true);
        return;
      }
      const copyButton = event.target.closest('[data-copy-report]');
      if (copyButton && state.drawerKey) {
        const [scenarioId, branchId] = state.drawerKey.split(':');
        const scenario = getScenario(scenarioId);
        if (scenario) copyReportSummary(scenario, getBranch(scenario, branchId));
        return;
      }
      const sibling = event.target.closest('[data-sibling-report]');
      if (sibling) {
        const [scenarioId, branchId] = sibling.dataset.siblingReport.split(':');
        navigateToReport(scenarioId, branchId);
        return;
      }
      const fullTrace = event.target.closest('[data-full-trace]');
      if (fullTrace) {
        const [scenarioId, branchId] = fullTrace.dataset.fullTrace.split(':');
        closeReportDrawer(false);
        navigateToScenario(scenarioId, branchId);
      }
    });

    $('#modalRoot').addEventListener('click', (event) => {
      if (event.target === $('#modalRoot')) closeModal();
      const close = event.target.closest('[data-close-modal]');
      if (close) closeModal();
      const p1Tab = event.target.closest('[data-p1-tab]');
      if (p1Tab) {
        state.p1Tab = p1Tab.dataset.p1Tab;
        renderP1Content();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (state.modalOpen) closeModal();
        else if (state.drawerOpen) closeReportDrawer(true);
        else closeSidebar();
      }
      if (event.key !== 'Tab' || !state.drawerOpen || state.modalOpen) return;
      const focusRoot = $('#drawerContent');
      const focusable = $$('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])', focusRoot)
        .filter((node) => !node.hidden && node.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 860) closeSidebar();
    });
    window.addEventListener('hashchange', applyHash);
  }

  function init() {
    window.hydrateIcons(document);
    bindEvents();
    renderQueue();
    applyHash();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
