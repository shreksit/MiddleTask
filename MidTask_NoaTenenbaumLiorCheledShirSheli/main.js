/* =========================================================
   SCORM 1.2 (pipwerks)
   ========================================================= */

var isScormConnected = false;

document.addEventListener("DOMContentLoaded", function () {
  initScorm();          // חיבור ל-LMS וטעינת נתוני לומד
  initHamburgerMenu();  // תפריט מובייל
  initCardsSearch();    // חיפוש כרטיסיות לפי כותרת
  initScormForm();      // ניהול טופס + ולידציה + שליחה ל-SCORM
});

/* =========================================================
   SCORM init
   ========================================================= */

function initScorm() {
  // בדיקה שה-SCORM wrapper נטען
  if (!window.pipwerks || !pipwerks.SCORM) {
    console.warn("[SCORM] Wrapper not found (pipwerks).");
    return;
  }

  // התחברות ל-LMS
  isScormConnected = pipwerks.SCORM.init();

  if (!isScormConnected) {
    console.error("[SCORM] init() failed.");
    return;
  }

  // משיכת פרטי לומד + בדיקת סטטוס שיעור
  fetchLearnerDataAndResetIfNeeded();
}

function fetchLearnerDataAndResetIfNeeded() {
  if (!isScormConnected) return;

  // נתוני לומד מתוך ה-LMS
  var learnerName = pipwerks.SCORM.get("cmi.core.student_name") || "";
  var learnerId = pipwerks.SCORM.get("cmi.core.student_id") || "";
  var status = (pipwerks.SCORM.get("cmi.core.lesson_status") || "").toLowerCase();

  // לוגים לבדיקה (לא חובה לפרודקשן, אבל עוזר בדיבוג)
  console.log("--- SCORM Learner Data ---");
  console.log("Name =", learnerName);
  console.log("ID   =", learnerId);
  console.log("Status =", status);
  console.log("--------------------------");

  // אם השיעור כבר הוגדר כהושלם בעבר, מחזירים ל-incomplete כדי לאפשר מילוי מחדש
  if (status === "completed" || status === "passed") {
    pipwerks.SCORM.set("cmi.core.lesson_status", "incomplete");
    pipwerks.SCORM.save();
    console.log("[SCORM] lesson_status reset to incomplete");
  }
}

/* =========================================================
   SCORM interactions
   ========================================================= */

function sendInteractionsBatchToLMS(interactions) {
  // שולח את תשובות המשתמש לשדות כ-interactions ב-SCORM
  if (!isScormConnected) return;
  if (!interactions || interactions.length === 0) return;

  var scorm = pipwerks.SCORM;

  for (var i = 0; i < interactions.length; i++) {
    var base = "cmi.interactions." + i;
    scorm.set(base + ".id", interactions[i].id);
    scorm.set(base + ".type", interactions[i].type);
    scorm.set(base + ".student_response", interactions[i].student_response);
  }

  scorm.save();
}

function setCompletedStatusOnly() {
  // מסמן את השיעור כהושלם לאחר שליחה תקינה של הטופס
  if (!isScormConnected) return;
  pipwerks.SCORM.set("cmi.core.lesson_status", "completed");
  pipwerks.SCORM.save();
}

/* =========================================================
   1) המבורגר
   ========================================================= */

function initHamburgerMenu() {
  var btn = document.getElementById("hamburgerBtn");
  var menu = document.getElementById("mainNav");
  if (!btn || !menu) return;

  // פתיחה/סגירה של התפריט ושמירה על aria-expanded לנגישות
  btn.addEventListener("click", function () {
    var isOpen = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", isOpen ? "false" : "true");
    menu.hidden = isOpen;
  });

  // בלחיצה על קישור בתפריט: סגירה אוטומטית
  var links = menu.querySelectorAll("a");
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener("click", function () {
      btn.setAttribute("aria-expanded", "false");
      menu.hidden = true;
    });
  }
}

/* =========================================================
   2) חיפוש כרטיסיות
   ========================================================= */

function initCardsSearch() {
  var searchInput = document.getElementById("searchInput");
  var searchButton = document.getElementById("searchButton");
  var cards = document.querySelectorAll(".stages-section .row > div");

  if (!searchInput || !searchButton || cards.length === 0) return;

  // סינון כרטיסיות לפי טקסט בכותרת
  function doSearch() {
    var text = searchInput.value.trim().toLowerCase();

    if (text === "") {
      for (var i = 0; i < cards.length; i++) cards[i].style.display = "";
      return;
    }

    for (var j = 0; j < cards.length; j++) {
      var titleElement = cards[j].querySelector(".stage-title");
      var titleText = titleElement ? titleElement.textContent.toLowerCase() : "";
      cards[j].style.display = titleText.indexOf(text) !== -1 ? "" : "none";
    }
  }

  searchButton.addEventListener("click", doSearch);

  // מאפשר חיפוש גם בלחיצה על Enter
  searchInput.addEventListener("keyup", function (event) {
    if (event.key === "Enter") doSearch();
  });
}

