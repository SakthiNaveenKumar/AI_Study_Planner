let tasks = [];
try {
  tasks = JSON.parse(localStorage.getItem("tasks")) || [];
} catch (e) {
  tasks = [];
}

const $ = id => document.getElementById(id);
const DAY = 86400000;

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDaysLeft(deadline) {
  if (!deadline) return 1;
  const diff = new Date(deadline + "T00:00:00") - startOfToday();
  return Math.max(1, Math.ceil(diff / DAY));
}

function getScore(t) {
  const d = getDaysLeft(t.deadline);
  const urgency = d <= 1 ? 10 : d <= 3 ? 7 : d <= 7 ? 4 : 1;
  return Number(t.priority) * 3 + Number(t.difficulty) * 2 + urgency;
}

function saveTasks() {
  try {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  } catch (e) {
    console.error("Failed to save tasks to localStorage:", e);
  }
}

function validateForm() {
  const v = {
    subject: $("subject").value.trim(),
    title: $("title").value.trim(),
    deadline: $("deadline").value,
    hours: Number($("hours").value),
    priority: $("priority").value,
    difficulty: $("difficulty").value
  };

  const msg = {
    Subject: v.subject ? "" : "Subject is required",
    Title: v.title ? "" : "Task title is required",
    Deadline: !v.deadline
      ? "Select a deadline"
      : new Date(v.deadline + "T00:00:00") < startOfToday()
      ? "Deadline cannot be in the past"
      : "",
    Hours: v.hours >= 1 && v.hours <= 100 ? "" : "Enter hours between 1 and 100",
    Priority: v.priority ? "" : "Select priority",
    Difficulty: v.difficulty ? "" : "Select difficulty"
  };

  let ok = true;
  for (const k in msg) {
    const errEl = $("e" + k);
    if (errEl) {
      errEl.textContent = msg[k];
    }
    if (msg[k]) ok = false;
  }

  return ok ? v : null;
}

function addTask() {
  const v = validateForm();
  if (!v) return;

  tasks.push({
    id: Date.now(),
    subject: v.subject,
    title: v.title,
    deadline: v.deadline,
    hours: v.hours,
    priority: Number(v.priority),
    difficulty: Number(v.difficulty),
    done: false
  });

  saveTasks();

  ["subject", "title", "deadline", "hours", "priority", "difficulty"].forEach(i => {
    $(i).value = "";
    const errEl = $("e" + i.charAt(0).toUpperCase() + i.slice(1));
    if (errEl) errEl.textContent = "";
  });

  render();
}

function toggleDone(id) {
  const t = tasks.find(x => x.id === id);
  if (t) {
    t.done = !t.done;
    saveTasks();
    render();
  }
}

function deleteTask(id) {
  tasks = tasks.filter(x => x.id !== id);
  saveTasks();
  render();
}

// Make functions accessible from inline HTML event listeners
window.toggleDone = toggleDone;
window.deleteTask = deleteTask;

function renderTasks() {
  const q = $("search").value.toLowerCase();
  const f = $("filter").value;

  let list = tasks.filter(t => {
    const matchesQuery = (t.subject + " " + t.title).toLowerCase().includes(q);
    const matchesFilter = f === "all" || (f === "done" && t.done) || (f === "pending" && !t.done);
    return matchesQuery && matchesFilter;
  });

  list.sort($("sort").value === "date"
    ? (a, b) => new Date(a.deadline) - new Date(b.deadline)
    : (a, b) => getScore(b) - getScore(a)
  );

  $("taskList").innerHTML = list.length ? "" : "<p class='meta'>No tasks to display.</p>";

  list.forEach(t => {
    const d = getDaysLeft(t.deadline);
    const cls = t.done ? "d" : d <= 1 ? "r" : d <= 3 ? "a" : "";
    const div = document.createElement("div");
    div.className = "task " + cls;
    div.innerHTML = `
      <div>
        <span class="badge">Score ${getScore(t)}</span>
        <span class="name">${escapeHTML(t.subject)}: ${escapeHTML(t.title)}</span>
        <div class="meta">Due ${t.deadline} (${d} day${d > 1 ? "s" : ""}) | ${t.hours} h | ${(t.hours / d).toFixed(1)} h/day</div>
      </div>
      <div class="acts">
        <button type="button" onclick="toggleDone(${t.id})">${t.done ? "Undo" : "Complete"}</button>
        <button type="button" class="del" onclick="deleteTask(${t.id})">Delete</button>
      </div>
    `;
    $("taskList").appendChild(div);
  });
}

