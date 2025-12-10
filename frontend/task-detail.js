import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";
import { api } from "./api.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUser = null;
let userData = null;
let taskData = null;
let map = null;
let seekerFeedbackList = null;
let userCache = {};
let taskPollTimer = null;

// Get task ID from URL
const urlParams = new URLSearchParams(window.location.search);
const taskId = urlParams.get("id");

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
        usernameEl.textContent = user.displayName || user.email;
    }
    
    if (profileEl) {
        profileEl.src = user.photoURL || "";
    }
    
    try {
        userData = await api.getCurrentUser();
        await loadTask();
        loadNotifications();
    } catch (error) {
        console.error("Error loading user data:", error);
    }
});

async function loadTask() {
    if (!taskId) {
        document.getElementById("task-container").innerHTML = "<div class='error'>Task ID not provided</div>";
        return;
    }
    
    try {
        taskData = await api.getTask(taskId);
        // prime cache with poster and seeker
        if (taskData.poster_id) {
            try { userCache[taskData.poster_id] = (await api.getUser(taskData.poster_id)).name || null; } catch(e) { /* ignore */ }
        }
        if (taskData.seeker_id) {
            try { userCache[taskData.seeker_id] = (await api.getUser(taskData.seeker_id)).name || null; } catch(e) { /* ignore */ }
        }
        seekerFeedbackList = null;
        displayTask();
        setupActions();
        setupReportButton();
        await displayFeedbackSection();
        if (taskData.status === "ongoing" || taskData.status === "pending_confirmation") {
            loadMessages();
            document.getElementById("chat-container").style.display = "block";
        }
        if (taskData.status === "completed" && taskData.seeker_id) {
            await loadSeekerRating(taskData.seeker_id);
        }
    } catch (error) {
        document.getElementById("task-container").innerHTML = `<div class='error'>Error loading task: ${error.message}</div>`;
    }
    // Ensure polling is started once we have initial task data
    startTaskPolling();
}

function startTaskPolling() {
    // Start polling only once per page
    if (taskPollTimer) return;
    // Poll every 5 seconds
    taskPollTimer = setInterval(async () => {
        try {
            const updated = await api.getTask(taskId);
            // If status or seeker changed, update the UI
            const oldStatus = taskData ? taskData.status : null;
            const oldSeeker = taskData ? String(taskData.seeker_id) : null;
            const newSeeker = updated ? String(updated.seeker_id) : null;
            if (!taskData || updated.status !== oldStatus || newSeeker !== oldSeeker) {
                taskData = updated;
                displayTask();
                setupActions();
                // refresh feedback and messages visibility if needed
                displayFeedbackSection();
                if (taskData.status === "ongoing" || taskData.status === "pending_confirmation") {
                    loadMessages();
                    const chatEl = document.getElementById("chat-container");
                    if (chatEl) chatEl.style.display = "block";
                } else {
                    const chatEl = document.getElementById("chat-container");
                    if (chatEl) chatEl.style.display = "none";
                }
            }
        } catch (e) {
            console.error("Task polling error:", e);
        }
    }, 5000);
}

function stopTaskPolling() {
    if (taskPollTimer) {
        clearInterval(taskPollTimer);
        taskPollTimer = null;
    }
}

// Clean up polling when the user leaves the page
window.addEventListener('beforeunload', () => {
    stopTaskPolling();
});

function displayTask() {
    const container = document.getElementById("task-container");
    
    container.innerHTML = `
        <h2>Title: ${taskData.title}</h2>
        ${taskData.poster_id ? `<div class="task-creator">Created by: <a class="creator-link" href="./other-users-dashboard.html?user_id=${taskData.poster_id}">${userCache[taskData.poster_id] || 'Unknown'}</a></div>` : ''}
        <div style="margin-bottom: 1rem;">
            <span class="task-status status-${taskData.status}">Status: ${taskData.status.replace('_', ' ')}</span>
        </div>
        <p><strong>Description:</strong></p>
        <p>${taskData.description}</p>
        <div style="margin-top: 1.5rem;">
            <p><strong>Payment:</strong> ₱${taskData.payment.toFixed(2)}</p>
            ${taskData.contact_number ? `<p><strong>Contact:</strong> ${taskData.contact_number}</p>` : ''}
            ${taskData.schedule ? `<p><strong>Schedule:</strong> ${new Date(taskData.schedule).toLocaleString()}</p>` : ''}
            ${taskData.location_address ? `<p><strong>Location:</strong> ${taskData.location_address}</p>` : ''}
        </div>
        <div style="position: relative; margin-top: 1rem;">
            <div id="map" style="width: 100%; height: 300px; border-radius: 6px;"></div>
            <!-- Report button placed as an overlay on the right side of the map -->
            <button id="report-task-btn" class="side-report-btn" style="position: absolute; top: 12px; right: 12px; padding: 8px 12px; background-color: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; z-index: 1000;">
                Report This Task
            </button>
        </div>
    `;
    
    // Initialize map after a short delay to ensure DOM is ready
    setTimeout(initMap, 100);
}

