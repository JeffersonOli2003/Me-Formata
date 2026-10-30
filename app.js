const $ = s => document.querySelector(s);
function toast(m) {
    const t = $('#toast');
    if (!t) return;
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
        cvMsg("");
    };
}

const rd = f => new Promise((ok, er) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = er; r.readAsDataURL(f); });
const img = s => new Promise((ok, er) => { const i = new Image(); i.onload = () => ok(i); i.onerror = er; i.src = s; });
const cv = (w, h, fill) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    if (fill) { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); }
    return c;
};
const blob = (c, t) => new Promise(r => c.toBlob(r, t === 'jpg' ? 'image/jpeg' : 'image/png', .92));
const base = n => n.replace(/\.[^.]+$/, "");
const setWorker = () => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
};

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
    if (/svg/i.test(f.type) || /\.svg$/i.test(f.name)) {
        const si = await img(await rd(f));
        let w = si.naturalWidth || 1024, h = si.naturalHeight || 1024;
        const k = Math.max(w, h) < 1000 ? 2000 / Math.max(w, h) : 1;
        const sc = cv(Math.round(w * k), Math.round(h * k), true);
        sc.getContext('2d').drawImage(si, 0, 0, sc.width, sc.height);
        return [{ c: sc, n: base(f.name) }];
    }
    const i = await img(await rd(f)), c = cv(i.naturalWidth, i.naturalHeight, true);
    c.getContext('2d').drawImage(i, 0, 0);
    return [{ c, n: base(f.name) }];
}

/* ===== SVG: helpers ===== */
const cvMsg = m => { const s = $('#cvStatus'); if (s) s.textContent = m || ""; };
const isPdfF = f => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name);
const isSvgF = f => /svg/i.test(f.type) || /\.svg$/i.test(f.name);
const yieldUI = () => new Promise(r => setTimeout(r, 30));

function validSvg(str) {
    const d = new DOMParser().parseFromString(str, 'image/svg+xml');
    if (d.querySelector('parsererror') || d.documentElement.nodeName !== 'svg') throw new Error('svginvalid');
    return str;
}
const svgBlob = str => new Blob([str], { type: 'image/svg+xml' });

// PDF -> SVG (vetorial via pdf.js SVGGraphics; fallback: página embutida em alta resolução)
async function pdfToSvgFiles(f, notify) {
    setWorker();
    const doc = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise, res = [];
    let fallbacks = 0;
    for (let i = 1; i <= doc.numPages; i++) {
        notify('Convertendo "' + f.name + '" para SVG: página ' + i + ' de ' + doc.numPages + '...');
        await yieldUI();
        const pg = await doc.getPage(i), vp = pg.getViewport({ scale: 1 });
        let svgStr = null;
        try {
            if (!pdfjsLib.SVGGraphics) throw new Error('nosvggfx');
            const ops = await pg.getOperatorList();
            const g = new pdfjsLib.SVGGraphics(pg.commonObjs, pg.objs);
            g.embedFonts = true;
            const el = await g.getSVG(ops, vp);
            if (!el.getAttribute('viewBox')) el.setAttribute('viewBox', '0 0 ' + vp.width + ' ' + vp.height);
            el.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            svgStr = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(el);
            validSvg(svgStr);
        } catch (e) {
            console.warn('SVG vetorial falhou na página ' + i + '; usando fallback.', e);
            svgStr = null;
        }
        if (!svgStr) {
            fallbacks++;
            const v2 = pg.getViewport({ scale: 2 }), c = cv(v2.width, v2.height, true);
            await pg.render({ canvasContext: c.getContext('2d'), viewport: v2 }).promise;
            svgStr = '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" ' +
                'xmlns:xlink="http://www.w3.org/1999/xlink" width="' + vp.width + '" height="' + vp.height +
                '" viewBox="0 0 ' + vp.width + ' ' + vp.height + '"><image width="' + vp.width + '" height="' +
                vp.height + '" xlink:href="' + c.toDataURL('image/png') + '"/></svg>';
            validSvg(svgStr);
        }
        res.push({ name: base(f.name) + (doc.numPages > 1 ? '-p' + i : "") + '.svg', blob: svgBlob(svgStr) });
    }
    return { files: res, fallbacks };
}

