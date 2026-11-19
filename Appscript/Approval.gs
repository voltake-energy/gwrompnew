<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sahkan Laporan - VOLTAKE ENERGY</title>
    <script src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #eef2f5; margin: 0; padding: 20px; color: #333; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #2c3e50; padding-bottom: 15px; margin-bottom: 20px; }
        .header h2 { margin: 0 0 8px 0; color: #2c3e50; }
        .header p { margin: 0; font-size: 14px; color: #666; }

        .meta-box {
            background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 6px;
            padding: 14px 16px; margin-bottom: 20px; font-size: 13px;
        }
        .meta-row { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; }
        .meta-row span:first-child { color: #777; flex-shrink: 0; }
        .meta-row span:last-child { text-align: right; font-weight: 600; color: #2c3e50; }

        .pdf-viewer { width: 100%; height: 600px; border: 2px solid #ddd; border-radius: 6px; margin-bottom: 25px; overflow: hidden; background: #fafafa;}
        .pdf-viewer iframe { width: 100%; height: 100%; border: none; }

        .input-group { margin-bottom: 15px; }
        .input-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 5px; }
        .input-group input { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 15px; }
        .input-group input:focus { border-color: #3498db; outline: none; }

        .sig-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
        .sig-tab {
            flex: 1; padding: 10px; font-size: 13px; font-weight: bold;
            border: 1px solid #ccc; background: #fff; color: #7f8c8d;
            border-radius: 4px; cursor: pointer; transition: all 0.2s;
        }
        .sig-tab.active { background: #2c3e50; color: #fff; border-color: #2c3e50; }

        canvas { border: 2px solid #3498db; border-radius: 4px; width: 100%; height: 150px; cursor: crosshair; background: #fff; display: block; touch-action: none; }

        .sig-upload-preview {
            border: 2px dashed #3498db; border-radius: 4px; background: #fff;
            min-height: 130px; display: flex; align-items: center; justify-content: center;
            color: #bbb; font-size: 13px; padding: 8px; margin-top: 10px;
        }
        .sig-checkbox-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 13px; color: #34495e; }
        .sig-checkbox-row input { width: 16px; height: 16px; margin: 0; }
        .sig-hint { font-size: 12px; color: #7f8c8d; margin-top: 8px; line-height: 1.5; }

        .btn-submit { background: #27ae60; color: white; border: none; padding: 14px; width: 100%; font-size: 16px; font-weight: bold; cursor: pointer; margin-top: 20px; border-radius: 4px;}
        .btn-submit:hover { background: #219150; }
        .btn-submit:disabled { background: #95a5a6; cursor: not-allowed; }
        .btn-clear { background: #e74c3c; color: white; border: none; padding: 6px 12px; font-size: 12px; border-radius: 4px; cursor: pointer; float: right; margin-bottom: 5px; }

        #loading { display: none; text-align: center; margin-top: 15px; color: #f39c12; font-weight: bold; }
        #loadingStep { font-size: 12px; color: #7f8c8d; font-weight: normal; margin-top: 4px; }

        .success-box { display: none; background-color: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 6px; text-align: center; margin-top: 20px;}
        .btn-download { display: inline-block; background-color: #2c3e50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 10px; }

        /* ===== BARISAN OFFLINE ===== */
        #pendingBox {
            display: none; background: #fef9e7; border: 1px solid #f7dc6f;
            border-radius: 6px; padding: 16px; margin-bottom: 20px;
        }
        #pendingBox h3 { margin: 0 0 8px 0; color: #7d6608; font-size: 15px; }
        #pendingBox p { margin: 0 0 6px 0; font-size: 13px; color: #7d6608; line-height: 1.55; }
        #pendingState { font-size: 12px; color: #b9770e; font-weight: bold; margin-top: 10px; }
        .btn-retry {
            background: #f39c12; color: #fff; border: none; padding: 11px 18px;
            border-radius: 4px; font-size: 14px; font-weight: bold; cursor: pointer; margin-top: 12px;
        }
        .btn-retry:disabled { background: #d5d8dc; color: #7f8c8d; cursor: not-allowed; }

        .net-bar {
            display: flex; align-items: center; gap: 8px; font-size: 12px;
            font-weight: bold; padding: 8px 12px; border-radius: 4px; margin-bottom: 16px;
        }
        .net-bar .dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .net-online  { background: #eafaf1; color: #1e8449; border: 1px solid #a9dfbf; }
        .net-online .dot  { background: #27ae60; }
        .net-offline { background: #fdf2e9; color: #b9770e; border: 1px solid #f5cba7; }
        .net-offline .dot { background: #e67e22; }

        @media (max-width: 640px) {
            body { padding: 10px; }
            .container { padding: 18px; }
            .pdf-viewer { height: 420px; }
        }
    </style>
</head>
<body>

<div class="container">
    <div class="header">
        <h2>Pengesahan Kerja (Client Approval)</h2>
        <p>Sila semak dokumen laporan di bawah sebelum membuat pengesahan.</p>
    </div>

    <div id="netBar" class="net-bar net-online">
        <span class="dot"></span><span id="netText">Sambungan internet ok</span>
    </div>

    <!-- KOTAK BARISAN: keluar bila pengesahan tersimpan tapi belum sempat dihantar -->
    <div id="pendingBox">
        <h3>Pengesahan anda sudah disimpan</h3>
        <p>
            Tandatangan dan maklumat anda selamat tersimpan dalam peranti ini,
            tetapi belum sempat dihantar sebab sambungan internet tak stabil.
        </p>
        <p>
            Sistem akan cuba hantar sendiri setiap 30 saat dan sebaik sahaja internet pulih.
            <b>Jangan tutup halaman ini</b> kalau boleh — tetapi kalau tertutup pun, data anda
            tidak hilang. Buka semula pautan yang sama bila sudah ada coverage.
        </p>
        <div id="storeWarn" style="display:none; background:#fdecea; border:1px solid #f5b7b1; color:#922b21; padding:11px 13px; border-radius:5px; font-size:12.5px; line-height:1.55; margin-top:10px;"></div>
        <div id="pendingState">Menunggu sambungan...</div>
        <button type="button" class="btn-retry" id="retryBtn" onclick="processQueue(true)">Cuba Hantar Sekarang</button>
    </div>

    <div class="meta-box">
        <div class="meta-row"><span>Report ID</span><span><?= reportData.ReportID ?></span></div>
        <div class="meta-row"><span>Tarikh</span><span><?= reportData.Date ?></span></div>
        <div class="meta-row"><span>No. PO</span><span><?= reportData.PONumber ?></span></div>
        <div class="meta-row"><span>Projek</span><span><?= reportData.ProjectTitle ?></span></div>
        <div class="meta-row"><span>Lokasi</span><span><?= reportData.Location ?></span></div>
    </div>

    <div class="pdf-viewer">
        <iframe src="https://drive.google.com/file/d/<?= reportData.DraftPdfId ?>/preview" loading="lazy"></iframe>
    </div>

    <div id="formSection">
        <h3 style="color: #2c3e50; margin-top: 0;">Ruangan Pengesahan Klien</h3>

        <div class="input-group">
            <label>Nama Klien</label>
            <input type="text" id="clientName" placeholder="Masukkan nama penuh anda" required>
        </div>
        <div class="input-group">
            <label>Jawatan</label>
            <input type="text" id="clientPos" placeholder="Masukkan jawatan" required>
        </div>
        <div class="input-group">
            <label>No. Telefon Klien</label>
            <input type="tel" id="clientPhone" placeholder="cth: 0123456789" required>
        </div>
        <div class="input-group">
            <label>Emel Klien (Salinan GWR PDF akan dihantar ke emel ini)</label>
            <input type="email" id="clientEmail" placeholder="cth: admin@syarikat.com" required>
        </div>

        <label style="font-size: 13px; font-weight: 600; display:block; margin-bottom:8px;">Tandatangan Digital</label>

        <div class="sig-tabs">
            <button type="button" id="sigTabDraw" class="sig-tab active" onclick="setSigMode('draw')">✍️ Lukis Terus</button>
            <button type="button" id="sigTabUpload" class="sig-tab" onclick="setSigMode('upload')">📤 Upload Gambar</button>
        </div>

        <div id="sigDrawArea">
            <div style="overflow:hidden;">
                <button type="button" class="btn-clear" onclick="clearCanvas()">Padam Semula</button>
            </div>
            <canvas id="sigCanvas"></canvas>
            <div class="sig-hint">Guna jari (telefon) atau tetikus (komputer) untuk menandatangani dalam kotak di atas.</div>
        </div>

        <div id="sigUploadArea" style="display:none;">
            <input type="file" id="sigUploadInput" accept="image/*" onchange="handleSigUpload(this)" style="width:100%; padding:10px; border:1px dashed #7f8c8d; border-radius:4px; background:#fff; box-sizing:border-box;">
            <div class="sig-checkbox-row">
                <input type="checkbox" id="sigRemoveBg" checked onchange="reprocessSigUpload()">
                <label for="sigRemoveBg" style="margin:0; font-weight:600;">Buang latar putih (untuk sign atas kertas)</label>
            </div>
            <div class="sig-upload-preview" id="sigUploadPreview">Belum ada gambar tandatangan</div>
            <div class="sig-hint">
                Tip: sign atas kertas putih, ambil gambar dalam keadaan terang dan rata, kemudian upload di sini.
                Sistem akan buang latar putih secara automatik supaya tandatangan nampak kemas dalam PDF.
            </div>
            <div style="overflow:hidden;">
                <button type="button" class="btn-clear" onclick="clearSigUpload()">Padam Gambar</button>
            </div>
        </div>

        <button class="btn-submit" id="submitBtn" onclick="processAndSubmit()">Sahkan &amp; Luluskan Laporan Ini</button>
        <p style="font-size:11.5px; color:#95a5a6; text-align:center; margin-top:10px; line-height:1.55;">
            Kalau halaman ini dibuka dari WhatsApp dan anda menghadapi masalah,
            tekan menu <b>&#8943;</b> di bawah dan pilih <b>Buka dalam Safari</b> atau <b>Chrome</b>.
        </p>
        <div id="loading">
            Memproses Pengesahan...
            <div id="loadingStep">Menyediakan dokumen</div>
        </div>
    </div>

    <div id="successMessage" class="success-box">
        <h3 style="color: #155724; margin-top: 0;">✅ Pengesahan Berjaya!</h3>
        <p style="color: #155724;">Status laporan kini <strong>Approved</strong>.</p>
        <p style="color: #155724;" id="emailSentMsg"></p>
        <hr style="border-color: #c3e6cb; margin: 15px 0;">
        <p style="color: #155724; font-weight: bold;">Berikut merupakan PDF GWR anda:</p>
        <a href="#" id="finalPdfLinkBtn" class="btn-download" target="_blank">Lihat / Muat Turun Final PDF</a>
    </div>

</div>

<script>
    const SCRIPT_URL = "<?= scriptUrl ?>";
    const APPROVAL_TOKEN = "<?= reportData.ApprovalToken ?>";

    const DB_NAME = 'voltakeGWR_approval';
    const DB_STORE = 'queue';
    const SEND_TIMEOUT_MS = 90000;   // PDF akhir besar, beri masa lebih
    const RETRY_INTERVAL_MS = 30000;

    /* =========================================
       UTILITI
       ========================================= */
    function uuid() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : ((r & 0x3) | 0x8)).toString(16);
        });
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
    }

    function setStep(txt) { document.getElementById('loadingStep').innerText = txt; }

    // Semua panggilan ada had masa — elak "tergantung" bila signal lemah
    function postToScript(url, payload) {
        const ctrl = new AbortController();
        const timer = setTimeout(function () { ctrl.abort(); }, SEND_TIMEOUT_MS);

        return fetch(url, { method: 'POST', body: JSON.stringify(payload), signal: ctrl.signal })
            .then(function (r) { clearTimeout(timer); return r.json(); })
            .catch(function (err) {
                clearTimeout(timer);
                if (err && err.name === 'AbortError') throw new Error('Masa tamat — internet terlalu perlahan.');
                throw new Error('Tiada sambungan ke pangkalan data.');
            });
    }

    /* =========================================
       INDEXEDDB — SIMPAN PENGESAHAN DALAM PERANTI
       ========================================= */
    let dbPromise = null;

    function openDB() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise(function (resolve, reject) {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = function () {
                const db = req.result;
                if (!db.objectStoreNames.contains(DB_STORE)) {
                    db.createObjectStore(DB_STORE, { keyPath: 'id' });
                }
            };
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error); };
        });
        return dbPromise;
    }

    function idbPut(job) {
        return openDB().then(function (db) {
            return new Promise(function (res, rej) {
                const tx = db.transaction(DB_STORE, 'readwrite');
                tx.objectStore(DB_STORE).put(job);
                tx.oncomplete = function () { res(job); };
                tx.onerror = function () { rej(tx.error); };
            });
        });
    }

    function idbDelete(id) {
        return openDB().then(function (db) {
            return new Promise(function (res, rej) {
                const tx = db.transaction(DB_STORE, 'readwrite');
                tx.objectStore(DB_STORE).delete(id);
                tx.oncomplete = function () { res(); };
                tx.onerror = function () { rej(tx.error); };
            });
        });
    }

    function idbAll() {
        return openDB().then(function (db) {
            return new Promise(function (res, rej) {
                const tx = db.transaction(DB_STORE, 'readonly');
                const rq = tx.objectStore(DB_STORE).getAll();
                rq.onsuccess = function () { res(rq.result || []); };
                rq.onerror = function () { rej(rq.error); };
            });
        });
    }


    /* =========================================================
       SIMPANAN BERLAPIS (STORAGE FALLBACK)

       Halaman ini disajikan oleh Apps Script di dalam iframe merentas-domain.
       Pada iPhone — terutama dalam in-app browser WhatsApp, atau Safari Private
       Mode — IndexedDB dalam iframe begini kerap disekat oleh sistem.

       Dulu sistem terus berhenti dan klien langsung tak boleh approve.
       Sekarang ia turun tingkat sendiri:
           IndexedDB  ->  localStorage  ->  memori sahaja
       Pengesahan tetap boleh dihantar dalam ketiga-tiga keadaan.
       ========================================================= */
    const LS_KEY = 'voltakeApprovalQueue';
    let storeMode = 'idb';
    let memJobs = [];

    async function initStore() {
        try {
            await openDB();
            await idbPut({ id: '__probe__', token: '__probe__' });
            await idbDelete('__probe__');
            storeMode = 'idb';
            return;
        } catch (e) { /* cuba tingkat seterusnya */ }

        try {
            localStorage.setItem('__probe__', '1');
            localStorage.removeItem('__probe__');
            storeMode = 'local';
            return;
        } catch (e) { /* cuba tingkat seterusnya */ }

        storeMode = 'memory';
    }

    function lsRead() {
        try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (e) { return []; }
    }
    function lsWrite(arr) {
        try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); }
        catch (e) { storeMode = 'memory'; memJobs = arr; }
    }

    const store = {
        async put(job) {
            if (storeMode === 'idb') {
                try { return await idbPut(job); } catch (e) { storeMode = 'local'; }
            }
            if (storeMode === 'local') {
                const a = lsRead();
                const i = a.findIndex(function (j) { return j.id === job.id; });
                if (i >= 0) a[i] = job; else a.push(job);
                lsWrite(a);
                return job;
            }
            const i = memJobs.findIndex(function (j) { return j.id === job.id; });
            if (i >= 0) memJobs[i] = job; else memJobs.push(job);
            return job;
        },
        async del(id) {
            if (storeMode === 'idb') {
                try { return await idbDelete(id); } catch (e) { storeMode = 'local'; }
            }
            if (storeMode === 'local') {
                lsWrite(lsRead().filter(function (j) { return j.id !== id; }));
                return;
            }
            memJobs = memJobs.filter(function (j) { return j.id !== id; });
        },
        async all() {
            if (storeMode === 'idb') {
                try { return await idbAll(); } catch (e) { storeMode = 'local'; }
            }
            if (storeMode === 'local') return lsRead();
            return memJobs.slice();
        }
    };

    /* =========================================
       TANDATANGAN — LUKIS
       ========================================= */
    const canvas = document.getElementById('sigCanvas');
    const ctx = canvas.getContext('2d');
    let isDrawing = false;

    let sigMode = 'draw';
    let uploadedSigData = '';
    let lastSigFileDataUrl = '';

    function resizeCanvas() {
        if (sigMode !== 'draw') return;
        const rect = canvas.parentElement.getBoundingClientRect();
        if (rect.width === 0) return;
        canvas.width = rect.width;
        canvas.height = 150;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function startPosition(e) { isDrawing = true; draw(e); }
    function endPosition() { isDrawing = false; ctx.beginPath(); }

    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
        ctx.lineTo(pos.x, pos.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    }

    canvas.addEventListener('mousedown', startPosition);
    canvas.addEventListener('mouseup', endPosition);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('touchstart', startPosition, { passive: false });
    canvas.addEventListener('touchend', endPosition);
    canvas.addEventListener('touchmove', draw, { passive: false });

    function clearCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); }

    function isCanvasBlank() {
        const blank = document.createElement('canvas');
        blank.width = canvas.width; blank.height = canvas.height;
        return canvas.toDataURL() === blank.toDataURL();
    }

    /* =========================================
       TANDATANGAN — UPLOAD
       ========================================= */
    function setSigMode(mode) {
        sigMode = mode;
        document.getElementById('sigTabDraw').classList.toggle('active', mode === 'draw');
        document.getElementById('sigTabUpload').classList.toggle('active', mode === 'upload');
        document.getElementById('sigDrawArea').style.display = mode === 'draw' ? 'block' : 'none';
        document.getElementById('sigUploadArea').style.display = mode === 'upload' ? 'block' : 'none';
        setTimeout(resizeCanvas, 50);
    }

    function handleSigUpload(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) { lastSigFileDataUrl = e.target.result; processSigImage(); };
        reader.readAsDataURL(file);
    }

    function reprocessSigUpload() { if (lastSigFileDataUrl) processSigImage(); }

    function processSigImage() {
        const removeBg = document.getElementById('sigRemoveBg').checked;
        const img = new Image();
        img.onload = function () {
            const maxW = 700;
            const scale = Math.min(1, maxW / img.width);
            const c = document.createElement('canvas');
            c.width = Math.round(img.width * scale);
            c.height = Math.round(img.height * scale);
            const cx = c.getContext('2d');
            cx.drawImage(img, 0, 0, c.width, c.height);

            if (removeBg) {
                try {
                    const d = cx.getImageData(0, 0, c.width, c.height);
                    const p = d.data;
                    for (let i = 0; i < p.length; i += 4) {
                        const lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
                        if (lum > 200) {
                            p[i + 3] = 0;
                        } else if (lum > 150) {
                            p[i + 3] = Math.round(p[i + 3] * (200 - lum) / 50);
                        } else {
                            p[i] = 0; p[i + 1] = 0; p[i + 2] = 0;
                        }
                    }
                    cx.putImageData(d, 0, 0);
                } catch (err) {
                    console.warn('Gagal proses latar:', err);
                }
            }

            uploadedSigData = c.toDataURL('image/png');
            document.getElementById('sigUploadPreview').innerHTML =
                '<img src="' + uploadedSigData + '" style="max-width:100%; max-height:150px; object-fit:contain;">';
        };
        img.onerror = function () { alert('Gagal membaca gambar tandatangan. Sila cuba gambar lain.'); };
        img.src = lastSigFileDataUrl;
    }

    function clearSigUpload() {
        uploadedSigData = '';
        lastSigFileDataUrl = '';
        document.getElementById('sigUploadInput').value = '';
        document.getElementById('sigUploadPreview').innerHTML = 'Belum ada gambar tandatangan';
    }

    function getSignatureData() {
        if (sigMode === 'upload') return uploadedSigData || '';
        return isCanvasBlank() ? '' : canvas.toDataURL('image/png');
    }

    /* =========================================================
       HANTAR PENGESAHAN — MELALUI BARISAN
       Data disimpan dalam peranti DAHULU, barulah cuba hantar.
       Kalau gagal, ia dihantar sendiri bila internet pulih.
       ========================================================= */
    async function processAndSubmit() {
        const name  = document.getElementById('clientName').value.trim();
        const pos   = document.getElementById('clientPos').value.trim();
        const email = document.getElementById('clientEmail').value.trim();
        const phone = document.getElementById('clientPhone').value.trim();

        if (!name || !pos || !email || !phone) {
            alert('Sila isi Nama, Jawatan, No. Telefon dan Emel anda.');
            return;
        }

        if (!isValidEmail(email)) {
            alert('Format emel tidak sah. Salinan Final PDF akan dihantar ke emel ini.');
            document.getElementById('clientEmail').focus();
            return;
        }

        const signatureBase64 = getSignatureData();
        if (!signatureBase64) {
            alert(sigMode === 'upload'
                ? 'Sila upload gambar tandatangan anda.'
                : 'Sila buat tandatangan anda pada ruangan yang disediakan.');
            return;
        }

        document.getElementById('submitBtn').style.display = 'none';
        document.getElementById('loading').style.display = 'block';

        const job = {
            id: uuid(),
            clientReqId: uuid(),
            scriptUrl: SCRIPT_URL,
            token: APPROVAL_TOKEN,
            clientName: name,
            clientPosition: pos,
            clientEmail: email,
            clientPhone: phone,
            signatureBase64: signatureBase64,
            attempts: 0,
            lastError: '',
            createdAt: Date.now()
        };

        // Simpanan hanyalah perlindungan tambahan — ia TIDAK menghalang
        // penghantaran. Kalau peranti menyekatnya, kita teruskan juga.
        setStep('Menyediakan pengesahan...');
        await store.put(job);

        await processQueue(true);
    }

    /* ---------- Proses barisan ---------- */
    let queueRunning = false;

    async function processQueue(manual) {
        if (queueRunning) return;

        let jobs = [];
        try { jobs = await store.all(); } catch (err) { jobs = []; }

        // Hanya kerja untuk laporan ini
        const mine = jobs.filter(function (j) { return j.token === APPROVAL_TOKEN; });
        if (!mine.length) {
            // Mod memori: kerja tak dijumpai selepas reload adalah normal.
            document.getElementById('pendingBox').style.display = 'none';
            return;
        }

        showPending(mine[0], manual ? 'Sedang menghantar...' : null);
        if (!navigator.onLine && !manual) return;

        queueRunning = true;
        document.getElementById('retryBtn').disabled = true;
        document.getElementById('loading').style.display = 'block';

        const job = mine[0];
        try {
            // 1) Ambil draf PDF dari server
            setStep('Mengambil dokumen draf...');
            showPending(job, 'Mengambil dokumen draf...');
            const pdfRes = await postToScript(job.scriptUrl, { action: 'get_draft_pdf', token: job.token });
            if (pdfRes.status !== 'success') throw new Error(pdfRes.message || 'Gagal mengambil draf PDF.');

            // 2) Cop tandatangan
            setStep('Meletakkan tandatangan pada dokumen...');
            showPending(job, 'Meletakkan tandatangan...');
            const finalPdfBytes = await stampSignature(pdfRes.pdf, job.signatureBase64);

            // 3) Hantar
            setStep('Menghantar pengesahan...');
            showPending(job, 'Menghantar pengesahan...');
            const result = await postToScript(job.scriptUrl, {
                action: 'client_approve',
                clientReqId: job.clientReqId,
                token: job.token,
                clientName: job.clientName,
                clientPosition: job.clientPosition,
                clientEmail: job.clientEmail,
                clientPhone: job.clientPhone,
                clientSignatureBase64: job.signatureBase64,
                finalPdfBase64: finalPdfBytes
            });

            if (result.status !== 'success') throw new Error(result.message || 'Ralat pangkalan data.');

            await store.del(job.id);
            queueRunning = false;
            showSuccess(result, job);

        } catch (err) {
            job.attempts = (job.attempts || 0) + 1;
            job.lastError = (err && err.message) ? err.message : 'Ralat tidak diketahui';
            try { await store.put(job); } catch (e2) {}

            queueRunning = false;
            document.getElementById('retryBtn').disabled = false;
            document.getElementById('loading').style.display = 'none';
            document.getElementById('formSection').style.display = 'none';
            showPending(job, 'Cubaan ' + job.attempts + ' gagal: ' + job.lastError);
        }
    }

    async function stampSignature(base64DraftPdf, signatureBase64) {
        const { PDFDocument } = PDFLib;
        const pdfDoc = await PDFDocument.load(base64DraftPdf);
        const pngImage = await pdfDoc.embedPng(signatureBase64);

        const pages = pdfDoc.getPages();
        // Muka surat Verification ialah page 2 (index 1)
        const verificationPage = pages.length >= 2 ? pages[1] : pages[pages.length - 1];
        const { width: pw, height: ph } = verificationPage.getSize();

        // Kedudukan dikira secara nisbah supaya kekal betul walaupun
        // saiz PDF sedikit berbeza.
        verificationPage.drawImage(pngImage, {
            x: pw * 0.134,
            y: ph * 0.712,
            width: pw * 0.235,
            height: ph * 0.059
        });

        return await pdfDoc.saveAsBase64({ dataUri: true });
    }

    function showPending(job, stateText) {
        document.getElementById('formSection').style.display = 'none';
        document.getElementById('pendingBox').style.display = 'block';

        // Peranti yang menyekat simpanan tempatan perlu amaran khas
        const warn = document.getElementById('storeWarn');
        if (warn) {
            if (storeMode === 'memory') {
                warn.style.display = 'block';
                warn.innerHTML = '<b>Penting:</b> peranti anda menyekat simpanan tempatan, ' +
                    'jadi pengesahan ini hanya wujud selagi halaman ini terbuka. ' +
                    '<b>Jangan tutup halaman ini</b> sehingga keluar mesej berjaya. ' +
                    'Kalau ia gagal berulang kali, buka pautan yang sama dalam Safari atau Chrome.';
            } else {
                warn.style.display = 'none';
            }
        }
        if (stateText) document.getElementById('pendingState').innerText = stateText;
        else if (job && job.lastError) document.getElementById('pendingState').innerText =
            'Cubaan ' + job.attempts + ' gagal: ' + job.lastError;
        else document.getElementById('pendingState').innerText = 'Menunggu sambungan...';
    }

    function showSuccess(result, job) {
        document.getElementById('pendingBox').style.display = 'none';
        document.getElementById('formSection').style.display = 'none';
        document.getElementById('loading').style.display = 'none';

        const successDiv = document.getElementById('successMessage');
        // clientEmailSent hanya ada pada respons pertama (bukan respons ulangan)
        document.getElementById('emailSentMsg').innerText = (result.clientEmailSent === false)
            ? 'Emel ke ' + job.clientEmail + ' tidak dapat dihantar. Sila simpan pautan PDF di bawah.'
            : 'Salinan PDF ini juga telah dihantar ke emel anda (' + job.clientEmail + ').';
        if (result.finalPdfLink) {
            document.getElementById('finalPdfLinkBtn').href = result.finalPdfLink;
            document.getElementById('finalPdfLinkBtn').style.display = 'inline-block';
        } else {
            document.getElementById('finalPdfLinkBtn').style.display = 'none';
        }
        successDiv.style.display = 'block';
        window.scrollTo({ top: successDiv.offsetTop, behavior: 'smooth' });
    }

    function resetUI() {
        document.getElementById('submitBtn').style.display = 'block';
        document.getElementById('loading').style.display = 'none';
        setStep('Menyediakan dokumen');
    }

    /* ---------- Status internet & auto-cuba ---------- */
    function updateNetBar() {
        const bar = document.getElementById('netBar');
        const txt = document.getElementById('netText');
        if (navigator.onLine) {
            bar.className = 'net-bar net-online';
            txt.innerText = 'Sambungan internet ok';
        } else {
            bar.className = 'net-bar net-offline';
            txt.innerText = 'Tiada internet — pengesahan anda akan dihantar bila sambungan pulih';
        }
    }

    window.addEventListener('online', function () { updateNetBar(); processQueue(); });
    window.addEventListener('offline', updateNetBar);
    setInterval(function () { processQueue(); }, RETRY_INTERVAL_MS);

    // Bila halaman dibuka semula, sambung penghantaran yang tergendala
    window.addEventListener('load', async function () {
        await initStore();
        updateNetBar();
        processQueue();
    });
</script>

</body>
</html>
