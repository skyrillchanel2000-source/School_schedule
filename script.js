// =========================
// КОНФИГУРАЦИЯ
// =========================
const API_URL = "https://script.google.com/macros/s/AKfycbyKduchCK3MbOG8osJs04pxD4cSWD4t-IS9gbETtskvOjwJMi1jLMdAl1r8JwOd0cI0sA/exec";

// =========================
// СОСТОЯНИЕ
// =========================
let items = []; // {subject, class, fact, plan}
let schedules = {
  permanent: null,
  current: null,
  next: null,
  archive: []
};
let currentMode = "current"; // permanent | current | next
let currentSchedule = null;

let lockedHighlight = null; // {subject, class} | null
let currentDayFilter = "all"; // all | 0..5
let currentClassFilter = "";

let hasItemsChanges = false;
let hasScheduleChanges = false;

// =========================
// ИНИЦИАЛИЗАЦИЯ
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  renderItemsList();
  renderSchedule();
  renderClassFilter();
  setupEvents();
});

async function loadData() {
  const res = await fetch(API_URL);
  const data = await res.json();
  items = data.items || [];
  schedules = data.schedules || { permanent: null, current: null, next: null, archive: [] };
  currentSchedule = schedules[currentMode] || schedules.current;
}

// =========================
// ОТРИСОВКА: предметы
// =========================
function renderItemsList() {
  const list = document.getElementById("itemsList");
  list.innerHTML = "";

  const uniqueSubjects = ["Русский", "Литература"];
  const customSubjects = [...new Set(items.map(i => i.subject).filter(s => s && !["Русский", "Литература"].includes(s)))];
  const allSubjects = [...uniqueSubjects, ...customSubjects];

  const uniqueClasses = [...new Set(items.map(i => i.class).filter(c => !!c))];

  items.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "subject-row";
    const color = getSubjectColor(item.subject);
    row.style.setProperty("--row-color", color);
    row.style.background = `linear-gradient(90deg, ${color}, ${color}dd)`;
    row.style.borderColor = color;

    // Иконка мусорки
    const trash = document.createElement("span");
    trash.className = "trash-icon";
    trash.textContent = "🗑";
    trash.title = "Удалить строку";
    trash.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("Удалить эту строку?")) {
        items.splice(idx, 1);
        hasItemsChanges = true;
        toggleSaveButtons();
        renderItemsList();
        recalcHours();
        renderSchedule();
      }
    });
    row.appendChild(trash);

      // Выбор предмета
      const subjectSelect = document.createElement("select");
      subjectSelect.style.flex = "1";
      subjectSelect.style.border = "none";
      subjectSelect.style.background = "transparent";
      subjectSelect.style.fontFamily = "inherit";
      
      // Базовые предметы
      const baseSubjects = ["Русский", "Литература"];
      // Все предметы из items
      const customSubjects = [...new Set(items.map(i => i.subject).filter(s => s && !baseSubjects.includes(s)))];
      const allSubjects = [...baseSubjects, ...customSubjects];
      
      allSubjects.forEach(subj => {
        const opt = document.createElement("option");
        opt.value = subj;
        opt.textContent = subj;
        subjectSelect.appendChild(opt);
      });
      
      // Опция "Свой предмет..."
      const ownOpt = document.createElement("option");
      ownOpt.value = "__own__";
      ownOpt.textContent = "Свой предмет...";
      subjectSelect.appendChild(ownOpt);
      
      subjectSelect.value = item.subject;
      
      subjectSelect.addEventListener("change", () => {
        if (subjectSelect.value === "__own__") {
          const val = prompt("Введите название предмета:");
          if (val && val.trim()) {
            item.subject = val.trim();
            // Пересоздаём список, чтобы новый предмет появился в options
            hasItemsChanges = true;
            toggleSaveButtons();
            recalcHours();
            renderItemsList();
            renderSchedule();
            renderClassFilter();
          } else {
            // Возвращаем старое значение
            subjectSelect.value = item.subject;
          }
        } else {
          item.subject = subjectSelect.value;
          hasItemsChanges = true;
          toggleSaveButtons();
          recalcHours();
          renderItemsList();
          renderSchedule();
          renderClassFilter();
        }
      });
      
      row.appendChild(subjectSelect);

      // Выбор класса
      const classSelect = document.createElement("select");
      classSelect.style.flex = "1";
      classSelect.style.border = "none";
      classSelect.style.background = "transparent";
      classSelect.style.fontFamily = "inherit";
      
      // Все классы из items
      const allClasses = [...new Set(items.map(i => i.class).filter(c => !!c))];
      
      allClasses.forEach(cls => {
        const opt = document.createElement("option");
        opt.value = cls;
        opt.textContent = cls;
        classSelect.appendChild(opt);
      });
      
      // Опция "Свой класс..."
      const ownClassOpt = document.createElement("option");
      ownClassOpt.value = "__own__";
      ownClassOpt.textContent = "Свой класс...";
      classSelect.appendChild(ownClassOpt);
      
      classSelect.value = item.class || "";
      
      classSelect.addEventListener("change", () => {
        if (classSelect.value === "__own__") {
          const val = prompt("Введите название класса:");
          if (val && val.trim()) {
            item.class = val.trim();
            hasItemsChanges = true;
            toggleSaveButtons();
            recalcHours();
            renderItemsList();
            renderSchedule();
            renderClassFilter();
          } else {
            classSelect.value = item.class;
          }
        } else {
          item.class = classSelect.value;
          hasItemsChanges = true;
          toggleSaveButtons();
          recalcHours();
          renderSchedule();
          renderClassFilter();
        }
      });
      
      row.appendChild(classSelect);

    // Часы
    const hoursSpan = document.createElement("span");
    hoursSpan.className = "hours";
    hoursSpan.textContent = `${item.fact || 0}/${item.plan || 0}`;
    row.appendChild(hoursSpan);

    // Подсветка при наведении
    row.addEventListener("mouseenter", () => {
      if (!lockedHighlight) {
        highlightSubject(item.subject, item.class);
      }
    });
    row.addEventListener("mouseleave", () => {
      if (!lockedHighlight) {
        clearHighlight();
      }
    });
    row.addEventListener("click", () => {
      lockedHighlight = { subject: item.subject, class: item.class };
      highlightSubject(item.subject, item.class);
    });

    list.appendChild(row);
  });
}

