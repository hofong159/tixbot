// ==UserScript==
// @name         拓元搶票小助手 V10.3.0
// @namespace    http://tampermonkey.net/
// @version      10.3.0
// @description  相容拓元官網、添翼等子站。新增「剩餘票數安全檢測」與「搶先購序號自動通關」機制。完美解決選位卡死問題。
// @author       Gemini
// @match        *://*.tixcraft.com/*
// @include      *://*.tixcraft.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    let config = {
        active: localStorage.getItem('tix_active') === 'true',
        ticketCount: localStorage.getItem('tix_count') || '2',
        keyword: localStorage.getItem('tix_keyword') || '',
        month: localStorage.getItem('tix_month') || '',
        day: localStorage.getItem('tix_day') || '',
        time: localStorage.getItem('tix_time') || '',
        saleTime: localStorage.getItem('tix_saletime') || '',
        presaleCode: localStorage.getItem('tix_presale') || '' // 新增：搶先購票序號
    };
    
    // 新增 presaleSubmitted 防止無限迴圈
    let state = { areaClicked: false, captchaFocused: false, sessionClicked: false, presaleSubmitted: false };

    function createPanel() {
        if (document.getElementById('tix_panel')) return;
        const div = document.createElement('div');
        div.id = 'tix_panel';
        div.style.cssText = 'position: fixed; bottom: 10px; right: 10px; z-index: 999999; background-color: #222; color: white; padding: 15px; border-radius: 8px; font-size: 14px; box-shadow: 0 0 15px rgba(0,0,0,0.8); font-family: sans-serif; border: 1px solid #555; width: 240px;';
        div.innerHTML = `
            <div style="border-bottom:1px solid #555; padding-bottom:5px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#00f2ff; font-weight:bold;">🎫 搶票助手 V10.3.0</span>
                <span id="tix_status" style="font-weight:bold; font-size:12px; color:${config.active ? '#00ff00' : '#ffaaaa'}">${config.active ? 'RUNNING' : 'STOPPED'}</span>
            </div>
            <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <label style="color:#ffcc00; font-weight:bold;">開賣時間(NTP)</label>
                <input type="time" step="1" id="tix_saletime" value="${config.saleTime}" style="width:105px; text-align:center; border-radius:4px; border:none; padding:3px; color:black; font-weight:bold;">
            </div>
            <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <label style="color:#ffcc00; font-weight:bold;">搶先購序號</label>
                <input type="text" id="tix_presale" value="${config.presaleCode}" placeholder="無則免填" style="width:105px; text-align:center; border-radius:4px; border:none; padding:3px; color:black; font-weight:bold;">
            </div>
            <div style="border-top:1px dashed #555; padding-top:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <label>場次日期</label>
                <div>
                    <input type="text" id="tix_month" value="${config.month}" placeholder="03" maxlength="2" style="width:30px; text-align:center; border-radius:4px; border:none; padding:3px; color:black;"> 月
                    <input type="text" id="tix_day" value="${config.day}" placeholder="17" maxlength="2" style="width:30px; text-align:center; border-radius:4px; border:none; padding:3px; color:black;"> 日
                </div>
            </div>
            <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <label>場次時間</label>
                <input type="text" id="tix_time" value="${config.time}" placeholder="1800" maxlength="4" style="width:80px; text-align:center; border-radius:4px; border:none; padding:3px; color:black;">
            </div>
            <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <label>區域關鍵字</label>
                <input type="text" id="tix_keyword" value="${config.keyword}" placeholder="3800" style="width:80px; text-align:center; border-radius:4px; border:none; padding:3px; color:black;">
            </div>
            <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <label>購票張數</label>
                <input type="number" id="tix_count" value="${config.ticketCount}" style="width:60px; text-align:center; border-radius:4px; border:none; padding:3px; color:black;">
            </div>
            <div style="margin-top:10px;">
                <label style="cursor:pointer; display:block; background:#444; padding:8px; text-align:center; border-radius:5px; transition:0.2s;">
                    <input type="checkbox" id="tix_active" ${config.active ? 'checked' : ''} style="display:none;">
                    <span id="tix_btn_text">${config.active ? '🟥 停止腳本' : '🟩 啟動腳本'}</span>
                </label>
            </div>
            <div id="tix_msg" style="font-size:12px; color:#aaa; margin-top:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">等待操作...</div>
        `;
        document.body.appendChild(div);

        const updateConfig = () => {
            localStorage.setItem('tix_count', config.ticketCount);
            localStorage.setItem('tix_keyword', config.keyword);
            localStorage.setItem('tix_month', config.month);
            localStorage.setItem('tix_day', config.day);
            localStorage.setItem('tix_time', config.time);
            localStorage.setItem('tix_saletime', config.saleTime);
            localStorage.setItem('tix_presale', config.presaleCode);
            localStorage.setItem('tix_active', config.active);
            const statusEl = document.getElementById('tix_status');
            const btnText = document.getElementById('tix_btn_text');
            statusEl.textContent = config.active ? 'RUNNING' : 'STOPPED';
            statusEl.style.color = config.active ? '#00ff00' : '#ffaaaa';
            btnText.textContent = config.active ? '🟥 停止腳本' : '🟩 啟動腳本';
            
            if (!config.active) { 
                state.areaClicked = false; state.captchaFocused = false; state.sessionClicked = false; state.presaleSubmitted = false;
            } else {
                checkNtpAndRun();
            }
        };

        document.getElementById('tix_count').addEventListener('input', (e) => { config.ticketCount = e.target.value; updateConfig(); });
        document.getElementById('tix_keyword').addEventListener('input', (e) => { config.keyword = e.target.value; updateConfig(); });
        document.getElementById('tix_month').addEventListener('input', (e) => { config.month = e.target.value; updateConfig(); });
        document.getElementById('tix_day').addEventListener('input', (e) => { config.day = e.target.value; updateConfig(); });
        document.getElementById('tix_time').addEventListener('input', (e) => { config.time = e.target.value; updateConfig(); });
        document.getElementById('tix_saletime').addEventListener('input', (e) => { config.saleTime = e.target.value; updateConfig(); });
        document.getElementById('tix_presale').addEventListener('input', (e) => { config.presaleCode = e.target.value; updateConfig(); });
        document.getElementById('tix_active').addEventListener('change', (e) => { config.active = e.target.checked; updateConfig(); });
    }

    function log(msg) { const el = document.getElementById('tix_msg'); if (el) el.textContent = msg; }

    // ==========================================
    // 核心邏輯 (無縫掛載至 Observer)
    // ==========================================
    function autoRun() {
        if (!config.active) return;

        // --- 優先處理：搶先購票序號自動通關 ---
        if (config.presaleCode && !state.presaleSubmitted) {
            // 尋找疑似序號的輸入框 (排除最後一關的驗證碼輸入框)
            const presaleInput = Array.from(document.querySelectorAll('input[type="text"]:not(#TicketForm_verifyCode), input[type="password"]')).find(el => {
                const id = (el.id || '').toLowerCase();
                const name = (el.name || '').toLowerCase();
                const placeholder = (el.placeholder || '').toLowerCase();
                return id.includes('code') || id.includes('pwd') || id.includes('password') ||
                       name.includes('code') || name.includes('pwd') || name.includes('password') ||
                       placeholder.includes('序號') || placeholder.includes('代碼') || placeholder.includes('密碼');
            });

            if (presaleInput && presaleInput.offsetParent !== null) {
                log(`🔓 輸入搶先購序號...`);
                presaleInput.value = config.presaleCode;
                state.presaleSubmitted = true; // 上鎖，避免無限點擊
                
                // 尋找同一個 Form 裡的送出按鈕
                const form = presaleInput.closest('form');
                if (form) {
                    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], a.btn, button.btn');
                    if (submitBtn) {
                        submitBtn.click();
                    } else {
                        form.submit();
                    }
                }
                return; // 送出後中斷腳本，等待頁面跳轉
            }
        }

        // --- 第一階段：點擊大按鈕 或 場次表格 ---
        if (window.location.href.includes('/activity/detail/') || window.location.href.includes('/activity/game/')) {
            if (state.sessionClicked) return; 

            const rows = Array.from(document.querySelectorAll('tr'));
            let validRows = rows.filter(tr => {
                const btn = tr.querySelector('a, button, input[type="button"], div.btn');
                if (!btn) return false;
                const text = (btn.innerText || btn.value || '').trim();
                return (text.includes('立即訂購') || text.includes('立即購票') || text.includes('Buy Tickets')) && !btn.classList.contains('disabled');
            });

            if (validRows.length > 0) {
                let searchDate = (config.month && config.day) ? `${config.month}/${config.day}` : '';
                let searchTime = config.time;
                if (searchTime.length === 4 && !searchTime.includes(':')) {
                    searchTime = `${searchTime.substring(0,2)}:${searchTime.substring(2,4)}`;
                }

                let targetRow = null;
                if (searchDate || searchTime) {
                    targetRow = validRows.find(tr => {
                        let rowText = tr.innerText;
                        let matchDate = searchDate ? rowText.includes(searchDate) : true;
                        let matchTime = searchTime ? rowText.includes(searchTime) : true;
                        return matchDate && matchTime;
                    });
                }
                if (!targetRow) targetRow = validRows[0];

                let targetBtn = targetRow.querySelector('a, button, input[type="button"], div.btn');
                if (targetBtn && targetBtn.dataset.tixClicked !== 'true') {
                    log(`🚀 點選特定場次...`);
                    targetBtn.dataset.tixClicked = 'true';
                    state.sessionClicked = true; 
                    targetBtn.style.backgroundColor = '#ff0000';
                    targetBtn.style.color = '#ffffff';
                    targetBtn.click();
                    return;
                }
            } else {
                const candidates = Array.from(document.querySelectorAll('a, button, input[type="button"], div.btn'));
                let orderBtn = candidates.find(el => { const text = (el.innerText || el.value || '').trim(); return text.includes('立即訂購') && el.dataset.tixClicked !== 'true' && !el.classList.contains('disabled'); });
                let buyBtn = candidates.find(el => { const text = (el.innerText || el.value || '').trim(); return (text.includes('立即購票') || text.includes('Buy Tickets')) && el.dataset.tixClicked !== 'true' && !el.classList.contains('disabled'); });
                let target = orderBtn || buyBtn;
                if (target) {
                    log(`🚀 點擊: ${target.innerText || target.value}`);
                    target.dataset.tixClicked = 'true';
                    target.style.backgroundColor = '#ff0000';
                    target.style.color = '#ffffff';
                    target.click();
                }
            }
            return;
        } else {
            state.sessionClicked = false;
        }

        // --- 第二階段：區域選擇 (包含剩餘票數智能檢測與微延遲防卡死機制) ---
        const areaList = document.querySelector('.area-list');
        if (areaList) {
            if (state.areaClicked) return;
            const areas = Array.from(areaList.querySelectorAll('a')).filter(a => !a.classList.contains('soldout'));
            
            let target = null;
            let reqCount = parseInt(config.ticketCount) || 1; // 使用者需求的票數

            // 1. 優先尋找「關鍵字符合」且「剩餘票數 >= 需求張數」的區域
            for (let a of areas) {
                let text = a.innerText;

                // 若有設定關鍵字，且不包含該關鍵字，直接跳過
                if (config.keyword && !text.includes(config.keyword)) continue;

                // 提取「剩餘 X」的數字
                let match = text.match(/剩餘\s*(\d+)/);
                if (match) {
                    let remainTickets = parseInt(match[1]);
                    if (remainTickets < reqCount) {
                        log(`⚠️ [${text.split('\n')[0]}] 票數不足 (${remainTickets} < ${reqCount})，跳過`);
                        continue; // 剩餘張數小於需求，跳過此區！
                    }
                }
                
                // 條件符合 (沒有標示剩餘數量代表充足，或者剩餘數量大於需求)
                target = a;
                break; 
            }

            // 2. 降級防呆：如果關鍵字區域都賣完或數量不足，改抓「任何數量足夠」的區域
            if (!target) {
                for (let a of areas) {
                    let match = a.innerText.match(/剩餘\s*(\d+)/);
                    if (!match || parseInt(match[1]) >= reqCount) {
                        target = a;
                        break;
                    }
                }
            }

            // 3. 極限防呆：如果連數量夠的都沒有，抓第一個還能點的 (總比不點好)
            if (!target && areas.length > 0) target = areas[0];

            if (target) { 
                log(`✅ 鎖定區域: ${target.innerText.split('\n')[0]}`); 
                state.areaClicked = true; // 先上鎖，避免 Observer 瘋狂重複觸發
                target.style.border = "5px solid red"; 
                
                // 1. 加入微延遲：給拓元網頁 250 毫秒的時間去綁定 onClick 事件
                setTimeout(() => {
                    target.click();
                    log(`🖱️ 嘗試點擊區域...`);

                    // 2. 自我修復機制：如果點擊被吃掉，1.5 秒後自動解鎖重試
                    setTimeout(() => {
                        // 如果點擊後 1.5 秒，區域選單還在畫面上（代表沒成功跳轉到選張數頁面）
                        if (document.querySelector('.area-list')) {
                            log(`⚠️ 點擊疑似無效，解除鎖定準備重試！`);
                            state.areaClicked = false; // 解鎖，讓 Observer 再次觸發這段邏輯
                            target.style.border = "5px dashed yellow"; // 變更框線提示正在重試
                        }
                    }, 1500);

                }, 250); 
            }
            return;
        }

        // --- 第三階段：選張數與對焦驗證碼 (純手動最高速模式) ---
        const ticketSelect = document.querySelector('select[id^="TicketForm_ticketPrice"]');
        if (ticketSelect) {
            if (state.areaClicked) state.areaClicked = false;
            
            // 自動選張數
            if (ticketSelect.value == '0') { 
                log('🔢 設定張數...'); 
                let count = parseInt(config.ticketCount); 
                if (count > ticketSelect.options.length - 1) count = ticketSelect.options.length - 1; 
                ticketSelect.value = count; 
                ticketSelect.dispatchEvent(new Event('change', { bubbles: true })); 
            }
            
            // 自動勾選同意條款
            const agree = document.getElementById('TicketForm_agree');
            if (agree && !agree.checked) { agree.click(); }
            
            // 自動對焦驗證碼輸入框，準備手動輸入
            const captcha = document.getElementById('TicketForm_verifyCode');
            if (captcha && !state.captchaFocused) { 
                state.captchaFocused = true; 
                captcha.focus(); 
                log('🔥 請快速手動輸入驗證碼！');
            }
        }
    }

    // ==========================================
    // NTP 校時啟動器 & MutationObserver 監視器
    // ==========================================
    let observer = null;

    function startMutationObserver() {
        if (observer) return;
        log('👁️ 極速監視模式啟動');
        autoRun(); // 先掃描一次目前 DOM
        
        observer = new MutationObserver(() => {
            if (config.active) autoRun();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    async function checkNtpAndRun() {
        if (!config.active) return;
        
        // 只有在售票首頁/活動頁，且有設定開賣時間時，才啟動 NTP
        if (config.saleTime && (window.location.href.includes('/activity/detail/') || window.location.href.includes('/activity/game/'))) {
            const now = new Date();
            const [h, m, s] = config.saleTime.split(':');
            
            if (h && m && s) {
                const targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, s).getTime();
                
                try {
                    log('🔄 國家標準時間校時中...');
                    const res = await fetch('https://worldtimeapi.org/api/timezone/Asia/Taipei');
                    const data = await res.json();
                    
                    const serverTime = new Date(data.datetime).getTime();
                    const offset = serverTime - Date.now();
                    const waitTime = targetTime - (Date.now() + offset);

                    // 如果開賣時間在未來的 24 小時內
                    if (waitTime > 0 && waitTime < 86400000) { 
                        log(`⏱️ 校時完畢，將於 ${Math.round(waitTime/1000)} 秒後精準重整...`);
                        
                        // 設定在開賣前 100 毫秒進行畫面重載 (極限壓縮網路延遲)
                        setTimeout(() => {
                            location.reload();
                        }, Math.max(0, waitTime - 100));
                        return; // 中斷後續動作，純粹等待重整
                    }
                } catch (error) {
                    console.error('NTP 校時失敗', error);
                    log('⚠️ 校時失敗，退回標準監視');
                }
            }
        }
        
        // 如果不需要倒數重整 (例如已經開賣了)，直接啟動極速監視
        startMutationObserver();
    }

    // ==========================================
    // 執行點
    // ==========================================
    createPanel();
    checkNtpAndRun();

})();