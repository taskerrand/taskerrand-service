import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";
import { api } from "./api.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let userData = null;

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
        userData = await api.getCurrentUser();
        
        if (!userData.is_admin) {
            alert("Access denied. Admin privileges required.");
            window.location.href = "./dashboard.html";
            return;
        }
        
        loadAdminStats();
        loadAllTasks();
        loadAllUsers();
    } catch (error) {
        console.error("Error loading admin data:", error);
        if (error.message.includes("403") || error.message.includes("Admin")) {
            alert("Access denied. Admin privileges required.");
            window.location.href = "./dashboard.html";
        }
    }
});

async function loadAdminStats() {
    try {
        const tasks = await api.getAllTasks();
        const users = await api.getAllUsers();
        
        const stats = {
            total_tasks: tasks.length,
            available: tasks.filter(t => t.status === "available").length,
            ongoing: tasks.filter(t => t.status === "ongoing").length,
            completed: tasks.filter(t => t.status === "completed").length,
            total_users: users.length
        };
        
        const statsContainer = document.getElementById("admin-stats");
        statsContainer.innerHTML = `
            <div class="stat-card">
                <h3>${stats.total_users}</h3>
                <p>Total Users</p>
            </div>
            <div class="stat-card">
                <h3>${stats.total_tasks}</h3>
                <p>Total Tasks</p>
            </div>
            <div class="stat-card">
                <h3>${stats.available}</h3>
                <p>Available Tasks</p>
            </div>
            <div class="stat-card">
                <h3>${stats.ongoing}</h3>
                <p>Ongoing Tasks</p>
            </div>
            <div class="stat-card">
                <h3>${stats.completed}</h3>
                <p>Completed Tasks</p>
            </div>
        `;
    } catch (error) {
        console.error("Error loading admin stats:", error);
    }
}

async function loadAllTasks(statusFilter = null) {
    const container = document.getElementById("tasks-container");
    
    try {
        const tasks = await api.getAllTasks(statusFilter);
        
        if (tasks.length === 0) {
            container.innerHTML = "<p class='loading'>No tasks found.</p>";
            return;
        }
        
        const rendered = await Promise.all(tasks.map(async (task) => {
            let posterName = 'Unknown';
            try { const u = await api.getUser(task.poster_id); posterName = u.name || u.email || posterName; } catch(e) {}
            return `
            <div class="task-card">
                <h3>Title: ${task.title}</h3>
                <div class="task-creator">Created by: ${posterName}</div>
                <p>Description: ${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}</p>
                <div class="task-meta">
                    <span style="display: block" class="task-status status-${task.status}">Status: ${task.status.replace('_', ' ')}</span>
                 
                    <span><strong>₱${task.payment.toFixed(2)}</strong></span>
                </div>
                <div id="admin-tasks-buttons" style="margin-top: 1rem;">
                    <a id="admin-view-task-btn" href="./task-detail.html?id=${task.id}" class="btn btn-primary" style="margin-right: 0.5rem; width:100px; ">View</a>
                    <button id="admin-delete-task-btn" class="btn btn-danger" onclick="deleteTask(${task.id})">Delete</button>
                </div>
            </div>
        `;
        }));

        container.innerHTML = rendered.join('');
    } catch (error) {
        console.error("Error loading tasks:", error);
        container.innerHTML = `<div class="error">Error loading tasks: ${error.message}</div>`;
    }
}

async function loadAllUsers() {
    const container = document.getElementById("users-container");
    
    try {
        const users = await api.getAllUsers();
        
        if (users.length === 0) {
            container.innerHTML = "<p class='loading'>No users found.</p>";
            return;
        }
        
        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: var(--bg-color);">
                        <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--border-color);">ID</th>
                        <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--border-color);">Name</th>
                        <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--border-color);">Email</th>
                        <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--border-color);">Admin</th>
                        <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--border-color);">Joined</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <td style="padding: 0.75rem;">${user.id}</td>
                            <td style="padding: 0.75rem;">${user.name || 'N/A'}</td>
                            <td style="padding: 0.75rem;">${user.email}</td>
                            <td style="padding: 0.75rem;">${user.is_admin ? 'Yes' : 'No'}</td>
                            <td style="padding: 0.75rem;">${new Date(user.created_at).toLocaleDateString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error("Error loading users:", error);
        container.innerHTML = `<div class="error">Error loading users: ${error.message}</div>`;
    }
}

window.filterTasks = function() {
    const filter = document.getElementById("task-filter").value;
    loadAllTasks(filter || null);
};

window.deleteTask = async function(taskId) {
    if (!confirm("Are you sure you want to delete this task? This action cannot be undone.")) {
        return;
    }
    
    try {
        await api.adminDeleteTask(taskId);
        alert("Task deleted successfully.");
        loadAllTasks();
        loadAdminStats();
    } catch (error) {
        alert("Error deleting task: " + error.message);
    }
};

// Logout
const logoutBtn = document.getElementById("google-logout-btn-id");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => {
            window.location.href = "./index.html";
        });
    });
}

