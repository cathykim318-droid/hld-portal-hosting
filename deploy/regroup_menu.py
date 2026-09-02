import re
p = "public/staff/index.html"
s = open(p, encoding="utf-8").read()
s = re.sub(r'(\./css/style\.css\?v=)[^"]*', r'\g<1>20260831-redesign-navy', s)
s = re.sub(r'(dashboard\.js\?v=)[^"]*', r'\g<1>20260901-today', s)
start = s.index('<div class="sidebar-menu">')
logout = s.index('onclick="logout()"', start)
close = s.rindex('</div>', start, logout) + len('</div>')
grouped = """<div class="sidebar-menu">
        <div class="menu-group">Front Desk</div>
        <div class="menu-item active" onclick="switchOsView(event, 'dashboard', 'Tasks')">
          <i class="fa-solid fa-list-check"></i> Tasks
        </div>
        <div class="menu-item" onclick="switchOsView(event, 'schedule', 'Office Schedule & Appointments')">
          <i class="fa-solid fa-calendar-days"></i> Schedule
        </div>
        <div class="menu-item" onclick="switchOsView(event, 'patients', 'Patient Management')">
          <i class="fa-solid fa-users"></i> Patients
        </div>
        <div class="menu-item" onclick="switchOsView(event, 'forms', 'Forms Center')">
          <i class="fa-solid fa-file-signature"></i> Forms Center
        </div>
        <div class="menu-item" onclick="window.open('http://127.0.0.1:8787','_blank')" title="Insurance eligibility verification (opens the front-desk tool)">
          <i class="fa-solid fa-shield-halved"></i> Insurance Verify
        </div>

        <div class="menu-group">Follow-ups</div>
        <button class="menu-item" type="button" onclick="switchOsView(event, 'call-list', 'Patient Call List')">
          <i class="fa-solid fa-phone-volume"></i> Call List
        </button>
        <button class="menu-item" type="button" onclick="switchOsView(event, 'pre-auth', 'Notice of Authorization')">
          <i class="fa-solid fa-file-shield"></i> NOA
        </button>
        <button class="menu-item" type="button" onclick="switchOsView(event, 'lab-cases', 'Lab Case Tracking & Follow-up')">
          <i class="fa-solid fa-teeth"></i> Lab Cases
        </button>

        <div class="menu-group">Clinical &amp; Billing</div>
        <div class="menu-item" onclick="switchOsView(event, 'photos', 'Ortho Photos')">
          <i class="fa-solid fa-camera-retro"></i> Photos
        </div>
        <div class="menu-item" onclick="switchOsView(event, 'treatment-plan', 'Treatment Plan')">
          <i class="fa-solid fa-clipboard-list"></i> Treatment Plan
        </div>
        <div class="menu-item" onclick="switchOsView(event, 'payplan', 'Payment Plan')">
          <i class="fa-solid fa-credit-card"></i> Payment Plan
        </div>

        <div class="menu-item" onclick="switchOsView(event, 'settings', 'Settings')" style="margin-top: 10px;">
          <i class="fa-solid fa-gear"></i> Settings
        </div>
      </div>"""
s = s[:start] + grouped + s[close:]
open(p, "w", encoding="utf-8").write(s)
print("regrouped: menu-group=%d, Insurance Verify=%s" % (s.count('menu-group'), 'Insurance Verify' in s))
