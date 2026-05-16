'use strict';
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const LS={get:(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch{return d}},set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};

// State
let expenses=LS.get('ft_expenses',[]);
let budget=LS.get('ft_budget',0);
let theme=LS.get('ft_theme','light');
let userName=LS.get('ft_username','User');
let deleteId=null;
let charts={};

const CATS={Food:'🍔',Transport:'🚗',Shopping:'🛍️',Bills:'📄',Entertainment:'🎬',Health:'🏥',Education:'📚',Other:'📦'};
const CAT_COLORS=['#14B8A6','#3B82F6','#F59E0B','#EF4444','#8B5CF6','#EC4899','#F97316','#6366F1'];

function init(){
  applyTheme(theme);
  setGreeting();
  setupNav();
  setupSidebar();
  setupNotifications();
  setupModal();
  setupBudget();
  setupFilters();
  setupSettings();
  setupExport();
  render();
  $('#expense-date').value=new Date().toISOString().split('T')[0];
}

// Theme
function applyTheme(t){
  theme=t; document.documentElement.setAttribute('data-theme',t);
  $('#theme-toggle').checked=t==='dark';
  $('#theme-toggle-settings').checked=t==='dark';
  LS.set('ft_theme',t);
  Object.values(charts).forEach(c=>{if(c)c.destroy()});
  charts={}; renderCharts();
}
function toggleTheme(){applyTheme(theme==='dark'?'light':'dark')}

// Greeting
function setGreeting(){
  const h=new Date().getHours();
  const g=h<12?'Good Morning':h<17?'Good Afternoon':'Good Evening';
  $('#greeting-text').textContent=`${g}, ${userName} 👋`;
}

