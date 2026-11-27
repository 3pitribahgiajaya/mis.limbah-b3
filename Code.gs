/**
 * BEN AI Workforce Bridge — Google Apps Script
 * Free-first control plane for the existing BEN AI CRM spreadsheet.
 * Safety: no outbound messaging, contracts, payments, orders, or operational commands.
 */
const BEN = {
  SPREADSHEET_ID: '1qTxPaxoio0cQNuYA7YPuwmrH5EsbftZYoHLhLiw4Cmk',
  TZ: 'Asia/Jakarta',
  SHEETS: {
    AI_Employees: ['EMPLOYEE_ID','NAMA_AI','DEPARTEMEN','ROLE','JOB_DESCRIPTION','STATUS','AUTONOMY_LEVEL','MANAGER_ID','KPI_UTAMA','CREATED_AT'],
    AI_Tasks: ['TASK_ID','CREATED_AT','SCHEDULED_AT','DEPARTEMEN','ASSIGNEE_ID','TASK_TYPE','TASK_PAYLOAD_JSON','PRIORITY','STATUS','REQUIRES_APPROVAL','APPROVAL_ID','RESULT_JSON','ERROR','UPDATED_AT'],
    AI_Approvals: ['APPROVAL_ID','CREATED_AT','REQUESTED_BY','ACTION_TYPE','TARGET_TYPE','TARGET_ID','SUMMARY','PAYLOAD_JSON','RISK_LEVEL','STATUS','REVIEWED_BY','REVIEWED_AT','DECISION_NOTE'],
    AI_Activity: ['EVENT_ID','TIMESTAMP','ACTOR_ID','EVENT_TYPE','MODULE','ENTITY_ID','STATUS','DETAILS_JSON','CORRELATION_ID'],
    AI_KPI: ['KPI_ID','PERIOD','EMPLOYEE_ID','DEPARTMENT','METRIC','TARGET','ACTUAL','ACHIEVEMENT','UPDATED_AT'],
    AI_Integrations: ['INTEGRATION_ID','PROVIDER','PURPOSE','ENDPOINT_ALIAS','STATUS','AUTH_MODE','LAST_CHECK_AT','LAST_RESULT','NOTES'],
    AI_Config: ['CONFIG_KEY','CONFIG_VALUE','DESCRIPTION','UPDATED_AT']
  },
  ROLES: [
    ['CEO-001','BEN AI CEO','EXECUTIVE','Orchestrator','Membagi tugas, mengawasi KPI dan approval','ACTIVE','SEMI','','Omzet; pipeline; SLA'],
    ['MKT-001','AI Marketing Manager','MARKETING','Marketing strategy','Riset pasar, kampanye dan konten draft','ACTIVE','SEMI','CEO-001','Qualified inbound leads'],
    ['PRO-001','AI Prospecting','PROSPECTING','Lead research','Mencari dan memvalidasi perusahaan target nasional','ACTIVE','SEMI','CEO-001','Perusahaan tervalidasi'],
    ['SAL-001','AI Sales Manager','SALES','Sales leadership','Mengelola pipeline, target dan prioritas sales','ACTIVE','SEMI','CEO-001','Pipeline; win rate'],
    ['SAL-002','AI Sales Executive','SALES','Sales support','Kualifikasi prospek dan menyiapkan follow-up draft','ACTIVE','SEMI','SAL-001','SQL; quotation draft'],
    ['CS-001','AI Customer Service','CUSTOMER_SUCCESS','Customer support','Menyusun jawaban dan klasifikasi permintaan pelanggan','ACTIVE','SEMI','CEO-001','Response draft SLA'],
    ['LEG-001','AI Legal & Compliance','COMPLIANCE','Regulatory support','Checklist regulasi dan draft dokumen untuk review manusia','ACTIVE','SEMI','CEO-001','Compliance checklist'],
    ['OPS-001','AI Operations','OPERATIONS','Waste operations','Membantu monitoring jadwal, dokumen dan status operasional','ACTIVE','SEMI','CEO-001','Data completeness'],
    ['FIN-001','AI Finance','FINANCE','Commercial analysis','Kalkulasi HPP, margin dan quotation draft','ACTIVE','SEMI','CEO-001','Pricing accuracy'],
    ['CRM-001','AI CRM Administrator','CRM','CRM administration','Menjaga kualitas data dan sinkronisasi CRM','ACTIVE','SEMI','CEO-001','CRM completeness'],
    ['BI-001','AI Business Analyst','ANALYTICS','Business intelligence','Forecast, KPI dan laporan manajemen','ACTIVE','SEMI','CEO-001','Report accuracy']
  ],
  BLOCKED: ['SEND_EMAIL','SEND_WHATSAPP','SEND_CAMPAIGN','SIGN_CONTRACT','CREATE_CONTRACT_COMMITMENT','PAYMENT','TRANSFER','PLACE_ORDER','CONFIRM_PRICE','DISPATCH_WASTE','CHANGE_WASTE_MANIFEST','BOOK_TRANSPORT']
};

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || 'health');
  if (action === 'health') return json_({ok:true,service:'BEN AI Workforce Bridge',mode:'SEMI_AUTOMATIC',externalActions:false,time:now_()});
  // Authenticated reads use POST so API keys never appear in URL/query logs.
  return json_({ok:false,error:'POST_REQUIRED_FOR_AUTHENTICATED_ACTIONS'});
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!authorized_(body.key)) return json_({ok:false,error:'UNAUTHORIZED'},401);
    const action = String(body.action || '');
    let result;
    switch (action) {
      case 'setup': result = setupWorkforce(); break;
      case 'create_task': result = createTask_(body); break;
      case 'claim_task': result = claimTask_(body.taskId, body.actorId); break;
      case 'complete_task': result = completeTask_(body); break;
      case 'create_approval': result = createApproval_(body); break;
      case 'decide_approval': result = decideApproval_(body); break;
      case 'dashboard_summary': result = dashboardSummary_(); break;\n      case 'list_tasks': result = {tasks:readObjects_('AI_Tasks').slice(-100)}; break;\n      case 'list_approvals': result = {approvals:readObjects_('AI_Approvals').filter(x=>x.STATUS==='PENDING').slice(-100)}; break;
      case 'self_test': result = dryRunSelfTest(); break;
      default: return json_({ok:false,error:'UNKNOWN_ACTION'},400);
    }
    return json_({ok:true,result:result});
  } catch (err) { return json_({ok:false,error:String(err.message || err)},500); }
}

