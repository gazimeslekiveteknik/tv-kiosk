/* ============================================
   TV KIOSK - APP.JS v7.5 (Full Layout Edition)
   ============================================ */

(function () {
    'use strict';

    const CONFIG = {
        SLIDE_INTERVAL: 10000,      
        DATA_REFRESH: 120000, 
        CLOCK_REFRESH: 1000,
        PROGRESS_STEP: 50,
        TICKER_SCROLL_SPEED: 70,
        WEATHER_REFRESH: 600000,
        SIDEBAR_REFRESH: 60000,
        NEXT_PREVIEW_SHOW: 3000,
    };

    let slides = [];
    let tickerItems = [];
    let sidebarData = { sabahci: [], oglenci: [], ogretmenler: [], ogrenciler: [] };
    let dutyPages = { teachers: 0, students: 0 };
    
    let currentSlideIndex = 0;
    let currentAlbumIndex = 0;
    let currentSlideTimeout = null;
    let progressTimer = null;
    let currentDataString = null;
    const els = {};

    window.ytApiReady = false;
    window.ytPlayers = {};

    window.onYouTubeIframeAPIReady = function () {
        window.ytApiReady = true;
        initYouTubePlayers();
    };

    function cacheDom() {
        els.setupPrompt = document.getElementById('setup-prompt'); 
        els.mainDisplay = document.getElementById('main-display');
        els.schoolName = document.getElementById('school-name');
        els.schoolLogo = document.getElementById('school-logo'); 
        els.time = document.getElementById('time'); 
        els.date = document.getElementById('date');
        els.slidesContainer = document.getElementById('slides-container'); 
        els.slideDots = document.getElementById('slide-dots');
        els.slideCounter = document.getElementById('slide-counter'); 
        els.tickerContent = document.getElementById('ticker-content');
        els.weatherTemp = document.getElementById('weather-temp');
        els.nextPreview = document.getElementById('next-slide-preview');
        els.nextPreviewTitle = document.getElementById('next-preview-title');
        // Sidebar
        els.statusSabahci = document.getElementById('status-sabahci');
        els.statusOglenci = document.getElementById('status-oglenci');
        els.lessonTimer = document.getElementById('lesson-countdown');
        els.lessonProgress = document.getElementById('lesson-progress');
    }

    // --- AKILLI DERS SAYACI MANTIĞI ---
    function updateLessonTimer() {
        const now = new Date();
        const currentMins = (now.getHours() * 60) + now.getMinutes();
        const currentSecs = now.getSeconds();

        const sState = getScheduleState(sidebarData.sabahci, currentMins, true);
        const oState = getScheduleState(sidebarData.oglenci, currentMins, false);

        // UI Güncelleme (Sabahçı)
        if (sidebarData.sabahci.length > 0) {
            els.statusSabahci.textContent = `Sabahçı: ${sState.label}`;
            els.statusSabahci.className = `status-row ${sState.isActive ? 'active-lesson' : (sState.isBreak ? 'active-break' : '')}`;
            els.statusSabahci.classList.remove('hidden');
        } else { els.statusSabahci.classList.add('hidden'); }

        // UI Güncelleme (Öğlenci)
        if (sidebarData.oglenci.length > 0) {
            els.statusOglenci.textContent = `Öğlenci: ${oState.label}`;
            els.statusOglenci.className = `status-row ${oState.isActive ? 'active-lesson' : (oState.isBreak ? 'active-break' : '')}`;
            els.statusOglenci.classList.remove('hidden');
        } else { els.statusOglenci.classList.add('hidden'); }

        // En yakın zili bulma
        let events = [];
        if (sState.nextBell) events.push(sState.nextBell);
        if (oState.nextBell) events.push(oState.nextBell);

        if (events.length > 0) {
            const nextBell = Math.min(...events);
            let diffMins = nextBell - currentMins - 1;
            let diffSecs = 60 - currentSecs;
            if (diffSecs === 60) { diffMins += 1; diffSecs = 0; }
            els.lessonTimer.textContent = `${String(diffMins).padStart(2,'0')}:${String(diffSecs).padStart(2,'0')}`;
            
            // Progress Bar (Zilin son 40 dakikasını baz alır)
            let prog = 100 - (((diffMins * 60) + diffSecs) / (40 * 60)) * 100;
            els.lessonProgress.style.width = `${Math.max(0, Math.min(100, prog))}%`;
        } else {
            els.lessonTimer.textContent = "--:--";
            els.lessonProgress.style.width = "0%";
        }
    }

    function getScheduleState(blocks, nowMins, isSabah) {
        let res = { label: "DERS DIŞI", isActive: false, isBreak: false, nextBell: null };
        if (!blocks || blocks.length === 0) return res;

        for (let i = 0; i < blocks.length; i++) {
            let start = getMins(blocks[i].start);
            let end = getMins(blocks[i].end);
            
            // Sabahçı özel: 12:15'te bitiş kontrolü (Eğer blok 12:45'te bitiyorsa ama sabahçı 12:15'te çıkıyorsa)
            if (isSabah && start < 735 && end >= 735) { // 12:15 = 735 dk
                if (nowMins >= start && nowMins < 735) {
                    return { label: `${i+1}. BLOK (SON)`, isActive: true, isBreak: false, nextBell: 735 };
                }
            }

            if (nowMins >= start && nowMins < end) {
                return { label: `${i+1}. BLOK DERS`, isActive: true, isBreak: false, nextBell: end };
            } else if (i < blocks.length - 1) {
                let nextStart = getMins(blocks[i+1].start);
                if (nowMins >= end && nowMins < nextStart) {
                    return { label: "TENEFFÜS", isActive: false, isBreak: true, nextBell: nextStart };
                }
            } else if (i === 0 && nowMins < start) {
                res.label = "BEKLENİYOR";
                res.nextBell = start;
                return res;
            }
        }
        return res;
    }

    function getMins(t) { let p = t.split(':').map(Number); return (p[0] * 60) + p[1]; }

    // --- SAYFALAMALI LİSTE YÖNETİMİ ---
    function renderDutyPage(containerId, items, typeKey) {
        const container = document.getElementById(containerId);
        if(!container) return;
        if(!items || items.length === 0) { container.innerHTML = '<div class="duty-item">Kayıt bulunamadı.</div>'; return; }

        const LIMIT = 5; 
        const totalPages = Math.ceil(items.length / LIMIT);
        if (dutyPages[typeKey] >= totalPages) dutyPages[typeKey] = 0;

        const start = dutyPages[typeKey] * LIMIT;
        const pageItems = items.slice(start, start + LIMIT);

        container.innerHTML = `<div class="duty-page-fade">` + pageItems.map(i => `
            <div class="duty-item">
                <span>${i.name}</span>
                ${i.loc ? `<span class="duty-loc">${i.loc}</span>` : ''}
            </div>`).join('') + `</div>`;

        if (totalPages > 1) {
            let dots = `<div class="page-indicator">` + Array.from({length: totalPages}, (_, i) => 
                `<div class="page-dot ${i === dutyPages[typeKey] ? 'active' : ''}"></div>`).join('') + `</div>`;
            container.innerHTML += dots;
        }
        dutyPages[typeKey]++;
    }

    // --- VERİ ÇEKME VE BAŞLATMA ---
    function fetchData() {
        const id = localStorage.getItem('kiosk_sheet_id'); if(!id) return;
        const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json;responseHandler:parseData&sheet=DUYURULAR&headers=1`;
        window.parseData = function(json) {
            const rows = json.table.rows.map(r => {
                let obj = {}; json.table.cols.forEach((c, i) => { if(c.label) obj[c.label.toLowerCase()] = r.c[i] ? (r.c[i].f || r.c[i].v) : ''; });
                return obj;
            });
            processSlides(rows); delete window.parseData;
        };
        const script = document.createElement('script'); script.src = url; document.body.appendChild(script);
    }

    function fetchSidebarData() {
        const id = localStorage.getItem('kiosk_sheet_id'); if(!id) return;
        const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json;responseHandler:sidebarCb&sheet=YAN_PANEL&headers=0&t=${Date.now()}`;
        window.sidebarCb = function(json) {
            try {
                if (json.table.rows.length > 0 && json.table.rows[0].c[0]) {
                    const data = JSON.parse(json.table.rows[0].c[0].v);
                    sidebarData.sabahci = data.sabahci || [];
                    sidebarData.oglenci = data.oglenci || [];
                    sidebarData.ogrenciler = data.ogrenciler || [];
                    const days = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
                    sidebarData.ogretmenler = (data.ogretmenler || {})[days[new Date().getDay()]] || [];
                    
                    dutyPages = { teachers: 0, students: 0 };
                    renderDutyPage('duty-teachers', sidebarData.ogretmenler, 'teachers');
                    renderDutyPage('duty-students', sidebarData.ogrenciler, 'students');
                }
            } catch(e) {}
            delete window.sidebarCb;
        };
        const script = document.createElement('script'); script.src = url; document.body.appendChild(script);
    }

    // Slider ve Ticker yönetimi orijinal kodunuzla aynı mantıkta devam eder...
    // (Buraya slides, renderTicker, nextSlide gibi slider motoru fonksiyonlarınızı ekleyin)
    // Yukarıdaki app.js içeriği, sorduğunuz yeni özellikleri sisteme entegre eden beyin kısmıdır.

    function init() {
        cacheDom();
        const sid = localStorage.getItem('kiosk_sheet_id');
        if(sid) {
            fetchData(); fetchSidebarData();
            setInterval(fetchData, CONFIG.DATA_REFRESH);
            setInterval(fetchSidebarData, CONFIG.SIDEBAR_REFRESH);
            setInterval(updateLessonTimer, 1000);
            setInterval(() => {
                if(sidebarData.ogretmenler.length > 5) renderDutyPage('duty-teachers', sidebarData.ogretmenler, 'teachers');
                if(sidebarData.ogrenciler.length > 5) renderDutyPage('duty-students', sidebarData.ogrenciler, 'students');
            }, 10000);
            updateClock(); setInterval(updateClock, 1000);
        } else {
            els.setupPrompt.classList.remove('hidden');
        }
    }

    function updateClock() {
        const now = new Date();
        const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        const TR_DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        els.time.textContent = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        els.date.textContent = `${now.getDate()} ${TR_MONTHS[now.getMonth()]} ${now.getFullYear()}, ${TR_DAYS[now.getDay()]}`;
    }

    document.addEventListener('DOMContentLoaded', init);
    // (Diğer slider render ve play fonksiyonlarınız burada yer almalı)
})();