function getSubjectColor(subject) {
  if (subject === "Русский") return "var(--ru-color)";
  if (subject === "Литература") return "var(--lit-color)";
  return "var(--custom-color)";
}

// =========================
// ОТРИСОВКА: расписание
// =========================
function renderSchedule() {
  const wrapper = document.getElementById("scheduleWrapper");
  wrapper.innerHTML = "";

  if (!currentSchedule) return;

  const grid = document.createElement("div");
  grid.className = "schedule-grid";

  // Заголовки
  const emptyHeader = document.createElement("div");
  emptyHeader.className = "grid-header";
  emptyHeader.textContent = "Урок";
  grid.appendChild(emptyHeader);

  const days = currentSchedule.days || [];
  for (let d = 0; d < 6; d++) {
    const h = document.createElement("div");
    h.className = "grid-header";
    h.textContent = days[d] || "";
    if (currentDayFilter !== "all" && currentDayFilter != String(d)) {
      h.style.opacity = 0.5;
    }
    grid.appendChild(h);
  }

  // Строки уроков
  const lessons = currentSchedule.lessons || [];
  const times = [
    "8:00–8:30",
    "8:30–9:10",
    "9:20–10:00",
    "10:10–10:50",
    "11:10–11:50",
    "11:55–12:35",
    "12:45–13:25",
    "13:30–14:10",
    "14:15–14:55",
    "15:00–15:40",
    "15:45–16:25"
  ];

  for (let r = 0; r < 11; r++) {
    // Номер урока + время
    const lessonCell = document.createElement("div");
    lessonCell.className = "grid-cell";
    lessonCell.style.fontWeight = "bold";
    lessonCell.textContent = `${r} (${times[r]})`;
    grid.appendChild(lessonCell);

    // Ячейки дней
    const rowLessons = lessons[r] || [];
    for (let d = 0; d < 6; d++) {
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      cell.dataset.day = d;

      if (currentDayFilter !== "all" && currentDayFilter != String(d)) {
        cell.style.opacity = 0.4;
      }

      const select = document.createElement("select");
      // Формируем список вариантов
      const emptyOpt = document.createElement("option");
      emptyOpt.value = "";
      emptyOpt.textContent = "—";
      select.appendChild(emptyOpt);

      items.forEach(it => {
        const label = `${it.subject} ${it.class}`;
        const opt = document.createElement("option");
        opt.value = label;
        opt.textContent = label;
        select.appendChild(opt);
      });

      const currentValue = rowLessons[d] || "";
      select.value = currentValue;

      select.addEventListener("change", () => {
        lessons[r][d] = select.value;
        hasScheduleChanges = true;
        toggleSaveButtons();
        recalcHours();
        renderItemsList();
        applyClassFilter();
      });

      // Подсветка
      select.addEventListener("mouseenter", () => {
        const val = select.value;
        if (!val) return;
        const [subj, ...clsParts] = val.split(" ");
        const cls = clsParts.join(" ");
        if (!lockedHighlight) {
          highlightSubject(subj, cls);
        }
      });
      select.addEventListener("mouseleave", () => {
        if (!lockedHighlight) {
          clearHighlight();
        }
      });
      select.addEventListener("click", () => {
        const val = select.value;
        if (!val) {
          lockedHighlight = null;
          clearHighlight();
          return;
        }
        const [subj, ...clsParts] = val.split(" ");
        const cls = clsParts.join(" ");
        lockedHighlight = { subject: subj, class: cls };
        highlightSubject(subj, cls);
      });

      cell.appendChild(select);
      grid.appendChild(cell);
    }
  }

  // Клик вне ячеек снимает подсветку
  grid.addEventListener("click", (e) => {
    if (e.target === grid) {
      lockedHighlight = null;
      clearHighlight();
    }
  });

  wrapper.appendChild(grid);
}