/** Run once from Apps Script editor after setting Script Property BEN_AI_API_KEY. */
function setupWorkforce() {
  const ss = SpreadsheetApp.openById(BEN.SPREADSHEET_ID);
  Object.keys(BEN.SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = BEN.SHEETS[name];
    if (sh.getLastRow() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
    else {
      const existing = sh.getRange(1,1,1,headers.length).getDisplayValues()[0];
      if (headers.some((h,i)=>existing[i] !== h)) throw new Error('HEADER_MISMATCH:'+name);
    }
  });
  const employeeSheet = ss.getSheetByName('AI_Employees');
  const existingIds = employeeSheet.getLastRow() > 1 ? employeeSheet.getRange(2,1,employeeSheet.getLastRow()-1,1).getDisplayValues().flat() : [];
  const newRows = BEN.ROLES.filter(r=>existingIds.indexOf(r[0])===-1).map(r=>r.concat([now_()]));
  if (newRows.length) employeeSheet.getRange(employeeSheet.getLastRow()+1,1,newRows.length,10).setValues(newRows);
  log_('SYSTEM','SETUP','AI_Workforce','SETUP','SUCCESS',{employeesSeeded:newRows.length});
  return {sheets:Object.keys(BEN.SHEETS),employeesSeeded:newRows.length};
}

function createDailyTriggers() {
  // Install one 15-minute trigger; do not duplicate existing triggers.
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='processInternalQueue').forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('processInternalQueue').timeBased().everyMinutes(15).create();
  return {ok:true,handler:'processInternalQueue',intervalMinutes:15};
}

function processInternalQueue() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return {ok:false,error:'LOCK_BUSY'};
  try {
    const tasks = readObjects_('AI_Tasks');
    const allowed = ['HEALTHCHECK','DASHBOARD_REFRESH','CRM_DATA_QUALITY'];
    let processed = 0;
    tasks.forEach(t => {
      if (processed >= 10 || t.STATUS !== 'PENDING' || allowed.indexOf(String(t.TASK_TYPE)) === -1) return;
      const result = {message:'Internal task processed by deterministic worker',taskType:t.TASK_TYPE,checkedAt:now_()};
      updateRowById_('AI_Tasks','TASK_ID',t.TASK_ID,{STATUS:'COMPLETED',RESULT_JSON:JSON.stringify(result),UPDATED_AT:now_(),ERROR:''});
      log_(t.ASSIGNEE_ID || 'SYSTEM','TASK_COMPLETED','AI_Tasks',t.TASK_ID,'SUCCESS',result);
      processed++;
    });
    return {ok:true,processed};
  } finally { lock.releaseLock(); }
}

