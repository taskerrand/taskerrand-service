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
});

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