function highlightSubject(subject, cls) {
  clearHighlight();
  const label = `${subject} ${cls}`;
  // Подсветка ячеек
  const selects = document.querySelectorAll(".schedule-grid .grid-cell select");
  selects.forEach(sel => {
    if (sel.value === label) {
      sel.parentElement.classList.add("highlight");
    }
  });
  // Подсветка строки в панели
  const rows = document.querySelectorAll(".subject-row");
  rows.forEach(row => {
    const selects = row.querySelectorAll("select");
    const subjVal = selects[0].value;
    const clsVal = selects[1].value;
    if (subjVal === subject && clsVal === cls) {
      row.classList.add("highlight");
    }
  });
}

function clearHighlight() {
  document.querySelectorAll(".highlight").forEach(el => el.classList.remove("highlight"));
  document.querySelectorAll(".highlight-locked").forEach(el => el.classList.remove("highlight-locked"));
  if (lockedHighlight) {
    highlightSubject(lockedHighlight.subject, lockedHighlight.class);
    document.querySelectorAll(".highlight").forEach(el => {
      el.classList.add("highlight-locked");
      el.classList.remove("highlight");
    });
  }
}

// =========================
// Фильтры
// =========================
function renderClassFilter() {
  const select = document.getElementById("classFilter");
  const currentVal = select.value;
  select.innerHTML = '<option value="">Все</option>';
  const uniqueClasses = [...new Set(items.map(i => i.class).filter(c => !!c))];
  uniqueClasses.forEach(cls => {
    const opt = document.createElement("option");
    opt.value = cls;
    opt.textContent = cls;
    select.appendChild(opt);
  });
  select.value = currentVal;
  applyClassFilter();
}

function applyClassFilter() {
  const select = document.getElementById("classFilter");
  currentClassFilter = select.value;

  const cells = document.querySelectorAll(".schedule-grid .grid-cell select");
  cells.forEach(sel => {
    const val = sel.value;
    if (!val) {
      sel.parentElement.style.opacity = currentClassFilter ? 0.4 : 1;
      return;
    }
    const parts = val.split(" ");
    const cls = parts.slice(1).join(" ");
    if (currentClassFilter && cls !== currentClassFilter) {
      sel.parentElement.style.opacity = 0.4;
    } else {
      sel.parentElement.style.opacity = 1;
    }
  });

  // Считаем часы для выбранного класса
  calcClassHours();
}

