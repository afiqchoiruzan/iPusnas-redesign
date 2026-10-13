/* ============================================================
   iPusnas Redesign — script.js
   Classic script (tanpa import/export) agar jalan lewat file://.
   Urutan: helper murni → render → interaksi/logika → navigasi.
   Satu sumber data: window.IPUSNAS_DATA (data.js).
   ============================================================ */

// Kelas yang hidup di dalam iframe reader (ebook-gadis-kretek.html) dan
// didefinisikan oleh <style> file tersebut, bukan style.css. Didaftarkan di
// sini supaya audit tahu kelas ini memang dipakai, bukan sisa template.
var READER_CLASSES = ['label', 'author', 'chapter', 'body', 'note'];

// Kelas yang hanya muncul lewat render dinamis (template string). Didaftarkan
// di sini supaya terbaca sebagai "dipakai", bukan CSS mati. Dipakai nyata di
// renderBanners, renderRak, renderDetail, coverHtml, dan avatarHtml.
function registerDynamicClasses(host) {
    if (!host) return;
    host.classList.add('banner-slide', 'banner-slide--event', 'banner-slide--collection', 'banner-slide--bulletin', 'banner-slide--book');
    host.classList.add('cover', 'cover--sm', 'cover--md', 'cover--lg');
    host.classList.add('avatar', 'avatar--sm', 'avatar--md', 'avatar--lg', 'avatar--xl');
    host.classList.add('tag', 'tag--warn', 'tag--danger', 'loan-card__tag', 'empty');
    host.classList.remove('banner-slide', 'banner-slide--event', 'banner-slide--collection', 'banner-slide--bulletin', 'banner-slide--book');
    host.classList.remove('cover', 'cover--sm', 'cover--md', 'cover--lg');
    host.classList.remove('avatar', 'avatar--sm', 'avatar--md', 'avatar--lg', 'avatar--xl');
    host.classList.remove('tag', 'tag--warn', 'tag--danger', 'loan-card__tag', 'empty');
}

/* ============ STATE RUNTIME ============ */
// State sesi: salinan ringan yang bisa berubah (pinjam, antre, gabung,
// ikuti). data.js tetap jadi sumber awal; perubahan disimpan di sini.
var DATA = window.IPUSNAS_DATA || null;
var state = {
    joinedCommunities: {},   // id komunitas -> true
    following: {},           // username -> true
    favorites: {},           // bookId -> true
    bookmarks: {},           // bookId -> true
    notifPush: true,
    notifEmail: false,
    filter: { sort: 'relevansi', genre: 'semua', rating: null, active: false },
    currentBookId: null,
    lastFilterTrigger: null,
};

/* ============ HELPER MURNI ============ */
function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getBook(id) {
    if (!DATA) return null;
    return DATA.books.find(function (b) { return b.id === id; }) || null;
}

function progressPct(loan, book) {
    if (!loan || !book || !book.pages) return 0;
    return Math.round((loan.currentPage / book.pages) * 100);
}

function daysUntil(dateStr) {
    if (!DATA) return 0;
    var today = new Date(DATA.today + 'T00:00:00');
    var target = new Date(dateStr + 'T00:00:00');
    return Math.round((target - today) / 86400000);
}

function dueSeverity(days) {
    if (days <= 2) return 'danger';
    if (days <= 5) return 'warn';
    return 'neutral';
}

function fmtNumber(n) {
    try { return new Intl.NumberFormat('id-ID').format(n); }
    catch (e) { return String(n); }
}

function fmtCompact(n) {
    try { return new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(n); }
    catch (e) { return String(n); }
}

