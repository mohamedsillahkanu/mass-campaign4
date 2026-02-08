// ============================================
// CONFIG & USERS
// ============================================
const CONFIG={SCRIPT_URL:'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',CSV_FILE:'cascading_data.csv'};
const USERS_DB={
    'user001':{password:'pass001',name:'Mohamed Kanu',role:'field_agent',dp_id:'dp001'},
    'user002':{password:'pass002',name:'Fatmata Sesay',role:'field_agent',dp_id:'dp002'},
    'user003':{password:'pass003',name:'Ibrahim Kamara',role:'field_agent',dp_id:'dp005'},
    'user004':{password:'pass004',name:'Aminata Conteh',role:'field_agent',dp_id:'dp006'},
    'user005':{password:'pass005',name:'Abu Bangura',role:'field_agent',dp_id:'dp008'},
    'user006':{password:'pass006',name:'Mariama Jalloh',role:'field_agent',dp_id:'dp011'},
    'user007':{password:'pass007',name:'Samuel Koroma',role:'field_agent',dp_id:'dp013'},
    'user008':{password:'pass008',name:'Hawa Turay',role:'field_agent',dp_id:'dp015'},
    'user009':{password:'pass009',name:'Alhaji Sesay',role:'field_agent',dp_id:'dp016'},
    'user010':{password:'pass010',name:'Isata Mansaray',role:'field_agent',dp_id:'dp019'},
    'sup001':{password:'sup001',name:'John Supervisor',role:'supervisor',dp_id:'dp001'},
    'admin':{password:'admin123',name:'Admin User',role:'admin',dp_id:'dp001'}
};

// ============================================
// STATE
// ============================================
let cascadingData=[],csvLoaded=false,lastReceipt=null,progressChart=null,hourlyChart=null;
const state={isLoggedIn:false,currentUser:null,currentDP:null,geoInfo:{},registrations:[],distributions:[],itnStock:[],syncLog:[],isOnline:navigator.onLine};

// ============================================
// INIT + SERVICE WORKER
// ============================================
function init(){
    loadFromStorage();loadCascadingCSV();populateCredentialsTable();setupEventListeners();injectLogos();
    if(state.isLoggedIn&&state.currentUser)showAppScreen();
    // Register SW for offline
    if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(function(){});}
}
function loadFromStorage(){try{var s=localStorage.getItem('itn_mass_state');if(s)Object.assign(state,JSON.parse(s));}catch(e){}}
function saveToStorage(){try{localStorage.setItem('itn_mass_state',JSON.stringify(state));}catch(e){}}

// Inject SVG logos into containers
function injectLogos(){
    var svg=document.getElementById('icfLogo');if(!svg)return;
    var clone1=svg.cloneNode(true);clone1.removeAttribute('id');clone1.style.display='block';
    var c1=document.getElementById('loginLogo');if(c1)c1.appendChild(clone1);
    var clone2=svg.cloneNode(true);clone2.removeAttribute('id');clone2.style.display='block';
    var c2=document.getElementById('appLogo');if(c2)c2.appendChild(clone2);
}

// ============================================
// CSV
// ============================================
function loadCascadingCSV(){
    var el=document.getElementById('csvStatus');
    Papa.parse(CONFIG.CSV_FILE,{download:true,header:true,skipEmptyLines:true,
        complete:function(r){
            cascadingData=r.data.filter(function(row){return row.district&&row.distribution_point&&row.dp_id;});
            csvLoaded=true;
            if(el)el.innerHTML='<div class="csv-loaded"><span style="font-size:16px;">✓</span> <span>Loaded <strong>'+cascadingData.length+'</strong> distribution points</span></div>';
            onUserIdInput();populateCredentialsTable();
        },
        error:function(){csvLoaded=false;if(el)el.innerHTML='<div class="csv-error"><span style="font-size:16px;">✗</span> <span>CSV not loaded — place cascading_data.csv in same folder</span></div>';}
    });
}

// ============================================
// CREDENTIALS TABLE
// ============================================
function populateCredentialsTable(){
    var tb=document.getElementById('credTableBody');if(!tb)return;tb.innerHTML='';
    for(var uid in USERS_DB){var u=USERS_DB[uid];var dpN=u.dp_id;
        if(csvLoaded){var r=cascadingData.find(function(x){return x.dp_id===u.dp_id;});if(r)dpN=r.distribution_point;}
        var tr=document.createElement('tr');tr.innerHTML='<td class="uid">'+uid+'</td><td class="pwd">'+u.password+'</td><td>'+u.name+'</td><td>'+dpN+'</td>';tb.appendChild(tr);
    }
}
function toggleCredentials(){var w=document.getElementById('credTableWrap'),c=document.getElementById('credChevron');if(!w)return;if(w.style.display==='none'){w.style.display='block';if(c)c.classList.add('open');populateCredentialsTable();}else{w.style.display='none';if(c)c.classList.remove('open');}}

