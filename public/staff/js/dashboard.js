let tasksDashboardState = {
    loading: false,
    data: null,
    aiDrafts: {},
    openActions: {}
};

function escapeTasksHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function formatTasksDate(value) {
    if (!value) return 'NA';
    const raw = String(value).slice(0, 10);
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[2]}/${match[3]}/${match[1]}` : raw;
}

function formatTasksDateTime(value) {
    if (!value) return '';
    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return formatTasksDate(value);
    return date.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function getTaskToneClass(tone = '') {
    const normalized = String(tone || '').toLowerCase();
    if (normalized === 'danger') return 'danger';
    if (normalized === 'success') return 'success';
    if (normalized === 'info') return 'info';
    return 'warn';
}

async function getTasksStaffToken() {
    if (typeof getStaffIdToken === 'function') return getStaffIdToken();
    if (window.auth?.currentUser) return window.auth.currentUser.getIdToken();
    if (typeof auth !== 'undefined' && auth.currentUser) return auth.currentUser.getIdToken();
    throw new Error('Please sign in to continue.');
}

function renderTaskStatusChip(label = '', tone = '') {
    const chipClass = getTaskToneClass(tone);
    return `<span class="tasks-chip ${chipClass}">${escapeTasksHtml(label || 'NA')}</span>`;
}

function encodeTasksPayload(value) {
    return encodeURIComponent(JSON.stringify(value || {}));
}

function decodeTasksPayload(value = '') {
    try {
        return JSON.parse(decodeURIComponent(String(value || '')));
    } catch (_) {
        return {};
    }
}

function getTaskRowId(row = {}) {
    return String(row.id || row.aptNum || `${row.patient?.patNum || ''}-${row.aptDateTime || row.date || ''}`);
}

function getTaskActionKey(row = {}, action = '') {
    return `${getTaskRowId(row)}::${String(action || 'action')}`;
}

function rememberTasksActionOpen(encodedRow = '', action = '', isOpen = false) {
    const row = decodeTasksPayload(encodedRow);
    const key = getTaskActionKey(row, action);
    if (!key) return;
    if (isOpen) {
        tasksDashboardState.openActions[key] = true;
    } else {
        delete tasksDashboardState.openActions[key];
    }
}

function taskActionIsOpen(row = {}, action = '') {
    return !!tasksDashboardState.openActions[getTaskActionKey(row, action)];
}

function getTasksPatientPayload(row = {}) {
    const patient = row.patient || {};
    const nameParts = String(patient.name || '').trim().split(/\s+/).filter(Boolean);
    const firstName = patient.firstName || nameParts[0] || '';
    const lastName = patient.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
    return {
        id: patient.patNum || row.patNum || '',
        PatNum: patient.patNum || row.patNum || '',
        patNum: patient.patNum || row.patNum || '',
        firstName,
        lastName,
        FName: firstName,
        LName: lastName,
        dob: patient.dob || '',
        Birthdate: patient.dob || '',
        phone: patient.phone || '',
        WirelessPhone: patient.phone || '',
        email: patient.email || '',
        Email: patient.email || ''
    };
}

function renderTaskActionButton(label = '', icon = '', onclick = '', tone = '') {
    return `
        <button class="ghost-btn mini-btn tasks-action-btn ${escapeTasksHtml(tone)}" type="button" onclick="${onclick}">
            ${icon ? `<i class="${escapeTasksHtml(icon)}"></i>` : ''} ${escapeTasksHtml(label)}
        </button>
    `;
}

function renderTasksAiDraft(row = {}) {
    const rowId = getTaskRowId(row);
    const draft = tasksDashboardState.aiDrafts[rowId];
    if (!draft) {
        return `<div id="tasksAiDraft-${escapeTasksHtml(rowId)}" class="tasks-ai-draft"></div>`;
    }

    return `
        <div id="tasksAiDraft-${escapeTasksHtml(rowId)}" class="tasks-ai-draft show">
            <strong>Call Prep</strong>
            ${draft.greeting ? `<p><b>Greeting:</b> ${escapeTasksHtml(draft.greeting)}</p>` : ''}
            ${draft.purpose ? `<p><b>Purpose:</b> ${escapeTasksHtml(draft.purpose)}</p>` : ''}
            ${Array.isArray(draft.collectInfo) && draft.collectInfo.length ? `<p><b>Collect:</b> ${escapeTasksHtml(draft.collectInfo.join(' · '))}</p>` : ''}
            ${Array.isArray(draft.talkingPoints) && draft.talkingPoints.length ? `<p><b>Talking points:</b> ${escapeTasksHtml(draft.talkingPoints.join(' · '))}</p>` : ''}
            ${draft.voicemailScript ? `<p><b>Voicemail:</b> ${escapeTasksHtml(draft.voicemailScript)}</p>` : ''}
            ${draft.notes ? `<p><b>Note:</b> ${escapeTasksHtml(draft.notes)}</p>` : ''}
        </div>
    `;
}

function renderTaskCallActionBody(row = {}) {
    const patient = row.patient || {};
    const confirmation = row.confirmation || {};
    const call = confirmation.call || {};
    const phone = patient.phone || '';
    const encodedRow = encodeTasksPayload(row);
    const callHistory = call.lastCallAt
        ? `<div class="tasks-action-note"><b>Recent call:</b> ${escapeTasksHtml(call.label || call.lastCallAction || 'Called')} · ${escapeTasksHtml(formatTasksDateTime(call.lastCallAt))}${call.note ? `<br>${escapeTasksHtml(call.note)}` : ''}</div>`
        : `<div class="tasks-action-note">No Weave call matched in the last ${escapeTasksHtml((tasksDashboardState.data || {}).callHistoryLookbackDays || 14)} days.</div>`;

    return `
        <div class="tasks-action-body">
            <div class="tasks-action-note">
                <b>Appointment:</b> ${escapeTasksHtml([row.date ? formatTasksDate(row.date) : '', row.time || '', row.reason || 'Appointment'].filter(Boolean).join(' · '))}
            </div>
            ${callHistory}
            <div class="tasks-action-buttons">
                ${phone ? `<a class="ghost-btn mini-btn tasks-action-btn" href="tel:${escapeTasksHtml(phone)}"><i class="fa-solid fa-phone"></i> Call</a>` : ''}
                ${renderTaskActionButton('Generate Call Prep', 'fa-solid fa-wand-magic-sparkles', `generateTasksCallSummary('${encodedRow}')`)}
            </div>
            ${renderTasksAiDraft(row)}
        </div>
    `;
}

function renderTaskPatientCell(row = {}) {
    const patient = row.patient || {};
    return `
        <div class="tasks-patient-cell">
            <strong>${escapeTasksHtml(patient.name || 'Unknown Patient')}</strong>
            <span>DOB: ${escapeTasksHtml(formatTasksDate(patient.dob))}</span>
            <span>Phone: ${escapeTasksHtml(patient.phone || 'NA')}</span>
        </div>
    `;
}

function renderTaskConfirmationCell(row = {}) {
    const confirmation = row.confirmation || {};
    const isConfirmed = confirmation.confirmed === true;
    const call = confirmation.call || {};
    const chip = renderTaskStatusChip(confirmation.label || (isConfirmed ? 'Confirmed' : 'Not confirmed'), isConfirmed ? 'success' : 'warn');
    const callText = isConfirmed
        ? ''
        : `
            <div class="tasks-subline">
                ${escapeTasksHtml(call.label || 'No call')}
                ${call.lastCallAt ? ` · ${escapeTasksHtml(formatTasksDateTime(call.lastCallAt))}` : ''}
            </div>
        `;
    if (isConfirmed) return chip;

    const encodedRow = encodeTasksPayload(row);
    return `
        <details class="tasks-action-detail" ${taskActionIsOpen(row, 'confirmation') ? 'open' : ''} ontoggle="rememberTasksActionOpen('${encodedRow}', 'confirmation', this.open)">
            <summary>
                ${chip}
                <i class="fa-solid fa-chevron-down"></i>
            </summary>
            ${callText}
            ${renderTaskCallActionBody(row)}
        </details>
    `;
}

function renderTaskAlertDetailItem(item = {}) {
    const status = String(item.status || '').trim();
    const expiresAt = item.expiresAt ? ` · expires ${formatTasksDate(item.expiresAt)}` : '';
    return `
        <li>
            <span>${escapeTasksHtml(item.label || 'Form')}</span>
            ${status ? `<em>${escapeTasksHtml(status)}${escapeTasksHtml(expiresAt)}</em>` : ''}
        </li>
    `;
}

function renderTaskAlertActionBody(alert = {}, row = {}) {
    const encodedRow = encodeTasksPayload(row);
    const patient = getTasksPatientPayload(row);
    const actionType = alert.actionType || alert.key || '';

    if (actionType === 'forms' || alert.key === 'forms') {
        const details = Array.isArray(alert.details) ? alert.details : [];
        const formButtons = details
            .filter((item) => item.formType)
            .map((item) => renderTaskActionButton(
                `Send ${item.label || 'Form'}`,
                'fa-solid fa-paper-plane',
                `openTasksPatientForm('${encodedRow}', '${escapeTasksHtml(item.formType)}')`
            ))
            .join('');
        return `
            <div class="tasks-action-body">
                <div class="tasks-action-note">Open the patient form sender with the selected missing or expired form.</div>
                <div class="tasks-action-buttons">
                    ${formButtons || renderTaskActionButton('Open Forms', 'fa-solid fa-file-signature', `openTasksPatientForm('${encodedRow}', '')`)}
                    ${renderTaskActionButton('Patient Profile', 'fa-solid fa-user', `openTasksPatientProfile('${encodedRow}')`)}
                </div>
            </div>
        `;
    }

    if (actionType === 'document') {
        const slot = alert.documentSlot || '';
        const requestFormType = alert.requestFormType || '';
        return `
            <div class="tasks-action-body">
                <div class="tasks-action-note">${escapeTasksHtml(alert.label || 'Document')} is ${escapeTasksHtml(alert.status || 'missing')}. Update from existing Open Dental files or send an upload request.</div>
                <div class="tasks-action-buttons">
                    ${slot ? renderTaskActionButton('Update File', 'fa-solid fa-folder-open', `openTasksDocumentUpdate('${encodedRow}', '${escapeTasksHtml(slot)}')`) : ''}
                    ${requestFormType ? renderTaskActionButton('Send Upload Request', 'fa-solid fa-mobile-screen-button', `openTasksPatientForm('${encodedRow}', '${escapeTasksHtml(requestFormType)}')`) : ''}
                    ${renderTaskActionButton('Patient Profile', 'fa-solid fa-user', `openTasksPatientProfile('${encodedRow}')`)}
                </div>
            </div>
        `;
    }

    if (actionType === 'lab-case' || alert.key === 'lab-case') {
        return `
            <div class="tasks-action-body">
                <div class="tasks-action-note">Review or create the lab case before the appointment.</div>
                <div class="tasks-action-buttons">
                    ${renderTaskActionButton('Open Lab Cases', 'fa-solid fa-teeth', 'openTasksLabCases()')}
                    ${renderTaskActionButton('Patient Profile', 'fa-solid fa-user', `openTasksPatientProfile('${encodedRow}')`)}
                </div>
            </div>
        `;
    }

    return `
        <div class="tasks-action-body">
            <div class="tasks-action-note">Open this patient profile to review the alert.</div>
            <div class="tasks-action-buttons">
                ${renderTaskActionButton('Patient Profile', 'fa-solid fa-user', `openTasksPatientProfile('${encodedRow}')`)}
            </div>
        </div>
    `;
}

function renderTaskAlert(alert = {}, row = {}, index = 0) {
    const toneClass = escapeTasksHtml(getTaskToneClass(alert.tone));
    const details = Array.isArray(alert.details) ? alert.details : [];
    const encodedRow = encodeTasksPayload(row);
    const actionName = `alert-${index}-${alert.key || alert.label || 'item'}`;
    const pillContent = `
        <strong>${escapeTasksHtml(alert.label || 'Alert')}</strong>
        ${alert.message ? `<em>${escapeTasksHtml(alert.message)}</em>` : ''}
    `;

    return `
        <details class="tasks-alert-detail" ${taskActionIsOpen(row, actionName) ? 'open' : ''} ontoggle="rememberTasksActionOpen('${encodedRow}', '${escapeTasksHtml(actionName)}', this.open)">
            <summary class="tasks-alert-pill ${toneClass}">
                ${pillContent}
                <i class="fa-solid fa-chevron-down"></i>
            </summary>
            <div class="tasks-alert-detail-body">
                ${details.length ? `
                    <div class="tasks-alert-detail-label">${escapeTasksHtml(alert.detailLabel || 'Details')}</div>
                    <ul>${details.map(renderTaskAlertDetailItem).join('')}</ul>
                ` : ''}
                ${renderTaskAlertActionBody(alert, row)}
            </div>
        </details>
    `;
}

function renderTaskAlertsCell(row = {}) {
    const alerts = Array.isArray(row.alerts) ? row.alerts : [];
    const collect = row.collect || {};
    if (!alerts.length) {
        return `
            ${renderTaskStatusChip('Ready', 'success')}
            <div class="tasks-subline">${escapeTasksHtml(collect.label || 'Collect TBD')}</div>
        `;
    }

    return `
        <div class="tasks-alert-list">
            ${alerts.map((alert, index) => renderTaskAlert(alert, row, index)).join('')}
        </div>
        <div class="tasks-subline">${escapeTasksHtml(collect.label || 'Collect TBD')}</div>
    `;
}

function renderTaskInsuranceCell(row = {}) {
    const verification = row.insuranceVerification || {};
    return renderTaskStatusChip(verification.label || 'Ins not verified', verification.tone || 'warn');
}

function renderTaskRow(row = {}) {
    return `
        <tr>
            <td class="tasks-time-cell">
                <strong>${escapeTasksHtml(row.time || '')}</strong>
                <span>${escapeTasksHtml(formatTasksDate(row.date))}</span>
            </td>
            <td>${renderTaskPatientCell(row)}</td>
            <td class="tasks-reason-cell">${escapeTasksHtml(row.reason || 'Appointment')}</td>
            <td>${renderTaskConfirmationCell(row)}</td>
            <td>${renderTaskAlertsCell(row)}</td>
            <td>${renderTaskInsuranceCell(row)}</td>
        </tr>
    `;
}

function renderTaskTable(rows = [], emptyMessage = 'No appointments found.') {
    if (!rows.length) {
        return `<div class="empty-copy tasks-empty">${escapeTasksHtml(emptyMessage)}</div>`;
    }

    return `
        <div class="tasks-table-wrap">
            <table class="tasks-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Patient</th>
                        <th>Reason</th>
                        <th>Confirmation Status</th>
                        <th>Alerts</th>
                        <th>Ins Verified</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(renderTaskRow).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderDoctorNoteCard(data = {}) {
    const note = data.doctorNote || {};
    const canEdit = data.canEditDoctorNote === true;
    const meta = note.updatedAt
        ? `Updated ${formatTasksDate(note.updatedAt)}${note.updatedBy ? ` by ${note.updatedBy}` : ''}`
        : 'No note saved yet.';

    return `
        <section class="tasks-panel tasks-doctor-note-panel">
            <div class="tasks-panel-head">
                <div>
                    <h3><i class="fa-solid fa-user-doctor"></i> Doctor's Note</h3>
                    <p>This note stays until a manager updates it.</p>
                </div>
                ${canEdit ? `
                    <button class="ghost-btn mini-btn" type="button" onclick="saveTasksDoctorNote()">
                        <i class="fa-solid fa-floppy-disk"></i> Save
                    </button>
                ` : renderTaskStatusChip('View only', 'info')}
            </div>
            <textarea id="tasksDoctorNoteInput" ${canEdit ? '' : 'readonly'} placeholder="Add standing doctor notes for the team...">${escapeTasksHtml(note.text || '')}</textarea>
            <div class="tasks-note-meta" id="tasksDoctorNoteMeta">${escapeTasksHtml(meta)}</div>
        </section>
    `;
}

