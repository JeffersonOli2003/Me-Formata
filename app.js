const $ = s => document.querySelector(s);
function toast(m) {
    const t = $('#toast');
    t.textContent = m;
    t.classList.add('on');
    clearTimeout(toast.i);
    toast.i = setTimeout(() => t.classList.remove('on'), 3200);
}

async function save(name, data) {
    try {
        const d = window.claude && await claude.use('downloads');
        if (d) { await d.save({ filename: name, data }); return true; }
    } catch (e) { if (e && e.code === 'declined') return false; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data]));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
}

async function share(files, text) {
    const fs = files.map(f => new File([f.blob], f.name, { type: f.blob.type }));
    try {
        if (navigator.canShare && navigator.canShare({ files: fs })) {
            await navigator.share({ files: fs, text: text || "" });
            return;
        }
    } catch (e) { if (e.name === 'AbortError') return; }
    toast('Menu de compartilhar indisponível aqui. Baixando para você anexar.');
    for (const f of files) await save(f.name, f.blob);
}

let out = [];

/* Conversor */
const f1 = $('#f1');
if (f1) {
    f1.onchange = () => {
        const n = f1.files.length;
        $('#sel').textContent = n ? n + ' arquivo(s): ' + [...f1.files].map(f => f.name).join(', ') : 'Nenhum arquivo selecionado.';
        $('#go').disabled = !n;
    };
}

const rd = f => new Promise((ok, er) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = er; r.readAsDataURL(f); });
const img = s => new Promise((ok, er) => { const i = new Image(); i.onload = () => ok(i); i.onerror = er; i.src = s; });
const cv = (w, h, fill) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    if (fill) { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); }
    return c;
};
const blob = (c, t) => new Promise(r => c.toBlob(r, t === 'jpg' ? 'image/jpeg' : 'image/png', .92));
const base = n => n.replace(/\.[^.]+$/, "");
const setWorker = () => { pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; };

async function pages(f) {
    if (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)) {
        setWorker();
        const p = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise, r = [];
        for (let i = 1; i <= p.numPages; i++) {
            const pg = await p.getPage(i), v = pg.getViewport({ scale: 2 }), c = cv(v.width, v.height, true);
            await pg.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
            r.push({ c, n: base(f.name) + (p.numPages > 1 ? '-p' + i : "") });
        }
        return r;
    }
    const i = await img(await rd(f)), c = cv(i.naturalWidth, i.naturalHeight, true);
    c.getContext('2d').drawImage(i, 0, 0);
    return [{ c, n: base(f.name) }];
}

const goBtn = $('#go');
if (goBtn) {
    goBtn.onclick = async () => {
        const to = document.querySelector('input[name=to]:checked').value, b = $('#go');
        b.disabled = true;
        b.textContent = 'Convertendo...';
        out = [];
        try {
            if (to === 'pdf') {
                const PL = window.PDFLib, pdf = await PL.PDFDocument.create();
                for (const f of f1.files) {
                    for (const p of await pages(f)) {
                        const jb = await blob(p.c, 'jpg'), im = await pdf.embedJpg(new Uint8Array(await jb.arrayBuffer())), w = p.c.width * .75, hh = p.c.height * .75;
                        pdf.addPage([w, hh]).drawImage(im, { x: 0, y: 0, width: w, height: hh });
                    }
                }
                out.push({ name: (f1.files.length > 1 ? 'arquivos-juntos' : base(f1.files[0].name)) + '.pdf', blob: new Blob([await pdf.save()], { type: 'application/pdf' }) });
            } else {
                for (const f of f1.files) {
                    for (const p of await pages(f)) {
                        out.push({ name: p.n + '.' + to, blob: await blob(p.c, to) });
                    }
                }
            }
            showConv();
        } catch (e) {
            toast('Não consegui converter este arquivo. Tente outro.');
            console.error(e);
        }
        b.disabled = false;
        b.textContent = 'Converter';
    };
}

function showConv() {
    const L = $('#list');
    if (!L) return;
    L.textContent = "";
    out.forEach((o) => {
        const d = document.createElement('div');
        d.className = 'file';
        if (o.blob.type.startsWith('image/')) {
            const m = document.createElement('img');
            m.alt = "";
            m.src = URL.createObjectURL(o.blob);
            d.append(m);
        }
        const s = document.createElement('span');
        s.textContent = o.name;
        d.append(s);
        const a = document.createElement('button');
        a.textContent = 'Baixar';
        a.onclick = () => save(o.name, o.blob);
        const b = document.createElement('button');
        b.textContent = 'Enviar';
        b.onclick = () => share([o]);
        d.append(a, b);
        L.append(d);
    });
    $('#res').hidden = false;
    $('#res').scrollIntoView({ behavior: 'smooth' });
}

const shAll = $('#shAll');
if (shAll) shAll.onclick = () => share(out);