// ============================================
// USER ID → AUTO-FILL
// ============================================
function onUserIdInput(){
    var uid=document.getElementById('loginUserId').value.trim().toLowerCase(),block=document.getElementById('autoAssignment');
    if(!uid||!USERS_DB[uid]||!csvLoaded){if(block)block.style.display='none';return;}
    var dpRow=cascadingData.find(function(r){return r.dp_id===USERS_DB[uid].dp_id;});
    if(!dpRow){if(block)block.style.display='none';return;}
    document.getElementById('assignDP').value=dpRow.distribution_point||'';
    document.getElementById('assignDistrict').value=dpRow.district||'';
    document.getElementById('assignChiefdom').value=dpRow.chiefdom||'';
    document.getElementById('assignCommunity').value=dpRow.community||'';
    if(block)block.style.display='block';
}

// ============================================
// EVENTS
// ============================================
function setupEventListeners(){
    window.addEventListener('online',function(){state.isOnline=true;updateOnlineStatus();showNotification('Back online!','success');});
    window.addEventListener('offline',function(){state.isOnline=false;updateOnlineStatus();showNotification('Offline — data saved locally','warning');});
    document.addEventListener('input',function(e){
        if(e.target.classList.contains('phone-field')||e.target.type==='tel')e.target.value=e.target.value.replace(/\D/g,'').slice(0,9);
        if(e.target.classList.contains('name-field'))e.target.value=e.target.value.replace(/[0-9]/g,'');
    });
    document.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.id==='dist_voucher_scan'){e.preventDefault();verifyVoucher();}});
}
function updateOnlineStatus(){
    var i=document.getElementById('statusIndicator'),t=document.getElementById('statusText');if(!i||!t)return;
    if(state.isOnline){i.className='status-indicator online';t.textContent='ONLINE';}
    else{i.className='status-indicator offline';t.textContent='OFFLINE';}
}

// ============================================
// LOGIN / LOGOUT
// ============================================
function handleLogin(){
    var uid=document.getElementById('loginUserId').value.trim().toLowerCase(),pw=document.getElementById('loginPassword').value,err=document.getElementById('loginError');err.textContent='';
    if(!uid||!pw){err.textContent='Enter User ID and Password';return;}
    var u=USERS_DB[uid];if(!u||u.password!==pw){err.textContent='Invalid credentials';return;}
    if(!csvLoaded){err.textContent='CSV not loaded yet';return;}
    var dp=cascadingData.find(function(r){return r.dp_id===u.dp_id;});
    if(!dp){err.textContent='DP '+u.dp_id+' not found in CSV';return;}
    state.isLoggedIn=true;state.currentUser={id:uid,name:u.name,role:u.role};
    state.currentDP={id:dp.dp_id,name:dp.distribution_point,district:dp.district,chiefdom:dp.chiefdom,community:dp.community};
    state.geoInfo={district:dp.district,chiefdom:dp.chiefdom,community:dp.community,distributionPoint:dp.distribution_point};
    saveToStorage();showAppScreen();showNotification('Welcome, '+u.name+'!','success');
}
function handleLogout(){if(!confirm('Log out?'))return;state.isLoggedIn=false;state.currentUser=null;state.currentDP=null;saveToStorage();
    document.getElementById('appScreen').style.display='none';document.getElementById('loginScreen').style.display='block';
    document.getElementById('loginUserId').value='';document.getElementById('loginPassword').value='';
    document.getElementById('loginError').textContent='';document.getElementById('autoAssignment').style.display='none';
}
function showAppScreen(){
    document.getElementById('loginScreen').style.display='none';document.getElementById('appScreen').style.display='block';
    var ut=document.getElementById('userTag');if(ut)ut.textContent=state.currentUser.name.split(' ')[0].toUpperCase();
    document.getElementById('geoDistrict').textContent=state.geoInfo.district||'—';
    document.getElementById('geoChiefdom').textContent=state.geoInfo.chiefdom||'—';
    document.getElementById('geoCommunity').textContent=state.geoInfo.community||'—';
    document.getElementById('geoDP').textContent=state.geoInfo.distributionPoint||'—';
    updateOnlineStatus();updateAllCounts();updateStockSummary();updateDistHistory();updateSyncStats();generateHHId();captureRegGPS();checkStockForDistribution();
    var df=document.getElementById('itn_recv_date');if(df&&!df.value)df.value=new Date().toISOString().split('T')[0];
}

// ============================================
// TABS
// ============================================
function switchTab(id){
    document.querySelectorAll('.tab-controls .control-btn').forEach(function(b){b.classList.remove('active');});
    document.querySelector('.tab-controls [data-tab="'+id+'"]').classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(function(p){p.classList.remove('active');});
    document.getElementById('tab-'+id).classList.add('active');
    if(id==='distribution'){setTimeout(function(){var s=document.getElementById('dist_voucher_scan');if(s)s.focus();},100);checkStockForDistribution();}
    if(id==='dashboard')refreshDashboard();
}

// ============================================
// STOCK CHECK FOR DISTRIBUTION
// ============================================
function getStockReceived(){var t=0;state.itnStock.forEach(function(s){t+=s.quantity;});return t;}
function getDistributed(){return state.distributions.length;}
function getStockRemaining(){return getStockReceived()-getDistributed();}