function initMap() {
    if (!taskData) return;
    
    const taskLocation = [taskData.location_lat, taskData.location_lng];
    
    // Create map
    map = L.map('map').setView(taskLocation, 15);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Add marker
    L.marker(taskLocation)
        .addTo(map)
        .bindPopup(taskData.title)
        .openPopup();
};

function setupReportButton() {
    const reportBtn = document.getElementById("report-task-btn");
    if (reportBtn) {
        // Hide or disable reporting for the task poster (cannot report own task)
        const isPoster = userData && taskData && String(userData.id) === String(taskData.poster_id);
        if (isPoster) {
            // hide the button to avoid confusion
            reportBtn.style.display = 'none';
            reportBtn.setAttribute('aria-hidden', 'true');
            return;
        }

        // Non-blocking navigation to the report form for other users
        reportBtn.addEventListener("click", () => {
            window.location.href = `./report-task.html?task_id=${taskId}`;
        });
    }
}

function setupActions() {
    const actionsContainer = document.getElementById("actions-container");
    const actionButtons = document.getElementById("action-buttons");
    
    if (!userData) return;
    
    // Normalize IDs to string to avoid type-mismatch issues (numbers vs strings)
    const isPoster = String(taskData.poster_id) === String(userData.id);
    const isSeeker = String(taskData.seeker_id) === String(userData.id);
    
    let buttons = [];
    
    if (taskData.status === "available") {
        if (isPoster) {
            // Edit button to the LEFT of Cancel (poster may edit an available task)
            buttons.push(`<a href="./post-task.html?id=${taskData.id}&edit=1" class="btn btn-outline">Edit</a>`);
            buttons.push(`<button class="btn btn-danger" onclick="cancelTask()">Cancel Task</button>`);
        } else {
            buttons.push(`<button class="btn btn-primary" onclick="acceptTask()">Accept Task</button>`);
        }
    } else if (taskData.status === "ongoing") {
        // Only the seeker (the one who accepted) can mark complete or cancel an ongoing task.
        if (isSeeker) {
            buttons.push(`<button class="btn btn-secondary" onclick="completeTask()">Mark as Done</button>`);
            buttons.push(`<button class="btn btn-danger" onclick="cancelTask()">Cancel Task</button>`);
        }
    } else if (taskData.status === "pending_confirmation") {
        if (isPoster) {
            buttons.push(`<button class="btn btn-secondary" onclick="confirmTask()">Confirm Completion</button>`);
        }
    } else if (taskData.status === "completed") {
        if (isPoster && !taskData.feedback) {
            buttons.push(`<button class="btn btn-primary" onclick="showFeedbackForm()">Leave Feedback</button>`);
        }
    }
    
    if (buttons.length > 0) {
        actionButtons.innerHTML = buttons.join(" ");
        actionsContainer.style.display = "block";
    } else {
        // Clear any previous buttons and hide container when no actions apply
        actionButtons.innerHTML = "";
        actionsContainer.style.display = "none";
    }
}

async function acceptTask() {
    try {
        await api.acceptTask(taskId);
        alert("Task accepted successfully!");
        loadTask();
    } catch (error) {
        alert("Error: " + error.message);
    }
}

async function completeTask() {
    if (!confirm("Mark this task as complete?")) return;
    
    try {
        await api.completeTask(taskId);
        alert("Task marked as complete! Waiting for poster confirmation.");
        loadTask();
    } catch (error) {
        alert("Error: " + error.message);
    }
}