// PNG/JPG -> SVG (vetorização com ImageTracer)
async function imageToSvgFile(f, notify) {
    if (!window.ImageTracer) throw new Error('tracer');
    notify('Vetorizando "' + f.name + '"... isso pode levar alguns segundos.');
    await yieldUI();
    const im = await img(await rd(f));
    const w = im.naturalWidth, h = im.naturalHeight;
    const k = Math.min(1, 1400 / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * k)), th = Math.max(1, Math.round(h * k));
    const isJpg = /jpe?g/i.test(f.type) || /\.jpe?g$/i.test(f.name);
    const c = cv(tw, th, isJpg); // JPG: fundo branco; PNG: preserva transparência
    c.getContext('2d').drawImage(im, 0, 0, tw, th);
    const data = c.getContext('2d').getImageData(0, 0, tw, th);
    await yieldUI();
    let svg = window.ImageTracer.imagedataToSVG(data, {
        numberofcolors: 32, colorsampling: 2, colorquantcycles: 3,
        ltres: 1, qtres: 1, pathomit: 8, blurradius: 0, strokewidth: 0,
        roundcoords: 1, scale: 1, viewbox: true, desc: false, linefilter: false
    });
    if (!/<svg[^>]*\swidth=/.test(svg)) svg = svg.replace('<svg ', '<svg width="' + w + '" height="' + h + '" ');
    if (!/xmlns=/.test(svg)) svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    svg = '<?xml version="1.0" encoding="UTF-8"?>\n' + svg;
    validSvg(svg);
    return { name: base(f.name) + '.svg', blob: svgBlob(svg) };
}

async function convertToSvg() {
    let skipped = 0, fallbacks = 0;
    for (const f of f1.files) {
        if (isSvgF(f)) { skipped++; continue; }
        if (isPdfF(f)) {
            const r = await pdfToSvgFiles(f, cvMsg);
            out.push(...r.files); fallbacks += r.fallbacks;
        } else {
            out.push(await imageToSvgFile(f, cvMsg));
        }
    }
    if (skipped) toast(skipped + ' arquivo(s) já estão em SVG e foram ignorados.');
    if (fallbacks) toast('Algumas páginas tinham conteúdo que não pôde ser mantido como vetor; foram salvas como imagem dentro do SVG.');
    if (!out.length) throw new Error('nothing');
}