// Navigation
function setupNav(){
  $$('.nav-link').forEach(l=>l.addEventListener('click',e=>{
    e.preventDefault(); navigateTo(l.dataset.page);
  }));
  $$('[data-page="expenses"]').forEach(b=>b.addEventListener('click',e=>{
    e.preventDefault(); navigateTo('expenses');
  }));
  $('#dash-add-expense-btn')?.addEventListener('click',()=>{navigateTo('expenses');openModal()});
}
function navigateTo(page){
  $$('.nav-link').forEach(l=>l.classList.toggle('active',l.dataset.page===page));
  $$('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${page}`));
  closeSidebar();
  if(page==='analytics')renderAnalyticsCharts();
  if(page==='budget')renderBudgetChart();
}

// Sidebar
function setupSidebar(){
  $('#hamburger-btn').addEventListener('click',()=>{$('#sidebar').classList.add('open');$('#sidebar-overlay').classList.add('active')});
  $('#sidebar-close').addEventListener('click',closeSidebar);
  $('#sidebar-overlay').addEventListener('click',closeSidebar);
  $('#theme-toggle').addEventListener('change',toggleTheme);
  $('#theme-toggle-settings').addEventListener('change',toggleTheme);
}
function closeSidebar(){$('#sidebar').classList.remove('open');$('#sidebar-overlay').classList.remove('active')}

// Toast
function toast(msg,type='success'){
  const t=document.createElement('div');
  t.className=`toast ${type}`;
  const icons={success:'fa-check-circle',error:'fa-exclamation-circle',warning:'fa-exclamation-triangle'};
  t.innerHTML=`<i class="fas ${icons[type]||icons.success}"></i><span>${msg}</span>`;
  $('#toast-container').appendChild(t);
  setTimeout(()=>t.remove(),3200);
}

// Modal
function setupModal(){
  $('#add-expense-btn').addEventListener('click',()=>openModal());
  $('#modal-close').addEventListener('click',closeModal);
  $('#modal-cancel').addEventListener('click',closeModal);
  $('#expense-modal').addEventListener('click',e=>{if(e.target.id==='expense-modal')closeModal()});
  $('#expense-form').addEventListener('submit',handleSubmit);
  $('#confirm-cancel').addEventListener('click',closeConfirm);
  $('#confirm-delete').addEventListener('click',confirmDelete);
  $('#confirm-modal').addEventListener('click',e=>{if(e.target.id==='confirm-modal')closeConfirm()});
}
function openModal(id=null){
  const f=$('#expense-form');f.reset();
  $$('.form-error').forEach(e=>e.textContent='');
  if(id){
    const exp=expenses.find(e=>e.id===id);
    if(!exp)return;
    $('#modal-title').textContent='Edit Expense';
    $('#modal-submit').textContent='Update Expense';
    $('#expense-id').value=id;
    $('#expense-title').value=exp.title;
    $('#expense-amount').value=exp.amount;
    $('#expense-category').value=exp.category;
    $('#expense-date').value=exp.date;
  }else{
    $('#modal-title').textContent='Add Expense';
    $('#modal-submit').textContent='Add Expense';
    $('#expense-id').value='';
    $('#expense-date').value=new Date().toISOString().split('T')[0];
  }
  $('#expense-modal').classList.add('active');
}
function closeModal(){$('#expense-modal').classList.remove('active')}
function openConfirm(id){deleteId=id;$('#confirm-modal').classList.add('active')}
function closeConfirm(){deleteId=null;$('#confirm-modal').classList.remove('active')}
function confirmDelete(){
  if(!deleteId)return;
  expenses=expenses.filter(e=>e.id!==deleteId);
  save();render();closeConfirm();toast('Expense deleted','error');
}

// Validation
function validate(){
  let ok=true;
  const t=$('#expense-title').value.trim(),a=$('#expense-amount').value,c=$('#expense-category').value,d=$('#expense-date').value;
  $$('.form-error').forEach(e=>e.textContent='');
  if(!t){$('#error-title').textContent='Title is required';ok=false}
  if(!a||parseFloat(a)<=0){$('#error-amount').textContent='Valid amount is required';ok=false}
  if(!c){$('#error-category').textContent='Select a category';ok=false}
  if(!d){$('#error-date').textContent='Date is required';ok=false}
  return ok;
}

function handleSubmit(e){
  e.preventDefault();
  if(!validate())return;
  const id=$('#expense-id').value;
  const data={
    id:id||Date.now().toString(36)+Math.random().toString(36).slice(2,7),
    title:$('#expense-title').value.trim(),
    amount:parseFloat($('#expense-amount').value),
    category:$('#expense-category').value,
    date:$('#expense-date').value
  };
  if(id){const i=expenses.findIndex(e=>e.id===id);if(i>-1)expenses[i]=data;toast('Expense updated')}
  else{expenses.push(data);toast('Expense added')}
  save();render();closeModal();
}

// Persistence
function save(){LS.set('ft_expenses',expenses);LS.set('ft_budget',budget)}

// Budget
function setupBudget(){
  $('#set-budget-btn').addEventListener('click',()=>{
    const v=parseFloat($('#budget-input').value);
    if(!v||v<=0){toast('Enter a valid budget','warning');return}
    budget=v;save();render();toast('Budget set to ₹'+fmt(v));
  });
}

// Render
function render(){
  renderSummary();renderProgress();renderRecentExpenses();renderExpenseTable();renderCharts();updateNotifications();
}

function fmt(n){return n.toLocaleString('en-IN',{maximumFractionDigits:0})}

function getMonthExpenses(){
  const now=new Date(),y=now.getFullYear(),m=now.getMonth();
  return expenses.filter(e=>{const d=new Date(e.date);return d.getFullYear()===y&&d.getMonth()===m});
}

function renderSummary(){
  const me=getMonthExpenses();
  const totalExp=me.reduce((s,e)=>s+e.amount,0);
  const rem=budget-totalExp;
  const savPct=budget>0?Math.max(0,((rem)/budget)*100):0;
  $('#card-total-budget').textContent='₹'+fmt(budget);
  $('#card-total-expenses').textContent='₹'+fmt(totalExp);
  $('#card-remaining').textContent='₹'+fmt(Math.max(0,rem));
  $('#card-savings').textContent=budget>0?savPct.toFixed(1)+'%':'—';
  const bi=$('#balance-indicator');
  if(budget===0){bi.className='card-indicator';bi.innerHTML='<i class="fas fa-minus"></i> —'}
  else if(rem>=0){bi.className='card-indicator positive';bi.innerHTML='<i class="fas fa-arrow-up"></i> On track'}
  else{bi.className='card-indicator negative';bi.innerHTML='<i class="fas fa-arrow-down"></i> Over budget'}
  // Budget page stats
  $('#bo-budget').textContent='₹'+fmt(budget);
  $('#bo-spent').textContent='₹'+fmt(totalExp);
  $('#bo-remaining').textContent='₹'+fmt(Math.max(0,rem));
  renderBudgetAlerts(totalExp);
}

function renderProgress(){
  const me=getMonthExpenses();
  const totalExp=me.reduce((s,e)=>s+e.amount,0);
  const pct=budget>0?Math.min((totalExp/budget)*100,100):0;
  const bar=$('#budget-progress-bar');
  bar.style.width=pct+'%';
  bar.className='progress-bar'+(pct>90?' danger':pct>70?' warning':'');
  $('#budget-pct').textContent=pct.toFixed(1)+'%';
  if(budget===0)$('#budget-status').textContent='Set a budget to get started';
  else if(totalExp>budget)$('#budget-status').textContent='⚠️ Budget exceeded by ₹'+fmt(totalExp-budget);
  else $('#budget-status').textContent='₹'+fmt(budget-totalExp)+' remaining this month';
}

function renderBudgetAlerts(totalExp){
  const el=$('#budget-alerts');
  if(budget===0){el.innerHTML='<p class="text-muted">Set a budget to see alerts.</p>';return}
  const pct=(totalExp/budget)*100;
  let html='';
  if(pct>=100)html+=`<div class="budget-alert danger"><i class="fas fa-exclamation-circle"></i>Budget exceeded! You've spent ₹${fmt(totalExp)} of ₹${fmt(budget)}</div>`;
  else if(pct>=80)html+=`<div class="budget-alert warning"><i class="fas fa-exclamation-triangle"></i>Warning: ${pct.toFixed(1)}% of budget used</div>`;
  else html+=`<div class="budget-alert success"><i class="fas fa-check-circle"></i>You're within budget. ${pct.toFixed(1)}% used so far.</div>`;
  el.innerHTML=html;
}

function setupNotifications(){
  const btn=$('#notification-btn');
  const dropdown=$('#notif-dropdown');
  btn.addEventListener('click',e=>{
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });
  document.addEventListener('click',e=>{
    if(!dropdown.contains(e.target)&&!btn.contains(e.target))dropdown.classList.remove('open');
  });
  $('#notif-clear-btn').addEventListener('click',()=>{
    $('#notif-list').innerHTML='<div class="notif-empty"><i class="fas fa-bell-slash"></i><p>No notifications</p></div>';
    const b=$('#notif-badge');b.textContent='0';b.style.display='none';
  });
}

function updateNotifications(){
  const me=getMonthExpenses();
  const totalExp=me.reduce((s,e)=>s+e.amount,0);
  const pct=budget>0?(totalExp/budget)*100:0;
  const notifs=[];
  const now=new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});

  if(budget>0&&pct>=100)
    notifs.push({icon:'fa-exclamation-circle',type:'danger',msg:`Budget exceeded! You've spent ₹${fmt(totalExp)} of ₹${fmt(budget)} (${pct.toFixed(0)}%)`,time:now});
  else if(budget>0&&pct>=80)
    notifs.push({icon:'fa-exclamation-triangle',type:'warn',msg:`Caution: ${pct.toFixed(0)}% of your monthly budget is used. ₹${fmt(budget-totalExp)} remaining.`,time:now});
  else if(budget>0&&pct<80)
    notifs.push({icon:'fa-check-circle',type:'success',msg:`You're on track! Only ${pct.toFixed(0)}% of budget used so far.`,time:now});

  if(budget===0)
    notifs.push({icon:'fa-info-circle',type:'info',msg:'Set a monthly budget to track your spending progress.',time:now});
  if(expenses.length===0)
    notifs.push({icon:'fa-lightbulb',type:'info',msg:'Welcome! Start by adding your first expense.',time:now});
  if(me.length>=5)
    notifs.push({icon:'fa-chart-line',type:'info',msg:`You have ${me.length} expenses this month. Check Analytics for insights.`,time:now});

  const b=$('#notif-badge');b.textContent=notifs.length;b.style.display=notifs.length?'flex':'none';
  const list=$('#notif-list');
  if(!notifs.length){
    list.innerHTML='<div class="notif-empty"><i class="fas fa-bell-slash"></i><p>No notifications</p></div>';
    return;
  }
  list.innerHTML=notifs.map(n=>`<div class="notif-item"><div class="notif-item-icon ${n.type}"><i class="fas ${n.icon}"></i></div><div class="notif-item-content"><p>${n.msg}</p><span>${n.time}</span></div></div>`).join('');
}

