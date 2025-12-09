import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";
import { api } from "./api.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUser = null;
let userData = null;

// Get task ID from URL
const urlParams = new URLSearchParams(window.location.search);
const taskId = urlParams.get("task_id");

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
        // Show admin link if user is admin
        if (userData.is_admin) {
            const adminLink = document.getElementById("admin-link");
            if (adminLink) {
                adminLink.style.display = "block";
            }
        }
        // Prevent reporting your own task: fetch task and hide form if poster
        if (taskId) {
            try {
                const task = await api.getTask(taskId);
                if (task && String(task.poster_id) === String(userData.id)) {
                    const form = document.getElementById('report-form');
                    if (form) form.style.display = 'none';
                    showMessage("You cannot report your own task.", "error");
                }
            } catch (e) {
                // ignore; task might not be accessible to this user
            }
        }
    } catch (error) {
        console.error("Error loading user data:", error);
    }
});

// Handle form submission
document.getElementById("report-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!taskId) {
        showMessage("Error: Task ID not provided", "error");
        return;
    }

    const reportType = document.getElementById("report-type").value.trim();
    const description = document.getElementById("description").value.trim();

    if (!reportType) {
        showMessage("Please select a report type", "error");
        return;
    }

    try {
        await api.createReport(taskId, reportType, description || null);
        showMessage("Report submitted successfully! Thank you for helping keep Taskerrand safe.", "success");
        
        // Redirect after 2 seconds
        setTimeout(() => {
            window.location.href = "./task-detail.html?id=" + taskId;
        }, 2000);
    } catch (error) {
        showMessage("Error submitting report: " + error.message, "error");
    }
});

function showMessage(message, type) {
    const messageContainer = document.getElementById("message-container");
    messageContainer.innerHTML = `<div class="${type}">${message}</div>`;
}

// Logout button event
const logoutBtn = document.getElementById("google-logout-btn-id");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => {
            window.location.href = "./index.html";
        });
    });
}