const goBtn = $('#go');
if (goBtn) {
    goBtn.onclick = async () => {
        const to = document.querySelector('input[name=to]:checked').value, b = $('#go');
        b.disabled = true; b.textContent = 'Convertendo...';
        out = []; cvMsg('Preparando a conversão...');
        try {
            if (to === 'svg') {
                await convertToSvg();
            } else if (to === 'pdf') {
                const PL = window.PDFLib, pdf = await PL.PDFDocument.create();
                for (const f of f1.files) {
                    cvMsg('Processando "' + f.name + '"...');
                    for (const p of await pages(f)) {
                        const jb = await blob(p.c, 'jpg'), im = await pdf.embedJpg(new Uint8Array(await jb.arrayBuffer())), w = p.c.width * .75, hh = p.c.height * .75;
                        pdf.addPage([w, hh]).drawImage(im, { x: 0, y: 0, width: w, height: hh });
                    }
                }
                out.push({ name: (f1.files.length > 1 ? 'arquivos-juntos' : base(f1.files[0].name)) + '.pdf', blob: new Blob([await pdf.save()], { type: 'application/pdf' }) });
            } else {
                for (const f of f1.files) {
                    cvMsg('Processando "' + f.name + '"...');
                    for (const p of await pages(f)) {
                        out.push({ name: p.n + '.' + to, blob: await blob(p.c, to) });
                    }
                }
            }
            showConv();
            cvMsg('Conversão concluída: ' + out.length + ' arquivo(s) pronto(s).');
        } catch (e) {
            console.error(e);
            cvMsg("");
            toast(
                e.message === 'tracer' ? 'A biblioteca de vetorização não carregou. Verifique sua conexão e recarregue a página.' :
                    e.message === 'svginvalid' ? 'O SVG gerado não passou na validação. Tente outro arquivo.' :
                        e.message === 'nothing' ? 'Nenhum arquivo para converter. Selecione PDF, PNG ou JPG para gerar SVG.' :
                            'Não consegui converter este arquivo. Tente outro.'
            );
        }
        b.disabled = false; b.textContent = 'Converter';
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
            m.alt = ""; m.src = URL.createObjectURL(o.blob);
            d.append(m);
        }
        const s = document.createElement('span');
        s.textContent = o.name;
        d.append(s);
        const a = document.createElement('button');
        a.textContent = 'Baixar'; a.onclick = () => save(o.name, o.blob);
        const btnShare = document.createElement('button');
        btnShare.textContent = 'Enviar'; btnShare.onclick = () => share([o]);
        d.append(a, btnShare);
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

function headOf(l) {
    let m;
    if (/\.{3,}\s*\d+\s*$/.test(l)) return null;

    if (m = l.match(/^#{1,3}\s+(.+)$/)) {
        let s = m[1].trim(), no = "";
        let n = s.match(/^(\d+(?:\.\d+)*)(\.?)\s+(.+)$/);
        if (n) { no = n[1]; s = n[3]; }
        return { lv: m[1].startsWith('###') ? 3 : m[1].startsWith('##') ? 2 : 1, s, no };
    }

    if (m = l.match(/^(\d+(?:\.\d+)*)\.?\s+(.+)$/)) {
        const lv = m[1].split('.').length;
        return { lv: Math.min(lv, 3), s: m[2].trim(), no: m[1] };
    }

    const clean = strip(l).toLowerCase();
    const knownHeadings = /^(introdu[cc][aa]o|conclus[aa]o|resumo|abstract|metodologia|resultados|discuss[aa]o|refer[ee]ncias|objetivos|desenvolvimento|fundamenta[cc][aa]o te[oó]rica)/i;
    if (knownHeadings.test(clean) && l.length < 60) {
        return { lv: 1, s: l, no: "" };
    }

    return null;
}

function parse(t) {
    const out = [];
    const lines = t.replace(/\r/g, "").split('\n');
    let para = [], p1 = 0, ref = false, inSumario = false;

    for (let i = 0; i < lines.length; i++) {
        const l = lines[i].replace(/[\t\u00a0]+/g, ' ').trim();
        if (!l) {
            if (para.length) {
                if (inSumario) {
                    out.push({ t: 'sum_item', s: para.join(' '), ln: p1, nl: para.length });
                } else {
                    out.push({ t: 'p', s: para.join(' '), ln: p1, nl: para.length });
                }
                para = [];
            }
            continue;
        }

        if (/^sum[aa]rio\b/i.test(l)) {
            if (para.length) { out.push({ t: 'p', s: para.join(' '), ln: p1, nl: para.length }); para = []; }
            inSumario = true;
            out.push({ t: 'sum_title', s: l, ln: i + 1 });
            continue;
        }

        if (inSumario) {
            if (/^1\s+introdu[cc][aa]o/i.test(l) || /^1\.\s+introdu[cc][aa]o/i.test(l)) {
                inSumario = false;
            } else {
                out.push({ t: 'sum_item', s: l, ln: i + 1, nl: 1 });
                continue;
            }
        }

        const hd = headOf(l);
        if (hd) {
            if (para.length) { out.push({ t: 'p', s: para.join(' '), ln: p1, nl: para.length }); para = []; }
            out.push({ t: 'h', ...hd, ln: i + 1 });
            ref = hd.lv === 1 && /^refer[ee]ncias/i.test(hd.s);
            continue;
        }
        if (ref) {
            if (para.length) { out.push({ t: 'p', s: para.join(' '), ln: p1, nl: para.length }); para = []; }
            out.push({ t: 'r', s: l, ln: i + 1, nl: 1 });
            continue;
        }
        if (l.startsWith('>')) {
            if (para.length) { out.push({ t: 'p', s: para.join(' '), ln: p1, nl: para.length }); para = []; }
            out.push({ t: 'q', s: l.replace(/^>\s*/, ''), ln: i + 1, nl: 1 });
            continue;
        }
        if (!para.length) p1 = i + 1;
        para.push(l);
    }
    if (para.length) {
        if (inSumario) {
            out.push({ t: 'sum_item', s: para.join(' '), ln: p1, nl: para.length });
        } else {
            out.push({ t: 'p', s: para.join(' '), ln: p1, nl: para.length });
        }
    }
    return out;
}

function ser(bl) {
    let o = "", pv = null;
    bl.forEach(b => {
        let s = b.s;
        if (b.t === 'h') s = '#'.repeat(b.lv) + ' ' + (b.no ? b.no + ' ' : '') + b.s;
        else if (b.t === 'q') s = '> ' + b.s;
        else if (b.t === 'sum_title') s = b.s;
        else if (b.t === 'sum_item') s = b.s;
        o += (pv ? "\n\n" : "") + s;
        pv = b;
    });
    return o;
}

function layoutModel(bl, c) {
    const n = [0, 0, 0];
    const UNNUM = /^(resumo|abstract|resumen|refer[ee]ncias|agradecimentos|ap[ee]ndices?|anexos?|gloss[aa]rio|sum[aa]rio)/i;

    let hasH1 = bl.some(b => b.t === 'h');
    if (!hasH1 && bl.length > 0) {
        bl = bl.map((b, idx) => {
            if (idx === 0) return { t: 'h', lv: 1, s: 'Introdução', no: '1' };
            if (idx === Math.floor(bl.length / 2)) return { t: 'h', lv: 1, s: 'Desenvolvimento', no: '2' };
            if (idx === bl.length - 1 && bl.length > 3) return { t: 'h', lv: 1, s: 'Conclusão', no: '3' };
            return b;
        });
    }

    return bl.map(b => {
        if (b.t !== 'h') return b;
        const un = b.lv === 1 && UNNUM.test(b.s);
        let num = b.no || "";
        if (c.num && !un && !num) {
            if (b.lv > 1 && !n[0]) n[0] = 1;
            n[b.lv - 1]++;
            for (let i = b.lv; i < 3; i++) n[i] = 0;
            num = n.slice(0, b.lv).join('.');
        }
        return { ...b, un, num, txt: (num ? num + " " : "") + (b.lv === 1 ? b.s.toUpperCase() : b.s) };
    });
}

function covers(c) {
    const o = [];

    if (c.capa) {
        o.push([
            { s: c.inst.toUpperCase(), b: 1, sb: 0, align: 'c' },
            { s: c.aut, sb: 6, align: 'c' },
            { s: c.tit.toUpperCase(), b: 1, sb: 6, align: 'c' },
            { s: c.cid, sb: 14, align: 'c' },
            { s: c.ano, sb: 1, align: 'c' }
        ].filter(i => i.s));
    }

    if (c.rosto) {
        o.push([
            { s: c.aut, sb: 0, align: 'c' },
            { s: c.tit.toUpperCase(), b: 1, sb: 6, align: 'c' },
            { s: c.cid, sb: 10, align: 'c' },
            { s: c.ano, sb: 1, align: 'c' }
        ].filter(i => i.s));
    }

    return o;
}

function render() {
    const c = cfg(), P = E('paper');
    if (!P) return;
    P.textContent = "";
    P.style.fontFamily = c.fonte === 'helvetica' ? 'Arial, Helvetica, sans-serif' : '"Times New Roman", Times, serif';
    P.style.fontSize = c.tam + 'pt';

    covers(c).forEach((pg) => {
        const d = document.createElement('div');
        d.className = 'preview-sheet cv';
        pg.forEach(it => {
            const p = document.createElement('p');
            p.textContent = it.s;
            p.style.marginTop = (it.sb * 1.5) + 'em';
            if (it.b) p.style.fontWeight = '700';
            if (it.align === 'c') p.style.textAlign = 'center';
            d.append(p);
        });
        P.append(d);
    });

    const outField = E('out');
    const rawText = outField && outField.value.trim() ? outField.value : (E('txt') ? E('txt').value : '');
    const parsedBlocks = parse(rawText);
    const modelBlocks = layoutModel(parsedBlocks, c);

    let sheet = null;
    if (rawText) {
        modelBlocks.forEach((b, idx) => {
            if ((b.t === 'h' && b.lv === 1) || b.t === 'sum_title' || !sheet) {
                sheet = document.createElement('div');
                sheet.className = 'preview-sheet' + (idx === 0 && b.t !== 'h' && b.t !== 'sum_title' ? ' first-sheet' : "");
                P.append(sheet);
            }
            let e;
            if (b.t === 'sum_title') {
                e = document.createElement('h2');
                e.textContent = b.s;
                e.classList.add('c');
                e.style.fontWeight = '700';
            } else if (b.t === 'sum_item') {
                e = document.createElement('p');
                e.textContent = b.s;
                e.style.textIndent = '0';
            } else if (b.t === 'h') {
                e = document.createElement(['', 'h2', 'h3', 'h4'][b.lv]);
                e.textContent = b.txt;
                e.style.fontWeight = '700';
                e.style.marginTop = '1em';
                if (b.un || b.lv === 1) e.classList.add('c');
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
    const { W, H, L, R, T, B, IND, QI, LM } = GEO;
    const Z = c.tam, SL = Z * 1.15, LH = SL * 1.5, qs = Math.max(10, Z - 1), w = W - L - R, bot = H - B;
    const items = [];
    let pgn = -1, y = T, pend = 0;
    const np = () => { pgn++; y = T; pend = 0; };
    const sp = (f, s) => mw(f, s, " ");
    const chunk = (wd, f, s, mx) => {
        const o = []; let cur = "";
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
        const push = (last, noj) => { if (cur.length) { Ls.push({ w: cur, last, noj }); cur = []; cw = 0; } };
        for (const wd of ws) {
            const ww = mw(f, s, wd);
            if (ww > mx) {
                push(false);
                const fr = chunk(wd, f, s, mx);
                fr.slice(0, -1).forEach(x => Ls.push({ w: [x], last: true, noj: true }));
                cur = [fr[fr.length - 1]]; cw = mw(f, s, cur[0]);
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
        if (b.t === 'sum_title') return { kind: 'sum_title', f: 'b', size: Z, lh: LH, x0: L, maxW: w, ind: 0, just: 0, align: 'c', before: LH, after: LH, keepWhole: 1, txt: b.s };
        if (b.t === 'sum_item') return { kind: 'sum_item', f: 'n', size: Z, lh: LH, x0: L, maxW: w, ind: 0, just: 0, align: 'l', before: 0, after: 0, keepWhole: 1, txt: b.s };
        if (b.t === 'h') return { kind: 'h', f: 'b', size: Z, lh: LH, x0: L, maxW: w, ind: 0, just: 0, align: b.un && b.lv === 1 ? 'c' : 'l', before: LH, after: LH, keepNext: 1, keepWhole: 1, txt: b.txt };
        if (b.t === 'q') return { kind: 'q', f: 'n', size: qs, lh: qs * 1.15, x0: L + QI, maxW: w - QI, ind: 0, just: 1, before: LH, after: LH, txt: b.s };
        if (b.t === 'li') return { kind: 'li', f: 'n', size: Z, lh: LH, x0: L + IND + LM, maxW: w - IND - LM, ind: 0, just: 1, before: 0, after: 0, mark: b.mk, txt: b.s, short: 1 };
        if (b.t === 'r') return { kind: 'r', f: 'n', size: Z, lh: SL, x0: L, maxW: w, ind: 0, just: 0, before: 0, after: SL, keepWhole: 1, txt: b.s };
        return { kind: 'p', f: 'n', size: Z, lh: LH, x0: L, maxW: w, ind: IND, just: 1, before: 0, after: 0, txt: b.s };
    };

    const blocks = bl.map(mkb);
    blocks.forEach(b => {
        b.lines = wrap(san(b.txt), b.f, b.size, b.maxW, b.ind);
        if (b.short && b.lines.length <= 3) b.keepWhole = 1;
    });

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
        if (b.kind === 'sum_title' && y !== T) np();
        const n = b.lines.length;
        let i = 0;
        while (i < n) {
            const atTop = (y === T), sb = atTop ? 0 : (i === 0 ? Math.max(b.before, pend) : 0), room = bot - (y + sb);
            const fit = Math.floor((room + 0.01) / b.lh);
            if (i === 0 && b.keepNext && nb && !atTop) {
                const need = n * b.lh + b.after + Math.min(2, nb.lines.length) * nb.lh;
                if (room + 0.01 < need) { np(); continue; }
            }
            let take = rem = n - i;
            if (fit < rem) {
                if (b.keepWhole || fit < 2) take = 0;
                else { take = fit; if (rem - take < 4) take = Math.max(1, take - 2); }
            }
            if (take <= 0) {
                if (!atTop) { np(); continue; }
                take = Math.max(1, fit);
            }
            for (let k = 0; k < take; k++) {
                const ln = b.lines[i + k], fl = (i + k === 0), x0 = b.x0 + (fl ? b.ind : 0), av = b.maxW - (fl ? b.ind : 0);
                const nat = ln.w.reduce((a, x) => a + mw(b.f, b.size, x), 0) + (ln.w.length - 1) * sp(b.f, b.size);
                let extra = 0, wd = nat;
                if (b.just && !ln.last && !ln.noj && ln.w.length > 1 && nat < av) { extra = (av - nat) / (ln.w.length - 1); wd = av; }
                items.push({
                    role: 'body', blk: bi, bt: b.kind, pg: pgn,
                    x: b.align === 'c' ? L + (w - wd) / 2 : x0,
                    w: wd, yTop: y + sb + k * b.lh, lh: b.lh, size: b.size, f: b.f,
                    words: ln.w, extra, mk: b.mark && i + k === 0 ? b.mark : null, mkx: b.mkx, fl
                });
            }
            y += sb + take * b.lh;
            pend = (i + take === n) ? b.after : 0;
            i += take;
            if (i < n) np();
        }
    };

    blocks.forEach((b, i) => place(b, i, blocks[i - 1]));

    for (let p = cov.length; p <= pgn; p++) {
        const s = String(p + 1), wd = mw('n', 10, s);
        items.push({ role: 'num', pg: p, x: W - R - wd, base: 56.69 + 7.2, lh: 11.5, size: 10, f: 'n', words: [s], extra: 0 });
    }

    return { items, pages: pgn + 1, cov: cov.length };
}

let REP = null, LAST = null;
async function buildPdf() {
    const P = window.PDFLib;
    if (!P) throw new Error('pdflib');
    const c = cfg(), outField = E('out'), raw = outField && outField.value.trim() ? outField.value : (E('txt') ? E('txt').value : ''), bl = layoutModel(parse(raw), c), pdf = await P.PDFDocument.create();
    const fam = c.fonte === 'helvetica' ? ['Helvetica', 'HelveticaBold', 'HelveticaOblique'] : ['TimesRoman', 'TimesRomanBold', 'TimesRomanItalic'];
    const F = { n: await pdf.embedFont(P.StandardFonts[fam[0]]), b: await pdf.embedFont(P.StandardFonts[fam[1]]), i: await pdf.embedFont(P.StandardFonts[fam[2]]) };
    const badc = new Set(), cache = new Map();
    const san = s => [...String(s).replace(/\u00a0/g, ' ')].map(ch => {
        if (cache.has(ch)) return cache.get(ch);
        let r = ch;
        try { F.n.widthOfTextAtSize(ch, 12); } catch (e) { r = '?'; badc.add(ch); }
        cache.set(ch, r);
        return r;
    }).join("");

    const cwc = {}, cw = (f, ch) => { const k = f + ch; return cwc[k] ?? (cwc[k] = F[f].widthOfTextAtSize(ch, 1000) / 1000); };
    const r = layout(bl, c, covers(c), (f, s, t) => {
        let w = 0; for (const ch of t) w += cw(f, ch); return w * s;
    }, san);

    for (let i = 0; i < r.pages; i++) pdf.addPage([GEO.W, GEO.H]);
    r.items.forEach(it => {
        const pg = pdf.getPage(it.pg), font = F[it.f], base = it.base ?? (it.yTop + (it.lh - it.size) / 2 + it.size * .8), txt = it.words.join(' ');
        if (!txt) return;
        if (it.extra > 0) pg.pushOperators(P.setWordSpacing(it.extra));
        pg.drawText(txt, { x: it.x, y: GEO.H - base, size: it.size, font });
        if (it.extra > 0) pg.pushOperators(P.setWordSpacing(0));
    });

    pdf.setTitle(c.tit || 'Documento ABNT');
    pdf.setAuthor(c.aut || "");
    pdf.setProducer('Me-Formata');
    try { pdf.setLanguage('pt-BR'); } catch (e) { }
    const bytes = await pdf.save();
    return { blob: new Blob([bytes], { type: 'application/pdf' }), rep: { pages: r.pages } };
}

const sig = () => (E('out') ? E('out').value : '') + JSON.stringify(cfg());
async function getPdf() {
    if (LAST && LAST.key === sig()) return LAST.blob;
    const r = await buildPdf();
    REP = r.rep; LAST = { key: sig(), blob: r.blob };
    return r.blob;
}

async function measure() {
    const outField = E('out');
    if (!outField || !outField.value.trim()) { REP = null; verify(); return; }
    try {
        const k = sig(), r = await buildPdf();
        REP = r.rep; LAST = { key: k, blob: r.blob };
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
        const txtField = E('txt'), o = txtField ? txtField.value : '';
        if (!o.trim()) return toast('Cole ou importe um texto primeiro.');
        try {
            setStage(2);
            await st(25, 'Identificando títulos, citações e referências...');
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
        const txtField = E('txt'), outField = E('out');
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
const PRE = { escolar: [0, 0], artigo: [0, 0], relatorio: [1, 0], tcc: [1, 1] };
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
            if (ly !== null && Math.abs(y - ly) > h * 1.5) s += (ly - y > h * 1.8 ? '\n\n' : '\n');
            s += it.str; ly = y; lh = h;
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
            if (/\.docx$/i.test(f.name)) t = (await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value;
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
    const rawText = outField && outField.value.trim() ? outField.value : (E('txt') ? E('txt').value : '');
    return layoutModel(parse(rawText), cfg()).map(b => b.t === 'h' ? b.txt : b.s).join('\n\n');
};

const need = () => {
    const outField = E('out');
    return outField && outField.value.trim() ? true : (toast('Clique em Formatar primeiro.'), false);
};

function makeDocx() {
    const d = window.docx;
    if (!d) throw new Error('docx');

    const c = cfg();
    const outField = E('out');
    const rawText = outField && outField.value.trim()
        ? outField.value
        : (E('txt') ? E('txt').value : '');

    const parsedBlocks = parse(rawText);
    const bl = layoutModel(parsedBlocks, c);

    const Z = Math.round(c.tam * 2);
    const LINE = Math.round(c.tam * 1.5 * 20);
    const SMALL = Math.round(Math.max(10, c.tam - 1) * 2);
    const F = c.fonte === 'helvetica' ? 'Arial' : 'Times New Roman';

    const A = d.AlignmentType;
    const LR = d.LineRuleType ? d.LineRuleType.AUTO : 'auto';

    const run = (text, options = {}) => new d.TextRun({
        text: String(text ?? ''),
        font: F,
        size: options.sz || Z,
        bold: !!options.b,
        italics: !!options.i
    });

    const page = {
        size: { width: 11906, height: 16838 },
        margin: { top: 1701, left: 1701, bottom: 1134, right: 1134 }
    };

    const sections = [];
    const coverPages = covers(c);

    // Cada capa/folha de rosto ocupa uma seção própria.
    // Os parágrafos dentro da mesma página não recebem quebra individual.
    coverPages.forEach((cover) => {
        const children = cover.map((item) => {
            const before = Math.max(0, Math.round(item.sb * LINE));
            return new d.Paragraph({
                alignment: A.CENTER,
                keepLines: true,
                spacing: {
                    before,
                    after: 0,
                    line: LINE,
                    lineRule: LR
                },
                children: [run(item.s, { b: item.b })]
            });
        });

        sections.push({
            properties: { page },
            children
        });
    });

    const children = bl.map((block) => {
        if (block.t === 'sum_title') {
            return new d.Paragraph({
                alignment: A.CENTER,
                pageBreakBefore: true,
                keepNext: true,
                keepLines: true,
                spacing: {
                    before: LINE,
                    after: LINE,
                    line: LINE,
                    lineRule: LR
                },
                children: [run(block.s, { b: true })]
            });
        }

        if (block.t === 'sum_item') {
            return new d.Paragraph({
                alignment: A.LEFT,
                keepLines: true,
                spacing: {
                    before: 0,
                    after: 0,
                    line: LINE,
                    lineRule: LR
                },
                children: [run(block.s)]
            });
        }

        if (block.t === 'h') {
            return new d.Paragraph({
                alignment: block.un && block.lv === 1 ? A.CENTER : A.LEFT,
                keepNext: true,
                keepLines: true,
                spacing: {
                    before: LINE,
                    after: Math.round(LINE / 2),
                    line: LINE,
                    lineRule: LR
                },
                children: [run(block.txt, {
                    b: true,
                    i: block.lv === 3
                })]
            });
        }

        if (block.t === 'q') {
            return new d.Paragraph({
                alignment: A.JUSTIFIED,
                indent: { left: 2268 },
                keepLines: true,
                spacing: {
                    before: LINE,
                    after: LINE,
                    line: Math.round(SMALL * 1.15),
                    lineRule: LR
                },
                children: [run(block.s, { sz: SMALL })]
            });
        }

        if (block.t === 'r') {
            return new d.Paragraph({
                alignment: A.LEFT,
                keepLines: true,
                spacing: {
                    before: 0,
                    after: Math.round(LINE / 2),
                    line: LINE,
                    lineRule: LR
                },
                children: [run(block.s)]
            });
        }

        if (block.t === 'li') {
            return new d.Paragraph({
                alignment: A.JUSTIFIED,
                indent: { left: 1134, hanging: 425 },
                tabStops: [{
                    type: d.TabStopType.LEFT,
                    position: 1134
                }],
                keepLines: true,
                spacing: {
                    before: 0,
                    after: 0,
                    line: LINE,
                    lineRule: LR
                },
                children: [
                    run(block.mk),
                    new d.TextRun({
                        children: [new d.Tab()],
                        font: F,
                        size: Z
                    }),
                    run(block.s)
                ]
            });
        }

        return new d.Paragraph({
            alignment: A.JUSTIFIED,
            indent: { firstLine: 709 },
            keepLines: true,
            spacing: {
                before: 0,
                after: 0,
                line: LINE,
                lineRule: LR
            },
            children: [run(block.s)]
        });
    });

    sections.push({
        properties: {
            page: {
                ...page,
                pageNumbers: { start: coverPages.length + 1 }
            }
        },
        headers: {
            default: new d.Header({
                children: [
                    new d.Paragraph({
                        alignment: A.RIGHT,
                        children: [
                            new d.TextRun({
                                children: [d.PageNumber.CURRENT],
                                font: F,
                                size: 20
                            })
                        ]
                    })
                ]
            })
        },
        children
    });

    const document = new d.Document({
        creator: c.aut || '',
        title: c.tit || 'Documento ABNT',
        styles: {
            default: {
                document: {
                    run: { font: F, size: Z }
                }
            }
        },
        sections
    });

    return d.Packer.toBlob(document);
}

const nome = () => (cfg().tit || 'texto-abnt').replace(/[^\p{L}\p{N}_-]/gu, "").trim().slice(0, 60) || 'texto-abnt';
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
        a.value = t; document.body.append(a); a.select(); document.execCommand('copy'); a.remove();
    }
    toast('Texto copiado!');
};

document.querySelectorAll('[data-tab]').forEach(a => {
    a.addEventListener('click', ev => {
        ev.preventDefault();
        const d = a.dataset, t = E(d.tab);
        if (t && !t.checked) { t.checked = true; t.dispatchEvent(new Event('change')); }
        if (d.to && E(d.to)) E(d.to).checked = true;
        d.go ? E(d.go).scrollIntoView({ behavior: 'smooth' }) : window.scrollTo(0, 0);
    });
});

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