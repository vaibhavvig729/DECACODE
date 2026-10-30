import * as pdfjsLib from './vendor/pdfjs/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).toString();

(() => {
  const $ = s => document.querySelector(s),
  $$ = s => [...document.querySelectorAll(s)];
  const keys = {
    tx:'schemesaathi.transactions.v1',
    items:'schemesaathi.inventory.v1',
    sales:'schemesaathi.sales.v1',
    lang:'schemesaathi.language.v1'
  }
  ;
  const read = (key,
  fallback=[]) => {
    try {
      const v=JSON.parse(localStorage.getItem(key)); return Array.isArray(v)?v:fallback;
    }
    catch {
      return fallback;
    }
  }
  ;
  const save = (key,
  value) => {
    try {
      localStorage.setItem(key,
      JSON.stringify(value));
    }
    catch {
      toast('Could not save: browser storage may be full.');
    }
  }
  ;
  let transactions=read(keys.tx),
  items=read(keys.items),
  sales=read(keys.sales),
  toastTimer;
  const currency=n=>new Intl.NumberFormat('en-IN',
  {
    style:'currency',
    currency:'INR',
    maximumFractionDigits:0
  }
  ).format(Number(n)||0);
  function toast(msg) {
    const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),
    2600)
  }
  const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,
  c=>( {
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }
  [c]));
  const today=()=>new Date().toISOString().slice(0,
  10);
  const categories=['Sales / income',
  'Supplies',
  'Transport',
  'Food',
  'Utilities',
  'Transfer',
  'Fees',
  'Other'];
  function guessCategory(description,
  type,
  amount) {
    const s=String(description).toLowerCase();if(/sale|customer|payment received|credit|income|deposit|refund|payout/.test(s))return 'Sales / income';if(/fuel|bus|taxi|auto|travel|transport/.test(s))return 'Transport';if(/grocery|food|meal|restaurant|tea|coffee/.test(s))return 'Food';if(/electric|water|mobile|internet|recharge|bill/.test(s))return 'Utilities';if(/upi|transfer|sent to|received from/.test(s)&&type==='out')return 'Transfer';if(/fee|charge|commission/.test(s))return 'Fees';if(/seed|fertili|stock|material|supply|tool|packaging|purchase/.test(s))return 'Supplies';return amount>=0&&type==='in'?'Sales / income':'Other'
  }
  function normalizeTx(row) {
    let amount=Math.abs(Number(row.amount)||0),
    type=row.type==='in'?'in':'out';return {
      id:row.id||crypto.randomUUID(),
      date:row.date||today(),
      description:String(row.description||'Transaction').slice(0,
      120),
      amount,
      type,
      category:row.category||guessCategory(row.description,
      type,
      amount)
    }
  }
  function renderTransactions() {
    transactions=transactions.map(normalizeTx);save(keys.tx,
    transactions);let incoming=transactions.filter(t=>t.type==='in').reduce((a,
    t)=>a+t.amount,
    0),
    outgoing=transactions.filter(t=>t.type==='out').reduce((a,
    t)=>a+t.amount,
    0);$('#inflowTotal').textContent=currency(incoming);$('#outflowTotal').textContent=currency(outgoing);$('#netTotal').textContent=currency(incoming-outgoing);$('#heroFlow').textContent=currency(incoming-outgoing);
    const body=$('#transactionRows');if(!transactions.length)body.innerHTML='<tr><td colspan="5" class="empty-state">No transactions yet.</td></tr>';else body.innerHTML=[...transactions].sort((a,
    b)=>b.date.localeCompare(a.date)).slice(0,
    100).map(t=>`<tr><td>${escapeHtml(t.date)}</td><td>${escapeHtml(t.description)}</td><td><input type="number" min="0" step="0.01" value="${Number(t.amount)||0}" data-amount="${escapeHtml(t.id)}" aria-label="Edit transaction amount"></td><td><select data-direction="${escapeHtml(t.id)}"><option value="in" ${t.type==='in'?'selected':''}>In</option><option value="out" ${t.type==='out'?'selected':''}>Out</option></select></td><td><select data-category="${escapeHtml(t.id)}">${categories.map(c=>`<option ${c===t.category?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select></td></tr>`).join('');
    $$('[data-amount]').forEach(input=>input.onchange=()=> {
      let t=transactions.find(x=>x.id===input.dataset.amount);if(t) {
        t.amount=Math.max(0,Number(input.value)||0);save(keys.tx,transactions);renderTransactions();
      }
    });
    $$('[data-direction]').forEach(sel=>sel.onchange=()=> {
      let t=transactions.find(x=>x.id===sel.dataset.direction);if(t) {
        t.type=sel.value;save(keys.tx,transactions);renderTransactions();
      }
    });
    $$('[data-category]').forEach(sel=>sel.onchange=()=> {
      let t=transactions.find(x=>x.id===sel.dataset.category);if(t) {
        t.category=sel.value;save(keys.tx,
        transactions);renderTransactions();
      }
    }
    );
    const dates=[...new Set(transactions.map(t=>t.date.slice(0,
    7)))].sort();let msg='Your records are saved in this browser. Add a second month to compare trends.';if(dates.length>=2) {
      const month=dates.at(-1),
      prev=dates.at(-2),
      sum=m=>transactions.filter(t=>t.date.startsWith(m)).reduce((a,
      t)=>a+(t.type==='in'?t.amount:-t.amount),
      0),
      delta=sum(month)-sum(prev);msg=`Recorded net cash flow ${delta>=0?'rose':'fell'} by ${currency(Math.abs(delta))} in ${month} compared with ${prev}. Based only on imported records.`;
    }
    else if(transactions.length) {
      let top=categories.map(c=>[c,
      transactions.filter(t=>t.category===c&&t.type==='out').reduce((a,
      t)=>a+t.amount,
      0)]).sort((a,
      b)=>b[1]-a[1])[0];msg=`${transactions.length} transactions recorded. Largest classified outflow: ${top[0]} (${currency(top[1])}).`;
    }
    $('#trendSummary').textContent=msg;renderFlags();
  }
  function analyzeFlags() {
    const flags=[];const dupMap=new Map();for(const t of transactions) {
        const k=`${t.date}|${t.description.toLowerCase().replace(/[^a-z0-9]/g,
      '')}|${t.amount.toFixed(2)}|${t.type}`;dupMap.set(k,
      (dupMap.get(k)||[]).concat(t));
    }
    for(const group of dupMap.values())if(group.length>1)flags.push( {
      title:'Possible duplicate-looking payments',
      detail:`${group.length} similar ${group[0].type==='out'?'outgoing':'incoming'} entries of ${currency(group[0].amount)} on ${group[0].date}, described as “${group[0].description}”. Check your statement before acting.`
    }
    );
    const amounts=transactions.filter(t=>t.type==='out').map(t=>t.amount).filter(n=>n>0).sort((a,
    b)=>a-b);if(amounts.length>=4) {
      const median=amounts[Math.floor((amounts.length-1)/2)];for(const t of transactions.filter(t=>t.type==='out'&&t.amount>=Math.max(median*3,
      median+5000)))flags.push( {
        title:'Amount stands out in this sample',
        detail:`${currency(t.amount)} on ${t.date} is at least 3× the median outgoing amount (${currency(median)}). It may be valid; review the context.`
      }
      );
    }
    const recent=[...transactions].filter(t=>t.type==='out').sort((a,
    b)=>a.date.localeCompare(b.date));for(let i=0;i<recent.length;i++) {
      let cluster=recent.filter(t=>t.date===recent[i].date);if(cluster.length>=4) {
        flags.push( {
          title:'Multiple outgoing transfers on one day',
          detail:`${cluster.length} outgoing entries on ${recent[i].date} may be worth reviewing together. These records show dates but no transaction times, so they cannot establish how quickly transfers occurred.`
        }
        );break;
      }
    }
    return flags.slice(0,
    8)
  }
  function renderFlags() {
    let flags=analyzeFlags();$('#flagSummary').textContent=transactions.length?`${flags.length?flags.length+' pattern(s) to review.':'No rule-based patterns found in these records.'} This small set of checks can miss issues or flag normal activity.`:'Add or load transactions to review possible patterns.';$('#flagSummary').classList.toggle('has-flags',
    flags.length>0);$('#flagsList').innerHTML=flags.map(f=>`<div class="flag"><b>${escapeHtml(f.title)}</b>${escapeHtml(f.detail)}</div>`).join('')
  }
  const demo=[['2026-10-01',
  'UPI customer payment',
  3200,
  'in'],
  ['2026-10-01',
  'Fertilizer store',
  860,
  'out'],
  ['2026-10-02',
  'UPI customer payment',
  2750,
  'in'],
  ['2026-10-03',
  'Market transport',
  450,
  'out'],
  ['2026-10-04',
  'Seed purchase',
  1250,
  'out'],
  ['2026-10-07',
  'UPI customer payment',
  4100,
  'in'],
  ['2026-10-08',
  'Mobile recharge',
  299,
  'out'],
  ['2026-10-08',
  'Unknown transfer',
  8990,
  'out'],
  ['2026-10-08',
  'Unknown transfer',
  8990,
  'out'],
  ['2026-10-08',
  'Online transfer',
  690,
  'out'],
  ['2026-10-08',
  'Wallet transfer',
  540,
  'out'],
  ['2026-10-09',
  'Customer payment received',
  2800,
  'in'],
  ['2026-10-11',
  'Packaging supplies',
  720,
  'out'],
  ['2026-10-14',
  'UPI customer payment',
  3600,
  'in'],
  ['2026-10-17',
  'Fuel',
  700,
  'out'],
  ['2026-10-20',
  'UPI customer payment',
  3900,
  'in'],
  ['2026-10-23',
  'Market transport',
  520,
  'out']].map(([date,
  description,
  amount,
  type])=>normalizeTx( {
    date,
    description,
    amount,
    type
  }
  ));
  async function readPdfTransactions(file) {
    const pdf = await pdfjsLib.getDocument({
      data: await file.arrayBuffer(),
      cMapUrl: new URL('./vendor/pdfjs/cmaps/', import.meta.url).toString(),
      cMapPacked: true,
      standardFontDataUrl: new URL('./vendor/pdfjs/standard_fonts/', import.meta.url).toString()
    }).promise;
    const parsed = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = [];
      for (const item of content.items) {
        if (!item.str || !item.str.trim()) continue;
        const y = item.transform[5];
        let line = lines.find(candidate => Math.abs(candidate.y - y) < 3);
        if (!line) { line = { y, parts: [] }; lines.push(line); }
        line.parts.push({ x: item.transform[4], width: item.width || 0, text: item.str.trim() });
      }
      for (const line of lines) {
        line.parts.sort((a, b) => a.x - b.x);
        line.text = line.parts.map((part, index) => {
          const previous = line.parts[index - 1];
          const gap = previous ? part.x - (previous.x + previous.width) : 0;
          return `${index && gap > 22 ? '   ' : ' '}${part.text}`;
        }).join('').trim();
      }
      lines.sort((a, b) => b.y - a.y);
      for (const line of lines) {
        const dateMatch = line.text.match(/\b(?:\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/);
        if (!dateMatch) continue;
        const date = normalizeStatementDate(dateMatch[0]);
        if (!date) continue;
        const tail = line.text.slice(dateMatch.index + dateMatch[0].length).trim();
        const candidates = [...tail.matchAll(/(?:₹\s*)?(\(?-?\d[\d,]*(?:\.\d{1,2})?\)?)(?:\s*(DR|CR))?/gi)]
          .filter(candidate => {
            const raw = candidate[1];
            const digitCount = raw.replace(/\D/g, '').length;
            const moneyFormatting = /₹/.test(candidate[0])
              || /\d,\d{3}(?:,\d{3})*(?:\.\d{1,2})?$/.test(raw)
              || /\.\d{1,2}\)?$/.test(raw)
              || Boolean(candidate[2]);
            const context = tail.slice(Math.max(0, candidate.index - 42), candidate.index);
            const referenceNumber = /\b(?:PNR|UTR|RRN|reference|ref\.?|txn|transaction|order|ticket|payment)\b(?:\s*(?:id|no|number|ref))?\s*[:#-]?\s*$/i.test(context);
            return !referenceNumber && (digitCount <= 6 || moneyFormatting);
          });
        if (!candidates.length) continue;
        // In common statement layouts the last number is a running balance;
        // use the preceding amount where present, and leave direction editable.
        const selected = candidates.length > 1 ? candidates[candidates.length - 2] : candidates[0];
        const amount = Math.abs(parseAmount(selected[1]));
        if (!amount) continue;
        const description = tail.slice(0, selected.index).replace(/[\t|]+/g, ' ').trim() || 'PDF statement entry';
        const directionHint = (selected[2] || tail.match(/\b(DR|CR|DEBIT|CREDIT)\b/i)?.[0] || '').toUpperCase();
        const type = directionHint === 'CR' || directionHint === 'CREDIT' ? 'in' : 'out';
        parsed.push(normalizeTx({ date, description, amount, type }));
      }
    }
    if (!parsed.length) throw new Error('No transaction rows could be read. Use a text-based statement PDF; scanned image PDFs and unfamiliar layouts may not be supported.');
    return parsed;
  }

  function normalizeStatementDate(value) {
    const parts = value.split(/[/-]/).map(Number);
    if (parts[0] > 999) return normalizeDate(value.replaceAll('/', '-'));
    let [day, month, year] = parts;
    if (year < 100) year += year < 50 ? 2000 : 1900;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
      ? date.toISOString().slice(0, 10) : '';
  }

  function parseAmount(value) {
    let amount = String(value || '').replace(/[₹,\s]/g, '');
    if (/^\(.*\)$/.test(amount)) amount = `-${amount.slice(1, -1)}`;
    return Number(amount) || 0;
  }

  function normalizeDate(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }

  $('#pdfFile').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const imported = await readPdfTransactions(file);
      transactions = [...transactions, ...imported];
      save(keys.tx, transactions);
      renderTransactions();
      $('#fileMessage').textContent = `Read ${imported.length} possible entries from ${file.name}. Review the date, amount, and direction before relying on the results.`;
      toast(`Read ${imported.length} possible transactions.`);
    } catch (error) {
      $('#fileMessage').textContent = error.message;
      toast('Could not read transaction rows from this PDF.');
    }
    event.target.value = '';
  });

    $('#loadDemo').onclick=()=> {
    transactions=[...transactions,
    ...demo.map(t=>( {
      ...t,
      id:crypto.randomUUID()
    }
    ))];save(keys.tx,
    transactions);renderTransactions();toast('Sample transactions added. Review the example flags.');
  }
  ;$('#clearTransactions').onclick=()=> {
    transactions=[];save(keys.tx,
    transactions);renderTransactions();$('#fileMessage').textContent='';
  }
  ;
  $('#checkMessage').onclick=()=> {
    const text=$('#messageText').value.trim(),
    out=$('#messageFlags');if(!text) {
      out.textContent='Paste message text to review.';return
    }
    const checks=[[/otp|pin|password|cvv|card number|\bcredential/i,
    'Requests a secret credential such as an OTP, PIN, password, or card security code. A legitimate support agent should not ask you to share these.'],
    [/urgent|immediately|within \d+ minutes|account.*block|suspend/i,
    'Uses urgency or an account-blocking threat to push quick action. Pause and verify through your bank’s official app or number.'],
    [/click|link|http|bit\.ly|tinyurl/i,
    'Contains a link or shortened URL. Avoid signing in through unexpected links; open the official app yourself.'],
    [/collect|prize|reward|cashback|lottery|won/i,
    'Promises a prize, reward, or unexpected benefit that may be used to attract a response. Verify independently.'],
    [/qr|scan.*pay|receive.*money.*pin|request.*money/i,
      'May confuse payment requests with receiving money. Scanning a QR or entering a PIN can authorize a payment out.']];let found=checks.filter(([re])=>re.test(text));out.innerHTML=found.length?`<strong>Review these red flags:</strong><br>${found.map(([,
    m])=>'• '+escapeHtml(m)).join('<br>')}<br><br>Do not reply or tap links until independently verified.`:'No listed wording patterns found. That does not prove the message is safe; verify the sender through an official channel.'
  }
  ;
  function renderInventory() {
    const list=$('#inventoryList'),
    sel=$('#saleItem');if(!items.length) {
      list.innerHTML='<div class="empty-state">Your catalog is empty.</div>';sel.innerHTML='<option value="">Add an item first</option>';
    }
    else {
      list.innerHTML=items.map(it=> {
        const low=Number(it.stock)<=Number(it.reorder||2)&&it.occupation!=='freelancer';return `<div class="inventory-item"><div><strong>${escapeHtml(it.name)}</strong><small>${escapeHtml(it.occupationLabel)} · ${currency(it.price)} / ${escapeHtml(it.unit)} · cost ${currency(it.cost)} / ${escapeHtml(it.unit)}</small><small class="${low?'stock-alert':''}">${it.occupation==='freelancer'?'Service / capacity tracked per sale':`Stock: ${it.stock} ${escapeHtml(it.unit)}${low?' · Low stock — review replenishment':''}`}</small></div><div class="inventory-controls"><button data-stock="${escapeHtml(it.id)}" data-delta="1" title="Add stock">+ stock</button><button class="delete-item" data-delete="${escapeHtml(it.id)}" title="Remove item">×</button></div></div>`
      }
      ).join('');sel.innerHTML='<option value="">Select an item</option>'+items.map(it=>`<option value="${escapeHtml(it.id)}">${escapeHtml(it.name)} (${currency(it.price)}/${escapeHtml(it.unit)})</option>`).join('');
    }
    $$('[data-stock]').forEach(b=>b.onclick=()=> {
      let it=items.find(i=>i.id===b.dataset.stock);if(it) {
        const val=prompt(`Add how many ${it.unit} to stock?`);if(val!==null&&Number(val)>0) {
          it.stock=Number(it.stock||0)+Number(val);save(keys.items,
          items);renderInventory();
        }
      }
    }
    );$$('[data-delete]').forEach(b=>b.onclick=()=> {
      items=items.filter(i=>i.id!==b.dataset.delete);save(keys.items,
      items);renderInventory();
    }
    );renderBusiness();
  }
  const occLabels= {
    farmer:'Large-scale farmer',
    shop:'Shop / micro business',
    artisan:'Scalable artisan',
    freelancer:'Freelancer'
  }
  ;
  $('#businessOccupation').onchange=()=> {
    $$('.stock-field').forEach(e=>e.style.display=$('#businessOccupation').value==='freelancer'?'none':'block');
  }
  ;
  $('#itemForm').onsubmit=e=> {
    e.preventDefault();let occupation=$('#businessOccupation').value;const item= {
      id:crypto.randomUUID(),
      name:$('#itemName').value.trim(),
      unit:$('#itemUnit').value.trim(),
      stock:occupation==='freelancer'?0:Number($('#itemStock').value)||0,
      price:Number($('#itemPrice').value)||0,
      cost:Number($('#itemCost').value)||0,
      occupation,
      occupationLabel:occLabels[occupation]
    }
    ;if(!item.name)return;items.push(item);save(keys.items,
    items);e.target.reset();$('#itemStock').value='0';renderInventory();toast('Catalog item added.');
  }
  ;$('#saleDate').value=today();
  $('#saleForm').onsubmit=e=> {
    e.preventDefault();const item=items.find(i=>i.id===$('#saleItem').value),
    qty=Number($('#saleQuantity').value),
    date=$('#saleDate').value;if(!item||qty<=0||!date)return;if(item.occupation!=='freelancer'&&qty>Number(item.stock)) {
      toast(`Only ${item.stock} ${item.unit} recorded in stock. Update stock or enter a lower quantity.`);return;
    }
    sales.push( {
      id:crypto.randomUUID(),
      itemId:item.id,
      itemName:item.name,
      unit:item.unit,
      quantity:qty,
      date,
      price:item.price,
      cost:item.cost,
      occupation:item.occupation
    }
    );if(item.occupation!=='freelancer')item.stock=Number(item.stock)-qty;save(keys.sales,
    sales);save(keys.items,
    items);$('#saleQuantity').value='';renderInventory();toast('Sale recorded.');
  }
  ;
  function renderBusiness() {
    let rev=sales.reduce((a,
    s)=>a+s.quantity*s.price,
    0),
    margin=sales.reduce((a,
    s)=>a+s.quantity*(s.price-s.cost),
    0),
    qty=sales.reduce((a,
    s)=>a+s.quantity,
    0);$('#revenueTotal').textContent=currency(rev);$('#marginTotal').textContent=currency(margin);$('#unitsTotal').textContent=new Intl.NumberFormat('en-IN',
    {
      maximumFractionDigits:2
    }
    ).format(qty);$('#salesRows').innerHTML=sales.length?[...sales].sort((a,
    b)=>b.date.localeCompare(a.date)).slice(0,
    100).map(s=>`<tr><td>${escapeHtml(s.date)}</td><td>${escapeHtml(s.itemName)}</td><td>${s.quantity} ${escapeHtml(s.unit||'')}</td><td>${currency(s.quantity*s.price)}</td><td>${currency(s.quantity*(s.price-s.cost))}</td></tr>`).join(''):'<tr><td colspan="5" class="empty-state">No sales recorded yet.</td></tr>';let observations=[];let byItem= {
    }
    ;sales.forEach(s=> {
      byItem[s.itemId]??= {
        name:s.itemName,
        qty:0,
        rev:0,
        margin:0,
        occupation:s.occupation
      }
      ;byItem[s.itemId].qty+=s.quantity;byItem[s.itemId].rev+=s.quantity*s.price;byItem[s.itemId].margin+=s.quantity*(s.price-s.cost)
    }
    );const sorted=Object.values(byItem).sort((a,
    b)=>b.rev-a.rev);if(!items.length)observations.push('Add products or services to build your catalog.');else if(!sales.length)observations.push('Catalog ready. Record a few sales to see item performance.');else {
      if(margin<0)observations.push('Recorded item costs exceed revenue. Review your price, unit costs, and quantities; this does not include overhead.');if(sorted[0])observations.push(`${sorted[0].name} has the highest recorded revenue (${currency(sorted[0].rev)}). Consider checking whether its stock or delivery capacity is sufficient.`);let negative=Object.values(byItem).filter(x=>x.margin<0);if(negative.length)observations.push(`Recorded cost is above sale price for: ${negative.map(x=>x.name).join(', ')}. Verify your entered costs/prices before changing them.`);let low=items.filter(i=>i.occupation!=='freelancer'&&Number(i.stock)<=Number(i.reorder||2));if(low.length)observations.push(`Low recorded stock: ${low.map(i=>i.name).join(', ')}. Compare with your expected demand and restock timing.`);let grouped= {
      }
      ;sales.forEach(s=> {
        let m=s.date.slice(0,
        7);grouped[m]=(grouped[m]||0)+s.quantity*s.price
      }
      );let months=Object.keys(grouped).sort();if(months.length>=2) {
        let a=grouped[months.at(-2)],
        b=grouped[months.at(-1)];observations.push(`Revenue ${b>=a?'increased':'decreased'} ${currency(Math.abs(b-a))} from ${months.at(-2)} to ${months.at(-1)} in these recorded sales.`)
      }
      if(items.some(i=>i.occupation==='farmer'))observations.push('For farm products, record harvest or sale batches with consistent units; compare sale price and input costs by crop and season.');if(items.some(i=>i.occupation==='shop'))observations.push('For a shop, track fast-moving items and supplier costs regularly; consider a small trial before adding a new product.');if(items.some(i=>i.occupation==='artisan'))observations.push('For artisan products, compare margin by design and batch; test buyer interest in a small run before scaling production.');if(items.some(i=>i.occupation==='freelancer'))observations.push('For services, log time or project units consistently and compare the effective rate with your recorded cost per unit.');
    }
    $('#businessInsights').innerHTML=observations.map(o=>`<div>• ${escapeHtml(o)}</div>`).join(' ')
  }
  $('#clearBusiness').onclick=()=> {
    if(confirm('Clear all catalog items and sales saved in this browser?')) {
      items=[];sales=[];save(keys.items,
      items);save(keys.sales,
      sales);renderInventory();
    }
  }
  ;
  const docs = {
    student: ['Identity proof', 'School / college ID or enrolment proof', 'Bank account details', 'Income certificate (if applicable)', 'Category certificate (if applicable)'],
    farmer: ['Identity proof', 'Bank account details / passbook', 'Land or cultivation records (if required)', 'Crop / activity details', 'Income or category certificate (if applicable)'],
    street: ['Identity proof', 'Bank account details', 'Vendor certificate / local body record (if applicable)', 'Address proof', 'Photograph'],
    shop: ['Identity proof', 'Bank account details', 'Business registration / Udyam details (if applicable)', 'Business address proof', 'Basic business and cost records'],
    artisan: ['Identity proof', 'Bank account details', 'Trade or artisan proof / portfolio', 'Address proof', 'Category certificate (if applicable)'],
    freelancer: ['Identity proof', 'Bank account details', 'Invoices or work samples', 'Income / self-employment proof', 'Address proof'],
    gig: ['Identity proof', 'Bank account details', 'Platform work or worker registration proof', 'Address proof', 'Income records (if available)'],
    salaried: ['Identity proof', 'Bank account details', 'Employer / salary proof', 'EPF or ESI details (if applicable)', 'Address proof'],
    jobseeker: ['Identity proof', 'Education or skill certificates', 'Bank account details', 'Employment registration (if applicable)', 'Income certificate (if applicable)'],
    women: ['Identity proof', 'Bank account details', 'SHG membership / group records (if applicable)', 'Business plan or activity details', 'Income / category certificate (if applicable)'],
    fisher: ['Identity proof', 'Bank account details', 'Fisheries / animal husbandry activity proof', 'Permit or registration (if applicable)', 'Address proof'],
    construction: ['Identity proof', 'Bank account details', 'Construction worker / BOCW registration (if applicable)', 'Work or employer proof', 'Address proof'],
    disability: ['Identity proof', 'UDID / disability certificate (if applicable)', 'Bank account details', 'Income certificate (if applicable)', 'Address proof'],
    senior: ['Age proof', 'Identity proof', 'Bank account details', 'Residence / income proof (if applicable)', 'Pension details (if applicable)'],
    other: ['Identity proof', 'Bank account details', 'Occupation or household proof (if applicable)', 'Address proof', 'Income / category certificate (if applicable)']
  };

  const myScheme = 'https://www.myscheme.gov.in/';
  const scheme = (name, desc, goals, url = myScheme) => ({ name, desc, goals, url });
  const schemeData = {
    student: [
      scheme('National Scholarship Portal (NSP) scholarships', 'Scholarships for eligible students under participating programmes.', ['training'], 'https://scholarships.gov.in/'),
      scheme('Central Sector Scheme of Scholarships for College and University Students', 'Financial support for eligible college students under scheme conditions.', ['training'], 'https://scholarships.gov.in/'),
      scheme('Post-Matric Scholarships', 'Education support for eligible students in specified categories.', ['training'], 'https://scholarships.gov.in/'),
      scheme('National Means-cum-Merit Scholarship Scheme', 'Scholarship support for eligible school students.', ['training'], 'https://scholarships.gov.in/'),
      scheme('PM-Vidyalaxmi', 'Education-loan support for eligible students at covered institutions; confirm current coverage and terms.', ['credit', 'training'], 'https://pmvidyalaxmi.co.in/'),
      scheme('State scholarships and fee reimbursement', 'Check scholarships and fee assistance available in {state}.', ['training'], myScheme)
    ],
    farmer: [
      scheme('PM-KISAN', 'Income support for eligible farmer families under scheme rules.', ['market'], 'https://pmkisan.gov.in/'),
      scheme('Kisan Credit Card (KCC)', 'Credit for eligible agricultural and allied activities.', ['credit'], myScheme),
      scheme('Pradhan Mantri Fasal Bima Yojana (PMFBY)', 'Crop insurance for eligible farmers and notified crops/areas.', ['insurance'], 'https://pmfby.gov.in/'),
      scheme('PM-KUSUM', 'Support for eligible solar-powered agricultural energy systems.', ['credit', 'market'], 'https://pmkusum.mnre.gov.in/'),
      scheme('Pradhan Mantri Krishi Sinchayee Yojana (PMKSY)', 'Irrigation and water-use-efficiency support under applicable components.', ['market'], 'https://pmksy.gov.in/'),
      scheme('Soil Health Card Scheme', 'Soil testing and nutrient-management guidance.', ['training'], 'https://soilhealth.dac.gov.in/'),
      scheme('MGNREGA', 'Rural wage employment for eligible households, including agricultural workers seeking work.', ['market'], 'https://nrega.nic.in/')
    ],
    street: [
      scheme('PM Street Vendor’s AtmaNirbhar Nidhi (PM SVANidhi)', 'Working-capital support for eligible street vendors.', ['credit', 'market'], 'https://pmsvanidhi.mohua.gov.in/'),
      scheme('DAY–National Urban Livelihoods Mission (DAY-NULM)', 'Urban livelihoods and self-employment support under applicable programme rules.', ['credit', 'training', 'market'], 'https://nulm.gov.in/'),
      scheme('PM Shram Yogi Maan-dhan (PM-SYM)', 'Pension programme for eligible unorganised workers.', ['insurance'], 'https://maandhan.in/'),
      scheme('Pradhan Mantri Jan-Dhan Yojana (PMJDY)', 'Access to basic banking services.', ['credit'], 'https://pmjdy.gov.in/'),
      scheme('Pradhan Mantri Suraksha Bima Yojana (PMSBY)', 'Accident insurance for eligible enrollees.', ['insurance'], 'https://jansuraksha.gov.in/'),
      scheme('Pradhan Mantri Jeevan Jyoti Bima Yojana (PMJJBY)', 'Life insurance for eligible enrollees.', ['insurance'], 'https://jansuraksha.gov.in/')
    ],
    shop: [
      scheme('Pradhan Mantri MUDRA Yojana (PMMY)', 'Loans for eligible micro-enterprises; terms are decided by participating lenders.', ['credit'], 'https://www.mudra.org.in/'),
      scheme('Prime Minister’s Employment Generation Programme (PMEGP)', 'Support for eligible applicants setting up new micro-enterprises.', ['credit', 'market'], 'https://www.kviconline.gov.in/pmegpeportal/'),
      scheme('Credit Guarantee Scheme for Micro and Small Enterprises (CGTMSE)', 'Credit guarantees for eligible lending to micro and small enterprises; ask the lender about coverage.', ['credit'], 'https://www.cgtmse.in/'),
      scheme('National Pension Scheme for Traders and Self-Employed Persons', 'Pension support for eligible small traders and self-employed people.', ['insurance'], 'https://maandhan.in/'),
      scheme('PMJDY', 'Basic banking access.', ['credit'], 'https://pmjdy.gov.in/'),
      scheme('State MSME support', 'Check state support for eligible business costs, equipment, or expansion in {state}.', ['credit', 'market'], myScheme)
    ],
    artisan: [
      scheme('PM Vishwakarma', 'Recognition, training, toolkit incentive, credit and marketing support for eligible artisans in the scheme’s specified traditional trades; not every handmade-product occupation is covered.', ['credit', 'training', 'market'], 'https://www.myscheme.gov.in/schemes/pmv'),
      scheme('PMEGP', 'Support for eligible applicants establishing a new micro-enterprise.', ['credit', 'market'], 'https://www.kviconline.gov.in/pmegpeportal/'),
      scheme('MUDRA', 'Credit for eligible craft and micro-business activities.', ['credit'], 'https://www.mudra.org.in/'),
      scheme('National Handloom Development Programme', 'Support for eligible handloom-sector workers and organisations.', ['training', 'market'], myScheme),
      scheme('National Handicrafts Development Programme', 'Support for eligible handicraft-sector activities.', ['training', 'market'], myScheme)
    ],
    freelancer: [
      scheme('MUDRA', 'Credit for eligible micro-enterprise activities.', ['credit'], 'https://www.mudra.org.in/'),
      scheme('PMEGP', 'Support for eligible new micro-enterprises.', ['credit', 'market'], 'https://www.kviconline.gov.in/pmegpeportal/'),
      scheme('PM-SYM', 'Pension for eligible unorganised workers.', ['insurance'], 'https://maandhan.in/'),
      scheme('PMJDY', 'Basic banking access.', ['credit'], 'https://pmjdy.gov.in/'),
      scheme('PMSBY', 'Accident insurance for eligible enrollees.', ['insurance'], 'https://jansuraksha.gov.in/'),
      scheme('PMJJBY', 'Life insurance for eligible enrollees.', ['insurance'], 'https://jansuraksha.gov.in/'),
      scheme('State entrepreneurship and self-employment schemes', 'Check financial or business support available in {state}. A freelance occupation alone does not establish eligibility.', ['credit', 'market'], myScheme)
    ],
    gig: [
      scheme('e-Shram registration', 'Registration and access to welfare information for eligible unorganised workers; registration itself is not a cash benefit.', ['market'], 'https://eshram.gov.in/'),
      scheme('PM-SYM', 'Pension for eligible unorganised workers.', ['insurance'], 'https://maandhan.in/'),
      scheme('PMSBY', 'Accident insurance for eligible enrollees.', ['insurance'], 'https://jansuraksha.gov.in/'),
      scheme('PMJJBY', 'Life insurance for eligible enrollees.', ['insurance'], 'https://jansuraksha.gov.in/'),
      scheme('PMJDY', 'Basic banking access.', ['credit'], 'https://pmjdy.gov.in/'),
      scheme('State labour-welfare programmes', 'Check state support relevant to your occupation and registration in {state}.', ['market', 'insurance'], myScheme)
    ],
    salaried: [
      scheme('Employees’ Provident Fund (EPF)', 'Retirement savings for covered employees; employment-linked rules apply.', ['insurance'], 'https://www.epfindia.gov.in/'),
      scheme('Employees’ State Insurance (ESI)', 'Medical and other specified benefits for eligible insured employees.', ['insurance'], 'https://www.esic.gov.in/'),
      scheme('PMJJBY', 'Life insurance for eligible enrollees.', ['insurance'], 'https://jansuraksha.gov.in/'),
      scheme('PMSBY', 'Accident insurance for eligible enrollees.', ['insurance'], 'https://jansuraksha.gov.in/'),
      scheme('Atal Pension Yojana (APY)', 'Pension programme for eligible subscribers; enrolment rules apply.', ['insurance'], 'https://www.pfrda.org.in/'),
      scheme('National Career Service (NCS)', 'Employment and career services.', ['training', 'market'], 'https://www.ncs.gov.in/')
    ],
    jobseeker: [
      scheme('Pradhan Mantri Kaushal Vikas Yojana (PMKVY)', 'Skill training and certification under applicable programme rules.', ['training'], 'https://www.skillindiadigital.gov.in/'),
      scheme('Deen Dayal Upadhyaya Grameen Kaushalya Yojana (DDU-GKY)', 'Skill training and placement support for eligible rural youth.', ['training', 'market'], 'https://ddugky.gov.in/'),
      scheme('National Career Service (NCS)', 'Job listings and employment services.', ['training', 'market'], 'https://www.ncs.gov.in/'),
      scheme('DAY-NULM', 'Urban livelihood and skill support under applicable programme rules.', ['training', 'market'], 'https://nulm.gov.in/'),
      scheme('MGNREGA', 'Rural wage employment for eligible rural households.', ['market'], 'https://nrega.nic.in/'),
      scheme('PMEGP', 'Support for eligible applicants establishing a new micro-enterprise.', ['credit', 'market'], 'https://www.kviconline.gov.in/pmegpeportal/')
    ],
    women: [
      scheme('DAY-National Rural Livelihoods Mission (DAY-NRLM)', 'Rural self-help groups, livelihoods and financial inclusion.', ['credit', 'training', 'market'], 'https://nrlm.gov.in/'),
      scheme('DAY-NULM', 'Urban livelihoods and eligible self-help-group support.', ['credit', 'training', 'market'], 'https://nulm.gov.in/'),
      scheme('MUDRA', 'Credit for eligible micro-enterprises, including women-owned businesses.', ['credit'], 'https://www.mudra.org.in/'),
      scheme('PMEGP', 'Support for eligible new micro-enterprises.', ['credit', 'market'], 'https://www.kviconline.gov.in/pmegpeportal/'),
      scheme('Stand-Up India', 'Bank loans for eligible SC/ST and women entrepreneurs, subject to current availability and rules.', ['credit'], 'https://www.standupmitra.in/'),
      scheme('State women-entrepreneurship schemes', 'Check state loans, subsidies and business support in {state}.', ['credit', 'market'], myScheme)
    ],
    fisher: [
      scheme('Pradhan Mantri Matsya Sampada Yojana (PMMSY)', 'Support for eligible fisheries and aquaculture activities, including specified fishery workers and enterprises.', ['credit', 'market'], 'https://pmmsy.dof.gov.in/'),
      scheme('Kisan Credit Card for fisheries and animal husbandry', 'Credit for eligible allied agricultural activities.', ['credit'], myScheme),
      scheme('National Livestock Mission (NLM)', 'Support for specified livestock-sector activities.', ['credit', 'market'], 'https://dahd.gov.in/schemes/programmes/national-livestock-mission'),
      scheme('Rashtriya Gokul Mission', 'Development and conservation of indigenous bovine breeds.', ['market'], 'https://dahd.gov.in/schemes/programmes/rashtriya-gokul-mission'),
      scheme('Animal Husbandry Infrastructure Development Fund (AHIDF)', 'Financing support for eligible animal-husbandry infrastructure.', ['credit'], 'https://ahidf.udyamimitra.in/'),
      scheme('PM-KISAN', 'Income support for eligible farmer families, subject to scheme rules.', ['market'], 'https://pmkisan.gov.in/')
    ],
    construction: [
      scheme('State Building and Other Construction Workers (BOCW) Welfare Board schemes', 'Welfare benefits for eligible registered construction workers; benefits and registration rules vary by state.', ['insurance', 'market'], 'https://labour.gov.in/'),
      scheme('PM-SYM', 'Pension for eligible unorganised workers.', ['insurance'], 'https://maandhan.in/'),
      scheme('e-Shram', 'Worker registration and welfare-scheme discovery; registration is not itself a cash benefit.', ['market'], 'https://eshram.gov.in/'),
      scheme('PMSBY', 'Accident insurance for eligible enrollees.', ['insurance'], 'https://jansuraksha.gov.in/'),
      scheme('PMJJBY', 'Life insurance for eligible enrollees.', ['insurance'], 'https://jansuraksha.gov.in/'),
      scheme('MGNREGA', 'Rural wage employment for eligible households.', ['market'], 'https://nrega.nic.in/'),
      scheme('Ayushman Bharat PM-JAY', 'Hospitalisation cover for eligible beneficiaries.', ['insurance'], 'https://pmjay.gov.in/')
    ],
    disability: [
      scheme('Unique Disability ID (UDID)', 'Disability identity and certificate-related services.', ['market'], 'https://www.swavlambancard.gov.in/'),
      scheme('ADIP', 'Assistive devices for eligible persons with disabilities.', ['market'], 'https://adip.depwd.gov.in/'),
      scheme('Scholarships for Students with Disabilities', 'Education support under applicable scholarship programmes.', ['training'], 'https://scholarships.gov.in/'),
      scheme('Indira Gandhi National Disability Pension Scheme (IGNDPS)', 'Pension support for eligible beneficiaries under applicable criteria.', ['insurance'], 'https://nsap.nic.in/'),
      scheme('PM-DAKSH and relevant skill programmes', 'Skill-development opportunities for eligible groups.', ['training'], 'https://www.myscheme.gov.in/schemes/pm-daksh'),
      scheme('State disability pension and welfare schemes', 'Check state-specific financial and support services in {state}.', ['insurance', 'market'], myScheme)
    ],
    senior: [
      scheme('Indira Gandhi National Old Age Pension Scheme (IGNOAPS)', 'Pension support for eligible older people under applicable criteria.', ['insurance'], 'https://nsap.nic.in/'),
      scheme('Atal Pension Yojana (APY)', 'Pension programme for eligible subscribers; enrolment rules apply.', ['insurance'], 'https://www.pfrda.org.in/'),
      scheme('National Programme for Health Care of the Elderly (NPHCE)', 'Healthcare services for older people.', ['insurance'], 'https://mohfw.gov.in/'),
      scheme('Senior Citizens’ Savings Scheme (SCSS)', 'Government-backed savings product for eligible senior citizens; this is a savings scheme, not a welfare grant.', ['credit'], 'https://www.nsiindia.gov.in/'),
      scheme('State old-age pension schemes', 'Check state-specific pension assistance in {state}.', ['insurance'], 'https://nsap.nic.in/')
    ],
    other: [
      scheme('PMJDY', 'Basic banking access.', ['credit'], 'https://pmjdy.gov.in/'),
      scheme('Ayushman Bharat PM-JAY', 'Hospitalisation cover for eligible beneficiaries.', ['insurance'], 'https://pmjay.gov.in/'),
      scheme('Pradhan Mantri Awas Yojana (PMAY)', 'Housing support under applicable urban or rural rules.', ['market'], 'https://pmay-urban.gov.in/'),
      scheme('One Nation One Ration Card (ONORC)', 'Ration portability for eligible beneficiaries.', ['market'], 'https://impds.nic.in/'),
      scheme('PMSBY', 'Accident insurance for eligible enrollees.', ['insurance'], 'https://jansuraksha.gov.in/'),
      scheme('PMJJBY', 'Life insurance for eligible enrollees.', ['insurance'], 'https://jansuraksha.gov.in/'),
      scheme('e-Shram', 'Registration and welfare-scheme discovery for eligible unorganised workers; registration is not itself a cash benefit.', ['market'], 'https://eshram.gov.in/'),
      scheme('State welfare and social-assistance schemes', 'Check additional benefits based on residence and eligibility in {state}.', ['insurance', 'market', 'credit'], myScheme)
    ]
  };

  $('#eligibilityForm').onsubmit = event => {
    event.preventDefault();
    const occupation = $('#occupation').value;
    const goal = $('#goal').value;
    const state = $('#state').value.trim() || 'your State / UT';
    const relevant = schemeData[occupation] || schemeData.other;
    const occupationLabel = $('#occupation').selectedOptions[0]?.textContent.replace(/\s+/g, ' ').trim() || occupation;
    const language = localStorage.getItem(keys.lang) || 'en';
    const heading = language === 'hi'
      ? `${occupationLabel} से जुड़ी योजनाएँ`
      : language === 'kn'
        ? `${occupationLabel} ಸಂಬಂಧಿತ ಯೋಜನೆಗಳು`
        : `Schemes related to ${occupationLabel}`;
    $('#schemeResultHeading').textContent = heading;
    let matches = relevant.filter(item => item.goals.includes(goal));
    const fallback = matches.length === 0;
    const orderedSchemes = [...matches, ...relevant.filter(item => !matches.includes(item))];
    const listNote = language === 'hi'
      ? fallback
        ? 'इस सहायता की ज़रूरत से सीधा मेल नहीं मिला। इस काम से जुड़ी सभी योजनाएँ दिखाई जा रही हैं।'
        : 'इस काम से जुड़ी सभी योजनाएँ दिखाई जा रही हैं; आपकी चुनी हुई ज़रूरत से मेल खाने वाली योजनाएँ पहले हैं।'
      : language === 'kn'
        ? fallback
          ? 'ಈ ಬೆಂಬಲ ಅಗತ್ಯಕ್ಕೆ ನೇರ ಹೊಂದಾಣಿಕೆ ಇಲ್ಲ. ಈ ಉದ್ಯೋಗಕ್ಕೆ ಸಂಬಂಧಿಸಿದ ಸಂಪೂರ್ಣ ಯೋಜನೆ ಪಟ್ಟಿಯನ್ನು ತೋರಿಸಲಾಗಿದೆ.'
          : 'ಈ ಉದ್ಯೋಗಕ್ಕೆ ಸಂಬಂಧಿಸಿದ ಸಂಪೂರ್ಣ ಯೋಜನೆ ಪಟ್ಟಿಯನ್ನು ತೋರಿಸಲಾಗಿದೆ; ನಿಮ್ಮ ಆಯ್ದ ಅಗತ್ಯಕ್ಕೆ ಹೊಂದುವ ಯೋಜನೆಗಳು ಮೊದಲು ಬರುತ್ತವೆ.'
        : fallback
          ? 'No close match is tagged for that support need. Showing the full scheme list for this occupation.'
          : 'Showing the full scheme list for this occupation, with schemes tagged for your selected need first.';
    $('#schemeResults').innerHTML = `<p class="fine-print">${escapeHtml(listNote)}</p>${orderedSchemes.map(item => {
      const description = item.desc.replaceAll('{state}', state);
      return `<article class="scheme-result"><span class="pill">${escapeHtml(item.goals.map(goalName => ({ credit: 'Credit / finance', insurance: 'Protection / pension', training: 'Skills / education', market: 'Livelihood support' }[goalName])).join(' · '))}</span><h3 style="margin:8px 0 0;font-size:14px">${escapeHtml(item.name)}</h3><p>${escapeHtml(description)}</p><a href="${item.url}" target="_blank" rel="noopener noreferrer" class="text-button">Official source / scheme directory ↗</a><details><summary style="cursor:pointer;color:var(--green);font-size:10px;font-weight:700">Personalized starter document checklist</summary><ul style="font-size:10px;line-height:1.8;color:#64736a">${docs[occupation].map(document => `<li><label><input type="checkbox"> ${escapeHtml(document)}</label></li>`).join('')}</ul><small class="fine-print">Preparation aid only. Exact documents depend on the scheme, lender, location and current rules.</small></details></article>`;
    }).join('')}`;
  };

  const tr= {
    hi: {
      tagline:'आपके काम और पैसों के लिए साथी',
      navSchemes:'योजनाएँ',
      navMoney:'पैसों के साधन',
      navBusiness:'मेरा व्यवसाय',
      welcome:'आगे बढ़ने का सरल तरीका',
      heroTitle:'आपके काम के लिए सहायता।<br><em>आपके पैसों की स्पष्टता।</em>',
      heroText:'सहायता योजनाएँ खोजें, लेन-देन समझें और अपनी आजीविका को आगे बढ़ाएँ — एक ही जगह।',
      findSchemes:'योजनाएँ खोजें',
      reviewMoney:'अपने पैसे देखें',
      privacyLine:'आपके रिकॉर्ड इसी ब्राउज़र में रहते हैं। बैंक या UPI से कोई कनेक्शन नहीं।',
      todaySnapshot:'आपका कार्यक्षेत्र',
      cashFlow:'नकदी प्रवाह',
      workspaceNote:'डेमो से शुरू करें या अपने रिकॉर्ड जोड़ें।',
      supportTools:'सहायता और तैयारी',
      schemeTitle:'अपने काम के अनुकूल सहायता खोजें',
      schemeIntro:'शुरुआती योजना मिलान देखें और अपनी दस्तावेज़ सूची बनाएँ।',
      occupation:'आपका काम',
      state:'राज्य / केंद्र शासित प्रदेश',
      statePlaceholder:'राज्य / केंद्र शासित प्रदेश चुनें',
      statesGroup:'राज्य',
      unionTerritoriesGroup:'केंद्र शासित प्रदेश',
      goal:'आपको किस सहायता की ज़रूरत है?',
      monthlyIncome:'लगभग मासिक आय (₹)',
      matchButton:'संभावित योजनाएँ देखें →',
      possibleMatches:'संभावित शुरुआती विकल्प',
      schemeDisclaimer:'ये केवल शुरुआती उदाहरण हैं। आवेदन से पहले आधिकारिक स्रोत से पात्रता और दस्तावेज़ जाँचें।',
      moneyTools:'पैसों के साधन',
      moneyTitle:'अपने लेन-देन समझें',
      moneyIntro:'UPI स्टेटमेंट PDF जोड़ें या नमूना आज़माएँ। विश्लेषण इसी डिवाइस पर स्पष्ट नियमों से होता है।',
      transactionAnalyzer:'लेन-देन विश्लेषक',
      ruleBased:'नियम-आधारित श्रेणियाँ · संपादन योग्य · स्थानीय रूप से सहेजी गई',
      uploadPdf:'UPI स्टेटमेंट PDF चुनें',
      loadDemo:'नमूना डेटा लाएँ',
      inflows:'पैसा आया',
      outflows:'पैसा गया',
      netFlow:'शुद्ध प्रवाह',
      date:'तारीख',
      description:'विवरण',
      amount:'राशि',
      amountEditable:'राशि (बदलें)',
      direction:'आवक / जावक (बदलें)',
      type:'प्रकार',
      category:'श्रेणी (बदलें)',
      clearRecords:'रिकॉर्ड साफ़ करें',
      scamAssistant:'संदिग्ध गतिविधि सहायक',
      explainableFlags:'समझने योग्य चेतावनियाँ',
      checkMessage:'संदिग्ध संदेश जाँचें',
      scanMessage:'संदेश देखें',
      fraudDisclaimer:'ये नियम-आधारित चेतावनियाँ हैं, पक्की धोखाधड़ी पहचान नहीं। UPI PIN, OTP, पासवर्ड या पूरा कार्ड विवरण साझा न करें। चिंता हो तो बैंक के आधिकारिक नंबर पर संपर्क करें।',
      pdfHelp:'PDF आयात स्टेटमेंट का चुना जा सकने वाला टेक्स्ट पढ़ता है। आयातित तारीख, राशि और दिशा जाँचें और बदलें। स्कैन की हुई इमेज PDF समर्थित नहीं हैं।',
      livelihoodTools:'आजीविका के साधन',
      businessTitle:'अपनी बिक्री का हिसाब रखें',
      businessIntro:'अपने काम के अनुसार स्टॉक, बिक्री और प्रदर्शन का व्यावहारिक रिकॉर्ड।',
      catalog:'उत्पाद और सेवाएँ',
      catalogHint:'वस्तु जोड़ें, फिर बिक्री दर्ज करें।',
      itemName:'उत्पाद / सेवा',
      unit:'इकाई',
      stockOnHand:'मौजूदा स्टॉक',
      salePrice:'बिक्री मूल्य / इकाई (₹)',
      costPerUnit:'लागत / इकाई (₹)',
      addItem:'सूची में जोड़ें',
      recordSale:'बिक्री दर्ज करें',
      saleHint:'आपकी प्रविष्टियों से आय और सकल मार्जिन बदलेंगे।',
      chooseItem:'उत्पाद / सेवा',
      quantitySold:'मात्रा',
      saleDate:'तारीख',
      saveSale:'बिक्री सहेजें',
      salesRevenue:'दर्ज आय',
      grossMargin:'सकल मार्जिन',
      unitsSold:'बिकी इकाइयाँ',
      item:'वस्तु',
      quantity:'मात्रा',
      revenue:'आय',
      businessDisclaimer:'सकल मार्जिन बिक्री आय में से दर्ज वस्तु लागत घटाकर है; इसमें किराया, वेतन, कर, ऋण भुगतान, खराबा और अन्य खर्च शामिल नहीं हैं। सुझाव आपके रिकॉर्ड पर आधारित हैं, पूर्वानुमान नहीं।',
      footerNote:'डिज़ाइन में गोपनीयता। काम में उपयोगिता।',
      footerText:'वित्तीय समावेशन के लिए स्थानीय प्रोटोटाइप।',
      faqEyebrow:'त्वरित उत्तर',
      faqTitle:'अक्सर पूछे जाने वाले सवाल',
      faqIntro:'Finora इस्तेमाल करने के बारे में कुछ उपयोगी बातें।',
      faqQ1:'Finora का उपयोग कौन कर सकता है?',
      faqA1:'Finora छात्रों, किसानों, दुकानदारों, कारीगरों, फ्रीलांसरों, कामगारों और अन्य आजीविका समूहों के लिए शुरुआती सहायता के रूप में बनाया गया है।',
      faqQ2:'क्या योजना से मेल मिलने का मतलब है कि मैं पात्र हूँ?',
      faqA2:'नहीं। योजना सुझाव और दस्तावेज़ सूची तैयारी में मदद करते हैं। पात्रता और ज़रूरतें आधिकारिक पोर्टल या संबंधित संस्था से जाँचें।',
      faqQ3:'क्या Finora मेरे बैंक या UPI खाते से जुड़ता है?',
      faqA3:'नहीं। Finora का बैंक या UPI से लाइव कनेक्शन नहीं है। आप ब्राउज़र में समर्थित टेक्स्ट-आधारित UPI स्टेटमेंट PDF या नमूना डेटा देख सकते हैं।',
      faqQ4:'मैं किस तरह का स्टेटमेंट PDF आयात कर सकता हूँ?',
      faqA4:'रीडर उन PDF के साथ काम करता है जिनमें टेक्स्ट चुना जा सकता है। स्कैन किए गए इमेज-आधारित स्टेटमेंट समर्थित नहीं हैं। आयात की गई पंक्तियाँ जाँचें।',
      faqQ5:'क्या संदिग्ध गतिविधि की चेतावनी धोखाधड़ी का पक्का सबूत है?',
      faqA5:'नहीं। ये नियम-आधारित संकेत हैं ताकि आप लेन-देन या संदेश की जाँच कर सकें। चिंता होने पर आधिकारिक माध्यम से पुष्टि करें और PIN या OTP कभी साझा न करें।',
      faqQ6:'क्या आजीविका के सुझाव मेरी आय का अनुमान लगाते हैं?',
      faqA6:'नहीं। सुझाव आपके दर्ज रिकॉर्ड के आधार पर बहीखाते के व्यावहारिक विचार देते हैं। आय और सकल मार्जिन के सारांश पूर्वानुमान या गारंटी नहीं हैं।',
      helpTitle:'AI सहायता',
      helpSubtitle:'विषय चुनें और ChatGPT के लिए प्रश्न पाएँ।',
      helpSchemes:'सरकारी योजनाएँ',
      helpTransactions:'UPI स्टेटमेंट',
      helpBusiness:'मेरा व्यवसाय',
      helpSafety:'धोखाधड़ी से सुरक्षा',
      helpPromptDefault:'ChatGPT के लिए सुझाया गया प्रश्न देखने हेतु विषय चुनें।',
      copyPrompt:'सुझाया गया प्रश्न कॉपी करें',
      openChatGPT:'ChatGPT खोलें ↗',
      helpPrivacy:'यह ChatGPT को अलग से खोलेगा। Finora आपके सहेजे रिकॉर्ड नहीं भेजता। UPI PIN, OTP, पासवर्ड या खाता संख्या साझा न करें।',
      helpButton:'AI सहायता',
      copyDone:'प्रश्न कॉपी हुआ ✓'
    }
    ,
    kn: {
      tagline:'ನಿಮ್ಮ ಕೆಲಸ ಮತ್ತು ಹಣದ ಸಂಗಾತಿ',
      navSchemes:'ಯೋಜನೆಗಳು',
      navMoney:'ಹಣದ ಸಾಧನಗಳು',
      navBusiness:'ನನ್ನ ಉದ್ಯಮ',
      welcome:'ಮುಂದುವರಿಯಲು ಸರಳ ದಾರಿ',
      heroTitle:'ನಿಮ್ಮ ಕೆಲಸಕ್ಕೆ ಬೆಂಬಲ।<br><em>ನಿಮ್ಮ ಹಣಕ್ಕೆ ಸ್ಪಷ್ಟತೆ।</em>',
      heroText:'ಬೆಂಬಲ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಿ, ವ್ಯವಹಾರಗಳನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ ಮತ್ತು ನಿಮ್ಮ ಜೀವನೋಪಾಯವನ್ನು ಮುನ್ನಡೆಸಿ — ಒಂದೇ ಸ್ಥಳದಲ್ಲಿ.',
      findSchemes:'ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಿ',
      reviewMoney:'ನನ್ನ ಹಣ ಪರಿಶೀಲಿಸಿ',
      privacyLine:'ನಿಮ್ಮ ದಾಖಲೆಗಳು ಈ ಬ್ರೌಸರ್‌ನಲ್ಲೇ ಇರುತ್ತವೆ. ಬ್ಯಾಂಕ್ ಅಥವಾ UPI ಸಂಪರ್ಕವಿಲ್ಲ.',
      todaySnapshot:'ನಿಮ್ಮ ಕಾರ್ಯಸ್ಥಳ',
      cashFlow:'ನಗದು ಹರಿವು',
      workspaceNote:'ಮಾದರಿಯಿಂದ ಪ್ರಾರಂಭಿಸಿ ಅಥವಾ ನಿಮ್ಮ ದಾಖಲೆ ಸೇರಿಸಿ.',
      supportTools:'ಬೆಂಬಲ ಮತ್ತು ಸಿದ್ಧತೆ',
      schemeTitle:'ನಿಮ್ಮ ಕೆಲಸಕ್ಕೆ ಹೊಂದುವ ಬೆಂಬಲ ಹುಡುಕಿ',
      schemeIntro:'ಆರಂಭಿಕ ಯೋಜನೆ ಹೊಂದಾಣಿಕೆ ನೋಡಿ ಮತ್ತು ವೈಯಕ್ತಿಕ ದಾಖಲೆ ಪಟ್ಟಿ ಮಾಡಿ.',
      occupation:'ನಿಮ್ಮ ಉದ್ಯೋಗ',
      state:'ರಾಜ್ಯ / ಕೇಂದ್ರಾಡಳಿತ ಪ್ರದೇಶ',
      statePlaceholder:'ರಾಜ್ಯ / ಕೇಂದ್ರಾಡಳಿತ ಪ್ರದೇಶ ಆಯ್ಕೆಮಾಡಿ',
      statesGroup:'ರಾಜ್ಯಗಳು',
      unionTerritoriesGroup:'ಕೇಂದ್ರಾಡಳಿತ ಪ್ರದೇಶಗಳು',
      goal:'ನಿಮಗೆ ಯಾವ ಬೆಂಬಲ ಬೇಕು?',
      monthlyIncome:'ಅಂದಾಜು ಮಾಸಿಕ ಆದಾಯ (₹)',
      matchButton:'ಸಂಭಾವ್ಯ ಹೊಂದಾಣಿಕೆಗಳನ್ನು ನೋಡಿ →',
      possibleMatches:'ಸಂಭಾವ್ಯ ಆರಂಭಿಕ ಆಯ್ಕೆಗಳು',
      schemeDisclaimer:'ಇವು ಆರಂಭಿಕ ಉದಾಹರಣೆಗಳು ಮಾತ್ರ. ಅರ್ಜಿ ಮೊದಲು ಅಧಿಕೃತ ಮೂಲದಲ್ಲಿ ಅರ್ಹತೆ ಮತ್ತು ದಾಖಲೆ ಪರಿಶೀಲಿಸಿ.',
      moneyTools:'ಹಣದ ಸಾಧನಗಳು',
      moneyTitle:'ನಿಮ್ಮ ವ್ಯವಹಾರಗಳನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ',
      moneyIntro:'UPI ಸ್ಟೇಟ್‌ಮೆಂಟ್ PDF ಸೇರಿಸಿ ಅಥವಾ ಮಾದರಿ ಬಳಸಿ. ವಿಶ್ಲೇಷಣೆ ಈ ಸಾಧನದಲ್ಲೇ ಸ್ಪಷ್ಟ ನಿಯಮಗಳಿಂದ ನಡೆಯುತ್ತದೆ.',
      transactionAnalyzer:'ವಹಿವಾಟು ವಿಶ್ಲೇಷಕ',
      ruleBased:'ನಿಯಮ ಆಧಾರಿತ ವರ್ಗಗಳು · ತಿದ್ದುಪಡಿ ಸಾಧ್ಯ · ಸ್ಥಳೀಯವಾಗಿ ಸಂಗ್ರಹ',
      uploadPdf:'UPI ಸ್ಟೇಟ್‌ಮೆಂಟ್ PDF ಆಯ್ಕೆಮಾಡಿ',
      loadDemo:'ಮಾದರಿ ಡೇಟಾ ಸೇರಿಸಿ',
      inflows:'ಹಣ ಬಂದಿದೆ',
      outflows:'ಹಣ ಹೋಗಿದೆ',
      netFlow:'ನಿವ್ವಳ ಹರಿವು',
      date:'ದಿನಾಂಕ',
      description:'ವಿವರಣೆ',
      amount:'ಮೊತ್ತ',
      amountEditable:'ಮೊತ್ತ (ತಿದ್ದುಪಡಿ)',
      direction:'ಬಂದ / ಹೋದ (ತಿದ್ದುಪಡಿ)',
      type:'ಪ್ರಕಾರ',
      category:'ವರ್ಗ (ತಿದ್ದುಪಡಿ)',
      clearRecords:'ದಾಖಲೆ ಅಳಿಸಿ',
      scamAssistant:'ಸಂದೇಹಾಸ್ಪದ ಚಟುವಟಿಕೆ ಸಹಾಯಕ',
      explainableFlags:'ವಿವರಿಸಬಹುದಾದ ಎಚ್ಚರಿಕೆಗಳು',
      checkMessage:'ಸಂದೇಶ ಪರಿಶೀಲಿಸಿ',
      scanMessage:'ಸಂದೇಶ ನೋಡಿ',
      fraudDisclaimer:'ಇವು ನಿಯಮ ಆಧಾರಿತ ಎಚ್ಚರಿಕೆಗಳು; ಖಚಿತ ವಂಚನೆ ಪತ್ತೆ ಅಲ್ಲ. UPI PIN, OTP, ಪಾಸ್‌ವರ್ಡ್ ಅಥವಾ ಪೂರ್ಣ ಕಾರ್ಡ್ ವಿವರ ಹಂಚಬೇಡಿ. ಆತಂಕವಿದ್ದರೆ ಬ್ಯಾಂಕಿನ ಅಧಿಕೃತ ಸಂಖ್ಯೆಗೆ ಕರೆಮಾಡಿ.',
      pdfHelp:'PDF ಆಮದು ಸ್ಟೇಟ್‌ಮೆಂಟ್‌ನಿಂದ ಆಯ್ಕೆಮಾಡಬಹುದಾದ ಪಠ್ಯ ಓದುತ್ತದೆ. ಆಮದು ದಿನಾಂಕ, ಮೊತ್ತ ಮತ್ತು ದಿಕ್ಕನ್ನು ಪರಿಶೀಲಿಸಿ ತಿದ್ದುಪಡಿ ಮಾಡಿ. ಸ್ಕ್ಯಾನ್ ಮಾಡಿದ ಚಿತ್ರ PDF ಬೆಂಬಲಿತವಲ್ಲ.',
      livelihoodTools:'ಜೀವನೋಪಾಯ ಸಾಧನಗಳು',
      businessTitle:'ನಿಮ್ಮ ಮಾರಾಟದ ದಾಖಲೆಯನ್ನು ಇಡಿ',
      businessIntro:'ನಿಮ್ಮ ಕೆಲಸಕ್ಕೆ ತಕ್ಕ ಸ್ಟಾಕ್, ಮಾರಾಟ ಮತ್ತು ಕಾರ್ಯಕ್ಷಮತೆಯ ದಾಖಲೆ.',
      catalog:'ಉತ್ಪನ್ನಗಳು ಮತ್ತು ಸೇವೆಗಳು',
      catalogHint:'ವಸ್ತು ಸೇರಿಸಿ, ನಂತರ ಮಾರಾಟ ದಾಖಲಿಸಿ.',
      itemName:'ಉತ್ಪನ್ನ / ಸೇವೆ',
      unit:'ಘಟಕ',
      stockOnHand:'ಲಭ್ಯ ಸ್ಟಾಕ್',
      salePrice:'ಮಾರಾಟ ಬೆಲೆ / ಘಟಕ (₹)',
      costPerUnit:'ವೆಚ್ಚ / ಘಟಕ (₹)',
      addItem:'ಪಟ್ಟಿಗೆ ಸೇರಿಸಿ',
      recordSale:'ಮಾರಾಟ ದಾಖಲಿಸಿ',
      saleHint:'ದಾಖಲಿಸಿದ ಮಾರಾಟದಿಂದ ಆದಾಯ ಮತ್ತು ಒಟ್ಟು ಲಾಭ ಬದಲಾಗುತ್ತದೆ.',
      chooseItem:'ಉತ್ಪನ್ನ / ಸೇವೆ',
      quantitySold:'ಪ್ರಮಾಣ',
      saleDate:'ದಿನಾಂಕ',
      saveSale:'ಮಾರಾಟ ಉಳಿಸಿ',
      salesRevenue:'ದಾಖಲಿಸಿದ ಆದಾಯ',
      grossMargin:'ಒಟ್ಟು ಲಾಭಾಂಶ',
      unitsSold:'ಮಾರಾಟ ಘಟಕಗಳು',
      item:'ವಸ್ತು',
      quantity:'ಪ್ರಮಾಣ',
      revenue:'ಆದಾಯ',
      businessDisclaimer:'ಒಟ್ಟು ಲಾಭಾಂಶ ಎಂದರೆ ಮಾರಾಟ ಆದಾಯದಿಂದ ದಾಖಲಿಸಿದ ವಸ್ತು ವೆಚ್ಚ ಕಡಿತ; ಬಾಡಿಗೆ, ವೇತನ, ತೆರಿಗೆ, ಸಾಲ ಪಾವತಿ, ಹಾಳಾಗುವಿಕೆ ಮತ್ತು ಇತರ ವೆಚ್ಚಗಳು ಒಳಗೊಂಡಿಲ್ಲ. ಸಲಹೆಗಳು ದಾಖಲಿಸಿದ ಮಾಹಿತಿಯ ಆಧಾರಿತ; ಮುನ್ಸೂಚನೆಗಳಲ್ಲ.',
      footerNote:'ವಿನ್ಯಾಸದಲ್ಲಿ ಗೌಪ್ಯತೆ. ಬಳಕೆಯಲ್ಲಿ ಉಪಯುಕ್ತತೆ.',
      footerText:'ಹಣಕಾಸು ಒಳಗೊಳ್ಳುವಿಕೆಗಾಗಿ ಸ್ಥಳೀಯ ಪ್ರೋಟೋಟೈಪ್.',
      faqEyebrow:'ತ್ವರಿತ ಉತ್ತರಗಳು',
      faqTitle:'ಪದೇಪದೇ ಕೇಳುವ ಪ್ರಶ್ನೆಗಳು',
      faqIntro:'Finora ಬಳಸುವ ಕುರಿತು ಕೆಲವು ಉಪಯುಕ್ತ ಮಾಹಿತಿ.',
      faqQ1:'Finora ಯಾರು ಬಳಸಬಹುದು?',
      faqA1:'ವಿದ್ಯಾರ್ಥಿಗಳು, ರೈತರು, ಅಂಗಡಿ ಮಾಲೀಕರು, ಕರಕುಶಲಗಾರರು, ಸ್ವತಂತ್ರ ವೃತ್ತಿಪರರು, ಕಾರ್ಮಿಕರು ಮತ್ತು ಇತರ ಜೀವನೋಪಾಯ ಗುಂಪುಗಳಿಗೆ ಆರಂಭಿಕ ಸಹಾಯವಾಗಿ Finora ರೂಪಿಸಲಾಗಿದೆ.',
      faqQ2:'ಯೋಜನೆ ಹೊಂದಾಣಿಕೆ ಕಂಡರೆ ನಾನು ಅರ್ಹನೆಂದರ್ಥವೇ?',
      faqA2:'ಇಲ್ಲ. ಯೋಜನೆ ಸೂಚನೆಗಳು ಮತ್ತು ದಾಖಲೆ ಪಟ್ಟಿ ಸಿದ್ಧತೆಗೆ ಮಾತ್ರ. ಅರ್ಹತೆ ಮತ್ತು ಅಗತ್ಯಗಳನ್ನು ಅಧಿಕೃತ ಪೋರ್ಟಲ್ ಅಥವಾ ಸಂಬಂಧಿತ ಸಂಸ್ಥೆಯಲ್ಲಿ ದೃಢಪಡಿಸಿ.',
      faqQ3:'Finora ನನ್ನ ಬ್ಯಾಂಕ್ ಅಥವಾ UPI ಖಾತೆಗೆ ಸಂಪರ್ಕಿಸುತ್ತದೆಯೇ?',
      faqA3:'ಇಲ್ಲ. Finora ಗೆ ಬ್ಯಾಂಕ್ ಅಥವಾ UPI ಯೊಂದಿಗೆ ನೇರ ಸಂಪರ್ಕವಿಲ್ಲ. ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಬೆಂಬಲಿತ ಪಠ್ಯಾಧಾರಿತ UPI ಸ್ಟೇಟ್‌ಮೆಂಟ್ PDF ಅಥವಾ ಮಾದರಿ ಡೇಟಾವನ್ನು ಪರಿಶೀಲಿಸಬಹುದು.',
      faqQ4:'ಯಾವ ರೀತಿಯ ಸ್ಟೇಟ್‌ಮೆಂಟ್ PDF ಆಮದು ಮಾಡಬಹುದು?',
      faqA4:'ಆಯ್ಕೆ ಮಾಡಬಹುದಾದ ಪಠ್ಯವಿರುವ PDF ಗಳನ್ನು ಓದುತ್ತದೆ. ಸ್ಕ್ಯಾನ್ ಮಾಡಿದ ಚಿತ್ರ ಮಾತ್ರ ಇರುವ ಸ್ಟೇಟ್‌ಮೆಂಟ್ ಬೆಂಬಲಿತವಲ್ಲ. ಆಮದು ಮಾಡಿದ ಸಾಲುಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.',
      faqQ5:'ಸಂದೇಹಾಸ್ಪದ ಚಟುವಟಿಕೆ ಎಚ್ಚರಿಕೆ ವಂಚನೆಯ ಖಚಿತ ಸಾಕ್ಷಿಯೇ?',
      faqA5:'ಇಲ್ಲ. ಇವು ವ್ಯವಹಾರ ಅಥವಾ ಸಂದೇಶವನ್ನು ಪರಿಶೀಲಿಸಲು ಸಹಾಯ ಮಾಡುವ ನಿಯಮಾಧಾರಿತ ಸೂಚನೆಗಳು. ಅನುಮಾನವಿದ್ದರೆ ಅಧಿಕೃತ ಮಾರ್ಗದಿಂದ ದೃಢಪಡಿಸಿ; PIN ಅಥವಾ OTP ಹಂಚಬೇಡಿ.',
      faqQ6:'ಜೀವನೋಪಾಯ ಸಲಹೆಗಳು ನನ್ನ ಆದಾಯವನ್ನು ಊಹಿಸುತ್ತವೆಯೇ?',
      faqA6:'ಇಲ್ಲ. ದಾಖಲಿಸಿದ ಮಾಹಿತಿಯ ಆಧಾರದಲ್ಲಿ ಲೆಕ್ಕಪತ್ರದ ಪ್ರಾಯೋಗಿಕ ಸಲಹೆಗಳನ್ನು ನೀಡುತ್ತವೆ. ಆದಾಯ ಮತ್ತು ಒಟ್ಟು ಲಾಭಾಂಶದ ಸಾರಾಂಶಗಳು ಮುನ್ಸೂಚನೆ ಅಥವಾ ಖಾತರಿಯಲ್ಲ.',
      helpTitle:'AI ಸಹಾಯ',
      helpSubtitle:'ವಿಷಯ ಆಯ್ಕೆಮಾಡಿ ಮತ್ತು ChatGPT ಪ್ರಶ್ನೆ ಪಡೆಯಿರಿ.',
      helpSchemes:'ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು',
      helpTransactions:'UPI ಸ್ಟೇಟ್‌ಮೆಂಟ್',
      helpBusiness:'ನನ್ನ ಉದ್ಯಮ',
      helpSafety:'ವಂಚನೆ ಸುರಕ್ಷತೆ',
      helpPromptDefault:'ChatGPT ಗಾಗಿ ಸೂಚಿಸಿದ ಪ್ರಶ್ನೆಯನ್ನು ನೋಡಲು ವಿಷಯ ಆಯ್ಕೆಮಾಡಿ.',
      copyPrompt:'ಸೂಚಿಸಿದ ಪ್ರಶ್ನೆ ನಕಲಿಸಿ',
      openChatGPT:'ChatGPT ತೆರೆಯಿರಿ ↗',
      helpPrivacy:'ಇದು ChatGPT ಅನ್ನು ಪ್ರತ್ಯೇಕವಾಗಿ ತೆರೆಯುತ್ತದೆ. Finora ನಿಮ್ಮ ಉಳಿಸಿದ ದಾಖಲೆಗಳನ್ನು ಕಳುಹಿಸುವುದಿಲ್ಲ. UPI PIN, OTP, ಪಾಸ್‌ವರ್ಡ್ ಅಥವಾ ಖಾತೆ ಸಂಖ್ಯೆ ಹಂಚಬೇಡಿ.',
      helpButton:'AI ಸಹಾಯ',
      copyDone:'ಪ್ರಶ್ನೆ ನಕಲಿಸಲಾಗಿದೆ ✓'
    }
  }
  ;
  function setLanguage(lang) {
    document.documentElement.lang=lang;$$('[data-i18n]').forEach(el=> {
      let value=tr[lang]?.[el.dataset.i18n];if(value){if(el.tagName==='OPTGROUP')el.label=value;else el.innerHTML=value}
    }
    );save(keys.lang,
    lang);$('#language').value=lang
  }
  const savedLanguage=localStorage.getItem(keys.lang);$('#language').value=savedLanguage||'';$('#language').onchange=()=>{if($('#language').value)setLanguage($('#language').value)};
  const helpPrompts={
    schemes:'Help me understand what eligibility details I should verify for a government scheme. Ask about my state and situation, and point me to official sources. Do not assume I qualify.',
    transactions:'Explain how I can review a UPI statement for duplicate-looking or unusual transactions. Do not ask me to share an OTP, PIN, password, or account number.',
    business:'Suggest practical bookkeeping and improvement ideas for a small livelihood business. Ask for only the product or service, unit cost, sale price, and sales pattern I choose to share.',
    safety:'Help me assess warning signs in a suspicious payment message. Tell me how to verify it through official channels, and do not ask for personal details or credentials.'
  };
  const helpPanel=$('#helpPanel'), helpToggle=$('#helpToggle');
  helpToggle.onclick=()=>{
    const opening=helpPanel.hidden;
    helpPanel.hidden=!opening;
    helpToggle.setAttribute('aria-expanded',String(opening));
  };
  $('#helpClose').onclick=()=>{
    helpPanel.hidden=true;
    helpToggle.setAttribute('aria-expanded','false');
    helpToggle.focus();
  };
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!helpPanel.hidden)$('#helpClose').click();
  });
  $$('.help-topic').forEach(button=>button.onclick=()=>{
    $$('.help-topic').forEach(topic=>topic.classList.toggle('active',topic===button));
    $('#helpPrompt').textContent=helpPrompts[button.dataset.topic];
    $('#copyHelpPrompt').dataset.prompt=helpPrompts[button.dataset.topic];
    $('#copyHelpPrompt').disabled=false;
  });
  $('#copyHelpPrompt').onclick=async event=>{
    const button=event.currentTarget;
    const prompt=button.dataset.prompt;
    if(!prompt)return;
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      const copyField=document.createElement('textarea');
      copyField.value=prompt;
      copyField.style.position='fixed';
      copyField.style.opacity='0';
      document.body.append(copyField);
      copyField.select();
      document.execCommand('copy');
      copyField.remove();
    }
    const lang=localStorage.getItem(keys.lang)||'en';
    button.textContent=tr[lang]?.copyDone||'Copied ✓';
    setTimeout(()=>button.textContent=tr[lang]?.copyPrompt||'Copy suggested question',1800);
  };
  renderTransactions();renderInventory();setLanguage($('#language').value);$('#businessOccupation').dispatchEvent(new Event('change'));
}
)();
