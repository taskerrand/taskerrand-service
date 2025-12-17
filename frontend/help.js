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

    try {
        // Get user data from backend
        const userData = await api.getCurrentUser();

        // Show admin link if user is admin
        if (userData.is_admin) {
            const adminLink = document.getElementById("admin-link");
            if (adminLink) {
                adminLink.style.display = "block";
            }
        }
    } catch (error) {
        console.error("Error loading user data:", error);
    }
    
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

// Logout button event
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
    const hamburger = document.getElementById("hamburger");
    const navMenu = document.getElementById("nav-menu");

    if (hamburger && navMenu) {
        hamburger.addEventListener("click", () => {
            navMenu.classList.toggle("active");
        });
    }

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