// Recent Expenses
function renderRecentExpenses(){
  const el=$('#recent-expenses-list');
  const sorted=[...expenses].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  if(!sorted.length){el.innerHTML=`<div class="empty-state" id="dash-empty-state"><i class="fas fa-receipt"></i><p>No expenses recorded yet.</p><button class="btn btn-primary" id="dash-add-expense-btn" onclick="navigateTo('expenses');openModal()">Add Your First Expense</button></div>`;return}
  el.innerHTML=sorted.map(e=>`<div class="expense-item"><div class="expense-item-left"><div class="expense-item-icon" style="background:${CAT_COLORS[Object.keys(CATS).indexOf(e.category)%8]}22;color:${CAT_COLORS[Object.keys(CATS).indexOf(e.category)%8]}">${CATS[e.category]||'📦'}</div><div class="expense-item-info"><h4>${esc(e.title)}</h4><span>${e.category} · ${fmtDate(e.date)}</span></div></div><div class="expense-item-amount">-₹${fmt(e.amount)}</div></div>`).join('');
}

function fmtDate(d){return new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}

// Expense Table
function renderExpenseTable(){
  const search=$('#filter-search')?.value.toLowerCase()||'';
  const cat=$('#filter-category')?.value||'';
  const month=$('#filter-month')?.value||'';
  let filtered=expenses.filter(e=>{
    if(search&&!e.title.toLowerCase().includes(search))return false;
    if(cat&&e.category!==cat)return false;
    if(month&&!e.date.startsWith(month))return false;
    return true;
  }).sort((a,b)=>new Date(b.date)-new Date(a.date));

  const tbody=$('#expense-table-body');
  const empty=$('#expense-empty-state');
  const mobileCards=document.querySelector('.mobile-expense-cards')||createMobileContainer();

  if(!filtered.length){
    tbody.innerHTML='';mobileCards.innerHTML='';
    empty.style.display='block';$('.table-responsive').style.display='none';mobileCards.style.display='none';
    return;
  }
  empty.style.display='none';$('.table-responsive').style.display='block';
  tbody.innerHTML=filtered.map(e=>`<tr><td>${esc(e.title)}</td><td class="amount-cell">₹${fmt(e.amount)}</td><td><span class="cat-badge">${CATS[e.category]||''} ${e.category}</span></td><td>${fmtDate(e.date)}</td><td><div class="actions"><button class="btn btn-sm btn-outline btn-icon" onclick="openModal('${e.id}')" title="Edit"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-danger btn-icon" onclick="openConfirm('${e.id}')" title="Delete"><i class="fas fa-trash"></i></button></div></td></tr>`).join('');
  mobileCards.innerHTML=filtered.map(e=>`<div class="mobile-expense-card"><div class="mobile-card-top"><span class="mobile-card-title">${CATS[e.category]||''} ${esc(e.title)}</span><span class="mobile-card-amount">-₹${fmt(e.amount)}</span></div><div class="mobile-card-meta"><span>${e.category}</span><span>${fmtDate(e.date)}</span></div><div class="mobile-card-actions"><button class="btn btn-sm btn-outline btn-icon" onclick="openModal('${e.id}')"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-danger btn-icon" onclick="openConfirm('${e.id}')"><i class="fas fa-trash"></i></button></div></div>`).join('');
}
function createMobileContainer(){
  const d=document.createElement('div');d.className='mobile-expense-cards';
  $('.table-card').appendChild(d);return d;
}

