const $ = s => document.querySelector(s);
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.i); toast.i = setTimeout(() => t.classList.remove('on'), 3200) }

/* ---------- salvar / compartilhar ---------- */
async function save(name, data) {
    try {
        const d = window.claude && await claude.use('downloads');
        if (d) { await d.save({ filename: name, data }); return true }
    } catch (e) { if (e && e.code === 'declined') return false }
    const a = document.createElement('a'); a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data])); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); return true
}
async function share(files, text) {
    const fs = files.map(f => new File([f.blob], f.name, { type: f.blob.type }));
    try { if (navigator.canShare && navigator.canShare({ files: fs })) { await navigator.share({ files: fs, text: text || '' }); return } } catch (e) { if (e.name === 'AbortError') return }
    toast('Menu de compartilhar indisponível aqui. Baixando para você anexar.');
    for (const f of files) await save(f.name, f.blob)
}

/* ---------- conversor ---------- */
let out = [];
const f1 = $('#f1');
f1.onchange = () => { const n = f1.files.length; $('#sel').textContent = n ? n + ' arquivo(s): ' + [...f1.files].map(f => f.name).join(', ') : 'Nenhum arquivo selecionado.'; $('#go').disabled = !n };
const rd = f => new Promise((ok, er) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = er; r.readAsDataURL(f) });
const img = s => new Promise((ok, er) => { const i = new Image(); i.onload = () => ok(i); i.onerror = er; i.src = s });
const cv = (w, h, fill) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); if (fill) { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h) } return c };
const blob = (c, t) => new Promise(r => c.toBlob(r, t === 'jpg' ? 'image/jpeg' : 'image/png', .92));
const base = n => n.replace(/\.[^.]+$/, '');
const setWorker = () => { pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js' };
async function pages(f) { // devolve canvases (PDF: 1 por página; imagem: 1)
    if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) {
        setWorker();
        const p = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise, r = [];
        for (let i = 1; i <= p.numPages; i++) {
            const pg = await p.getPage(i), v = pg.getViewport({ scale: 2 }), c = cv(v.width, v.height, true);
            await pg.render({ canvasContext: c.getContext('2d'), viewport: v }).promise; r.push({ c, n: base(f.name) + (p.numPages > 1 ? '-p' + i : '') })
        }
        return r
    }
    const i = await img(await rd(f)), c = cv(i.naturalWidth, i.naturalHeight, true); c.getContext('2d').drawImage(i, 0, 0);
    return [{ c, n: base(f.name) }]
}
$('#go').onclick = async () => {
    const to = document.querySelector('input[name=to]:checked').value, b = $('#go'); b.disabled = true; b.textContent = 'Convertendo…'; out = [];
    try {
        if (to === 'pdf') {
            const PL = window.PDFLib, pdf = await PL.PDFDocument.create();
            for (const f of f1.files) for (const p of await pages(f)) { const jb = await blob(p.c, 'jpg'), im = await pdf.embedJpg(new Uint8Array(await jb.arrayBuffer())), w = p.c.width * .75, hh = p.c.height * .75; pdf.addPage([w, hh]).drawImage(im, { x: 0, y: 0, width: w, height: hh }) }
            out.push({ name: (f1.files.length > 1 ? 'arquivos-juntos' : base(f1.files[0].name)) + '.pdf', blob: new Blob([await pdf.save()], { type: 'application/pdf' }) })
        } else for (const f of f1.files) for (const p of await pages(f)) out.push({ name: p.n + '.' + to, blob: await blob(p.c, to) });
        show()
    } catch (e) { toast('Não consegui converter este arquivo. Tente outro.'); console.error(e) }
    b.disabled = false; b.textContent = '③ Converter'
};
function show() {
    const L = $('#list'); L.textContent = '';
    out.forEach((o, i) => {
        const d = document.createElement('div'); d.className = 'file';
        if (o.blob.type.startsWith('image/')) { const m = document.createElement('img'); m.alt = ''; m.src = URL.createObjectURL(o.blob); d.append(m) }
        const s = document.createElement('span'); s.textContent = o.name; d.append(s);
        const a = document.createElement('button'); a.textContent = '⬇️ Baixar'; a.onclick = () => save(o.name, o.blob);
        const b = document.createElement('button'); b.textContent = '📤 Enviar'; b.onclick = () => share([o]);
        d.append(a, b); L.append(d)
    });
    $('#res').hidden = false; $('#res').scrollIntoView({ behavior: 'smooth' })
}
$('#shAll').onclick = () => share(out);

/* ---------- ABNT ---------- */
const E = id => document.getElementById(id);
const cfg = () => ({
    tipo: E('tipo').value, fonte: E('fnt').value, tam: +E('tam').value, num: E('num').checked, capa: E('capa').checked, rosto: E('rosto').checked,
    inst: E('inst').value.trim(), aut: E('aut').value.trim(), tit: E('tit').value.trim(), cid: E('cid').value.trim(), ano: E('ano').value.trim()
});
const GEO = { W: 595.28, H: 841.89, L: 85.04, R: 56.69, T: 85.04, B: 56.69, IND: 35.43, QI: 113.39, LM: 21.26 };
const strip = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/* anotações informais (nunca removidas sem perguntar) */
const NOTE_START = /^\s*[\(\[]?\s*(teste|testando|test|todo|to do|fixme|obs|observa[cç][aã]o|nota|lembrete|rascunho|draft|coment[aá]rio|anota[cç][aã]o|apagar|deletar|ver depois|revisar|corrigir|completar|xxx+)\s*[\)\]]?\s*(?::|[-–—]\s|$)|^\s*(teste|testando)\b/i;
const NOTE_ANY = /\b(texto de teste|apenas um teste|isto é um teste|lorem ipsum|bl[aá] bl[aá]|(?:escrever|colocar|inserir|colar|completar|adicionar) (?:aqui|depois|mais))\b|^\s*\/\/|\b(?:k{3,}|rsrs+)\b/i;
const NOTE_BRK = /^\s*\[[^\]]{3,}\]\s*$/;
const NOTE_HEAD = /^(anota[cç][õo]es?|rascunhos?|observa[cç][õo]es?|notas?|testes?|todo|lembretes?|coment[aá]rios?)(\s.*)?$/i;
const isNote = b => b.t === 'r' ? false : b.t === 'h' ? NOTE_HEAD.test(b.s) : (NOTE_START.test(b.s) || NOTE_ANY.test(b.s) || NOTE_BRK.test(b.s));
const nkey = b => b.t + '|' + b.s;
const ign = new Set();

