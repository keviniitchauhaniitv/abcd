/* ========= App State & Storage ========= */
const STORAGE_KEY = "nexgen_students_v1";
let students = [];
let historyStack = [];
let qrScanner = null;
let lastScanTimestamps = {};
let attendanceChart = null;

/* ========= Local Storage ========= */
function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { students = JSON.parse(raw); }
    catch (e) { students = []; }
  }
}
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}
loadFromStorage();

/* ========= Navigation ========= */
function showPage(id, replace = false) {
  document.querySelectorAll(".container").forEach(c => c.classList.remove("active"));
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("active");

  if (!replace) {
    const top = historyStack[historyStack.length - 1];
    if (top !== id) historyStack.push(id);
  }

  if (id === "allStudents") renderStudentsTable();
  if (id === "markAttendance") {
    switchTab("qrTab");
    renderManualTable();
  }
  if (id === "absentStudents") renderAbsentList();
  if (id === "attendanceDashboard") drawAttendanceChart();
}
function goBack() {
  if (historyStack.length <= 1) {
    showPage('landing', true);
    historyStack = ['landing'];
    return;
  }
  historyStack.pop();
  const prev = historyStack[historyStack.length - 1] || 'landing';
  showPage(prev, true);
}
if (historyStack.length === 0) { historyStack = ['landing']; }
showPage('landing', true);