function checkStockForDistribution(){
    var warn=document.getElementById('stockWarning'),txt=document.getElementById('stockWarningText');if(!warn)return;
    var received=getStockReceived(),remaining=getStockRemaining();
    if(received===0){warn.style.display='flex';txt.textContent='No ITN stock received yet! Go to ITN STOCK tab first to record received stock before distributing.';return;}
    if(remaining<=0){warn.style.display='flex';txt.textContent='All stock distributed! ('+received+' received, '+getDistributed()+' distributed). Record more stock in ITN STOCK tab.';return;}
    if(remaining<=5){warn.style.display='flex';warn.style.background='#fff3cd';warn.style.borderColor='#ffc107';warn.style.color='#856404';txt.textContent='Low stock warning: Only '+remaining+' ITN(s) remaining.';return;}
    warn.style.display='none';
}

// ============================================
// VOUCHER CODE GEN
// ============================================
function generateVoucherCode(){
    var dp=state.currentDP?state.currentDP.id.replace('dp','').toUpperCase():'XX';
    var d=new Date(),date=d.getFullYear()+''+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
    return 'VCH-'+dp.padStart(3,'0')+'-'+date+'-'+Math.random().toString(36).toUpperCase().slice(2,8);
}
function generateHHId(){
    var dp=state.currentDP?state.currentDP.id.replace('dp','').toUpperCase():'XX';
    var el=document.getElementById('reg_hh_id');
    if(el)el.value='HH-'+dp.padStart(3,'0')+'-'+Date.now().toString(36).toUpperCase().slice(-6)+'-'+Math.random().toString(36).toUpperCase().slice(2,5);
}

// ============================================
// REGISTRATION FORM HANDLERS
// ============================================
function onTotalPeopleChange(){var t=parseInt(document.getElementById('reg_total_people').value)||0;showVoucherPreview(t);checkGenderSum();}
function onGenderChange(){checkGenderSum();}
function onVulnerableChange(){
    var t=parseInt(document.getElementById('reg_total_people').value)||0,f=parseInt(document.getElementById('reg_females').value)||0;
    var u5=parseInt(document.getElementById('reg_under5').value)||0,pr=parseInt(document.getElementById('reg_pregnant').value)||0;
    var eU=document.getElementById('error_reg_under5'),eP=document.getElementById('error_reg_pregnant');
    if(u5>t){if(eU){eU.textContent='Cannot exceed total';eU.classList.add('show');}}else{if(eU){eU.textContent='';eU.classList.remove('show');}}
    if(pr>f){if(eP){eP.textContent='Cannot exceed females';eP.classList.add('show');}}else{if(eP){eP.textContent='';eP.classList.remove('show');}}
}
function checkGenderSum(){
    var t=parseInt(document.getElementById('reg_total_people').value)||0,m=parseInt(document.getElementById('reg_males').value)||0,f=parseInt(document.getElementById('reg_females').value)||0;
    var el=document.getElementById('genderCheck'),tx=document.getElementById('genderCheckText');if(!el||!tx)return;
    if(t>0&&(m>0||f>0)){el.style.display='flex';
        if(m+f===t){el.className='validation-note gender-check match';tx.textContent='✓ Males ('+m+') + Females ('+f+') = Total ('+t+')';}
        else{el.className='validation-note gender-check mismatch';tx.textContent='⚠ Males ('+m+') + Females ('+f+') = '+(m+f)+' ≠ Total ('+t+')';}
    }else el.style.display='none';
}
function showVoucherPreview(tp){
    var b=document.getElementById('voucherPreview');if(tp<=0){b.style.display='none';return;}
    var c;if(tp<=3)c=1;else if(tp<=5)c=2;else c=3;b.style.display='block';
    document.getElementById('voucherPreviewContent').innerHTML='<div class="voucher-formula-text">'+tp+' people → '+c+' voucher(s) = '+c+' ITN(s)</div>';
}

// GPS
function captureRegGPS(){
    var dot=document.getElementById('regGpsDot'),text=document.getElementById('regGpsText'),coords=document.getElementById('regGpsCoords');
    if(!navigator.geolocation){if(dot)dot.className='gps-icon error';if(text)text.textContent='GPS not supported';return;}
    if(dot)dot.className='gps-icon loading';if(text)text.textContent='Capturing...';if(coords)coords.textContent='';
    navigator.geolocation.getCurrentPosition(function(p){
        document.getElementById('reg_gps_lat').value=p.coords.latitude.toFixed(6);
        document.getElementById('reg_gps_lng').value=p.coords.longitude.toFixed(6);
        document.getElementById('reg_gps_acc').value=Math.round(p.coords.accuracy);
        if(dot)dot.className='gps-icon success';if(text)text.textContent='GPS captured!';
        if(coords)coords.textContent=p.coords.latitude.toFixed(5)+', '+p.coords.longitude.toFixed(5)+' (±'+Math.round(p.coords.accuracy)+'m)';
    },function(){if(dot)dot.className='gps-icon error';if(text)text.textContent='GPS failed (optional)';},{enableHighAccuracy:true,timeout:15000});
}