// ---------------------------------------------------------------------------
// Today's Tasks — 6-panel worklist (renderTasksDashboardData)
// Helpers below are prefixed wl* to avoid clashing with the existing tasks-*
// table renderers, which remain in place and continue to work.
// ---------------------------------------------------------------------------

const WL_STYLE = `
<style>
.wl-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(330px, 1fr)); gap:16px; }
.wl-panel { background:#fff; border:1px solid var(--line, #e2e8f0); border-radius:var(--radius-card, 16px); box-shadow:var(--shadow-sm, 0 1px 3px rgba(15,23,42,.08)); padding:16px; display:flex; flex-direction:column; }
.wl-panel header { display:flex; align-items:center; gap:10px; margin-bottom:4px; }
.wl-panel header h3 { flex:1; margin:0; font-size:.98rem; font-weight:800; color:var(--text, #0f172a); }
.wl-icon { width:30px; height:30px; border-radius:9px; display:inline-flex; align-items:center; justify-content:center; color:#fff; font-size:.85rem; flex:0 0 auto; }
.wl-count { color:#fff; border-radius:999px; min-width:24px; height:22px; padding:0 8px; display:inline-flex; align-items:center; justify-content:center; font-size:.74rem; font-weight:800; }
.wl-panel-body { display:flex; flex-direction:column; }
.wl-row { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid var(--line, #e2e8f0); }
.wl-row:last-child { border-bottom:none; }
.wl-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.wl-info strong { font-size:.86rem; font-weight:700; color:var(--text, #0f172a); }
.wl-info span { font-size:.75rem; color:var(--muted, #64748b); }
.wl-row-done strong { color:var(--muted, #94a3b8); text-decoration:line-through; }
.wl-btn { border:none; border-radius:8px; padding:5px 12px; font-weight:700; font-size:.76rem; cursor:pointer; white-space:nowrap; }
.wl-pill { cursor:default; }
.wl-done { background:#e2e8f0; color:#94a3b8; cursor:default; }
.wl-empty { color:var(--muted, #64748b); text-align:center; padding:14px 0; font-size:.8rem; }
.wl-note { font-size:.78rem; color:var(--muted, #64748b); margin-top:10px; }
</style>
`;