/* ========= Toast ========= */
function showToast(msg) {
  const c = document.getElementById("toastContainer");
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

/* ========= Simulated Auth ========= */
function handleSignup() { showToast("Registration successful"); showPage('login'); }
function handleLogin() { showToast("Login successful"); showPage('dashboard'); }
function sendOtp() { showToast("OTP sent"); }
function verifyOtp() { showToast("Teacher registered"); showPage('teacherLogin'); }
function sendTeacherOtp() { showToast("OTP sent to teacher"); }
function verifyLogin() { showToast("Teacher logged in"); showPage('teacherDashboard'); }

/* ========= Student Management ========= */
function saveStudent() {
  const name = document.getElementById("studentName").value.trim();
  const roll = document.getElementById("rollNo").value.trim();
  const father = document.getElementById("fatherName").value.trim();
  const contact = document.getElementById("contactNo").value.trim();

  if (!name || !roll) { showToast("Please enter Name and Roll"); return; }

  if (students.find(s => s.rollNo === roll)) {
    showToast("Roll number already exists");
    return;
  }

  const student = {
    name, rollNo: roll, father, contact,
    present: 0, total: 0, absentStreak: 0
  };
  students.push(student);
  saveToStorage();

  const qrPreview = document.getElementById("qrPreview");
  qrPreview.innerHTML = "";
  const canvas = document.createElement("canvas");
  QRCode.toCanvas(canvas, roll, { width: 120 }, function (err) {
    if (!err) qrPreview.appendChild(canvas);
  });

  document.getElementById("addStudentForm").style.display = "none";
  document.getElementById("savedStudentCard").style.display = "block";
  const det = document.getElementById("savedStudentDetails");
  det.innerHTML = `
    <p><strong>Name:</strong> ${student.name}</p>
    <p><strong>Roll No:</strong> ${student.rollNo}</p>
    <p><strong>Father:</strong> ${student.father || '—'}</p>
    <p><strong>Contact:</strong> ${student.contact || '—'}</p>
  `;
  showToast("Student saved");
  renderStudentsTable();
}
function prepareAddNext() {
  document.getElementById("addStudentForm").style.display = "block";
  document.getElementById("savedStudentCard").style.display = "none";
  document.getElementById("qrPreview").innerHTML = "";
  document.getElementById("studentName").value = "";
  document.getElementById("rollNo").value = "";
  document.getElementById("fatherName").value = "";
  document.getElementById("contactNo").value = "";
  document.getElementById("studentName").focus();
}
function uploadCSV() {
  const fileEl = document.getElementById("csvFile");
  const file = fileEl.files && fileEl.files[0];
  if (!file) { showToast("Select a CSV file"); return; }

  const reader = new FileReader();
  reader.onload = function (e) {
    const txt = e.target.result;
    const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    const startIndex = (/name/i.test(lines[0]) && /roll/i.test(lines[0])) ? 1 : 0;

    let added = 0;
    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(",").map(p => p.trim());
      if (parts.length >= 2) {
        const name = parts[0], roll = parts[1], father = parts[2] || "", contact = parts[3] || "";
        if (!students.find(s => s.rollNo === roll)) {
          students.push({ name, rollNo: roll, father, contact, present: 0, total: 0, absentStreak: 0 });
          added++;
        }
      }
    }
    saveToStorage();
    showToast(`CSV processed: ${added} new students`);
    renderStudentsTable();
    fileEl.value = null;
  };
  reader.readAsText(file);
}
function renderStudentsTable(filteredStudents = students) {
  const tbody = document.querySelector("#studentsTable tbody");
  tbody.innerHTML = "";
  filteredStudents.forEach(s => {
    const tr = document.createElement("tr");
    const qrCanvasId = "qr_" + s.rollNo;
    tr.innerHTML = `
      <td>${s.name}</td>
      <td>${s.rollNo}</td>
      <td>${s.father || '-'}</td>
      <td>${s.contact || '-'}</td>
      <td>
          <canvas id="${qrCanvasId}"></canvas>
          <br>
          <button onclick="downloadQRCode('${s.rollNo}')">Download QR</button>
      </td>
      <td><button class="delete-btn" onclick="deleteStudent('${s.rollNo}')">🗑️ Delete</button></td>
    `;
    tbody.appendChild(tr);
    const canvas = document.getElementById(qrCanvasId);
    if (canvas) QRCode.toCanvas(canvas, s.rollNo, { width: 64 }).catch(() => { });
  });
}
function deleteStudent(rollNo) {
  if (!confirm("Are you sure you want to delete this student?")) return;
  students = students.filter(s => s.rollNo !== rollNo);
  saveToStorage();
  showToast("Student deleted");
  renderStudentsTable();
}
function downloadQRCode(rollNo) {
  const canvas = document.getElementById("qr_" + rollNo);
  if (!canvas) {
    showToast("QR code not found");
    return;
  }

  const link = document.createElement("a");
  link.download = `QR_${rollNo}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

/* ========= Attendance ========= */
function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
  const el = document.getElementById(tabId);
  if (el) el.classList.remove("hidden");

  if (tabId === "qrTab") startQRScanner();
  else stopQRScanner();

  if (tabId === "manualTab") renderManualTable();
}
function renderManualTable() {
  const tbody = document.querySelector("#manualAttendanceTable tbody");
  tbody.innerHTML = "";
  students.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.name}</td>
      <td>${s.rollNo}</td>
      <td>
        <button class="btn-small" onclick="markAttendanceManual('${s.rollNo}', true)">Present</button>
        <button class="btn-small" onclick="markAttendanceManual('${s.rollNo}', false)">Absent</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
function markAttendance(rollNo, isPresent, source = "Manual") {
  const s = students.find(x => x.rollNo === rollNo);
  if (!s) { showToast("Student not found: " + rollNo); return; }

  s.total = (s.total || 0) + 1;
  if (isPresent) { s.present = (s.present || 0) + 1; s.absentStreak = 0; }
  else { s.absentStreak = (s.absentStreak || 0) + 1; }

  saveToStorage();
  showToast(`${s.name} marked ${isPresent ? "Present" : "Absent"} (${source})`);
  renderManualTable();
  renderStudentsTable();
}
function markAttendanceManual(rollNo, present) {
  markAttendance(rollNo, present, "Manual");
}
function startQRScanner() {
  stopQRScanner();
  const qrRegionId = "qr-reader";
  const html5Qr = new Html5Qrcode(qrRegionId);
  qrScanner = html5Qr;

  const config = {
    fps: 8,
    qrbox: { width: 200, height: 200 }
  };
  html5Qr.start(
    { facingMode: "environment" },
    config,
    decodedText => {
      const now = Date.now();
      if (lastScanTimestamps[decodedText] && (now - lastScanTimestamps[decodedText] < 3000)) {
        return;
      }
      lastScanTimestamps[decodedText] = now;

      if (students.find(s => s.rollNo === decodedText)) {
        markAttendance(decodedText, true, "QR");
        document.getElementById("scanResult").textContent = `Scanned: ${decodedText}`;
      } else {
        document.getElementById("scanResult").textContent = `Scanned code not found: ${decodedText}`;
        showToast("Scanned roll not found");
      }
    },
    error => { }
  ).catch(err => {
    console.error("QR start failed:", err);
    showToast("Camera start failed or no camera available");
  });
}
function stopQRScanner() {
  if (qrScanner) {
    qrScanner.stop().then(() => {
      qrScanner.clear();
      qrScanner = null;
      document.getElementById("scanResult").textContent = "Scanner stopped";
    }).catch(err => {
      qrScanner = null;
      document.getElementById("scanResult").textContent = "Scanner stopped (error)";
    });
  }
}

/* ========= Absentee Alert ========= */
function renderAbsentList() {
  const list = document.getElementById("absentList");
  list.innerHTML = "";
  students.forEach(s => {
    if ((s.absentStreak || 0) >= 3) {
      const li = document.createElement("li");
      li.style.marginBottom = "10px";
      li.innerHTML = `
        <div><strong>${s.name} (Roll ${s.rollNo})</strong></div>
        <div>Father: ${s.father || '-'} | Contact: ${s.contact || '-'}</div>
      `;
      const btn = document.createElement("button");
      btn.textContent = "Alert Parent";
      btn.onclick = () => {
        showToast(`WhatsApp message simulated to ${s.contact || 'parent'}`);
      };
      li.appendChild(btn);
      list.appendChild(li);
    }
  });
  if (!list.hasChildNodes()) {
    list.innerHTML = "<em>No students currently with 3+ consecutive absences.</em>";
  }
}

/* ========= Attendance Dashboard ========= */

// Render Today's Attendance Pie Chart
function renderTodayAttendancePieChart() {
  const presentCount = students.filter(s => s.present > 0).length;
  const absentCount = students.length - presentCount;

  const ctx1 = document.getElementById("todayAttendancePieChart").getContext("2d");
  new Chart(ctx1, {
    type: 'pie',
    data: {
      labels: ['Present', 'Absent'],
      datasets: [{
        data: [presentCount, absentCount],
        backgroundColor: ['#4CAF50', '#e53935'],
        hoverBackgroundColor: ['#45a049', '#c62828'],
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
      },
    }
  });
}

// Render Attendance Comparison Bar Chart (Weekly/Monthly)
function renderAttendanceComparisonBarChart(period) {
  const labels = [];
  const present = [];
  const absent = [];
  
  // Simulating data for weekly or monthly periods
  if (period === "weekly") {
    // Assume we have data for the last 7 days
    for (let i = 0; i < 7; i++) {
      labels.push("Day " + (i + 1));
      present.push(Math.floor(Math.random() * 20));  // Simulate present data
      absent.push(Math.floor(Math.random() * 20));   // Simulate absent data
    }
  } else if (period === "monthly") {
    // Assume we have data for the last 30 days
    for (let i = 0; i < 30; i++) {
      labels.push("Day " + (i + 1));
      present.push(Math.floor(Math.random() * 10));  // Simulate present data
      absent.push(Math.floor(Math.random() * 10));   // Simulate absent data
    }
  } else {
    // Default to today's data
    labels.push("Today");
    present.push(students.filter(s => s.present > 0).length);
    absent.push(students.length - present[0]);
  }

  const ctx2 = document.getElementById("attendanceComparisonBarChart").getContext("2d");
  new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Present',
          data: present,
          backgroundColor: '#4CAF50',
          hoverBackgroundColor: '#45a049',
        },
        {
          label: 'Absent',
          data: absent,
          backgroundColor: '#e53935',
          hoverBackgroundColor: '#c62828',
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        x: {
          ticks: {
            autoSkip: true,
            maxRotation: 45,
            minRotation: 30
          }
        },
        y: {
          beginAtZero: true
        }
      },
      plugins: {
        legend: { position: 'top' },
      }
    }
  });
}

// Handle filter change for Weekly/Monthly analysis
document.getElementById("attendanceFilter").addEventListener("change", function () {
  const selectedFilter = this.value;

  if (selectedFilter === "weekly") {
    renderAttendanceComparisonBarChart("weekly");
    console.log("Showing Weekly Attendance");
  } else if (selectedFilter === "monthly") {
    renderAttendanceComparisonBarChart("monthly");
    console.log("Showing Monthly Attendance");
  } else {
    renderAttendanceComparisonBarChart("today");
    console.log("Showing Today's Attendance");
  }
});

// Initial function calls
document.addEventListener("DOMContentLoaded", () => {
  renderTodayAttendancePieChart();
  renderAttendanceComparisonBarChart("today");
});




/* ========= Load Hook ========= */
window.addEventListener("load", () => {
  historyStack = ['landing'];
  showPage('landing', true);
});