/* =========================================================
   3) טופס
   ========================================================= */

function initScormForm() {
  var overlay = document.getElementById("successOverlay");
  var form = document.getElementById("scorm-form");
  if (!form) return;

  // מצב ברירת מחדל בעת טעינה: טופס מוצג, הודעת הצלחה מוסתרת
  if (overlay) overlay.hidden = true;
  form.hidden = false;
  form.style.display = "";
  form.reset();

  // מפעיל מחדש את כפתור השליחה (במקרה שננעל לאחר שליחה)
  var submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = false;

  // איפוס דרופדאון מרובה-בחירה (שומר ערכים ב-hidden input)
  var hiddenProject = document.getElementById("projectType");
  var valuesBox = document.getElementById("projectTypeValues");
  var dd = document.getElementById("projectTypeDD");
  var projectBtn = document.getElementById("projectTypeBtn");

  if (hiddenProject) hiddenProject.value = "";
  if (valuesBox) valuesBox.innerHTML = "";
  if (dd) dd.classList.remove("open", "has-values");
  if (projectBtn) projectBtn.setAttribute("aria-expanded", "false");

  var fullNameInput = document.getElementById("fullName");
  var favFieldRadios = form.querySelectorAll('input[name="favField"]');

  initProjectTypeDropdown();

  // אלמנטים להצגת הודעות שגיאה
  var errorFullName = document.getElementById("error-fullName");
  var errorProject = document.getElementById("error-projectType");
  var errorFavField = document.getElementById("error-favField");

  // ניקוי מצב שגיאה לפני שימוש
  clearError(fullNameInput, errorFullName);
  clearError(projectBtn, errorProject);
  if (errorFavField) errorFavField.textContent = "";

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var isValid = true;

    // איפוס הודעות שגיאה לפני ולידציה
    clearError(fullNameInput, errorFullName);
    clearError(projectBtn, errorProject);
    if (errorFavField) errorFavField.textContent = "";

    // ולידציה: שם מלא
    var nameValue = (fullNameInput.value || "").trim();
    if (nameValue.length < 2) {
      showError(fullNameInput, errorFullName, "הזן 2 תווים ומעלה");
      isValid = false;
    }

    // ולידציה: סוג פרויקט (נשלף מה-hidden input)
    var selectedValues = (hiddenProject && hiddenProject.value ? hiddenProject.value : "")
      .split(",")
      .map(function (x) { return x.trim(); })
      .filter(Boolean);

    if (selectedValues.length === 0) {
      showError(projectBtn, errorProject, "בחרי סוג פרויקט מתוך הרשימה");
      isValid = false;
    }

    // ולידציה: רדיו
    var favValue = getSelectedRadioValue(favFieldRadios);
    if (!favValue) {
      if (errorFavField) errorFavField.textContent = "בחר תחום דעת";
      isValid = false;
    }

    if (!isValid) return;

    // המרה לערכים מוצגים בעברית לפני שליחה ל-LMS
    var projectLabels = {
      content: "מחוללי תוכן",
      "ai-assistants": "צ׳אטבוטים / AI",
      "mini-course": "מיני קורס",
      lms: "לומדות",
      "data-viz": "מציאות רבודה/מדומה"
    };

    var favLabels = {
      technology: "תכנות",
      design: "עיצוב",
      instruction: "הדרכה"
    };

    var projectHeb = [];
    for (var k = 0; k < selectedValues.length; k++) {
      projectHeb.push(projectLabels[selectedValues[k]] || selectedValues[k]);
    }

    var favHeb = favLabels[favValue] || favValue;

    // בניית interactions לפי שדות הטופס
    var interactions = [
      { id: "שם מלא", type: "fill-in", student_response: nameValue },
      { id: "איזה סוג פרויקט מעניין אותך?", type: "choice", student_response: projectHeb.join(", ") },
      { id: "מהו תחום הדעת האהוב עלייך בתואר?", type: "choice", student_response: favHeb }
    ];

    // שליחה ל-SCORM וסימון כהושלם
    sendInteractionsBatchToLMS(interactions);
    setCompletedStatusOnly();

    // הצגת הודעת הצלחה והסתרת הטופס
    form.hidden = true;
    if (overlay) {
      overlay.hidden = false;
      overlay.focus();
    }

    if (submitBtn) submitBtn.disabled = true;

    // שמירה וסגירת SCORM בסיום
    setTimeout(function () {
      if (isScormConnected) {
        pipwerks.SCORM.save();
        pipwerks.SCORM.quit();
      }
    }, 800);
  });

  // מסמן שדה כשגוי ומציג הודעה מתחתיו
  function showError(inputEl, errorEl, message) {
    if (inputEl) {
      inputEl.classList.add("is-invalid");
      inputEl.setAttribute("aria-invalid", "true");
    }
    if (errorEl) errorEl.textContent = message;
  }

  // מנקה מצב שגיאה משדה והודעת טקסט
  function clearError(inputEl, errorEl) {
    if (inputEl) {
      inputEl.classList.remove("is-invalid");
      inputEl.removeAttribute("aria-invalid");
    }
    if (errorEl) errorEl.textContent = "";
  }

  // מחזיר ערך של רדיו מסומן מתוך NodeList
  function getSelectedRadioValue(nodeList) {
    for (var i = 0; i < nodeList.length; i++) {
      if (nodeList[i].checked) return nodeList[i].value;
    }
    return null;
  }

  /* =========================================================
     Custom dropdown multiple
     ========================================================= */

  function initProjectTypeDropdown() {
    var dd = document.getElementById("projectTypeDD");
    var btn = document.getElementById("projectTypeBtn");
    var menu = document.getElementById("projectTypeMenu");
    var out = document.getElementById("projectType");
    var vals = document.getElementById("projectTypeValues");
    if (!dd || !btn || !menu || !out || !vals) return;

    // פתיחה/סגירה של הדרופדאון + עדכון aria-expanded
    function openClose(force) {
      var isOpen = dd.classList.contains("open");
      var next = typeof force === "boolean" ? force : !isOpen;
      dd.classList.toggle("open", next);
      btn.setAttribute("aria-expanded", next ? "true" : "false");
    }

    // קריאה/כתיבה של הבחירות מתוך ה-hidden input
    function getArr() {
      var v = (out.value || "").trim();
      if (v === "") return [];
      return v.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
    }

    function setArr(arr) {
      out.value = arr.join(",");
    }

    // רינדור הצ'יפים וסימון אופציות נבחרות בתפריט
    function render() {
      var selected = getArr();
      vals.innerHTML = "";

      for (var i = 0; i < selected.length; i++) {
        var opt = menu.querySelector('.custom-dd-option[data-value="' + selected[i] + '"]');
        var chip = document.createElement("span");
        chip.className = "custom-dd-chip";
        chip.textContent = opt ? opt.textContent.trim() : selected[i];
        vals.appendChild(chip);
      }

      dd.classList.toggle("has-values", selected.length > 0);

      var options = menu.querySelectorAll(".custom-dd-option");
      for (var j = 0; j < options.length; j++) {
        var val = options[j].getAttribute("data-value");
        options[j].classList.toggle("is-selected", selected.indexOf(val) !== -1);
      }
    }

    // קליק על הכפתור: פתיחה/סגירה
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      openClose();
    });

    // קליק על אופציה: הוספה/הסרה מהבחירה (multi select)
    menu.addEventListener("click", function (e) {
      var target = e.target;
      while (target && target !== menu && !target.classList.contains("custom-dd-option")) {
        target = target.parentNode;
      }
      if (!target || target === menu) return;

      var value = target.getAttribute("data-value");
      var selected = getArr();
      var idx = selected.indexOf(value);

      if (idx === -1) selected.push(value);
      else selected.splice(idx, 1);

      setArr(selected);
      render();
    });

    // קליק מחוץ לדרופדאון: סגירה
    document.addEventListener("click", function (e) {
      if (!dd.contains(e.target)) openClose(false);
    });

    // Escape: סגירה
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") openClose(false);
    });

    render();
  }
}

/* =========================================================
   לפני יציאה מהעמוד
   ========================================================= */

// במערכות LMS מסוימות, סגירה אוטומטית ב-beforeunload גורמת לבעיות שמירה.
// לכן זה נשאר כבוי, ומבצעים save/quit רק לאחר שליחת הטופס.

// window.addEventListener("beforeunload", function () {
//   if (!isScormConnected) return;
//   pipwerks.SCORM.save();
//   pipwerks.SCORM.quit();
// });