/* títulos, listas, citações */
const KNOWN = /^(\d+(\.\d+)*\.?\s+)?(introdu[cç][ãa]o|desenvolvimento|conclus[ãa]o|conclus[õo]es|considera[cç][õo]es finais|refer[êe]ncias( bibliogr[áa]ficas)?|resumo|abstract|metodologia|revis[ãa]o (de|da) literatura|fundamenta[cç][ãa]o te[óo]rica|resultados( e discuss[ãa]o)?|discuss[ãa]o|objetivos?|justificativa|agradecimentos|ap[êe]ndices?|anexos?|material e m[ée]todos)$/i;
const UNNUM = /^(resumo|abstract|resumen|refer[êe]ncias|agradecimentos|ap[êe]ndices?|anexos?|gloss[áa]rio|sum[áa]rio|ep[íi]grafe|dedicat[óo]ria)/i;
const LIST = /^(?:([-•*–—])|(\d{1,2}[.)])|([a-z]\)))\s+(\S.*)$/;
const isCaps = s => /\p{L}/u.test(s) && s === s.toUpperCase() && s.toLowerCase() !== s && (s.length >= 4 || / /.test(s));
let LVFIX = 0, LASTFIX = 0, CHG = [], LOG = [];
function headOf(l) {
    let m;
    if (m = l.match(/^(#{1,3})\s+(.+)$/)) return { lv: m[1].length, s: m[2].trim() };
    if (l.length > 80 || /[.!?;,:]$/.test(l) || /^\[/.test(l)) return null;
    if (m = l.match(/^(\d+(?:\.\d+)*)(\.?)\s+(\p{Lu}.*)$/u)) {
        const lv = m[1].split('.').length;
        if (lv > 1) return { lv: Math.min(lv, 3), s: m[3] };
        if (!m[2]) return { lv: 1, s: m[3] };
        return (isCaps(m[3]) || KNOWN.test(m[3])) ? { lv: 1, s: m[3] } : null
    }
    if (/^\d/.test(l)) return null;
    return (isCaps(l) || KNOWN.test(l)) ? { lv: 1, s: l } : null
}
function parse(t) {
    const out = []; let para = [], ref = false, inList = false, inQ = false; LVFIX = 0;
    const flush = () => { if (para.length) { out.push({ t: 'p', s: para.join(' ') }); para = [] } };
    for (const raw of t.replace(/\r/g, '').split('\n')) {
        const l = raw.replace(/[ \t\u00a0]+/g, ' ').trim();
        if (!l) { flush(); inList = inQ = false; continue }
        const hd = headOf(l);
        if (hd) { flush(); inList = inQ = false; out.push({ t: 'h', lv: hd.lv, s: hd.s }); ref = hd.lv === 1 && /^refer[êe]ncias/i.test(hd.s); continue }
        if (ref) {
            flush(); const pv = out[out.length - 1];
            if (pv && pv.t === 'r' && /^\p{Ll}/u.test(l)) pv.s += ' ' + l; else out.push({ t: 'r', s: l }); continue
        }
        let m;
        if (m = l.match(/^>\s?(.*)$/)) {
            flush(); inList = false; const pv = out[out.length - 1];
            if (inQ && pv && pv.t === 'q') pv.s += ' ' + m[1]; else out.push({ t: 'q', s: m[1] }); inQ = true; continue
        }
        inQ = false;
        if (m = l.match(LIST)) { flush(); out.push({ t: 'li', ord: !!(m[2] || m[3]), mk: m[1] ? '•' : (m[2] || m[3]), s: m[4] }); inList = true; continue }
        if (inList) { out[out.length - 1].s += ' ' + l; continue }
        para.push(l)
    }
    flush(); let prev = 0;
    out.forEach(b => { if (b.t === 'h') { const o = b.lv; b.lv = Math.min(b.lv, prev + 1); if (b.lv !== o) LVFIX++; prev = b.lv } });
    return out
}
function ser(bl) {
    let o = '', pv = null;
    bl.forEach(b => {
        const s = b.t === 'h' ? '#'.repeat(b.lv) + ' ' + b.s : b.t === 'q' ? '> ' + b.s : b.t === 'li' ? (b.ord ? b.mk : '-') + ' ' + b.s : b.s;
        o += (pv ? (pv.t === 'li' && b.t === 'li' ? '\n' : '\n\n') : '') + s; pv = b
    }); return o
}
function layoutModel(bl, c) {
    const n = [0, 0, 0];
    return bl.map(b => {
        if (b.t !== 'h') return b;
        const un = b.lv === 1 && UNNUM.test(b.s); let num = '';
        if (c.num && !un) { if (b.lv > 1 && !n[0]) n[0] = 1; n[b.lv - 1]++; for (let i = b.lv; i < 3; i++)n[i] = 0; num = n.slice(0, b.lv).join('.') }
        return { ...b, un, num, txt: (num ? num + ' ' : '') + (b.lv === 1 ? b.s.toUpperCase() : b.s) }
    })
}
function covers(c) {
    const o = [];
    if (c.capa) o.push([{ s: c.inst.toUpperCase(), b: 1, sb: 0 }, { s: c.aut, sb: 2 }, { s: c.tit.toUpperCase(), b: 1, sb: 8 }, { s: c.cid, sb: 12 }, { s: c.ano, sb: 0 }].filter(i => i.s));
    if (c.rosto) o.push([{ s: c.aut, sb: 0 }, { s: c.tit.toUpperCase(), b: 1, sb: 8 }, { s: c.cid, sb: 14 }, { s: c.ano, sb: 0 }].filter(i => i.s));
    return o.filter(p => p.length)
}

/* citações e referências: só alertas, nada é inventado */
const YR = /\b(?:1[5-9]\d\d|20\d\d)[a-z]?\b|\bs\.?\s?d\.?(?=\W|$)/i;
function citeCheck(bl) {
    const A = [], ok = { n: 0 }, txtB = bl.filter(b => ['p', 'li', 'q'].includes(b.t)), refs = bl.filter(b => b.t === 'r').map(b => strip(b.s).toUpperCase()), au = [];
    const sn = s => strip(s).toUpperCase();
    txtB.forEach(b => {
        const t = b.s, re = /\(([^()]{2,140})\)/g; let m;
        while ((m = re.exec(t))) {
            const g = m[1].trim(); if (!YR.test(g)) continue;
            const apart = g.replace(/,?\s*(?:1[5-9]\d\d|20\d\d)[a-z]?.*$|,?\s*s\.?\s?d\.?.*$/i, '').trim(), before = t.slice(Math.max(0, m.index - 30), m.index);
            const narr = /[A-ZÀ-Ú][\wà-ú'’-]+(?: et al\.?)?\s*$/.test(before);
            if (/\b(autor|ano|fonte|sobrenome|xxxx*)\b|\?\?|^\s*$/i.test(g)) { A.push('Citação com campo não preenchido: (' + g + ')'); continue }
            if (!apart && !narr) { A.push('Citação sem autor: (' + g + '). Informe o autor.'); continue }
            ok.n++; if (apart) au.push(apart.split(/[;,]/)[0].trim().split(' ')[0])
        }
        if (b.t === 'q' && !/\([^()]*(?:\d{4}|s\.?\s?d)[^()]*\)\s*\.?$/.test(t)) A.push('Citação longa sem origem identificada (autor, ano): «' + t.slice(0, 50) + '…»');
        const rq = /[“"]([^”"]{25,})[”"]([^.]{0,80})/g;
        while ((m = rq.exec(t))) {
            const aft = m[2], cm = aft.match(/\(([^()]*(?:\d{4}|s\.?\s?d)[^()]*)\)/);
            if (!cm) A.push('Citação direta sem origem verificável: «' + m[1].slice(0, 45) + '…»');
            else if (!/\bp{1,2}\.|p[áa]g/i.test(cm[1])) A.push('Citação direta sem página: (' + cm[1] + ')')
        }
    });
    const rp = [];
    bl.filter(b => b.t === 'r').forEach(b => {
        const s = b.s, mis = [];
        if (!/^[A-ZÀ-Ú][A-ZÀ-Ú'’ .&-]+,\s+\S|^[A-ZÀ-Ú][A-ZÀ-Ú ]{2,}[.,]/.test(s)) mis.push('autor no formato SOBRENOME, Nome');
        if (!YR.test(s)) mis.push('ano');
        if (s.replace(/^[^.]*\./, '').trim().length < 10) mis.push('título e dados de publicação');
        if (/https?:\/\//.test(s)) { if (!/Dispon[ií]vel em/i.test(s)) mis.push('«Disponível em:»'); if (!/Acesso em/i.test(s)) mis.push('«Acesso em:»') }
        if (mis.length) rp.push('Referência incompleta («' + s.slice(0, 45) + '…»): falta ' + mis.join(', '))
    });
    const miss = [...new Set(au)].filter(a => refs.length && !refs.some(r => r.startsWith(sn(a))));
    const sorted = [...refs].sort((a, b) => a.localeCompare(b, 'pt'));
    return { cit: A, ok: ok.n, ref: rp, nref: refs.length, miss, alpha: refs.length < 2 || refs.every((r, i) => r === sorted[i]), qn: A.length }
}

/* ---------- preview ---------- */
function render() {
    const c = cfg(), P = E('paper'); P.textContent = '';
    P.style.fontFamily = c.fonte === 'helvetica' ? 'Arial,Helvetica,sans-serif' : '"Times New Roman",Times,serif'; P.style.fontSize = c.tam + 'pt';
    covers(c).forEach(pg => {
        const d = document.createElement('div'); d.className = 'cv';
        pg.forEach(it => { const p = document.createElement('p'); p.textContent = it.s; p.style.marginTop = (it.sb * 1.5) + 'em'; if (it.b) p.style.fontWeight = '700'; d.append(p) }); P.append(d)
    });
    layoutModel(parse(E('out').value), c).forEach(b => {
        let e;
        if (b.t === 'h') { e = document.createElement(['', 'h2', 'h3', 'h4'][b.lv]); e.textContent = b.txt; if (b.un) e.className = 'c' }
        else if (b.t === 'li') { e = document.createElement('div'); e.className = 'li'; const m = document.createElement('span'); m.textContent = b.mk; const x = document.createElement('span'); x.textContent = b.s; e.append(m, x) }
        else { e = document.createElement(b.t === 'q' ? 'blockquote' : 'p'); if (b.t === 'r') e.className = 'r'; e.textContent = b.s }
        if (isNote(b) && !ign.has(nkey(b))) e.classList.add('nt'); P.append(e)
    });
    const k = Math.min(1, (document.querySelector('.paper-box').clientWidth - 24) / 794); P.style.zoom = k || 1
}

/* ---------- anotações: perguntar antes de remover ---------- */
function notesUI() {
    const bl = parse(E('out').value), N = bl.filter(b => isNote(b) && !ign.has(nkey(b))), box = E('notes'), L = E('nl'); L.textContent = ''; box.hidden = !N.length;
    N.forEach(b => {
        const li = document.createElement('li'), sp = document.createElement('span');
        const kind = b.t === 'h' ? 'Seção' : b.t === 'li' ? 'Item de lista' : b.t === 'q' ? 'Citação' : 'Parágrafo';
        sp.textContent = kind + ': «' + b.s.slice(0, 90) + (b.s.length > 90 ? '…' : '') + '»';
        const r = document.createElement('button'), k = document.createElement('button'); r.textContent = 'Remover'; k.textContent = 'Manter';
        r.onclick = () => { LOG.push(['k', 'Removido por você: «' + b.s.slice(0, 60) + '»' + (b.t === 'h' ? ' (seção inteira)' : '')]); dropNote(nkey(b)) }; k.onclick = () => { LOG.push(['i', 'Mantido por você: «' + b.s.slice(0, 60) + '»']); ign.add(nkey(b)); refresh() };
        li.append(sp, r, k); L.append(li)
    });
    E('nrAll').onclick = () => { N.forEach(b => { LOG.push(['k', 'Removido por você: «' + b.s.slice(0, 60) + '»']); dropNote(nkey(b), true) }); refresh() }; E('nkAll').onclick = () => { N.forEach(b => { LOG.push(['i', 'Mantido por você: «' + b.s.slice(0, 60) + '»']); ign.add(nkey(b)) }); refresh() }
}
function dropNote(key, quiet) {
    const bl = parse(E('out').value), i = bl.findIndex(b => nkey(b) === key); if (i < 0) return; let j = i + 1;
    if (bl[i].t === 'h') while (j < bl.length && !(bl[j].t === 'h' && bl[j].lv <= bl[i].lv)) j++;
    bl.splice(i, j - i); E('out').value = ser(bl); if (!quiet) refresh()
}

/* ---------- layout A4 (usado no PDF e na verificação) ---------- */
function layout(bl, c, cov, mw, san) {
    const { W, H, L, R, T, B, IND, QI, LM } = GEO, Z = c.tam, SL = Z * 1.15, LH = SL * 1.5, qs = Math.min(10, Z - 1), w = W - L - R, bot = H - B, items = [];
    let pgn = -1, y = T, pend = 0; const np = () => { pgn++; y = T; pend = 0 };
    const sp = (f, s) => mw(f, s, ' ');
    const chunk = (wd, f, s, mx) => { const o = []; let cur = ''; for (const ch of wd) { if (mw(f, s, cur + ch) > mx && cur) { o.push(cur); cur = ch } else cur += ch } o.push(cur); return o };
    const wrap = (txt, f, s, mx, ind) => {
        const ws = txt.split(' ').filter(Boolean), sps = sp(f, s), Ls = []; let cur = [], cw = 0;
        const push = (last, noj) => { if (cur.length) { Ls.push({ w: cur, last, noj }); cur = []; cw = 0 } };
        for (const wd of ws) {
            const ww = mw(f, s, wd);
            if (ww > mx) { push(false); const fr = chunk(wd, f, s, mx); fr.slice(0, -1).forEach(x => Ls.push({ w: [x], last: true, noj: true })); cur = [fr[fr.length - 1]]; cw = mw(f, s, cur[0]); continue }
            const nw = cur.length ? cw + sps + ww : ww;
            if (nw > mx - (Ls.length ? 0 : ind) && cur.length) { push(false); cur = [wd]; cw = ww } else { cur.push(wd); cw = nw }
        }
        push(true); return Ls
    };
    const mkb = b => {
        if (b.t === 'h') return { kind: 'h', f: b.lv < 3 ? 'b' : 'i', size: Z, lh: LH, x0: L, maxW: w, ind: 0, just: 0, align: b.un && b.lv === 1 ? 'c' : 'l', before: LH, after: LH, keepNext: 1, keepWhole: 1, txt: b.txt };
        if (b.t === 'q') return { kind: 'q', f: 'n', size: qs, lh: qs * 1.15, x0: L + QI, maxW: w - QI, ind: 0, just: 1, before: LH, after: LH, txt: b.s };
        if (b.t === 'li') return { kind: 'li', f: 'n', size: Z, lh: LH, x0: L + IND + LM, maxW: w - IND - LM, ind: 0, just: 1, before: 0, after: 0, mark: b.mk, mkx: L + IND, txt: b.s, short: 1 };
        if (b.t === 'r') return { kind: 'r', f: 'n', size: Z, lh: SL, x0: L, maxW: w, ind: 0, just: 0, before: 0, after: SL, keepWhole: 1, txt: b.s };
        return { kind: 'p', f: 'n', size: Z, lh: LH, x0: L, maxW: w, ind: IND, just: 1, before: 0, after: 0, txt: b.s }
    };
    const blocks = bl.map(mkb); blocks.forEach(b => { b.lines = wrap(san(b.txt), b.f, b.size, b.maxW, b.ind); if (b.short && b.lines.length <= 3) b.keepWhole = 1 });
    cov.forEach(pgv => {
        np(); let yy = T; pgv.forEach(it => {
            yy += it.sb * LH; const f = it.b ? 'b' : 'n';
            wrap(san(it.s), f, Z, w, 0).forEach(ln => {
                const nat = ln.w.reduce((a, x) => a + mw(f, Z, x), 0) + (ln.w.length - 1) * sp(f, Z);
                items.push({ role: 'cover', pg: pgn, x: L + (w - nat) / 2, w: nat, yTop: yy, lh: LH, size: Z, f, words: ln.w, extra: 0 }); yy += LH
            })
        })
    });
    if (blocks.length) np();
    const place = (b, bi, nb) => {
        const n = b.lines.length; let i = 0;
        while (i < n) {
            const rem = n - i, first = i === 0, atTop = y === T, sb = atTop ? 0 : (first ? Math.max(b.before, pend) : 0), room = bot - y - sb, fit = Math.floor((room + 0.01) / b.lh);
            if (first && b.keepNext && nb && !atTop) { const need = n * b.lh + b.after + Math.min(2, nb.lines.length) * nb.lh; if (room + 0.01 < need) { np(); continue } }
            let take = rem;
            if (fit < rem) {
                if (b.keepWhole || rem < 4) take = 0; else { take = fit; if (take < 2) take = 0; else if (rem - take < 2) take = rem - 2 }
                if (take <= 0) { if (!atTop) { np(); continue } take = Math.max(1, fit) }
            }
            for (let k = 0; k < take; k++) {
                const ln = b.lines[i + k], fl = i + k === 0, x0 = b.x0 + (fl ? b.ind : 0), av = b.maxW - (fl ? b.ind : 0),
                nat = ln.w.reduce((a, x) => a + mw(b.f, b.size, x), 0) + (ln.w.length - 1) * sp(b.f, b.size);
                let extra = 0, wd = nat; if (b.just && !ln.last && !ln.noj && ln.w.length > 1 && nat < av) { extra = (av - nat) / (ln.w.length - 1); wd = av }
                items.push({
                    role: 'body', blk: bi, bt: b.kind, li: i + k, n, pg: pgn, x: b.align === 'c' ? L + (w - wd) / 2 : x0, w: wd, yTop: y + sb + k * b.lh, lh: b.lh, size: b.size, f: b.f, words: ln.w, extra,
                    mk: b.mark && i + k === 0 ? san(b.mark) : null, mkx: b.mkx, fl
                })
            }
            y += sb + take * b.lh; pend = (i + take === n) ? b.after : 0; i += take; if (i < n) np()
        }
    };
    blocks.forEach((b, i) => place(b, i, blocks[i + 1]));
    for (let p = cov.length; p <= pgn; p++) { const s = String(p + 1), wd = mw('n', 10, s); items.push({ role: 'num', pg: p, x: W - R - wd, w: wd, base: 56.69 + 7.2, lh: 11.5, size: 10, f: 'n', words: [s], extra: 0 }) }
    return { items, pages: pgn + 1, cov: cov.length }
}

function analyze(r, c, sizes, badc) {
    const { W, H, L, R, T, B, IND } = GEO, Z = c.tam, LH = Z * 1.15 * 1.5, qs = Math.min(10, Z - 1), b = r.items.filter(i => i.role === 'body'), e = .5, o = { pages: r.pages, badc, w: Math.round(sizes[0].width * 100) / 100, h: Math.round(sizes[0].height * 100) / 100 };
    o.sizeOk = sizes.every(s => Math.abs(s.width - W) < .1 && Math.abs(s.height - H) < .1);
    o.minX = Math.min(...b.map(i => i.x)); o.rightM = W - Math.max(...b.map(i => i.x + i.w)); o.top = Math.min(...b.map(i => i.yTop)); o.botM = H - Math.max(...b.map(i => i.yTop + i.lh));
    o.fontOk = r.items.every(i => ['n', 'b', 'i'].includes(i.f)); o.sizeBody = b.every(i => Math.abs(i.size - (i.bt === 'q' ? qs : Z)) < .01);
    const pp = b.filter(i => (i.bt === 'p' || i.bt === 'li') && i.li > 0); o.pitchBad = pp.filter(i => { const pv = b.find(j => j.blk === i.blk && j.li === i.li - 1 && j.pg === i.pg); return pv && Math.abs(i.yTop - pv.yTop - LH) > .02 }).length;
    o.indN = b.filter(i => i.bt === 'p' && i.fl).length; o.indBad = b.filter(i => i.bt === 'p' && i.fl && Math.abs(i.x - (L + IND)) > .2).length;
    o.leftBad = b.filter(i => i.bt === 'p' && !i.fl && Math.abs(i.x - L) > .2).length;
    const js = b.filter(i => i.just); o.justN = js.length; o.justBad = js.filter(i => Math.abs(i.x + i.w - (W - R)) > e).length;
    o.headEnd = 0; for (let p = r.cov; p < r.pages; p++) { const it = b.filter(i => i.pg === p); if (it.length && it[it.length - 1].bt === 'h') o.headEnd++ }
    const seg = {}; b.forEach(i => { (seg[i.blk] = seg[i.blk] || {})[i.pg] = (seg[i.blk][i.pg] || 0) + 1 });
    o.split = 0; Object.values(seg).forEach(s => { const k = Object.values(s); if (k.length > 1 && k.some(v => v === 1)) o.split++ });
    o.numN = r.items.filter(i => i.role === 'num').length; o.numFirst = r.cov + 1; o.numRight = r.items.filter(i => i.role === 'num').every(i => Math.abs(i.x + i.w - (W - R)) < .1);
    o.cut = Math.max(0, ...b.map(i => i.yTop + i.lh - (H - B))); return o
}

let REP = null, LAST = null;
async function buildPdf() {
    const P = window.PDFLib; if (!P) throw new Error('pdflib');
    const c = cfg(), raw = E('out').value, bl = layoutModel(parse(raw), c), pdf = await P.PDFDocument.create();
    const fam = c.fonte === 'helvetica' ? ['Helvetica', 'HelveticaBold', 'HelveticaOblique'] : ['TimesRoman', 'TimesRomanBold', 'TimesRomanItalic'];
    const F = { n: await pdf.embedFont(P.StandardFonts[fam[0]]), b: await pdf.embedFont(P.StandardFonts[fam[1]]), i: await pdf.embedFont(P.StandardFonts[fam[2]]) };
    const badc = new Set(), cache = new Map();
    const san = s => [...String(s).replace(/\u00a0/g, ' ').replace(/[\t\r\n]+/g, ' ')].map(ch => { if (cache.has(ch)) return cache.get(ch); let r = ch; try { F.n.widthOfTextAtSize(ch, 12) } catch (e) { r = '?'; badc.add(ch) } cache.set(ch, r); return r }).join('');
    const cwc = {}, cw = (f, ch) => { const k = f + ch; return cwc[k] ?? (cwc[k] = F[f].widthOfTextAtSize(ch, 1000) / 1000) };
    const r = layout(bl, c, covers(c), (f, s, t) => { let w = 0; for (const ch of t) w += cw(f, ch); return w * s }, san);
    for (let i = 0; i < r.pages; i++)pdf.addPage([GEO.W, GEO.H]);
    r.items.forEach(it => {
        const pg = pdf.getPage(it.pg), font = F[it.f], base = it.base ?? (it.yTop + (it.lh - it.size) / 2 + it.size * .8), txt = it.words.join(' '); if (!txt) return;
        if (it.extra > 0) pg.pushOperators(P.setWordSpacing(it.extra));
        pg.drawText(txt, { x: it.x, y: GEO.H - base, size: it.size, font });
        if (it.extra > 0) pg.pushOperators(P.setWordSpacing(0));
        if (it.mk) pg.drawText(it.mk, { x: it.mkx, y: GEO.H - base, size: it.size, font })
    });
    pdf.setTitle(c.tit || 'Documento ABNT'); pdf.setAuthor(c.aut || ''); pdf.setProducer('Me-Formata'); try { pdf.setLanguage('pt-BR') } catch (e) { }
    const bytes = await pdf.save(), chk = await P.PDFDocument.load(bytes);
    return { blob: new Blob([bytes], { type: 'application/pdf' }), rep: analyze(r, c, chk.getPages().map(p => p.getSize()), [...badc]) }
}
const sig = () => E('out').value + JSON.stringify(cfg());
async function getPdf() { if (LAST && LAST.key === sig()) return LAST.blob; const r = await buildPdf(); REP = r.rep; LAST = { key: sig(), blob: r.blob }; return r.blob }
async function measure() {
    if (!E('out').value.trim()) { REP = null; verify(); return }
    try { const k = sig(), r = await buildPdf(); REP = r.rep; LAST = { key: k, blob: r.blob } } catch (e) { REP = { err: e.message === 'pdflib' ? 'biblioteca de PDF não carregou (verifique a internet)' : e.message } }
    verify()
}
let tm = 0; function refresh() { REP = null; render(); notesUI(); verify(); renderChg(); clearTimeout(tm); tm = setTimeout(measure, 450) }

/* ---------- verificação: corretos, incorretos, pendentes ---------- */
function verify() {
    const c = cfg(), L = E('chk'), raw = E('out').value; L.textContent = '';
    if (!raw.trim()) { E('chkS').textContent = 'Verificação das normas'; const li = document.createElement('li'); li.className = 'p'; li.textContent = 'Clique em Formatar para ver a verificação.'; L.append(li); return }
    const bl = layoutModel(parse(raw), c), R = [], A = (k, s) => R.push([k, s]), hs = bl.filter(b => b.t === 'h'), h1 = hs.filter(b => b.lv === 1).map(b => b.s).join('|'), cc = citeCheck(bl), cm = v => (v / 28.3465).toFixed(2).replace('.', ',') + ' cm';
    hs.length ? A('k', `Títulos: ${hs.length} (${hs.filter(b => b.lv === 1).length} seção(ões), ${hs.filter(b => b.lv === 2).length} subseção(ões), ${hs.filter(b => b.lv === 3).length} de 3º nível), com destaque por nível (1 maiúsculas e negrito, 2 negrito, 3 itálico).`) : A('p', 'Nenhum título detectado. Use # para título de seção, ## para subseção e ### para o 3º nível.');
    LASTFIX > 0 && A('k', `${LASTFIX} salto(s) de nível de título corrigido(s) (ex.: de 1 direto para 3).`);
    hs.length && (c.num ? A('k', 'Numeração progressiva das seções (1, 1.1, 1.1.1). Resumo, Referências e similares ficam sem número e centralizados.') : A('p', 'Numeração progressiva desligada nas configurações.'));
    const li = bl.filter(b => b.t === 'li').length; li && A('k', `${li} item(ns) de lista mantido(s), cada um em sua própria linha.`);
    const nn = bl.filter(b => isNote(b) && !ign.has(nkey(b))).length;
    nn ? A('p', `${nn} possível(is) anotação(ões) informal(is) aguardam sua decisão (veja o quadro amarelo). Nada foi removido.`) : A('k', 'Nenhuma anotação informal pendente de decisão.');
    /INTRODU/i.test(h1) || A('p', 'Seção “Introdução” não encontrada.');
    /CONCLU|CONSIDERA[ÇC]/i.test(h1) || A('p', 'Seção “Conclusão” ou “Considerações finais” não encontrada.');
    const sec = hs.filter(b => b.lv === 1 && !UNNUM.test(b.s) && !/introdu|conclus|considera/i.test(b.s)).length; sec || A('p', 'Desenvolvimento: nenhuma seção entre a introdução e a conclusão foi identificada.');
    cc.cit.slice(0, 8).forEach(s => A('p', s)); cc.cit.length > 8 && A('p', `…e mais ${cc.cit.length - 8} alerta(s) de citação.`);
    cc.ref.slice(0, 8).forEach(s => A('p', s)); cc.ref.length > 8 && A('p', `…e mais ${cc.ref.length - 8} referência(s) incompleta(s).`);
    cc.miss.forEach(a => A('p', `Citação de “${a}” sem referência correspondente na lista.`));
    cc.ok && !cc.nref && A('p', `${cc.ok} citação(ões) no texto, mas a seção Referências não existe ou está vazia.`);
    cc.nref && !cc.ok && A('p', 'Há referências, mas nenhuma citação (AUTOR, ano) foi encontrada no texto.');
    cc.nref && !cc.alpha && A('p', 'As referências não estão em ordem alfabética, como a ABNT pede.');
    cc.nref && !cc.ref.length && !cc.miss.length && cc.alpha && A('k', `${cc.nref} referência(s) com autor, ano e título identificados, em ordem alfabética.`);
    cc.ok && !cc.qn && A('k', `${cc.ok} citação(ões) com autor e ano.`);
    A('p', 'Citações diretas com mais de 3 linhas devem começar com “>” (recuo de 4 cm, fonte menor).');
    const ps = bl.filter(b => b.t === 'p' && !/[.!?:;"”)…]$/.test(b.s)).length; ps && A('p', `${ps} parágrafo(s) não terminam com pontuação (possível frase incompleta). Revise, nada foi alterado.`);
    const f = o => Object.entries(o).filter(([, v]) => !v).map(([k]) => k);
    if (c.capa) { const m = f({ 'instituição': c.inst, autor: c.aut, 'título': c.tit, cidade: c.cid, ano: c.ano }); m.length ? A('p', 'Capa: faltam ' + m.join(', ') + '.') : A('k', 'Capa com todos os dados informados.') }
    if (c.rosto) { const m = f({ autor: c.aut, 'título': c.tit, cidade: c.cid, ano: c.ano }); m.length ? A('p', 'Folha de rosto: faltam ' + m.join(', ') + '.') : A('p', 'Folha de rosto gerada. A natureza do trabalho e o orientador precisam ser acrescentados por você, se exigidos.') }
    if (!REP) A('p', 'Medindo o PDF gerado…');
    else if (REP.err) A('x', 'Não foi possível gerar o PDF: ' + REP.err);
    else {
        const r = REP, G = GEO;
        A(r.sizeOk ? 'k' : 'x', `Papel A4 no PDF gerado: ${r.w} × ${r.h} pt (21,0 × 29,7 cm), ${r.pages} página(s).`);
        A(r.minX >= G.L - .5 ? 'k' : 'x', `Margem esquerda medida: ${cm(r.minX)} (mínimo 3,00 cm).`);
        A(r.rightM >= G.R - .5 ? 'k' : 'x', `Margem direita medida: ${cm(r.rightM)} (mínimo 2,00 cm).`);
        A(r.top >= G.T - .5 ? 'k' : 'x', `Margem superior medida: ${cm(r.top)} (mínimo 3,00 cm).`);
        A(r.botM >= G.B - .5 ? 'k' : 'x', `Margem inferior medida: ${cm(r.botM)} (mínimo 2,00 cm).`);
        A(r.fontOk && r.sizeBody ? 'k' : 'x', `Fonte ${c.fonte === 'helvetica' ? 'Arial' : 'Times New Roman'} ${c.tam} no corpo; citações longas em fonte menor.`);
        A(r.pitchBad ? 'x' : 'k', r.pitchBad ? `${r.pitchBad} linha(s) com espaçamento diferente de 1,5.` : 'Espaçamento 1,5 entre linhas (igual ao Word) em todos os parágrafos.');
        r.indN && A(r.indBad || r.leftBad ? 'x' : 'k', r.indBad || r.leftBad ? 'Recuo da primeira linha fora de 1,25 cm em alguns parágrafos.' : `Recuo de 1,25 cm na primeira linha de ${r.indN} parágrafo(s).`);
        r.justN && A(r.justBad ? 'x' : 'k', r.justBad ? `${r.justBad} linha(s) justificada(s) não chegam à margem direita.` : `${r.justN} linha(s) justificadas até a margem direita.`);
        A(r.numRight && r.numN ? 'k' : 'p', r.numN ? `Paginação no canto superior direito, de ${r.numFirst} a ${r.pages}` + (r.numFirst > 1 ? ' (capa e folha de rosto entram na contagem, sem número impresso).' : '.') : 'Sem páginas textuais para numerar.');
        A(r.headEnd ? 'x' : 'k', r.headEnd ? `${r.headEnd} título(s) isolado(s) no fim de página.` : 'Nenhum título isolado no fim de página.');
        A(r.split ? 'x' : 'k', r.split ? `${r.split} parágrafo(s) deixam uma linha só (viúva ou órfã) entre páginas.` : 'Nenhum parágrafo cortado deixando uma linha isolada entre páginas.');
        A(r.cut > .5 ? 'x' : 'k', r.cut > .5 ? 'Há texto ultrapassando a margem inferior.' : 'Nenhum texto cortado ou fora da área útil.');
        r.badc.length && A('x', 'Caracteres sem suporte na fonte do PDF, trocados por “?”: ' + r.badc.join(' ') + '. Revise o texto.')
    }
    A('p', 'DOCX: usa as mesmas configurações e mantém títulos com o parágrafo seguinte, mas a paginação final é feita pelo Word. Abra-o e confira.');
    A('p', 'Sumário, notas de rodapé, tabelas e figuras não são gerados. A ortografia não é corrigida automaticamente.');
    A('p', 'Exigências específicas da sua instituição não foram verificadas. Este resultado não garante conformidade total com a ABNT.');
    const ord = { x: 0, p: 1, k: 2 }; R.sort((a, b) => ord[a[0]] - ord[b[0]]);
    R.forEach(([k, s]) => { const l = document.createElement('li'); l.className = k; l.textContent = s; L.append(l) });
    const n = k => R.filter(r => r[0] === k).length; E('chkS').textContent = `Verificação · ✅ ${n('k')} corretos · ❌ ${n('x')} incorretos · ⏳ ${n('p')} pendentes`
}

function chg(o, bl) {
    const sp = (o.match(/[ \t]{2,}/g) || []).length, n = t => bl.filter(b => b.t === t).length, hs = bl.filter(b => b.t === 'h'); CHG = []; LOG = [];
    sp && CHG.push(['k', sp + ' espaçamento(s) duplicado(s) removido(s).']);
    hs.length && CHG.push(['k', `${hs.length} título(s) padronizado(s) em até 3 níveis${LASTFIX ? ` (${LASTFIX} salto(s) de nível corrigido(s))` : ''}. Numeração antiga substituída pela progressiva, se ligada. Confira se algum parágrafo curto foi tomado por título.`]);
    n('li') && CHG.push(['k', n('li') + ' item(ns) de lista preservado(s) em linhas separadas.']);
    n('p') && CHG.push(['k', n('p') + ' parágrafo(s) justificado(s) com recuo de 1,25 cm e espaçamento 1,5.']);
    n('r') && CHG.push(['k', n('r') + ' referência(s) em espaço simples.']); renderChg()
}
function renderChg() {
    const L = E('chg'); L.textContent = ''; if (!CHG.length) return;
    const nt = parse(E('out').value).filter(b => isNote(b) && !ign.has(nkey(b))).length, all = [...CHG];
    nt && all.push(['p', nt + ' possível(is) anotação(ões) informal(is) aguardando sua decisão. Nada foi removido sem você confirmar.']);
    LOG.forEach(x => all.push(x)); all.push(['i', 'Nenhuma palavra do conteúdo foi alterada. Maiúsculas nos títulos de seção e a numeração são só formatação.']);
    all.forEach(([k, s]) => { const li = document.createElement('li'); li.className = k; li.textContent = s; L.append(li) })
}
const st = async (v, m) => { E('prog').hidden = false; E('prog').value = v; E('pm').textContent = m; await new Promise(r => setTimeout(r, 70)) };
E('fmtBtn').onclick = async () => {
    const o = E('txt').value; if (!o.trim()) return toast('Cole ou importe um texto primeiro.');
    try {
        await st(20, 'Lendo o texto…'); const bl = parse(o); LASTFIX = LVFIX; await st(50, 'Organizando títulos, listas e parágrafos…'); E('out').value = ser(bl);
        await st(75, 'Montando as páginas A4…'); render(); notesUI(); chg(o, bl); REP = null; await measure(); await st(100, 'Pronto!');
        setTimeout(() => { E('prog').hidden = true; E('pm').textContent = '' }, 700); E('paper').scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    catch (e) { E('prog').hidden = true; toast('Erro ao formatar o texto.'); console.error(e) }
};
E('clr').onclick = () => { E('txt').value = ''; E('out').value = ''; E('f2').value = ''; ign.clear(); LAST = null; refresh(); toast('Conteúdo limpo.') };
const PRE = { escolar: [0, 0], artigo: [0, 0], relatorio: [1, 0], tcc: [1, 1] };
E('tipo').onchange = () => { const p = PRE[E('tipo').value]; if (p) { E('capa').checked = !!p[0]; E('rosto').checked = !!p[1] } refresh() };
['fnt', 'tam', 'num', 'capa', 'rosto', 'inst', 'aut', 'tit', 'cid', 'ano'].forEach(i => E(i).addEventListener('input', refresh));
E('out').oninput = refresh; addEventListener('resize', render); E('t2').onchange = refresh; refresh();
async function pdfText(f) {
    setWorker(); const p = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise, pg = [];
    for (let i = 1; i <= p.numPages; i++) {
        const c = await (await p.getPage(i)).getTextContent(); let s = '', ly = null, lh = 12;
        for (const it of c.items) {
            const y = it.transform[5], h = it.height || lh;
            if (ly !== null && Math.abs(y - ly) > h * .5) s += (ly - y > h * 1.8) ? '\n\n' : '\n';
            s += it.str; ly = y; lh = h
        }
        pg.push(s)
    }
    return pg.join('\n').replace(/(\p{L})-\n(\p{L})/gu, '$1$2')
}
E('f2').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 25 * 1048576) return toast('Arquivo muito grande (máximo 25 MB).');
    try {
        let t; await st(30, 'Lendo o arquivo…');
        if (/\.docx$/i.test(f.name)) t = (await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value;
        else if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') t = await pdfText(f);
        else if (/\.txt$/i.test(f.name) || f.type === 'text/plain') t = await f.text();
        else { E('prog').hidden = true; return toast('Formato não aceito. Use .txt, .docx ou .pdf.') }
        E('prog').hidden = true; E('pm').textContent = '';
        if (!t.trim()) return toast('Nenhum texto encontrado. Se o PDF for escaneado (imagem), é preciso OCR, que não está disponível aqui.');
        E('txt').value = t; toast('Arquivo importado. Agora clique em Formatar.')
    }
    catch (x) { E('prog').hidden = true; toast('Não foi possível ler este arquivo.') }
};
document.querySelectorAll('label.drop').forEach(d => {
    const i = d.querySelector('input');
    ['dragenter', 'dragover'].forEach(n => d.addEventListener(n, e => { e.preventDefault(); d.classList.add('over') }));
    ['dragleave', 'drop'].forEach(n => d.addEventListener(n, e => { e.preventDefault(); d.classList.remove('over') }));
    d.addEventListener('drop', e => { if (e.dataTransfer.files.length) { i.files = e.dataTransfer.files; i.dispatchEvent(new Event('change')) } })
});

/* ----- exportação ----- */
const plain = () => layoutModel(parse(E('out').value), cfg()).map(b => b.t === 'h' ? b.txt : b.t === 'li' ? b.mk + ' ' + b.s : b.t === 'p' ? '      ' + b.s : b.s).join('\n\n');
const need = () => E('out').value.trim() ? true : (toast('Clique em Formatar primeiro.'), false);
function makeDocx() {
    const d = window.docx; if (!d) throw new Error('docx');
    const c = cfg(), bl = layoutModel(parse(E('out').value), c), Z = c.tam * 2, LT = Math.round(c.tam * 1.15 * 1.5 * 20), ST = Math.round(c.tam * 1.15 * 20), F = c.fonte === 'helvetica' ? 'Arial' : 'Times New Roman', A = d.AlignmentType, AU = d.LineRuleType.AUTO;
    const run = (s, o = {}) => new d.TextRun({ text: s, font: F, size: o.sz || Z, bold: !!o.b, italics: !!o.i });
    const pg = { size: { width: 11906, height: 16838 }, margin: { top: 1701, left: 1701, bottom: 1134, right: 1134 } }, cov = covers(c), secs = [];
    if (cov.length) secs.push({ properties: { page: pg }, children: cov.flatMap((p, i) => p.map((it, j) => new d.Paragraph({ alignment: A.CENTER, pageBreakBefore: i > 0 && j === 0, spacing: { before: Math.round(it.sb * LT), line: 360, lineRule: AU }, children: [run(it.s, { b: it.b })] }))) });
    let pa = 0; const gap = (bf, af) => { const v = Math.max(0, bf - pa); pa = af; return v };
    const kids = bl.map(b => {
        if (b.t === 'h') return new d.Paragraph({ alignment: b.un && b.lv === 1 ? A.CENTER : A.LEFT, keepNext: true, keepLines: true, spacing: { before: gap(LT, LT), after: LT, line: 360, lineRule: AU }, children: [run(b.txt, { b: b.lv < 3, i: b.lv === 3 })] });
        if (b.t === 'q') return new d.Paragraph({ alignment: A.JUSTIFIED, indent: { left: 2268 }, keepLines: true, spacing: { before: gap(LT, LT), after: LT, line: 240, lineRule: AU }, children: [run(b.s, { sz: Math.min(10, c.tam - 1) * 2 })] });
        if (b.t === 'r') return new d.Paragraph({ alignment: A.LEFT, keepLines: true, spacing: { before: gap(0, ST), after: ST, line: 240, lineRule: AU }, children: [run(b.s)] });
        if (b.t === 'li') return new d.Paragraph({ alignment: A.JUSTIFIED, indent: { left: 1134, hanging: 425 }, tabStops: [{ type: d.TabStopType.LEFT, position: 1134 }], keepLines: true, spacing: { before: gap(0, 0), after: 0, line: 360, lineRule: AU }, children: [run(b.mk), new d.TextRun({ children: [new d.Tab()], font: F, size: Z }), run(b.s)] });
        return new d.Paragraph({ alignment: A.JUSTIFIED, indent: { firstLine: 709 }, spacing: { before: gap(0, 0), after: 0, line: 360, lineRule: AU }, children: [run(b.s)] })
    });
    secs.push({
        properties: { page: { ...pg, pageNumbers: { start: cov.length + 1 } } },
        headers: { default: new d.Header({ children: [new d.Paragraph({ alignment: A.RIGHT, children: [new d.TextRun({ children: [d.PageNumber.CURRENT], font: F, size: 20 })] })] }) }, children: kids
    });
    return d.Packer.toBlob(new d.Document({ creator: c.aut || '', title: c.tit || 'Documento ABNT', styles: { default: { document: { run: { font: F, size: Z } } } }, sections: secs }))
}
const nome = () => (cfg().tit || 'texto-abnt').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 60) || 'texto-abnt';
const safe = async fn => { try { await fn() } catch (e) { toast(e.message === 'docx' ? 'Biblioteca DOCX não carregou. Verifique a internet.' : e.message === 'pdflib' ? 'Biblioteca de PDF não carregou. Verifique a internet.' : 'Erro ao gerar o arquivo.'); console.error(e) } };
E('dx').onclick = () => need() && safe(async () => { await st(50, 'Gerando DOCX…'); const b = await makeDocx(); E('prog').hidden = true; E('pm').textContent = ''; await save(nome() + '.docx', b) });
E('dl').onclick = () => need() && safe(async () => { await st(50, 'Gerando PDF…'); const b = await getPdf(); E('prog').hidden = true; E('pm').textContent = ''; verify(); await save(nome() + '.pdf', b) });
E('shr').onclick = () => need() && safe(async () => share([{ name: nome() + '.pdf', blob: await getPdf() }]));
E('pr').onclick = () => need() && (window.print(), toast('Se a impressão não abrir, use Baixar PDF.'));
E('mail').onclick = () => need() && window.open('mailto:?subject=' + encodeURIComponent(cfg().tit || 'Texto formatado em ABNT') + '&body=' + encodeURIComponent(plain()), '_blank');
E('wa').onclick = () => need() && window.open('https://wa.me/?text=' + encodeURIComponent(plain()), '_blank');
E('cp').onclick = async () => {
    if (!need()) return; const t = plain();
    try { await navigator.clipboard.writeText(t) } catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.append(a); a.select(); document.execCommand('copy'); a.remove() }
    toast('Texto copiado!')
};

/* ----- navegação entre as três páginas ----- */
const goto = id => { const e = E(id); e && e.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth', block: 'start' }) };
let sec = 'inicio';
const mark = () => {
    const t = ['t0', 't1', 't2'].find(i => E(i).checked), cur = t !== 't0' ? t : ({ inicio: 't0', como: 'como', mais: 'como', sobre: 'sobre' }[sec]);
    document.querySelectorAll('.top nav [data-nav]').forEach(n => n.setAttribute('aria-current', n.dataset.nav === cur))
};
document.querySelectorAll('[data-tab]').forEach(a => a.addEventListener('click', ev => {
    ev.preventDefault(); const d = a.dataset, t = E(d.tab);
    if (!t.checked) { t.checked = true; t.dispatchEvent(new Event('change')) }
    if (d.to) E(d.to).checked = true;
    d.go ? goto(d.go) : scrollTo(0, 0)
}));
document.querySelectorAll('.top nav label').forEach(l => l.addEventListener('click', () => scrollTo(0, 0)));
['t0', 't1', 't2'].forEach(i => E(i).addEventListener('change', () => { mark(); scrollTo(0, 0) }));
if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { sec = e.target.id; mark() } }), { rootMargin: '-45% 0px -50% 0px' });
    ['inicio', 'como', 'mais', 'sobre'].forEach(i => io.observe(E(i)))
}
mark();