// Filters
function setupFilters(){
  ['filter-search','filter-category','filter-month'].forEach(id=>{
    $(`#${id}`)?.addEventListener('input',renderExpenseTable);
    $(`#${id}`)?.addEventListener('change',renderExpenseTable);
  });
  $('#clear-filters-btn')?.addEventListener('click',()=>{
    $('#filter-search').value='';$('#filter-category').value='';$('#filter-month').value='';
    renderExpenseTable();
  });
  $('#global-search')?.addEventListener('input',e=>{
    navigateTo('expenses');$('#filter-search').value=e.target.value;renderExpenseTable();
  });
}

// Charts
function getChartColors(){return theme==='dark'?{grid:'#334155',text:'#94A3B8'}:{grid:'#E2E8F0',text:'#64748B'}}

function renderCharts(){
  renderDashPie();renderDashBar();
}
function renderDashPie(){
  const me=getMonthExpenses();
  const catTotals={};me.forEach(e=>{catTotals[e.category]=(catTotals[e.category]||0)+e.amount});
  const labels=Object.keys(catTotals),data=Object.values(catTotals);
  const empty=$('#dash-pie-empty'),canvas=$('#dash-pie-chart');
  if(!data.length){empty.style.display='block';canvas.style.display='none';if(charts.dashPie){charts.dashPie.destroy();charts.dashPie=null}return}
  empty.style.display='none';canvas.style.display='block';
  if(charts.dashPie)charts.dashPie.destroy();
  charts.dashPie=new Chart(canvas,{type:'pie',data:{labels,datasets:[{data,backgroundColor:CAT_COLORS.slice(0,labels.length),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:getChartColors().text,padding:12,font:{size:11}}}}}});
}
function renderDashBar(){
  const months={};expenses.forEach(e=>{const k=e.date.slice(0,7);months[k]=(months[k]||0)+e.amount});
  const sorted=Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6);
  const labels=sorted.map(([k])=>{const[y,m]=k.split('-');return new Date(y,m-1).toLocaleDateString('en-IN',{month:'short',year:'2-digit'})});
  const data=sorted.map(([,v])=>v);
  const empty=$('#dash-bar-empty'),canvas=$('#dash-bar-chart');
  if(!data.length){empty.style.display='block';canvas.style.display='none';if(charts.dashBar){charts.dashBar.destroy();charts.dashBar=null}return}
  empty.style.display='none';canvas.style.display='block';
  const cc=getChartColors();
  if(charts.dashBar)charts.dashBar.destroy();
  charts.dashBar=new Chart(canvas,{type:'bar',data:{labels,datasets:[{label:'Spent',data,backgroundColor:'rgba(20,184,166,0.7)',borderRadius:6,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:cc.text}},y:{grid:{color:cc.grid},ticks:{color:cc.text,callback:v=>'₹'+fmt(v)}}}}});
}