// ============================================
// SUBMIT REGISTRATION
// ============================================
function submitRegistration(){
    var name=document.getElementById('reg_hh_name').value.trim(),phone=document.getElementById('reg_hh_phone').value.trim();
    var total=parseInt(document.getElementById('reg_total_people').value)||0;
    var males=parseInt(document.getElementById('reg_males').value)||0,females=parseInt(document.getElementById('reg_females').value)||0;
    var under5=parseInt(document.getElementById('reg_under5').value)||0,pregnant=parseInt(document.getElementById('reg_pregnant').value)||0;
    var hhId=document.getElementById('reg_hh_id').value;
    var err=[];
    if(!name||name.length<2)err.push('Name required');if(/[0-9]/.test(name))err.push('No numbers in name');
    if(!phone||phone.length!==9)err.push('9-digit phone required');if(total<1)err.push('Total ≥ 1');
    if(males+females!==total)err.push('Males + Females must = total');if(under5>total)err.push('Under5 ≤ total');if(pregnant>females)err.push('Pregnant ≤ females');
    if(err.length){showNotification(err[0],'error');return;}
    var count;if(total<=3)count=1;else if(total<=5)count=2;else count=3;
    var vouchers=[];for(var i=0;i<count;i++){var code;do{code=generateVoucherCode();}while(vouchers.includes(code));vouchers.push(code);}
    var rec={id:hhId,timestamp:new Date().toISOString(),distributionPoint:state.currentDP?state.currentDP.name:'',dpId:state.currentDP?state.currentDP.id:'',
        district:state.geoInfo.district,chiefdom:state.geoInfo.chiefdom,community:state.geoInfo.community,
        registeredBy:state.currentUser?state.currentUser.name:'',userId:state.currentUser?state.currentUser.id:'',
        hhName:name,hhPhone:phone,totalPeople:total,males:males,females:females,under5:under5,pregnant:pregnant,
        vouchers:vouchers,voucherCount:vouchers.length,
        gpsLat:document.getElementById('reg_gps_lat').value,gpsLng:document.getElementById('reg_gps_lng').value,gpsAcc:document.getElementById('reg_gps_acc').value,
        status:'registered',distributed:false,synced:false};
    state.registrations.push(rec);saveToStorage();
    showNotification('Registered! '+vouchers.length+' voucher(s)','success');
    sendToSheet('registration',rec);updateAllCounts();
    lastReceipt=rec;buildReceipt(rec);
    document.getElementById('receiptSection').style.display='block';
    document.getElementById('receiptSection').scrollIntoView({behavior:'smooth'});
}

// ============================================
// RECEIPT
// ============================================
function buildReceipt(rec){
    var c=document.getElementById('voucherReceipt');
    var ds=new Date(rec.timestamp).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
    var ts=new Date(rec.timestamp).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    var vc='';rec.vouchers.forEach(function(v,i){
        vc+='<div class="receipt-voucher-item"><span class="receipt-voucher-label">VOUCHER '+(i+1)+'</span><span class="receipt-voucher-code">'+v+'</span></div>';
        vc+='<div class="receipt-barcode">'+genBarcode(v)+'<div class="receipt-barcode-text">'+v+'</div></div>';
    });
    c.innerHTML='<div class="receipt-header"><h2>ITN MASS CAMPAIGN</h2><p>ITN Distribution — Sierra Leone</p></div><div class="receipt-divider"></div><div class="receipt-body">'+
        '<div class="receipt-hh-name">'+rec.hhName+'</div><div class="receipt-hh-id">'+rec.id+'</div>'+
        '<div class="receipt-info-grid"><div class="receipt-info-item"><div class="receipt-info-label">Phone</div><div class="receipt-info-value">'+rec.hhPhone+'</div></div>'+
        '<div class="receipt-info-item"><div class="receipt-info-label">HH Size</div><div class="receipt-info-value">'+rec.totalPeople+' ('+rec.males+'M/'+rec.females+'F)</div></div>'+
        '<div class="receipt-info-item"><div class="receipt-info-label">Under 5</div><div class="receipt-info-value">'+rec.under5+'</div></div>'+
        '<div class="receipt-info-item"><div class="receipt-info-label">Pregnant</div><div class="receipt-info-value">'+rec.pregnant+'</div></div>'+
        '<div class="receipt-info-item"><div class="receipt-info-label">District</div><div class="receipt-info-value">'+rec.district+'</div></div>'+
        '<div class="receipt-info-item"><div class="receipt-info-label">Chiefdom</div><div class="receipt-info-value">'+rec.chiefdom+'</div></div></div>'+
        '<div class="receipt-vouchers-title">'+rec.voucherCount+' VOUCHER(S) — '+rec.voucherCount+' ITN(S)</div>'+vc+
        '<div class="receipt-important"><div class="receipt-important-text">⚠ BRING THIS RECEIPT TO DISTRIBUTION DESK TO COLLECT ITN(S)</div></div></div>'+
        '<div class="receipt-footer"><div class="receipt-footer-dp">'+rec.distributionPoint+'</div><div class="receipt-footer-text">By: '+rec.registeredBy+'</div><div class="receipt-footer-date">'+ds+' '+ts+'</div></div>';
}
function genBarcode(t){var s='<svg width="220" height="45" viewBox="0 0 220 45" xmlns="http://www.w3.org/2000/svg">',x=5;
    for(var i=0;i<t.length;i++){var b=t.charCodeAt(i).toString(2).padStart(8,'0');
        for(var j=0;j<b.length;j++){if(b[j]==='1'){var w=j%3===0?2.5:1.2;s+='<rect x="'+x+'" y="2" width="'+w+'" height="36" fill="#000"/>';x+=w+1;}else x+=1.5;}x+=1;}
    return s+'</svg>';}
