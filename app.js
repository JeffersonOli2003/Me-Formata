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
            const J = window.jspdf.jsPDF; let doc = null;
            for (const f of f1.files) {
                for (const p of await pages(f)) {
                    const w = p.c.width, h = p.c.height, o = w > h ? 'l' : 'p';
                    if (!doc) doc = new J({ unit: 'px', format: [w, h], orientation: o, hotfixes: ['px_scaling'] }); else doc.addPage([w, h], o);
                    doc.addImage(p.c.toDataURL('image/jpeg', .92), 'JPEG', 0, 0, w, h)
                }
            }
            out.push({ name: (f1.files.length > 1 ? 'arquivos-juntos' : base(f1.files[0].name)) + '.pdf', blob: doc.output('blob') })
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
    tipo: E('tipo').value, fonte: E('fnt').value, tam: +E('tam').value, capa: E('capa').checked, rosto: E('rosto').checked,
    inst: E('inst').value.trim(), aut: E('aut').value.trim(), tit: E('tit').value.trim(), cid: E('cid').value.trim(), ano: E('ano').value.trim()
});
const isHead = l => /^#{1,2} /.test(l) || (l.length <= 80 && !/[.!?;,:]$/.test(l) && (/^\d+(\.\d+)* \S/.test(l) || (/\p{L}/u.test(l) && l === l.toUpperCase())));
function blocks(t) {
    const o = []; let u = []; const f = () => { if (u.length) o.push(u.join('\n')); u = [] };
    t.replace(/\r/g, '').split('\n').forEach(l => { l = l.trim(); if (!l) return f(); if (isHead(l)) { f(); o.push(l) } else u.push(l) }); f(); return o
}
function parse(t) {
    let ref = false;
    return blocks(t).flatMap(b => {
        const one = !/\n/.test(b), s = b.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' '); let r;
        if (/^## /.test(s)) r = { t: 'h3', s: s.slice(3) };
        else if (/^# /.test(s)) r = { t: 'h2', s: s.slice(2) };
        else if (/^> ?/.test(s) && !ref) r = { t: 'q', s: s.replace(/^> ?/, '') };
        else if (one && s.length <= 80 && !/[.!?;,:]$/.test(s)) {
            if (/^\d+(\.\d+)+ \S/.test(s)) r = { t: 'h3', s };
            else if (/^\d+ \S/.test(s) || (/\p{L}/u.test(s) && s === s.toUpperCase())) r = { t: 'h2', s }
        }
        if (r) { if (r.t === 'h2') { r.s = r.s.toUpperCase(); ref = /^(\d+ )?REFER[ÊE]NCIAS/.test(r.s) } return [r] }
        if (ref) return b.split('\n').map(l => l.trim().replace(/[ \t]+/g, ' ')).filter(Boolean).map(l => ({ t: 'r', s: l }));
        return [{ t: 'p', s }]
    })
}
const ser = bl => bl.map(b => ({ h2: '# ', h3: '## ', q: '> ' }[b.t] || '') + b.s).join('\n\n');
function covers(c) {
    const o = [];
    if (c.capa) o.push([{ s: c.inst.toUpperCase(), b: 1, sb: 0 }, { s: c.aut, sb: 2 }, { s: c.tit.toUpperCase(), b: 1, sb: 8 }, { s: c.cid, sb: 12 }, { s: c.ano, sb: 0 }].filter(i => i.s));
    if (c.rosto) o.push([{ s: c.aut, sb: 0 }, { s: c.tit.toUpperCase(), b: 1, sb: 8 }, { s: c.cid, sb: 14 }, { s: c.ano, sb: 0 }].filter(i => i.s));
    return o.filter(p => p.length)
}
function render() {
    const c = cfg(), P = E('paper'); P.textContent = '';
    P.style.fontFamily = c.fonte === 'helvetica' ? 'Arial,Helvetica,sans-serif' : '"Times New Roman",Times,serif'; P.style.fontSize = c.tam + 'pt';
    covers(c).forEach(pg => {
        const d = document.createElement('div'); d.className = 'cv';
        pg.forEach(it => { const p = document.createElement('p'); p.textContent = it.s; p.style.marginTop = (it.sb * 1.5) + 'em'; if (it.b) p.style.fontWeight = '700'; d.append(p) }); P.append(d)
    });
    parse(E('out').value).forEach(b => { const e = document.createElement({ h2: 'h2', h3: 'h3', q: 'blockquote', p: 'p', r: 'p' }[b.t]); if (b.t === 'r') e.className = 'r'; e.textContent = b.s; P.append(e) });
    const k = Math.min(1, (document.querySelector('.paper-box').clientWidth - 24) / 794); P.style.zoom = k || 1; verify()
}
function verify() {
    const c = cfg(), bl = parse(E('out').value), L = E('chk'); L.textContent = '';
    const add = (k, s) => { const li = document.createElement('li'); li.className = k; li.textContent = s; L.append(li) };
    if (!bl.length) { add('i', 'Clique em Formatar para ver a verificação.'); return }
    const hs = bl.filter(b => b.t === 'h2').map(b => b.s), ps = bl.filter(b => b.t === 'p'), rf = bl.filter(b => b.t === 'r').length, F = c.fonte === 'helvetica' ? 'Arial' : 'Times New Roman';
    const txt = bl.map(b => b.s).join(' '), ci = (txt.match(/\([^()]*\d{4}[^()]*\)/g) || []).length;
    add('k', 'Papel A4, margens 3 cm (superior e esquerda) e 2 cm (inferior e direita): aplicados nos arquivos exportados.');
    add('k', `Fonte ${F} ${c.tam}, espaçamento 1,5, texto justificado e recuo de 1,25 cm: aplicados.`);
    add('k', 'Paginação no canto superior direito, a partir da primeira folha textual (a capa e a folha de rosto entram na contagem).');
    bl.some(b => b.t[0] === 'h') ? add('k', `Títulos padronizados: ${hs.length} seção(ões) e ${bl.filter(b => b.t === 'h3').length} subseção(ões).`) : add('w', 'Nenhum título detectado. Use # para título de seção e ## para subseção.');
    /INTRODU/.test(hs.join('|')) || add('w', 'Seção “Introdução” não encontrada.');
    hs.length < 3 && add('w', 'Desenvolvimento: confira se há uma seção de desenvolvimento entre a introdução e a conclusão.');
    /CONCLU|CONSIDERA[ÇC]/.test(hs.join('|')) || add('w', 'Seção “Conclusão” ou “Considerações finais” não encontrada.');
    rf ? add('k', `${rf} referência(s) em espaço simples, alinhadas à esquerda.`) : add('w', 'Seção “Referências” não encontrada ou vazia. Pendente: informe as referências.');
    ci && !rf && add('w', `${ci} citação(ões) no texto, mas sem lista de referências.`);
    !ci && rf && add('w', 'Há referências, mas nenhuma citação no formato (AUTOR, ano) foi detectada no texto.');
    ci && add('i', `${ci} citação(ões) com ano detectada(s). Confira se cada uma tem referência correspondente.`);
    add('i', 'Citações diretas com mais de 3 linhas devem começar com “>” para receberem recuo de 4 cm e fonte menor.');
    const sp = ps.filter(b => !/[.!?:;"”)…]$/.test(b.s)).length;
    sp && add('w', `${sp} parágrafo(s) não terminam com pontuação (possível frase incompleta). Revise, nada foi alterado.`);
    const f = (o) => Object.entries(o).filter(([, v]) => !v).map(([k]) => k);
    if (c.capa) { const m = f({ 'instituição': c.inst, autor: c.aut, 'título': c.tit, cidade: c.cid, ano: c.ano }); m.length ? add('w', 'Capa: faltam ' + m.join(', ') + '.') : add('k', 'Capa com todos os dados informados.') }
    if (c.rosto) { const m = f({ autor: c.aut, 'título': c.tit, cidade: c.cid, ano: c.ano }); m.length ? add('w', 'Folha de rosto: faltam ' + m.join(', ') + '. A natureza do trabalho também precisa ser informada por você.') : add('i', 'Folha de rosto gerada. Acrescente por conta própria a natureza do trabalho e o orientador, se a escola exigir.') }
    !c.tit && !c.capa && !c.rosto && add('i', 'Título do trabalho não informado.');
    add('i', 'Sumário, notas de rodapé, tabelas e figuras não são gerados nesta versão. A ortografia não é corrigida automaticamente.');
    add('i', 'Exigências específicas da sua instituição não foram verificadas. Este resultado não garante conformidade total com a ABNT.')
}
function chg(o, bl) {
    const L = E('chg'); L.textContent = '';
    const sp = (o.match(/[ \t]{2,}/g) || []).length, br = (o.match(/[^\n]\n(?!\n)[^\n]/g) || []).length, bk = (o.match(/\n\s*\n\s*\n+/g) || []).length, n = t => bl.filter(b => b.t === t).length;
    [[sp, sp + ' espaçamento(s) duplicado(s) removido(s).'], [br, br + ' quebra(s) de linha dentro de parágrafos unida(s).'], [bk, bk + ' grupo(s) de linhas em branco padronizado(s).'],
    [n('h2') + n('h3'), (n('h2') + n('h3')) + ' título(s) detectado(s). Seções em maiúsculas e negrito, subseções em negrito. Confira se algum parágrafo foi tomado por título.'],
    [n('p'), n('p') + ' parágrafo(s) justificado(s) com recuo de 1,25 cm e espaçamento 1,5.'], [n('r'), n('r') + ' referência(s) em espaço simples.']]
        .filter(x => x[0]).forEach(x => { const li = document.createElement('li'); li.className = 'k'; li.textContent = x[1]; L.append(li) });
    const li = document.createElement('li'); li.className = 'i'; li.textContent = 'Nenhuma palavra do conteúdo foi alterada, só formatação.'; L.append(li)
}
const st = async (v, m) => { E('prog').hidden = false; E('prog').value = v; E('pm').textContent = m; await new Promise(r => setTimeout(r, 70)) };
E('fmtBtn').onclick = async () => {
    const o = E('txt').value; if (!o.trim()) return toast('Cole ou importe um texto primeiro.');
    try {
        await st(20, 'Lendo o texto…'); const bl = parse(o); await st(55, 'Organizando títulos e parágrafos…'); E('out').value = ser(bl);
        await st(80, 'Verificando as normas…'); render(); chg(o, bl); await st(100, 'Pronto!');
        setTimeout(() => { E('prog').hidden = true; E('pm').textContent = '' }, 700); E('paper').scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    catch (e) { E('prog').hidden = true; toast('Erro ao formatar o texto.'); console.error(e) }
};
E('clr').onclick = () => { E('txt').value = ''; E('out').value = ''; E('f2').value = ''; render(); toast('Conteúdo limpo.') };
const PRE = { escolar: [0, 0], artigo: [0, 0], relatorio: [1, 0], tcc: [1, 1] };
E('tipo').onchange = () => { const p = PRE[E('tipo').value]; if (p) { E('capa').checked = !!p[0]; E('rosto').checked = !!p[1] } render() };
['fnt', 'tam', 'capa', 'rosto', 'inst', 'aut', 'tit', 'cid', 'ano'].forEach(i => E(i).addEventListener('input', render));
E('out').oninput = render; addEventListener('resize', render); E('t2').onchange = render; render();
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
const plain = () => parse(E('out').value).map(b => b.t === 'p' ? '      ' + b.s : b.s).join('\n\n');
const need = () => E('out').value.trim() ? true : (toast('Clique em Formatar primeiro.'), false);
function makePdf() {
    const c = cfg(), bl = parse(E('out').value), doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' }), F = c.fonte, Z = c.tam, LH = Z * 1.5, W = 595.28, H = 841.89, L = 85.04, R = 56.69, T = 85.04, B = 56.69, w = W - L - R, cov = covers(c);
    let y = T; const np = () => { doc.addPage(); y = T };
    const wrap = (s, mw, ind) => { const o = []; let k = ''; for (const x of s.split(/\s+/)) { const t = k ? k + ' ' + x : x; if (doc.getTextWidth(t) > mw - (o.length ? 0 : ind) && k) { o.push(k); k = x } else k = t } if (k) o.push(k); return o };
    cov.forEach((pg, i) => {
        if (i) np(); pg.forEach(it => {
            y += it.sb * LH; doc.setFont(F, it.b ? 'bold' : 'normal'); doc.setFontSize(Z);
            wrap(it.s, w, 0).forEach(l => { doc.text(l, L + w / 2, y + Z, { align: 'center' }); y += LH })
        })
    });
    if (cov.length) np();
    bl.forEach(b => {
        const q = b.t === 'q', h = b.t[0] === 'h', r = b.t === 'r', sz = q ? Z - 2 : Z, lh = q ? sz * 1.2 : r ? Z * 1.2 : LH, x0 = L + (q ? 113.39 : 0), mw = w - (q ? 113.39 : 0), ind = b.t === 'p' ? 35.43 : 0;
        doc.setFont(F, h ? 'bold' : 'normal'); doc.setFontSize(sz); if (h || q) y += LH;
        wrap(b.s, mw, ind).forEach((ln, i, a) => {
            if (y + lh > H - B) np(); const x = x0 + (i ? 0 : ind), mx = mw - (i ? 0 : ind);
            if ((b.t === 'p' || q) && i < a.length - 1 && / /.test(ln)) doc.text(ln, x, y + sz, { maxWidth: mx, align: 'justify' }); else doc.text(ln, x, y + sz); y += lh
        });
        if (h || q) y += LH; if (r) y += Z * 1.2
    });
    const n = doc.getNumberOfPages(); doc.setFont(F, 'normal'); doc.setFontSize(10);
    for (let i = cov.length + 1; i <= n; i++) { doc.setPage(i); doc.text(String(i), W - R, 50, { align: 'right' }) }
    return doc.output('blob')
}
function makeDocx() {
    const d = window.docx; if (!d) throw new Error('docx');
    const c = cfg(), bl = parse(E('out').value), Z = c.tam * 2, LT = c.tam * 30, F = c.fonte === 'helvetica' ? 'Arial' : 'Times New Roman', A = d.AlignmentType;
    const run = (s, o = {}) => new d.TextRun({ text: s, font: F, size: o.sz || Z, bold: !!o.b });
    const pg = { size: { width: 11906, height: 16838 }, margin: { top: 1701, left: 1701, bottom: 1134, right: 1134 } }, cov = covers(c), secs = [];
    if (cov.length) secs.push({ properties: { page: pg }, children: cov.flatMap((p, i) => p.map((it, j) => new d.Paragraph({ alignment: A.CENTER, pageBreakBefore: i > 0 && j === 0, spacing: { before: Math.round(it.sb * LT), line: 360 }, children: [run(it.s, { b: it.b })] }))) });
    const kids = bl.map(b => {
        if (b.t[0] === 'h') return new d.Paragraph({ alignment: A.LEFT, keepNext: true, spacing: { before: 360, after: 360, line: 360 }, children: [run(b.s, { b: 1 })] });
        if (b.t === 'q') return new d.Paragraph({ alignment: A.JUSTIFIED, indent: { left: 2268 }, spacing: { before: 360, after: 360, line: 240 }, children: [run(b.s, { sz: Z - 4 })] });
        if (b.t === 'r') return new d.Paragraph({ alignment: A.LEFT, spacing: { after: 240, line: 240 }, children: [run(b.s)] });
        return new d.Paragraph({ alignment: A.JUSTIFIED, indent: { firstLine: 709 }, spacing: { before: 0, after: 0, line: 360 }, children: [run(b.s)] })
    });
    secs.push({
        properties: { page: { ...pg, pageNumbers: { start: cov.length + 1 } } },
        headers: { default: new d.Header({ children: [new d.Paragraph({ alignment: A.RIGHT, children: [new d.TextRun({ children: [d.PageNumber.CURRENT], font: F, size: 20 })] })] }) },
        children: kids
    });
    return d.Packer.toBlob(new d.Document({ creator: c.aut || '', title: c.tit || 'Documento ABNT', styles: { default: { document: { run: { font: F, size: Z } } } }, sections: secs }))
}
const nome = () => (cfg().tit || 'texto-abnt').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 60) || 'texto-abnt';
const safe = async fn => { try { await fn() } catch (e) { toast(e.message === 'docx' ? 'Biblioteca DOCX não carregou. Verifique a internet.' : 'Erro ao gerar o arquivo.'); console.error(e) } };
E('dx').onclick = () => need() && safe(async () => { await st(50, 'Gerando DOCX…'); const b = await makeDocx(); E('prog').hidden = true; E('pm').textContent = ''; await save(nome() + '.docx', b) });
E('dl').onclick = () => need() && safe(async () => { await st(50, 'Gerando PDF…'); const b = makePdf(); E('prog').hidden = true; E('pm').textContent = ''; await save(nome() + '.pdf', b) });
E('shr').onclick = () => need() && safe(() => share([{ name: nome() + '.pdf', blob: makePdf() }]));
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