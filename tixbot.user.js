// ==UserScript==
// @name         拓元搶票小助手 (V 10.0.0)
// @namespace    http://tampermonkey.net/
// @version      10.1
// @description  相容拓元官網、添翼、所有 tixCraft 子站。保留 NTP 校時與 MutationObserver，移除圖形辨識確保最高穩定度。
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
        saleTime: localStorage.getItem('tix_saletime') || '' // NTP 開賣時間
    };

    let state = { areaClicked: false, captchaFocused: false, sessionClicked: false };

    function createPanel() {
        if (document.getElementById('tix_panel')) return;
        const div = document.createElement('div');
        div.id = 'tix_panel';
        div.style.cssText = 'position: fixed; bottom: 10px; right: 10px; z-index: 999999; background-color: #222; color: white; padding: 15px; border-radius: 8px; font-size: 14px; box-shadow: 0 0 10px rgba(0,0,0,0.5); font-family: sans-serif; border: 1px solid #555; width: 240px;';
        div.innerHTML = `
            <div style="border-bottom:1px solid #555; padding-bottom:5px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#00f2ff; font-weight:bold;">🎫 搶票助手 V10 (精簡)</span>
                <span id="tix_status" style="font-weight:bold; font-size:12px; color:${config.active ? '#00ff00' : '#ffaaaa'}">${config.active ? 'RUNNING' : 'STOPPED'}</span>
            </div>
            <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <label style="color:#ffcc00; font-weight:bold;">開賣時間(NTP)</label>
                <input type="time" step="1" id="tix_saletime" value="${config.saleTime}" style="width:105px; text-align:center; border-radius:4px; border:none; padding:3px; color:black; font-weight:bold;">
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
            localStorage.setItem('tix_active', config.active);
            const statusEl = document.getElementById('tix_status');
            const btnText = document.getElementById('tix_btn_text');
            statusEl.textContent = config.active ? 'RUNNING' : 'STOPPED';
            statusEl.style.color = config.active ? '#00ff00' : '#ffaaaa';
            btnText.textContent = config.active ? '🟥 停止腳本' : '🟩 啟動腳本';

            if (!config.active) {
                state.areaClicked = false; state.captchaFocused = false; state.sessionClicked = false;
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
        document.getElementById('tix_active').addEventListener('change', (e) => { config.active = e.target.checked; updateConfig(); });
    }

    function log(msg) { const el = document.getElementById('tix_msg'); if (el) el.textContent = msg; }

    // ==========================================
    // 核心邏輯 (無縫掛載至 Observer)
    // ==========================================
    function autoRun() {
        if (!config.active) return;

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

        // --- 第二階段：區域選擇 ---
        const areaList = document.querySelector('.area-list');
        if (areaList) {
            if (state.areaClicked) return;
            let target = null;
            const areas = Array.from(areaList.querySelectorAll('a')).filter(a => !a.classList.contains('soldout'));
            if (config.keyword) { target = areas.find(a => a.innerText.includes(config.keyword)); }
            if (!target && areas.length > 0) target = areas[0];
            if (target) { log(`✅ 鎖定區域: ${target.innerText}`); state.areaClicked = true; target.style.border = "5px solid red"; target.click(); }
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

        // 使用 Observer 取代原版 setInterval，DOM 一變動立刻攔截
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