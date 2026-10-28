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
// Evita falsos positivos: títulos, subtítulos e metadados não são frases comuns.
function needsPunctuationReview(b) {
    if (!b || b.t !== 'p') return false;
    const s = String(b.s || '').trim();
    if (!s || /[.!?:;"'”)…]$/.test(s) || NOTE_START.test(s) || URLONLY.test(s)) return false;
    if (/^\d{4}(?:[a-z])?$/i.test(s)) return false; // ano isolado
    if (/^[\p{L} .’'`-]+\s*[-–—,]\s*[A-Z]{2}$/u.test(s)) return false; // cidade/UF
    if (/^(?:fonte|fonte:|elaboração própria|elaborado pelo autor|palavras-chave|keywords)\b/i.test(s)) return false;
    const words = s.split(/\s+/).filter(Boolean);
    const titleLike = /^(?:como\b|por que\b|porquê\b|o papel de\b|a importância de\b|impactos de\b|estratégias para\b|benefícios de\b|desafios de\b)/i.test(s);
    // Uma linha curta, sem estrutura clara de frase, costuma ser título/subtítulo ou metadado.
    if ((b.nl || 1) === 1 && s.length <= 140 && words.length <= 15 && titleLike) return false;
    if ((b.nl || 1) === 1 && s.length <= 90 && words.length <= 10 && !/\b(?:é|são|foi|foram|está|estão|tem|têm|pode|podem|deve|devem|busca|buscam|contribui|contribuem|apresenta|apresentam|envolve|envolvem|permite|permitem|indica|indicam|consiste|consistem|visa|visam|mostra|mostram|inclui|incluem|possui|possuem|ocorre|ocorrem)\b/i.test(s)) return false;
    return true;
}
const nkey = b => b.t + '|' + b.s;
const ign = new Set();

/* títulos, listas, citações */
const KNOWN = /^(\d+(\.\d+)*\.?\s+)?(introdu[cç][ãa]o|desenvolvimento|conclus[ãa]o|conclus[õo]es|considera[cç][õo]es finais|refer[êe]ncias( bibliogr[áa]ficas)?|resumo|abstract|metodologia|revis[ãa]o (de|da) literatura|fundamenta[cç][ãa]o te[óo]rica|resultados( e discuss[ãa]o)?|discuss[ãa]o|objetivos?|justificativa|agradecimentos|ap[êe]ndices?|anexos?|material e m[ée]todos)$/i;
const UNNUM = /^(resumo|abstract|resumen|refer[êe]ncias|agradecimentos|ap[êe]ndices?|anexos?|gloss[áa]rio|sum[áa]rio|ep[íi]grafe|dedicat[óo]ria)/i;
const LIST = /^(?:([-•*–—])|(\d{1,2}[.)])|([a-z]\)))\s+(\S.*)$/;
const isCaps = s => /\p{L}/u.test(s) && s === s.toUpperCase() && s.toLowerCase() !== s && (s.length >= 4 || / /.test(s));
let LVFIX = 0, LASTFIX = 0, CHG = [], LOG = [], LVLOG = [];
function headOf(l, iso) {
    let m;
    // Linhas de sumário com pontilhado e número de página não são títulos do corpo.
    if (/\.{3,}\s*\d+\s*$/.test(l)) return null;
    if (m = l.match(/^(#{1,3})\s+(.+)$/)) {
        let s = m[2].trim(), no = '', dot = false, n;
        if (n = s.match(/^(\d+(?:\.\d+)*)(\.?)\s+(\S.*)$/)) { no = n[1]; dot = !!n[2]; s = n[3] }
        return { lv: m[1].length, s, no, dot }
    }
    if (l.length > 80 || /[.!?;,:]$/.test(l) || /^\[/.test(l)) return null;
    if (m = l.match(/^(\d+(?:\.\d+)*)(\.?)\s+(\p{Lu}.*)$/u)) {
        const lv = m[1].split('.').length;
        if (lv > 1) return { lv: Math.min(lv, 3), s: m[3], no: m[1], dot: !!m[2] };
        if (!m[2]) return { lv: 1, s: m[3], no: m[1], dot: false };
        return (isCaps(m[3]) || KNOWN.test(m[3]) || iso) ? { lv: 1, s: m[3], no: m[1], dot: true } : null
    }
    if (/^\d/.test(l)) return null;
    return (isCaps(l) || KNOWN.test(l)) ? { lv: 1, s: l, no: '', dot: false } : null
}
function parse(t) {
    const out = [], lines = t.replace(/\r/g, '').split('\n'); let para = [], pl = 0, ref = false, inList = false, inQ = false, startedMain = false; LVFIX = 0; LVLOG = [];
    const flush = () => { if (para.length) { out.push({ t: 'p', s: para.join(' '), ln: pl, nl: para.length }); para = [] } };
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i].replace(/[ \t\u00a0]+/g, ' ').trim();
        if (!l) { flush(); inList = inQ = false; continue }
        // O texto extraído pode conter capa/folha de rosto. Esses elementos já são
        // gerados pelos campos do sistema, portanto não devem reaparecer no corpo.
        if (!startedMain) {
            if (/^sum[áa]rio$/i.test(strip(l)) || /^(?:#{1,3}\s*)?(?:introdu[cç][ãa]o|1\s+introdu[cç][ãa]o)$/i.test(strip(l))) {
                startedMain = true;
            } else {
                continue;
            }
        }
        const iso = (i === 0 || !lines[i - 1].trim()) && (i + 1 >= lines.length || !lines[i + 1].trim());
        const hd = headOf(l, iso);
        if (hd) { flush(); inList = inQ = false; out.push({ t: 'h', ...hd, ln: i + 1 }); ref = hd.lv === 1 && /^refer[êe]ncias/i.test(hd.s); continue }
        if (ref) {
            flush(); const pv = out[out.length - 1];
            if (pv && pv.t === 'r' && !URLONLY.test(pv.s) && !/[.)]$/.test(pv.s) && (/^\p{Ll}/u.test(l) || (/^https?:/i.test(l) && /:\s*$/.test(pv.s)))) { pv.s += ' ' + l; pv.nl++ } else out.push({ t: 'r', s: l, ln: i + 1, nl: 1 }); continue
        }
        let m;
        if (m = l.match(/^>\s?(.*)$/)) {
            flush(); inList = false; const pv = out[out.length - 1];
            if (inQ && pv && pv.t === 'q') { pv.s += ' ' + m[1]; pv.nl++ } else out.push({ t: 'q', s: m[1], ln: i + 1, nl: 1 }); inQ = true; continue
        }
        inQ = false;
        if (m = l.match(LIST)) { flush(); out.push({ t: 'li', ord: !!(m[2] || m[3]), mk: m[1] ? '•' : (m[2] || m[3]), mr: m[1] || '', s: m[4], ln: i + 1, nl: 1 }); inList = true; continue }
        if (inList) { const pv = out[out.length - 1]; pv.s += ' ' + l; pv.nl++; continue }
        if (!para.length) pl = i + 1; para.push(l)
    }
    flush(); let prev = 0;
    out.forEach(b => { if (b.t === 'h') { const o = b.lv; b.lv = Math.min(b.lv, prev + 1); if (b.lv !== o) { LVLOG.push({ ln: b.ln, s: b.s, from: o, to: b.lv }); LVFIX++ } prev = b.lv } });
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

/* ---------- ANÁLISE (NBR 14724 · 6024 · 6023 · 10520) ---------- */
const URLONLY = /^(?:https?:\/\/|www\.)\S+$/i;
let ANA = null;
function ctx(bl, i) { if (bl[i].t === 'h') return 'linha ' + bl[i].ln; let h = null; for (let k = i - 1; k >= 0; k--)if (bl[k].t === 'h') { h = bl[k]; break } return 'linha ' + bl[i].ln + (h ? ` (seção «${h.s.slice(0, 35)}»)` : '') }
function citations(bl) {
    const C = [];
    bl.forEach((b, i) => {
        if (!['p', 'li', 'q'].includes(b.t)) return; const t = b.s; let m; const re = /\(([^()]{2,160})\)/g;
        while ((m = re.exec(t))) {
            const g = m[1]; if (!YR.test(g)) continue;
            if (/[A-ZÀ-Ú][\wà-úÀ-Ú'’-]+(?: et al\.?)?\s*$/.test(t.slice(Math.max(0, m.index - 30), m.index)) && /^\s*(?:1[5-9]\d\d|20\d\d)/.test(g)) continue;
            g.split(';').forEach(seg => {
                const mm = seg.trim().match(/^(.*?),?\s*((?:1[5-9]\d\d|20\d\d)[a-z]?|s\.?\s?d\.?)\s*(?:,\s*(p{1,2}\.\s*[\d\-–, ]+|p[áa]gs?\.?\s*[\d\-–, ]+))?$/i);
                if (mm) C.push({ i, raw: '(' + seg.trim() + ')', au: mm[1].trim(), yr: mm[2], pg: !!mm[3], kind: 'par', idx: m.index, t, ln: b.ln })
            })
        }
        const rn = /([A-ZÀ-Ú][\wà-úÀ-Ú'’-]+(?: et al\.?)?)\s*\(((?:1[5-9]\d\d|20\d\d)[a-z]?)(?:,\s*(p{1,2}\.\s*[\d\-–]+))?\)/g;
        while ((m = rn.exec(t))) C.push({ i, raw: m[0], au: m[1], yr: m[2], pg: !!m[3], kind: 'nar', idx: m.index, t, ln: b.ln })
    });
    return C
}
const ckey = s => strip(s).toUpperCase().split(/;| ET AL| E /)[0].replace(/[^A-Z' -]/g, '').trim();
function sortRefs(bl) {
    const idx = bl.map((b, i) => b.t === 'r' && !URLONLY.test(b.s) ? i : -1).filter(i => i >= 0); if (idx.length < 2) return 0;
    const a = idx.map(i => bl[i]).sort((x, y) => strip(x.s).toUpperCase().localeCompare(strip(y.s).toUpperCase(), 'pt')); idx.forEach((i, k) => bl[i] = a[k]); return idx.length
}
function analyzeDoc(raw, c) {
    const bl = parse(raw), lvlog = [...LVLOG], lines = raw.replace(/\r/g, '').split('\n'), F = [];
    const A = (cat, st, t, o = {}) => F.push({ cat, st, t, ...o });
    const lim = cat => { let n = 0; return (st, t, o) => { n++; if (n <= 10) A(cat, st, t, o); else if (n === 11) A(cat, st, '…e mais ocorrências do mesmo tipo', { norma: o.norma, why: 'Há outros itens como os listados acima.', fix: 'Revise o restante do documento.' }) } };
    const hs = bl.map((b, i) => ({ b, i })).filter(x => x.b.t === 'h'), h1 = hs.filter(x => x.b.lv === 1 && !UNNUM.test(x.b.s)).map(x => x.b);
    /* NBR 6024: numeração progressiva */
    const cn = [0, 0, 0], exp = new Map(), nm = lim('Numeração');
    hs.forEach(({ b }) => { if (b.lv === 1 && UNNUM.test(b.s)) { exp.set(b, ''); return } if (b.lv > 1 && !cn[0]) cn[0] = 1; cn[b.lv - 1]++; for (let k = b.lv; k < 3; k++)cn[k] = 0; exp.set(b, cn.slice(0, b.lv).join('.')) });
    const nNum = hs.filter(x => x.b.no).length; let nProb = 0;
    hs.forEach(({ b, i }) => {
        const e = exp.get(b), W = ctx(bl, i);
        if (!e && b.no) { nProb++; nm('auto', `Elemento sem indicativo numérico recebeu número: «${b.no} ${b.s.slice(0, 30)}»`, { ln: b.ln, where: W, norma: 'NBR 6024 e NBR 14724', why: 'Referências, Resumo, Agradecimentos e similares não levam número de seção e são centralizados.', fix: 'Remover o número e centralizar o título.' }) }
        else if (e && b.no && b.no !== e) { nProb++; nm('auto', `Numeração inconsistente: «${b.no} ${b.s.slice(0, 35)}»`, { ln: b.ln, where: W, norma: 'NBR 6024', why: `A numeração progressiva deve seguir a ordem das seções. Pela posição no texto, o número esperado é ${e}.`, fix: `Renumerar de ${b.no} para ${e}.` }) }
        else if (e && !b.no && nNum) { nProb++; nm('auto', `Título sem número entre seções numeradas: «${b.s.slice(0, 40)}»`, { ln: b.ln, where: W, norma: 'NBR 6024', why: 'Se o trabalho usa numeração progressiva, todas as seções do texto devem ser numeradas.', fix: `Numerar como ${e}.` }) }
    });
    const dots = hs.filter(x => x.b.dot && x.b.no);
    dots.length && A('Numeração', 'auto', `${dots.length} título(s) com ponto depois do número (ex.: «${dots[0].b.no}.»)`, { ln: dots[0].b.ln, lns: dots.map(x => x.b.ln), where: 'linha ' + dots[0].b.ln, norma: 'NBR 6024', why: 'O indicativo numérico é seguido de espaço, sem ponto, hífen ou travessão.', fix: 'Remover o ponto depois do número.' });
    hs.forEach(({ b, i }, k) => {
        if (b.lv >= 3 || (b.lv === 1 && UNNUM.test(b.s))) return; let ch = 0; for (let j = k + 1; j < hs.length && hs[j].b.lv > b.lv; j++)if (hs[j].b.lv === b.lv + 1) ch++;
        ch === 1 && A('Numeração', 'confirm', `Seção com uma única subseção: «${b.s.slice(0, 40)}»`, { ln: b.ln, where: ctx(bl, i), norma: 'NBR 6024 (boa prática)', why: 'Em geral, uma seção só é dividida quando há pelo menos duas subseções.', fix: 'Junte a subseção ao texto da seção ou crie outra subseção. Não alterei o conteúdo.' })
    });
    /* hierarquia */
    lvlog.forEach(x => A('Hierarquia', 'auto', `Salto de nível no título «${x.s.slice(0, 40)}» (de nível ${x.from} para ${x.to})`, { ln: x.ln, where: 'linha ' + x.ln, norma: 'NBR 6024', why: 'Uma subseção só pode aparecer dentro de uma seção do nível imediatamente superior.', fix: `Título ajustado para o nível ${x.to}.` }));
    const cap = h1.filter(b => isCaps(b.s)).length;
    h1.length > 1 && cap && cap < h1.length && A('Hierarquia', 'auto', 'Seções primárias escritas de formas diferentes (algumas em maiúsculas, outras não)', { ln: h1[0].ln, lns: h1.map(b => b.ln), norma: 'NBR 6024 e NBR 14724', why: 'Títulos do mesmo nível devem ter o mesmo destaque gráfico.', fix: 'Seções primárias padronizadas em MAIÚSCULAS e negrito; secundárias em negrito; terciárias em itálico.' });
    const refLn = (hs.find(x => x.b.lv === 1 && /^refer/i.test(x.b.s)) || { b: { ln: 1e9 } }).b.ln, hset = new Set(bl.filter(b => b.t === 'h').map(b => b.ln)), tc = lim('Hierarquia');
    lines.forEach((raw0, i) => {
        const l = raw0.trim(); if (!l || i + 1 >= refLn || hset.has(i + 1) || (i > 0 && lines[i - 1].trim())) return;
        let k = i + 1; while (k < lines.length && !lines[k].trim()) k++; const nx = lines[k] || '', nxH = hset.has(k + 1), w = l.split(/\s+/).length;
        if (l.length >= 8 && l.length <= 70 && w >= 2 && w <= 9 && /^\p{Lu}/u.test(l) && !/[.!?;,:]$/.test(l) && !LIST.test(l) && !/^[>#\[(]/.test(l) && (nx.trim().length > 60 || nxH) && !NOTE_START.test(l))
            tc('confirm', `Possível título não identificado: «${l}»`, { ln: i + 1, where: 'linha ' + (i + 1), norma: 'NBR 6024 / NBR 14724', why: 'A linha parece um título (curta, sem ponto final, antes de um parágrafo), mas não tem número nem marcação. Não é possível ter certeza.', fix: 'Se for um título, comece a linha com # (seção) ou ## (subseção).' })
    });
    /* parágrafos e formatação */
    const ind = lines.map((l, i) => /^(?: {2,}|\t)\S/.test(l) && !LIST.test(l.trim()) && !hset.has(i + 1) ? i + 1 : 0).filter(Boolean);
    ind.length && A('Parágrafos', 'auto', `${ind.length} linha(s) com recuo feito à mão (espaços ou tabulação)`, { ln: ind[0], lns: ind, where: 'linhas ' + ind.slice(0, 5).join(', ') + (ind.length > 5 ? '…' : ''), norma: 'NBR 14724 e padrão acadêmico', why: 'O recuo da primeira linha deve ser padronizado (1,25 cm), e não digitado com espaços.', fix: 'Espaços removidos e recuo de 1,25 cm aplicado a todos os parágrafos.' });
    const hw = bl.filter(b => b.t === 'p' && b.nl > 1);
    hw.length && A('Parágrafos', 'auto', `${hw.length} parágrafo(s) com quebras de linha forçadas no meio`, { ln: hw[0].ln, lns: hw.map(b => b.ln), where: 'a partir da linha ' + hw[0].ln, norma: 'NBR 14724', why: 'Cada parágrafo deve fluir como um bloco único, justificado.', fix: 'Linhas unidas em um único parágrafo, sem alterar nenhuma palavra.' });
    const ds = lines.map((l, i) => /\S {2,}\S/.test(l) ? i + 1 : 0).filter(Boolean);
    ds.length && A('Parágrafos', 'auto', `${ds.length} linha(s) com espaços duplicados`, { ln: ds[0], lns: ds, where: 'linha ' + ds[0] + (ds.length > 1 ? ' e outras' : ''), norma: 'NBR 14724', why: 'Espaçamento irregular prejudica o alinhamento justificado.', fix: 'Espaços extras removidos.' });
    const bk = (raw.match(/\n[ \t]*\n[ \t]*\n/g) || []).length;
    bk && A('Parágrafos', 'auto', `${bk} trecho(s) com várias linhas em branco seguidas`, { norma: 'NBR 14724', why: 'O espaçamento entre blocos deve ser uniforme.', fix: 'Linhas em branco padronizadas.' });
    const mrs = new Set(bl.filter(b => b.t === 'li' && b.mr).map(b => b.mr));
    mrs.size > 1 && A('Parágrafos', 'auto', `Marcadores de lista diferentes no mesmo documento (${[...mrs].join(' ')})`, { ln: bl.find(b => b.t === 'li' && b.mr).ln, lns: bl.filter(b => b.t === 'li' && b.mr).map(b => b.ln), norma: 'Padrão acadêmico', why: 'Listas equivalentes devem ter a mesma aparência.', fix: 'Marcadores uniformizados, um item por linha.' });
    const np = lim('Parágrafos');
    bl.forEach((b, i) => { if (needsPunctuationReview(b)) np('confirm', `Possível frase sem pontuação final: «${b.s.slice(0, 45)}${b.s.length > 45 ? '…' : ''}»`, { ln: b.ln, where: ctx(bl, i), norma: 'Revisão textual (não é exigência geral da NBR 14724)', why: 'Um trecho textual sem pontuação pode estar incompleto. Títulos, subtítulos, anos, cidades e metadados são excluídos desta verificação.', fix: 'Confira se a frase está completa e acrescente pontuação apenas se necessário. O texto não foi alterado.' }) });
    A('Formatação da página', 'unverif', 'Margens, fonte, tamanho e espaçamento do arquivo original não puderam ser verificados', { norma: 'NBR 14724', why: 'O texto colado ou importado não traz informações de formatação (só as palavras).', fix: 'O documento final recebe A4, margens 3/3/2/2 cm, fonte 12, espaçamento 1,5, recuo de 1,25 cm e justificado.' });
    /* NBR 10520: citações */
    const refs = bl.map((b, i) => ({ b, i })).filter(x => x.b.t === 'r' && !URLONLY.test(x.b.s)).map(x => ({ ...x, sn: strip(x.b.s).toUpperCase().split(/[,.]/)[0].trim(), yr: (x.b.s.match(/\b(?:1[5-9]\d\d|20\d\d)\b/) || [''])[0] }));
    const cites = citations(bl), ct = lim('Citações'), match = cc => { const k = ckey(cc.au); return k ? refs.filter(r => r.sn === k || r.sn.startsWith(k) || (r.sn.length > 2 && k.startsWith(r.sn))) : [] };
    const seen = new Set(); let okC = 0;
    cites.forEach(cc => {
        const id = cc.i + '|' + cc.raw; if (seen.has(id)) return; seen.add(id); const W = ctx(bl, cc.i);
        if (!cc.au || /\b(autor|ano|fonte|sobrenome|xxxx*)\b|\?\?/i.test(cc.au)) { ct('confirm', `Citação sem autor identificável: ${cc.raw}`, { ln: cc.ln, where: W, norma: 'NBR 10520', why: 'A citação precisa indicar o autor (ou entidade) e o ano.', fix: 'Informe o autor da obra. Não posso inventá-lo.' }); return }
        const ms = match(cc), yr4 = (cc.yr.match(/\d{4}/) || [''])[0];
        if (!refs.length || !ms.length) ct('confirm', `Citação sem referência correspondente: ${cc.raw}`, { ln: cc.ln, where: W, norma: 'NBR 10520 e NBR 6023', why: 'Toda obra citada no texto deve constar na lista de referências.', fix: 'Inclua a referência completa de ' + cc.au + ' ou revise a citação. Não encontrei os dados dessa obra no documento.' });
        else if (yr4 && !ms.some(r => r.yr === yr4)) ct('confirm', `Ano da citação diferente da referência: ${cc.raw}`, { ln: cc.ln, where: W, norma: 'NBR 10520 e NBR 6023', why: `A citação indica ${yr4}, mas a referência de ${ms[0].sn} indica ${ms[0].yr || '(sem ano)'}.`, fix: 'Confira qual é o ano correto na obra. Não alterei nenhum dos dois.' });
        else okC++;
        const pre = cc.t.slice(Math.max(0, cc.idx - 400), cc.idx), post = cc.t.slice(cc.idx + cc.raw.length, cc.idx + cc.raw.length + 400), dir = /[“"][^”"]{15,}[”"]\s*$/.test(pre) || (cc.kind === 'nar' && /^[\s,:]*[“"][^”"]{15,}[”"]/.test(post));
        if (dir && !cc.pg) ct('confirm', `Citação direta sem página: ${cc.raw}`, { ln: cc.ln, where: W, norma: 'NBR 10520', why: 'Em citações diretas, a página (ou seção) da fonte é obrigatória.', fix: 'Acrescente a página, por exemplo: ' + cc.raw.replace(/\)$/, ', p. __)') + '. Não conheço a página.' });
        if (cc.kind === 'par' && cc.au && cc.au !== cc.au.toUpperCase() && !/^s\.?\s?d/i.test(cc.au)) ct('confirm', `Autor entre parênteses fora de caixa alta: ${cc.raw}`, { ln: cc.ln, where: W, norma: 'NBR 10520', why: 'Quando o autor aparece entre parênteses, o sobrenome vai em MAIÚSCULAS.', fix: 'Escreva ' + cc.raw.replace(cc.au, cc.au.toUpperCase()) + '. Não alterei o texto sem sua confirmação.' })
    });
    const dq = lim('Citações');
    bl.forEach((b, i) => {
        if (b.t === 'q' && !/\([^()]*(?:\d{4}|s\.?\s?d)[^()]*\)\s*\.?$/.test(b.s)) dq('confirm', `Citação longa sem origem identificada: «${b.s.slice(0, 40)}…»`, { ln: b.ln, where: ctx(bl, i), norma: 'NBR 10520', why: 'Toda citação deve indicar a fonte (autor, ano e página).', fix: 'Acrescente (AUTOR, ano, p. _) ao final.' });
        if (['p', 'li'].includes(b.t)) {
            const rq = /[“"]([^”"]+)[”"]/g; let m; while ((m = rq.exec(b.s))) {
                const nw = m[1].split(/\s+/).length, aft = b.s.slice(m.index + m[0].length, m.index + m[0].length + 90);
                if (nw >= 40) dq('confirm', `Possível citação longa dentro do parágrafo (${nw} palavras): «${m[1].slice(0, 35)}…»`, { ln: b.ln, where: ctx(bl, i), norma: 'NBR 10520', why: 'Citação direta com mais de 3 linhas deve ficar em bloco recuado 4 cm, em fonte menor e sem aspas.', fix: 'Se for citação direta, mova-a para um parágrafo iniciado por >.' });
                else if (nw >= 6 && !/\([^()]*(?:\d{4}|s\.?\s?d)[^()]*\)/.test(aft) && !cites.some(x => x.i === i && x.kind === 'nar')) dq('confirm', `Trecho entre aspas sem fonte identificável: «${m[1].slice(0, 40)}…»`, { ln: b.ln, where: ctx(bl, i), norma: 'NBR 10520', why: 'Texto entre aspas é citação direta e precisa de autor, ano e página.', fix: 'Indique a fonte ou retire as aspas. Não alterei o texto.' })
            }
        }
    });
    cites.length && !ANA_okc(F) && okC && A('Citações', 'ok', `${okC} citação(ões) com autor, ano e referência correspondente`, {});
    /* NBR 6023: referências */
    const rf = lim('Referências'), urls = bl.map((b, i) => ({ b, i })).filter(x => ['p', 'r', 'li'].includes(x.b.t) && URLONLY.test(x.b.s));
    urls.forEach(({ b, i }) => rf('confirm', `Endereço de site isolado, sem identificação bibliográfica: ${b.s.slice(0, 60)}`, { ln: b.ln, where: ctx(bl, i), norma: 'NBR 6023', why: 'Um link sozinho não é uma referência: faltam autor, título, data de publicação e data de acesso.', fix: 'Complete: AUTOR. Título da página. Site, ano. Disponível em: <' + b.s.slice(0, 40) + '…>. Acesso em: dia mês ano. Não consigo descobrir esses dados.' }));
    const cr = refs.filter(r => !urls.some(u => u.b === r.b));
    cr.forEach(({ b, i }) => {
        const s = b.s, W = ctx(bl, i), mis = [], short = '«' + s.slice(0, 38) + '…»';
        if (!/^[A-ZÀ-Ú][A-ZÀ-Ú'’ .&-]+,\s+\S|^[A-ZÀ-Ú][A-ZÀ-Ú ]{2,}[.,]/.test(s)) mis.push('autor no formato SOBRENOME, Nome');
        if (!/\b(?:1[5-9]\d\d|20\d\d)\b|\bs\.?\s?d\b/i.test(s)) mis.push('ano de publicação');
        if (s.replace(/^[^.]*\./, '').trim().length < 8) mis.push('título');
        if (/https?:\/\//.test(s)) { if (!/Dispon[ií]vel em/i.test(s)) mis.push('«Disponível em:»'); if (!/Acesso em/i.test(s)) mis.push('«Acesso em:» (data de acesso)') }
        if (mis.length) rf('confirm', `Referência incompleta ${short}`, { ln: b.ln, where: W, norma: 'NBR 6023', why: 'Faltam elementos essenciais: ' + mis.join(', ') + '.', fix: 'Complete com os dados da obra. Não invento dados ausentes.' });
        else if (!/https?:\/\//.test(s) && !/\bv\.\s*\d|\bn\.\s*\d|\bp\.\s*\d|\bp\.\s*\d/.test(s) && !/:\s*[^.,]{2,},?\s*(?:1[5-9]\d\d|20\d\d)/.test(s)) rf('unverif', `Não foi possível identificar local e editora (ou periódico) em ${short}`, { ln: b.ln, where: W, norma: 'NBR 6023', why: 'Livros exigem «Local: Editora, ano»; artigos exigem periódico, volume, número e páginas. O tipo da obra não pôde ser confirmado.', fix: 'Confira se a referência está completa para o tipo de documento.' })
    });
    const dup = new Set(); cr.forEach(r => { const k = strip(r.b.s).toLowerCase().replace(/\W/g, ''); dup.has(k) ? rf('confirm', `Referência repetida «${r.b.s.slice(0, 38)}…»`, { ln: r.b.ln, where: ctx(bl, r.i), norma: 'NBR 6023', why: 'A mesma obra aparece mais de uma vez.', fix: 'Mantenha apenas uma.' }) : dup.add(k) });
    const rc = lim('Referências');
    cr.forEach(r => { if (!cites.some(cc => { const k = ckey(cc.au); return k && (r.sn === k || r.sn.startsWith(k) || k.startsWith(r.sn)) })) rc('confirm', `Referência sem citação identificável no texto: «${r.b.s.slice(0, 38)}…»`, { ln: r.b.ln, where: ctx(bl, r.i), norma: 'NBR 6023 e NBR 10520', why: 'Toda obra da lista deve ser citada no texto (autor e ano).', fix: 'Cite a obra no texto ou retire-a da lista, se não foi usada.' }) });
    if (!refs.length && !urls.length && cites.length) A('Referências', 'confirm', 'Há citações, mas não há lista de referências', { norma: 'NBR 6023', why: 'As obras citadas precisam constar numa seção de Referências ao final.', fix: 'Adicione a seção REFERÊNCIAS com as obras citadas.' });
    const so = [...refs].sort((a, b) => strip(a.b.s).toUpperCase().localeCompare(strip(b.b.s).toUpperCase(), 'pt'));
    refs.length > 1 && refs.some((r, i) => r !== so[i]) && A('Referências', 'confirm', 'Referências fora de ordem alfabética', { ln: refs[0].b.ln, lns: refs.map(r => r.b.ln), where: 'a partir da linha ' + refs[0].b.ln, norma: 'NBR 6023', why: 'As referências devem estar em ordem alfabética pelo sobrenome do autor.', fix: 'Reordenar em ordem alfabética (apenas muda a ordem das linhas).', act: 'sortRefs' });
    /* estrutura do tipo de documento */
    const hu = h1.map(b => strip(b.s).toUpperCase()).join('|') + '|' + hs.filter(x => UNNUM.test(x.b.s)).map(x => strip(x.b.s).toUpperCase()).join('|');
    const has = (re) => re.test(hu), mid = h1.some(b => !/INTRODU|CONCLU|CONSIDERA|RESUMO|REFER/i.test(strip(b.s)));
    const R = { escolar: ['INTRODU', 'DESENV', 'CONCLU|CONSIDERA', 'REFER'], relatorio: ['INTRODU', 'DESENV', 'CONCLU|CONSIDERA'], artigo: ['RESUMO', 'INTRODU', 'DESENV', 'CONCLU|CONSIDERA', 'REFER'], tcc: ['RESUMO', 'INTRODU', 'DESENV', 'CONCLU|CONSIDERA', 'REFER'] }[c.tipo];
    const NM = { 'INTRODU': 'Introdução', 'DESENV': 'Desenvolvimento', 'CONCLU|CONSIDERA': 'Conclusão ou Considerações finais', 'REFER': 'Referências', 'RESUMO': 'Resumo' }, tl = { escolar: 'trabalho escolar', relatorio: 'relatório', artigo: 'artigo científico', tcc: 'TCC' }[c.tipo];
    if (R) {
        R.forEach(k => { const okk = k === 'DESENV' ? (has(/DESENV/) || mid) : has(new RegExp(k)); if (!okk) A('Estrutura', 'confirm', `Elemento esperado para ${tl} não encontrado: ${NM[k]}`, { norma: 'NBR 14724', why: 'A estrutura usual desse tipo de trabalho inclui este elemento. Sua instituição pode exigir algo diferente.', fix: 'Adicione a seção ou confirme que ela não é exigida.' }) });
        c.tipo === 'artigo' && !/^palavras-chave\s*:/im.test(raw) && A('Estrutura', 'confirm', 'Palavras-chave não encontradas', { norma: 'Estrutura usual de artigo (NBR 6022)', why: 'Artigos costumam trazer palavras-chave após o resumo.', fix: 'Acrescente a linha «Palavras-chave: …».' });
        c.tipo === 'tcc' && A('Estrutura', 'unverif', 'Sumário, listas e demais elementos pré-textuais não são gerados nesta versão', { norma: 'NBR 14724', why: 'Dependem de numeração de páginas e exigências da instituição.', fix: 'Inclua-os manualmente no Word, se forem exigidos.' })
    }
    else A('Estrutura', 'unverif', 'Estrutura exigida para «Outro» depende da orientação do professor', { norma: 'NBR 14724', why: 'Não há estrutura-padrão para este tipo.', fix: 'Escolha um tipo específico para verificar a estrutura.' });
    const f2 = o => Object.entries(o).filter(([, v]) => !v).map(([k]) => k);
    if (c.capa || c.rosto) { const m = f2({ 'instituição': c.inst, autor: c.aut, 'título': c.tit, cidade: c.cid, ano: c.ano }); m.length && A('Pré-textuais', 'confirm', 'Dados da capa/folha de rosto incompletos: faltam ' + m.join(', '), { norma: 'NBR 14724', why: 'Esses dados só podem ser informados por você.', fix: 'Preencha em «Dados do trabalho». O que ficar vazio não é inventado.' }) }
    const nt = bl.filter(isNote); nt.length && A('Anotações', 'confirm', `${nt.length} possível(is) anotação(ões) informal(is) no texto`, { ln: nt[0].ln, lns: nt.map(b => b.ln), where: 'linha ' + nt[0].ln, norma: 'NBR 14724 (texto formal)', why: 'Notas de teste e comentários não fazem parte do trabalho.', fix: 'O conteúdo foi preservado. Revise manualmente e remova apenas se confirmar que é uma anotação provisória.' });
    hs.length && !nProb && !lvlog.length && A('Numeração e hierarquia', 'ok', 'Numeração e hierarquia dos títulos coerentes', {});
    return { F, raw, applied: false }
}
function ANA_okc(F) { return F.some(f => f.cat === 'Citações' && f.st === 'ok') }

/* ---------- preview ---------- */
function render() {
    const c = cfg(), P = E('paper'); P.textContent = '';
    P.style.fontFamily = c.fonte === 'helvetica' ? 'Arial,Helvetica,sans-serif' : '"Times New Roman",Times,serif'; P.style.fontSize = c.tam + 'pt';
    covers(c).forEach(pg => {
        const d = document.createElement('div'); d.className = 'cv';
        pg.forEach(it => { const p = document.createElement('p'); p.textContent = it.s; p.style.marginTop = (it.sb * 1.5) + 'em'; if (it.b) p.style.fontWeight = '700'; d.append(p) }); P.append(d)
    });
    let sheet = null;
    layoutModel(parse(E('out').value), c).forEach((b, idx) => {
        if (b.t === 'h' || !sheet) {
            sheet = document.createElement('div');
            sheet.className = 'preview-sheet' + (idx === 0 && b.t !== 'h' ? ' first-sheet' : '');
            P.append(sheet);
        }
        let e;
        if (b.t === 'h') { e = document.createElement(['', 'h2', 'h3', 'h4'][b.lv]); e.textContent = b.txt; e.classList.add('starts-page'); if (b.un) e.classList.add('c') }
        else if (b.t === 'li') { e = document.createElement('div'); e.className = 'li'; const m = document.createElement('span'); m.textContent = b.mk; const x = document.createElement('span'); x.textContent = b.s; e.append(m, x) }
        else { e = document.createElement(b.t === 'q' ? 'blockquote' : 'p'); if (b.t === 'r') e.className = 'r'; e.textContent = b.s }
        sheet.append(e);
    });
    const k = Math.min(1, Math.max(.3, (document.querySelector('.paper-box').clientWidth - 24) / 794)); P.style.zoom = k
}

/* O painel de anotações informais foi removido. O texto nunca é apagado automaticamente. */
function notesUI() { /* intencionalmente sem interface */ }

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
        if (b.kind === 'h' && y !== T) np();
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
function verify() { /* painel de verificação removido; visualização e exportação preservadas */ }

function chg(o, bl) {
    const sp = (o.match(/[ \t]{2,}/g) || []).length, n = t => bl.filter(b => b.t === t).length, hs = bl.filter(b => b.t === 'h'); CHG = []; LOG = [];
    sp && CHG.push(['k', sp + ' espaçamento(s) duplicado(s) removido(s).']);
    hs.length && CHG.push(['k', `${hs.length} título(s) padronizado(s) em até 3 níveis${LASTFIX ? ` (${LASTFIX} salto(s) de nível corrigido(s))` : ''}. Numeração antiga substituída pela progressiva, se ligada. Confira se algum parágrafo curto foi tomado por título.`]);
    n('li') && CHG.push(['k', n('li') + ' item(ns) de lista preservado(s) em linhas separadas.']);
    n('p') && CHG.push(['k', n('p') + ' parágrafo(s) justificado(s) com recuo de 1,25 cm e espaçamento 1,5.']);
    n('r') && CHG.push(['k', n('r') + ' referência(s) em espaço simples.']); renderChg()
}
function renderChg() { /* painel de alterações removido da interface */ }

const st = async (v, m) => { E('prog').hidden = false; E('prog').value = v; E('pm').textContent = m; await new Promise(r => setTimeout(r, 70)) };
/* ---------- FLUXO: envio → análise → relatório → formatação → comparação → exportação ---------- */
function setStage(n) { document.querySelectorAll('#stp li').forEach((li, i) => { li.className = i + 1 < n ? 'done' : i + 1 === n ? 'cur' : '' }) }
function resetAna() { ANA = null; E('fmtBtn').disabled = true; setStage(1) }
function repUI() { /* relatório removido da interface; análise interna preservada */ }
function origUI() {
    if (!ANA) return; const P = E('orig'), fl = {}; P.textContent = '';
    ANA.F.forEach(f => (f.lns || (f.ln ? [f.ln] : [])).forEach(n => { if (!fl[n] || f.st === 'confirm') fl[n] = [f.st, f.t] }));
    ANA.raw.replace(/\r/g, '').split('\n').forEach((l, i) => {
        const d = document.createElement('div'); d.className = 'ol' + (fl[i + 1] ? ' f-' + fl[i + 1][0] : ''); if (fl[i + 1]) d.title = fl[i + 1][1];
        const n = document.createElement('span'); n.className = 'n'; n.textContent = i + 1; const t = document.createElement('span'); t.textContent = l || ' '; d.append(n, t); P.append(d)
    })
}
E('anBtn').onclick = async () => {
    const o = E('txt').value; if (!o.trim()) return toast('Cole ou importe um texto primeiro.');
    try {
        setStage(2); await st(25, 'Identificando títulos, citações e referências…'); ANA = analyzeDoc(o, cfg()); await st(70, 'Montando o relatório…');
        repUI(); origUI(); E('fmtBtn').disabled = false; await st(100, 'Análise concluída'); setStage(3);
        setTimeout(() => { E('prog').hidden = true; E('pm').textContent = '' }, 600); E('fmtBtn').scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    catch (e) { E('prog').hidden = true; resetAna(); toast('Erro ao analisar o texto.'); console.error(e) }
};
E('fmtBtn').onclick = async () => {
    if (!ANA) return toast('Analise o documento primeiro.'); const o = ANA.raw;
    try {
        setStage(4); await st(20, 'Aplicando as correções seguras…'); const bl = parse(o); LASTFIX = LVFIX;
        const acts = [...document.querySelectorAll('#rep input[data-act]:checked')].map(x => x.dataset.act); CHG = []; LOG = [];
        acts.forEach(a => { if (a === 'sortRefs' && sortRefs(bl)) { LOG.push(['k', 'Referências reordenadas em ordem alfabética (confirmado por você).']); ANA.F.forEach(f => { if (f.act === a) { f.st = 'auto'; f.why += ' (aplicado com sua confirmação)'; f.act = null } }) } });
        E('out').value = ser(bl); await st(60, 'Montando as páginas A4…'); ANA.applied = true; chg(o, bl); render(); notesUI(); repUI(); REP = null; await measure();
        await st(100, 'Pronto!'); setStage(5); setTimeout(() => { E('prog').hidden = true; E('pm').textContent = '' }, 700); E('vwC').checked = true; render(); E('paper').scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    catch (e) { E('prog').hidden = true; toast('Erro ao formatar o texto.'); console.error(e) }
};
E('txt').addEventListener('input', () => { if (ANA) resetAna() });
['vwC', 'vwO'].forEach(i => E(i).addEventListener('change', render));
['tipo', 'capa', 'rosto', 'num', 'inst', 'aut', 'tit', 'cid', 'ano'].forEach(i => E(i).addEventListener('change', () => { if (ANA && !ANA.applied) { const o = ANA.raw; ANA = analyzeDoc(o, cfg()); repUI(); origUI() } }));

E('clr').onclick = () => { E('txt').value = ''; E('out').value = ''; E('f2').value = ''; E('orig').textContent = ''; ign.clear(); LAST = null; resetAna(); refresh(); toast('Conteúdo limpo.') };
const PRE = { escolar: [0, 0], artigo: [0, 0], relatorio: [1, 0], tcc: [1, 0] };
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
        E('txt').value = t; resetAna(); toast('Arquivo importado. Agora clique em Analisar documento.')
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
    const kids = bl.map((b, idx) => {
        if (b.t === 'h') return new d.Paragraph({ alignment: b.un && b.lv === 1 ? A.CENTER : A.LEFT, pageBreakBefore: idx > 0, keepNext: true, keepLines: true, spacing: { before: gap(LT, LT), after: LT, line: 360, lineRule: AU }, children: [run(b.txt, { b: b.lv < 3, i: b.lv === 3 })] });
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
E('dx').onclick = () => need() && safe(async () => { await st(50, 'Gerando DOCX…'); const b = await makeDocx(); E('prog').hidden = true; E('pm').textContent = ''; await save(nome() + '.docx', b); setStage(6) });
E('dl').onclick = () => need() && safe(async () => { await st(50, 'Gerando PDF…'); const b = await getPdf(); E('prog').hidden = true; E('pm').textContent = ''; verify(); await save(nome() + '.pdf', b); setStage(6) });
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