function downloadReceiptImage(){var el=document.getElementById('voucherReceipt');showNotification('Generating image...','info');
    html2canvas(el,{scale:2,backgroundColor:'#fff',useCORS:true,logging:false,allowTaint:true}).then(function(canvas){
        var a=document.createElement('a');var n=lastReceipt?lastReceipt.hhName.replace(/\s+/g,'_'):'receipt';
        a.download='ITN_Voucher_'+n+'_'+new Date().toISOString().split('T')[0]+'.png';a.href=canvas.toDataURL('image/png');a.click();
        showNotification('Image downloaded!','success');
    }).catch(function(){showNotification('Image failed — try PDF','error');});}
function downloadReceiptPDF(){var el=document.getElementById('voucherReceipt');showNotification('Generating PDF...','info');
    html2canvas(el,{scale:2,backgroundColor:'#fff',useCORS:true,logging:false,allowTaint:true}).then(function(canvas){
        var img=canvas.toDataURL('image/png'),pdf=new jspdf.jsPDF('p','mm','a4');
        var pw=pdf.internal.pageSize.getWidth(),ph=pdf.internal.pageSize.getHeight();
        var r=Math.min((pw-20)/canvas.width,(ph-20)/canvas.height),w=canvas.width*r,h=canvas.height*r;
        pdf.addImage(img,'PNG',(pw-w)/2,10,w,h);
        var n=lastReceipt?lastReceipt.hhName.replace(/\s+/g,'_'):'receipt';
        pdf.save('ITN_Voucher_'+n+'_'+new Date().toISOString().split('T')[0]+'.pdf');
        showNotification('PDF downloaded!','success');
    }).catch(function(){showNotification('PDF failed','error');});}
function closeReceipt(){document.getElementById('receiptSection').style.display='none';lastReceipt=null;resetRegForm();}
function resetRegForm(){['reg_hh_name','reg_hh_phone','reg_total_people','reg_males','reg_females','reg_under5','reg_pregnant'].forEach(function(id){document.getElementById(id).value='';});
    document.getElementById('voucherPreview').style.display='none';document.getElementById('genderCheck').style.display='none';
    document.querySelectorAll('.field-error').forEach(function(el){el.textContent='';el.classList.remove('show');});
    generateHHId();captureRegGPS();window.scrollTo({top:0,behavior:'smooth'});}

// ============================================
// DISTRIBUTION — VERIFY (with stock check)
// ============================================
function verifyVoucher(){
    var vc=document.getElementById('dist_voucher_scan').value.trim().toUpperCase(),rb=document.getElementById('verifyResultBlock'),rd=document.getElementById('verifyResult');
    if(!vc){showNotification('Enter voucher code','error');return;}rb.style.display='block';
    // Stock check first
    if(getStockRemaining()<=0){
        rd.innerHTML='<div class="verify-fail"><div class="verify-title"><span style="font-size:22px;">✗</span> NO STOCK AVAILABLE</div><div class="verify-issues"><div class="verify-issue"><span>⚠</span><span>All ITN stock has been distributed ('+getStockReceived()+' received, '+getDistributed()+' distributed). Record more stock in ITN STOCK tab before distributing.</span></div></div></div>';
        document.getElementById('dist_voucher_scan').value='';return;
    }
    var reg=null;for(var i=0;i<state.registrations.length;i++){if(state.registrations[i].vouchers&&state.registrations[i].vouchers.includes(vc)){reg=state.registrations[i];break;}}
    var issues=[],tips=[];
    if(!reg){issues.push('Voucher NOT found');tips.push('Check code is correct');tips.push('Household may need to register first');}
    if(reg){var ed=null;for(var j=0;j<state.distributions.length;j++){if(state.distributions[j].voucherCode===vc){ed=state.distributions[j];break;}}
        if(ed){issues.push('ALREADY REDEEMED on '+new Date(ed.timestamp).toLocaleString());tips.push('Previously: '+ed.hhName);tips.push('Direct to supervisor');}
        if(state.currentDP&&reg.dpId!==state.currentDP.id){issues.push('Registered at "'+reg.distributionPoint+'"');tips.push('Direct to: '+reg.distributionPoint);}
    }
    if(issues.length===0&&reg){
        rd.innerHTML='<div class="verify-pass"><div class="verify-title"><span style="font-size:22px;">✓</span> VERIFIED — PASS</div><div class="verify-detail"><strong>Name:</strong> '+reg.hhName+'<br><strong>Phone:</strong> '+reg.hhPhone+'<br><strong>Size:</strong> '+reg.totalPeople+' ('+reg.males+'M/'+reg.females+'F)<br><strong>Under 5:</strong> '+reg.under5+' | <strong>Pregnant:</strong> '+reg.pregnant+'<br><strong>Voucher:</strong> '+vc+'</div><div class="verify-action"><div class="navigation-buttons"><button type="button" class="btn-nav btn-submit full-width" onclick="confirmDistribution(\''+vc+'\')"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>GIVE ITN & CONFIRM</button></div></div></div>';
    }else{
        var ih=issues.map(function(i){return '<div class="verify-issue"><span>⚠</span><span>'+i+'</span></div>';}).join('');
        var th=tips.map(function(t){return '<div class="verify-tip">'+t+'</div>';}).join('');
        rd.innerHTML='<div class="verify-fail"><div class="verify-title"><span style="font-size:22px;">✗</span> FAILED</div><div class="verify-issues">'+ih+'</div><div class="verify-tips"><div class="verify-tips-title">💡 ACTIONS</div>'+th+'</div></div>';
    }
    document.getElementById('dist_voucher_scan').value='';document.getElementById('dist_voucher_scan').focus();
}
function confirmDistribution(vc){
    // Double-check stock
    if(getStockRemaining()<=0){showNotification('No stock! Cannot distribute.','error');return;}
    var reg=null;for(var i=0;i<state.registrations.length;i++){if(state.registrations[i].vouchers&&state.registrations[i].vouchers.includes(vc)){reg=state.registrations[i];break;}}
    if(!reg)return;
    var rec={id:'DIST-'+Date.now().toString(36).toUpperCase(),timestamp:new Date().toISOString(),voucherCode:vc,registrationId:reg.id,
        hhName:reg.hhName,hhPhone:reg.hhPhone,totalPeople:reg.totalPeople,males:reg.males,females:reg.females,under5:reg.under5,pregnant:reg.pregnant,
        distributionPoint:state.currentDP?state.currentDP.name:'',dpId:state.currentDP?state.currentDP.id:'',
        distributedBy:state.currentUser?state.currentUser.name:'',userId:state.currentUser?state.currentUser.id:'',
        district:state.geoInfo.district,chiefdom:state.geoInfo.chiefdom,community:state.geoInfo.community,status:'distributed',synced:false};
    state.distributions.push(rec);reg.distributed=true;saveToStorage();
    document.getElementById('verifyResultBlock').style.display='none';
    showNotification('ITN → '+reg.hhName+' ('+vc+')','success');
    sendToSheet('distribution',rec);updateAllCounts();updateDistHistory();updateStockSummary();updateSyncStats();checkStockForDistribution();
}
function updateDistHistory(){var c=document.getElementById('distHistory');if(!c)return;var r=state.distributions.slice().reverse().slice(0,30);
    if(!r.length){c.innerHTML='<div class="no-data">No distributions yet</div>';return;}
    c.innerHTML=r.map(function(d){return '<div class="dist-item"><div><div class="dist-hh-name">'+d.hhName+'</div><div class="dist-voucher-code">'+d.voucherCode+'</div></div><div style="text-align:right;"><div class="dist-badge pass">DONE</div><div class="dist-time">'+new Date(d.timestamp).toLocaleTimeString()+'</div></div></div>';}).join('');}

