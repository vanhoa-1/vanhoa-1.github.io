// 司令塔画面（最小版）— Supabase REST（PostgREST）から読み取り専用で表示する。
// config.js がプレースホルダの場合はモックデータで表示する。
(function () {
  "use strict";

  var cfg = window.OPS_CONFIG || {};
  var useMock = cfg.forceMock || !cfg.supabaseUrl || !cfg.anonKey ||
    cfg.supabaseUrl.indexOf("YOUR_") >= 0 || cfg.anonKey.indexOf("YOUR_") >= 0;

  // ---------------- モックデータ（REST の返却形に合わせた形） ----------------
  var MOCK = {
    projects: [
      { id: "p1", slug: "the-gym", name: "THE GYM", status_label: "運用中", status_color: "green", summary: "テーマ投稿は火・金に公開", next_action: "11月6日分の画像を検品", owner_action: "", sort_order: 1, updated_at: "2026-11-03T12:00:00+09:00" },
      { id: "p2", slug: "corporate-line", name: "法人LINE", status_label: "本番テスト再実施予定", status_color: "yellow", summary: "検証は完了。本番の塞ぎ予約は鍵の種類が原因で未作成", next_action: "buyer-level の鍵で再実施", owner_action: "11月4日18時に承認操作", sort_order: 3, updated_at: "2026-11-03T19:00:00+09:00" },
      { id: "p3", slug: "spotter", name: "SPOTTER", status_label: "開発中", status_color: "yellow", summary: "実装完了。試験用DBへの反映が残り", next_action: "migration 適用と通し確認", owner_action: "ログインとDBパスワード入力", sort_order: 4, updated_at: "2026-11-03T18:00:00+09:00" }
    ],
    media_channels: [
      { id: "m1", slug: "instagram", name: "Instagram", account_label: "@thegym_fit", sort_order: 1 },
      { id: "m2", slug: "threads", name: "Threads", account_label: "@thegym_fit", sort_order: 2 },
      { id: "m3", slug: "x", name: "X", account_label: "@thegym_fit", sort_order: 4 },
      { id: "m4", slug: "note", name: "note", account_label: "wataru_gym_ai", sort_order: 7 }
    ],
    work_items: [
      {
        id: "w1", title: "11月6日テーマ投稿（画像付き）", kind: "production",
        project_id: "p1", media_id: "m1", assignee: "gpt", status: "in_progress",
        scheduled_at: "2026-11-06T20:49:00+09:00", due_at: "2026-11-06T10:00:00+09:00",
        steps: [
          { label: "画像の依頼", done: true },
          { label: "GPTの納品", done: true },
          { label: "自動検品", done: false },
          { label: "承認", done: false },
          { label: "投稿と実物確認", done: false }
        ],
        steps_total: 5, steps_done: 2, note: "", blocked_reason: "", owner_action: "",
        media: { name: "Instagram", slug: "instagram" }, project: { name: "THE GYM", slug: "the-gym" }
      },
      {
        id: "w2", title: "本番Squareの塞ぎ予約（再実施）", kind: "task",
        project_id: "p2", media_id: null, assignee: "muse", status: "blocked",
        scheduled_at: "2026-11-04T18:00:00+09:00", due_at: "2026-11-04T18:00:00+09:00",
        steps: [
          { label: "buyer-level の鍵を取得", done: false },
          { label: "予約を作成", done: false },
          { label: "目視確認と取消", done: false }
        ],
        steps_total: 3, steps_done: 0, note: "",
        blocked_reason: "鍵の種類が違うため作成できなかった",
        owner_action: "11月4日18時に承認操作をお願いします",
        media: null, project: { name: "法人LINE", slug: "corporate-line" }
      },
      {
        id: "w3", title: "記事3本目の公開", kind: "task",
        project_id: null, media_id: "m4", assignee: "muse", status: "waiting_approval",
        scheduled_at: null, due_at: null,
        steps: [
          { label: "下書き", done: true },
          { label: "見出し画像", done: true },
          { label: "公開の承認", done: false }
        ],
        steps_total: 3, steps_done: 2, note: "", blocked_reason: "", owner_action: "公開の承認",
        media: { name: "note", slug: "note" }, project: null
      }
    ],
    approvals: [
      {
        id: "a1", title: "note記事3本目の公開", status: "pending",
        recommendation: "公開する", reason: "見出し画像の検品と承認が完了している",
        assumptions: "本文は下書きのまま", risk: "低（下書き内容の公開のみ）",
        created_at: "2026-11-03T13:30:00+09:00", project: null
      }
    ],
    reports: [
      { id: "r1", kind: "result", body: "Threads 11月3日分を承認文面のまま公開し、読み戻しで一致を確認", created_at: "2026-11-03T20:55:00+09:00" },
      { id: "r2", kind: "progress", body: "法人LINEの本番テストは鍵の種類が原因で作成できず。11月4日18時に再実施", created_at: "2026-11-03T19:10:00+09:00" },
      { id: "r3", kind: "alert", body: "Instagram の予約投稿が公開されなかったため、即時投稿へ切り替えた", created_at: "2026-11-03T21:15:00+09:00" }
    ]
  };

  // ---------------- REST 取得 ----------------
  function rest(path) {
    return fetch(cfg.supabaseUrl.replace(/\/$/, "") + "/rest/v1/" + path, {
      headers: {
        apikey: cfg.anonKey,
        Authorization: "Bearer " + cfg.anonKey,
        Accept: "application/json"
      }
    }).then(function (res) {
      if (!res.ok) throw new Error("REST " + res.status);
      return res.json();
    });
  }

  // ---------------- 書き込み（合言葉トークン方式） ----------------
  // 編集範囲は「完了チェック」と「タスク追加」だけ（2026年11月3日決定）。
  // トークンはこの端末の localStorage にだけ置く。ページのソースには入れない。
  function getToken() {
    try { return localStorage.getItem("opsWriteToken") || ""; } catch (e) { return ""; }
  }
  function setToken(t) {
    try {
      if (t) localStorage.setItem("opsWriteToken", t);
      else localStorage.removeItem("opsWriteToken");
    } catch (e) { /* 保存できない環境では編集不可のまま */ }
  }
  function writeRest(method, path, payload) {
    return fetch(cfg.supabaseUrl.replace(/\/$/, "") + "/rest/v1/" + path, {
      method: method,
      headers: {
        apikey: cfg.anonKey,
        Authorization: "Bearer " + cfg.anonKey,
        "x-ops-token": getToken(),
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: payload ? JSON.stringify(payload) : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error("WRITE " + res.status);
      return res.json().catch(function () { return null; });
    });
  }
  function reload() {
    load().then(render).catch(function (e) {
      document.getElementById("meta").textContent = "読み取りに失敗しました：" + e.message;
    });
  }
  function writeFailed(e) {
    alert("保存できませんでした。編集キーが違うか、通信に失敗しました。（" + e.message + "）");
  }

  function load() {
    if (useMock) return Promise.resolve(MOCK);
    var workSelect =
      "select=*,media:media_channels(name,slug),project:projects(name,slug)" +
      "&status=not.in.(done,cancelled)&order=due_at.asc.nullslast,created_at.desc&limit=50";
    var doneSelect =
      "select=*,media:media_channels(name,slug),project:projects(name,slug)" +
      "&status=eq.done&order=done_at.desc.nullslast&limit=10";
    return Promise.all([
      rest("projects?select=*&order=sort_order.asc"),
      rest("media_channels?select=*&order=sort_order.asc"),
      rest("work_items?" + workSelect),
      rest("approvals?select=*,project:projects(name,slug)&status=eq.pending&order=created_at.desc"),
      rest("reports?select=*&order=created_at.desc&limit=20"),
      rest("work_items?" + doneSelect)
    ]).then(function (r) {
      return { projects: r[0], media_channels: r[1], work_items: r[2], approvals: r[3], reports: r[4], done_items: r[5] };
    });
  }

  // ---------------- 表示 ----------------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return (d.getMonth() + 1) + "/" + d.getDate() + " " +
      String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  var STATUS_LABEL = {
    planned: "予定", in_progress: "進行中", waiting_approval: "承認待ち",
    blocked: "止まっている", done: "完了", cancelled: "中止"
  };

  function progressHtml(w) {
    if (!w.steps_total) return "";
    var pct = Math.round((w.steps_done / w.steps_total) * 100);
    var rest = (w.steps || []).filter(function (s) { return !s.done; })
      .map(function (s) { return s.label; });
    var restText = rest.length ? "残り：" + rest.join("、") : "全工程が完了";
    return '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<p class="progress-note">工程の割合 ' + pct + "%（" + w.steps_done + "/" + w.steps_total + "）｜" +
      esc(restText) + "</p>";
  }

  function render(data) {
    document.getElementById("meta").innerHTML =
      (useMock ? '<span class="badge">モック表示</span> ' : "") +
      esc(new Date().toLocaleString("ja-JP")) + " 時点";

    // 承認待ち
    var apSec = document.getElementById("approvals-section");
    var ap = document.getElementById("approvals");
    if (data.approvals.length) {
      apSec.hidden = false;
      ap.innerHTML = data.approvals.map(function (a) {
        return '<article class="card approval"><div class="name">' + esc(a.title) + "</div>" +
          (a.recommendation ? '<p class="rec">推奨：' + esc(a.recommendation) + "</p>" : "") +
          (a.reason ? '<p class="rec">理由：' + esc(a.reason) + "</p>" : "") +
          (a.risk ? '<p class="rec">リスク：' + esc(a.risk) + "</p>" : "") +
          "</article>";
      }).join("");
    } else {
      apSec.hidden = true;
    }

    // 媒体カード（媒体ごとの直近の作業と進捗）
    document.getElementById("media").innerHTML = data.media_channels.map(function (m) {
      var works = data.work_items.filter(function (w) { return w.media_id === m.id; });
      var head = works[0];
      var body = head
        ? '<p class="line">' + esc(head.title) + "</p>" + progressHtml(head)
        : '<p class="line empty">進行中の作業なし</p>';
      return '<article class="card"><div class="name">' + esc(m.name) + "</div>" +
        '<div class="sub">' + esc(m.account_label) + "</div>" + body + "</article>";
    }).join("") || '<p class="empty">媒体の登録なし</p>';

    // 案件
    document.getElementById("projects").innerHTML = data.projects.map(function (p) {
      return '<article class="card"><div class="name"><span class="dot ' + esc(p.status_color) + '"></span>' +
        esc(p.name) + "</div>" +
        '<div class="sub">' + esc(p.status_label) + "</div>" +
        (p.summary ? '<p class="line">' + esc(p.summary) + "</p>" : "") +
        (p.next_action ? '<p class="line">次：' + esc(p.next_action) + "</p>" : "") +
        (p.owner_action ? '<p class="warn">あなたの番：' + esc(p.owner_action) + "</p>" : "") +
        "</article>";
    }).join("") || '<p class="empty">案件の登録なし</p>';

    // 作業（進行中＋完了済み。完了済みは末尾に置き、取り消しできる）
    var workCard = function (w, isDone) {
      var where = [w.project && w.project.name, w.media && w.media.name].filter(Boolean).join(" / ");
      var when = w.due_at ? "期限 " + fmtTime(w.due_at) : (w.scheduled_at ? "予定 " + fmtTime(w.scheduled_at) : "");
      var btn = "";
      if (!useMock && getToken()) {
        btn = isDone
          ? '<button class="btn undo-btn" data-undo="' + esc(w.id) + '">完了を取り消す</button>'
          : '<button class="btn done-btn" data-done="' + esc(w.id) + '">完了にする</button>';
      }
      return '<article class="card"><div class="name">' + esc(w.title) + "</div>" +
        '<div class="sub">' + esc(where) + (when ? "｜" + esc(when) : "") + "</div>" +
        '<p class="line"><span class="status ' + esc(w.status) + '">' +
        esc(STATUS_LABEL[w.status] || w.status) + "</span></p>" +
        progressHtml(w) +
        (w.status === "blocked" && w.blocked_reason ? '<p class="warn">理由：' + esc(w.blocked_reason) + "</p>" : "") +
        (w.owner_action ? '<p class="warn">あなたの番：' + esc(w.owner_action) + "</p>" : "") +
        btn +
        "</article>";
    };
    var allCards = data.work_items.map(function (w) { return workCard(w, false); })
      .concat((data.done_items || []).map(function (w) { return workCard(w, true); }));
    document.getElementById("works").innerHTML = allCards.join("") || '<p class="empty">進行中の作業なし</p>';

    // 編集バー（編集キーの設定状態）とタスク追加フォーム
    var eb = document.getElementById("editbar");
    if (!useMock) {
      eb.innerHTML = getToken()
        ? '編集モード <button class="btn" id="token-clear">編集をオフにする</button>'
        : '<button class="btn" id="token-set">編集キーを設定する</button>';
      var ts = document.getElementById("token-set");
      if (ts) ts.addEventListener("click", function () {
        var t = prompt("編集キーを入力してください（この端末にだけ保存されます）");
        if (t) { setToken(t.trim()); reload(); }
      });
      var tc = document.getElementById("token-clear");
      if (tc) tc.addEventListener("click", function () { setToken(""); reload(); });

      var aw = document.getElementById("addwork");
      if (getToken()) {
        aw.innerHTML = '<form class="addform" id="addform">' +
          '<input type="text" id="new-title" placeholder="タスクを追加" autocomplete="off">' +
          '<select id="new-project"><option value="">案件なし</option>' +
          data.projects.map(function (p) {
            return '<option value="' + esc(p.id) + '">' + esc(p.name) + "</option>";
          }).join("") +
          '</select><button class="btn" type="submit">追加</button></form>';
        document.getElementById("addform").addEventListener("submit", function (ev) {
          ev.preventDefault();
          var title = document.getElementById("new-title").value.trim();
          if (!title) return;
          var pid = document.getElementById("new-project").value || null;
          writeRest("POST", "work_items", {
            title: title, kind: "task", assignee: "wataru", status: "planned",
            project_id: pid, steps: [], steps_total: 0, steps_done: 0, note: ""
          }).then(reload).catch(writeFailed);
        });
      } else {
        aw.innerHTML = "";
      }
      Array.prototype.forEach.call(document.querySelectorAll("[data-done]"), function (b) {
        b.addEventListener("click", function () {
          if (!window.confirm("この作業を完了にしますか？")) return;
          writeRest("PATCH", "work_items?id=eq." + encodeURIComponent(b.getAttribute("data-done")), {
            status: "done", done_at: new Date().toISOString()
          }).then(reload).catch(writeFailed);
        });
      });
      Array.prototype.forEach.call(document.querySelectorAll("[data-undo]"), function (b) {
        b.addEventListener("click", function () {
          writeRest("PATCH", "work_items?id=eq." + encodeURIComponent(b.getAttribute("data-undo")), {
            status: "planned", done_at: null
          }).then(reload).catch(writeFailed);
        });
      });
    }

    // 報告履歴
    document.getElementById("reports").innerHTML = data.reports.map(function (r) {
      return '<article class="card report"><time>' + esc(fmtTime(r.created_at)) + "</time>" +
        esc(r.body) + "</article>";
    }).join("") || '<p class="empty">報告なし</p>';
  }

  load().then(render).catch(function (e) {
    document.getElementById("meta").textContent = "読み取りに失敗しました：" + e.message;
  });
})();