function renderBudgetChart(){
  const me=getMonthExpenses();const spent=me.reduce((s,e)=>s+e.amount,0);
  const rem=Math.max(0,budget-spent);
  const canvas=$('#budget-doughnut-chart');
  if(charts.budgetDoughnut)charts.budgetDoughnut.destroy();
  charts.budgetDoughnut=new Chart(canvas,{type:'doughnut',data:{labels:['Spent','Remaining'],datasets:[{data:[spent,budget>0?rem:1],backgroundColor:[spent>budget?'#EF4444':'#14B8A6','#E2E8F0'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:true,cutout:'70%',plugins:{legend:{position:'bottom',labels:{color:getChartColors().text,padding:12,font:{size:11}}}}}});
}

function renderAnalyticsCharts(){
  // Pie
  const catTotals={};expenses.forEach(e=>{catTotals[e.category]=(catTotals[e.category]||0)+e.amount});
  const pieLabels=Object.keys(catTotals),pieData=Object.values(catTotals);
  const cc=getChartColors();
  if(pieData.length){
    $('#analytics-pie-empty').style.display='none';$('#analytics-pie-chart').style.display='block';
    if(charts.aPie)charts.aPie.destroy();
    charts.aPie=new Chart($('#analytics-pie-chart'),{type:'pie',data:{labels:pieLabels,datasets:[{data:pieData,backgroundColor:CAT_COLORS,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:cc.text,padding:12}}}}});
  }else{$('#analytics-pie-empty').style.display='block';$('#analytics-pie-chart').style.display='none'}

  // Bar
  const months={};expenses.forEach(e=>{const k=e.date.slice(0,7);months[k]=(months[k]||0)+e.amount});
  const sorted=Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12);
  if(sorted.length){
    $('#analytics-bar-empty').style.display='none';$('#analytics-bar-chart').style.display='block';
    if(charts.aBar)charts.aBar.destroy();
    charts.aBar=new Chart($('#analytics-bar-chart'),{type:'bar',data:{labels:sorted.map(([k])=>{const[y,m]=k.split('-');return new Date(y,m-1).toLocaleDateString('en-IN',{month:'short',year:'2-digit'})}),datasets:[{label:'Spent',data:sorted.map(([,v])=>v),backgroundColor:'rgba(20,184,166,0.7)',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:cc.text}},y:{grid:{color:cc.grid},ticks:{color:cc.text,callback:v=>'₹'+fmt(v)}}}}});
  }else{$('#analytics-bar-empty').style.display='block';$('#analytics-bar-chart').style.display='none'}

  // Doughnut
  const me=getMonthExpenses();const spent=me.reduce((s,e)=>s+e.amount,0);
  const rem=Math.max(0,budget-spent);
  if(budget>0){
    $('#analytics-doughnut-empty').style.display='none';$('#analytics-doughnut-chart').style.display='block';
    if(charts.aDoughnut)charts.aDoughnut.destroy();
    charts.aDoughnut=new Chart($('#analytics-doughnut-chart'),{type:'doughnut',data:{labels:['Spent','Remaining'],datasets:[{data:[spent,rem],backgroundColor:[spent>budget?'#EF4444':'#14B8A6','#E2E8F0'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'70%',plugins:{legend:{position:'bottom',labels:{color:cc.text}}}}});
  }else{$('#analytics-doughnut-empty').style.display='block';$('#analytics-doughnut-chart').style.display='none'}

  // Top Categories
  const topEl=$('#top-categories-list');
  if(pieLabels.length){
    $('#top-cat-empty').style.display='none';
    const sorted2=pieLabels.map((l,i)=>({name:l,amount:pieData[i]})).sort((a,b)=>b.amount-a.amount).slice(0,5);
    topEl.innerHTML=sorted2.map((c,i)=>`<div class="top-cat-item"><span class="top-cat-rank">${i+1}</span><span class="top-cat-name">${CATS[c.name]||''} ${c.name}</span><span class="top-cat-amount">₹${fmt(c.amount)}</span></div>`).join('');
  }else{topEl.innerHTML='<p class="empty-chart-msg" id="top-cat-empty">No data available</p>'}
}

// Settings
function setupSettings(){
  $('#settings-name').value=userName;
  $('#save-name-btn').addEventListener('click',()=>{
    const n=$('#settings-name').value.trim();
    if(!n){toast('Enter a name','warning');return}
    userName=n;LS.set('ft_username',n);setGreeting();toast('Name updated');
  });
  $('#settings-export-btn').addEventListener('click',exportCSV);
  $('#clear-data-btn').addEventListener('click',()=>{
    if(!confirm('Delete all data? This cannot be undone.'))return;
    expenses=[];budget=0;save();render();toast('All data cleared','error');
  });
}

// Export
function setupExport(){$('#export-csv-btn').addEventListener('click',exportCSV)}
function exportCSV(){
  if(!expenses.length){toast('No data to export','warning');return}
  let csv='Title,Amount,Category,Date\n';
  expenses.forEach(e=>{csv+=`"${e.title}",${e.amount},"${e.category}","${e.date}"\n`});
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`fintrack_expenses_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();URL.revokeObjectURL(a.href);toast('CSV exported');
}

// Make functions globally accessible for onclick handlers
window.openModal=openModal;window.openConfirm=openConfirm;window.navigateTo=navigateTo;

document.addEventListener('DOMContentLoaded',init);