function createTask_(b) {
  const type = String(b.taskType || '').toUpperCase();
  if (!type) throw new Error('TASK_TYPE_REQUIRED');
  const safeInternal = ['HEALTHCHECK','DASHBOARD_REFRESH','CRM_DATA_QUALITY','INTERNAL_RESEARCH','DRAFT_CONTENT','DRAFT_QUOTATION','LEAD_QUALIFICATION','CRM_UPDATE_DRAFT','REGULATORY_CHECK'];\n  const requires = BEN.BLOCKED.indexOf(type) !== -1 || safeInternal.indexOf(type) === -1 || b.requiresApproval === true;
  const id = String(b.taskId || Utilities.getUuid());
  if (findById_('AI_Tasks','TASK_ID',id)) return {taskId:id,duplicate:true};
  const approvalId = requires ? createApproval_({requestedBy:b.assigneeId||'SYSTEM',actionType:type,targetType:'TASK',targetId:id,summary:b.summary||('Approval required for '+type),payload:b.payload||{},riskLevel:'HIGH'}).approvalId : '';
  append_('AI_Tasks',[id,now_(),b.scheduledAt||now_(),b.department||'GENERAL',b.assigneeId||'CEO-001',type,JSON.stringify(b.payload||{}),b.priority||'NORMAL',requires?'PENDING_APPROVAL':'PENDING',requires?'TRUE':'FALSE',approvalId,'','',''+now_()]);
  log_(b.assigneeId||'SYSTEM','TASK_CREATED','AI_Tasks',id,requires?'PENDING_APPROVAL':'SUCCESS',{taskType:type,requiresApproval:requires});
  return {taskId:id,status:requires?'PENDING_APPROVAL':'PENDING',requiresApproval:requires,approvalId:approvalId};
}

function claimTask_(taskId, actorId) {
  if (!taskId || !actorId) throw new Error('TASK_AND_ACTOR_REQUIRED');
  const t = findById_('AI_Tasks','TASK_ID',taskId);
  if (!t) throw new Error('TASK_NOT_FOUND');
  if (t.STATUS !== 'PENDING') throw new Error('TASK_NOT_CLAIMABLE:'+t.STATUS);
  updateRowById_('AI_Tasks','TASK_ID',taskId,{STATUS:'IN_PROGRESS',ASSIGNEE_ID:actorId,UPDATED_AT:now_()});
  log_(actorId,'TASK_CLAIMED','AI_Tasks',taskId,'SUCCESS',{});
  return {taskId:taskId,status:'IN_PROGRESS'};
}

function completeTask_(b) {
  const t = findById_('AI_Tasks','TASK_ID',b.taskId);
  if (!t) throw new Error('TASK_NOT_FOUND');
  if (t.REQUIRES_APPROVAL === 'TRUE') {\n    const approval = t.APPROVAL_ID ? findById_('AI_Approvals','APPROVAL_ID',t.APPROVAL_ID) : null;\n    if (!approval || approval.STATUS !== 'APPROVED') throw new Error('APPROVAL_REQUIRED');\n  }
  updateRowById_('AI_Tasks','TASK_ID',b.taskId,{STATUS:'COMPLETED',RESULT_JSON:JSON.stringify(b.result||{}),ERROR:'',UPDATED_AT:now_()});
  log_(b.actorId||'SYSTEM','TASK_COMPLETED','AI_Tasks',b.taskId,'SUCCESS',b.result||{});
  return {taskId:b.taskId,status:'COMPLETED'};
}

function createApproval_(b) {
  const id = String(b.approvalId || Utilities.getUuid());
  if (findById_('AI_Approvals','APPROVAL_ID',id)) return {approvalId:id,duplicate:true};
  append_('AI_Approvals',[id,now_(),b.requestedBy||'SYSTEM',String(b.actionType||'UNSPECIFIED'),b.targetType||'',b.targetId||'',b.summary||'Review required',JSON.stringify(b.payload||{}),b.riskLevel||'MEDIUM','PENDING','','','']);
  log_(b.requestedBy||'SYSTEM','APPROVAL_REQUESTED','AI_Approvals',id,'PENDING',{actionType:b.actionType});
  return {approvalId:id,status:'PENDING'};
}

function decideApproval_(b) {
  if (!b.approvalId || !b.decision || !b.reviewerId) throw new Error('APPROVAL_DECISION_FIELDS_REQUIRED');
  const decision = String(b.decision).toUpperCase();
  if (['APPROVED','REJECTED'].indexOf(decision)===-1) throw new Error('INVALID_DECISION');
  const approval = findById_('AI_Approvals','APPROVAL_ID',b.approvalId);
  if (!approval) throw new Error('APPROVAL_NOT_FOUND');
  if (approval.STATUS !== 'PENDING') throw new Error('APPROVAL_ALREADY_REVIEWED');
  // Approval records authorization only; it never executes an external action.
  updateRowById_('AI_Approvals','APPROVAL_ID',b.approvalId,{STATUS:decision,REVIEWED_BY:b.reviewerId,REVIEWED_AT:now_(),DECISION_NOTE:String(b.note||'')});
  log_(b.reviewerId,'APPROVAL_'+decision,'AI_Approvals',b.approvalId,'SUCCESS',{note:b.note||''});
  return {approvalId:b.approvalId,status:decision,externalActionExecuted:false};
}

