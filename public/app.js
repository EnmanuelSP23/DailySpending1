const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
});

let allRecords = [];

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

function renderSummary() {
    const today = todayStr();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekStart = datePart(weekAgo.toISOString().slice(0, 16).replace('T', ' '));
    const month = today.slice(0, 7);

    let sumToday = 0, sumWeek = 0, sumMonth = 0, sumTotal = 0;

    for (const r of allRecords) {
        const d = datePart(r.date);
        const amount = parseFloat(r.amount) || 0;
        sumTotal += amount;
        if (d === today) sumToday += amount;
        if (d >= weekStart && d <= today) sumWeek += amount;
        if (d.slice(0, 7) === month) sumMonth += amount;
    }

    document.getElementById('sum-today').textContent = fmtAmount(sumToday);
    document.getElementById('sum-week').textContent = fmtAmount(sumWeek);
    document.getElementById('sum-month').textContent = fmtAmount(sumMonth);
    document.getElementById('sum-total').textContent = fmtAmount(sumTotal);
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

function renderList() {
    const list = document.getElementById('records');
    const empty = document.getElementById('empty-msg');
    const records = visibleRecords();

    list.innerHTML = '';
    empty.hidden = allRecords.length > 0;

    for (const r of records) {
        const li = document.createElement('li');

        const amount = document.createElement('span');
        amount.className = 'amount';
        amount.textContent = fmtAmount(parseFloat(r.amount) || 0);

        const desc = document.createElement('span');
        desc.className = 'desc';
        desc.textContent = r.description || '—';

        const date = document.createElement('span');
        date.className = 'date';
        date.textContent = r.date || '';

        li.append(amount, desc, date);
        list.appendChild(li);
    }
}

async function showMsg(text, isError) {
    const el = document.getElementById('form-msg');
    el.textContent = text;
    el.className = 'msg ' + (isError ? 'error' : 'success');
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 4000);
}

async function init() {
    try {
        await loadRecords();
    } catch (err) {
        await showMsg('Could not load records: ' + err.message, true);
    }
    renderSummary();
    renderList();

    document.getElementById('search').addEventListener('input', renderList);
    document.getElementById('month-filter').addEventListener('input', renderList);

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
            renderList();
            await showMsg('Spending added.');
        } catch (err) {
            await showMsg(err.message, true);
        }
    });
}

init();