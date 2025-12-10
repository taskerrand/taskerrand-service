import { getAuth } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { firebaseConfig, API_URL } from "./config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Get Firebase ID token for API requests
async function getAuthToken() {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("User not authenticated");
    }
    return await user.getIdToken();
}

// API request helper
async function apiRequest(endpoint, options = {}) {
    const token = await getAuthToken();
    console.log("DEBUG: Token obtained (first 20 chars):", token.substring(0, 20) + "...");
    const url = `${API_URL}${endpoint}`;

    const defaultOptions = {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    };

    console.log("DEBUG: Making request to:", url);
    console.log("DEBUG: Authorization header:", `Bearer ${token.substring(0, 20)}...`);

    const response = await fetch(url, {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...(options.headers || {})
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    if (response.status === 204) {
        return null;
    }

    return await response.json();
}

// API methods
export const api = {
    // User endpoints
    getCurrentUser: () => apiRequest("/api/users/me"),
    getUser: (userId) => apiRequest(`/api/users/${userId}`),

    // Task endpoints
    getTasks: (statusFilter = null) => {
        const params = statusFilter ? `?status_filter=${statusFilter}` : "";
        return apiRequest(`/api/tasks${params}`);
    },
    getTask: (taskId) => apiRequest(`/api/tasks/${taskId}`),
    createTask: (taskData) => apiRequest("/api/tasks", {
        method: "POST",
        body: JSON.stringify(taskData)
    }),
    updateTask: (taskId, taskData) => apiRequest(`/api/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify(taskData)
    }),
    deleteTask: (taskId) => apiRequest(`/api/tasks/${taskId}`, {
        method: "DELETE"
    }),
    acceptTask: (taskId) => apiRequest(`/api/tasks/${taskId}/accept`, {
        method: "POST"
    }),
    completeTask: (taskId) => apiRequest(`/api/tasks/${taskId}/complete`, {
        method: "POST"
    }),
    confirmTask: (taskId) => apiRequest(`/api/tasks/${taskId}/confirm`, {
        method: "POST"
    }),
    cancelTask: (taskId) => apiRequest(`/api/tasks/${taskId}/cancel`, {
        method: "POST"
    }),
    getMyTasks: (taskType = null) => {
        const params = taskType ? `?task_type=${taskType}` : "";
        return apiRequest(`/api/users/me/tasks${params}`);
    },

    // Message endpoints
    getTaskMessages: (taskId) => apiRequest(`/api/tasks/${taskId}/messages`),
    sendMessage: (taskId, content) => apiRequest("/api/messages", {
        method: "POST",
        body: JSON.stringify({ task_id: taskId, content })
    }),

    // Feedback endpoints
    createFeedback: (taskId, seekerId, rating, comment) => apiRequest("/api/feedback", {
        method: "POST",
        body: JSON.stringify({ task_id: taskId, seeker_id: seekerId, rating, comment })
    }),
    getUserFeedback: (userId) => apiRequest(`/api/users/${userId}/feedback`),

    // Admin endpoints
    getAllUsers: () => apiRequest("/api/admin/users"),
    getAllTasks: (statusFilter = null) => {
        const params = statusFilter ? `?status_filter=${statusFilter}` : "";
        return apiRequest(`/api/admin/tasks${params}`);
    },
    adminDeleteTask: (taskId) => apiRequest(`/api/admin/tasks/${taskId}`, {
        method: "DELETE"
    }),

    // Report endpoints
    createReport: (taskId, reportType, description) => apiRequest("/api/reports", {
        method: "POST",
        body: JSON.stringify({ task_id: taskId, report_type: reportType, description })
    }),
    getReports: () => apiRequest("/api/reports"),
    getReport: (reportId) => apiRequest(`/api/reports/${reportId}`),
    deleteReport: (reportId) => apiRequest(`/api/reports/${reportId}`, {
        method: "DELETE"
    }),

    // Notification endpoints
    getNotifications: () => apiRequest("/api/notifications"),
    markNotificationRead: (notificationId) => apiRequest(`/api/notifications/${notificationId}/read`, {
        method: "PUT"
    }),
    deleteNotification: (notificationId) => apiRequest(`/api/notifications/${notificationId}`, {
        method: "DELETE"
    })
};

// Search tasks by title (server-side substring match) with optional status filter
api.searchTasks = (query, statusFilter = null) => {
    const parts = [];
    if (query) parts.push(`query=${encodeURIComponent(query)}`);
    if (statusFilter) parts.push(`status_filter=${encodeURIComponent(statusFilter)}`);
    const params = parts.length ? `?${parts.join("&")}` : "";
    return apiRequest(`/api/tasks/search${params}`);
};

export { auth };