async function confirmTask() {
    if (!confirm("Confirm that this task is completed?")) return;
    
    try {
        await api.confirmTask(taskId);
        alert("Task confirmed as completed!");
        loadTask();
    } catch (error) {
        alert("Error: " + error.message);
    }
}

async function cancelTask() {
    if (!confirm("Are you sure you want to cancel this task?")) return;
    
    try {
        await api.cancelTask(taskId);
        alert("Task cancelled.");
        loadTask();
    } catch (error) {
        alert("Error: " + error.message);
    }
}

function showFeedbackForm() {
    const rating = prompt("Rate the seeker (1-5):");
    if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
        alert("Please enter a valid rating between 1 and 5");
        return;
    }
    
    const comment = prompt("Leave a comment (optional):");
    
    createFeedback(parseInt(rating), comment || null);
}

async function createFeedback(rating, comment) {
    try {
        await api.createFeedback(taskId, taskData.seeker_id, rating, comment);
        alert("Feedback submitted successfully!");
        loadTask();
    } catch (error) {
        alert("Error: " + error.message);
    }
}

async function loadMessages() {
    try {
        const messages = await api.getTaskMessages(taskId);
        const messagesContainer = document.getElementById("messages");
        
        // Render messages with sender name and modern chat alignment
        const rendered = await Promise.all(messages.map(async (msg) => {
            const isSent = String(msg.sender_id) === String(userData.id);
            const time = formatLocalDateTime(msg.created_at, { dateOnly: false });
            // get sender name from cache or API
            let senderName = userCache[msg.sender_id];
            if (!senderName) {
                try {
                    const u = await api.getUser(msg.sender_id);
                    senderName = u.name || u.email || 'User';
                    userCache[msg.sender_id] = senderName;
                } catch (e) {
                    senderName = 'User';
                }
            }

            return `
                <div class="message ${isSent ? 'sent' : 'received'}">
                    ${!isSent ? `<div class="sender-name">${senderName}</div>` : ''}
                    <div>${msg.content}</div>
                    <div class="message-time">${time}</div>
                </div>
            `;
        }));

        messagesContainer.innerHTML = rendered.join('');
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
        console.error("Error loading messages:", error);
    }
}

// Send message
document.getElementById("send-message-btn").addEventListener("click", async () => {
    const input = document.getElementById("message-input");
    const content = input.value.trim();
    
    if (!content) return;
    
    try {
        await api.sendMessage(taskId, content);
        input.value = "";
        loadMessages();
    } catch (error) {
        alert("Error sending message: " + error.message);
    }
});

// Enter key to send
document.getElementById("message-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        document.getElementById("send-message-btn").click();
    }
});

async function loadSeekerRating(seekerId) {
    try {
        seekerFeedbackList = await api.getUserFeedback(seekerId);
    } catch (error) {
        console.error("Error loading seeker feedback:", error);
        seekerFeedbackList = [];
    } finally {
        await displayFeedbackSection();
    }
}