// ============================================
// ITN STOCK
// ============================================
function submitITNReceived(){
    var date=document.getElementById('itn_recv_date').value,batch=document.getElementById('itn_batch').value.trim();
    var type=document.getElementById('itn_recv_type').value,qty=parseInt(document.getElementById('itn_recv_qty').value)||0;
    var from=document.getElementById('itn_recv_from').value.trim(),notes=document.getElementById('itn_recv_notes').value.trim();
    if(!date||!type||qty<1){showNotification('Fill date, type, quantity','error');return;}
    var rec={id:'STK-'+Date.now().toString(36).toUpperCase(),timestamp:new Date().toISOString(),date:date,batch:batch,type:type,quantity:qty,from:from,notes:notes,
        distributionPoint:state.currentDP?state.currentDP.name:'',dpId:state.currentDP?state.currentDP.id:'',recordedBy:state.currentUser?state.currentUser.name:'',synced:false};
    state.itnStock.push(rec);saveToStorage();showNotification(qty+' '+type+' ITNs recorded!','success');sendToSheet('stock',rec);
    ['itn_batch','itn_recv_qty','itn_recv_from','itn_recv_notes'].forEach(function(id){document.getElementById(id).value='';});
    updateStockSummary();updateSyncStats();updateAllCounts();
}
function updateStockSummary(){
    var tR=getStockReceived(),tD=getDistributed();
    var e1=document.getElementById('stockReceived');if(e1)e1.textContent=tR.toLocaleString();
    var e2=document.getElementById('stockDistributed');if(e2)e2.textContent=tD.toLocaleString();
    var e3=document.getElementById('stockRemaining');if(e3)e3.textContent=(tR-tD).toLocaleString();
    var c=document.getElementById('stockHistory');if(!c)return;
    if(!state.itnStock.length){c.innerHTML='<div class="no-data">No stock records</div>';return;}
    c.innerHTML=state.itnStock.slice().reverse().map(function(s){return '<div class="stock-item"><div><strong>'+s.quantity+' '+s.type+'</strong> <span style="color:#999;margin-left:6px;">'+(s.batch||'—')+'</span></div><div style="color:#999;">'+s.date+'</div></div>';}).join('');
}

