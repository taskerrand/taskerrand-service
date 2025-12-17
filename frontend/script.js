import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'en';

// If an account is already logged in, redirect from index.html to dashboard.html
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = "./dashboard.html";
    }
});

const provider = new GoogleAuthProvider();

const googleLogin = document.getElementById("google-login-btn-id");
if (googleLogin) {
    googleLogin.addEventListener("click", function() {
        signInWithPopup(auth, provider)
            .then((result) => {
                const user = result.user;
                console.log(user);
                window.location.href = "./dashboard.html";
            })
            .catch((error) => {
                console.error("Login error:", error);
                alert("Login failed: " + error.message);
            });
    });
}
