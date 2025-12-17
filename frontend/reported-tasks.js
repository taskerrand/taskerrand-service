import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";
import { api } from "./api.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUser = null;
let userData = null;
let reports = [];
let tasksCache = {};

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "./index.html";
        return;
    }

    currentUser = user;

    const usernameEl = document.getElementById("username");
    const profileEl = document.getElementById("profile");

    if (usernameEl) {
        usernameEl.textContent = `Welcome, ${user.displayName || user.email}!`;
    }

    if (profileEl) {
        profileEl.src = user.photoURL || "";
        profileEl.alt = user.displayName || "Profile";
    }

    try {
        userData = await api.getCurrentUser();
        
        // Only admins can access this page
        if (!userData.is_admin) {
            window.location.href = "./dashboard.html";
            return;
        }

        loadReports();
        loadNotifications();
    } catch (error) {
        console.error("Error loading user data:", error);
        window.location.href = "./index.html";
    }
});

async function loadReports() {
    try {
        reports = await api.getReports();
        displayReports();
    } catch (error) {
        console.error("Error loading reports:", error);
        document.getElementById("reports-container").innerHTML = `<div class="error">Error loading reports: ${error.message}</div>`;
    }
}

async function displayReports() {
    const container = document.getElementById("reports-container");

    if (reports.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>No reports at this time.</p></div>`;
        return;
    }

    const rendered = await Promise.all(reports.map(async (report) => {
        // Get task data
        let taskData = tasksCache[report.task_id];
        if (!taskData) {
            try {
                taskData = await api.getTask(report.task_id);
                tasksCache[report.task_id] = taskData;
            } catch (e) {
                taskData = null;
            }
        }

        const reportDate = new Date(report.created_at).toLocaleDateString();
        const reportTime = new Date(report.created_at).toLocaleTimeString();

        return `
            <div class="report-card">
                <div class="report-header">
                    <span class="report-type-badge ${report.report_type}">${report.report_type.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span style="color: #999; font-size: 0.9rem;">Reported on ${reportDate} at ${reportTime}</span>
                </div>

                <div class="report-info">
                    <p><strong>Report ID:</strong> #${report.id}</p>
                    <p><strong>Reporter ID:</strong> ${report.reporter_id}</p>
                </div>

                ${report.description ? `
                <div class="report-description">
                    <h4>Reporter's Description:</h4>
                    <p>${escapeHtml(report.description)}</p>
                </div>
                ` : ''}

                ${taskData ? `
                <div class="task-details">
                    <h4>Reported Task Details:</h4>
                    <p><strong>Title:</strong> ${escapeHtml(taskData.title)}</p>
                    <p><strong>Description:</strong> ${escapeHtml(taskData.description.substring(0, 200))}${taskData.description.length > 200 ? '...' : ''}</p>
                    <div class="task-meta">
                        <p><strong>Payment:</strong> ₱${taskData.payment.toFixed(2)}</p>
                        <p><strong>Status:</strong> ${taskData.status}</p>
                        <p><strong>Posted by (ID):</strong> ${taskData.poster_id}</p>
                        <p><strong>Location:</strong> ${taskData.location_address || 'N/A'}</p>
                    </div>
                </div>
                ` : `<div class="error" style="margin-bottom: 1rem;">Task details not available</div>`}

                <div class="report-actions">
                    ${taskData ? `<button class="btn-view" onclick="viewTask(${report.task_id})">View Full Task</button>` : ''}
                    ${taskData ? `<button class="btn-delete-task" onclick="deleteTask(${report.task_id}, ${report.id})">Delete Task</button>` : ''}
                    <button class="btn-dismiss" onclick="dismissReport(${report.id})">Dismiss Report</button>
                </div>
            </div>
        `;
    }));

    container.innerHTML = rendered.join('');
}

// Expose functions to global scope so inline onclick handlers work when this file is loaded as a module
window.viewTask = viewTask;
window.deleteTask = deleteTask;
window.dismissReport = dismissReport;

function viewTask(taskId) {
    window.location.href = `./task-detail.html?id=${taskId}`;
}

async function deleteTask(taskId, reportId) {
    if (!confirm("Are you sure you want to delete this task? This action cannot be undone.")) {
        return;
    }

    try {
        await api.adminDeleteTask(taskId);
        // Try to also dismiss the associated report (if it still exists).
        try {
            await api.deleteReport(reportId);
        } catch (e) {
            // If deleting the report fails (eg already removed), log and continue.
            console.warn("Could not delete associated report:", e);
        }

        alert("Task deleted successfully");
        await loadReports();
    } catch (error) {
        console.error("Error deleting task:", error);
        alert("Error deleting task: " + (error.message || String(error)));
    }
}

async function dismissReport(reportId) {
    if (!confirm("Are you sure you want to dismiss this report?")) {
        return;
    }

    try {
        await api.deleteReport(reportId);
        alert("Report dismissed");
        loadReports();
    } catch (error) {
        alert("Error dismissing report: " + error.message);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Notification Logic
async function loadNotifications() {
    function formatNotificationDate(dateStr) {
        if (!dateStr) return '';
        if (/[Zz]|[+\-]\d{2}:\d{2}$/.test(dateStr)) return new Date(dateStr).toLocaleString();
        try { return new Date(dateStr + 'Z').toLocaleString(); } catch (e) { return new Date(dateStr).toLocaleString(); }
    }
    try {
        const notifications = await api.getNotifications();
        const notificationList = document.getElementById("notification-list");
        const notificationBadge = document.getElementById("notification-badge");

        if (!notificationList) return;

        // Update badge
        const unreadCount = notifications.filter(n => !n.seen).length;
        if (notificationBadge) {
            notificationBadge.textContent = unreadCount;
            notificationBadge.style.display = unreadCount > 0 ? "block" : "none";
        }

        if (notifications.length === 0) {
            notificationList.innerHTML = '<div class="notification-empty">No notifications</div>';
            return;
        }

        notificationList.innerHTML = notifications.map(n => `
            <div class="notification-item ${n.seen ? '' : 'unread'}">
                <div class="notification-title">${n.title}</div>
                <div class="notification-message">${n.message}</div>
                <div class="notification-time">${formatNotificationDate(n.created_at)}</div>
                <div class="notification-actions" onclick="event.stopPropagation();">
                    ${n.task_id ? `<button class="notification-view-btn" onclick="handleNotificationView(${n.id}, ${n.task_id}, ${n.seen}, event)">View</button>` : ''}
                    <button class="notification-delete-btn" onclick="handleNotificationDelete(${n.id}, event)">Delete</button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error("Error loading notifications:", error);
    }
}

window.handleNotificationView = async function (notificationId, taskId, seen, event) {
    try {
        // Mark as read if not already read
        if (!seen) {
            await api.markNotificationRead(notificationId);
        }

        // Close the notification dropdown
        const dropdown = document.getElementById("notification-dropdown");
        if (dropdown) {
            dropdown.classList.remove("show");
        }

        // Check if Ctrl or Cmd key was pressed
        if (event.ctrlKey || event.metaKey) {
            // Open in new tab
            window.open(`./task-detail.html?id=${taskId}`, '_blank');
        } else {
            // Navigate in current tab
            window.location.href = `./task-detail.html?id=${taskId}`;
        }
    } catch (error) {
        console.error("Error handling notification view:", error);
    }
};

window.handleNotificationDelete = async function (notificationId, event) {
    try {
        event.stopPropagation();
        
        // Delete the notification
        await api.deleteNotification(notificationId);
        
        // Reload notifications to reflect the deletion
        loadNotifications();
    } catch (error) {
        console.error("Error deleting notification:", error);
    }
};

// Notification bell event listener
document.addEventListener("DOMContentLoaded", () => {
    const bell = document.getElementById("notification-bell");
    const dropdown = document.getElementById("notification-dropdown");

    if (bell && dropdown) {
        bell.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.classList.toggle("show");
        });

        // Close dropdown when clicking outside
        window.addEventListener("click", () => {
            if (dropdown.classList.contains("show")) {
                dropdown.classList.remove("show");
            }
        });

        dropdown.addEventListener("click", (e) => {
            e.stopPropagation();
        });
    }
});

// Logout button event
const logoutBtn = document.getElementById("google-logout-btn-id");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => {
            window.location.href = "./index.html";
        });
    });
}