// ============================================
// DASHBOARD
// ============================================
function refreshDashboard(){
    var regs=state.registrations,dists=state.distributions;
    // Summary cards
    var el=function(id){return document.getElementById(id);};
    el('dshRegCount').textContent=regs.length;el('dshDistCount').textContent=dists.length;el('dshStockRem').textContent=getStockRemaining();
    var totalP=0,totalM=0,totalF=0,totalU5=0,totalPr=0,totalV=0;
    regs.forEach(function(r){totalP+=r.totalPeople;totalM+=r.males;totalF+=r.females;totalU5+=r.under5;totalPr+=r.pregnant;totalV+=r.voucherCount;});
    el('dshPeople').textContent=totalP;el('dshMales').textContent=totalM;el('dshFemales').textContent=totalF;
    el('dshUnder5').textContent=totalU5;el('dshPregnant').textContent=totalPr;el('dshVTotal').textContent=totalV;
    el('dshVRedeemed').textContent=dists.length;el('dshVPending').textContent=totalV-dists.length;
    el('dshAvgHH').textContent=regs.length>0?(totalP/regs.length).toFixed(1):'0';
    // Progress Chart
    var pCtx=document.getElementById('progressChart');
    if(pCtx){
        if(progressChart)progressChart.destroy();
        progressChart=new Chart(pCtx,{type:'doughnut',data:{labels:['Distributed','Pending Vouchers','Stock Remaining'],
            datasets:[{data:[dists.length,Math.max(0,totalV-dists.length),Math.max(0,getStockRemaining()-totalV+dists.length)],
            backgroundColor:['#28a745','#ffc107','#0056a8'],borderWidth:2}]},
            options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{family:'Oswald',size:11}}}}}});
    }
    // Hourly Activity Chart
    var hCtx=document.getElementById('hourlyChart');
    if(hCtx){
        var hours=new Array(24).fill(0),dHours=new Array(24).fill(0);
        regs.forEach(function(r){var h=new Date(r.timestamp).getHours();hours[h]++;});
        dists.forEach(function(d){var h=new Date(d.timestamp).getHours();dHours[h]++;});
        var labels=[];for(var i=6;i<=20;i++)labels.push(i+':00');
        var regData=labels.map(function(_,idx){return hours[idx+6];});
        var distData=labels.map(function(_,idx){return dHours[idx+6];});
        if(hourlyChart)hourlyChart.destroy();
        hourlyChart=new Chart(hCtx,{type:'bar',data:{labels:labels,
            datasets:[{label:'Registrations',data:regData,backgroundColor:'rgba(0,86,168,0.7)',borderRadius:4},
                {label:'Distributions',data:distData,backgroundColor:'rgba(40,167,69,0.7)',borderRadius:4}]},
            options:{responsive:true,scales:{y:{beginAtZero:true,ticks:{stepSize:1,font:{family:'Oswald'}}}},
                plugins:{legend:{labels:{font:{family:'Oswald',size:11}}}}}});
    }
    renderDataTable();
}

// ============================================
// DATA ACCESS TABLE
// ============================================
function renderDataTable(){
    var filter=document.getElementById('dataFilter').value;
    var search=(document.getElementById('dataSearch').value||'').toLowerCase();
    var wrap=document.getElementById('dataTableWrap');
    var data=[],headers=[];
    if(filter==='registrations'){
        headers=['#','Time','Name','Phone','People','M/F','U5','Preg','Vouchers','Status'];
        data=state.registrations.map(function(r,i){
            return {cells:[i+1,new Date(r.timestamp).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),r.hhName,r.hhPhone,r.totalPeople,r.males+'/'+r.females,r.under5,r.pregnant,
                '<span class="mono">'+(r.vouchers||[]).join(', ')+'</span>',r.distributed?'<span style="color:#28a745;font-weight:700;">✓ Distributed</span>':'<span style="color:#fd7e14;font-weight:700;">Pending</span>'],
                searchText:(r.hhName+' '+r.hhPhone+' '+(r.vouchers||[]).join(' ')).toLowerCase()};
        });
    }else if(filter==='distributions'){
        headers=['#','Time','Name','Phone','Voucher','Distributed By'];
        data=state.distributions.map(function(d,i){
            return {cells:[i+1,new Date(d.timestamp).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),d.hhName,d.hhPhone,'<span class="mono">'+d.voucherCode+'</span>',d.distributedBy],
                searchText:(d.hhName+' '+d.hhPhone+' '+d.voucherCode).toLowerCase()};
        });
    }else{
        headers=['#','Date','Batch','Type','Qty','From','Recorded By'];
        data=state.itnStock.map(function(s,i){
            return {cells:[i+1,s.date,s.batch||'—',s.type,s.quantity,s.from||'—',s.recordedBy],
                searchText:(s.batch+' '+s.type+' '+s.from).toLowerCase()};
        });
    }
    if(search)data=data.filter(function(d){return d.searchText.includes(search);});
    if(!data.length){wrap.innerHTML='<div class="no-data">No records found</div>';return;}
    var html='<table class="data-table"><thead><tr>'+headers.map(function(h){return '<th>'+h+'</th>';}).join('')+'</tr></thead><tbody>';
    data.forEach(function(d){html+='<tr>'+d.cells.map(function(c){return '<td>'+c+'</td>';}).join('')+'</tr>';});
    html+='</tbody></table>';wrap.innerHTML=html;
}