function updateCards() {
  const done = tasks.filter(t => t.done).length;
  const soon = tasks.filter(t => !t.done && getDaysLeft(t.deadline) <= 3).length;
  $("cTotal").textContent = tasks.length;
  $("cDone").textContent = done;
  $("cPending").textContent = tasks.length - done;
  $("cSoon").textContent = soon;

  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  $("barFill").style.width = pct + "%";
  $("barText").textContent = pct + "% completed";
}

function renderWeeklyPlan() {
  const days = [...Array(7).keys()].map(i => new Date(startOfToday().getTime() + i * DAY));

  $("planHead").innerHTML = "<tr><th>Task</th>" + days.map(d =>
    `<th>${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}</th>`
  ).join("") + "</tr>";

  const totals = Array(7).fill(0);
  let rows = "";

  const activeTasks = tasks.filter(t => !t.done);
  activeTasks.forEach(t => {
    const dl = getDaysLeft(t.deadline);
    const per = t.hours / dl;

    rows += `<tr><td>${escapeHTML(t.subject)}: ${escapeHTML(t.title)}</td>` + days.map((d, i) => {
      const h = i < dl ? per : 0;
      totals[i] += h;
      return `<td>${h ? h.toFixed(1) : "-"}</td>`;
    }).join("") + "</tr>";
  });

  if (activeTasks.length > 0) {
    rows += "<tr><td><b>Total</b></td>" + totals.map(h =>
      `<td><b>${h ? h.toFixed(1) : "-"}</b></td>`
    ).join("") + "</tr>";
  } else {
    rows = `<tr><td colspan="8" style="text-align: center; color: var(--muted); padding: 16px;">No pending tasks to schedule.</td></tr>`;
  }

  $("planBody").innerHTML = rows;
}

function render() {
  renderTasks();
  updateCards();
  renderWeeklyPlan();
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  const todayEl = $("today");
  if (todayEl) todayEl.textContent = new Date().toDateString();

  const addBtn = $("addBtn");
  if (addBtn) addBtn.addEventListener("click", addTask);

  ["search", "filter", "sort"].forEach(i => {
    const el = $(i);
    if (el) {
      el.addEventListener("input", renderTasks);
      el.addEventListener("change", renderTasks);
    }
  });

  const themeBtn = $("themeBtn");
  if (themeBtn) {
    // Restore saved theme
    if (localStorage.getItem("theme") === "dark") {
      document.body.classList.add("dark");
      themeBtn.textContent = "Light Mode";
    }

    themeBtn.addEventListener("click", () => {
      document.body.classList.toggle("dark");
      const isDark = document.body.classList.contains("dark");
      themeBtn.textContent = isDark ? "Light Mode" : "Dark Mode";
      localStorage.setItem("theme", isDark ? "dark" : "light");
    });
  }

  render();
});

// Initial run if already loaded
if (document.readyState === "complete" || document.readyState === "interactive") {
  const todayEl = $("today");
  if (todayEl && !todayEl.textContent) todayEl.textContent = new Date().toDateString();

  const addBtn = $("addBtn");
  if (addBtn && !addBtn.getAttribute("data-bound")) {
    addBtn.setAttribute("data-bound", "true");
    addBtn.addEventListener("click", addTask);

    ["search", "filter", "sort"].forEach(id => {
      const el = $(id);
      if (el) {
        el.addEventListener("input", renderTasks);
        el.addEventListener("change", renderTasks);
      }
    });

    const themeBtn = $("themeBtn");
    if (themeBtn) {
      if (localStorage.getItem("theme") === "dark") {
        document.body.classList.add("dark");
        themeBtn.textContent = "Light Mode";
      }
      themeBtn.addEventListener("click", () => {
        document.body.classList.toggle("dark");
        const isDark = document.body.classList.contains("dark");
        themeBtn.textContent = isDark ? "Light Mode" : "Dark Mode";
        localStorage.setItem("theme", isDark ? "dark" : "light");
      });
    }

    render();
  }
}