function calcClassHours() {
  const cls = currentClassFilter;
  const info = document.getElementById("classHoursInfo");
  if (!cls) {
    info.textContent = "";
    return;
  }
  let count = 0;
  const lessons = currentSchedule.lessons || [];
  for (let r = 0; r < lessons.length; r++) {
    for (let d = 0; d < 6; d++) {
      const val = lessons[r][d] || "";
      if (!val) continue;
      const parts = val.split(" ");
      const c = parts.slice(1).join(" ");
      if (c === cls) count++;
    }
  }
  info.textContent = `Фактические часы для класса ${cls}: ${count}`;
}

// =========================
// Пересчёт часов
// =========================
function recalcHours() {
  // План — по permanent, факт — по current
  const perm = schedules.permanent;
  const curr = schedules.current;

  items.forEach(it => {
    const label = `${it.subject} ${it.class}`;
    let planCount = 0;
    let factCount = 0;

    if (perm && perm.lessons) {
      for (let r = 0; r < 11; r++) {
        for (let d = 0; d < 6; d++) {
          if (perm.lessons[r][d] === label) planCount++;
        }
      }
    }
    if (curr && curr.lessons) {
      for (let r = 0; r < 11; r++) {
        for (let d = 0; d < 6; d++) {
          if (curr.lessons[r][d] === label) factCount++;
        }
      }
    }

    it.plan = planCount;
    it.fact = factCount;
  });
}

// =========================
// События интерфейса
// =========================
function setupEvents() {
  // Меню на мобильном
  const menuToggle = document.getElementById("menuToggle");
  const sidePanel = document.getElementById("sidePanel");
  const closePanel = document.getElementById("closePanel");

  menuToggle.addEventListener("click", () => {
    sidePanel.classList.add("open");
  });
  closePanel.addEventListener("click", () => {
    sidePanel.classList.remove("open");
  });

  // Режим расписания
  const modeSelect = document.getElementById("scheduleMode");
  modeSelect.addEventListener("change", () => {
    currentMode = modeSelect.value;
    currentSchedule = schedules[currentMode];
    renderSchedule();
    recalcHours();
    renderItemsList();
  });

  // Сброс фактического к постоянному
  document.getElementById("resetBtn").addEventListener("click", async () => {
    if (!confirm("Сбросить фактическое расписание к постоянному?")) return;
    await sendAction("resetCurrentToPermanent");
    await loadData();
    currentSchedule = schedules.current;
    renderSchedule();
    recalcHours();
    renderItemsList();
    hasScheduleChanges = false;
    toggleSaveButtons();
  });

  // Новая неделя
  document.getElementById("newWeekBtn").addEventListener("click", async () => {
    if (!confirm("Начать новую неделю? Текущее уйдёт в архив, следующее станет фактическим.")) return;
    await sendAction("startNewWeek");
    await loadData();
    currentSchedule = schedules.current;
    renderSchedule();
    recalcHours();
    renderItemsList();
    hasScheduleChanges = false;
    toggleSaveButtons();
  });

  // Фильтр по дню
  document.querySelectorAll(".day-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".day-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentDayFilter = btn.dataset.day;
      renderSchedule();
    });
  });

  // Фильтр по классу
  document.getElementById("classFilter").addEventListener("change", applyClassFilter);

  // Добавление строки
  document.getElementById("addItemBtn").addEventListener("click", () => {
    items.push({ subject: "Русский", class: "", fact: 0, plan: 0 });
    hasItemsChanges = true;
    toggleSaveButtons();
    renderItemsList();
    renderClassFilter();
  });

  // Кнопки сохранения
  document.getElementById("saveTopBtn").addEventListener("click", saveAll);
  document.getElementById("saveSideBtn").addEventListener("click", saveAll);
}

function toggleSaveButtons() {
  const show = hasItemsChanges || hasScheduleChanges;
  document.getElementById("saveTopBtn").style.display = show ? "inline-block" : "none";
  document.getElementById("saveSideBtn").style.display = show ? "inline-block" : "none";
}

async function sendAction(action) {
  await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action })
  });
}

async function saveAll() {
  // Обновляем часы перед отправкой
  recalcHours();

  const payload = {
    action: "saveAll",
    items: items,
    schedules: {
      permanent: schedules.permanent,
      current: schedules.current,
      next: schedules.next
    }
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await res.json();
  if (result.status === "ok") {
    hasItemsChanges = false;
    hasScheduleChanges = false;
    toggleSaveButtons();
    alert("Сохранено!");
  } else {
    alert("Ошибка сохранения: " + (result.error || "неизвестная"));
  }
}