function wlEmpty(message = 'All clear') {
    return `<div class="wl-empty">${escapeTasksHtml(message)}</div>`;
}

function wlPatientName(row = {}) {
    const patient = row.patient || {};
    return patient.name || patient.fullName || 'Unknown';
}

function wlPatientKey(row = {}) {
    const patient = row.patient || {};
    const id = patient.PatNum || patient.patNum || patient.id || row.PatNum || row.patNum || '';
    if (id) return `id:${String(id)}`;
    const name = patient.name || patient.fullName || '';
    return name ? `name:${String(name).toLowerCase()}` : `ref:${Math.random()}`;
}

function dedupWlRows(rows = []) {
    const seen = new Set();
    const out = [];
    (Array.isArray(rows) ? rows : []).forEach((row) => {
        if (!row) return;
        const key = wlPatientKey(row);
        if (seen.has(key)) return;
        seen.add(key);
        out.push(row);
    });
    return out;
}

function wlRowHasAlert(row = {}, type = '') {
    const alerts = Array.isArray(row.alerts) ? row.alerts : [];
    return alerts.some((alert) => alert && (alert.actionType === type || alert.key === type));
}

// Parse 'MM/DD/YYYY' (e.g. '09/03/2026') or ISO 'YYYY-MM-DD' into {y, mo, d}.
// Returns null when the value cannot be parsed.
function wlDateParts(value) {
    if (!value) return null;
    const raw = String(value).trim();
    let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) return { y: +match[1], mo: +match[2], d: +match[3] };
    match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,4})/);
    if (match) return { y: +match[3], mo: +match[1], d: +match[2] };
    return null;
}