/* ABNT */
const E = id => document.getElementById(id);
const cfg = () => ({
    tipo: E('tipo') ? E('tipo').value : 'escolar',
    fonte: E('fnt') ? E('fnt').value : 'times',
    tam: E('tam') ? +E('tam').value : 12,
    num: E('num') ? E('num').checked : true,
    capa: E('capa') ? E('capa').checked : false,
    rosto: E('rosto') ? E('rosto').checked : false,
    inst: E('inst') ? E('inst').value.trim() : '',
    aut: E('aut') ? E('aut').value.trim() : '',
    tit: E('tit') ? E('tit').value.trim() : '',
    cid: E('cid') ? E('cid').value.trim() : '',
    ano: E('ano') ? E('ano').value.trim() : ''
});

const GEO = { W: 595.28, H: 841.89, L: 85.04, R: 56.69, T: 85.04, B: 56.69, IND: 35.43, QI: 113.39, LM: 21.26 };
const strip = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, "");

const NOTE_START = /^\s*[\(\[]?\s*(teste|testando|test|todo|to-do|fixme|obs|observa[cc][aa]o|nota|lembrete|rascunho|draft|coment[aa]rio|anota[cç][aa]o|apagar|deletar|ver depois|revisar|corrigir|completar|xxx+)\s*[\)\]]?\s*(?::|[-]\s|\$)|^\s*(teste|testando)\b/i;
const NOTE_ANY = /\b(texto de teste|apenas um teste|isto é um teste|lorem ipsum|bl[aá] bl[aá]|(?:escrever|colocar|inserir|colar|completar|adicionar)\s+(?:aqui|depois|mais))\b|^\s*\/\/|\b(?:k{3,}|rsrs+)\b/i;
const NOTE_BRK = /^\s*\[[^\]]{3,}\]\s*$/;
const NOTE_HEAD = /^(anota[cc][õo]es?|rascunhos?|observa[cc][õo]es?|notas?|testes?|todo|lembretes?|coment[aá]rios?)(\s.*)?$/i;

function needsPunctuationReview(b) {
    if (!b || b.t !== 'p') return false;
    const s = String(b.s || "").trim();
    if (!s || /[.!?:;""»…]\$/.test(s) || NOTE_START.test(s)) return false;
    return true;
}

const KNOWN = /^(\d+(\.\d+)*\.?\s+)?(introdu[cc][aa]o|desenvolvimento|conclus[aa]o|conclus[õo]es|considera[cç][õo]es finais|refer[ee]ncias( bibliogr[aa]ficas)?|resumo|abstract|metodologia|revis[aa]o (de|da) literatura|fundamenta[cc][aa]o te[óo]rica|resultados( e discuss[aa]o)?|discuss[aa]o|objetivos?|justificativa|agradecimentos|ap[ee]ndices?|anexos?|material e m[ée]todos)$/i;
const UNNUM = /^(resumo|abstract|resumen|refer[ee]ncias|agradecimentos|ap[êe]ndices?|anexos?|gloss[aa]rio|sum[aa]rio|ep[ii]grafe|dedicat[óo]ria)/i;
const LIST = /^(?:([-*•])|(\d{1,2}[.)])|([a-z]\)))\s+(\S.*)$/;
const isCaps = s => /\p{L}/u.test(s) && s === s.toUpperCase() && s.toLowerCase() !== s && s.length >= 4;

let LVFIX = 0, LASTFIX = 0, CHG = [], LOG = [], LVLOG = [];