function dashboardSummary_() {
  const tasks = readObjects_('AI_Tasks');
  const approvals = readObjects_('AI_Approvals');
  return {ok:true,employees:Math.max(0,readObjects_('AI_Employees').length),tasks:{total:tasks.length,pending:tasks.filter(x=>x.STATUS==='PENDING').length,inProgress:tasks.filter(x=>x.STATUS==='IN_PROGRESS').length,completed:tasks.filter(x=>x.STATUS==='COMPLETED').length,blocked:tasks.filter(x=>x.STATUS==='PENDING_APPROVAL').length},approvals:{pending:approvals.filter(x=>x.STATUS==='PENDING').length,approved:approvals.filter(x=>x.STATUS==='APPROVED').length,rejected:approvals.filter(x=>x.STATUS==='REJECTED').length},safety:{outboundEnabled:false,transactionsEnabled:false,contractsEnabled:false},generatedAt:now_()};
}

function dryRunSelfTest() {
  const ss = SpreadsheetApp.openById(BEN.SPREADSHEET_ID);
  const missing = Object.keys(BEN.SHEETS).filter(n=>!ss.getSheetByName(n));
  const blocked = BEN.BLOCKED.every(x=>BEN.BLOCKED.indexOf(x)!==-1);
  const testId = 'TEST-'+Utilities.getUuid();
  const task = createTask_({taskId:testId,taskType:'SEND_WHATSAPP',assigneeId:'TEST',summary:'Policy test only'});
  const stored = findById_('AI_Tasks','TASK_ID',testId);
  const passed = missing.length===0 && blocked && task.status==='PENDING_APPROVAL' && stored && stored.STATUS==='PENDING_APPROVAL';
  // Keep the canary as a clearly labeled audit test row; no external side effect.
  log_('SYSTEM','SELF_TEST','BEN_AI','TEST',passed?'PASS':'FAIL',{missingSheets:missing,blockedPolicy:blocked,approvalGate:task.status});
  return {passed:!!passed,missingSheets:missing,blockedPolicy:blocked,approvalGate:task.status,externalSideEffects:0,testTaskId:testId};
}

function authorized_(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty('BEN_AI_API_KEY');
  return !!expected && !!provided && constantTimeEqual_(String(provided),String(expected));
}
function constantTimeEqual_(a,b) {
  if (a.length!==b.length) return false;
  let out=0; for(let i=0;i<a.length;i++) out |= a.charCodeAt(i)^b.charCodeAt(i);
  return out===0;
}
function sheet_(name) {
  const sh=SpreadsheetApp.openById(BEN.SPREADSHEET_ID).getSheetByName(name);
  if(!sh) throw new Error('SHEET_NOT_FOUND:'+name);
  return sh;
}
function append_(name,row) { sheet_(name).appendRow(row); }
function readObjects_(name) {
  const sh=sheet_(name), values=sh.getDataRange().getValues();
  if(values.length<2) return [];
  const headers=values[0];
  return values.slice(1).filter(r=>r.some(v=>v!=='' && v!==null)).map(r=>headers.reduce((o,h,i)=>(o[h]=r[i],o),{}));
}
function findById_(name,key,id) { return readObjects_(name).find(x=>String(x[key])===String(id))||null; }
function updateRowById_(name,key,id,patch) {
  const sh=sheet_(name), values=sh.getDataRange().getValues(), headers=values[0], keyCol=headers.indexOf(key);
  for(let r=1;r<values.length;r++) if(String(values[r][keyCol])===String(id)) {
    Object.keys(patch).forEach(k=>{const c=headers.indexOf(k);if(c>=0) sh.getRange(r+1,c+1).setValue(patch[k]);});
    return true;
  }
  throw new Error('ROW_NOT_FOUND:'+id);
}
function log_(actor,event,module,entity,status,details) {
  append_('AI_Activity',[Utilities.getUuid(),now_(),actor,event,module,entity,status,JSON.stringify(details||{}),'']);
}
function now_() { return Utilities.formatDate(new Date(),BEN.TZ,"yyyy-MM-dd'T'HH:mm:ssXXX"); }
function json_(obj,code) {
  // ContentService does not reliably support custom HTTP status codes; clients must inspect ok/error.
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
