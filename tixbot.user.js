// ==UserScript==
// @name         拓元搶票小助手 (V 9.1)
// @namespace    http://tampermonkey.net/
// @version      9.1
// @description  相容拓元官網、添翼、及所有 tixCraft 系統子站
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
        time: localStorage.getItem('tix_time') || ''
    };
    // 新增 sessionClicked 來防止表格連點 Bug
    let state = { areaClicked: false, captchaFocused: false, sessionClicked: false };

    function createPanel() {
        if (document.getElementById('tix_panel')) return;
        const div = document.createElement('div');
        div.id = 'tix_panel';
        div.style.cssText = 'position: fixed; bottom: 10px; right: 10px; z-index: 999999; background-color: #222; color: white; padding: 15px; border-radius: 8px; font-size: 14px; box-shadow: 0 0 10px rgba(0,0,0,0.5); font-family: sans-serif; border: 1px solid #555; width: 230px;';
        div.innerHTML = `
            <div style="border-bottom:1px solid #555; padding-bottom:5px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#00f2ff; font-weight:bold;">🎫 搶票助手 V9</span>
                <span id="tix_status" style="font-weight:bold; font-size:12px; color:${config.active ? '#00ff00' : '#ffaaaa'}">${config.active ? 'RUNNING' : 'STOPPED'}</span>
            </div>
            <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <label>日期</label>
                <div>
                    <input type="text" id="tix_month" value="${config.month}" placeholder="03" maxlength="2" style="width:30px; text-align:center; border-radius:4px; border:none; padding:3px; color:black;"> 月
                    <input type="text" id="tix_day" value="${config.day}" placeholder="17" maxlength="2" style="width:30px; text-align:center; border-radius:4px; border:none; padding:3px; color:black;"> 日
                </div>
            </div>
            <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <label>時間</label>
                <input type="text" id="tix_time" value="${config.time}" placeholder="1800" maxlength="4" style="width:80px; text-align:center; border-radius:4px; border:none; padding:3px; color:black;">
            </div>
            <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <label>區域關鍵字</label>
                <input type="text" id="tix_keyword" value="${config.keyword}" placeholder="3800" style="width:80px; text-align:center; border-radius:4px; border:none; padding:3px; color:black;">
            </div>
            <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <label>張數</label>
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
            localStorage.setItem('tix_active', config.active);
            const statusEl = document.getElementById('tix_status');
            const btnText = document.getElementById('tix_btn_text');
            statusEl.textContent = config.active ? 'RUNNING' : 'STOPPED';
            statusEl.style.color = config.active ? '#00ff00' : '#ffaaaa';
            btnText.textContent = config.active ? '🟥 停止腳本' : '🟩 啟動腳本';
            // 停止腳本時，重置所有鎖定狀態
            if (!config.active) { state.areaClicked = false; state.captchaFocused = false; state.sessionClicked = false; }
        };

        // 綁定輸入事件 (修復了原版無法即時存檔的問題)
        document.getElementById('tix_count').addEventListener('input', (e) => { config.ticketCount = e.target.value; updateConfig(); });
        document.getElementById('tix_keyword').addEventListener('input', (e) => { config.keyword = e.target.value; updateConfig(); });
        document.getElementById('tix_month').addEventListener('input', (e) => { config.month = e.target.value; updateConfig(); });
        document.getElementById('tix_day').addEventListener('input', (e) => { config.day = e.target.value; updateConfig(); });
        document.getElementById('tix_time').addEventListener('input', (e) => { config.time = e.target.value; updateConfig(); });
        document.getElementById('tix_active').addEventListener('change', (e) => { config.active = e.target.checked; updateConfig(); });
    }

    function log(msg) { const el = document.getElementById('tix_msg'); if (el) el.textContent = msg; }

    function autoRun() {
        if (!config.active) return;

        // ================= 第一階段：點擊大按鈕 或 場次表格 =================
        if (window.location.href.includes('/activity/detail/') || window.location.href.includes('/activity/game/')) {
            if (state.sessionClicked) return; // 如果已經點過場次，就鎖住防連點！

            // 1. 先找找看網頁裡有沒有出現「場次表格(tr)」
            const rows = Array.from(document.querySelectorAll('tr'));
            let validRows = rows.filter(tr => {
                const btn = tr.querySelector('a, button, input[type="button"], div.btn');
                if (!btn) return false;
                const text = (btn.innerText || btn.value || '').trim();
                return (text.includes('立即訂購') || text.includes('立即購票') || text.includes('Buy Tickets')) && !btn.classList.contains('disabled');
            });

            if (validRows.length > 0) {
                // 【狀況 A】出現場次表格了！執行日期/時間精準篩選
                let searchDate = (config.month && config.day) ? `${config.month}/${config.day}` : '';
                let searchTime = config.time;
                if (searchTime.length === 4 && !searchTime.includes(':')) {
                    searchTime = `${searchTime.substring(0,2)}:${searchTime.substring(2,4)}`;
                }

                let targetRow = null;
                // 如果你有設定日期或時間，就去配對
                if (searchDate || searchTime) {
                    targetRow = validRows.find(tr => {
                        let rowText = tr.innerText;
                        let matchDate = searchDate ? rowText.includes(searchDate) : true;
                        let matchTime = searchTime ? rowText.includes(searchTime) : true;
                        return matchDate && matchTime;
                    });
                }

                // 如果沒設定，或設定的那場賣完了，就預設點第一個還能買的
                if (!targetRow) targetRow = validRows[0];

                let targetBtn = targetRow.querySelector('a, button, input[type="button"], div.btn');
                if (targetBtn && targetBtn.dataset.tixClicked !== 'true') {
                    log(`🚀 點選特定場次...`);
                    targetBtn.dataset.tixClicked = 'true';
                    state.sessionClicked = true; // 鎖死防連點機制！
                    targetBtn.style.backgroundColor = '#ff0000';
                    targetBtn.style.color = '#ffffff';
                    targetBtn.click();
                    return;
                }
            } else {
                // 【狀況 B】沒找到表格！代表我們還在第一層，執行你原本的「點擊頁籤大按鈕」邏輯
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
            // 如果離開了場次選擇頁面，重置鎖定狀態
            state.sessionClicked = false;
        }

        // ================= 第二階段：區域選擇 (原汁原味) =================
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

        // ================= 第三階段：選張數與驗證碼 (原汁原味) =================
        const ticketSelect = document.querySelector('select[id^="TicketForm_ticketPrice"]');
        if (ticketSelect) {
            if (state.areaClicked) state.areaClicked = false;
            if (ticketSelect.value == '0') { log('🔢 設定張數...'); let count = parseInt(config.ticketCount); if (count > ticketSelect.options.length - 1) count = ticketSelect.options.length - 1; ticketSelect.value = count; ticketSelect.dispatchEvent(new Event('change', { bubbles: true })); }
            const agree = document.getElementById('TicketForm_agree');
            if (agree && !agree.checked) { agree.click(); }
            const captcha = document.getElementById('TicketForm_verifyCode');
            if (captcha && !state.captchaFocused) { log('🔥 輸入驗證碼！'); state.captchaFocused = true; captcha.focus(); }
        }
    }

    createPanel();
    setInterval(autoRun, 200);
})();