function headOf(l, iso) {
    let m;
    if (/\.{3,}\s*\d+\s*$/.test(l)) return null;
    if (m = l.match(/^(#{1,3})\s+(.+)$/)) {
        let s = m[2].trim(), no = "", dot = false, n;
        if (n = s.match(/^(\d+(?:\.\d+)*)(\.?)\s+(\S.*)$/)) { no = n[1]; dot = !!n[2]; s = n[3]; }
        return { lv: m[1].length, s, no, dot };
    }
    if (l.length > 80 || /[.!?;,:]$/.test(l) || /^\[/.test(l)) return null;
    if (m = l.match(/^(\d+(?:\.\d+)*)(\.?)\s+(\p{Lu}.*)$/u)) {
        const lv = m[1].split('.').length;
        if (lv > 1) return { lv: Math.min(lv, 3), s: m[3], no: m[1], dot: !!m[2] };
        if (!m[2]) return { lv: 1, s: m[3], no: m[1], dot: false };
        return (isCaps(m[3]) || KNOWN.test(m[3]) || iso) ? { lv: 1, s: m[3], no: m[1], dot: true } : null;
    }
    if (/^\d/.test(l)) return null;
    return (isCaps(l) || KNOWN.test(l)) ? { lv: 1, s: l, no: "", dot: false } : null;
}

function parse(t) {
    const out = [];
    const lines = t.replace(/\r/g, "").split('\n');
    let para = [], pl = 0, ref = false, inList = false, inQ = false, startedMain = false;
    LVFIX = 0; LVLOG = [];
    const flush = () => { if (para.length) { out.push({ t: 'p', s: para.join(' '), ln: pl, nl: para.length }); para = []; } };
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i].replace(/[\t\u00a0]+/g, '').trim();
        if (!l) { flush(); inList = inQ = false; continue; }
        if (!startedMain) {
            if (/^sum[aa]rio$/i.test(strip(l)) || /^(?:#{1,3}\s*)?(?:introdu[cc][aa]o|\b1[\s.]+introdu[cc][aa]o)/i.test(strip(l))) {
                startedMain = true;
            } else {
                continue;
            }
        }
        const iso = (i === 0 || !lines[i - 1].trim()) && (i + 1 >= lines.length || !lines[i + 1].trim());
        const hd = headOf(l, iso);
        if (hd) { flush(); inList = inQ = false; out.push({ t: 'h', ...hd, ln: i + 1 }); ref = hd.lv === 1 && /^refer[ee]ncias/i.test(hd.s); continue; }
        if (ref) {
            flush();
            const pv = out[out.length - 1];
            if (pv && pv.t === 'r' && !/[.)]$/.test(pv.s)) { pv.s += ' ' + l; pv.nl++; }
            else { out.push({ t: 'r', s: l, ln: i + 1, nl: 1 }); }
            continue;
        }
        let m;
        if (m = l.match(/^>\s?(.*)$/)) {
            flush(); inList = false;
            const pv = out[out.length - 1];
            if (inQ && pv && pv.t === 'q') { pv.s += ' ' + m[1]; pv.nl++; }
            else { out.push({ t: 'q', s: m[1], ln: i + 1, nl: 1 }); inQ = true; }
            continue;
        }
        inQ = false;
        if (m = l.match(LIST)) { flush(); out.push({ t: 'li', ord: !!(m[2] || m[3]), mk: m[1] ? '' : (m[2] || m[3]), mr: m[1] || "", s: m[4], ln: i + 1, nl: 1 }); inList = true; continue; }
        if (inList) { const pv = out[out.length - 1]; pv.s += ' ' + l; pv.nl++; continue; }
        if (!para.length) pl = i + 1;
        para.push(l);
    }
    flush();
    let prev = 0;
    out.forEach(b => {
        if (b.t === 'h') {
            const o = b.lv;
            b.lv = Math.min(b.lv, prev + 1);
            if (b.lv !== o) { LVLOG.push({ ln: b.ln, s: b.s, from: o, to: b.lv }); LVFIX++; }
            prev = b.lv;
        }
    });
    return out;
}

function ser(bl) {
    let o = "", pv = null;
    bl.forEach(b => {
        const s = b.t === 'h' ? '#'.repeat(b.lv) + ' ' + b.s : b.t === 'q' ? '>' + b.s : b.t === 'li' ? (b.ord ? b.mk : '-') + ' ' + b.s : b.s;
        o += (pv ? (pv.t === 'li' && b.t === 'li' ? '\n' : '\n\n') : "") + s;
        pv = b;
    });
    return o;
}

function layoutModel(bl, c) {
    const n = [0, 0, 0];
    return bl.map(b => {
        if (b.t !== 'h') return b;
        const un = b.lv === 1 && UNNUM.test(b.s);
        let num = "";
        if (c.num && !un) {
            if (b.lv > 1 && !n[0]) n[0] = 1;
            n[b.lv - 1]++;
            for (let i = b.lv; i < 3; i++) n[i] = 0;
            num = n.slice(0, b.lv).join('.');
        }
        return { ...b, un, num, txt: (num ? num + ' ' : "") + (b.lv === 1 ? b.s.toUpperCase() : b.s) };
    });
}

function covers(c) {
    const o = [];
    if (c.capa) o.push([{ s: c.inst.toUpperCase(), b: 1, sb: 0 }, { s: c.aut, sb: 2 }, { s: c.tit.toUpperCase(), b: 1, sb: 8 }, { s: c.cid, sb: 12 }, { s: c.ano, sb: 0 }].filter(i => i.s));
    if (c.rosto) o.push([{ s: c.aut, sb: 0 }, { s: c.tit.toUpperCase(), b: 1, sb: 8 }, { s: c.cid, sb: 14 }, { s: c.ano, sb: 0 }].filter(i => i.s));
    return o.filter(p => p.length);
}

function analyzeDoc(raw, c) {
    const bl = parse(raw), lvlog = [...LVLOG], lines = raw.replace(/\r/g, "").split('\n'), F = [];
    const A = (cat, st, t, o = {}) => F.push({ cat, st, t, ...o });
    const hs = bl.map((b, i) => ({ b, i })).filter(x => x.b.t === 'h'), h1 = hs.filter(x => x.b.lv === 1 && !UNNUM.test(x.b.s)).map(x => x.b);
    return { F, raw, applied: false };
}

function render() {
    const c = cfg(), P = E('paper');
    if (!P) return;
    P.textContent = "";
    P.style.fontFamily = c.fonte === 'helvetica' ? 'Arial, Helvetica, sans-serif' : '"Times New Roman", Times, serif';
    P.style.fontSize = c.tam + 'pt';
    covers(c).forEach(pg => {
        const d = document.createElement('div');
        d.className = 'cv';
        pg.forEach(it => {
            const p = document.createElement('p');
            p.textContent = it.s;
            p.style.marginTop = (it.sb * 1.5) + 'em';
            if (it.b) p.style.fontWeight = '700';
            d.append(p);
        });
        P.append(d);
    });
    let sheet = null;
    const outField = E('out');
    if (outField) {
        layoutModel(parse(outField.value), c).forEach((b, idx) => {
            if (b.t === 'h' || !sheet) {
                sheet = document.createElement('div');
                sheet.className = 'preview-sheet' + (idx === 0 && b.t !== 'h' ? ' first-sheet' : "");
                P.append(sheet);
            }
            let e;
            if (b.t === 'h') {
                e = document.createElement(['', 'h2', 'h3', 'h4'][b.lv]);
                e.textContent = b.txt;
                e.classList.add('starts-page');
                if (b.un) e.classList.add('c');
            } else if (b.t === 'li') {
                e = document.createElement('div');
                e.className = 'li';
                const m = document.createElement('span');
                m.textContent = b.mk;
                const x = document.createElement('span');
                x.textContent = b.s;
                e.append(m, x);
            } else {
                e = document.createElement(b.t === 'q' ? 'blockquote' : 'p');
                if (b.t === 'r') e.className = 'r';
                e.textContent = b.s;
            }
            sheet.append(e);
        });
    }
    const paperBox = document.querySelector('.paper-box');
    if (paperBox) {
        const k = Math.min(1, Math.max(.3, (paperBox.clientWidth - 24) / 794));
        P.style.zoom = k;
    }
}

function layout(bl, c, cov, mw, san) {
    const { W, H, L, R, T, B, IND, QI, LM } = GEO, Z = c.tam, SL = Z * 1.15, LH = SL * 1.5, qs = Math.min(10, Z - 1), w = W - L - R, bot = H - B;
    const items = [];
    let pgn = -1, y = T, pend = 0;
    const np = () => { pgn++; y = T; pend = 0; };
    const sp = (f, s) => mw(f, s, " ");
    const chunk = (wd, f, s, mx) => {
        const o = [];
        let cur = "";
        for (const ch of wd) {
            if (mw(f, s, cur + ch) > mx && cur) { o.push(cur); cur = ch; }
            else { cur += ch; }
        }
        o.push(cur);
        return o;
    };
    const wrap = (txt, f, s, mx, ind) => {
        const ws = txt.split(' ').filter(Boolean), sps = sp(f, s), Ls = [];
        let cur = [], cw = 0;
        const push = (last, noj) => {
            if (cur.length) { Ls.push({ w: cur, last, noj }); cur = []; cw = 0; }
        };
        for (const wd of ws) {
            const ww = mw(f, s, wd);
            if (ww > mx) {
                push(false);
                const fr = chunk(wd, f, s, mx);
                fr.slice(0, -1).forEach(x => Ls.push({ w: [x], last: true, noj: true }));
                cur = [fr[fr.length - 1]];
                cw = mw(f, s, cur[0]);
                continue;
            }
            const nw = cur.length ? cw + sps + ww : ww;
            if (nw > mx - (Ls.length ? 0 : ind) && cur.length) { push(false); cur = [wd]; cw = ww; }
            else { cur.push(wd); cw = nw; }
        }
        push(true);
        return Ls;
    };
    const mkb = b => {
        if (b.t === 'h') return { kind: 'h', f: b.lv < 3 ? 'b' : 'n', size: Z, lh: LH, x0: L, maxW: w, ind: 0, just: 0, align: b.un && b.lv == 1 ? 'c' : 'l', before: LH, after: LH, keepNext: 1, keepWhole: 1, txt: b.txt };
        if (b.t === 'q') return { kind: 'q', f: 'n', size: qs, lh: qs * 1.15, x0: L + QI, maxW: w - QI, ind: 0, just: 1, before: LH, after: LH, txt: b.s };
        if (b.t === 'li') return { kind: 'li', f: 'n', size: Z, lh: LH, x0: L + IND + LM, maxW: w - IND - LM, ind: 0, just: 1, before: 0, after: 0, mark: b.mk, mkx: L + IND, txt: b.s, short: 1 };
        if (b.t === 'r') return { kind: 'r', f: 'n', size: Z, lh: SL, x0: L, maxW: w, ind: 0, just: 0, before: 0, after: SL, keepWhole: 1, txt: b.s };
        return { kind: 'p', f: 'n', size: Z, lh: LH, x0: L, maxW: w, ind: IND, just: 1, before: 0, after: 0, txt: b.s };
    };
    const blocks = bl.map(mkb);
    blocks.forEach(b => { b.lines = wrap(san(b.txt), b.f, b.size, b.maxW, b.ind); if (b.short && b.lines.length <= 3) b.keepWhole = 1; });
    cov.forEach(pgv => {
        np();
        let yy = T;
        pgv.forEach(it => {
            yy += it.sb * LH;
            const f = it.b ? 'b' : 'n';
            wrap(san(it.s), f, Z, w, 0).forEach(ln => {
                const nat = ln.w.reduce((a, x) => a + mw(f, Z, x), 0) + (ln.w.length - 1) * sp(f, Z);
                items.push({ role: 'cover', pg: pgn, x: L + (w - nat) / 2, w: nat, yTop: yy, lh: LH, size: Z, f, words: ln.w, extra: 0 });
                yy += LH;
            });
        });
    });
    if (blocks.length) np();
    const place = (b, bi, nb) => {
        if (b.kind === 'h' && y !== T) np();
        const n = b.lines.length;
        let i = 0;
        while (i < n) {
            const rem = n - i, first = i === 0, atTop = y === T, sb = atTop ? 0 : (first ? Math.max(b.before, pend) : 0), room = bot - y - sb, fit = Math.floor((room + 0.01) / b.lh);
            if (first && b.keepNext && nb && !atTop) {
                const need = n * b.lh + b.after + Math.min(2, nb.lines.length) * nb.lh;
                if (room + 0.01 < need) { np(); continue; }
            }
            let take = rem;
            if (fit < rem) {
                if (b.keepWhole || rem < 4) take = 0;
                else { take = fit; if (take < 2) take = 0; else if (rem - take < 2) take = rem - 2; }
            }
            if (take <= 0) { if (!atTop) { np(); continue; } take = Math.max(1, fit); }
            for (let k = 0; k < take; k++) {
                const ln = b.lines[i + k], fl = i + k === 0, x0 = b.x0 + (fl ? b.ind : 0), av = b.maxW - (fl ? b.ind : 0);
                const nat = ln.w.reduce((a, x) => a + mw(b.f, b.size, x), 0) + (ln.w.length - 1) * sp(b.f, b.size);
                let extra = 0, wd = nat;
                if (b.just && !ln.last && !ln.noj && ln.w.length > 1 && nat < av) { extra = (av - nat) / (ln.w.length - 1); wd = av; }
                items.push({
                    role: 'body', blk: bi, bt: b.kind, li: i + k, n, pg: pgn, x: b.align === 'c' ? L + (w - wd) / 2 : x0, w: wd, yTop: y + sb + k * b.lh, lh: b.lh, size: b.size, f: b.f, words: ln.w, extra,
                    mk: b.mark && i + k === 0 ? san(b.mark) : null, mkx: b.mkx, fl
                });
            }
            y += sb + take * b.lh;
            pend = (i + take === n) ? b.after : 0;
            i += take;
            if (i < n) np();
        }
    };
    blocks.forEach((b, i) => place(b, i, blocks[i + 1]));
    for (let p = cov.length; p <= pgn; p++) {
        const s = String(p + 1), wd = mw('n', 10, s);
        items.push({ role: 'num', pg: p, x: W - R - wd, w: wd, base: 56.69 + 7.2, lh: 11.5, size: 10, f: 'n', words: [s], extra: 0 });
    }
    return { items, pages: pgn + 1, cov: cov.length };
}

let REP = null, LAST = null;

async function buildPdf() {
    const P = window.PDFLib;
    if (!P) throw new Error('pdflib');
    const c = cfg(), outField = E('out'), raw = outField ? outField.value : '', bl = layoutModel(parse(raw), c), pdf = await P.PDFDocument.create();
    const fam = c.fonte === 'helvetica' ? ['Helvetica', 'HelveticaBold', 'HelveticaOblique'] : ['TimesRoman', 'TimesRomanBold', 'TimesRomanItalic'];
    const F = { n: await pdf.embedFont(P.StandardFonts[fam[0]]), b: await pdf.embedFont(P.StandardFonts[fam[1]]), i: await pdf.embedFont(P.StandardFonts[fam[2]]) };
    const badc = new Set(), cache = new Map();
    const san = s => [...String(s).replace(/\u00a0/g, '').replace(/[\t\r\n]+/g, '')].map(ch => {
        if (cache.has(ch)) return cache.get(ch);
        let r = ch;
        try { F.n.widthOfTextAtSize(ch, 12); } catch (e) { r = '?'; badc.add(ch); }
        cache.set(ch, r);
        return r;
    }).join("");
    const cwc = {}, cw = (f, ch) => { const k = f + ch; return cwc[k] ?? (cwc[k] = F[f].widthOfTextAtSize(ch, 1000) / 1000); };
    const r = layout(bl, c, covers(c), (f, s, t) => { let w = 0; for (const ch of t) w += cw(f, ch); return w * s; }, san);
    for (let i = 0; i < r.pages; i++) pdf.addPage([GEO.W, GEO.H]);
    r.items.forEach(it => {
        const pg = pdf.getPage(it.pg), font = F[it.f], base = it.base ?? (it.yTop + (it.lh - it.size) / 2 + it.size * .8), txt = it.words.join(' ');
        if (!txt) return;
        if (it.extra > 0) pg.pushOperators(P.setWordSpacing(it.extra));
        pg.drawText(txt, { x: it.x, y: GEO.H - base, size: it.size, font });
        if (it.extra > 0) pg.pushOperators(P.setWordSpacing(0));
        if (it.mk) pg.drawText(it.mk, { x: it.mkx, y: GEO.H - base, size: it.size, font });
    });
    pdf.setTitle(c.tit || 'Documento ABNT');
    pdf.setAuthor(c.aut || "");
    pdf.setProducer('Me-Formata');
    try { pdf.setLanguage('pt-BR'); } catch (e) { }
    const bytes = await pdf.save(), chk = await P.PDFDocument.load(bytes);
    return { blob: new Blob([bytes], { type: 'application/pdf' }), rep: { pages: r.pages } };
}

const sig = () => (E('out') ? E('out').value : '') + JSON.stringify(cfg());
async function getPdf() {
    if (LAST && LAST.key === sig()) return LAST.blob;
    const r = await buildPdf();
    REP = r.rep;
    LAST = { key: sig(), blob: r.blob };
    return r.blob;
}

async function measure() {
    const outField = E('out');
    if (!outField || !outField.value.trim()) { REP = null; verify(); return; }
    try {
        const k = sig(), r = await buildPdf();
        REP = r.rep;
        LAST = { key: k, blob: r.blob };
    } catch (e) { }
    verify();
}

let tm = 0;
function refresh() {
    REP = null;
    render();
    verify();
    clearTimeout(tm);
    tm = setTimeout(measure, 450);
}

function verify() { }

const st = async (v, m) => {
    const prog = E('prog'), pm = E('pm');
    if (prog) { prog.hidden = false; prog.value = v; }
    if (pm) pm.textContent = m;
    await new Promise(r => setTimeout(r, 70));
};

function setStage(n) {
    const steps = document.querySelectorAll('#stp li');
    if (steps.length) {
        steps.forEach((li, i) => { li.className = i + 1 < n ? 'done' : i + 1 === n ? 'cur' : ""; });
    }
}

function resetAna() {
    const fmtBtn = E('fmtBtn');
    if (fmtBtn) fmtBtn.disabled = true;
    setStage(1);
}

const anBtn = E('anBtn');
if (anBtn) {
    anBtn.onclick = async () => {
        const txtField = E('txt');
        const o = txtField ? txtField.value : '';
        if (!o.trim()) return toast('Cole ou importe um texto primeiro.');
        try {
            setStage(2);
            await st(25, 'Identificando títulos, citações e referências...');
            analyzeDoc(o, cfg());
            await st(70, 'Montando o relatório...');
            const fmtBtn = E('fmtBtn');
            if (fmtBtn) fmtBtn.disabled = false;
            await st(100, 'Análise concluída');
            setStage(3);
            setTimeout(() => {
                const prog = E('prog'), pm = E('pm');
                if (prog) prog.hidden = true;
                if (pm) pm.textContent = "";
            }, 600);
            if (fmtBtn) fmtBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (e) {
            const prog = E('prog');
            if (prog) prog.hidden = true;
            resetAna();
            toast('Erro ao analisar o texto.');
            console.error(e);
        }
    };
}

const fmtBtn = E('fmtBtn');
if (fmtBtn) {
    fmtBtn.onclick = async () => {
        const txtField = E('txt');
        const outField = E('out');
        if (!txtField || !outField) return;
        const o = txtField.value;
        try {
            setStage(4);
            await st(20, 'Aplicando as correções seguras...');
            const bl = parse(o);
            outField.value = ser(bl);
            await st(60, 'Montando as páginas A4...');
            render();
            REP = null;
            await measure();
            await st(100, 'Pronto!');
            setStage(5);
            setTimeout(() => {
                const prog = E('prog'), pm = E('pm');
                if (prog) prog.hidden = true;
                if (pm) pm.textContent = "";
            }, 700);
            const vwC = E('vwC');
            if (vwC) vwC.checked = true;
            render();
            const paper = E('paper');
            if (paper) paper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {
            const prog = E('prog');
            if (prog) prog.hidden = true;
            toast('Erro ao formatar o texto.');
            console.error(e);
        }
    };
}

const txtField = E('txt');
if (txtField) txtField.addEventListener('input', () => { resetAna(); });

['vwC', 'vwO'].forEach(i => {
    const el = E(i);
    if (el) el.addEventListener('change', render);
});

['tipo', 'capa', 'rosto', 'num', 'inst', 'aut', 'tit', 'cid', 'ano'].forEach(i => {
    const el = E(i);
    if (el) el.addEventListener('change', refresh);
});

const clr = E('clr');
if (clr) {
    clr.onclick = () => {
        if (E('txt')) E('txt').value = "";
        if (E('out')) E('out').value = "";
        if (E('f2')) E('f2').value = "";
        LAST = null;
        resetAna();
        refresh();
        toast('Conteúdo limpo.');
    };
}

const tipoEl = E('tipo');
const PRE = { escolar: [0, 0], artigo: [0, 0], relatorio: [1, 0], tcc: [1, 0] };
if (tipoEl) {
    tipoEl.onchange = () => {
        const p = PRE[tipoEl.value];
        if (p) {
            if (E('capa')) E('capa').checked = !!p[0];
            if (E('rosto')) E('rosto').checked = !!p[1];
        }
        refresh();
    };
}

['fnt', 'tam', 'num', 'capa', 'rosto', 'inst', 'aut', 'tit', 'cid', 'ano'].forEach(i => {
    const el = E(i);
    if (el) el.addEventListener('input', refresh);
});

const outEl = E('out');
if (outEl) outEl.oninput = refresh;
window.addEventListener('resize', render);
const t2El = E('t2');
if (t2El) t2El.onchange = refresh;
refresh();

async function pdfText(f) {
    setWorker();
    const p = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise, pg = [];
    for (let i = 1; i <= p.numPages; i++) {
        const c = await (await p.getPage(i)).getTextContent();
        let s = "", ly = null, lh = 12;
        for (const it of c.items) {
            const y = it.transform[5], h = it.height || lh;
            if (ly !== null && Math.abs(y - ly) > h * .5) s += (ly - y > h * 1.8) ? '\n\n' : '\n';
            s += it.str;
            ly = y;
            lh = h;
        }
        pg.push(s);
    }
    return pg.join('\n').replace(/(\p{L})-\n(\p{L})/gu, '$1$2');
}

const f2 = E('f2');
if (f2) {
    f2.onchange = async e => {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 25 * 1048576) return toast('Arquivo muito grande (máximo 25 MB).');
        try {
            let t;
            await st(30, 'Lendo o arquivo...');
            if (/.docx$/i.test(f.name)) t = (await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value;
            else if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') t = await pdfText(f);
            else if (/\.txt$/i.test(f.name) || f.type === 'text/plain') t = await f.text();
            else {
                const prog = E('prog');
                if (prog) prog.hidden = true;
                return toast('Formato não aceito. Use .txt, .docx ou .pdf.');
            }
            const prog = E('prog'), pm = E('pm');
            if (prog) prog.hidden = true;
            if (pm) pm.textContent = "";
            if (!t.trim()) return toast('Nenhum texto encontrado.');
            if (E('txt')) E('txt').value = t;
            resetAna();
            toast('Arquivo importado. Agora clique em Analisar documento.');
        } catch (x) {
            const prog = E('prog');
            if (prog) prog.hidden = true;
            toast('Não foi possível ler este arquivo.');
        }
    };
}

document.querySelectorAll('label.drop').forEach(d => {
    const i = d.querySelector('input');
    if (!i) return;
    ['dragenter', 'dragover'].forEach(n => d.addEventListener(n, e => { e.preventDefault(); d.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(n => d.addEventListener(n, e => { e.preventDefault(); d.classList.remove('over'); }));
    d.addEventListener('drop', e => {
        if (e.dataTransfer.files.length) {
            i.files = e.dataTransfer.files;
            i.dispatchEvent(new Event('change'));
        }
    });
});

const plain = () => {
    const outField = E('out');
    if (!outField) return '';
    return layoutModel(parse(outField.value), cfg()).map(b => b.t === 'h' ? b.txt : b.t === 'li' ? b.mk + ' ' + b.s : b.t === 'p' ? '    ' + b.s : b.s).join('\n\n');
};

const need = () => {
    const outField = E('out');
    return outField && outField.value.trim() ? true : (toast('Clique em Formatar primeiro.'), false);
};

function makeDocx() {
    const d = window.docx;
    if (!d) throw new Error('docx');
    const c = cfg(), outField = E('out'), bl = layoutModel(parse(outField ? outField.value : ''), c), Z = c.tam * 2, LT = Math.round(c.tam * 1.15 * 1.5 * 20), ST = Math.round(c.tam * 1.15 * 20), F = c.fonte === 'helvetica' ? 'Arial' : 'Times New Roman', A = d.AlignmentType, AU = d.LineRuleType.AUTO;
    const run = (s, o = {}) => new d.TextRun({ text: s, font: F, size: o.sz || Z, bold: !!o.b, italics: !!o.i });
    const pg = { size: { width: 11906, height: 16838 }, margin: { top: 1701, left: 1701, bottom: 1134, right: 1134 } }, cov = covers(c), secs = [];
    if (cov.length) secs.push({ properties: { page: pg }, children: cov.flatMap((p, i) => p.map((it, j) => new d.Paragraph({ alignment: A.CENTER, pageBreakBefore: i > 0 && j === 0, spacing: { before: Math.round(it.sb * LT), line: 360, lineRule: AU }, children: [run(it.s, { b: it.b })] }))) });
    let pa = 0;
    const gap = (bf, af) => { const v = Math.max(0, bf - pa); pa = af; return v; };
    const kids = bl.map((b, idx) => {
        if (b.t === 'h') return new d.Paragraph({ alignment: b.un && b.lv === 1 ? A.CENTER : A.LEFT, pageBreakBefore: idx > 0, keepNext: true, keepLines: true, spacing: { before: gap(LT, LT), after: LT, line: 360, lineRule: AU }, children: [run(b.txt, { b: b.lv < 3, i: b.lv == 3 })] });
        if (b.t === 'q') return new d.Paragraph({ alignment: A.JUSTIFIED, indent: { left: 2268 }, keepLines: true, spacing: { before: gap(LT, LT), after: LT, line: 240, lineRule: AU }, children: [run(b.s, { sz: Math.min(10, c.tam - 1) * 2 })] });
        if (b.t === 'r') return new d.Paragraph({ alignment: A.LEFT, keepLines: true, spacing: { before: gap(0, ST), after: ST, line: 240, lineRule: AU }, children: [run(b.s)] });
        if (b.t === 'li') return new d.Paragraph({ alignment: A.JUSTIFIED, indent: { left: 1134, hanging: 425 }, tabStops: [{ type: d.TabStopType.LEFT, position: 1134 }], keepLines: true, spacing: { before: gap(0, 0), after: 0, line: 360, lineRule: AU }, children: [run(b.mk), new d.TextRun({ children: [new d.Tab()], font: F, size: Z }), run(b.s)] });
        return new d.Paragraph({ alignment: A.JUSTIFIED, indent: { firstLine: 709 }, spacing: { before: gap(0, 0), after: 0, line: 360, lineRule: AU }, children: [run(b.s)] });
    });
    secs.push({
        properties: { page: { ...pg, pageNumbers: { start: cov.length + 1 } } },
        headers: { default: new d.Header({ children: [new d.Paragraph({ alignment: A.RIGHT, children: [new d.TextRun({ children: [d.PageNumber.CURRENT], font: F, size: 20 })] })] }) },
        children: kids
    });
    return d.Packer.toBlob(new d.Document({ creator: c.aut || "", title: c.tit || 'Documento ABNT', styles: { default: { document: { run: { font: F, size: Z } } } }, sections: secs }));
}

const nome = () => (cfg().tit || 'texto-abnt').replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 60) || 'texto-abnt';
const safe = async fn => {
    try { await fn(); } catch (e) {
        toast(e.message === 'docx' ? 'Biblioteca DOCX não carregou.' : e.message === 'pdflib' ? 'Biblioteca de PDF não carregou.' : 'Erro ao gerar o arquivo.');
        console.error(e);
    }
};

const dxBtn = E('dx');
if (dxBtn) dxBtn.onclick = () => need() && safe(async () => { await st(50, 'Gerando DOCX...'); const b = await makeDocx(); if (E('prog')) E('prog').hidden = true; if (E('pm')) E('pm').textContent = ""; await save(nome() + '.docx', b); setStage(6); });

const dlBtn = E('dl');
if (dlBtn) dlBtn.onclick = () => need() && safe(async () => { await st(50, 'Gerando PDF...'); const b = await getPdf(); if (E('prog')) E('prog').hidden = true; if (E('pm')) E('pm').textContent = ""; verify(); await save(nome() + '.pdf', b); setStage(6); });

const shrBtn = E('shr');
if (shrBtn) shrBtn.onclick = () => need() && safe(async () => share([{ name: nome() + '.pdf', blob: await getPdf() }]));

const prBtn = E('pr');
if (prBtn) prBtn.onclick = () => need() && (window.print(), toast('Se a impressão não abrir, use Baixar PDF.'));

const mailBtn = E('mail');
if (mailBtn) mailBtn.onclick = () => need() && window.open('mailto:?subject=' + encodeURIComponent(cfg().tit || 'Texto formatado em ABNT') + '&body=' + encodeURIComponent(plain()), '_blank');

const waBtn = E('wa');
if (waBtn) waBtn.onclick = () => need() && window.open('https://wa.me/?text=' + encodeURIComponent(plain()), '_blank');

const cpBtn = E('cp');
if (cpBtn) cpBtn.onclick = async () => {
    if (!need()) return;
    const t = plain();
    try { await navigator.clipboard.writeText(t); } catch (e) {
        const a = document.createElement('textarea');
        a.value = t;
        document.body.append(a);
        a.select();
        document.execCommand('copy');
        a.remove();
    }
    toast('Texto copiado!');
};

document.querySelectorAll('[data-tab]').forEach(a => a.addEventListener('click', ev => {
    ev.preventDefault();
    const d = a.dataset, t = E(d.tab);
    if (t && !t.checked) { t.checked = true; t.dispatchEvent(new Event('change')); }
    if (d.to && E(d.to)) E(d.to).checked = true;
    d.go ? E(d.go).scrollIntoView({ behavior: 'smooth' }) : window.scrollTo(0, 0);
}));

/* Módulo de QR Code */
(function () {
    const input = document.getElementById('qrLink');
    const generateBtn = document.getElementById('qrGenerate');
    const downloadBtn = document.getElementById('qrDownload');
    const status = document.getElementById('qrStatus');
    const result = document.getElementById('qrResult');
    const canvasHost = document.getElementById('qrCanvas');
    const valueLabel = document.getElementById('qrValue');
    if (!input || !generateBtn || !downloadBtn || !status || !result || !canvasHost || !valueLabel) return;
    let currentLink = "";
    const setStatus = message => { status.textContent = message; };
    generateBtn.addEventListener('click', () => {
        const raw = input.value.trim();
        if (!raw) { setStatus('Digite um link antes de gerar o QR Code.'); input.focus(); return; }
        let parsed;
        try { parsed = new URL(raw); } catch (e) { setStatus('Link inválido.'); input.focus(); return; }
        canvasHost.textContent = "";
        try {
            new window.QRCode(canvasHost, { text: parsed.href, width: 256, height: 256, colorDark: '#000000', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.H });
            currentLink = parsed.href;
            valueLabel.textContent = currentLink;
            result.hidden = false;
            downloadBtn.disabled = false;
            setStatus('QR Code gerado com sucesso!');
        } catch (error) {
            downloadBtn.disabled = true;
            setStatus('Erro ao gerar QR Code.');
        }
    });
    downloadBtn.addEventListener('click', () => {
        if (!currentLink) return;
        const canvas = canvasHost.querySelector('canvas');
        const image = canvasHost.querySelector('img');
        let dataUrl = canvas ? canvas.toDataURL('image/png') : (image ? image.src : "");
        if (!dataUrl) return;
        const anchor = document.createElement('a');
        anchor.href = dataUrl;
        anchor.download = 'qrcode-me-formata.png';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setStatus('Download iniciado.');
    });
})();