import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";
import { api } from "./api.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUser = null;
let userData = null;

// Check user state
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "./index.html";
        return;
    }

    currentUser = user;

    try {
        // Get user data from backend
        userData = await api.getCurrentUser();
        displayUserInfo(user, userData);

        // Show admin link if user is admin
        if (userData.is_admin) {
            const adminLink = document.getElementById("admin-link");
            if (adminLink) {
                adminLink.style.display = "block";
            }
        }

        loadDashboardStats();
        loadMyTasks();
        loadNotifications();
    } catch (error) {
        console.error("Error loading user data:", error);
        displayUserInfo(user, null);
    }
});

function displayUserInfo(user, userData) {
    const usernameEl = document.getElementById("username");
    const profileEl = document.getElementById("profile");

    if (usernameEl) {
        usernameEl.textContent = `Welcome, ${user.displayName || user.email}!`;
    }

    if (profileEl) {
        profileEl.src = user.photoURL || "";
        profileEl.alt = user.displayName || "Profile";
    }
}

async function loadDashboardStats() {
    try {
        const tasks = await api.getMyTasks();

        const stats = {
            posted: tasks.filter(t => t.poster_id === userData.id).length,
            accepted: tasks.filter(t => t.seeker_id === userData.id).length,
            completed: tasks.filter(t => t.status === "completed" && t.seeker_id === userData.id).length,
            active: tasks.filter(t => t.status === "ongoing" || t.status === "pending_confirmation").length
        };

        const statsContainer = document.getElementById("stats");
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card">
                        <h3>${stats.posted}</h3>
                        <p>Tasks Posted</p>
                    </div>
                    <div class="stat-card">
                        <h3>${stats.accepted}</h3>
                        <p>Tasks Accepted</p>
                    </div>
                    <div class="stat-card">
                        <h3>${stats.completed}</h3>
                        <p>Tasks Completed</p>
                    </div>
                    <div class="stat-card">
                        <h3>${stats.active}</h3>
                        <p>Active Tasks</p>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error("Error loading stats:", error);
    }
}

async function loadMyTasks() {
    return loadMyTasksWithFilter(null);
}

async function loadMyTasksWithFilter(statusFilter = null) {
    try {
        const tasks = await api.getMyTasks();
        const tasksContainer = document.getElementById("my-tasks");
        // Apply client-side status filter if provided
        const filteredTasks = statusFilter ? tasks.filter(t => t.status === statusFilter) : tasks;

        if (tasksContainer) {
            if (filteredTasks.length === 0) {
                tasksContainer.innerHTML = `
                    <div class="empty-state">
                        <p>No tasks match the selected filter.</p>
                    </div>
                `;
                return;
            }

            // Fetch poster names and render tasks with creator shown
            const rendered = await Promise.all(filteredTasks.map(async (task) => {
                let posterName = 'Unknown';
                try { const u = await api.getUser(task.poster_id); posterName = u.name || u.email || posterName; } catch (e) { }
                return `
                <div class="task-card" onclick="window.location.href='./task-detail.html?id=${task.id}'">
                    <a></a>
                    <h3>Task: ${task.title}</h3>
                    <div class="task-creator">Created by: ${posterName}</div>
                    <p>Description: ${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}</p>
                    <div class="task-meta">
                        <span style="display: block" class="task-status status-${task.status}">Status: ${task.status.replace('_', ' ')}</span>
                        <span><strong>Payment: ₱${task.payment.toFixed(2)}</strong></span>
                    </div>
                    <a></a>
                </div>
            `;
            }));

            tasksContainer.innerHTML = rendered.join('');
        }
    } catch (error) {
        console.error("Error loading tasks:", error);
    }
}

window.filterMyTasks = function () {
    const filter = document.getElementById('my-task-filter').value;
    loadMyTasksWithFilter(filter || null);
};

// Logout button event
const logoutBtn = document.getElementById("google-logout-btn-id");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => {
            window.location.href = "./index.html";
        });
    });
}







// Notification Logic
async function loadNotifications() {
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
            <div class="notification-item ${n.seen ? '' : 'unread'}" onclick="handleNotificationClick(${n.id}, ${n.task_id}, ${n.seen})">
                <div class="notification-title">${n.title}</div>
                <div class="notification-message">${n.message}</div>
                <div class="notification-time">${new Date(n.created_at).toLocaleString()}</div>
                <div class="notification-actions" onclick="event.stopPropagation();">
                    ${n.task_id ? `<button class="notification-view-btn" onclick="handleNotificationView(${n.id}, ${n.task_id}, ${n.seen})">View</button>` : ''}
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error("Error loading notifications:", error);
    }
}

window.handleNotificationClick = async function (notificationId, taskId, seen) {
    try {
        if (!seen) {
            await api.markNotificationRead(notificationId);
        }

        // Close the notification dropdown
        const dropdown = document.getElementById("notification-dropdown");
        if (dropdown) {
            dropdown.classList.remove("show");
        }

        if (taskId) {
            window.location.href = `./task-detail.html?id=${taskId}`;
        } else {
            // Just reload notifications to update UI if no task link
            loadNotifications();
        }
    } catch (error) {
        console.error("Error handling notification click:", error);
    }
};

window.handleNotificationView = async function (notificationId, taskId, seen) {
    try {
        if (!seen) {
            await api.markNotificationRead(notificationId);
        }

        // Close the notification dropdown
        const dropdown = document.getElementById("notification-dropdown");
        if (dropdown) {
            dropdown.classList.remove("show");
        }

        // Navigate to the task detail page
        window.location.href = `./task-detail.html?id=${taskId}`;
    } catch (error) {
        console.error("Error handling notification view:", error);
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