// Local-midnight Date from wlDateParts. setFullYear() avoids the legacy
// two-digit-year mapping (e.g. year 1 -> 1901) so year 0001 stays year 1.
function wlParseDate(value) {
    const parts = wlDateParts(value);
    if (!parts || !parts.y || !parts.mo || !parts.d) return null;
    const date = new Date(2000, parts.mo - 1, parts.d);
    date.setFullYear(parts.y);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

// Whole-day difference from today (local). null when row.date can't be parsed.
function wlDayDiffFromToday(value) {
    const date = wlParseDate(value);
    if (!date) return null;
    const now = new Date();
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((date.getTime() - todayMid.getTime()) / 86400000);
}

// Exclude obvious dummy/non-real appointments: empty or "Unknown" patient name,
// or a placeholder DOB in year 0001. Does not over-filter real patients.
function wlIsRealRow(row = {}) {
    const patient = row.patient || {};
    const name = String(patient.name || patient.fullName || '').trim();
    if (!name || name.toLowerCase() === 'unknown') return false;
    const dobParts = wlDateParts(patient.dob);
    if (dobParts && dobParts.y <= 1) return false;
    return true;
}

function wlActionRow(name = '', detail = '', label = '', accent = '#64748b', onclick = '') {
    return `
        <div class="wl-row">
            <div class="wl-info">
                <strong>${escapeTasksHtml(name)}</strong>
                <span>${escapeTasksHtml(detail)}</span>
            </div>
            <button class="wl-btn" type="button" style="background:${accent};color:#fff;" onclick="${onclick}">${escapeTasksHtml(label)}</button>
        </div>
    `;
}

function wlPillRow(name = '', detail = '', label = '', accent = '#64748b') {
    return `
        <div class="wl-row">
            <div class="wl-info">
                <strong>${escapeTasksHtml(name)}</strong>
                <span>${escapeTasksHtml(detail)}</span>
            </div>
            <span class="wl-btn wl-pill" style="background:${accent};color:#fff;">${escapeTasksHtml(label)}</span>
        </div>
    `;
}

function wlDoneRow(name = '', label = '') {
    return `
        <div class="wl-row wl-row-done">
            <div class="wl-info">
                <strong>${escapeTasksHtml(name)}</strong>
            </div>
            <span class="wl-btn wl-done">&#10003; ${escapeTasksHtml(label)}</span>
        </div>
    `;
}

function wlPanel(opts = {}) {
    const { icon = '', title = '', accent = '#64748b', count = 0, body = '', note = '', bodyId = '', countId = '' } = opts;
    return `
        <section class="wl-panel">
            <header>
                <span class="wl-icon" style="background:${accent};"><i class="${escapeTasksHtml(icon)}"></i></span>
                <h3>${escapeTasksHtml(title)}</h3>
                <span class="wl-count" style="background:${accent};"${countId ? ` id="${countId}"` : ''}>${escapeTasksHtml(String(count))}</span>
            </header>
            <div class="wl-panel-body"${bodyId ? ` id="${bodyId}"` : ''}>${body}</div>
            ${note ? `<div class="wl-note">${escapeTasksHtml(note)}</div>` : ''}
        </section>
    `;
}

// Panel 1 loads asynchronously so a slow/failed fetch never blocks the grid.
async function loadWlMissedCalls() {
    const body = document.getElementById('wlMissedCallsBody');
    const countEl = document.getElementById('wlMissedCallsCount');
    if (!body) return;
    try {
        const token = await getTasksStaffToken();
        const now = new Date();
        const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const response = await fetch(`/api/admin/pre-auths/call-list?sources=missed-call&fromDate=${todayIso}&toDate=${todayIso}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json().catch(() => ({}));
        const rawItems = result?.data?.missedCalls || result?.missedCalls || result?.data?.rows || [];
        const items = Array.isArray(rawItems) ? rawItems : [];

        const active = [];
        const done = [];
        items.forEach((item) => {
            if (!item) return;
            const name = item.patientName || item.name || item.patient?.name || 'Unknown';
            const phone = item.phone || item.phoneNumber || item.patient?.phone || '';
            const statusText = `${item.callStatus || ''} ${item.callBackStatus || ''}`.toLowerCase();
            const called = item.callStatus === true || item.callBackStatus === true
                || statusText.includes('called') || statusText.includes('complete') || statusText.includes('done');
            if (called) done.push({ name });
            else active.push({ name, phone });
        });

        if (countEl) countEl.textContent = String(active.length);

        if (!active.length && !done.length) {
            body.innerHTML = wlEmpty('All clear');
            return;
        }

        const html = active.map((item) => wlActionRow(
            item.name,
            item.phone || 'Missed call',
            'Call',
            '#ef4444',
            ''
        )).join('') + done.map((item) => wlDoneRow(item.name, 'Called')).join('');
        body.innerHTML = html || wlEmpty('All clear');
    } catch (error) {
        console.error('Missed-calls panel load error:', error);
        if (countEl) countEl.textContent = '0';
        body.innerHTML = wlEmpty('All clear');
    }
}

function renderTasksDashboardData(data = {}) {
    const container = document.getElementById('dashboardContainer');
    if (!container) return;

    const safe = data || {};
    const todayRows = Array.isArray(safe.todayRows) ? safe.todayRows : [];
    const weekRows = Array.isArray(safe.weekRows) ? safe.weekRows : [];
    // Exclude obvious dummy appointments (blank/"Unknown" name, year-0001 DOB) from every panel.
    const todayReal = todayRows.filter(wlIsRealRow);
    const weekReal = weekRows.filter(wlIsRealRow);

    const warning = safe.localAgentUnavailable
        ? `<div class="inline-alert warning show tasks-warning">Weave call history unavailable. ${escapeTasksHtml(safe.localAgentMessage || '')}</div>`
        : '';

    // Panel 1 — Missed Calls to Return (populated by loadWlMissedCalls()).
    const missedCallsPanel = wlPanel({
        icon: 'fa-solid fa-phone-volume',
        title: 'Missed Calls to Return',
        accent: '#ef4444',
        count: '…',
        countId: 'wlMissedCallsCount',
        bodyId: 'wlMissedCallsBody',
        body: wlEmpty('Loading…')
    });

    // Panel 2 — Insurance Eligibility — Not Verified. Today's appointments only.
    const insDedup = dedupWlRows(todayReal);
    const insActive = [];
    const insVerified = [];
    insDedup.forEach((row) => {
        const status = String((row.insuranceVerification || {}).status || '').toLowerCase();
        if (status === 'no-insurance') return;
        if (status === 'missing' || status === 'not-verified' || status === 'expired') insActive.push(row);
        else if (status === 'verified') insVerified.push(row);
    });
    const insBody = [
        ...insActive.map((row) => wlActionRow(
            wlPatientName(row),
            [row.time || '', row.reason || '', 'elig + history'].filter(Boolean).join(' · '),
            'Verify',
            '#f59e0b',
            `openTasksPatientProfile('${encodeTasksPayload(row)}')`
        )),
        ...insVerified.slice(0, 4).map((row) => wlDoneRow(wlPatientName(row), 'Verified'))
    ].join('');
    const insurancePanel = wlPanel({
        icon: 'fa-solid fa-shield-halved',
        title: 'Insurance Eligibility — Not Verified',
        accent: '#f59e0b',
        count: insActive.length,
        body: insBody || wlEmpty('All clear'),
        note: 'Greys only when eligibility + history are both updated · count drops'
    });

    // Panel 3 — Forms Not Returned. Today's appointments only.
    const formRows = dedupWlRows(todayReal).filter((row) => wlRowHasAlert(row, 'forms'));
    const formsBody = formRows.map((row) => wlActionRow(
        wlPatientName(row),
        [row.reason || '', 'form pending'].filter(Boolean).join(' · '),
        'Resend',
        '#0ea5e9',
        `openTasksPatientForm('${encodeTasksPayload(row)}', '')`
    )).join('');
    const formsPanel = wlPanel({
        icon: 'fa-solid fa-file-signature',
        title: 'Forms Not Returned',
        accent: '#f59e0b',
        count: formRows.length,
        body: formsBody || wlEmpty('All clear'),
        note: 'Send / Resend the missing forms · greys to Received when the patient completes'
    });

    // Panel 4 — Appointments to Confirm. Only future window: tomorrow & day-after
    // (whole-day diff of exactly 1 or 2). Unparseable dates are excluded.
    const confirmWindow = weekReal.filter((row) => {
        const diff = wlDayDiffFromToday(row.date);
        return diff === 1 || diff === 2;
    });
    const confirmActive = confirmWindow.filter((row) => (row.confirmation || {}).confirmed !== true);
    const confirmDone = confirmWindow.filter((row) => (row.confirmation || {}).confirmed === true);
    const confirmBody = [
        ...confirmActive.map((row) => wlActionRow(
            wlPatientName(row),
            [formatTasksDate(row.date), row.time || ''].filter(Boolean).join(' · '),
            'Confirm',
            '#10b981',
            `openTasksPatientProfile('${encodeTasksPayload(row)}')`
        )),
        ...confirmDone.slice(0, 3).map((row) => wlDoneRow(wlPatientName(row), 'Confirmed'))
    ].join('');
    const confirmPanel = wlPanel({
        icon: 'fa-solid fa-calendar-check',
        title: 'Appointments to Confirm',
        accent: '#f59e0b',
        count: confirmActive.length,
        body: confirmBody || wlEmpty('All clear'),
        note: 'Tomorrow & the next few days'
    });

    // Panel 5 — Lab Cases Not Arrived. Today's appointments only.
    const labRows = dedupWlRows(todayReal).filter((row) => wlRowHasAlert(row, 'lab-case'));
    const labBody = labRows.map((row) => wlActionRow(
        wlPatientName(row),
        row.reason || 'Lab case',
        'Follow up',
        '#ef4444',
        'openTasksLabCases()'
    )).join('');
    const labPanel = wlPanel({
        icon: 'fa-solid fa-teeth',
        title: 'Lab Cases Not Arrived',
        accent: '#ef4444',
        count: labRows.length,
        body: labBody || wlEmpty('All clear'),
        note: labRows.length ? '3 dentures in progress — tracked separately' : ''
    });

    // Panel 6 — Collect Today. Today's appointments only.
    const collectBody = todayReal.map((row) => wlPillRow(
        wlPatientName(row),
        [row.time || '', row.reason || ''].filter(Boolean).join(' · '),
        (row.collect || {}).label || 'TBD',
        '#10b981'
    )).join('');
    const collectPanel = wlPanel({
        icon: 'fa-solid fa-hand-holding-dollar',
        title: 'Collect Today',
        accent: '#10b981',
        count: todayReal.length,
        body: collectBody || wlEmpty('All clear'),
        note: 'Amounts wire in once Open-Dental payments are connected'
    });

    container.innerHTML = `
        ${WL_STYLE}
        <div class="tasks-dashboard">
            <div class="tasks-title-row">
                <div>
                    <h2><i class="fa-solid fa-list-check"></i> Today's Tasks</h2>
                    <p>Return calls, verify insurance, chase forms, confirm visits, track labs, and collect.</p>
                </div>
                <button class="ghost-btn mini-btn" type="button" onclick="loadTasksDashboard(true)">
                    <i class="fa-solid fa-rotate"></i> Refresh
                </button>
            </div>
            ${warning}
            <div class="wl-grid">
                ${missedCallsPanel}
                ${insurancePanel}
                ${formsPanel}
                ${confirmPanel}
                ${labPanel}
                ${collectPanel}
            </div>
            ${renderDoctorNoteCard(data)}
        </div>
    `;

    // Fire-and-forget async load for Panel 1 (never throws into the caller).
    loadWlMissedCalls();
}

function renderTasksLoading() {
    const container = document.getElementById('dashboardContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="tasks-dashboard">
            <div class="tasks-panel">
                <div class="empty-copy tasks-empty">
                    <i class="fa-solid fa-circle-notch fa-spin"></i> Loading Tasks...
                </div>
            </div>
        </div>
    `;
}

async function loadTasksDashboard(force = false) {
    if (tasksDashboardState.loading) return;
    if (tasksDashboardState.data && !force) {
        renderTasksDashboardData(tasksDashboardState.data);
        return;
    }

    tasksDashboardState.loading = true;
    renderTasksLoading();

    try {
        const idToken = await getTasksStaffToken();
        const params = new URLSearchParams({ _: Date.now().toString() });
        if (force) params.set('refresh', '1');
        const response = await fetch(`/api/admin/tasks/summary?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            }
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result?.success) {
            throw new Error(result?.message || 'Failed to load Tasks.');
        }
        tasksDashboardState.data = result.data || {};
        renderTasksDashboardData(tasksDashboardState.data);
    } catch (error) {
        console.error('Tasks dashboard load error:', error);
        const container = document.getElementById('dashboardContainer');
        if (container) {
            container.innerHTML = `<div class="inline-alert error show">${escapeTasksHtml(error.message || 'Failed to load Tasks.')}</div>`;
        }
    } finally {
        tasksDashboardState.loading = false;
    }
}

async function saveTasksDoctorNote() {
    const input = document.getElementById('tasksDoctorNoteInput');
    const meta = document.getElementById('tasksDoctorNoteMeta');
    if (!input) return;

    try {
        if (meta) meta.textContent = 'Saving...';
        const idToken = await getTasksStaffToken();
        const response = await fetch('/api/admin/tasks/doctor-note', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: input.value || '' })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result?.success) {
            throw new Error(result?.message || 'Failed to save Doctor’s Note.');
        }
        tasksDashboardState.data = {
            ...(tasksDashboardState.data || {}),
            doctorNote: result.doctorNote || tasksDashboardState.data?.doctorNote || {}
        };
        if (typeof showPageAlert === 'function') {
            showPageAlert(result.message || 'Doctor’s Note saved.', 'success', 2500);
        }
        renderTasksDashboardData(tasksDashboardState.data);
    } catch (error) {
        console.error('Doctor note save error:', error);
        if (meta) meta.textContent = error.message || 'Failed to save Doctor’s Note.';
        if (typeof showPageAlert === 'function') {
            showPageAlert(error.message || 'Failed to save Doctor’s Note.', 'error', 4000);
        }
    }
}

function switchTasksView(viewId = '', title = '') {
    if (typeof switchOsView === 'function') {
        switchOsView(null, viewId, title);
    }
}

function openTasksPatientProfile(encodedRow = '') {
    const row = decodeTasksPayload(encodedRow);
    const patient = getTasksPatientPayload(row);
    if (!patient.PatNum && !patient.id) {
        if (typeof showPageAlert === 'function') showPageAlert('No patient is linked to this task.', 'warning', 3500);
        return;
    }
    switchTasksView('patients', 'Patient Management');
    if (typeof selectPatientManagerPatient === 'function') {
        selectPatientManagerPatient(patient);
    }
}

async function openTasksPatientForm(encodedRow = '', formType = '') {
    const row = decodeTasksPayload(encodedRow);
    const patient = getTasksPatientPayload(row);
    if (!patient.PatNum && !patient.id) {
        if (typeof showPageAlert === 'function') showPageAlert('No patient is linked to this task.', 'warning', 3500);
        return;
    }
    switchTasksView('patients', 'Patient Management');
    if (typeof openPatientManagerForms === 'function') {
        await openPatientManagerForms(encodeURIComponent(JSON.stringify(patient)), formType || '');
        return;
    }
    if (typeof showPageAlert === 'function') showPageAlert('Patient form tools are not loaded.', 'error', 3500);
}

async function openTasksDocumentUpdate(encodedRow = '', slot = '') {
    const row = decodeTasksPayload(encodedRow);
    const patient = getTasksPatientPayload(row);
    if (!patient.PatNum && !patient.id) {
        if (typeof showPageAlert === 'function') showPageAlert('No patient is linked to this task.', 'warning', 3500);
        return;
    }
    switchTasksView('patients', 'Patient Management');
    if (typeof selectPatientManagerPatient === 'function') {
        selectPatientManagerPatient(patient);
    }
    if (typeof loadPatientFullProfile === 'function' && patient.PatNum) {
        await loadPatientFullProfile(patient.PatNum).catch(() => {});
    }
    if (typeof openPatientDocumentUpdateModal === 'function') {
        openPatientDocumentUpdateModal(slot, patient);
        return;
    }
    if (typeof showPageAlert === 'function') showPageAlert('Patient document tools are not loaded.', 'error', 3500);
}

function openTasksLabCases() {
    switchTasksView('lab-cases', 'Lab Case Tracking & Follow-up');
}

async function generateTasksCallSummary(encodedRow = '') {
    const row = decodeTasksPayload(encodedRow);
    const rowId = getTaskRowId(row);
    if (!rowId) return;

    tasksDashboardState.openActions[getTaskActionKey(row, 'confirmation')] = true;
    const target = document.getElementById(`tasksAiDraft-${rowId}`);
    if (target) {
        target.className = 'tasks-ai-draft show loading';
        target.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generating call prep...';
    }

    try {
        const idToken = await getTasksStaffToken();
        const patient = row.patient || {};
        const response = await fetch('/api/admin/call-list/ai-summary', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                section: 'appointment-confirmation',
                item: {
                    callListType: 'appointment-confirmation',
                    patientName: patient.name || '',
                    patientDob: patient.dob || '',
                    patientPhone: patient.phone || '',
                    description: row.reason || 'Appointment confirmation needed',
                    statusLabel: row.confirmation?.label || 'Not confirmed',
                    callStatus: row.confirmation?.call?.status || 'not-called',
                    appointment: {
                        date: row.date || '',
                        time: row.time || '',
                        procedure: row.reason || '',
                        confirmedLabel: row.confirmation?.label || 'Not confirmed'
                    }
                }
            })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result?.success) {
            throw new Error(result?.message || 'Failed to generate call prep.');
        }
        tasksDashboardState.aiDrafts[rowId] = result.data || {};
        renderTasksDashboardData(tasksDashboardState.data || {});
    } catch (error) {
        console.error('Tasks call prep error:', error);
        if (target) {
            target.className = 'tasks-ai-draft show error';
            target.textContent = error.message || 'Failed to generate call prep.';
        }
        if (typeof showPageAlert === 'function') showPageAlert(error.message || 'Failed to generate call prep.', 'error', 4000);
    }
}

function renderDashboard() {
    loadTasksDashboard(false);
}

window.renderDashboard = renderDashboard;
window.loadTasksDashboard = loadTasksDashboard;
window.saveTasksDoctorNote = saveTasksDoctorNote;
window.rememberTasksActionOpen = rememberTasksActionOpen;
window.openTasksPatientProfile = openTasksPatientProfile;
window.openTasksPatientForm = openTasksPatientForm;
window.openTasksDocumentUpdate = openTasksDocumentUpdate;
window.openTasksLabCases = openTasksLabCases;
window.generateTasksCallSummary = generateTasksCallSummary;
