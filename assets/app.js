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
    activeScenarioId: 'dual',
    activeBranchId: 'B',
    activeTab: 'chain',
    activeStage: 'report',
    p1Tab: 'strategy',
    lastFocus: null,
    modalOpen: false
  };

  const stageLabels = { ok: '正常', warn: '需关注', error: '异常', muted: '未发生' };
  const filterLabels = {
    all: '全部案例',
    dual: '一单双报告',
    unquoted: '未报价',
    anomaly: '规则链差异',
    aftersales: '售后关联',
    incomplete: '证据不完整',
    consistent: '规则执行一致'
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
    return [{
      id: 'single',
      label: '报告 A',
      instanceId: scenario.stages && scenario.stages.report ? (scenario.stages.report.facts.find(([label]) => label === '报告版本') || [])[1] || scenario.traceId : scenario.traceId,
      strategy: { id: '—', name: '单一报告策略', version: '—', selected: scenario.issues.join(' · ') || '报告项待核' },
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
      events: scenario.events,
      config: scenario.config,
      mappings: scenario.mappings,
      quote: scenario.quote,
      downstream: scenario.downstream
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

  function isSharedStage(scenario, key) {
    return Boolean(scenario.sharedStages && scenario.sharedStages[key]);
  }

  function branchSearchText(scenario) {
    return branchesOf(scenario).map((branch) => [
      branch.label, branch.instanceId, branch.reportGrade, (branch.issues || []).join(' '),
      branch.strategy && branch.strategy.name, branch.strategy && branch.strategy.id,
      branch.buyer, branch.amount, branch.audience && (branch.audience.buyers || []).join(' '),
      branch.model && branch.model.run, branch.model && branch.model.code
    ].join(' ')).join(' ');
  }

  function visibleScenarios() {
    const base = state.filter === 'all' ? scenarios.slice().sort((a, b) => queueOrder.indexOf(a.id) - queueOrder.indexOf(b.id)) : scenarios.filter((item) => item.filter === state.filter);
    const query = state.queueQuery.trim().toLowerCase();
    if (!query) return base;
    return base.filter((item) => [item.orderNo, item.device, item.specs, item.traceId, item.reportGrade, item.queueType, (item.issues || []).join(' '), branchSearchText(item)].join(' ').toLowerCase().includes(query));
  }

  function renderQueue() {
    const body = $('#queueBody');
    if (!body) return;
    const rows = visibleScenarios();
    $('#queueSubtitle').textContent = state.filter === 'all'
      ? '演示数据 · 6 个典型案例，按排查优先级排列'
      : `演示数据 · ${filterLabels[state.filter] || '当前筛选'} · ${rows.length} 个案例`;

    if (!rows.length) {
      body.innerHTML = `<tr class="empty-row"><td colspan="7"><div class="empty-state">${ic('search')}<strong>没有匹配的订单</strong><span>尝试清空筛选或更换关键词</span></div></td></tr>`;
    } else {
      body.innerHTML = rows.map((item) => {
        const branches = branchesOf(item);
        const issueText = branches.length > 1
          ? branches.map((branch) => `${branch.label} ${branch.reportGrade}`).join(' · ')
          : (item.issues.length ? item.issues.join(' · ') : '报告项待核');
        const reportMeta = branches.length > 1
          ? `${branches.length} 份报告 · 各自独立快照`
          : (item.issues.length ? `${item.issues.length} 个问题项` : '来源待核');
        const reportPill = branches.length > 1 ? `${branches.length} 份报告` : item.reportGrade;
        const amountClass = item.amountValue == null ? 'amount-cell empty' : 'amount-cell';
        const amountHtml = item.amountLines
          ? `<span class="amount-stack">${item.amountLines.map((line) => `<span><b>${esc(line.label)}</b>${esc(line.value)}</span>`).join('')}<small>分支报价 · 不合并</small></span>`
          : `<span class="${amountClass}">${esc(item.amount)}${item.amountValue == null ? '' : '<small>唯一报价结果</small>'}</span>`;
        return `<tr tabindex="0" role="button" data-scenario="${esc(item.id)}" aria-label="查看 ${esc(item.orderNo)} 追溯详情">
          <td><div class="cell-order"><strong>${esc(item.orderNo)}</strong><span>${esc(item.device)} · ${esc(item.specs)}</span><span class="cell-sub">${esc(item.store)} · 今日 ${esc(item.time)}</span></div></td>
          <td><span>${esc(item.queueType)}</span><span class="cell-sub">${esc(issueText)}</span></td>
          <td><span class="status-pill neutral no-dot">${esc(reportPill)}</span><span class="cell-sub">${esc(reportMeta)}</span></td>
          <td>${amountHtml}</td>
          <td><span class="status-pill ${esc(item.badgeTone)}">${esc(item.badge)}</span></td>
          <td><span>${esc(item.time)}</span><span class="cell-sub">${esc(item.completenessText)}</span></td>
          <td><button class="row-action" type="button" tabindex="-1" aria-label="进入详情">${ic('chevronRight')}</button></td>
        </tr>`;
      }).join('');
    }

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
        const row = event.target.closest('[data-scenario]');
        if (row) navigateToScenario(row.dataset.scenario);
      });
      $('#queueBody').addEventListener('keydown', (event) => {
        const row = event.target.closest('[data-scenario]');
        if (row && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          navigateToScenario(row.dataset.scenario);
        }
      });
    }
  }

  function renderOverview() {
    renderQueue();
    const active = state.filter === 'all' ? '全部待排查订单' : filterLabels[state.filter] || '待排查订单';
    const subtitle = state.filter === 'all'
      ? '先定位订单下的报告分支，再查看该分支标签选择、报告与实际报价的形成过程。'
      : `当前查看：${active}。筛选只改变工作台列表，不改变追溯事实。`;
    $('.page-heading .heading-desc').textContent = subtitle;
  }

  function navigateToScenario(id) {
    if (!getScenario(id)) return;
    const target = `#trace/${id}`;
    if (window.location.hash !== target) {
      window.location.hash = target;
    } else {
      showScenario(id);
    }
  }

  function navigateOverview() {
    if (window.location.hash !== '#overview') window.location.hash = 'overview';
    else showOverviewView();
  }

  function showScenario(id) {
    const scenario = getScenario(id);
    if (!scenario) return;
    state.activeScenarioId = scenario.id;
    state.activeBranchId = defaultBranchId(scenario);
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
    $('#detailView').hidden = true;
    $('#overviewView').hidden = false;
    renderOverview();
    closeSidebar();
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.title = '报价追溯台 · AI 报告订单追溯链路';
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
    openModal(`<div class="modal-head"><div><h2 id="modalTitle">P0 判定说明</h2><p>先定位报告分支，再解释该分支内的报告与报价；系统不评价跨报告的绝对高低</p></div><button class="modal-close" type="button" data-close-modal aria-label="关闭">${ic('x')}</button></div><div class="modal-body"><div class="p1-banner">${ic('info')}<div><strong>一单多报告，分支并行保留</strong><p>每个买家独立配置策略，策略在报告生成前决定哪些买家使用该报告。同一订单可以按不同买家组并行派生多份报告，全部保留、不覆盖、不合并；各报告可拥有独立模型任务、输入、候选标签和阈值。</p></div></div><div class="scope-compare"><article><h3>规则执行一致</h3><p>当前报告分支的实际报价能够由该分支报告条件、命中的价格规则、实际取用价档和计价明细完整解释。成色与专项扣减项命中后跨档取价属于合法业务。</p></article><article><h3>规则链差异</h3><p>当前报告分支的实际报价与规则条件、优先级、实际价档或计价明细不一致。其他分支报价正常，不能抵消这个差异。</p></article><article><h3>证据不足</h3><p>缺少关键快照时只展示已知事实和缺口，降级为待确认线索，不生成确定性原因、责任或高低价结论。</p></article></div><div class="quote-notes">${ic('alertCircle')}<span><strong>不使用：</strong>其他报告分支金额、其他买家报价、历史成交、市场价、成本价或不同成色档的绝对价格作为自动高低基准。成交买家同步后按其独立策略自动归属报告。</span></div></div>`);
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
    document.body.style.overflow = '';
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
    const rows = visibleScenarios();
    if (!rows.length) {
      showToast('当前筛选下没有可导出的订单', 'error');
      return;
    }
    const header = ['订单号', '设备', '门店', '渠道', '买家策略归属', '报告分支', '分支成色 / 问题项', '独立模型任务', '分支实际报价', '链路判定', '证据完整度'];
    const lines = rows.map((item) => {
      const branches = branchesOf(item);
      return [
        item.orderNo,
        `${item.device} ${item.specs}`,
        item.store,
        item.channel,
        branches.map((branch) => `${branch.audience && branch.audience.buyers ? branch.audience.buyers.join('、') : branch.buyer} → ${branch.strategy.id} ${branch.strategy.version}`).join(' / '),
        branches.map((branch) => `${branch.label} ${branch.instanceId}`).join(' / '),
        branches.map((branch) => `${branch.label} ${branch.reportGrade}：${(branch.issues || []).join('、')}`).join(' / '),
        branches.map((branch) => `${branch.label} ${branchModel(item, branch).run || '待补'}`).join(' / '),
        branches.map((branch) => `${branch.label} ${branch.amount}`).join(' / '),
        branches.map((branch) => `${branch.label} ${branch.badge}`).join(' / '),
        branches.map((branch) => `${branch.label} ${branch.completenessText}`).join(' / ')
      ];
    });
    const csv = '\ufeff' + [header, ...lines].map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    downloadFile('trace-queue-demo.csv', csv, 'text/csv;charset=utf-8');
    showToast('已导出当前视图的脱敏演示数据');
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
    const model = branchModel(scenario, branch);
    const buyers = branch.audience && branch.audience.buyers ? branch.audience.buyers.join('、') : branch.buyer;
    const text = `【${scenario.orderNo}】${scenario.device} ${scenario.specs}\ntrace_id：${scenario.traceId}\n报告分支：${branch.label} · ${branch.instanceId}\n买家策略归属：${buyers} → ${branch.strategy.id} · ${branch.strategy.name} ${branch.strategy.version}\nAI 任务：${model.run || '待补'} · ${model.code || '—'} · ${model.input || '输入待补'}\nAI 报告：${branch.reportGrade} / ${branch.issues.join('、')}\n分支实际报价：${branch.amount}\n链路判定：${branch.badge}\n结论：${branch.verdict.title}\n${branch.verdict.description}`;
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
      const id = decodeURIComponent(raw.slice(6));
      if (scenarios.some((item) => item.id === id)) {
        showScenario(id);
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

    $('#globalSearch').addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const query = event.target.value.trim().toLowerCase();
      if (!query) return;
      const found = scenarios.find((item) => [item.orderNo, item.device, item.specs, item.traceId, item.reportGrade, (item.issues || []).join(' '), branchSearchText(item)].join(' ').toLowerCase().includes(query));
      if (found) navigateToScenario(found.id);
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
        else closeSidebar();
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
