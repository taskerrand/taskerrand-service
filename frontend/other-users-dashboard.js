import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";
import { api } from "./api.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUser = null;
let userData = null;
let targetUser = null;

const urlParams = new URLSearchParams(window.location.search);
const targetUserId = urlParams.get('user_id');

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "./index.html";
        return;
    }

    currentUser = user;

    try {
        userData = await api.getCurrentUser();
        // show admin link if applicable
        if (userData && userData.is_admin) {
            const adminLink = document.getElementById('admin-link');
            if (adminLink) adminLink.style.display = 'block';
        }
    } catch (e) {
        console.error('Could not load current user data', e);
    }

    try {
        await loadTargetUser();
        await loadUserTasksWithFilter(null);
    } catch (e) {
        console.error('Error loading profile:', e);
        const tasksContainer = document.getElementById('user-tasks');
        if (tasksContainer) tasksContainer.innerHTML = `<div class="error">Could not load profile.</div>`;
    }
});

async function loadTargetUser() {
    if (!targetUserId) {
        document.getElementById('user-dashboard-title').textContent = "User not specified";
        return;
    }

    try {
        targetUser = await api.getUser(targetUserId);
        const name = targetUser.name || targetUser.email || 'User';
        document.getElementById('user-dashboard-title').textContent = `${name}'s Dashboard`;
        document.getElementById('user-tasks-title').textContent = `${name}'s Tasks`;
    } catch (e) {
        console.error('Error fetching target user:', e);
        document.getElementById('user-dashboard-title').textContent = "User not found";
        document.getElementById('user-tasks-title').textContent = "User's Tasks";
    }
}

async function loadUserTasksWithFilter(statusFilter = null) {
    try {
        let tasks = [];
        // Prefer admin endpoint to fetch all tasks, fallback otherwise
        try {
            tasks = await api.getAllTasks();
        } catch (e) {
            // fallback: try to get general tasks listing and filter locally
            try {
                tasks = await api.getTasks();
            } catch (e2) {
                throw e; // original error
            }
        }

        // Filter tasks that involve the target user (posted or accepted)
        const filteredByUser = tasks.filter(t => String(t.poster_id) === String(targetUserId) || String(t.seeker_id) === String(targetUserId));

        // Apply status filter if present
        const visibleTasks = statusFilter ? filteredByUser.filter(t => t.status === statusFilter) : filteredByUser;

        // Update stats
        const stats = {
            posted: filteredByUser.filter(t => String(t.poster_id) === String(targetUserId)).length,
            accepted: filteredByUser.filter(t => String(t.seeker_id) === String(targetUserId)).length,
            completed: filteredByUser.filter(t => t.status === 'completed' && String(t.seeker_id) === String(targetUserId)).length,
            active: filteredByUser.filter(t => (t.status === 'ongoing' || t.status === 'pending_confirmation') && (String(t.poster_id) === String(targetUserId) || String(t.seeker_id) === String(targetUserId))).length
        };

        const statsContainer = document.getElementById('stats');
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

        const tasksContainer = document.getElementById('user-tasks');
        if (!tasksContainer) return;

        if (visibleTasks.length === 0) {
            tasksContainer.innerHTML = `<div class="empty-state"><p>No tasks match the selected filter.</p></div>`;
            return;
        }

        const rendered = await Promise.all(visibleTasks.map(async (task) => {
            let posterName = 'Unknown';
            try { const u = await api.getUser(task.poster_id); posterName = u.name || u.email || posterName; } catch(e) {}
            return `
                <div class="task-card" onclick="window.location.href='./task-detail.html?id=${task.id}'">
                    <h3>Task: ${task.title}</h3>
                    <div class="task-creator">Created by: <a href="./other-users-dashboard.html?user_id=${task.poster_id}">${posterName}</a></div>
                    <p>Description: ${task.description ? task.description.substring(0, 100) : ''}${task.description && task.description.length > 100 ? '...' : ''}</p>
                    <div class="task-meta">
                        <span style="display: block" class="task-status status-${task.status}">Status: ${task.status.replace('_', ' ')}</span>
                        <span><strong>Payment: ₱${(task.payment||0).toFixed(2)}</strong></span>
                    </div>
                </div>
            `;
        }));

        tasksContainer.innerHTML = rendered.join('');

    } catch (error) {
        console.error('Error loading user tasks:', error);
        const tasksContainer = document.getElementById('user-tasks');
        if (tasksContainer) tasksContainer.innerHTML = `<div class="error">Error loading tasks.</div>`;
    }
}

window.filterUserTasks = function() {
    const filter = document.getElementById('user-task-filter').value;
    loadUserTasksWithFilter(filter || null);
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