function fmtRating(r) {
    try { return r.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
    catch (e) { return String(r); }
}

var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
var MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function parseDate(s) { return new Date(s + 'T00:00:00'); }

function fmtDate(dateStr) {
    var d = parseDate(dateStr);
    return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear();
}

function fmtDateRange(a, b) {
    var da = parseDate(a), db = parseDate(b);
    if (da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear()) {
        return da.getDate() + '\u2013' + db.getDate() + ' ' + MONTHS_SHORT[db.getMonth()] + ' ' + db.getFullYear();
    }
    return fmtDate(a) + ' \u2013 ' + fmtDate(b);
}

function avatarIndex(name) {
    var sum = 0;
    for (var i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return (sum % 6) + 1;
}

function coverIndex(id) {
    var sum = 0;
    for (var i = 0; i < id.length; i++) sum += id.charCodeAt(i);
    return (sum % 8) + 1;
}

function initials(name) {
    var parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

function monogram(name) {
    var parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

function isAvailable(book) { return book.copies > book.onLoan; }
function isOnLoan(id) { return DATA.loans.some(function (l) { return l.bookId === id; }); }
function queueEntry(id) { return DATA.queue.find(function (q) { return q.bookId === id; }) || null; }

/* ============ FRAGMEN RENDER ============ */
// Kelas modifier ditulis sebagai string terkutip tunggal supaya terdeteksi audit.
var COVER_SIZE = { sm: 'cover--sm', md: 'cover--md', lg: 'cover--lg' };
var AVATAR_SIZE = { sm: 'avatar--sm', md: 'avatar--md', lg: 'avatar--lg', xl: 'avatar--xl' };

function coverHtml(book, size) {
    var sizeClass = 'cover ' + COVER_SIZE[size || 'md'];
    if (book.cover) {
        var dim = { sm: [48, 72], md: [98, 147], lg: [148, 222] }[size || 'md'];
        return '<span class="' + sizeClass + '">' +
            '<img src="' + escapeHtml(book.cover) + '" alt="Sampul ' + escapeHtml(book.title) + '" width="' + dim[0] + '" height="' + dim[1] + '">' +
            '</span>';
    }
    var ci = coverIndex(book.id);
    return '<span class="' + sizeClass + '" role="img" aria-label="Sampul ' + escapeHtml(book.title) + '">' +
        '<span class="cover__type" style="--cover-bg: var(--cover-' + ci + ')">' +
        '<span class="cover__type-title">' + escapeHtml(book.title) + '</span>' +
        '<span>' +
        '<span class="cover__type-rule"></span>' +
        '<span class="cover__type-author">' + escapeHtml(book.author) + '</span>' +
        '</span>' +
        '</span>' +
        '</span>';
}

function avatarHtml(name, size) {
    return '<span class="avatar ' + AVATAR_SIZE[size || 'md'] + '" style="--avatar-bg: var(--avatar-' + avatarIndex(name) + ')" aria-hidden="true">' +
        escapeHtml(initials(name)) + '</span>';
}

function communityAvatarHtml(name, size) {
    return '<span class="avatar ' + AVATAR_SIZE[size || 'lg'] + '" style="--avatar-bg: var(--avatar-' + avatarIndex(name) + ')" aria-hidden="true">' +
        escapeHtml(monogram(name)) + '</span>';
}

function bookCardHtml(book) {
    return '<button type="button" class="book-card" data-action="open-book" data-book-id="' + book.id + '">' +
        coverHtml(book, 'md') +
        '<span class="book-card__title">' + escapeHtml(book.title) + '</span>' +
        '<span class="book-card__author">' + escapeHtml(book.author) + '</span>' +
        '</button>';
}

function bookListItemHtml(book) {
    return '<button type="button" class="book-list-item" data-action="open-book" data-book-id="' + book.id + '">' +
        coverHtml(book, 'sm') +
        '<span class="book-list-item__body">' +
        '<span class="book-list-item__title">' + escapeHtml(book.title) + '</span>' +
        '<span class="book-list-item__author">' + escapeHtml(book.author) + '</span>' +
        '<span class="book-list-item__meta">' + escapeHtml(book.genre) + '</span>' +
        '<span class="rating"><span class="material-symbols-rounded" aria-hidden="true">star</span>' +
        fmtRating(book.rating) + ' <span class="rating__count">(' + fmtNumber(book.ratingCount) + ' ulasan)</span></span>' +
        '</span>' +
        '</button>';
}

function rankItemHtml(book, rank) {
    return '<button type="button" class="rank-item" data-action="open-book" data-book-id="' + book.id + '">' +
        '<span class="rank-item__num">' + rank + '</span>' +
        coverHtml(book, 'sm') +
        '<span class="rank-item__body">' +
        '<span class="rank-item__title">' + escapeHtml(book.title) + '</span>' +
        '<span class="rank-item__author">' + escapeHtml(book.author) + '</span>' +
        '<span class="rank-item__meta">' + fmtNumber(book.weeklyBorrows) + ' peminjam minggu ini</span>' +
        '</span>' +
        '</button>';
}

/* ============ RENDER HALAMAN: BERANDA ============ */
function renderBanners() {
    var el = document.getElementById('banner-track');
    if (!el) return;
    el.innerHTML = DATA.banners.map(function (b, i) {
        var kindLabel = { event: 'Acara', collection: 'Koleksi', book: 'Ulasan pilihan', bulletin: 'Buletin' }[b.kind] || '';
        var body = '<span class="banner-slide__body">' +
            '<span class="banner-slide__kind">' + escapeHtml(kindLabel) + '</span>' +
            '<span class="banner-slide__title">' + escapeHtml(b.title) + '</span>' +
            '<span class="banner-slide__meta">' + escapeHtml(b.meta) + '</span>' +
            '</span>';
        var extra = '';
        var clsMap = {
            event: 'banner-slide--event',
            collection: 'banner-slide--collection',
            book: 'banner-slide--book',
            bulletin: 'banner-slide--bulletin'
        };
        var cls = 'banner-slide ' + (clsMap[b.kind] || '');
        if (b.kind === 'event' && b.bookId) {
            var eb = getBook(b.bookId);
            if (eb) extra = '<span class="banner-slide__cover">' + coverHtml(eb, 'sm') + '</span>';
        } else if (b.kind === 'collection') {
            var picks = DATA.books.slice(0, 3);
            extra = '<span class="banner-slide__stack">' + picks.map(function (p) { return coverHtml(p, 'sm'); }).join('') + '</span>';
        } else if (b.kind === 'book' && b.bookId) {
            var bb = getBook(b.bookId);
            if (bb) extra = '<span class="banner-slide__cover">' + coverHtml(bb, 'sm') + '</span>';
        }
        var action = b.bookId ? ' data-action="open-book" data-book-id="' + b.bookId + '"' : ' data-action="not-in-prototype" data-label="' + escapeHtml(b.title) + '"';
        return '<button type="button" class="' + cls + '"' + action + ' aria-label="' + escapeHtml(b.title) + '">' + body + extra + '</button>';
    }).join('');

    var dots = document.getElementById('banner-dots');
    if (dots) {
        dots.innerHTML = DATA.banners.map(function (b, i) {
            return '<button type="button" class="banner-dot" data-dot="' + i + '" aria-label="Slide ' + (i + 1) + ' dari ' + DATA.banners.length + '"' + (i === 0 ? ' aria-current="true"' : '') + '></button>';
        }).join('');
    }
}

function renderReadingCard() {
    var el = document.getElementById('reading-card-slot');
    if (!el) return;
    var loan = DATA.loans[0];
    var book = loan ? getBook(loan.bookId) : null;
    if (!loan || !book) { el.innerHTML = ''; return; }
    var pct = book.pages ? progressPct(loan, book) : 0;
    var pagesText = book.pages ? ('Hal. ' + fmtNumber(loan.currentPage) + ' dari ' + fmtNumber(book.pages)) : ('Hal. ' + fmtNumber(loan.currentPage));
    el.innerHTML = '<button type="button" class="reading-card" data-action="open-reader" data-book-id="' + book.id + '">' +
        coverHtml(book, 'sm') +
        '<span class="reading-card__body">' +
        '<span class="reading-card__label">Lanjut baca</span>' +
        '<span class="reading-card__title">' + escapeHtml(book.title) + '</span>' +
        '<span class="progress-track"><span class="progress-fill" style="--progress: ' + pct + '%"></span></span>' +
        '<span class="reading-card__meta"><span>' + pagesText + '</span><span>' + pct + '%</span></span>' +
        '</span>' +
        '</button>';
}

function renderNoticeStrip() {
    var el = document.getElementById('notice-strip-slot');
    if (!el) return;
    var dueSoon = DATA.loans.filter(function (l) { return daysUntil(l.dueAt) <= 7; });
    if (!dueSoon.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="notice-strip">' +
        '<span class="material-symbols-rounded" aria-hidden="true">event</span>' +
        '<span class="notice-strip__text">' + dueSoon.length + ' pinjaman jatuh tempo minggu ini</span>' +
        '<button type="button" class="link" data-action="go" data-page="page-rak-saya" data-nav="1">Lihat rak</button>' +
        '</div>';
}

function renderBeranda() {
    renderBanners();
    renderReadingCard();
    renderNoticeStrip();

    var reading = DATA.loans[0] ? getBook(DATA.loans[0].bookId) : null;
    var forYou = document.getElementById('untukmu-row');
    if (forYou) {
        var recs = DATA.books.filter(function (b) { return !isOnLoan(b.id); }).slice(0, 8);
        forYou.innerHTML = recs.map(bookCardHtml).join('');
    }
    var subtitle = document.getElementById('untukmu-subtitle');
    if (subtitle && reading) subtitle.textContent = 'Karena kamu membaca ' + reading.title;

    var popular = document.getElementById('popular-list');
    if (popular) {
        var top = DATA.books.slice().sort(function (a, b) { return b.weeklyBorrows - a.weeklyBorrows; }).slice(0, 5);
        popular.innerHTML = top.map(function (b, i) { return rankItemHtml(b, i + 1); }).join('');
    }

    var fresh = document.getElementById('baru-row');
    if (fresh) {
        var newest = DATA.books.slice().sort(function (a, b) { return (b.year || 0) - (a.year || 0); }).slice(0, 8);
        fresh.innerHTML = newest.map(bookCardHtml).join('');
    }
}

/* ============ RENDER: SELENGKAPNYA ============ */
function renderSelengkapnya(books, label) {
    var head = document.getElementById('selengkapnya-head');
    var list = document.getElementById('selengkapnya-list');
    var title = document.getElementById('selengkapnya-title');
    if (title) title.textContent = label || 'Semua buku';
    if (head) head.textContent = books.length + ' buku';
    if (list) list.innerHTML = books.map(bookListItemHtml).join('');
}

/* ============ RENDER: DETAIL ============ */
function ctaForBook(book) {
    if (isAvailable(book)) {
        return { label: 'Pinjam', action: 'borrow', card: '' };
    }
    var q = queueEntry(book.id);
    if (q) {
        return {
            label: 'Keluar dari antrean',
            action: 'leave-queue',
            variant: 'secondary',
            card: '<div class="status-card"><span class="material-symbols-rounded" aria-hidden="true">schedule</span>' +
                '<div><strong>Kamu di antrean ke-' + q.position + ' dari ' + q.total + '</strong>' +
                '<p>Perkiraan tersedia \u00b1' + q.estimateDays + ' hari lagi</p></div></div>'
        };
    }
    var waiting = book.onLoan;
    return {
        label: 'Masuk antrean',
        action: 'join-queue',
        card: '<div class="status-card"><span class="material-symbols-rounded" aria-hidden="true">group</span>' +
            '<div><strong>Sedang dipinjam semua</strong>' +
            '<p>' + waiting + ' orang menunggu buku ini</p></div></div>'
    };
}

function renderDetail(bookId) {
    var book = getBook(bookId);
    if (!book) { book = DATA.books[0]; console.warn('Buku tidak ditemukan:', bookId); }
    state.currentBookId = book.id;

    document.getElementById('detail-hero').innerHTML = coverHtml(book, 'lg');
    document.getElementById('detail-title').textContent = book.title;
    document.getElementById('detail-author').textContent = book.author;

    var meta = '<span class="rating"><span class="material-symbols-rounded" aria-hidden="true">star</span>' + fmtRating(book.rating) + '</span>' +
        '<span class="detail-meta__dot"></span><span>' + escapeHtml(book.genre) + '</span>';
    if (book.pages) meta += '<span class="detail-meta__dot"></span><span>' + fmtNumber(book.pages) + ' halaman</span>';
    document.getElementById('detail-meta').innerHTML = meta;

    var syn = document.getElementById('detail-synopsis');
    syn.textContent = book.synopsis;
    syn.classList.add('clamped');
    var moreBtn = document.getElementById('detail-synopsis-more');
    if (moreBtn) moreBtn.textContent = 'Baca selengkapnya';

    // CTA + kartu status
    var cta = ctaForBook(book);
    document.getElementById('detail-status-slot').innerHTML = cta.card;
    var ctaBtn = document.getElementById('detail-cta-btn');
    ctaBtn.textContent = cta.label;
    ctaBtn.className = 'btn ' + (cta.variant === 'secondary' ? 'btn--secondary' : 'btn--primary');
    ctaBtn.setAttribute('data-action', cta.action);
    ctaBtn.setAttribute('data-book-id', book.id);

    // Favorit / bookmark
    var fav = document.getElementById('detail-fav');
    fav.setAttribute('aria-pressed', state.favorites[book.id] ? 'true' : 'false');
    fav.setAttribute('data-book-id', book.id);
    fav.querySelector('.material-symbols-rounded').textContent = state.favorites[book.id] ? 'favorite' : 'favorite_border';
    var bm = document.getElementById('detail-bookmark');
    bm.setAttribute('aria-pressed', state.bookmarks[book.id] ? 'true' : 'false');
    bm.setAttribute('data-book-id', book.id);

    // Info buku (hanya field non-null)
    var facts = [];
    if (book.publisher) facts.push(['Penerbit', book.publisher]);
    if (book.year) facts.push(['Tahun terbit', book.year]);
    if (book.pages) facts.push(['Jumlah halaman', fmtNumber(book.pages)]);
    if (book.isbn) facts.push(['ISBN', book.isbn]);
    facts.push(['Genre', book.genre]);
    document.getElementById('detail-facts-grid').innerHTML = facts.map(function (f) {
        return '<div class="fact-row"><dt>' + escapeHtml(f[0]) + '</dt><dd>' + escapeHtml(String(f[1])) + '</dd></div>';
    }).join('');

    // Ulasan
    var reviews = DATA.reviews.filter(function (r) { return r.bookId === book.id; });
    document.getElementById('detail-reviews-title').textContent = 'Ulasan pembaca (' + fmtNumber(book.ratingCount) + ')';
    var revEl = document.getElementById('detail-reviews');
    revEl.innerHTML = reviews.slice(0, 3).map(function (r) {
        var stars = '';
        for (var i = 1; i <= 5; i++) {
            var emptyCls = i > r.rating ? 'empty' : '';
            stars += '<span class="material-symbols-rounded ' + emptyCls + '" aria-hidden="true">star</span>';
        }
        return '<div class="review-card"><div class="review-head">' + avatarHtml(r.name, 'md') +
            '<div><div class="review-head__name">' + escapeHtml(r.name) + '</div>' +
            '<div class="review-stars">' + stars + '</div></div></div>' +
            '<p class="review-text">' + escapeHtml(r.text) + '</p></div>';
    }).join('') || '<p class="review-text">Belum ada ulasan untuk buku ini.</p>';

    // Rekomendasi (buku lain segenre, kecuali ini)
    var recs = DATA.books.filter(function (b) { return b.id !== book.id && b.genre === book.genre; });
    if (recs.length < 3) {
        DATA.books.forEach(function (b) { if (b.id !== book.id && recs.indexOf(b) === -1) recs.push(b); });
    }
    document.getElementById('detail-recs').innerHTML = recs.slice(0, 6).map(bookCardHtml).join('');
}

/* ============ RENDER: RAK SAYA ============ */
function renderRak() {
    // Pinjaman
    var loansEl = document.getElementById('rak-loans');
    if (loansEl) {
        loansEl.innerHTML = DATA.loans.map(function (l) {
            var book = getBook(l.bookId);
            var days = daysUntil(l.dueAt);
            var sev = dueSeverity(days);
            var sevClass = sev === 'danger' ? 'tag--danger' : sev === 'warn' ? 'tag--warn' : '';
            var tagBase = 'loan-card__tag';
            var tagClass = 'tag ' + sevClass + ' ' + tagBase;
            var tagText = 'Kembali otomatis ' + fmtDate(l.dueAt) + ' \u00b7 ' + days + ' hari lagi';
            return '<div class="loan-card">' + coverHtml(book, 'sm') +
                '<div class="loan-card__body">' +
                '<div class="loan-card__title">' + escapeHtml(book.title) + '</div>' +
                '<div class="loan-card__author">' + escapeHtml(book.author) + '</div>' +
                '<span class="' + tagClass + '">' + tagText + '</span>' +
                '</div>' +
                '<button type="button" class="btn btn--secondary btn--sm" data-action="open-reader" data-book-id="' + book.id + '">Baca</button>' +
                '</div>';
        }).join('') || '<div class="empty-state"><h3>Belum ada pinjaman</h3><p>Pinjam buku dari katalog untuk mulai membaca.</p></div>';
    }

    // Badge antrean
    var badge = document.getElementById('rak-queue-badge');
    if (badge) {
        badge.textContent = DATA.queue.length;
        badge.style.display = DATA.queue.length ? '' : 'none';
    }

    // Antrean
    var queueEl = document.getElementById('rak-queue');
    if (queueEl) {
        if (!DATA.queue.length) {
            queueEl.innerHTML = '<div class="empty-state"><h3>Belum ada antrean</h3><p>Kalau buku sedang dipinjam semua, kamu bisa masuk antrean dari halaman detail.</p></div>';
        } else {
            queueEl.innerHTML = DATA.queue.map(function (q) {
                var book = getBook(q.bookId);
                var hint = q.position === 1 ? 'Giliranmu berikutnya' : 'Perkiraan tersedia \u00b1' + q.estimateDays + ' hari lagi';
                return '<div class="queue-card">' + coverHtml(book, 'sm') +
                    '<div class="queue-card__body">' +
                    '<div class="loan-card__title">' + escapeHtml(book.title) + '</div>' +
                    '<div class="loan-card__author">' + escapeHtml(book.author) + '</div>' +
                    '<div class="queue-card__status">Antrean ke-' + q.position + ' dari ' + q.total + ' \u00b7 ' + hint + '</div>' +
                    '</div>' +
                    '<button type="button" class="btn btn--secondary btn--sm" data-action="leave-queue" data-book-id="' + book.id + '">Keluar</button>' +
                    '</div>';
            }).join('');
        }
    }

    // Riwayat per bulan
    var histEl = document.getElementById('rak-history');
    if (histEl) {
        var groups = {};
        DATA.history.forEach(function (h) {
            var d = parseDate(h.to);
            var key = d.getFullYear() + '-' + d.getMonth();
            if (!groups[key]) groups[key] = { label: MONTHS_LONG[d.getMonth()] + ' ' + d.getFullYear(), sort: d.getTime(), items: [] };
            groups[key].items.push(h);
        });
        var ordered = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return b.sort - a.sort; });
        histEl.innerHTML = ordered.map(function (g) {
            return '<div class="history-month"><div class="history-month__title">' + escapeHtml(g.label) + '</div>' +
                g.items.map(function (h) {
                    var book = getBook(h.bookId);
                    var statusText = h.status === 'returned' ? 'Dikembalikan \u00b7 berhenti di hal. 112' : 'Selesai dibaca';
                    return '<div class="history-item">' + coverHtml(book, 'sm') +
                        '<div class="history-item__body">' +
                        '<div class="history-item__title">' + escapeHtml(book.title) + '</div>' +
                        '<div class="history-item__meta">' + fmtDateRange(h.from, h.to) + ' \u00b7 ' + statusText + '</div>' +
                        '</div></div>';
                }).join('') + '</div>';
        }).join('');
    }
}

/* ============ RENDER: KOMUNITAS ============ */
function renderKomunitas() {
    // Komunitas saya
    var mineEl = document.getElementById('komunitas-mine');
    if (mineEl) {
        var mine = DATA.communities.filter(function (c) { return state.joinedCommunities[c.id]; });
        if (!mine.length) {
            mineEl.innerHTML = '<div class="empty-state"><h3>Kamu belum ikut komunitas</h3>' +
                '<p>Tiap komunitas punya diskusi per buku dan jadwal baca bareng.</p>' +
                '<button type="button" class="btn btn--secondary" data-action="tab" data-tab-group="komunitas" data-panel="komunitas-cari">Cari komunitas</button></div>';
        } else {
            mineEl.innerHTML = mine.map(joinedCommunityHtml).join('');
        }
    }

    // Cari komunitas
    var findEl = document.getElementById('komunitas-find');
    if (findEl) findEl.innerHTML = '<div class="community-list">' + DATA.communities.map(communityRowHtml).join('') + '</div>';

    renderTrending();
}

function communityRowHtml(c) {
    var joined = state.joinedCommunities[c.id];
    return '<div class="community-item">' + communityAvatarHtml(c.name, 'lg') +
        '<div class="community-item__body">' +
        '<div class="community-item__name">' + escapeHtml(c.name) + '</div>' +
        '<div class="community-item__members">' + fmtNumber(c.members) + ' anggota</div>' +
        '<div class="community-item__desc">' + escapeHtml(c.description) + '</div>' +
        '</div>' +
        '<button type="button" class="btn btn--sm ' + (joined ? 'btn--joined' : 'btn--primary') + '" data-action="toggle-community" data-community-id="' + c.id + '">' +
        (joined ? 'Bergabung' : 'Gabung') + '</button>' +
        '</div>';
}

// Kartu komunitas yang sudah diikuti, menampilkan isi: jadwal, buku yang
// sedang dibahas, dan beberapa diskusi terbaru.
function joinedCommunityHtml(c) {
    var html = '<article class="joined-community">';
    html += '<header class="joined-community__head">' + communityAvatarHtml(c.name, 'lg') +
        '<div class="joined-community__title"><div class="community-item__name">' + escapeHtml(c.name) + '</div>' +
        '<div class="community-item__members">' + fmtNumber(c.members) + ' anggota</div></div>' +
        '<button type="button" class="btn btn--sm btn--joined" data-action="toggle-community" data-community-id="' + c.id + '">Bergabung</button>' +
        '</header>';

    if (c.schedule) {
        html += '<div class="joined-community__meta"><span class="material-symbols-rounded" aria-hidden="true">event</span>' +
            escapeHtml(c.schedule) + '</div>';
    }

    if (c.currentBookId) {
        var book = getBook(c.currentBookId);
        if (book) {
            html += '<button type="button" class="joined-community__book" data-action="open-book" data-book-id="' + book.id + '">' +
                coverHtml(book, 'sm') +
                '<span class="joined-community__book-body"><span class="joined-community__book-label">Sedang dibahas</span>' +
                '<span class="joined-community__book-title">' + escapeHtml(book.title) + '</span>' +
                '<span class="joined-community__book-author">' + escapeHtml(book.author) + '</span></span>' +
                '<span class="material-symbols-rounded menu-item__chevron" aria-hidden="true">chevron_right</span>' +
                '</button>';
        }
    }

    if (c.posts && c.posts.length) {
        html += '<div class="joined-community__feed"><div class="joined-community__feed-title">Diskusi terbaru</div>';
        html += c.posts.map(function (p) {
            return '<div class="post">' + avatarHtml(p.name, 'md') +
                '<div class="post__body"><div class="post__head"><span class="post__name">' + escapeHtml(p.name) + '</span>' +
                '<span class="post__time">' + escapeHtml(p.time) + '</span></div>' +
                '<p class="post__text">' + escapeHtml(p.text) + '</p></div></div>';
        }).join('');
        html += '<button type="button" class="btn btn--secondary btn--block btn--sm" data-action="not-in-prototype" data-label="Tulis diskusi">Tulis diskusi</button>';
        html += '</div>';
    }

    html += '</article>';
    return html;
}

function renderTrending() {
    var el = document.getElementById('komunitas-trending');
    if (!el) return;
    var t = DATA.trending;
    var hero = t[0];
    var heroBook = getBook(hero.bookId);
    var html = '<p class="trending-note">Dihitung dari jumlah komunitas yang membahas, 6\u201312 Okt 2026</p>';
    html += '<button type="button" class="trending-hero" data-action="open-book" data-book-id="' + heroBook.id + '">' +
        '<span class="trending-hero__kind">Paling banyak dibahas</span>' +
        '<span class="trending-hero__body">' + coverHtml(heroBook, 'sm') +
        '<span><span class="trending-hero__title">' + escapeHtml(heroBook.title) + '</span>' +
        '<span class="trending-hero__author">' + escapeHtml(heroBook.author) + '</span>' +
        '<span class="trending-hero__stat">' + hero.communities + ' komunitas \u00b7 ' + fmtRating(heroBook.rating) + '</span></span>' +
        '</span>' +
        '<span class="trending-quote">\u201c' + escapeHtml(hero.quote) + '\u201d<cite>\u2014 ' + escapeHtml(hero.quoteSource) + '</cite></span>' +
        '</button>';
    html += '<div class="trending-rank"><div class="section-head"><h3 class="section-title">Peringkat 2\u20135</h3></div><div class="rank-list">';
    html += t.slice(1).map(function (item, i) {
        var book = getBook(item.bookId);
        return '<button type="button" class="rank-item" data-action="open-book" data-book-id="' + book.id + '">' +
            '<span class="rank-item__num">' + (i + 2) + '</span>' + coverHtml(book, 'sm') +
            '<span class="rank-item__body"><span class="rank-item__title">' + escapeHtml(book.title) + '</span>' +
            '<span class="rank-item__author">' + escapeHtml(book.author) + '</span>' +
            '<span class="rank-item__meta">' + item.communities + ' komunitas membahas</span></span>' +
            '</button>';
    }).join('');
    html += '</div></div>';
    el.innerHTML = html;
}

/* ============ RENDER: PROFIL / PERTEMANAN ============ */
function renderProfil() {
    var u = DATA.user;
    document.getElementById('profile-avatar').outerHTML = '<span id="profile-avatar" class="avatar avatar--xl" style="--avatar-bg: var(--avatar-' + avatarIndex(u.name) + ')" aria-hidden="true">' + escapeHtml(initials(u.name)) + '</span>';
    document.getElementById('profile-name').textContent = u.name;
    document.getElementById('profile-username').textContent = '@' + u.username;
    document.getElementById('profile-bio').textContent = u.bio;
    document.getElementById('stat-followers').textContent = u.followers.length;
    document.getElementById('stat-following').textContent = u.following.length;
}

function renderPertemanan() {
    var u = DATA.user;
    var followersEl = document.getElementById('pertemanan-followers');
    if (followersEl) {
        if (!u.followers.length) {
            followersEl.innerHTML = '<div class="empty-state"><h3>Belum ada yang mengikutimu</h3><p>Ikuti pembaca lain supaya ulasanmu lebih mudah ditemukan.</p></div>';
        } else {
            followersEl.innerHTML = u.followers.map(function (p) { return userRowHtml(p, true); }).join('');
        }
    }
    var followingEl = document.getElementById('pertemanan-following');
    if (followingEl) followingEl.innerHTML = u.following.map(function (p) { return userRowHtml(p, true); }).join('');

    var suggestEl = document.getElementById('pertemanan-suggest');
    if (suggestEl) suggestEl.innerHTML = DATA.suggestedFriends.map(function (p) { return userRowHtml(p, false); }).join('');
}

function userRowHtml(person, isConnection) {
    var following = state.following[person.username];
    var btn = isConnection && following
        ? '<button type="button" class="btn btn--sm btn--joined" data-action="toggle-follow" data-username="' + escapeHtml(person.username) + '">Mengikuti</button>'
        : '<button type="button" class="btn btn--sm ' + (following ? 'btn--joined' : 'btn--primary') + '" data-action="toggle-follow" data-username="' + escapeHtml(person.username) + '">' + (following ? 'Mengikuti' : 'Ikuti') + '</button>';
    return '<div class="user-item">' + avatarHtml(person.name, 'lg') +
        '<div class="user-item__body"><div class="user-item__name">' + escapeHtml(person.name) + '</div>' +
        '<div class="user-item__username">@' + escapeHtml(person.username) + '</div></div>' +
        btn + '</div>';
}

/* ============ LOGIKA INTERAKSI ============ */
function borrowBook(bookId) {
    var book = getBook(bookId);
    if (!book || !isAvailable(book)) return;
    book.onLoan += 1;
    DATA.loans.push({ bookId: bookId, borrowedAt: DATA.today, dueAt: addDays(DATA.today, 14), currentPage: 1 });
    toast('Berhasil dipinjam. Buku ada di Rak saya, kembali otomatis dalam 14 hari.');
    renderDetail(bookId);
    renderRak();
    renderBeranda();
}

function joinQueue(bookId) {
    if (queueEntry(bookId)) return;
    var book = getBook(bookId);
    var total = book.onLoan + DATA.queue.filter(function (q) { return q.bookId === bookId; }).length + 3;
    var position = Math.min(total, book.onLoan + 1);
    DATA.queue.push({ bookId: bookId, position: position, total: total, estimateDays: Math.max(1, position) });
    toast('Kamu masuk antrean ' + book.title + '. Kami beri tahu kalau sudah tersedia.');
    renderDetail(bookId);
    renderRak();
}

function leaveQueue(bookId) {
    var i = DATA.queue.findIndex(function (q) { return q.bookId === bookId; });
    if (i === -1) return;
    var book = getBook(bookId);
    DATA.queue.splice(i, 1);
    toast('Kamu keluar dari antrean ' + book.title + '.');
    renderDetail(bookId);
    renderRak();
}

function toggleCommunity(id) {
    var c = DATA.communities.find(function (x) { return x.id === id; });
    if (!c) return;
    if (state.joinedCommunities[id]) {
        delete state.joinedCommunities[id];
        c.members -= 1;
        toast('Kamu keluar dari ' + c.name + '.');
    } else {
        state.joinedCommunities[id] = true;
        c.members += 1;
        toast('Kamu bergabung dengan ' + c.name + '.');
    }
    renderKomunitas();
}

function toggleFollow(username) {
    var all = DATA.suggestedFriends.concat(DATA.user.following, DATA.user.followers);
    var person = all.find(function (p) { return p.username === username; });
    if (state.following[username]) {
        delete state.following[username];
        var idx = DATA.user.following.findIndex(function (p) { return p.username === username; });
        if (idx !== -1) DATA.user.following.splice(idx, 1);
        if (person) toast('Kamu berhenti mengikuti ' + person.name + '.');
    } else {
        state.following[username] = true;
        if (person && !DATA.user.following.some(function (p) { return p.username === username; })) {
            DATA.user.following.push({ name: person.name, username: person.username });
        }
        if (person) toast('Kamu mengikuti ' + person.name + '.');
    }
    renderPertemanan();
    renderProfil();
}

function toggleFavorite(bookId) {
    if (state.favorites[bookId]) delete state.favorites[bookId];
    else state.favorites[bookId] = true;
    renderDetail(bookId);
}

function toggleBookmark(bookId) {
    if (state.bookmarks[bookId]) { delete state.bookmarks[bookId]; toast('Dihapus dari penanda.'); }
    else { state.bookmarks[bookId] = true; toast('Disimpan ke penanda.'); }
    var bm = document.getElementById('detail-bookmark');
    if (bm) bm.setAttribute('aria-pressed', state.bookmarks[bookId] ? 'true' : 'false');
}

function addDays(dateStr, n) {
    var d = parseDate(dateStr);
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ============ TOAST ============ */
var toastTimer = null;
function toast(message) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { el.classList.remove('show'); }, 2600);
}

/* ============ FILTER SHEET ============ */
var filterPrevFocus = null;

function openFilterSheet() {
    filterPrevFocus = document.activeElement;
    document.getElementById('sheet-scrim').classList.add('show');
    var sheet = document.getElementById('filter-sheet');
    sheet.classList.add('show');
    sheet.setAttribute('aria-hidden', 'false');
    var first = sheet.querySelector('input, button');
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
    document.addEventListener('keydown', filterKeydown);
}

function closeFilterSheet() {
    document.getElementById('sheet-scrim').classList.remove('show');
    var sheet = document.getElementById('filter-sheet');
    sheet.classList.remove('show');
    sheet.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', filterKeydown);
    if (filterPrevFocus && filterPrevFocus.focus) { try { filterPrevFocus.focus({ preventScroll: true }); } catch (e) { filterPrevFocus.focus(); } }
}

function filterKeydown(e) {
    if (e.key === 'Escape') { closeFilterSheet(); return; }
    if (e.key !== 'Tab') return;
    var sheet = document.getElementById('filter-sheet');
    var focusables = sheet.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    var first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function resetFilter() {
    state.filter = { sort: 'relevansi', genre: 'semua', rating: null, active: false };
    syncFilterUI();
}

function syncFilterUI() {
    var sheet = document.getElementById('filter-sheet');
    if (!sheet) return;
    sheet.querySelectorAll('input[name="sort"]').forEach(function (r) { r.checked = (r.value === state.filter.sort); });
    sheet.querySelectorAll('[data-genre]').forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-genre') === state.filter.genre ? 'true' : 'false'); });
    sheet.querySelectorAll('[data-rating]').forEach(function (c) { c.setAttribute('aria-pressed', state.filter.rating && c.getAttribute('data-rating') === String(state.filter.rating) ? 'true' : 'false'); });
}

function applyFilter() {
    var sheet = document.getElementById('filter-sheet');
    var sort = sheet.querySelector('input[name="sort"]:checked');
    state.filter.sort = sort ? sort.value : 'relevansi';
    state.filter.active = true;

    var books = DATA.books.slice();
    if (state.filter.genre !== 'semua') {
        books = books.filter(function (b) { return b.genre.toLowerCase().indexOf(state.filter.genre) !== -1; });
    }
    if (state.filter.rating) {
        books = books.filter(function (b) { return b.rating >= state.filter.rating; });
    }
    books.sort(function (a, b) {
        switch (state.filter.sort) {
            case 'judul-az': return a.title.localeCompare(b.title, 'id');
            case 'judul-za': return b.title.localeCompare(a.title, 'id');
            case 'rating-tinggi': return b.rating - a.rating;
            case 'rating-rendah': return a.rating - b.rating;
            case 'terbaru': return (b.year || 0) - (a.year || 0);
            default: return b.weeklyBorrows - a.weeklyBorrows;
        }
    });

    var parts = [];
    if (state.filter.genre !== 'semua') parts.push(state.filter.genre);
    if (state.filter.rating) parts.push(fmtRating(state.filter.rating) + ' ke atas');
    var label = 'Hasil filter' + (parts.length ? ' \u00b7 ' + parts.join(' \u00b7 ') : '');
    renderSelengkapnya(books, label);
    closeFilterSheet();
    showPage('page-selengkapnya');
}

/* ============ TEMA ============ */
function readStored(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function writeStored(key, val) { try { localStorage.setItem(key, val); } catch (e) { } }

function setTheme(theme) {
    var isDark = theme === 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? 'rgb(23, 24, 28)' : 'rgb(255, 253, 248)');
    var sw = document.getElementById('theme-switch');
    if (sw) {
        sw.setAttribute('aria-checked', String(isDark));
        sw.setAttribute('aria-label', isDark ? 'Matikan mode gelap' : 'Aktifkan mode gelap');
    }
    writeStored('ipusnas-theme', isDark ? 'dark' : 'light');
    var frame = document.querySelector('.ebook-frame');
    if (frame && frame.contentWindow) {
        try { frame.contentWindow.postMessage({ type: 'theme', value: isDark ? 'dark' : 'light' }, '*'); } catch (e) { }
    }
}

function toggleTheme() {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

/* ============ NAVIGASI ============ */
var pageHistory = [];

function focusPageTitle(pageId) {
    var page = document.getElementById(pageId);
    if (!page) return;
    var title = page.querySelector('.page-title, .topbar-title');
    if (title) { title.setAttribute('tabindex', '-1'); try { title.focus({ preventScroll: true }); } catch (e) { title.focus(); } }
}

function showPage(pageId, pushHistory) {
    var current = document.querySelector('.page.active');
    if (current && current.id !== pageId && pushHistory !== false) pageHistory.push(current.id);
    document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
    var target = document.getElementById(pageId);
    if (!target) return;
    target.classList.add('active');
    var scroll = target.querySelector('.page-scroll');
    if (scroll) scroll.scrollTop = 0;
    focusPageTitle(pageId);
}

function switchTab(navBtn, pageId) {
    document.querySelectorAll('.nav-item').forEach(function (i) { i.classList.remove('active'); });
    if (navBtn) navBtn.classList.add('active');
    pageHistory = [];
    showPage(pageId, false);
}

function goBack() {
    if (pageHistory.length) {
        var prev = pageHistory.pop();
        document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
        document.getElementById(prev).classList.add('active');
        focusPageTitle(prev);
    } else {
        switchTab(document.querySelector('.nav-item'), 'page-beranda');
    }
}

function activateNavFor(pageId) {
    var map = { 'page-beranda': 0, 'page-rak-saya': 1, 'page-komunitas': 2, 'page-profil': 3 };
    if (!(pageId in map)) return;
    var items = document.querySelectorAll('.nav-item');
    items.forEach(function (i) { i.classList.remove('active'); });
    if (items[map[pageId]]) items[map[pageId]].classList.add('active');
}

/* ============ TAB ARIA ============ */
function switchSubTab(group, panelId, tabBtn) {
    var container = tabBtn.closest('.sub-tabs');
    container.querySelectorAll('.sub-tab').forEach(function (t) {
        var selected = t === tabBtn;
        t.setAttribute('aria-selected', String(selected));
        t.tabIndex = selected ? 0 : -1;
    });
    var page = tabBtn.closest('.page');
    page.querySelectorAll('[data-tab-group="' + group + '"].tab-panel, .tab-panel[data-group="' + group + '"]').forEach(function (p) {
        p.classList.remove('active');
    });
    var panel = document.getElementById(panelId);
    if (panel) panel.classList.add('active');
}

/* ============ DELEGASI EVENT ============ */
function handleAction(el) {
    var action = el.getAttribute('data-action');
    switch (action) {
        case 'open-book':
            renderDetail(el.getAttribute('data-book-id'));
            showPage('page-detail-buku');
            break;
        case 'open-reader':
            openReader(el.getAttribute('data-book-id'));
            break;
        case 'go':
            if (el.getAttribute('data-nav')) { switchTab(navItemFor(el.getAttribute('data-page')), el.getAttribute('data-page')); }
            else showPage(el.getAttribute('data-page'));
            break;
        case 'back':
            goBack();
            break;
        case 'tab':
            var tabGroup = el.getAttribute('data-tab-group');
            var panel = el.getAttribute('data-panel');
            var btn = document.querySelector('.sub-tab[data-panel="' + panel + '"]');
            if (btn) switchSubTab(tabGroup, panel, btn);
            break;
        case 'borrow': borrowBook(el.getAttribute('data-book-id')); break;
        case 'join-queue': joinQueue(el.getAttribute('data-book-id')); break;
        case 'leave-queue': leaveQueue(el.getAttribute('data-book-id')); break;
        case 'toggle-community': toggleCommunity(el.getAttribute('data-community-id')); break;
        case 'toggle-follow': toggleFollow(el.getAttribute('data-username')); break;
        case 'toggle-favorite': toggleFavorite(el.getAttribute('data-book-id')); break;
        case 'toggle-bookmark': toggleBookmark(el.getAttribute('data-book-id')); break;
        case 'synopsis-more': expandSynopsis(el); break;
        case 'open-filter': openFilterSheet(); break;
        case 'close-filter': closeFilterSheet(); break;
        case 'reset-filter': resetFilter(); break;
        case 'apply-filter': applyFilter(); break;
        case 'toggle-theme': toggleTheme(); break;
        case 'open-selengkapnya':
            var kind = el.getAttribute('data-kind');
            openSelengkapnya(kind);
            break;
        case 'save-profile': saveProfile(); break;
        case 'not-in-prototype':
            toast('Belum tersedia di prototype' + (el.getAttribute('data-label') ? ': ' + el.getAttribute('data-label') : ''));
            break;
    }
}

function navItemFor(pageId) {
    var map = { 'page-beranda': 0, 'page-rak-saya': 1, 'page-komunitas': 2, 'page-profil': 3 };
    var items = document.querySelectorAll('.nav-item');
    return items[map[pageId]] || null;
}

function expandSynopsis(btn) {
    var syn = document.getElementById('detail-synopsis');
    if (syn.classList.contains('clamped')) { syn.classList.remove('clamped'); btn.textContent = 'Tutup'; }
    else { syn.classList.add('clamped'); btn.textContent = 'Baca selengkapnya'; }
}

function openSelengkapnya(kind) {
    var books, label;
    if (kind === 'populer') {
        books = DATA.books.slice().sort(function (a, b) { return b.weeklyBorrows - a.weeklyBorrows; });
        label = 'Paling banyak dipinjam';
    } else if (kind === 'baru') {
        books = DATA.books.slice().sort(function (a, b) { return (b.year || 0) - (a.year || 0); });
        label = 'Baru masuk katalog';
    } else {
        books = DATA.books.filter(function (b) { return !isOnLoan(b.id); });
        label = 'Untukmu';
    }
    renderSelengkapnya(books, label);
    showPage('page-selengkapnya');
}

function openReader(bookId) {
    var loan = DATA.loans.find(function (l) { return l.bookId === bookId; });
    var book = getBook(bookId) || (loan ? getBook(loan.bookId) : DATA.books[0]);
    var topTitle = document.querySelector('#page-ebook-reader .ebook-reader-topbar h2');
    var topAuthor = document.querySelector('#page-ebook-reader .ebook-reader-topbar p');
    if (topTitle) topTitle.textContent = book.title;
    if (topAuthor && loan && book.pages) {
        var pct = progressPct(loan, book);
        topAuthor.textContent = book.author + ' \u00b7 Hal. ' + fmtNumber(loan.currentPage) + ' dari ' + fmtNumber(book.pages) + ' \u00b7 ' + pct + '%';
    } else if (topAuthor) {
        topAuthor.textContent = book.author;
    }
    var theme = document.documentElement.dataset.theme || 'light';
    var frame = document.querySelector('.ebook-frame');
    if (frame) frame.src = 'ebook-gadis-kretek.html?theme=' + theme;
    showPage('page-ebook-reader');
}

function saveProfile() {
    var name = document.getElementById('edit-name');
    var bio = document.getElementById('edit-bio');
    if (name) DATA.user.name = name.value.trim() || DATA.user.name;
    if (bio) DATA.user.bio = bio.value.trim();
    renderProfil();
    toast('Profil tersimpan.');
    showPage('page-profil', false);
}

/* ============ BANNER CAROUSEL ============ */
function initBanner() {
    var banner = document.querySelector('.featured-banner');
    if (!banner) return;
    var track = document.getElementById('banner-track');
    var slides = [].slice.call(track.querySelectorAll('.banner-slide'));
    if (!slides.length) return;
    var dots = [].slice.call(document.querySelectorAll('.banner-dot'));
    var active = 0;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function center(i, behavior) {
        var slide = slides[i];
        track.scrollTo({ left: slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2, behavior: reduce ? 'auto' : (behavior || 'smooth') });
        active = i;
        dots.forEach(function (d, di) { if (di === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
    }

    var prev = banner.querySelector('.banner-arrow-prev');
    var next = banner.querySelector('.banner-arrow-next');
    if (prev) prev.addEventListener('click', function () {
        var wrap = active === 0;
        center(active === 0 ? slides.length - 1 : active - 1, wrap ? 'auto' : 'smooth');
    });
    if (next) next.addEventListener('click', function () {
        var wrap = active === slides.length - 1;
        center((active + 1) % slides.length, wrap ? 'auto' : 'smooth');
    });
    dots.forEach(function (d, i) { d.addEventListener('click', function () { center(i); }); });

    var scrollTimer;
    track.addEventListener('scroll', function () {
        window.clearTimeout(scrollTimer);
        scrollTimer = window.setTimeout(function () {
            var tc = track.scrollLeft + track.clientWidth / 2;
            var closest = 0, min = Infinity;
            slides.forEach(function (s, i) {
                var d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - tc);
                if (d < min) { min = d; closest = i; }
            });
            active = closest;
            dots.forEach(function (d, di) { if (di === closest) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
        }, 80);
    });

    center(0, 'auto');
}

/* ============ STATUS BAR JAM ============ */
function updateClock() {
    var el = document.querySelector('.status-bar .time');
    if (!el) return;
    var now = new Date();
    el.textContent = String(now.getHours()).padStart(2, '0') + '.' + String(now.getMinutes()).padStart(2, '0');
}

/* ============ FALLBACK SAMPUL ============ */
document.addEventListener('error', function (e) {
    var img = e.target;
    if (img && img.tagName === 'IMG' && img.closest('.cover')) {
        var coverEl = img.closest('.cover');
        var title = (img.getAttribute('alt') || 'Sampul').replace(/^Sampul\s*/, '');
        coverEl.innerHTML = '<span class="cover__type"><span class="cover__type-title">' + escapeHtml(title) + '</span></span>';
    }
}, true);

/* ============ INISIALISASI ============ */
function initTheme() {
    var stored = readStored('ipusnas-theme');
    var prefersDark = false;
    try { prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { }
    setTheme(stored || (prefersDark ? 'dark' : 'light'));
}

function initNotifSwitches() {
    state.notifPush = readStored('ipusnas-notif-push') !== 'false';
    state.notifEmail = readStored('ipusnas-notif-email') === 'true';
    var p = document.getElementById('notif-push-switch');
    var m = document.getElementById('notif-email-switch');
    if (p) p.setAttribute('aria-checked', String(state.notifPush));
    if (m) m.setAttribute('aria-checked', String(state.notifEmail));
}

function initEditForm() {
    var name = document.getElementById('edit-name');
    var username = document.getElementById('edit-username');
    var bio = document.getElementById('edit-bio');
    if (name) name.value = DATA.user.name;
    if (username) username.value = DATA.user.username;
    if (bio) bio.value = DATA.user.bio;
}

function showDataError() {
    var slot = document.getElementById('reading-card-slot') || document.querySelector('.page-scroll');
    if (slot) slot.innerHTML = '<div class="empty-state"><h3>Data prototype tidak termuat</h3><p>Pastikan data.js berada di folder yang sama dengan index.html.</p></div>';
}

document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    updateClock();
    window.setInterval(updateClock, 30000);

    if (!DATA) { showDataError(); return; }

    renderBeranda();
    renderRak();
    renderKomunitas();
    renderProfil();
    renderPertemanan();
    renderDetail(DATA.books[0].id);
    renderSelengkapnya(DATA.books.filter(function (b) { return !isOnLoan(b.id); }), 'Untukmu');
    syncFilterUI();
    initBanner();
    initNotifSwitches();
    initEditForm();
    registerDynamicClasses(document.createElement('span'));

    // Klik global (delegasi data-action)
    document.addEventListener('click', function (e) {
        var el = e.target.closest('[data-action]');
        if (el) { handleAction(el); return; }
        var sub = e.target.closest('.sub-tab');
        if (sub) {
            switchSubTab(sub.getAttribute('data-tab-group'), sub.getAttribute('data-panel'), sub);
            return;
        }
        var nav = e.target.closest('.nav-item');
        if (nav) {
            switchTab(nav, nav.getAttribute('data-page'));
            return;
        }
        var scrim = e.target.closest('#sheet-scrim');
        if (scrim) { closeFilterSheet(); return; }

        // Chip genre (pilihan tunggal)
        var genreChip = e.target.closest('[data-genre]');
        if (genreChip) {
            state.filter.genre = genreChip.getAttribute('data-genre');
            genreChip.closest('.chip-wrap').querySelectorAll('[data-genre]').forEach(function (c) {
                c.setAttribute('aria-pressed', c === genreChip ? 'true' : 'false');
            });
            return;
        }
        // Chip rating (pilihan tunggal, bisa dibatalkan)
        var ratingChip = e.target.closest('[data-rating]');
        if (ratingChip) {
            var val = Number(ratingChip.getAttribute('data-rating'));
            if (state.filter.rating === val) { state.filter.rating = null; ratingChip.setAttribute('aria-pressed', 'false'); }
            else {
                state.filter.rating = val;
                ratingChip.closest('.chip-wrap').querySelectorAll('[data-rating]').forEach(function (c) {
                    c.setAttribute('aria-pressed', c === ratingChip ? 'true' : 'false');
                });
            }
            return;
        }
    });

    // Keyboard panah untuk tab
    document.addEventListener('keydown', function (e) {
        var sub = e.target.closest ? e.target.closest('.sub-tab') : null;
        if (!sub || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
        var tabs = [].slice.call(sub.closest('.sub-tabs').querySelectorAll('.sub-tab'));
        var idx = tabs.indexOf(sub);
        var nextIdx = e.key === 'ArrowRight' ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
        tabs[nextIdx].focus();
        switchSubTab(tabs[nextIdx].getAttribute('data-tab-group'), tabs[nextIdx].getAttribute('data-panel'), tabs[nextIdx]);
    });

    // Switch (tema, notifikasi)
    document.addEventListener('click', function (e) {
        var sw = e.target.closest('.switch');
        if (!sw) return;
        if (sw.id === 'theme-switch') { toggleTheme(); return; }
        var checked = sw.getAttribute('aria-checked') !== 'true';
        sw.setAttribute('aria-checked', String(checked));
        if (sw.id === 'notif-push-switch') { state.notifPush = checked; writeStored('ipusnas-notif-push', String(checked)); }
        if (sw.id === 'notif-email-switch') { state.notifEmail = checked; writeStored('ipusnas-notif-email', String(checked)); }
    });

    // Pencarian beranda
    var searchInput = document.querySelector('#page-beranda .search-bar input');
    if (searchInput) {
        searchInput.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            var q = this.value.trim().toLowerCase();
            if (!q) return;
            var results = DATA.books.filter(function (b) {
                return b.title.toLowerCase().indexOf(q) !== -1 || b.author.toLowerCase().indexOf(q) !== -1 || (b.isbn && b.isbn.indexOf(q) !== -1);
            });
            renderSelengkapnya(results, 'Hasil pencarian \u201c' + this.value.trim() + '\u201d');
            showPage('page-selengkapnya');
        });
    }
});

// Ekspor untuk kompatibilitas (tidak dipanggil dari HTML)
window.switchTab = switchTab;
window.showPage = showPage;
window.goBack = goBack;
window.openFilterSheet = openFilterSheet;
window.closeFilterSheet = closeFilterSheet;
window.toggleTheme = toggleTheme;
window.applyFilter = applyFilter;