// ============================================
// SYNC
// ============================================
function updateSyncStats(){
    var p=state.registrations.filter(function(r){return !r.synced;}).length+state.distributions.filter(function(d){return !d.synced;}).length+state.itnStock.filter(function(s){return !s.synced;}).length;
    var t=state.registrations.filter(function(r){return r.synced;}).length+state.distributions.filter(function(d){return d.synced;}).length+state.itnStock.filter(function(s){return s.synced;}).length;
    var e1=document.getElementById('syncPending');if(e1)e1.textContent=p;
    var e2=document.getElementById('syncTotal');if(e2)e2.textContent=t;
}
async function syncNow(){
    var gasInput=document.getElementById('gasUrl');if(gasInput&&gasInput.value.trim())CONFIG.SCRIPT_URL=gasInput.value.trim();
    if(!state.isOnline){showNotification('Offline','error');return;}
    if(CONFIG.SCRIPT_URL.includes('YOUR_SCRIPT_ID')){showNotification('Set GAS URL first','error');return;}
    showNotification('Syncing...','info');addSyncLog('Starting sync...');var total=0;
    var pR=state.registrations.filter(function(r){return !r.synced;});
    for(var i=0;i<pR.length;i++){try{await postToGAS('registration',pR[i]);pR[i].synced=true;total++;addSyncLog('Reg '+pR[i].id+' ✓');}catch(e){addSyncLog('Reg '+pR[i].id+' ✗');}}
    var pD=state.distributions.filter(function(d){return !d.synced;});
    for(var j=0;j<pD.length;j++){try{await postToGAS('distribution',pD[j]);pD[j].synced=true;total++;addSyncLog('Dist '+pD[j].id+' ✓');}catch(e){addSyncLog('Dist '+pD[j].id+' ✗');}}
    var pS=state.itnStock.filter(function(s){return !s.synced;});
    for(var k=0;k<pS.length;k++){try{await postToGAS('stock',pS[k]);pS[k].synced=true;total++;addSyncLog('Stock '+pS[k].id+' ✓');}catch(e){addSyncLog('Stock '+pS[k].id+' ✗');}}
    saveToStorage();updateSyncStats();addSyncLog('Done: '+total+' synced');showNotification('Synced '+total+' records!','success');
}
function addSyncLog(msg){state.syncLog.unshift({time:new Date().toLocaleTimeString(),message:msg});if(state.syncLog.length>50)state.syncLog=state.syncLog.slice(0,50);
    var c=document.getElementById('syncLog');if(!c)return;c.innerHTML=state.syncLog.map(function(l){return '<div class="sync-log-item"><span class="sync-log-time">'+l.time+'</span><span>'+l.message+'</span></div>';}).join('');}
function sendToSheet(type,data){if(!state.isOnline||CONFIG.SCRIPT_URL.includes('YOUR_SCRIPT_ID'))return;try{fetch(CONFIG.SCRIPT_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,...data})});}catch(e){}}
function postToGAS(type,data){return fetch(CONFIG.SCRIPT_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,...data})});}

// ============================================
// EXPORT
// ============================================
function exportData(){
    var all=[];
    state.registrations.forEach(function(r){all.push({type:'Registration',id:r.id,timestamp:r.timestamp,district:r.district,chiefdom:r.chiefdom,community:r.community,dp:r.distributionPoint,hhName:r.hhName,hhPhone:r.hhPhone,totalPeople:r.totalPeople,males:r.males,females:r.females,under5:r.under5,pregnant:r.pregnant,vouchers:(r.vouchers||[]).join('; '),voucherCount:r.voucherCount,gpsLat:r.gpsLat,gpsLng:r.gpsLng,registeredBy:r.registeredBy,distributed:r.distributed?'Yes':'No',synced:r.synced?'Yes':'No'});});
    state.distributions.forEach(function(d){all.push({type:'Distribution',id:d.id,timestamp:d.timestamp,district:d.district,dp:d.distributionPoint,hhName:d.hhName,hhPhone:d.hhPhone,totalPeople:d.totalPeople,voucherCode:d.voucherCode,distributedBy:d.distributedBy,synced:d.synced?'Yes':'No'});});
    state.itnStock.forEach(function(s){all.push({type:'Stock',id:s.id,timestamp:s.timestamp,date:s.date,batch:s.batch,itnType:s.type,quantity:s.quantity,from:s.from,dp:s.distributionPoint,recordedBy:s.recordedBy,synced:s.synced?'Yes':'No'});});
    if(!all.length){showNotification('No data','info');return;}
    var keys=new Set();all.forEach(function(item){Object.keys(item).forEach(function(k){keys.add(k);});});var h=Array.from(keys);
    var csv=h.join(',')+'\n';all.forEach(function(item){csv+=h.map(function(k){var v=String(item[k]||'');if(v.includes(',')||v.includes('"')||v.includes('\n'))v='"'+v.replace(/"/g,'""')+'"';return v;}).join(',')+'\n';});
    var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='itn_campaign_'+new Date().toISOString().split('T')[0]+'.csv';a.click();showNotification('Exported!','success');
}

// ============================================
// UTILITIES
// ============================================
function updateAllCounts(){
    var e1=document.getElementById('regCount');if(e1)e1.textContent=state.registrations.length;
    var e2=document.getElementById('distCount');if(e2)e2.textContent=state.distributions.length;
    var e3=document.getElementById('stockCount');if(e3)e3.textContent=getStockReceived();
}
function showNotification(msg,type){var n=document.getElementById('notification'),t=document.getElementById('notificationText');if(!n||!t)return;n.className='notification '+type+' show';t.textContent=msg;setTimeout(function(){n.classList.remove('show');},4000);}

// START
init();
