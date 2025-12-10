import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";
import { api } from "./api.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "./index.html";
        return;
    }
    
    const usernameEl = document.getElementById("username");
    const profileEl = document.getElementById("profile");
    
    if (usernameEl) {
        usernameEl.textContent = user.displayName || user.email;
    }
    
    if (profileEl) {
        profileEl.src = user.photoURL || "";
    }
    
    await loadTasks();
    loadNotifications();
});

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
async function loadTasks() {
    const container = document.getElementById("tasks-container");
    const paginationEl = document.getElementById("browse-pagination");
    let allTasks = [];
    let currentPage = 1;
    const perPage = 20; // items per page for client-side pagination
    
    try {
        const tasks = await api.getTasks("available");

        if (tasks.length === 0) {
            container.innerHTML = "<p class='loading'>No available tasks at the moment. Check back later!</p>";
            if (paginationEl) paginationEl.innerHTML = "";
            return;
        }

        allTasks = tasks;

        async function renderPage(page) {
            const start = (page - 1) * perPage;
            const pageTasks = allTasks.slice(start, start + perPage);

            const rendered = await Promise.all(pageTasks.map(async (task) => {
            let posterName = 'Unknown';
            try {
                const u = await api.getUser(task.poster_id);
                posterName = u.name || u.email || posterName;
            } catch (e) { /* ignore */ }

            return `
            <div class="task-card" onclick="window.location.href='./task-detail.html?id=${task.id}'">
                <h3>Task: ${task.title}</h3>
                <div class="task-creator">Created by: ${posterName}</div>
                <p>Description: ${task.description.substring(0, 150)}${task.description.length > 150 ? '...' : ''}</p>
                <div class="task-meta">
                    <span style="display: block" class="task-status status-${task.status}">Status: ${task.status}</span>
                    <span><strong>Payment: ₱${task.payment.toFixed(2)}</strong></span>
                </div>
                ${task.location_address ? `<p style="margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">📍 ${task.location_address}</p>` : ''}
            </div>
        `;
        }));

            container.innerHTML = rendered.join('');
        }

        // render first page
        await renderPage(currentPage);

        // setup pagination controls if many tasks
        if (paginationEl) {
            function renderPagination() {
                const totalPages = Math.ceil(allTasks.length / perPage);
                if (totalPages <= 1) {
                    paginationEl.innerHTML = "";
                    return;
                }

                let html = '';
                html += `<button id='prev-page' ${currentPage === 1 ? 'disabled' : ''}>Prev</button>`;

                // show limited page numbers to avoid clutter
                const startPage = Math.max(1, currentPage - 2);
                const endPage = Math.min(totalPages, currentPage + 2);
                for (let p = startPage; p <= endPage; p++) {
                    html += `<button class='page-btn' data-page='${p}' ${p === currentPage ? 'disabled' : ''}>${p}</button>`;
                }

                html += `<button id='next-page' ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;
                paginationEl.innerHTML = html;

                // attach events
                const prevBtn = document.getElementById('prev-page');
                const nextBtn = document.getElementById('next-page');
                prevBtn && prevBtn.addEventListener('click', async () => {
                    if (currentPage > 1) currentPage--;
                    await renderPage(currentPage);
                    renderPagination();
                });
                nextBtn && nextBtn.addEventListener('click', async () => {
                    const totalPages = Math.ceil(allTasks.length / perPage);
                    if (currentPage < totalPages) currentPage++;
                    await renderPage(currentPage);
                    renderPagination();
                });

                document.querySelectorAll('.page-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const p = Number(e.target.dataset.page);
                        if (!isNaN(p)) {
                            currentPage = p;
                            await renderPage(currentPage);
                            renderPagination();
                        }
                    });
                });
            }

            // Only add pagination when many tasks to avoid clutter
            if (allTasks.length >= 40) renderPagination();
            else paginationEl.innerHTML = "";
        }
    } catch (error) {
        console.error("Error loading tasks:", error);
        container.innerHTML = `<div class="error">Error loading tasks: ${error.message}</div>`;
    }
}

// Handle search form submit: navigate to search results page
const searchForm = document.getElementById('search-form');
if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = document.getElementById('search-input').value.trim();
        if (!q) return;
        window.location.href = `./search-task-result.html?q=${encodeURIComponent(q)}`;
    });
}

// Logout
const logoutBtn = document.getElementById("google-logout-btn-id");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => {
            window.location.href = "./index.html";
        });
    });
}

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

