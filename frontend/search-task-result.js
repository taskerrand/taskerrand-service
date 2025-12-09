import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";
import { api } from "./api.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Parse query param helper
function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "./index.html";
        return;
    }
    const usernameEl = document.getElementById("username");
    const profileEl = document.getElementById("profile");
    if (usernameEl) usernameEl.textContent = user.displayName || user.email;
    if (profileEl) profileEl.src = user.photoURL || "";

    await performSearch();
});

async function performSearch() {
    const q = getQueryParam('q') || '';
    const container = document.getElementById('search-results-container');
    const heading = document.getElementById('results-heading');
    const paginationEl = document.getElementById('search-pagination');

    document.getElementById('search-input').value = q;
    heading.textContent = q ? `Search Results for "${q}"` : 'Search Results';

    try {
        const results = await api.searchTasks(q);

        if (!results || results.length === 0) {
            container.innerHTML = `<p class='loading'>No tasks match your search.</p>`;
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }

        // client-side pagination
        let allTasks = results;
        let currentPage = 1;
        const perPage = 20;

        async function renderPage(page) {
            const start = (page - 1) * perPage;
            const pageTasks = allTasks.slice(start, start + perPage);

            const rendered = await Promise.all(pageTasks.map(async (task) => {
                let posterName = 'Unknown';
                try {
                    const u = await api.getUser(task.poster_id);
                    posterName = u.name || u.email || posterName;
                } catch (e) {}

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

        await renderPage(currentPage);

        function renderPagination() {
            const totalPages = Math.ceil(allTasks.length / perPage);
            if (totalPages <= 1) {
                paginationEl.innerHTML = '';
                return;
            }

            let html = '';
            html += `<button id='prev-page' ${currentPage === 1 ? 'disabled' : ''}>Prev</button>`;

            const startPage = Math.max(1, currentPage - 2);
            const endPage = Math.min(totalPages, currentPage + 2);
            for (let p = startPage; p <= endPage; p++) {
                html += `<button class='page-btn' data-page='${p}' ${p === currentPage ? 'disabled' : ''}>${p}</button>`;
            }

            html += `<button id='next-page' ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;
            paginationEl.innerHTML = html;

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

        if (allTasks.length >= 40) renderPagination();
        else paginationEl.innerHTML = '';

    } catch (err) {
        console.error('Search error', err);
        container.innerHTML = `<div class="error">Error searching tasks: ${err.message}</div>`;
    }
}

// search form actions on this page
const searchForm = document.getElementById('search-form');
if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = document.getElementById('search-input').value.trim();
        if (!q) return;
        // update URL and perform search
        const url = new URL(window.location.href);
        url.searchParams.set('q', q);
        window.history.replaceState({}, '', url);
        performSearch();
    });
}

// Logout button
const logoutBtn = document.getElementById("google-logout-btn-id");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => {
            window.location.href = "./index.html";
        });
    });
}
