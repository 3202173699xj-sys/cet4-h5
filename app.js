/* 四级刷题 H5 - 纯原生 JS，零构建
 * 数据：fetch('./questions.json') 加载题库；进度和错题本存 localStorage（key: cet4h5）
 * 交互核心：点击选项即判定，无提交按钮
 */
(function () {
  'use strict';

  var LS_KEY = 'cet4h5';
  var QUESTIONS = [];
  var QMAP = {}; // id -> question

  // 本地存储：{ progress: {lastIndex}, wrongBook: {id: {wrongCount,lastWrongAt,nextReviewAt,status}} }
  var store = { progress: { lastIndex: 0 }, wrongBook: {} };

  // 当前答题会话：{ list: [题...], idx, mode: 'seq'|'special'|'wrong', answered }
  var session = null;

  // ---------- 工具 ----------
  function $(id) { return document.getElementById(id); }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function nextDayStr() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s.progress && typeof s.progress.lastIndex === 'number') store.progress = s.progress;
        if (s.wrongBook && typeof s.wrongBook === 'object') store.wrongBook = s.wrongBook;
      }
    } catch (e) { /* 损坏则用默认值 */ }
  }
  function saveStore() {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  }

  // ---------- 视图切换 ----------
  var VIEWS = ['home', 'filter', 'quiz', 'wrong'];
  function show(name) {
    VIEWS.forEach(function (v) {
      $('view-' + v).classList.toggle('hidden', v !== name);
    });
    window.scrollTo(0, 0);
    if (name === 'home') renderHomeStats();
    if (name === 'wrong') renderWrongList();
  }

  // ---------- 首页 ----------
  function pendingWrongs() {
    var t = todayStr();
    return Object.keys(store.wrongBook).filter(function (id) {
      var w = store.wrongBook[id];
      return w.status === 'pending' && w.nextReviewAt <= t;
    });
  }

  function renderHomeStats() {
    var done = Math.min(store.progress.lastIndex, QUESTIONS.length);
    $('home-stats').innerHTML =
      '题库总数：' + QUESTIONS.length + ' 题<br>' +
      '顺序练习进度：' + done + ' / ' + QUESTIONS.length + '<br>' +
      '待复习错题：' + pendingWrongs().length + ' 题';
  }

  // ---------- 答题页 ----------
  function startQuiz(list, mode, idx) {
    if (!list.length) { alert('没有符合条件的题目'); return; }
    session = { list: list, idx: idx || 0, mode: mode, answered: false };
    show('quiz');
    renderQuestion();
  }

  function renderQuestion() {
    var q = session.list[session.idx];
    session.answered = false;

    $('quiz-progress').textContent = (session.idx + 1) + ' / ' + session.list.length;
    $('quiz-meta').innerHTML =
      '<span class="tag">' + (q.type === 'listening' ? '听力' : '阅读') + '</span>' +
      '<span class="tag">' + q.tag + '</span>' +
      q.set + ' · 第' + q.sourceNo + '题';

    // 阅读题：可折叠第一段 + 题目；听力题：无题干无原文
    var isReading = q.type === 'reading';
    $('quiz-passage-box').classList.toggle('hidden', !isReading);
    if (isReading) {
      $('quiz-passage').textContent = q.passage;
      $('quiz-passage-box').open = false;
      $('quiz-stem').textContent = q.stem;
    } else {
      $('quiz-stem').textContent = '';
    }

    var box = $('quiz-options');
    box.innerHTML = '';
    q.options.forEach(function (o) {
      var btn = document.createElement('button');
      btn.className = 'opt';
      btn.innerHTML = '<span class="key">' + o.key + ')</span><span></span>';
      btn.lastChild.textContent = o.text;
      btn.addEventListener('click', function () { onPick(q, o.key, btn); });
      box.appendChild(btn);
    });

    $('btn-next').classList.add('hidden');
  }

  // 点击选项即判定：锁定、对绿错红、答错立即写入错题本
  function onPick(q, key, btn) {
    if (session.answered) return;
    session.answered = true;

    var opts = $('quiz-options').children;
    for (var i = 0; i < opts.length; i++) {
      opts[i].classList.add('locked');
      if (q.options[i].key === q.answer) opts[i].classList.add('correct');
    }
    if (key !== q.answer) {
      btn.classList.add('wrong');
      addWrong(q.id); // 点击错误选项的瞬间写入错题本
    } else if (session.mode === 'wrong' && store.wrongBook[q.id]) {
      store.wrongBook[q.id].status = 'mastered'; // 错题重做答对立即标记已掌握
      saveStore();
    }
    $('btn-next').classList.remove('hidden');
  }

  function onNext() {
    if (!session.answered) return;
    if (session.mode === 'seq') {
      // 顺序练习进度 = 下一题的位置
      store.progress.lastIndex = Math.max(store.progress.lastIndex, session.idx + 1);
      saveStore();
    }
    if (session.idx + 1 < session.list.length) {
      session.idx++;
      renderQuestion();
    } else if (session.mode === 'wrong') {
      show('wrong'); // 错题重做完返回错题本
    } else {
      alert('本轮练习完成！');
      show('home');
    }
  }

  // ---------- 错题本 ----------
  function addWrong(id) {
    var w = store.wrongBook[id] || { wrongCount: 0 };
    w.wrongCount++;
    w.lastWrongAt = todayStr();
    w.nextReviewAt = nextDayStr();
    w.status = 'pending';
    store.wrongBook[id] = w;
    saveStore();
  }

  function wrongSummary(q) {
    var head = q.set + ' 第' + q.sourceNo + '题';
    if (q.type === 'listening') {
      return head + '｜A) ' + q.options[0].text;
    }
    return head + '｜' + q.stem;
  }

  var wrongTab = 'pending'; // 当前错题本标签页

  function renderWrongList() {
    var t = todayStr();
    var ids = Object.keys(store.wrongBook).filter(function (id) { return QMAP[id]; });
    if (wrongTab === 'pending') {
      ids = ids.filter(function (id) {
        var w = store.wrongBook[id];
        return w.status === 'pending' && w.nextReviewAt <= t;
      });
    }
    // 按下次复习日期、再按套次排序
    ids.sort(function (a, b) {
      var wa = store.wrongBook[a], wb = store.wrongBook[b];
      return (wa.nextReviewAt + a).localeCompare(wb.nextReviewAt + b);
    });

    var box = $('wrong-list');
    box.innerHTML = '';
    if (!ids.length) {
      box.innerHTML = '<div class="empty-tip">' +
        (wrongTab === 'pending' ? '今天没有待复习的错题' : '错题本是空的，继续保持') + '</div>';
      return;
    }
    ids.forEach(function (id) {
      var q = QMAP[id], w = store.wrongBook[id];
      var item = document.createElement('div');
      item.className = 'wrong-item';

      var summary = document.createElement('div');
      summary.className = 'summary';
      summary.textContent = wrongSummary(q);
      item.appendChild(summary);

      var info = document.createElement('div');
      info.className = 'info';
      info.innerHTML = '错 ' + w.wrongCount + ' 次 · 下次复习 ' + w.nextReviewAt +
        (w.status === 'mastered' ? ' · <span class="mastered-badge">已掌握</span>' : '');
      item.appendChild(info);

      var row = document.createElement('div');
      row.className = 'row';
      var redo = document.createElement('button');
      redo.className = 'redo';
      redo.textContent = '重做';
      redo.addEventListener('click', function () { startQuiz([q], 'wrong', 0); });
      row.appendChild(redo);
      if (w.status === 'mastered') {
        var restore = document.createElement('button');
        restore.textContent = '恢复待复习';
        restore.addEventListener('click', function () {
          w.status = 'pending';
          w.nextReviewAt = todayStr();
          saveStore();
          renderWrongList();
        });
        row.appendChild(restore);
      }
      item.appendChild(row);
      box.appendChild(item);
    });
  }

  // ---------- 专项练习 ----------
  function renderFilterOptions() {
    var setSel = $('f-set');
    setSel.innerHTML = '<option value="all">全部套次</option>';
    var seen = {};
    QUESTIONS.forEach(function (q) {
      if (!seen[q.set]) { seen[q.set] = 1; }
    });
    Object.keys(seen).forEach(function (s) {
      var o = document.createElement('option');
      o.value = s; o.textContent = s;
      setSel.appendChild(o);
    });
    updateFilterCount();
  }

  function currentFilter() {
    return {
      type: $('f-type').value,
      set: $('f-set').value,
      tag: $('f-tag').value
    };
  }

  function filterQuestions() {
    var f = currentFilter();
    return QUESTIONS.filter(function (q) {
      if (f.type !== 'all' && q.type !== f.type) return false;
      if (f.set !== 'all' && q.set !== f.set) return false;
      if (f.tag !== 'all' && q.tag !== f.tag) return false;
      return true;
    });
  }

  function updateFilterCount() {
    // 标签选项随题型联动
    var type = $('f-type').value;
    var tagSel = $('f-tag');
    var tags = {};
    QUESTIONS.forEach(function (q) {
      if ((type === 'all' || q.type === type) && q.tag) tags[q.tag] = 1;
    });
    tagSel.innerHTML = '<option value="all">全部标签</option>';
    Object.keys(tags).forEach(function (t) {
      var o = document.createElement('option');
      o.value = t; o.textContent = t;
      tagSel.appendChild(o);
    });
    $('f-count').textContent = '符合条件：' + filterQuestions().length + ' 题';
  }

  // ---------- 数据备份 ----------
  function exportJSON() {
    var blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cet4-backup-' + todayStr() + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJSON(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var s = JSON.parse(reader.result);
        if (!s.progress || !s.wrongBook) throw new Error('格式不对');
        store = s;
        saveStore();
        alert('导入成功');
        renderWrongList();
        renderHomeStats();
      } catch (e) {
        alert('导入失败：文件格式不正确');
      }
    };
    reader.readAsText(file);
  }

  // ---------- 事件绑定 ----------
  function bindEvents() {
    $('btn-seq').addEventListener('click', function () {
      if (store.progress.lastIndex >= QUESTIONS.length) {
        if (!confirm('顺序练习已完成，是否从头开始？')) return;
        store.progress.lastIndex = 0;
        saveStore();
      }
      startQuiz(QUESTIONS, 'seq', store.progress.lastIndex);
    });
    $('btn-special').addEventListener('click', function () { show('filter'); });
    $('btn-wrong').addEventListener('click', function () { show('wrong'); });

    document.querySelectorAll('[data-go="home"]').forEach(function (b) {
      b.addEventListener('click', function () { show('home'); });
    });

    $('f-type').addEventListener('change', updateFilterCount);
    $('f-set').addEventListener('change', updateFilterCount);
    $('f-tag').addEventListener('change', updateFilterCount);
    $('btn-start-special').addEventListener('click', function () {
      startQuiz(filterQuestions(), 'special', 0);
    });

    $('quiz-back').addEventListener('click', function () {
      show(session && session.mode === 'wrong' ? 'wrong' : 'home');
    });
    $('btn-next').addEventListener('click', onNext);

    $('tab-pending').addEventListener('click', function () {
      wrongTab = 'pending';
      $('tab-pending').classList.add('active');
      $('tab-all').classList.remove('active');
      renderWrongList();
    });
    $('tab-all').addEventListener('click', function () {
      wrongTab = 'all';
      $('tab-all').classList.add('active');
      $('tab-pending').classList.remove('active');
      renderWrongList();
    });

    $('btn-export').addEventListener('click', exportJSON);
    $('btn-import').addEventListener('click', function () { $('import-file').click(); });
    $('import-file').addEventListener('change', function (e) {
      if (e.target.files[0]) importJSON(e.target.files[0]);
      e.target.value = '';
    });
    $('btn-clear-wrong').addEventListener('click', function () {
      if (confirm('确定清空错题本？此操作不可恢复！')) {
        store.wrongBook = {};
        saveStore();
        renderWrongList();
        renderHomeStats();
      }
    });
    $('btn-clear-all').addEventListener('click', function () {
      if (confirm('确定清除全部本地数据（进度+错题本）？此操作不可恢复！')) {
        store = { progress: { lastIndex: 0 }, wrongBook: {} };
        saveStore();
        renderWrongList();
        renderHomeStats();
      }
    });
  }

  // ---------- 启动 ----------
  fetch('./questions.json')
    .then(function (r) { return r.json(); })
    .then(function (qs) {
      QUESTIONS = qs;
      qs.forEach(function (q) { QMAP[q.id] = q; });
      loadStore();
      bindEvents();
      renderFilterOptions();
      show('home');
    })
    .catch(function () {
      document.body.innerHTML = '<div class="empty-tip">题库加载失败，请确认 questions.json 与页面同目录部署</div>';
    });
})();
