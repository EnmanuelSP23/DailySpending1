const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
});

let allRecords = [];
let allEarnings = [];

function fmtAmount(value) {
    return money.format(value || 0);
}

function localStamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function todayStr() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function datePart(date) {
    return (date || '').slice(0, 10);
}

async function loadRecords() {
    const res = await fetch('/api/records');
    if (!res.ok) throw new Error('Failed to load records');
    const data = await res.json();
    allRecords = data.records || [];
}

async function loadEarnings() {
    const res = await fetch('/api/earnings');
    if (!res.ok) throw new Error('Failed to load earnings');
    const data = await res.json();
    allEarnings = data.records || [];
}

function renderSummary() {
    const today = todayStr();
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);
    const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    const month = today.slice(0, 7);

    let sumToday = 0, sumWeek = 0, sumMonth = 0;

    for (const r of allRecords) {
        const d = datePart(r.date);
        const amount = parseFloat(r.amount) || 0;
        if (d === today) sumToday += amount;
        if (d >= weekStart && d <= today) sumWeek += amount;
        if (d.slice(0, 7) === month) sumMonth += amount;
    }

    document.getElementById('sum-today').textContent = fmtAmount(sumToday);
    document.getElementById('sum-week').textContent = fmtAmount(sumWeek);
    document.getElementById('sum-month').textContent = fmtAmount(sumMonth);
}

function renderEarningsSummary() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);
    const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    const today = todayStr();

    let sumEarnings = 0;
    for (const r of allEarnings) {
        const d = datePart(r.date);
        const amount = parseFloat(r.amount) || 0;
        if (d >= weekStart && d <= today) sumEarnings += amount;
    }

    document.getElementById('sum-earnings').textContent = fmtAmount(sumEarnings);
}

function visibleRecords() {
    const q = (document.getElementById('search').value || '').trim().toLowerCase();
    const month = document.getElementById('month-filter').value;

    return allRecords.filter((r) => {
        const d = datePart(r.date);
        if (month && d.slice(0, 7) !== month) return false;
        if (q && !(r.description || '').toLowerCase().includes(q)) return false;
        return true;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function renderSankey() {
    const container = document.getElementById('sankey-container');
    const svgEl = document.getElementById('sankey');
    const empty = document.getElementById('empty-msg');
    const records = visibleRecords();

    d3.select(svgEl).selectAll('*').remove();

    if (records.length === 0) {
        svgEl.setAttribute('width', 0);
        svgEl.setAttribute('height', 0);
        empty.hidden = allRecords.length > 0;
        return;
    }
    empty.hidden = true;

    const cats = {};
    for (const r of records) {
        const key = (r.description || '').trim() || 'Uncategorized';
        cats[key] = (cats[key] || 0) + (parseFloat(r.amount) || 0);
    }

    const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const colors = [
        '#4f46e5', '#7c3aed', '#ec4899', '#ef4444', '#f97316',
        '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
        '#8b5cf6', '#d946ef', '#f43f5e', '#f59e0b', '#10b981',
    ];

    const nodes = [{ name: 'Total Spending' }, ...sorted.map(([name]) => ({ name }))];
    const links = sorted.map(([name, value], i) => ({
        source: 0,
        target: i + 1,
        value,
    }));

    const rect = container.getBoundingClientRect();
    const w = Math.max(rect.width - 40, 300);
    const h = Math.max(sorted.length * 32 + 40, 200);

    svgEl.setAttribute('width', w);
    svgEl.setAttribute('height', h);

    const svg = d3.select(svgEl);

    const sankey = d3.sankey()
        .nodeId((d) => d.index)
        .nodeWidth(18)
        .nodePadding(12)
        .nodeAlign(d3.sankeyLeft)
        .extent([[1, 10], [w - 1, h - 10]]);

    const { nodes: sNodes, links: sLinks } = sankey({
        nodes: nodes.map((d) => Object.assign({}, d)),
        links: links.map((d) => Object.assign({}, d)),
    });

    svg.append('g')
        .selectAll('path')
        .data(sLinks)
        .join('path')
        .attr('d', d3.sankeyLinkHorizontal())
        .attr('fill', 'none')
        .attr('stroke', (d) => {
            const ci = d.target.index - 1;
            return colors[ci % colors.length];
        })
        .attr('stroke-opacity', 0.35)
        .attr('stroke-width', (d) => Math.max(1, d.width));

    const node = svg.append('g')
        .selectAll('g')
        .data(sNodes)
        .join('g');

    node.append('rect')
        .attr('x', (d) => d.x0)
        .attr('y', (d) => d.y0)
        .attr('height', (d) => Math.max(1, d.y1 - d.y0))
        .attr('width', (d) => d.x1 - d.x0)
        .attr('fill', (d) => {
            if (d.index === 0) return '#1e293b';
            return colors[(d.index - 1) % colors.length];
        })
        .attr('rx', 3);

    node.append('text')
        .attr('x', (d) => d.index === 0 ? d.x0 - 6 : d.x1 + 6)
        .attr('y', (d) => (d.y1 + d.y0) / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', (d) => d.index === 0 ? 'end' : 'start')
        .attr('fill', '#1e293b')
        .attr('font-size', '13px')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .text((d) => {
            const val = d.value !== undefined ? d.value : 0;
            const label = d.name.length > 22 ? d.name.slice(0, 20) + '...' : d.name;
            return `${label}  ${fmtAmount(val)}`;
        });
}

async function showMsg(text, isError) {
    const el = document.getElementById('form-msg');
    el.textContent = text;
    el.className = 'msg ' + (isError ? 'error' : 'success');
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 4000);
}

async function showEarnMsg(text, isError) {
    const el = document.getElementById('earn-form-msg');
    el.textContent = text;
    el.className = 'msg ' + (isError ? 'error' : 'success');
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 4000);
}

async function init() {
    try {
        await Promise.all([loadRecords(), loadEarnings()]);
    } catch (err) {
        await showMsg('Could not load data: ' + err.message, true);
    }
    renderSummary();
    renderEarningsSummary();
    renderSankey();

    document.getElementById('search').addEventListener('input', renderSankey);
    document.getElementById('month-filter').addEventListener('input', renderSankey);

    document.getElementById('add-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = document.getElementById('amount');
        const description = document.getElementById('description');

        try {
            const res = await fetch('/api/records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: amount.value,
                    description: description.value,
                    date: localStamp(),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Failed to save');

            amount.value = '';
            description.value = '';
            await loadRecords();
            renderSummary();
            renderSankey();
            await showMsg('Spending added.');
        } catch (err) {
            await showMsg(err.message, true);
        }
    });

    document.getElementById('earnings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = document.getElementById('earn-amount');
        const date = document.getElementById('earn-date');

        try {
            const res = await fetch('/api/earnings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: amount.value,
                    date: date.value,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Failed to save');

            amount.value = '';
            date.value = todayStr();
            await loadEarnings();
            renderEarningsSummary();
            await showEarnMsg('Earnings added.');
        } catch (err) {
            await showEarnMsg(err.message, true);
        }
    });
}

init();