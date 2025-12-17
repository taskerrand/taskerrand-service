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
        loadProfileInfo(); // Load profile information after user data is loaded
    } catch (error) {
        console.error("Error loading user data:", error);
        displayUserInfo(user, null);
    }
});

function displayUserInfo(user, userData) {
    const usernameEl = document.getElementById("username");
    const profileEl = document.getElementById("profile");

    if (usernameEl) {
        // Display the combined name if available, otherwise use Firebase display name or email
        const displayName = userData ? (userData.name || `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || user.displayName) : user.displayName;
        usernameEl.textContent = `Welcome, ${displayName || user.email}!`;
    }

    if (profileEl) {
        profileEl.src = user.photoURL || "";
        profileEl.alt = user.displayName || "Profile";
    }
}

async function loadProfileInfo() {
    try {
        // Show loading indicator
        const loadingEl = document.getElementById("loading-profile");
        const formEl = document.getElementById("profile-form");

        if (loadingEl) loadingEl.style.display = "block";
        if (formEl) formEl.style.display = "none";

        // Get user profile data from the backend using the api helper method
        const profileData = await api.getCurrentUser();

        // Populate the profile form with fields
        const firstNameInput = document.getElementById("first-name");
        const lastNameInput = document.getElementById("last-name");
        const addressInput = document.getElementById("address");

        if (firstNameInput) {
            firstNameInput.value = profileData.first_name || '';
        }

        if (lastNameInput) {
            lastNameInput.value = profileData.last_name || '';
        }

        if (addressInput) {
            addressInput.value = profileData.address || '';
        }

        // Hide loading, show form
        if (loadingEl) loadingEl.style.display = "none";
        if (formEl) formEl.style.display = "block";

        // Add event listeners for form submission and additional buttons
        const profileForm = document.getElementById("profile-form");
        const saveProfileBtn = document.getElementById("save-profile-btn");

        if (profileForm) {
            profileForm.onsubmit = handleProfileUpdate;
        }

        if (saveProfileBtn) {
            saveProfileBtn.onclick = handleProfileSave;
        }
    } catch (error) {
        console.error("Error loading profile:", error);
        const loadingEl = document.getElementById("loading-profile");
        if (loadingEl) {
            loadingEl.textContent = `Error loading profile: ${error.message}`;
            loadingEl.style.color = "red";
        }
    }
}

async function handleProfileUpdate(event) {
    event.preventDefault(); // Prevent default form submission

    try {
        const firstNameInput = document.getElementById("first-name");
        const lastNameInput = document.getElementById("last-name");
        const addressInput = document.getElementById("address");
        const messageEl = document.getElementById("profile-message");

        // Get the values
        const firstName = firstNameInput.value.trim();
        const lastName = lastNameInput.value.trim();
        const address = addressInput.value.trim();

        // Basic validation
        if (!firstName) {
            showMessage("Please enter your first name", "error");
            return;
        }

        if (firstName.length < 1 || firstName.length > 50) {
            showMessage("First name must be between 1 and 50 characters", "error");
            return;
        }

        if (lastName && (lastName.length < 1 || lastName.length > 50)) {
            showMessage("Last name must be between 1 and 50 characters if provided", "error");
            return;
        }

        if (address && (address.length < 5 || address.length > 200)) {
            showMessage("Address must be between 5 and 200 characters if provided", "error");
            return;
        }

        // Prepare the profile data with separate first and last name
        const fullName = `${firstName} ${lastName}`.trim(); // Combine for the full name display
        const profileData = {
            first_name: firstName,
            last_name: lastName,
            name: fullName,
            address: address
        };

        // Update the profile via API using the helper method
        const updatedData = await api.updateUserProfile(profileData);

        // Update the user data in the global variable
        userData = updatedData;

        // Update the welcome message with the new name
        const usernameEl = document.getElementById("username");
        if (usernameEl) {
            usernameEl.textContent = `Welcome, ${updatedData.name || updatedData.email}!`;
        }

        showMessage("Profile updated successfully!", "success");
    } catch (error) {
        console.error("Error updating profile:", error);
        showMessage(`Error updating profile: ${error.message}`, "error");
    }
}

async function handleProfileSave(event) {
    event.preventDefault(); // Prevent default button behavior

    try {
        const firstNameInput = document.getElementById("first-name");
        const lastNameInput = document.getElementById("last-name");
        const addressInput = document.getElementById("address");

        // Get the values
        const firstName = firstNameInput.value.trim();
        const lastName = lastNameInput.value.trim();
        const address = addressInput.value.trim();

        // Basic validation
        if (!firstName) {
            showMessage("Please enter your first name", "error");
            return;
        }

        if (firstName.length < 1 || firstName.length > 50) {
            showMessage("First name must be between 1 and 50 characters", "error");
            return;
        }

        if (lastName && (lastName.length < 1 || lastName.length > 50)) {
            showMessage("Last name must be between 1 and 50 characters if provided", "error");
            return;
        }

        if (address && (address.length < 5 || address.length > 200)) {
            showMessage("Address must be between 5 and 200 characters if provided", "error");
            return;
        }

        // Prepare the profile data with separate first and last name
        const fullName = `${firstName} ${lastName}`.trim(); // Combine for the full name display
        const profileData = {
            first_name: firstName,
            last_name: lastName,
            name: fullName,
            address: address
        };

        // Save the profile via API using the helper method
        const updatedData = await api.updateUserProfile(profileData);

        // Update the user data in the global variable
        userData = updatedData;

        // Update the welcome message with the new name
        const usernameEl = document.getElementById("username");
        if (usernameEl) {
            usernameEl.textContent = `Welcome, ${updatedData.name || updatedData.email}!`;
        }

        showMessage("Profile saved successfully!", "success");
    } catch (error) {
        console.error("Error saving profile:", error);
        showMessage(`Error saving profile: ${error.message}`, "error");
    }
}

function showMessage(message, type) {
    const messageEl = document.getElementById("profile-message");
    if (!messageEl) return;

    messageEl.textContent = message;
    messageEl.style.display = "block";

    if (type === "success") {
        messageEl.style.backgroundColor = "#d4edda";
        messageEl.style.color = "#155724";
        messageEl.style.border = "1px solid #c3e6cb";

        // Auto-hide success message after 3 seconds
        setTimeout(() => {
            messageEl.style.display = "none";
        }, 3000);
    } else {
        messageEl.style.backgroundColor = "#f8d7da";
        messageEl.style.color = "#721c24";
        messageEl.style.border = "1px solid #f5c6cb";
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
                try {
                    const u = await api.getUser(task.poster_id);
                    posterName = u.name || u.email || posterName;
                } catch (e) { }

                // Check if the task has a seeker/acceptor
                let seekerName = null;
                if (task.seeker_id) {
                    try {
                        const seeker = await api.getUser(task.seeker_id);
                        seekerName = seeker.name || seeker.email || 'Unknown';
                    } catch (e) { }
                }

                return `
                <div class="task-card" onclick="window.location.href='./task-detail.html?id=${task.id}'">
                    <a></a>
                    <h3>Task: ${task.title}</h3>
                    <div class="task-creator">Created by: <a href="./other-users-dashboard.html?user_id=${task.poster_id}">${posterName}</a></div>
                    ${seekerName ? `<div class="task-acceptor">Accepted by: <a href="./other-users-dashboard.html?user_id=${task.seeker_id}">${seekerName}</a></div>` : ''}
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
    // Helper: ensure backend naive datetimes are treated as UTC when parsing in the browser
    function formatNotificationDate(dateStr) {
        if (!dateStr) return '';
        // If string already contains timezone info (Z or ±HH:MM), parse directly
        if (/[Zz]|[+\-]\d{2}:\d{2}$/.test(dateStr)) {
            return new Date(dateStr).toLocaleString();
        }
        // Otherwise, assume UTC and append Z
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