async function displayFeedbackSection() {
    const feedbackContainer = document.getElementById("feedback-container");
    const feedbackContent = document.getElementById("feedback-content");
    const ratingSummary = document.getElementById("seeker-rating-summary");

    if (!feedbackContainer) {
        return;
    }

    if (!taskData || taskData.status !== "completed") {
        feedbackContainer.style.display = "none";
        return;
    }

    feedbackContainer.style.display = "block";

    if (taskData.feedback) {
        const { rating, comment, created_at } = taskData.feedback;
        // Ensure we have names for poster and seeker
        let posterName = userCache[taskData.poster_id];
        if (!posterName && taskData.poster_id) {
            try { posterName = (await api.getUser(taskData.poster_id)).name || null; userCache[taskData.poster_id] = posterName; } catch(e) { posterName = 'Poster'; }
        }
        let seekerName = userCache[taskData.seeker_id];
        if (!seekerName && taskData.seeker_id) {
            try { seekerName = (await api.getUser(taskData.seeker_id)).name || null; userCache[taskData.seeker_id] = seekerName; } catch(e) { seekerName = 'Seeker'; }
        }

        feedbackContent.innerHTML = `
            <div class="task-card" style="margin-bottom: 1rem;">
                <p><strong>Task Feedback</strong></p>
                <p style="margin:0.25rem 0;"><strong>From:</strong> ${posterName || 'Poster'} &nbsp; <strong>To:</strong> ${seekerName || 'Seeker'}</p>
                <p class="task-status" style="margin: 0.5rem 0;">${renderStars(rating)} (${rating}/5)</p>
                ${comment ? `<p>"${comment}"</p>` : "<p>No written comment.</p>"}
                <p class="message-time">Submitted ${formatLocalDateTime(created_at, { dateOnly: false })}</p>
            </div>
        `;
    } else {
        feedbackContent.innerHTML = "<p>No feedback has been submitted yet.</p>";
    }

    if (!taskData.seeker_id) {
        ratingSummary.innerHTML = "";
        return;
    }

    if (seekerFeedbackList === null) {
        ratingSummary.innerHTML = "<p>Loading seeker rating...</p>";
        return;
    }

    if (seekerFeedbackList.length === 0) {
        ratingSummary.innerHTML = "<p>The seeker has not received any ratings yet.</p>";
        return;
    }

    const total = seekerFeedbackList.reduce((sum, item) => sum + item.rating, 0);
    const averageRaw = total / seekerFeedbackList.length;
    const average = averageRaw.toFixed(1);

    ratingSummary.innerHTML = `
        <p><strong>Seeker Score:</strong> ${renderStars(Math.round(averageRaw))} ${average}/5</p>
        <p>${seekerFeedbackList.length} review${seekerFeedbackList.length > 1 ? "s" : ""} in total.</p>
    `;
}

function renderStars(score) {
    const clamped = Math.max(0, Math.min(5, score));
    const fullStars = "★".repeat(clamped);
    const emptyStars = "☆".repeat(5 - clamped);
    return `<span class="rating-stars" style="color: #f5b301; letter-spacing: 2px;">${fullStars}${emptyStars}</span>`;
}

// Parse various timestamp formats and return a Date object normalized to user's local timezone
function parseTimestampToDate(ts) {
    if (!ts) return new Date(NaN);

    // If number (seconds or milliseconds)
    if (typeof ts === 'number') {
        // If looks like seconds (10 digits), convert to ms
        if (ts.toString().length === 10) return new Date(ts * 1000);
        return new Date(ts);
    }

    // If it's already a Date
    if (ts instanceof Date) return ts;

    // Trim
    let s = String(ts).trim();

    // If pure digits (epoch seconds or ms)
    if (/^\d{10}$/.test(s)) return new Date(parseInt(s, 10) * 1000);
    if (/^\d{13}$/.test(s)) return new Date(parseInt(s, 10));

    // Replace space between date and time with 'T' to help Date parser
    // e.g. '2025-12-02 13:00:00' -> '2025-12-02T13:00:00'
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:?\d{0,2}/.test(s)) {
        s = s.replace(' ', 'T');
        // If no timezone offset or Z present, assume backend stored as UTC and append 'Z'
        if (!/[zZ]|[+\-]\d{2}:?\d{2}$/.test(s)) {
            s = s + 'Z';
        }
        return new Date(s);
    }

    // If ISO-like but missing 'T' between date and time
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
        // If no timezone info, assume UTC (append Z) to normalize
        if (!/[zZ]|[+\-]\d{2}:?\d{2}$/.test(s)) {
            s = s + 'Z';
        }
        return new Date(s);
    }

    // Fallback to Date constructor
    return new Date(s);
}

function formatLocalDateTime(ts, opts = {}) {
    const date = parseTimestampToDate(ts);
    if (isNaN(date.getTime())) return '';
    // Default to show date+time if requested; otherwise time only
    const { dateOnly = false } = opts;
    if (dateOnly) {
        return date.toLocaleDateString();
    }
    // Show local time with hour:minute and short date for context
    return date.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', year: 'numeric', month: 'short', day: 'numeric' });
}

// Make functions global
window.acceptTask = acceptTask;
window.completeTask = completeTask;
window.confirmTask = confirmTask;
window.cancelTask = cancelTask;
window.showFeedbackForm = showFeedbackForm;

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

// Logout
const logoutBtn = document.getElementById("google-logout-btn-id");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => {
            window.location.href = "./index.html";
        });
    });
}

