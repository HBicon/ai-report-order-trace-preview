(async function renderDocument() {
  const body = document.body;
  const article = document.getElementById('doc-content');
  const titleElement = document.getElementById('doc-title');
  const outline = document.getElementById('outline-nav');
  const sourceLink = document.getElementById('source-link');
  const progress = document.getElementById('reading-progress');
  const backToTop = document.getElementById('back-to-top');
  const documentPath = body.dataset.document;
  const documentKind = body.dataset.kind;

  document.querySelectorAll('[data-nav-kind]').forEach(link => {
    link.classList.toggle('active', link.dataset.navKind === documentKind);
  });
  sourceLink.href = documentPath;

  try {
    const response = await fetch(documentPath, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const markdown = await response.text();
    article.innerHTML = marked.parse(markdown, { gfm: true, breaks: false });
    article.setAttribute('aria-busy', 'false');

    const sourceTitle = article.querySelector('h1');
    if (sourceTitle) {
      titleElement.textContent = sourceTitle.textContent;
      document.title = `${sourceTitle.textContent} | 产品评审文档`;
      sourceTitle.remove();
    }

    const firstSection = article.querySelector('h2');
    if (firstSection?.textContent.trim() === '文档信息') {
      const information = firstSection.nextElementSibling;
      if (information?.tagName === 'UL') information.classList.add('document-info-list');
    }

    article.querySelectorAll('table').forEach(table => {
      const wrapper = document.createElement('div');
      wrapper.className = 'table-scroll';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });

    const routeMap = new Map([
      ['proposal.md', '../proposal/'],
      ['review-record.md', '../review-record/'],
      ['spec.md', '../specification/'],
      ['test-cases.md', '../test-cases/'],
      ['prd.md', '../prd/'],
      ['prototype/', '../prototype/'],
      ['prototype.html', '../prototype/']
    ]);
    article.querySelectorAll('a[href]').forEach(link => {
      const route = routeMap.get(link.getAttribute('href'));
      if (route) link.href = route;
    });

    const outlineHeadings = [];
    article.querySelectorAll('h2, h3, h4, h5').forEach((heading, index) => {
      const rawText = heading.textContent.trim();
      const priorityMatch = rawText.match(/（(P[0-2])）$/);
      const cleanText = priorityMatch ? rawText.replace(/（P[0-2]）$/, '').trim() : rawText;
      const id = `section-${index + 1}`;
      heading.id = id;

      if (cleanText.startsWith('能力 ')) heading.classList.add('capability-heading');

      const anchor = document.createElement('a');
      anchor.className = 'heading-anchor';
      anchor.href = `#${id}`;
      anchor.textContent = cleanText;
      heading.textContent = '';
      heading.appendChild(anchor);

      if (priorityMatch) {
        const priority = document.createElement('span');
        priority.className = 'priority';
        priority.textContent = priorityMatch[1];
        heading.appendChild(priority);
      }

      if (heading.tagName === 'H2' || heading.tagName === 'H3') {
        outlineHeadings.push({ heading, id, label: cleanText, level: heading.tagName === 'H2' ? 2 : 3 });
      }
    });

    outline.innerHTML = outlineHeadings.map(item =>
      `<a class="level-${item.level}" href="#${item.id}" data-section="${item.id}">${item.label}</a>`
    ).join('');

    let scheduled = false;
    function updateReadingState() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;
      progress.style.width = `${ratio * 100}%`;
      backToTop.classList.toggle('show', window.scrollY > 640);

      let current = outlineHeadings[0]?.id;
      outlineHeadings.forEach(item => {
        if (item.heading.getBoundingClientRect().top <= 150) current = item.id;
      });
      outline.querySelectorAll('a').forEach(link => {
        link.classList.toggle('active', link.dataset.section === current);
      });
      scheduled = false;
    }

    window.addEventListener('scroll', () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(updateReadingState);
    }, { passive: true });
    window.addEventListener('resize', updateReadingState);
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    updateReadingState();
    document.dispatchEvent(new CustomEvent('document-rendered', { detail: { documentKind } }));
  } catch (error) {
    article.setAttribute('aria-busy', 'false');
    article.innerHTML = '<div class="loading-state"><strong>文档加载失败</strong><p>请返回项目总说明后重试。</p></div>';
    titleElement.textContent = '暂时无法打开文档';
    console.error('Document render failed:', error);
  }
}());
