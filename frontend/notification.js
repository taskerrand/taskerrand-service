import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { api, auth } from "./api.js";

function formatNotificationDate(created_at) {
    if (!created_at) return '';
    // If timestamp string has timezone info, leave it. Otherwise assume UTC and append Z.
    const hasTZ = /[zZ]|[+\-]\d{2}:?\d{2}/.test(created_at);
    const dateStr = hasTZ ? created_at : `${created_at}Z`;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? created_at : d.toLocaleString();
}

async function renderNotifications(notifications) {
    const notificationList = document.getElementById("notification-list");
    const notificationBadge = document.getElementById("notification-badge");
    if (!notificationList) return;

    const unreadCount = notifications.filter(n => !n.seen).length;
    if (notificationBadge) {
        notificationBadge.textContent = unreadCount;
        notificationBadge.style.display = unreadCount > 0 ? "block" : "none";
    }

    if (notifications.length === 0) {
        notificationList.innerHTML = '<div class="notification-empty">No notifications</div>';
        return;
    }

    notificationList.innerHTML = notifications.map(n => {
        const viewLink = n.task_id ? ` <a class="notification-view-link" data-id="${n.id}" href="./task-detail.html?id=${n.task_id}">View</a>` : '';
        const deleteBtn = ` <button class="notification-delete-btn" data-id="${n.id}">Delete</button>`;
        return `
            <div class="notification-item ${n.seen ? '' : 'unread'}" data-id="${n.id}">
                <div class="notification-title">${n.title}</div>
                <div class="notification-message">${n.message}</div>
                <div class="notification-time">${formatNotificationDate(n.created_at)}</div>
                <div class="notification-actions">
                    ${viewLink}
                    ${deleteBtn}
                </div>
            </div>
        `;
    }).join('');

    // Attach event listeners
    // View links: mark as read but allow default anchor behavior (so ctrl+click/new tab works)
    notificationList.querySelectorAll('.notification-view-link').forEach(a => {
        const id = a.getAttribute('data-id');
        a.addEventListener('click', (e) => {
            // Mark as read in background
            try {
                api.markNotificationRead(parseInt(id)).catch(() => {});
            } catch (err) {
                console.error('Failed to mark notification read', err);
            }
            // Let the anchor navigate (supports Ctrl/Cmd+click for new tab)
        });
    });

    // Delete buttons
    notificationList.querySelectorAll('.notification-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = parseInt(btn.getAttribute('data-id'));
            if (!confirm('Delete this notification?')) return;
            try {
                await api.deleteNotification(id);
                // remove item from DOM and update badge
                const item = notificationList.querySelector(`.notification-item[data-id="${id}"]`);
                if (item) item.remove();
                // Update badge
                const remaining = notificationList.querySelectorAll('.notification-item.unread').length;
                const notificationBadge = document.getElementById('notification-badge');
                if (notificationBadge) {
                    notificationBadge.textContent = remaining;
                    notificationBadge.style.display = remaining > 0 ? 'block' : 'none';
                }
            } catch (err) {
                console.error('Failed to delete notification', err);
                alert('Failed to delete notification');
            }
        });
    });
}

async function loadNotifications() {
    try {
        const notifications = await api.getNotifications();
        await renderNotifications(notifications);
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function initNotificationBell() {
    const bell = document.getElementById('notification-bell');
    const dropdown = document.getElementById('notification-dropdown');
    if (!bell || !dropdown) return;

    bell.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });

    window.addEventListener('click', () => {
        if (dropdown.classList.contains('show')) dropdown.classList.remove('show');
    });

    dropdown.addEventListener('click', (e) => e.stopPropagation());
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        loadNotifications();
        initNotificationBell();
    }
});

// Also try to initialize on DOMContentLoaded in case auth state is already resolved
window.addEventListener('DOMContentLoaded', () => {
    initNotificationBell();
    // attempt to load if auth is already available
    if (auth && auth.currentUser) loadNotifications();
});
